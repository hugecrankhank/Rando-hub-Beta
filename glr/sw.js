/*
 * Service worker: makes the site installable and lets it open offline.
 * Network-first for this site's own files (updates show up as soon as you're
 * online); the cache is a fallback. Fonts are cached as they load.
 */
// One name per copy of the app (Zelda 1 also runs inside Rando Hub on the same site)
const PREFIX = 'glr-v', SCOPE = ':' + self.registration.scope;
const CACHE = 'glr-v1' + SCOPE;
const EXTERNAL = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './', './index.html', './manifest.webmanifest', './js/icons.js', './js/store.js', './js/nes-bridge.js',
    './js/tgl-data.js', './js/cpu6502.js', './js/labmap.js', './js/labmap-worker.js', './js/randomizer.js',
    './js/tracker.js', './js/seed.js', './js/diag.js', './js/app.js',
    './emu/core.js', './emu/palettes.js', './emu/xbrz.js', './emu/xbrz.wasm', './emu/video.js', './emu/audio.js', './emu/audio-worklet.js', './emu/input.js', './emu/player.js',
    './emu/fceumm.wasm', './emu/shaders/stock.glsl', './emu/shaders/6xbrz.glsl',
  ])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  // Only this app's own older caches: other apps share this site (github.io),
  // and their saved files aren't ours to clear (plus our old unscoped one).
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith(PREFIX) && (k.endsWith(SCOPE) || k.indexOf(':') < 0)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  const own = url.startsWith(self.registration.scope);
  if (!own && !EXTERNAL.some((p) => url.startsWith(p))) return;
  // Our own files always revalidate (GitHub Pages otherwise lets browsers
  // reuse a page for 10 minutes). Unchanged files come back as a quick 304.
  e.respondWith(
    fetch(own ? req.url : req, own ? { cache: 'no-cache', credentials: 'same-origin' } : undefined).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: own }).then((hit) => hit || Response.error()))
  );
});
