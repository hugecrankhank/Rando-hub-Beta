/*
 * map.js — the Metroid world map, one area at a time: every room square of
 * the area (data.js MAP_CELLS, from the game's own 32 x 32 map), a pin on
 * every item spot, the elevators, and Samus on it, zoomable.
 *
 *   M1Map.init(el, { onToggle(i) })
 *   M1Map.update({ have, items, liveHave, reach })    reach[i]: 'ok' | 'no' | null
 *   M1Map.setSamus(live)       where Samus is (area, mapX, mapY, sx, sy), or null
 *
 * A square is 16 map units; a pin sits where the item is in its screen
 * (its position byte, 16-px tiles of 256 x 240), Samus where she is on hers.
 */
(function () {
  'use strict';
  // the re-center button (as Zelda 3's map): one style for every map
  function resetCss() { if (document.getElementById('rh-map-reset-css')) return; const s = document.createElement('style'); s.id = 'rh-map-reset-css'; s.textContent = '.rh-map-reset{position:absolute;top:6px;right:6px;z-index:3;width:32px;height:32px;padding:0;border-radius:8px;border:1px solid #3a4556;background:rgba(12,16,26,.85);color:#e6edf3;font-size:18px;line-height:1;cursor:pointer}.rh-map-reset:hover{background:rgba(34,44,62,.95)}'; document.head.appendChild(s); }
  const D = window.M1;
  const C = 16, W = 32 * C, H = 32 * C;
  const AREA_FILL = ['#2a4a8a', '#8a3a2a', '#3a6a3a', '#6a3a7a', '#5a5a5a'], AREA_LINE = ['#6c94d8', '#e08a6a', '#78c078', '#c080d0', '#a0a0a0'];
  let host, stage, cv, ctx, tabs, label, fitBtn, followBtn;
  let area = 0, follow = true, zoom = 3, tx = 0, ty = 0, moved = false, sel = -1;
  let st = { have: [], items: null, liveHave: () => false, reach: null }, samus = null, onToggle = null, lastLive = null;
  let dirty = false, lastArea = -1;
  const cellsOf = D.MAP_CELLS.map((l) => new Set(l));

  function box(a) {
    let x0 = 32, y0 = 32, x1 = 0, y1 = 0;
    D.MAP_CELLS[a].forEach((c) => { const x = c >> 5, y = c & 31; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); });
    return [x0 * C, y0 * C, x1 * C, y1 * C];
  }
  function pinXY(i) { const s = D.SPOTS[i]; return [s[1] * C + ((s[3] & 15) + 0.5) * (C / 16), s[2] * C + ((s[3] >> 4) + 0.5) * (C / 15)]; }
  function pinsIn(a) { const out = []; D.SPOTS.forEach((s, i) => { if (s[0] === a) out.push(i); }); return out; }

  // ── view ─────────────────────────────────────────────────────────────────
  function size() { const r = stage.getBoundingClientRect(); return [Math.max(50, r.width), Math.max(50, r.height)]; }
  function fit() {
    const [cw, ch] = size();
    const [x0, y0, x1, y1] = box(area);
    const pad = 10, rw = x1 - x0 + pad * 2, rh = y1 - y0 + pad * 2;
    zoom = Math.max(0.5, Math.min(14, Math.min(cw / rw, ch / rh)));
    tx = (cw - (x1 - x0) * zoom) / 2 - x0 * zoom; ty = (ch - (y1 - y0) * zoom) / 2 - y0 * zoom;
    moved = false; redraw();
  }
  function zoomAt(sx, sy, k) {
    const z = Math.max(0.5, Math.min(24, zoom * k)); k = z / zoom;
    tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; zoom = z; moved = true; redraw();
  }
  function setArea(a, user) {
    if (a === area && lastArea === a) return;
    area = a; lastArea = a; sel = -1;
    tabs.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-selected', +b.dataset.area === a ? 'true' : 'false'));
    if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); }
    fit();
  }
  function redraw() { if (dirty) return; dirty = true; requestAnimationFrame(draw); }
  function draw() {
    dirty = false;
    if (!host || !host.isConnected || host.offsetParent === null) return;
    const [cw, ch] = size(), dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); if (!moved) { dirty = false; fit(); return; } }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    // the rooms
    const g = Math.max(0.5, zoom * 0.08);
    ctx.fillStyle = AREA_FILL[area];
    D.MAP_CELLS[area].forEach((c) => { const x = c >> 5, y = c & 31; ctx.fillRect(tx + x * C * zoom + g, ty + y * C * zoom + g, C * zoom - g * 2, C * zoom - g * 2); });
    ctx.strokeStyle = AREA_LINE[area]; ctx.lineWidth = Math.max(1, zoom * 0.1); ctx.globalAlpha = 0.6;
    D.MAP_CELLS[area].forEach((c) => { const x = c >> 5, y = c & 31; ctx.strokeRect(tx + x * C * zoom + g, ty + y * C * zoom + g, C * zoom - g * 2, C * zoom - g * 2); });
    ctx.globalAlpha = 1;
    // the start and the elevators
    if (area === 0) { ctx.fillStyle = '#ffffff'; ctx.font = Math.max(8, 7 * zoom) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S', tx + (D.START[0] + 0.5) * C * zoom, ty + (D.START[1] + 0.5) * C * zoom); }
    D.ELEVATORS.forEach((e) => {
      const ends = [[e[0], e[1], e[2], e[3]], [e[3], e[1], e[2] + 2, e[0]]];   // the arriving square is two below the leaving one
      ends.forEach((q) => { if (q[0] !== area) return;
        const x = tx + (q[1] + 0.5) * C * zoom, y = ty + (q[2] + 0.5) * C * zoom, r = Math.max(3, C * zoom * 0.3);
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
        ctx.fillStyle = AREA_FILL[q[3]]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = AREA_LINE[q[3]]; ctx.stroke();
      });
    });
    const css = getComputedStyle(document.documentElement), gold = css.getPropertyValue('--gold').trim() || '#ffd166', green = css.getPropertyValue('--green').trim() || '#3fb950';
    const pins = pinsIn(area), R = Math.max(3.5, Math.min(7, 2 + zoom * 1.2));
    pins.forEach((i) => {
      const [px, py] = pinXY(i), x = tx + px * zoom, y = ty + py * zoom, have = !!st.have[i];
      const r = !have && st.reach ? st.reach[i] : null;
      const line = r === 'ok' ? green : r === 'no' ? '#e5534b' : have ? green : gold;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = have ? 'rgba(63,185,80,.4)' : r === 'ok' ? 'rgba(63,185,80,.8)' : r === 'no' ? 'rgba(229,83,75,.65)' : 'rgba(10,14,22,.9)'; ctx.fill();
      ctx.lineWidth = i === sel ? 3 : 2; ctx.strokeStyle = line; ctx.globalAlpha = have ? 0.6 : 1; ctx.stroke(); ctx.globalAlpha = 1;
      if (have) { ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 1, y + 2.5); ctx.lineTo(x + 3.5, y - 3); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    });
    if (samus && samus.area === area) {
      const x = tx + samus.x * zoom, y = ty + samus.y * zoom;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,120,60,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ff7a3c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    if (sel >= 0 && pins.indexOf(sel) >= 0) {
      const [px, py] = pinXY(sel), x = tx + px * zoom, y = ty + py * zoom;
      label.hidden = false;
      const rs = !st.have[sel] && st.reach ? st.reach[sel] : null;
      label.querySelector('.n').textContent = D.SPOTS[sel][6] + (st.items && st.items[sel] ? ' · ' + st.items[sel] : '') + (rs === 'ok' ? ' · in reach' : rs === 'no' ? ' · not yet' : '');
      const b = label.querySelector('button'); b.hidden = st.liveHave(sel); b.textContent = st.have[sel] ? 'Unmark' : 'Mark as taken';
      const lw = label.offsetWidth, lh = label.offsetHeight;
      label.style.left = Math.max(4, Math.min(cw - lw - 4, x - lw / 2)) + 'px';
      label.style.top = (y - lh - 14 > 4 ? y - lh - 14 : y + 14) + 'px';
    } else label.hidden = true;
  }

  // ── pointer: drag to pan, pinch and wheel to zoom, tap a pin ─────────────
  const ptrs = new Map(); let drag = null, pinch = null, lastTap = 0;
  function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function down(e) {
    if (e.button > 0) return;
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, tx, ty, far: false };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
  }
  function move(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pinch.d > 0) zoomAt(mx, my, d / pinch.d);
      tx += mx - pinch.mx; ty += my - pinch.my; pinch = { d, mx, my }; moved = true; redraw();
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.far = true;
      if (drag.far) { tx = drag.tx + dx; ty = drag.ty + dy; moved = true; redraw(); }
    }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.far && ptrs.size === 0) {
      const now = Date.now();
      if (now - lastTap < 300) { zoomAt(x, y, 2); lastTap = 0; }
      else { lastTap = now; tap(x, y); }
    }
    if (ptrs.size === 0) drag = null;
  }
  function tap(x, y) {
    let best = -1, bd = 18;
    pinsIn(area).forEach((i) => { const [px, py] = pinXY(i), d = Math.hypot(tx + px * zoom - x, ty + py * zoom - y); if (d < bd) { bd = d; best = i; } });
    sel = best === sel ? -1 : best; redraw();
  }

  // ── Samus ────────────────────────────────────────────────────────────────
  function setSamus(live) {
    lastLive = live;
    let s = null;
    if (live && live.started && live.area !== undefined && live.mapX < 32 && live.mapY < 32) s = { area: live.area, x: live.mapX * C + (live.sx / 256) * C, y: live.mapY * C + (Math.min(live.sy, 240) / 240) * C };
    const was = samus; samus = s;
    if (!s) { if (was) redraw(); return; }
    if (follow && s.area !== area) setArea(s.area, false);
    else if (follow && !moved) {
      const [cw, ch] = size(), x = tx + s.x * zoom, y = ty + s.y * zoom;
      if (x < 20 || y < 20 || x > cw - 20 || y > ch - 20) { tx = cw / 2 - s.x * zoom; ty = ch / 2 - s.y * zoom; }
    }
    if (!was || was.area !== s.area || Math.abs(was.x - s.x) > .2 || Math.abs(was.y - s.y) > .2) redraw();
  }

  const M1Map = {
    init(el, opts) {
      host = el; onToggle = opts && opts.onToggle;
      try { follow = localStorage.getItem('m1r:map-follow') !== 'off'; } catch (e) {}
      host.innerHTML = '<div class="m-tabs" role="tablist">' + D.AREAS.map((n, i) => '<button type="button" role="tab" data-area="' + i + '">' + n + '<small></small></button>').join('') +
        '<span class="m-sp"></span><button type="button" class="m-follow" aria-pressed="' + follow + '" title="Switch to the area Samus is in and keep her in view">⌖ Follow</button></div>' +
        '<div class="m-stage"><canvas class="m-canvas"></canvas><button type="button" class="rh-map-reset" title="Re-center and fit the map" aria-label="Re-center and fit the map">\u27F2</button><div class="m-label" hidden><span class="n"></span><button type="button"></button></div></div>';
      tabs = host.querySelector('.m-tabs'); stage = host.querySelector('.m-stage'); cv = host.querySelector('canvas'); ctx = cv.getContext('2d'); label = host.querySelector('.m-label');
      resetCss(); fitBtn = host.querySelector('.rh-map-reset'); followBtn = host.querySelector('.m-follow');
      tabs.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => setArea(+b.dataset.area, true)));
      fitBtn.addEventListener('click', fit);
      followBtn.addEventListener('click', () => { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); try { localStorage.setItem('m1r:map-follow', follow ? 'on' : 'off'); } catch (e) {} if (follow && lastLive) { moved = false; setSamus(lastLive); } });
      label.querySelector('button').addEventListener('click', () => { if (sel >= 0 && onToggle) onToggle(sel); });
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
      if (window.ResizeObserver) new ResizeObserver(() => redraw()).observe(host);
      setArea(0, false); lastArea = 0;
    },
    update(s) {
      st = Object.assign(st, s);
      tabs.querySelectorAll('[data-area]').forEach((b) => { const idx = pinsIn(+b.dataset.area), n = idx.filter((i) => st.have[i]).length; b.querySelector('small').textContent = idx.length ? n + '/' + idx.length : ''; b.classList.toggle('done', idx.length > 0 && n === idx.length); });
      redraw();
    },
    setSamus,
    redraw,
    get area() { return area; },
  };
  window.M1Map = M1Map;
})();
