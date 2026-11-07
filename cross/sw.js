/*
 * Service worker: makes the site installable and lets it open offline.
 * Network-first for this site's own files (updates show up as soon as you're
 * online); the cache is a fallback. Fonts are cached as they load.
 */
// One name per copy of the app (it shares the site with the hub and the other games)
const PREFIX = 'crossr-v', SCOPE = ':' + self.registration.scope;
const CACHE = 'crossr-v1' + SCOPE;
const EXTERNAL = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './', './index.html', './manifest.webmanifest', './hub.js', './nes.html', './nes-tracker.html', './js/gen.js', './js/seed.js', './js/link.js', './js/nes.js', './js/app.js', './js/nes-tracker.js',
    '../smz3/gen/texts.js', '../smz3/gen/smz3gen.js', '../smz3/gen/zsm.ips', '../smz3/js/data.js', '../smz3/js/store.js', '../smz3/js/tracker.js', '../smz3/js/z3pick.js', '../smz3/z3host.html', '../smz3/follow.html', '../smz3/js/icons.js', '../smz3/js/map.js',
    '../zm/js/store.js', '../zm/js/data.js', '../zm/js/gen.js', '../zm/js/tracker.js', '../zm/js/map.js', '../zm/js/icons.js', '../metroid/js/data.js', '../metroid/js/logic.js', '../z1r/js/icons.js', '../z1r/js/owmap.js',
    '../combo-theme.js', '../world-map.js', '../sm/js/data.js', '../tracker/map/map_lw.png', '../tracker/map/map_dw.png',
    '../game-health.js', '../combo-toast.js', '../z3-media.js', '../randomizer/sprite.js', '../randomizer/msu.js', '../randomizer/zip.js', '../randomizer/library.js', '../randomizer/collection.js', '../sprites.json', '../game-popout.js', '../popout-panel.html', '../credits-splash.js', '../fonts/PressStart2P-Regular.ttf',
    // the emulator (../emu/) is outside this scope: the hub's offline cache keeps it
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
