import type { Chunk, StudyManifest } from './contracts.ts'

export interface LoadMeasurements {
  version: 'verified-chunk-loader/1'
  networkBytes: number
  cachedBytes: number
  cacheAvailable: boolean
  verificationMs: number
  decodeMs: number
  compileMs: number
  totalMs: number
}
export const ROAD_CACHE_NAME = 'pfad-road-chunks-v1'
const CACHE_BUDGET = 256 * 1024 * 1024
const CONCURRENCY = 2
interface ChunkCache {
  keys(): Promise<readonly Request[]>
  match(key: string | Request): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
  delete(key: string | Request): Promise<boolean>
}

/** IndexedDB persists through worker replacement and private WebKit navigation. */
async function persistentCache(): Promise<ChunkCache> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ROAD_CACHE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('chunks')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Road cache is unavailable'))
  })
  db.onversionchange = () => db.close()
  const operation = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('chunks', mode), request = run(transaction.objectStore('chunks'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = transaction.onabort = () => reject(transaction.error)
  })
  return {
    keys: async () => (await operation('readonly', store => store.getAllKeys())).map(key => new Request(String(key))),
    match: async key => {
      const bytes = await operation('readonly', store => store.get(typeof key === 'string' ? key : key.url)) as ArrayBuffer | undefined
      return bytes ? new Response(bytes) : undefined
    },
    put: async (key, response) => { const bytes = await response.arrayBuffer(); await operation('readwrite', store => store.put(bytes, key)) },
    delete: async key => { await operation('readwrite', store => store.delete(typeof key === 'string' ? key : key.url)); return true },
  }
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, x => x.toString(16).padStart(2, '0')).join('')
}

/** Cache compressed, content-addressed bytes only. Storage failure is not a graph failure. */
async function openCache(manifest: StudyManifest, base: string) {
  try {
    if (manifest.downloadBytes > CACHE_BUDGET) return undefined
    let cache: ChunkCache
    if (globalThis.indexedDB) {
      cache = await persistentCache()
      // Retire the alternate store when the durable backend is available.
      // A browser upgrade must not retain two independent payload budgets.
      await globalThis.caches?.delete(ROAD_CACHE_NAME).catch(() => {})
    } else { if (!globalThis.caches) return undefined; cache = await caches.open(ROAD_CACHE_NAME) }
    const root = new URL('/pfad-road-cache-v1/', base)
    const recordUrl = new URL(`${manifest.identity}/record`, root).href
    const keys = await cache.keys()
    const records = await Promise.all(keys.filter(key => key.url.endsWith('/record')).map(async key => {
      let record: { bytes: number; used: number } | undefined
      try { record = await (await cache.match(key))?.json() } catch { /* Replace corrupt metadata without trusting its budget. */ }
      return { identity: new URL(key.url).pathname.split('/').at(-2)!, bytes: record && Number.isSafeInteger(record.bytes) && record.bytes >= 0 ? record.bytes : CACHE_BUDGET, used: record && Number.isFinite(record.used) ? record.used : 0 }
    }))
    const keep = new Set([manifest.identity])
    let bytes = manifest.downloadBytes
    for (const record of records.filter(r => r.identity !== manifest.identity).sort((a, b) => b.used - a.used)) {
      if (keep.size < 2 && bytes + record.bytes <= CACHE_BUDGET) { keep.add(record.identity); bytes += record.bytes }
    }
    await Promise.all(keys.filter(key => !keep.has(new URL(key.url).pathname.split('/')[2])).map(key => cache.delete(key)))
    await cache.put(recordUrl, new Response(JSON.stringify({ bytes: manifest.downloadBytes, used: Date.now() })))
    return { cache, key: (chunk: Chunk) => new URL(`${manifest.identity}/${chunk.sha256}`, root).href }
  } catch { return undefined }
}

export async function decodeChunk(bytes: Uint8Array<ArrayBuffer>, chunk: Chunk) {
  const unpacked = new Uint8Array(chunk.decodedBytes)
  const decoder = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  let offset = 0
  try {
    while (true) {
      const { value, done } = await decoder.read()
      if (done) break
      if (offset + value.length > unpacked.length) throw new Error('Decoded road chunk exceeds its declared size')
      unpacked.set(value, offset); offset += value.length
    }
    if (offset !== unpacked.length) throw new Error('Incomplete decoded road chunk')
    if (chunk.stride && offset !== chunk.count * chunk.stride) throw new Error('Invalid road chunk layout')
    return unpacked.buffer
  } catch (error) { await decoder.cancel().catch(() => {}); throw error }
}

/** Two in-flight chunks, consumed in manifest order. No future group is decoded early. */
export async function loadChunks(
  manifest: StudyManifest, url: string,
  progress: (loaded: number, stage: string) => void,
  consume: (chunk: Chunk, bytes: ArrayBuffer) => void | Promise<void>,
  topologyOnly = false,
) {
  const measurements: LoadMeasurements = { version: 'verified-chunk-loader/1', networkBytes: 0, cachedBytes: 0, cacheAvailable: false, verificationMs: 0, decodeMs: 0, compileMs: 0, totalMs: 0 }
  const storage = await openCache(manifest, url)
  measurements.cacheAvailable = !!storage
  const controller = new AbortController()
  let loaded = 0
  const obtain = async (chunk: Chunk) => {
    const stage = chunk.kind === 'geometry' ? 'Loading road shapes' : 'Loading the national graph'
    const verify = async (bytes: Uint8Array<ArrayBuffer>) => {
      const started = performance.now()
      const valid = bytes.byteLength === chunk.bytes && await sha256(bytes) === chunk.sha256
      measurements.verificationMs += performance.now() - started
      if (!valid) throw new Error('Road chunk checksum or size mismatch')
    }
    let compressed: Uint8Array<ArrayBuffer> | undefined, cached = false
    if (storage) {
      try {
        const found = await storage.cache.match(storage.key(chunk))
        if (found) {
          const bytes = new Uint8Array(await found.arrayBuffer())
          await verify(bytes); compressed = bytes; cached = true
          measurements.cachedBytes += bytes.length; loaded += bytes.length
          progress(loaded, 'Checking cached road data')
        }
      } catch { await storage.cache.delete(storage.key(chunk)).catch(() => {}) }
    }
    if (!compressed) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let received = 0
        try {
          progress(loaded, attempt ? 'Retrying a road chunk' : stage)
          const response = await fetch(new URL(chunk.path, url), { signal: controller.signal })
          if (!response.ok || !response.body) throw new Error('Road chunk unavailable')
          const reader = response.body.getReader(), bytes = new Uint8Array(chunk.bytes)
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              measurements.networkBytes += value.length
              if (received + value.length > bytes.length) throw new Error('Road chunk size mismatch')
              bytes.set(value, received); received += value.length; loaded += value.length
              progress(loaded, stage)
            }
          } finally { await reader.cancel().catch(() => {}) }
          await verify(bytes); compressed = bytes; break
        } catch {
          loaded -= received
          if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
          if (attempt === 1) throw new Error('A road chunk could not be verified. The incomplete graph cannot be searched. Try again; verified chunks are kept when storage is available.')
        }
      }
    }
    const started = performance.now(), decoded = await decodeChunk(compressed!, chunk)
    measurements.decodeMs += performance.now() - started
    if (storage && !cached && !controller.signal.aborted) {
      await storage.cache.put(storage.key(chunk), new Response(compressed!.buffer, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => {})
    }
    return decoded
  }
  try {
    for (const kind of ['nodes', 'edges', 'geometry'] as const) {
      if (topologyOnly && kind === 'geometry') continue
      const group = manifest.chunks.filter(chunk => chunk.kind === kind)
      const pending = new Map<number, Promise<ArrayBuffer>>()
      const launch = (i: number) => {
        if (i >= group.length) return
        const promise = obtain(group[i]); pending.set(i, promise)
        // Prefetched failures must not become unhandled while the previous chunk is consumed.
        void promise.catch(() => {})
      }
      for (let i = 0; i < Math.min(CONCURRENCY, group.length); i++) launch(i)
      for (let i = 0; i < group.length; i++) {
        const bytes = await pending.get(i)!; pending.delete(i)
        await consume(group[i], bytes); launch(i + CONCURRENCY)
      }
    }
    return measurements
  } finally { controller.abort() }
}
