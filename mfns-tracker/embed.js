/*
 * embed.js — runs Muffins' Tracker 2.0 inside Rando Hub, unchanged.
 *
 * His tracker (https://github.com/KrisDavie/alttptracker, react_rewrite) is
 * built from his source as-is (app/). It expects to sit at the root of a
 * website, so this page, loaded just before it, makes it at home in a
 * subfolder without touching his code:
 *
 *   - his routes ("/", "/tracker?id=…", "/map", "/event-log") are given to
 *     him as the page's path (?route=…, default "/")
 *   - his pictures and files ("/items/…", "/dungeons/…", "/motd.txt" …) are
 *     pointed at app/ where they were built to
 *   - opening the tracker opens it right here (in Rando Hub's tracker panel)
 *     instead of a new window; his map / event-log pop-outs still open their
 *     own windows
 *   - autotracking: the first time, he's set to talk QUsb2snes on
 *     localhost:23074, which ../bridge/sni-shim.js (loaded before this)
 *     answers from Rando Hub's built-in emulator
 *
 * Problems with the tracker itself: Muffins (his Discord). Problems with
 * running it inside Rando Hub: Rando Hub.
 */
(function () {
  'use strict';
  var here = location.href.split('#')[0];
  var host = here.split('?')[0];
  var BASE = new URL('app/', host).pathname;                 // e.g. /Rando-hub-Beta/mfns-tracker/app/
  var PUBLIC = /^\/(items|dungeons|sprites|overlay|fonts|lightworld\.png|darkworld\.png|discord\.png|alerts\.txt|motd\.txt|vite\.svg)(\/|$|\?|#)/;
  var ROUTES = /^\/(tracker|map|event-log)?(\?|$)/;

  function fix(u) {
    if (typeof u !== 'string') return u;
    if (PUBLIC.test(u)) return BASE + u.slice(1);
    return u;
  }
  function fixCss(v) {
    return typeof v === 'string' && v.indexOf('url(') >= 0
      ? v.replace(/url\((["']?)(\/[^"')]+)\1\)/g, function (m, q, p) { return 'url(' + q + fix(p) + q + ')'; })
      : v;
  }

  // ── his route, as the page's path ─────────────────────────────────────────
  var route = new URLSearchParams(location.search).get('route') || '/';
  if (!ROUTES.test(route)) route = '/';
  history.replaceState(history.state, '', route);
  window.__rhMfnsHost = host;

  // ── his files ─────────────────────────────────────────────────────────────
  function wrapSetter(proto, prop, conv) {
    var d = null, p = proto;
    while (p && !(d = Object.getOwnPropertyDescriptor(p, prop))) p = Object.getPrototypeOf(p);
    if (!d || !d.set) return;
    Object.defineProperty(p, prop, {
      configurable: true, enumerable: d.enumerable,
      get: d.get, set: function (v) { d.set.call(this, conv(v)); },
    });
  }
  wrapSetter(HTMLImageElement.prototype, 'src', fix);
  wrapSetter(HTMLSourceElement.prototype, 'src', fix);
  wrapSetter(HTMLLinkElement.prototype, 'href', fix);
  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === 'src' || n === 'href' || n === 'srcset' || n === 'poster') v = fix(v);
    else if (n === 'style') v = fixCss(v);
    return setAttr.call(this, n, v);
  };
  // Inline styles (background pictures): React writes them straight onto each
  // element's style, which can't be caught on the way in, so they're fixed as
  // they land — a MutationObserver runs before the browser fetches anything.
  function fixStyle(el) {
    var v = el.getAttribute && el.getAttribute('style');
    if (v && v.indexOf('url(') >= 0) { var f = fixCss(v); if (f !== v) setAttr.call(el, 'style', f); }
  }
  function scan(n) {
    if (n.nodeType !== 1) return;
    fixStyle(n);
    if (n.querySelectorAll) { var l = n.querySelectorAll('[style*="url("]'); for (var i = 0; i < l.length; i++) fixStyle(l[i]); }
  }
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'attributes') fixStyle(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  var setProp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (n, v, pr) { return setProp.call(this, n, fixCss(v), pr); };
  var realFetch = window.fetch;
  if (realFetch) window.fetch = function (input, init) {
    if (typeof input === 'string') input = fix(input);
    else if (input && input.url && typeof Request !== 'undefined' && input instanceof Request) {
      var u = new URL(input.url);
      if (u.origin === location.origin && PUBLIC.test(u.pathname)) input = new Request(fix(u.pathname) + u.search, input);
    }
    return realFetch.call(this, input, init);
  };
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { arguments[1] = fix(u); return xo.apply(this, arguments); };

  // ── opening the tracker: here; pop-outs: their own window ─────────────────
  var realOpen = window.open;
  function inMudora2() { try { return !!(window.parent !== window && window.parent.Mudora2); } catch (e) { return false; } }
  window.open = function (u, name, feat) {
    if (typeof u === 'string' && ROUTES.test(u)) {
      var url = host + '?route=' + encodeURIComponent(u);
      var embedded = window.parent !== window;
      if (/^\/tracker/.test(u) && embedded) { location.assign(url); return window; }
      // Mudora 2.0 is the map: his own pop-out map / event log aren't opened
      if (inMudora2()) return null;
      return realOpen.call(window, url, name, feat);
    }
    return realOpen.apply(window, arguments);
  };

  // ── for Mudora 2.0's autotracking details: errors on his page, kept ────────
  var errs = window.__rhErrors = [];
  function keep(msg) { try { errs.push({ at: Date.now(), msg: String(msg).slice(0, 300) }); if (errs.length > 20) errs.shift(); } catch (e) {} }
  window.addEventListener('error', function (e) { keep((e.message || e.error) + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { keep('promise: ' + (e.reason && (e.reason.message || e.reason))); });
  var ce = console.error;
  console.error = function () { keep(Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : String(a); }).join(' ')); return ce.apply(console, arguments); };

  // ── for Mudora 2.0: his tracker's state, read and changed the way his own
  // buttons do (his Redux store, found on his page's React root) ──────────
  var found = null;
  window.__rhStore = function () {
    if (found) return found;
    var r = document.getElementById('root'); if (!r) return null;
    var k = Object.keys(r).filter(function (x) { return x.indexOf('__reactContainer$') === 0; })[0];
    if (!k) return null;
    var stack = [r[k]], n = 0;
    while (stack.length && n++ < 20000) {
      var f = stack.pop(); if (!f) continue;
      var p = f.memoizedProps;
      if (p && p.store && typeof p.store.getState === 'function' && typeof p.store.dispatch === 'function') return (found = p.store);
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return null;
  };

  // ── autotracking through Rando Hub's emulator ─────────────────────────────
  // Inside Rando Hub the only device is the built-in emulator, answered on
  // QUsb2snes localhost:23074 by ../bridge/sni-shim.js: always point him there
  // (a leftover SNI choice from his launch page would leave it unconnected).
  try {
    localStorage.setItem('muffins_autotrack_prefs', JSON.stringify({ protocol: 'qusb2snes', host: 'localhost', port: 23074 }));
  } catch (e) {}

  // ── Launch Tracker: say it's on its way, and only once ────────────────────
  // His launch saves the new game before opening it; with the game running
  // alongside, that can take a few seconds, and a second click started a
  // second game. Rando Hub shows "Launching…" and ignores repeat clicks.
  var launching = 0;
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button');
    if (!b || !/Launch Tracker/.test(b.textContent || '')) return;
    if (launching && Date.now() - launching < 30000) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    launching = Date.now();
    var o = document.createElement('div');
    o.textContent = 'Launching… (a few seconds while the game runs)';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:600 18px system-ui,sans-serif;';
    document.documentElement.appendChild(o);
    setTimeout(function () { launching = 0; o.remove(); }, 30000);
  }, true);
})();
