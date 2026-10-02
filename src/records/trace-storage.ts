import type { SearchResult } from '../search/contracts.ts'
import { releaseBuffers } from '../search/release-buffers.ts'

export const TRACE_ARCHIVE_MINIMUM = 64 * 1024 * 1024
export const TRACE_BLOCK_BYTES = 8 * 1024 * 1024
const DATABASE = 'pfad-exact-traces-v1'
export interface TraceStore {
  write(index: number, bytes: Uint8Array<ArrayBuffer>): Promise<void>
  read(index: number): Promise<Uint8Array<ArrayBuffer>>
  commit(metadata: unknown): Promise<void>
  dispose(): Promise<void>
}
const pause = () => new Promise<void>(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve() }; channel.port2.postMessage(0) })
const digest = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')

function operation<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode), request = run(tx)
    let result: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => resolve(result)
    tx.onerror = tx.onabort = () => reject(tx.error ?? request.error ?? new Error('Trace storage transaction failed'))
  })
}
async function remove(db: IDBDatabase, id: string) {
  await operation(db, ['blocks', 'records'], 'readwrite', tx => {
    tx.objectStore('blocks').delete(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`))
    return tx.objectStore('records').delete(id)
  })
}
async function openDatabase() {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => { request.result.createObjectStore('blocks'); request.result.createObjectStore('records') }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Trace storage is unavailable'))
  })
}
async function sweepAbandoned(db: IDBDatabase) {
  if (!navigator.locks) return
  const records = await operation(db, ['records'], 'readonly', tx => tx.objectStore('records').getAllKeys())
  for (const key of records) if (typeof key === 'string') await navigator.locks.request(`${DATABASE}:${key}`, { ifAvailable: true }, async lock => { if (lock) await remove(db, key) })
}
/** Browser locks keep other tabs' active recordings intact during startup cleanup. */
export async function cleanupTraceStorage() {
  if (!globalThis.indexedDB || !navigator.locks) return
  let db: IDBDatabase | undefined
  try { db = await openDatabase(); await sweepAbandoned(db) } catch { /* Optional storage cannot prevent study startup. */ }
  finally { db?.close() }
}
async function openStore(result: SearchResult): Promise<TraceStore> {
  const db = await openDatabase()
  const id = crypto.randomUUID()
  let unlock: (() => void) | undefined
  try {
    // Browser locks protect live records in other tabs. Abandoned records can be
    // removed on the next archive; browsers without locks skip this sweep.
    if (navigator.locks) {
      await sweepAbandoned(db)
      const lifetime = new Promise<void>(resolve => { unlock = resolve })
      await new Promise<void>((resolve, reject) => { void navigator.locks.request(`${DATABASE}:${id}`, async () => { resolve(); await lifetime }).catch(reject) })
    }
    await operation(db, ['records'], 'readwrite', tx => tx.objectStore('records').put({ state: 'writing', count: result.trace.length, dataset: result.dataset, algorithm: result.algorithm }, id))
  } catch (error) { unlock?.(); db.close(); throw error }
  return {
    async write(index, bytes) { await operation(db, ['blocks'], 'readwrite', tx => tx.objectStore('blocks').put(bytes.slice().buffer, `${id}:${index}`)) },
    async read(index) {
      const bytes = await operation(db, ['blocks'], 'readonly', tx => tx.objectStore('blocks').get(`${id}:${index}`))
      if (!(bytes instanceof ArrayBuffer)) throw new Error('The exact recording block is unavailable')
      return new Uint8Array(bytes)
    },
    async commit(metadata) { await operation(db, ['records'], 'readwrite', tx => tx.objectStore('records').put(metadata, id)) },
    async dispose() { try { await remove(db, id) } finally { unlock?.(); db.close() } },
  }
}

/** Archive only after every exact block and its metadata have committed. */
export async function archiveTrace(result: SearchResult, options: { minimumBytes?: number; signal?: AbortSignal; valid?: () => boolean; store?: () => Promise<TraceStore> } = {}) {
  if (result.traceArchive || result.trace.byteLength < (options.minimumBytes ?? TRACE_ARCHIVE_MINIMUM)) return false
  // Disk blocks use the existing little-endian export representation.
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) return false
  let store: TraceStore | undefined
  const check = () => { options.signal?.throwIfAborted(); if (options.valid && !options.valid()) throw new Error('Trace preparation was superseded') }
  try {
    check()
    if (!options.store) {
      const capacity = await navigator.storage?.estimate().catch(() => undefined)
      if (capacity?.quota !== undefined && capacity.usage !== undefined && capacity.quota - capacity.usage < result.trace.byteLength + TRACE_BLOCK_BYTES * 2) return false
    }
    store = await (options.store ? options.store() : openStore(result))
    const trace = result.trace, count = trace.length, bytes = trace.byteLength, kinds = new Uint8Array(Math.ceil(count / 4)), hashes: string[] = []
    for (let begin = 0; begin < count; begin += 262144) {
      check()
      for (let i = begin; i < Math.min(count, begin + 262144); i++) kinds[i >>> 2] |= (trace[i] & 3) << ((i & 3) * 2)
      await pause()
    }
    for (let offset = 0; offset < bytes; offset += TRACE_BLOCK_BYTES) {
      check()
      const block = new Uint8Array(trace.buffer as ArrayBuffer, trace.byteOffset + offset, Math.min(TRACE_BLOCK_BYTES, bytes - offset))
      hashes.push(await digest(block)); await store.write(hashes.length - 1, block)
    }
    await store.commit({ schema: 'pfad-exact-trace/1', state: 'complete', count, bytes, blockBytes: TRACE_BLOCK_BYTES, hashes, dataset: result.dataset, algorithm: result.algorithm, tieBreak: result.tieBreak })
    check()
    const committed = store
    let leases = 0, retired = false, cleanup: Promise<void> | undefined
    const clean = () => { if (retired && !leases) cleanup ??= committed.dispose().catch(() => {}); return cleanup ?? Promise.resolve() }
    result.traceArchive = {
      count, kinds, bytes, blocks: hashes.length,
      async readBlock(index) {
        if (index < 0 || index >= hashes.length) throw new Error('Invalid exact recording block')
        const block = await committed.read(index), expected = Math.min(TRACE_BLOCK_BYTES, bytes - index * TRACE_BLOCK_BYTES)
        if (block.byteLength !== expected || await digest(block) !== hashes[index]) throw new Error('The exact recording block could not be verified')
        return block
      },
      retain() {
        if (retired) throw new Error('The recording has been retired')
        leases++; let released = false
        return () => { if (!released) { released = true; leases--; void clean() } }
      },
      async dispose() { retired = true; await clean() },
    }
    result.trace = new Uint32Array(0)
    // Shared fixture/subarray buffers are not detached; dropping the result's
    // reference still allows collection without damaging another owner.
    if (!trace.byteOffset && trace.byteLength === trace.buffer.byteLength) try { releaseBuffers(trace) } catch { /* Storage has committed; collection still releases the old buffer. */ }
    return true
  } catch { await store?.dispose().catch(() => {}); return false }
}
export async function disposeTrace(result: SearchResult | null | undefined) { await result?.traceArchive?.dispose() }
