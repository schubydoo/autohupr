/**
 * Preload (node --require) that lets balena-sdk work under `--jitless`.
 *
 * V8's `--jitless` disables WebAssembly. Node's global `fetch` (undici) parses
 * HTTP with a WASM build of llhttp, so under `--jitless` any `fetch` call throws
 * "WebAssembly is not defined". balena-request uses the global `fetch` for its
 * normal request path and captures it once, at module-load time
 * (`const nativeFetch = fetch` in balena-request/build/utils.js).
 *
 * node-fetch — already a balena-request dependency — is built on node:http /
 * node:https, which use the native compiled-in llhttp (no WASM), so it works
 * under `--jitless`. Replacing the global `fetch` with node-fetch *before*
 * balena-sdk is imported means balena-request captures node-fetch instead of
 * undici. That is why this must be a preload (`node --require`), not a normal
 * import: it has to run before the first `require('balena-sdk')`.
 *
 * Native crypto (OpenSSL), TLS and JSON are unaffected by `--jitless`, so once
 * HTTP is off undici the whole hot path is WASM-free.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const nodeFetch = require('node-fetch');

const g = globalThis as unknown as Record<string, unknown>;
g.fetch = nodeFetch;
g.Headers = nodeFetch.Headers;
g.Request = nodeFetch.Request;
g.Response = nodeFetch.Response;
