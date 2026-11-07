/*
 * Service worker: makes the site installable and lets it open offline.
 * Network-first for this site's own files (updates show up as soon as you're
 * online); the cache is a fallback. Fonts are cached as they load.
 */
// One name per copy of the app (it shares the site with the hub and the other games)
const PREFIX = 'm1sm-v', SCOPE = ':' + self.registration.scope;
const CACHE = 'm1sm-v1' + SCOPE;
const EXTERNAL = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './', './index.html', './manifest.webmanifest', './hub.js', './js/gen.js', './js/give.js', './js/seed.js', './js/link.js', './js/app.js', './sm-tracker.html',
    '../cross/nes.html', '../cross/js/nes.js', '../cross/nes-tracker.html', '../cross/js/nes-tracker.js', '../smz3/js/store.js',
    '../zm/js/store.js', '../zm/js/data.js', '../zm/js/gen.js', '../zm/js/tracker.js', '../zm/js/map.js', '../zm/js/icons.js', '../metroid/js/data.js', '../metroid/js/logic.js', '../z1r/js/icons.js', '../z1r/js/owmap.js',
    '../sm/js/data.js', '../sm/js/store.js', '../sm/js/logic.js', '../sm/js/map.js', '../sm/js/tracker.js', '../sm/gen/dash-core.js', '../sm/gen/seed-worker.js',
    '../combo-theme.js', '../world-map.js', '../game-health.js', '../game-popout.js', '../popout-panel.html', '../credits-splash.js', '../fonts/PressStart2P-Regular.ttf',
    // the emulators (../emu/, ../z1r/emu/), the randomizer's core and the trackers are outside this scope: the hub's offline cache keeps them
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
