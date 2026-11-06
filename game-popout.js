/*
 * game-popout.js — "⧉ Pop out" for the game pages (Zelda 1, GLR, Super
 * Metroid, Metroid, Mario RPG, the FF games…): the tracker, or just its map,
 * in a window of its own, to put on a second screen or capture for a stream.
 * (The hub's Zelda 3 page has its own, desktop.js.)
 *
 * The live elements move into the new window (popout-panel.html), so they
 * keep autotracking and answer clicks exactly as in the page: one tracker,
 * shown elsewhere, not a copy. Closing the window, or "Bring back", puts them
 * back. The page's styles come along. Pop-ups need a mouse-sized screen:
 * phones and tablets don't get the buttons.
 *
 * Every game page loads it (ADDING-A-GAME.md); it finds the tracker
 * (#tracker) and its map (#g-map, .ow-map, .lab-map) by itself.
 *
 *   <script src="../game-popout.js" data-hub="../"></script>
 */
(function () {
  'use strict';
  if (window.RHPopout) return;
  var me = document.currentScript, HUB = (me && me.getAttribute('data-hub')) || '../';
  var GAME = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '').split('/').slice(-2).join('-') || 'game';
  var MAP_SEL = '#g-map, .ow-map, .lab-map';
  var wins = {};   // kind → { w, el, ph, parent, next, check }

  // A pop-out's elements live in another document: look there too when the
  // page asks for one of them by id.
  var getById = document.getElementById.bind(document);
  document.getElementById = function (id) {
    var e = getById(id); if (e) return e;
    for (var k in wins) { var w = wins[k] && wins[k].w; try { if (w && !w.closed) { e = w.document.getElementById(id); if (e) return e; } } catch (x) {} }
    return null;
  };

  function canPop() {
    try { return window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 700 && !/iPhone|iPad|Android/.test(navigator.userAgent); } catch (e) { return false; }
  }
  function tracker() { return getById('tracker') || (wins.tracker && wins.tracker.el) || null; }
  function mapEl() { var t = tracker(); return (t && t.querySelector(MAP_SEL)) || document.querySelector(MAP_SEL); }

  function styles(doc) {
    // the page's own styles and stylesheets, its theme variables, its fonts
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(function (n) {
      var c = n.cloneNode(true);
      if (c.tagName === 'LINK') c.href = n.href;   // absolute: the pop-out lives at the hub's root
      doc.head.appendChild(c);
    });
    var cs = getComputedStyle(document.body);
    doc.body.style.background = cs.backgroundColor || '#000';
    doc.body.style.color = cs.color;
    doc.body.style.font = cs.font;
  }

  // pop(kind) — the tracker or its map; pop(kind, el, { title, label, width, height, map }) — any element of the page (a game's own parts)
  function pop(kind, elArg, opts) {
    opts = opts || {};
    var cur = wins[kind];
    if (cur && cur.w && !cur.w.closed) { cur.w.focus(); return; }
    var el = elArg || (kind === 'map' ? mapEl() : tracker());
    if (!el) return;
    if (kind === 'tracker' && wins.map && wins.map.w && !wins.map.w.closed) back('map');   // one window with all of it
    var r = el.getBoundingClientRect(), isMap = kind === 'map' || !!opts.map;
    var W = opts.width || (isMap ? 640 : Math.max(560, Math.round(r.width) || 560)), H = opts.height || (isMap ? 600 : 800);
    var w = window.open(HUB + 'popout-panel.html?k=' + kind, 'rh-pop-' + GAME + '-' + kind, 'popup=yes,width=' + W + ',height=' + H + ',resizable=yes');
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    var rec = { w: w, el: el, parent: el.parentNode, next: el.nextSibling, ph: null };
    wins[kind] = rec;
    var started = Date.now();
    (function ready() {
      var d; try { d = w.document; } catch (e) { return; }
      if (!d || d.readyState !== 'complete' || !d.getElementById('slot')) { if (Date.now() - started < 8000 && !w.closed) return setTimeout(ready, 60); return; }
      d.title = (document.title.split(' - ')[0] || 'Rando Hub') + ' · ' + (opts.title || (kind === 'map' ? 'Map' : 'Tracker'));
      styles(d);
      // a placeholder where it was
      var ph = document.createElement('div');
      ph.className = 'rh-pop-ph';
      ph.style.cssText = 'padding:14px;margin:8px;border:2px dashed currentColor;border-radius:6px;opacity:.7;text-align:center;font-size:13px';
      ph.innerHTML = 'The ' + (opts.label || (kind === 'map' ? 'map' : 'tracker')) + ' is in its own window. <button type="button" style="margin-left:6px;cursor:pointer">Bring back</button>';
      ph.querySelector('button').addEventListener('click', function () { back(kind); });
      rec.ph = ph;
      if (kind === 'tracker') { document.body.classList.add('rh-tracker-out'); }
      else { rec.parent.insertBefore(ph, el); }
      if (kind === 'tracker') { rec.parent.insertBefore(ph, el); ph.style.display = 'none'; }
      var slot = d.getElementById('slot');
      slot.appendChild(d.adoptNode(el));
      slot.dataset.kind = kind;
      if (isMap) { el.style.height = '100%'; el.style.minHeight = '0'; }
      rec.map = isMap;
      layout(kind);
      w.addEventListener('resize', function () { layout(kind); });
      w.addEventListener('pagehide', function () { setTimeout(function () { back(kind); }, 0); });
      rec.check = setInterval(function () { if (w.closed) back(kind); }, 700);
      opened(w);
      buttons();
    })();
  }
  // the tracker in its window: roomy or compact by the window's size, not the page's
  function layout(kind) {
    var rec = wins[kind]; if (!rec || !rec.w || rec.w.closed) return;
    if (kind === 'tracker') {
      var t = rec.el, ww = rec.w.innerWidth, hh = rec.w.innerHeight;
      var want = ww < 480 || hh < 420;
      if (t.classList.contains('compact') !== want) t.classList.toggle('compact', want);
      if (!rec.obs && window.MutationObserver) {
        rec.obs = new MutationObserver(function () { var c = wins.tracker; if (c && c.w && !c.w.closed) { var want2 = c.w.innerWidth < 480 || c.w.innerHeight < 420; if (c.el.classList.contains('compact') !== want2) c.el.classList.toggle('compact', want2); } });
        rec.obs.observe(t, { attributes: true, attributeFilter: ['class'] });
      }
    }
    // the page's own layout and the map's redraw listen for resizes
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  function back(kind) {
    var rec = wins[kind]; if (!rec) return;
    wins[kind] = null;
    if (rec.check) clearInterval(rec.check);
    if (rec.obs) rec.obs.disconnect();
    try {
      var el = rec.el;
      if (rec.map) { el.style.height = ''; el.style.minHeight = ''; }
      document.adoptNode(el);
      if (rec.ph && rec.ph.parentNode) rec.ph.parentNode.replaceChild(el, rec.ph);
      else if (rec.parent) rec.parent.insertBefore(el, rec.next && rec.next.parentNode === rec.parent ? rec.next : null);
    } catch (e) { console.warn('[popout]', e); }
    if (kind === 'tracker') document.body.classList.remove('rh-tracker-out');
    try { if (rec.w && !rec.w.closed) rec.w.close(); } catch (e) {}
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    buttons();
  }

  // ── the buttons: a small bar on the tracker's top edge ───────────────────
  var bar = null;
  function buttons() {
    var t = tracker();
    if (!t || !canPop()) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'rh-pop-bar';
      bar.innerHTML = '<button type="button" data-pop="tracker" title="The tracker in a window of its own (a second screen, or stream capture)">⧉ Tracker</button><button type="button" data-pop="map" title="The map in a window of its own">⧉ Map</button>';
      bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.pop) { e.stopPropagation(); pop(b.dataset.pop); } });
      var css = document.createElement('style');
      css.textContent = '.rh-pop-bar{display:flex;justify-content:flex-end;gap:6px;margin:0 0 4px}.rh-pop-bar[hidden]{display:none}' +
        '.rh-pop-bar button{background:none;border:1px solid currentColor;border-radius:4px;color:inherit;opacity:.65;font:12px/1 system-ui,sans-serif;padding:3px 7px;cursor:pointer}.rh-pop-bar button:hover{opacity:1}' +
        'body.rh-tracker-out main,body.rh-game-only main{grid-template-columns:minmax(0,1fr) !important}body.rh-tracker-out main>aside#tracker,body.rh-tracker-out main>.rh-pop-ph,body.rh-game-only main>aside#tracker,body.rh-game-only main>.rh-pop-ph{display:none !important}' +
        'body.rh-tracker-out.upright #game-wrap,body.rh-game-only.upright #game-wrap{flex:1 1 auto !important;height:auto !important}#rh-game-only{white-space:nowrap}';
      document.head.appendChild(css);
      t.insertBefore(bar, t.firstChild);
    }
    bar.hidden = false;
    var mb = bar.querySelector('[data-pop="map"]');
    mb.hidden = !mapEl() || !!(wins.map && wins.map.w && !wins.map.w.closed);
    bar.querySelector('[data-pop="tracker"]').hidden = !!(wins.tracker && wins.tracker.w && !wins.tracker.w.closed);
  }
  // ── game only: with pop-outs open, the game gets the whole page ──────────
  // Popping anything out (here, or a page's own windows: RHPopout.opened(w)) hides the tracker column
  // so the emulator fills the window; when the last pop-out closes, the column comes back. The header's
  // ▣ Game only / ▤ Tracker button switches it by hand too (desktop).
  var popped = [], gameOnly = false, autoOn = false, gBtn = null;
  function setGameOnly(on, auto) {
    gameOnly = !!on; autoOn = gameOnly && !!auto;
    document.body.classList.toggle('rh-game-only', gameOnly);
    paintGame();
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 120);
  }
  function opened(w) { if (w) popped.push(w); if (!gameOnly) setGameOnly(true, true); }
  function paintGame() {
    var header = document.querySelector('header');
    if (!gBtn && header && tracker()) {
      gBtn = document.createElement('button'); gBtn.type = 'button'; gBtn.className = 'btn'; gBtn.id = 'rh-game-only';
      gBtn.addEventListener('click', function () { setGameOnly(!gameOnly, false); });
      var spacer = header.querySelector('.spacer');
      header.insertBefore(gBtn, spacer ? spacer.nextSibling : null);
    }
    if (!gBtn) return;
    gBtn.hidden = !canPop();
    gBtn.textContent = gameOnly ? '▤ Tracker' : '▣ Game only';
    gBtn.title = gameOnly ? 'Bring the tracker column back' : 'The game alone, filling the page (for a stream with the tracker and maps in their own windows)';
  }
  setInterval(function () {
    popped = popped.filter(function (w) { try { return w && !w.closed; } catch (e) { return false; } });
    if (autoOn && !popped.length) setGameOnly(false);
  }, 1000);
  function init() {
    buttons(); paintGame();
    setInterval(function () { var tr = tracker(); if (bar && tr && tr.firstChild !== bar) tr.insertBefore(bar, tr.firstChild); buttons(); }, 1000);   // a tracker that rebuilds its insides drops the bar: put it back
    window.addEventListener('resize', buttons);
    window.addEventListener('pagehide', function () { for (var k in wins) { var r = wins[k]; try { if (r && r.w && !r.w.closed) r.w.close(); } catch (e) {} } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RHPopout = { pop: pop, back: back, canPop: canPop, opened: opened, gameOnly: function (on) { if (on === undefined) return gameOnly; setGameOnly(on, false); }, out: function (kind) { var c = wins[kind]; return !!(c && c.w && !c.w.closed); }, bar: function () { return bar; } };
})();
