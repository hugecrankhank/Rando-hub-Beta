/*
 * map.js — the Super Metroid map: the game's own area maps with a pin on every
 * item spot, Samus on it, zoomable.
 *
 *   SMRMap.init(el, { onToggle(i) })
 *   SMRMap.rom = () => Uint8Array | null       the ROM the picture is drawn from
 *   SMRMap.update({ have, shown, names, items, liveHave })
 *   SMRMap.setSamus(live)                     where Samus is (room, x, y), or null
 *
 * The picture is the pause-screen map, drawn here from the ROM the way the game
 * draws it: each area is a 64x32 grid of 8x8 tiles (bank $B5, one tile per room
 * screen; $B5:8000 is Brinstar, $B5:9000 Crateria, then Norfair, Wrecked Ship,
 * Maridia, Tourian), the tiles 4bpp in bank $B6. Nothing of it is shipped: it's
 * read from the player's ROM when the page runs. The pins come from data.js
 * (MAP_PINS, worked out from the room headers by tools/sm-map-pins.py), and
 * Samus's dot from the room she's in ($7E:079B, its header's map position) and
 * her position in it ($7E:0AF6 / $7E:0AFA; a room screen is 256 px, a map tile 8).
 */
(function () {
  'use strict';
  const D = window.SMR;
  const SLOT = [1, 0, 2, 3, 4, 5];              // area -> tilemap in bank $B5
  const TILEMAP = 0x1A8000, GFX = 0x1B0000;     // $B5:8000, $B6:8000 (LoROM)
  const W = 512, H = 256, BLANK = 0x1F;
  const COLORS = [[0, 0, 0, 0], [0x1d, 0x2b, 0x45, 255], [0xa9, 0xbd, 0xdf, 255], [0xff, 0xd1, 0x66, 255]];
  let host, stage, cv, ctx, tabs, label, fitBtn, followBtn;
  let area = 0, follow = true, zoom = 3, tx = 0, ty = 0, moved = false, sel = -1;
  let pics = { rom: null }, base = null, baseAsked = 0;
  let st = { have: [], shown: [], names: [], items: null, liveHave: () => false }, samus = null, onToggle = null;
  let dirty = false, lastArea = -1;

  // ── the ROM and the picture ──────────────────────────────────────────────
  function rom() {
    let r = null;
    try { r = SMRMap.rom && SMRMap.rom(); } catch (e) {}
    if (r && r.length >= 0x300000) return r;
    if (base) return base;
    if (window.SMRStore && Date.now() - baseAsked > 5000) {   // the base ROM kept for rolling seeds
      baseAsked = Date.now();
      SMRStore.get('base').then((b) => { if (b && b.bytes && b.bytes.byteLength >= 0x300000) { base = new Uint8Array(b.bytes); redraw(); } });
    }
    return null;
  }
  function picture(a) {
    const r = rom(); if (!r) return null;
    if (pics.rom !== r) pics = { rom: r };
    if (pics[a]) return pics[a];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), id = g.createImageData(W, H), px = id.data, tm = TILEMAP + SLOT[a] * 0x1000;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < 0x800; i++) {
      const e = r[tm + i * 2] | r[tm + i * 2 + 1] << 8, t = e & 0x3FF;
      if (t === BLANK) continue;
      const scr = i >> 10, tX = ((scr << 5) + (i & 31)) * 8, tY = ((i & 1023) >> 5) * 8, hf = e & 0x4000, vf = e & 0x8000, o = GFX + t * 32;
      if (tX < x0) x0 = tX; if (tY < y0) y0 = tY; if (tX + 8 > x1) x1 = tX + 8; if (tY + 8 > y1) y1 = tY + 8;
      for (let y = 0; y < 8; y++) {
        const b0 = r[o + y * 2], b1 = r[o + y * 2 + 1], b2 = r[o + 16 + y * 2], b3 = r[o + 17 + y * 2];
        for (let x = 0; x < 8; x++) {
          const s = 7 - x, v = ((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3;
          if (!v) continue;
          const col = COLORS[v] || COLORS[2], p = ((tY + (vf ? 7 - y : y)) * W + tX + (hf ? 7 - x : x)) * 4;
          px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = col[3];
        }
      }
    }
    g.putImageData(id, 0, 0);
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
    return (pics[a] = { cv: c, box: [x0, y0, x1, y1] });
  }

  // ── view ─────────────────────────────────────────────────────────────────
  function size() { const r = stage.getBoundingClientRect(); return [Math.max(50, r.width), Math.max(50, r.height)]; }
  function fit() {
    const p = picture(area), [cw, ch] = size();
    let [x0, y0, x1, y1] = p ? p.box : [0, 0, W, H];
    pinsIn(area).forEach((i) => { const q = D.MAP_PINS[i]; x0 = Math.min(x0, q[1] - 6); y0 = Math.min(y0, q[2] - 6); x1 = Math.max(x1, q[1] + 6); y1 = Math.max(y1, q[2] + 6); });
    const pad = 14, rw = x1 - x0 + pad * 2, rh = y1 - y0 + pad * 2;
    zoom = Math.max(0.5, Math.min(14, Math.min(cw / rw, ch / rh)));
    tx = (cw - (x1 - x0) * zoom) / 2 - x0 * zoom; ty = (ch - (y1 - y0) * zoom) / 2 - y0 * zoom;
    moved = false; redraw();
  }
  function zoomAt(sx, sy, k) {
    const z = Math.max(0.5, Math.min(24, zoom * k)); k = z / zoom;
    tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; zoom = z; moved = true; redraw();
  }
  function pinsIn(a) { const out = []; D.MAP_PINS.forEach((q, i) => { if (q[0] === a && st.shown[i] !== false) out.push(i); }); return out; }
  function setArea(a, user) {
    if (a === area && lastArea === a) return;
    area = a; lastArea = a; sel = -1;
    tabs.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-selected', +b.dataset.area === a ? 'true' : 'false'));
    if (user) follow = false, followBtn.setAttribute('aria-pressed', 'false');
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
    const p = picture(area);
    if (p) { ctx.imageSmoothingEnabled = false; ctx.drawImage(p.cv, tx, ty, W * zoom, H * zoom); }
    else { ctx.fillStyle = '#8a97b0'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('The map is drawn from your ROM: play a seed, or pick your ROM in New seed.', cw / 2, ch / 2); }
    const css = getComputedStyle(document.documentElement), gold = css.getPropertyValue('--gold').trim() || '#ffd166', green = css.getPropertyValue('--green').trim() || '#3fb950';
    const pins = pinsIn(area), R = Math.max(3.5, Math.min(7, 2 + zoom * 1.2));   // smaller pins when the whole area is on screen
    pins.forEach((i) => {
      const q = D.MAP_PINS[i], x = tx + q[1] * zoom, y = ty + q[2] * zoom, have = !!st.have[i], boss = q.length > 3;
      ctx.beginPath();
      if (boss) { ctx.moveTo(x, y - R - 1); ctx.lineTo(x + R + 1, y); ctx.lineTo(x, y + R + 1); ctx.lineTo(x - R - 1, y); ctx.closePath(); }
      else ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = have ? 'rgba(63,185,80,.85)' : 'rgba(10,14,22,.9)'; ctx.fill();
      ctx.lineWidth = i === sel ? 3 : 2; ctx.strokeStyle = have ? green : gold; ctx.stroke();
      if (have) { ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 1, y + 2.5); ctx.lineTo(x + 3.5, y - 3); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    });
    if (samus && samus.area === area) {
      const x = tx + samus.x * zoom, y = ty + samus.y * zoom;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,120,60,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ff7a3c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // the picked spot's label
    if (sel >= 0 && pins.indexOf(sel) >= 0) {
      const q = D.MAP_PINS[sel], x = tx + q[1] * zoom, y = ty + q[2] * zoom;
      label.hidden = false;
      label.querySelector('.n').textContent = st.names[sel] + (st.items && st.items[sel] ? ' · ' + st.items[sel] : '');
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
    pinsIn(area).forEach((i) => { const q = D.MAP_PINS[i], d = Math.hypot(tx + q[1] * zoom - x, ty + q[2] * zoom - y); if (d < bd) { bd = d; best = i; } });
    sel = best === sel ? -1 : best; redraw();
  }

  // ── Samus ────────────────────────────────────────────────────────────────
  function setSamus(live) {
    const r = rom(), M = D.MEM;
    let s = null;
    if (live && live.started && r && live.room >= 0x91F8) {
      const h = 0x78000 + (live.room - 0x8000), a = r[h + 1];
      if (a < 6) s = { area: a, x: r[h + 2] * 8 + live.sx / 32, y: (r[h + 3] + 1) * 8 + live.sy / 32 };
    }
    const was = samus; samus = s;
    if (!s) { if (was) redraw(); return; }
    if (follow && s.area !== area) setArea(s.area, false);
    else if (follow && !moved) {   // keep her in view
      const [cw, ch] = size(), x = tx + s.x * zoom, y = ty + s.y * zoom;
      if (x < 20 || y < 20 || x > cw - 20 || y > ch - 20) { tx = cw / 2 - s.x * zoom; ty = ch / 2 - s.y * zoom; }
    }
    if (!was || was.area !== s.area || Math.abs(was.x - s.x) > .2 || Math.abs(was.y - s.y) > .2) redraw();
  }

  const SMRMap = {
    rom: null,
    init(el, opts) {
      host = el; onToggle = opts && opts.onToggle;
      try { follow = localStorage.getItem('smr:map-follow') !== 'off'; } catch (e) {}
      host.innerHTML = '<div class="m-tabs" role="tablist">' + D.MAP_AREAS.map((n, i) => '<button type="button" role="tab" data-area="' + i + '">' + n + '<small></small></button>').join('') +
        '<span class="m-sp"></span><button type="button" class="m-follow" aria-pressed="' + follow + '" title="Switch to the area Samus is in and keep her in view">⌖ Follow</button><button type="button" class="m-fit" title="Fit the area">⤢</button></div>' +
        '<div class="m-stage"><canvas class="m-canvas"></canvas><div class="m-label" hidden><span class="n"></span><button type="button"></button></div></div>';
      tabs = host.querySelector('.m-tabs'); stage = host.querySelector('.m-stage'); cv = host.querySelector('canvas'); ctx = cv.getContext('2d'); label = host.querySelector('.m-label');
      fitBtn = host.querySelector('.m-fit'); followBtn = host.querySelector('.m-follow');
      tabs.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => setArea(+b.dataset.area, true)));
      fitBtn.addEventListener('click', fit);
      followBtn.addEventListener('click', () => { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); try { localStorage.setItem('smr:map-follow', follow ? 'on' : 'off'); } catch (e) {} if (follow && samus) { moved = false; setSamus(Object.assign({ started: true }, lastLive || {})); } });
      label.querySelector('button').addEventListener('click', () => { if (sel >= 0 && onToggle) onToggle(sel); });
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
      if (window.ResizeObserver) new ResizeObserver(() => redraw()).observe(host);
      setArea(0, false); lastArea = 0;
    },
    update(s) {
      st = Object.assign(st, s);
      tabs.querySelectorAll('[data-area]').forEach((b) => { const idx = pinsIn(+b.dataset.area), n = idx.filter((i) => st.have[i]).length; b.querySelector('small').textContent = n + '/' + idx.length; b.classList.toggle('done', idx.length > 0 && n === idx.length); });
      redraw();
    },
    setSamus(live) { lastLive = live; setSamus(live); },
    redraw,
    screen(i) { const q = D.MAP_PINS[i]; return [tx + q[1] * zoom, ty + q[2] * zoom]; },
    get area() { return area; },
  };
  let lastLive = null;
  window.SMRMap = SMRMap;
})();
