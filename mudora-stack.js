/*
 * mudora-stack.js — the iPad layout (formerly "Stacked") with Mudora and
 * Mudora 2.0, laid out like it is with Hutch's tracker (tablet.js portrait):
 *
 *   upright                          sideways
 *   ┌──────── game ────────┐        ┌──── game ────┬─ Light World ─┐
 *   ├── items · dungeons ──┤        ├── items ·    │               │
 *   │ Light W. │ Dark W.   │        │   dungeons   ├─ Dark World ──┤
 *   └──────────┴───────────┘        └──────────────┴───────────────┘
 *
 * Mudora is one page, so its frame fills the whole area and the game sits on
 * top of it, over a space Mudora leaves free (it's told the size by
 * postMessage {type: 'mudora-stack', hole, each, side}; mudora/ui.js lays its
 * items, dungeons and maps around it). Mudora's options move behind its ⚙.
 *
 * Sizes as tablet.js: each map min(half the height, 42% of the width) sideways,
 * min(half the width, 45% of the height) upright; the game takes the SNES
 * picture's shape in the space left.
 *
 * Tablet on a wide screen (16:10 and wider sideways, e.g. Galaxy Tab S9 FE):
 * the iPad arrangement would leave wide black bars beside the game, so here
 *
 *   ┌──── game ────┬ items ──┬─ Light World ─┐
 *   │              │         │               │
 *   ├── counters ──┤dungeons ├─ Dark World ──┤
 *   └──────────────┴─────────┴───────────────┘
 *
 * the game gets exactly its picture's shape, the counters the strip under it,
 * the items and dungeons a column beside it and the maps the full height.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MAP_GAP = 4, last = '', active = false;

  function isIPad() {
    var ua = navigator.userAgent || '';
    return /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  }
  function pref() { try { return localStorage.getItem('unified-kara-layout') || 'auto'; } catch (e) { return 'auto'; } }
  // A touch tablet that isn't an iPad (Android): Auto means Tablet there
  function touchTablet() {
    var fine = false;
    try { fine = window.matchMedia('(pointer: fine)').matches; } catch (e) {}
    var W = window.innerWidth, H = window.innerHeight;
    return !fine && (navigator.maxTouchPoints || 0) > 0 && Math.max(W, H) >= 900 && Math.min(W, H) >= 600;
  }
  function want() {
    var T = window.UnifiedTracker;
    if (!T || !T.mudoraUi || !T.mudoraUi() || T.off()) return false;
    if (window.UnifiedPhone && window.UnifiedPhone.wanted && window.UnifiedPhone.wanted()) return false;
    if (document.body.classList.contains('emo-away') || document.body.classList.contains('game-only')) return false;
    var p = pref();
    if (p === 'stacked' || p === 'portrait' || p === 'tablet') return true;
    return p === 'auto' && (isIPad() || touchTablet());
  }
  // The game picture's shape (the emulator's Aspect ratio setting)
  function picAspect() {
    try { var a = JSON.parse(localStorage.getItem('s9x-player-settings') || '{}').aspect; if (a === '4:3') return 4 / 3; } catch (e) {}
    return 8 / 7;
  }
  // Tablet, sideways, on a screen wider than an iPad's 4:3: the wide arrangement
  // (iPads keep their own iPad layout on Auto)
  function wide(W, H) {
    var p = pref();
    if (p === 'stacked' || p === 'portrait' || (p === 'auto' && isIPad())) return false;
    return W / H >= 1.45;
  }
  var DG_BAR = 30;   // Mudora's World / HC / EP … bar over the maps
  function frame() { return $('emo-frame'); }
  function post(msg) { var f = frame(); try { if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*'); } catch (e) {} }

  function place() {
    var on = want();
    document.body.classList.toggle('mud-stack', on);
    var gw = $('game-wrap'), main = document.querySelector('main');
    if (!on) {
      if (active) {
        active = false; last = '';
        ['left', 'top', 'width', 'height'].forEach(function (k) { gw.style[k] = ''; });
        post({ type: 'mudora-stack', on: false });
        window.dispatchEvent(new Event('resize'));
      }
      return;
    }
    active = true;
    var W = main.clientWidth, H = main.clientHeight;
    if (!W || !H) return;
    if (wide(W, H)) {
      var aspect = picAspect();
      var ew = Math.floor(Math.min((H - DG_BAR - MAP_GAP) / 2, W * 0.32));   // each map: half the height under the bar
      var rest = W - ew - 1;
      var sideW = Math.round(Math.max(200, Math.min(270, rest * 0.25)));
      var gw2 = rest - sideW, gh2 = Math.round(gw2 / aspect);
      var STRIP = 56;                     // at least room for the counters under the game
      if (gh2 > H - STRIP) { gh2 = H - STRIP; gw2 = Math.round(gh2 * aspect); sideW = rest - gw2; }
      var isz2 = Math.max(22, Math.min(46, Math.floor((sideW - 12 - 5 * 4) / 6)));
      gw.style.left = '0px'; gw.style.top = '0px'; gw.style.width = gw2 + 'px'; gw.style.height = gh2 + 'px';
      post({ type: 'mudora-stack', on: true, wide: true, hole: { w: gw2, h: gh2 }, each: ew, sideW: sideW, side: true, gap: MAP_GAP, isz: isz2,
        strip: { x: 0, y: gh2, w: gw2, h: H - gh2 } });
      var sig2 = ['w', W, H, gw2, gh2, ew, sideW, isz2].join();
      if (sig2 !== last) { last = sig2; window.dispatchEvent(new Event('resize')); }
      return;
    }
    // Under the game, as in Hutch's iPad layout: the items in two long rows
    // (17 across) and the 13 dungeons as a row of small cards
    var side = W > H, each, colW, gameW, gameH, isz, band;
    if (side) {
      each = Math.floor(Math.min((H - MAP_GAP) / 2, W * 0.42));
      colW = W - each - MAP_GAP;
    } else {
      each = Math.floor(Math.min((W - MAP_GAP) / 2, H * 0.4));
      colW = W;
    }
    isz = Math.max(22, Math.min(40, Math.floor((colW - 16 - 16 * 3) / 17)));
    band = 2 * isz + 3 + 14 + 112;   // two item rows, gaps, the dungeon cards (Mudora shrinks the items if they still don't fit)
    gameW = colW;
    gameH = Math.round(Math.min(colW * 7 / 8, (side ? H : H - each - MAP_GAP) - band));
    gameH = Math.max(140, gameH);
    // The picture keeps its shape, so a box wider than it leaves black bars:
    // give the game just its width and the counters the room beside it
    var strip = null, picW = Math.round(gameH * picAspect());
    if (gameW - picW >= 90) {
      strip = { x: picW, y: 0, w: gameW - picW, h: gameH };
      gameW = picW;
      isz = Math.max(22, Math.min(46, Math.floor((colW - 16 - 16 * 3) / 17)));   // the items get the whole width back
    }
    var sig = [W, H, gameW, gameH, each, side, isz, !!strip].join();
    gw.style.left = '0px'; gw.style.top = '0px'; gw.style.width = gameW + 'px'; gw.style.height = gameH + 'px';
    post({ type: 'mudora-stack', on: true, hole: { w: gameW, h: gameH }, each: each, side: side, gap: MAP_GAP, isz: isz, strip: strip });
    if (sig !== last) { last = sig; window.dispatchEvent(new Event('resize')); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = frame();
    if (f) f.addEventListener('load', function () { last = ''; setTimeout(place, 50); setTimeout(place, 600); });
    var main = document.querySelector('main');
    if (window.ResizeObserver && main) new ResizeObserver(function () { place(); }).observe(main);
    place();
  });
  window.addEventListener('trackermode', function () { setTimeout(place, 50); });
  window.addEventListener('orientationchange', function () { setTimeout(place, 300); });
  window.addEventListener('resize', function (e) { if (e && e.isTrusted === false) return; place(); });
  // a layout picked in the header (tablet.js saves it), a tracker frame that re-asks
  setInterval(place, 1000);
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'mudora-stack-ask') { last = ''; place(); } });
  window.UnifiedMudoraStack = { active: function () { return active; }, place: place, isIPad: isIPad };
})();
