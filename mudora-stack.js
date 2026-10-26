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
  function want() {
    var T = window.UnifiedTracker;
    if (!T || !T.mudoraUi || !T.mudoraUi() || T.off()) return false;
    if (window.UnifiedPhone && window.UnifiedPhone.wanted && window.UnifiedPhone.wanted()) return false;
    if (document.body.classList.contains('emo-away') || document.body.classList.contains('game-only')) return false;
    var p = pref();
    if (p === 'stacked' || p === 'portrait') return true;
    return p === 'auto' && isIPad();
  }
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
    var sig = [W, H, gameW, gameH, each, side, isz].join();
    gw.style.left = '0px'; gw.style.top = '0px'; gw.style.width = gameW + 'px'; gw.style.height = gameH + 'px';
    post({ type: 'mudora-stack', on: true, hole: { w: gameW, h: gameH }, each: each, side: side, gap: MAP_GAP, isz: isz });
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
