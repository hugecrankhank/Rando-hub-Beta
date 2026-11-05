/*
 * title.js — the portal transition, drawn by the hub over the player: the
 * frame of the world being left and the first frame of the one entered, side
 * by side, a line saying where you're going, and a fade (about a second),
 * which also covers the swap. (The combined title screen itself is baked into
 * both ROMs: js/title-rom.js.)
 *
 *   ZMTitle.init(wrap)                        the game box (#game-wrap)
 *   ZMTitle.grab(core)                        → canvas of the core's current frame
 *   ZMTitle.transition(from, grabTo, name)    from: a canvas; grabTo(): the entered world's frame; name: 'Zebes' | 'Hyrule'
 */
(function () {
  'use strict';
  let wrap = null, overlay = null;

  function grab(core) {
    const f = core.frame(), cv = document.createElement('canvas');
    cv.width = f.w; cv.height = f.h;
    const img = cv.getContext('2d').createImageData(f.w, f.h), d = img.data;
    for (let i = 0; i < f.w * f.h; i++) {
      const v = f.data[i];
      d[i * 4] = (v >> 11 & 31) * 255 / 31; d[i * 4 + 1] = (v >> 5 & 63) * 255 / 63; d[i * 4 + 2] = (v & 31) * 255 / 31; d[i * 4 + 3] = 255;
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    return cv;
  }

  function css() {
    const s = document.createElement('style');
    s.textContent = '.zm-trans{position:absolute;inset:0;z-index:6;background:#000;display:grid;grid-template-columns:1fr 1fr;align-items:center;pointer-events:none;opacity:1;transition:opacity .35s}.zm-trans canvas{width:100%;height:auto;image-rendering:pixelated;display:block}.zm-trans .to{min-height:1px}' +
      '.zm-trans .mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:#f0c040;font:400 clamp(12px,2.4vw,20px)/1.4 "Press Start 2P",monospace;text-shadow:0 2px 6px #000}.zm-trans .mid small{display:block;color:#fff;font-size:.6em;margin-top:8px}' +
      '.zm-trans .from{filter:brightness(.55)}.zm-trans.go .from{opacity:0;transition:opacity .6s}';
    document.head.appendChild(s);
  }

  function init(el) { wrap = el; css(); }
  // the portal: both frames, a line, a fade; resolves when it's over
  function transition(from, grabTo, name) {
    if (!wrap) return Promise.resolve();
    if (overlay) overlay.remove();
    overlay = document.createElement('div'); overlay.className = 'zm-trans';
    from.className = 'from';
    const toBox = document.createElement('div'); toBox.className = 'to';
    overlay.appendChild(from); overlay.appendChild(toBox);
    setTimeout(() => { try { const to = grabTo(); if (to) toBox.appendChild(to); } catch (e) {} }, 400);   // the entered world, once it has drawn a frame
    const mid = document.createElement('div'); mid.className = 'mid'; mid.innerHTML = (name === 'Zebes' ? 'TO ZEBES' : 'TO HYRULE') + '<small>' + (name === 'Zebes' ? 'Link steps through the portal' : 'Samus steps through the portal') + '</small>';
    overlay.appendChild(mid);
    wrap.appendChild(overlay);
    const o = overlay;
    return new Promise((res) => {
      setTimeout(() => o.classList.add('go'), 350);
      setTimeout(() => { o.style.opacity = '0'; }, 1100);
      setTimeout(() => { o.remove(); if (overlay === o) overlay = null; res(); }, 1500);
    });
  }
  window.ZMTitle = { init, grab, transition };
})();
