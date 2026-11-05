/*
 * title.js — the two worlds' pictures, drawn by the hub over the player:
 *
 *   the combined title: while Zelda's title screen shows, both games' logos
 *   together (Zelda's from its own title frame, Metroid's from its: nothing
 *   shipped, both come from your ROMs) with "LINKED" between them;
 *   the portal transition: the frame of the world being left and the first
 *   frame of the one entered, side by side, a line saying where you're going,
 *   and a fade (about a second), which also covers the swap.
 *
 *   ZMTitle.init(wrap)          the game box (#game-wrap)
 *   ZMTitle.grab(core)          → canvas of the core's current frame
 *   ZMTitle.transition(from, grabTo, name)   from: a canvas; grabTo(): the entered world's frame; name: 'Zebes' | 'Hyrule'
 *   ZMTitle.metroidLogo(core)   runs a fresh Metroid core to its title and keeps its logo
 */
(function () {
  'use strict';
  const Z = window.ZM;
  let wrap = null, card = null, overlay = null, logo = { z1: null, m1: null }, shown = false;

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
  function crop(cv, x, y, w, h) { const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h); return o; }

  // Metroid's title screen: a fresh core run 300 frames (its logo is on screen by then)
  function metroidLogo(core) {
    if (logo.m1) return logo.m1;
    try { for (let i = 0; i < 300; i++) core.runFrame(0, 0); const c = crop(grab(core), 16, 64, 224, 80); if (colourful(c)) logo.m1 = c; } catch (e) { console.warn('[zm title]', e); }   // the core stays at its title: that's where Samus's story starts
    return logo.m1;
  }
  // Zelda's logo: the top of its title frame, taken while the title shows
  function colourful(cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 64) seen.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]); return seen.size >= 4; }
  function zeldaLogo(core) {
    if (logo.z1) return logo.z1;
    try { const c = crop(grab(core), 16, 24, 224, 88); if (colourful(c)) logo.z1 = c; } catch (e) {}
    return logo.z1;
  }

  function css() {
    const s = document.createElement('style');
    s.textContent = '.zm-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#000;color:#fff;font:400 14px/1.3 "Press Start 2P",monospace;text-align:center;z-index:5;pointer-events:none;transition:opacity .4s}' +
      '.zm-card canvas{width:70%;max-width:560px;height:auto;image-rendering:pixelated}.zm-card .linked{color:#f0c040;letter-spacing:2px;font-size:clamp(12px,2.6vw,22px);margin:4px 0}.zm-card .hint{color:#98a8b0;font-size:clamp(9px,1.6vw,13px);margin-top:10px}' +
      '.zm-trans{position:absolute;inset:0;z-index:6;background:#000;display:grid;grid-template-columns:1fr 1fr;align-items:center;pointer-events:none;opacity:1;transition:opacity .35s}.zm-trans canvas{width:100%;height:auto;image-rendering:pixelated;display:block}' +
      '.zm-trans .mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:#f0c040;font:400 clamp(12px,2.4vw,20px)/1.4 "Press Start 2P",monospace;text-shadow:0 2px 6px #000}.zm-trans .mid small{display:block;color:#fff;font-size:.6em;margin-top:8px}' +
      '.zm-trans .from{filter:brightness(.55)}.zm-trans.go .from{opacity:0;transition:opacity .6s}';
    document.head.appendChild(s);
  }

  function init(el) { wrap = el; css(); }
  // the combined title: show it while Zelda's title screen is up
  function title(on, cores) {
    if (!wrap) return;
    if (!on) { if (card) { card.style.opacity = '0'; setTimeout(() => { if (card && card.style.opacity === '0') { card.remove(); card = null; } }, 400); } shown = false; return; }
    if (shown) return;
    const z = cores.z1 && zeldaLogo(cores.z1), m = cores.m1 && metroidLogo(cores.m1);
    if (!z || !m) return;
    card = document.createElement('div'); card.className = 'zm-card';
    card.appendChild(z);
    const l = document.createElement('div'); l.className = 'linked'; l.textContent = '+ LINKED +'; card.appendChild(l);
    card.appendChild(m);
    const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'ZELDA 1 + METROID · RANDO HUB · PUSH START'; card.appendChild(h);
    wrap.appendChild(card); shown = true;
  }
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
  window.ZMTitle = { init, grab, title, transition, metroidLogo };
})();
