// Public, read-only delivery of manually selected immutable graph and outline releases.
const PREFIX = '/pfad-data/'
const GEOGRAPHY_KEY = /^geo-[a-z]{2}-\d{8}-[a-f0-9]{12}\/(?:manifest\.json|(?:border|lakes)-[a-f0-9]{12}\.json)$/
const KEY = /^[a-z]{2,8}-\d{8}-[a-f0-9]{12}\/(?:manifest\.json|(?:nodes|edges|geometry)-\d{3}-[a-f0-9]{12}\.bin\.gz\.bin|evidence-[a-f0-9]{12}\.json\.gz\.bin)$/
function headers(extra = {}) {
  return new Headers({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Expose-Headers': 'ETag, Content-Length, Content-Range', 'X-Content-Type-Options': 'nosniff', ...extra })
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return new Response('Read-only dataset service', { status: 405, headers: headers({ Allow: 'GET, HEAD, OPTIONS' }) })
    const key = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : ''
    if (!KEY.test(key) && !GEOGRAPHY_KEY.test(key)) return new Response('Dataset object not found', { status: 404, headers: headers({ 'Cache-Control': 'no-store' }) })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers({ 'Access-Control-Max-Age': '86400' }) })
    // Ignore query strings; they cannot select different content or fragment cache.
    const cacheKey = new Request(`${url.origin}${PREFIX}${key}`)
    const cache = globalThis.caches?.default
    const conditional = request.headers.has('Range') || request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since')
    if (cache && !conditional) {
      const hit = await cache.match(cacheKey)
      if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit
    }
    const object = request.method === 'HEAD' ? await env.DATA.head(key) : await env.DATA.get(key, { onlyIf: request.headers, range: request.headers })
    if (!object) return new Response('Dataset object not found', { status: 404, headers: headers({ 'Cache-Control': 'no-store' }) })
    const h = headers({ 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': key.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/octet-stream', ETag: object.httpEtag, 'Last-Modified': object.uploaded.toUTCString(), 'Accept-Ranges': 'bytes' })
    // Gzip is an opaque container: no Content-Encoding header. Browser checksums
    // verify the stored compressed bytes before explicit decompression.
    if (request.method !== 'HEAD' && !('body' in object)) return new Response(null, { status: request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since') ? 304 : 412, headers: h })
    let status = 200
    if (request.headers.has('Range') && object.range) {
      const { offset, length } = object.range
      h.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`); h.set('Content-Length', String(length)); status = 206
    } else h.set('Content-Length', String(object.size))
    const response = new Response(request.method === 'HEAD' ? null : object.body, { status, headers: h })
    if (cache && request.method === 'GET' && !conditional && status === 200) ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  },
}
