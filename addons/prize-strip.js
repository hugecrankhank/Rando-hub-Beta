/*
 * Rando Hub — the Prizes strip (addon for Hutch's item tracker, tablet view).
 *
 * A row of the ten dungeons' crystals and pendants on their own (no keys,
 * chests or bosses), for the Desktop layout's "Prizes" pop-out window
 * (desktop.js, piece 'prizes'; HydeOut, Oct 2026). The real prize images
 * stay in their dungeon boxes; these mirror them and hand clicks on, so both
 * always agree. Hidden here (#mob-prizes display:none); the pop-out shows it.
 *
 * tracker/ is replaced from Hutch's repository on every deploy; this file is
 * added to itemtracker.html by tools/update-hutch.py and waits for his
 * tablet layout (js/mobile.js) to have built the dungeon row.
 */
(function () {
  'use strict';
  if (!/[?&]mobile=1/.test(location.search) && !window._mobileLayout) return;
  var css = document.createElement('style');
  css.textContent =
    '#mob-prizes { display:none; flex-direction:row; align-items:flex-end; justify-content:center; gap:6px; padding:4px 6px; }' +
    '#mob-prizes .mob-prize { display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer; user-select:none; }' +
    '#mob-prizes .mob-prize-img { width:44px; height:44px; image-rendering:pixelated; image-rendering:crisp-edges; opacity:.55; filter:saturate(.6); transition:opacity .25s, filter .25s, transform .25s; }' +
    '#mob-prizes .mob-prize.got .mob-prize-img { opacity:1; filter:none; transform:scale(1.06); }' +
    '#mob-prizes .mob-prize-label { font-size:11px; font-weight:bold; color:#fff; line-height:12px; }';
  document.head.appendChild(css);

  function build() {
    var bot = document.getElementById('mob-bot'), dgrp = bot && bot.querySelector('.mob-dungeons');
    if (!dgrp || !dgrp.querySelector('.dungeon-slot .prize-img')) return false;
    if (document.getElementById('mob-prizes')) return true;
    var pz = document.createElement('div'); pz.id = 'mob-prizes';
    var realSlot = function (k) { return dgrp.querySelector('.dungeon-slot[data-dungeon-key="' + k + '"]'); };
    var realPrize = function (k) { var sl = realSlot(k); return sl && sl.querySelector('.prize-img'); };
    ['ep', 'dp', 'toh', 'pod', 'sp', 'sw', 'tt', 'ip', 'mm', 'tr'].forEach(function (k) {
      var sl = realSlot(k);
      if (!sl || !sl.querySelector('.prize-img')) return;
      var t = document.createElement('div'); t.className = 'mob-prize'; t.dataset.dungeonKey = k;
      var img = document.createElement('img'); img.className = 'mob-prize-img'; img.alt = '';
      var lab = document.createElement('div'); lab.className = 'mob-prize-label';
      var l = sl.querySelector('.dungeon-label'); lab.textContent = l ? l.textContent : k.toUpperCase();
      t.appendChild(img); t.appendChild(lab); pz.appendChild(t);
      t.title = 'Click: next prize. Right-click: got it / not yet';
      t.addEventListener('click', function () { var s2 = realSlot(k); if (s2) s2.click(); });
      t.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var pi = realPrize(k);
        if (pi) pi.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });
    });
    function sync() {
      Array.prototype.forEach.call(pz.children, function (t) {
        var pi = realPrize(t.dataset.dungeonKey), img = t.firstChild;
        if (!pi) return;
        var src = pi.getAttribute('src') || '';
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        t.classList.toggle('got', /1\.png$/.test(src));
      });
    }
    sync();
    new MutationObserver(sync).observe(dgrp, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    bot.parentNode.insertBefore(pz, bot.nextSibling);
    return true;
  }
  var tries = 0;
  (function wait() { if (build() || ++tries > 200) return; setTimeout(wait, 100); })();
})();
