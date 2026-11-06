/*
 * Service worker: makes the site installable and lets it open offline.
 * Network-first for this site's own files (updates show up as soon as you're
 * online); the cache is a fallback. Fonts are cached as they load.
 */
// One name per copy of the app (it shares the site with the hub and the other games)
const PREFIX = 'smz3r-v', SCOPE = ':' + self.registration.scope;
const CACHE = 'smz3r-v1' + SCOPE;
const EXTERNAL = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './', './index.html', './manifest.webmanifest', './hub.js', './gen/texts.js', './gen/smz3gen.js', './gen/zsm.ips', './js/data.js', './js/store.js', './js/tracker.js', '../combo-theme.js', './js/z3pick.js', './z3host.html', './js/icons.js', './js/map.js', '../world-map.js', '../sm/js/data.js', '../tracker/map/map_lw.png', '../tracker/map/map_dw.png', '../tracker/items/aga11.png', '../tracker/items/bombos10.png', '../tracker/items/book1.png', '../tracker/items/boomerang01.png', '../tracker/items/boomerang10.png', '../tracker/items/boots1.png', '../tracker/items/bottle1.png', '../tracker/items/bottle2.png', '../tracker/items/bottle3.png', '../tracker/items/bottle4.png', '../tracker/items/bow10.png', '../tracker/items/bow12.png', '../tracker/items/caneofbyrna1.png', '../tracker/items/caneofsomaria1.png', '../tracker/items/cape1.png', '../tracker/items/ether10.png', '../tracker/items/firerod1.png', '../tracker/items/flippers1.png', '../tracker/items/flute10.png', '../tracker/items/gloves1.png', '../tracker/items/gloves2.png', '../tracker/items/halfmagic1.png', '../tracker/items/hammer1.png', '../tracker/items/hookshot1.png', '../tracker/items/icerod1.png', '../tracker/items/lamp1.png', '../tracker/items/mail1.png', '../tracker/items/mail2.png', '../tracker/items/mirror1.png', '../tracker/items/moonpearl1.png', '../tracker/items/mushroom1.png', '../tracker/items/net1.png', '../tracker/items/powder10.png', '../tracker/items/quake10.png', '../tracker/items/shield1.png', '../tracker/items/shield2.png', '../tracker/items/shield3.png', '../tracker/items/shovel1.png', '../tracker/items/sword1.png', '../tracker/items/sword2.png', '../tracker/items/sword3.png', '../tracker/items/sword4.png', '../tracker/boss/boss0.png', '../tracker/boss/boss1.png', '../tracker/boss/boss2.png', '../tracker/boss/boss3.png', '../tracker/boss/boss4.png', '../tracker/boss/boss5.png', '../tracker/boss/boss6.png', '../tracker/boss/boss7.png', '../tracker/boss/boss8.png', '../tracker/boss/boss9.png', './js/seed.js', './js/app.js',
    '../game-health.js', '../z3-media.js', '../randomizer/sprite.js', '../randomizer/msu.js', '../randomizer/zip.js', '../randomizer/library.js', '../randomizer/collection.js', '../sprites.json', '../game-popout.js', '../popout-panel.html', '../credits-splash.js', '../fonts/PressStart2P-Regular.ttf',
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
