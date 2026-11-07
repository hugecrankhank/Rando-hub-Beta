/*
 * combo-toast.js — the combo pages' (Rando Cross, Z1Z3, M1SM) note for an item crossing between
 * the games ("That's Zelda 1's Raft…", "Link received…"): over the top of the game picture, where
 * A Link to the Past shows its rupees, bombs and arrows (the middle of the HUD), small enough to
 * leave the play field clear, and up for 9 seconds. A note that comes while one is up joins it
 * (the newest two lines), and the time starts again.
 *
 *   RHItemToast(text, ms)
 */
(function () {
  'use strict';
  const MS = 9000;
  let el = null, timer = null, lines = [];

  function aspect() {
    try { const c = JSON.parse(localStorage.getItem('s9x-player-settings') || '{}'); if (c.aspect === '4:3') return 4 / 3; } catch (e) {}
    return 8 / 7;
  }
  // where the picture is on the screen: the game box (or the NES frame over it), the picture
  // centred in it at the game's shape
  function picture() {
    const nes = document.body.classList.contains('on-nes') && document.getElementById('nes-frame');
    const box = (nes && !nes.hidden ? nes : null) || document.getElementById('game') || document.getElementById('game-wrap');
    if (!box) return null;
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const a = aspect();
    let w = r.width, h = r.height;
    if (w / h > a) w = h * a; else h = w / a;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }
  function place() {
    if (!el) return;
    const p = picture();
    if (!p) { el.style.cssText = ''; el.classList.add('rh-itoast-plain'); return; }
    el.classList.remove('rh-itoast-plain');
    // ALttP's rupees, bombs and arrows: about 25% to 60% across, 6% to 17% down (icons and counts)
    const w = Math.max(170, p.width * 0.40), left = Math.min(Math.max(4, p.left + p.width * 0.23), window.innerWidth - w - 4);
    el.style.left = left + 'px'; el.style.width = w + 'px';
    el.style.top = Math.max(2, p.top + p.height * 0.06) + 'px';
    el.style.minHeight = (p.height * 0.11) + 'px';
    el.style.fontSize = Math.max(10, Math.min(15, p.width * 0.021)) + 'px';
  }
  function css() {
    if (document.getElementById('rh-itoast-css')) return;
    const s = document.createElement('style'); s.id = 'rh-itoast-css';
    s.textContent = '.rh-itoast { position: fixed; z-index: 60; box-sizing: border-box; pointer-events: none;' +
      ' background: rgba(10,12,16,.9); border: 2px solid var(--gold, #e0b040); border-radius: 4px; padding: 5px 8px;' +
      ' font-family: var(--px, ui-monospace, monospace); line-height: 1.2; color: #fff; text-align: center;' +
      ' box-shadow: 0 2px 10px rgba(0,0,0,.5); display: flex; flex-direction: column; justify-content: center; animation: rh-itoast-in .2s ease-out; }' +
      '.rh-itoast div + div { margin-top: 3px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,.15); }' +
      '.rh-itoast.rh-itoast-plain { left: 50%; top: calc(8px + env(safe-area-inset-top)); transform: translateX(-50%); width: min(90vw, 420px); font-size: 14px; }' +
      '@keyframes rh-itoast-in { from { transform: translateY(-6px); } to { transform: none; } }' +
      '@media (prefers-reduced-motion: reduce) { .rh-itoast { animation: none; } }';
    document.head.appendChild(s);
  }
  function show(text, ms) {
    css();
    if (!el) { el = document.createElement('div'); el.className = 'rh-itoast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
    lines.push(String(text)); lines = lines.slice(-2);
    el.innerHTML = ''; lines.forEach((t) => { const d = document.createElement('div'); d.textContent = t; el.append(d); });
    place();
    clearTimeout(timer);
    timer = setTimeout(() => { if (el) el.remove(); el = null; lines = []; }, Math.max(MS, ms || 0));
  }
  window.addEventListener('resize', place);
  window.RHItemToast = show;
})();
