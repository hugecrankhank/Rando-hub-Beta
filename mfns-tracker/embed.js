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
  window.open = function (u, name, feat) {
    if (typeof u === 'string' && ROUTES.test(u)) {
      var url = host + '?route=' + encodeURIComponent(u);
      var embedded = window.parent !== window;
      if (/^\/tracker/.test(u) && embedded) { location.assign(url); return window; }
      return realOpen.call(window, url, name, feat);
    }
    return realOpen.apply(window, arguments);
  };

  // ── autotracking through Rando Hub's emulator (first time only) ───────────
  try {
    if (!localStorage.getItem('muffins_autotrack_prefs')) {
      localStorage.setItem('muffins_autotrack_prefs', JSON.stringify({ protocol: 'qusb2snes', host: 'localhost', port: 23074 }));
    }
  } catch (e) {}
})();
