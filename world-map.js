/*
 * world-map.js — a shared map viewer for the game pages: one or more world
 * pictures (drawn by the page, usually from the player's own ROM), a pin on
 * every check, the party's dot, tabs per world, Follow, pan / pinch / wheel
 * zoom, and a label for a tapped pin. Grown out of metroid/js/map.js.
 *
 *   const m = RHWorldMap.create(host, {
 *     key: 'ff6wc',                                   localStorage prefix (follow setting)
 *     worlds: [{ name, width, height, picture() }],  picture(): a canvas (width x height) or null (not drawable yet)
 *     pins: [{ world, x, y, i, boss }],              x, y in picture pixels; i = the check's index for update()
 *     name(i), onToggle(i), counts(i)      counts: whether check i counts in the tab's n/total (default all)
 *   });
 *   m.update({ have, items, liveHave, reach, shown })   per check index: taken, Reveal text, live tick, 'ok' | 'back' | 'no', hidden
 *   m.setPos({ world, x, y, dim } | null)              the party, in picture pixels
 *   m.redraw(); m.setWorld(i); m.invalidate()         invalidate: the pictures changed (a new ROM)
 *   m.repaint()                                       the pictures changed, keep the view (paths opening)
 */
(function () {
  'use strict';
  if (window.RHWorldMap) return;

  // the re-center button (as Zelda 3's map): one style for every map
  function resetCss() { if (document.getElementById('rh-map-reset-css')) return; const s = document.createElement('style'); s.id = 'rh-map-reset-css'; s.textContent = '.rh-map-reset{position:absolute;top:6px;right:6px;z-index:3;width:32px;height:32px;padding:0;border-radius:8px;border:1px solid #3a4556;background:rgba(12,16,26,.85);color:#e6edf3;font-size:18px;line-height:1;cursor:pointer}.rh-map-reset:hover{background:rgba(34,44,62,.95)}'; document.head.appendChild(s); }

  function create(host, o) {
    const worlds = o.worlds, pins = o.pins;
    let stage, cv, ctx, tabs, label, followBtn;
    let area = 0, follow = true, zoom = 1, tx = 0, ty = 0, moved = false, sel = -1, lastArea = -1;
    let st = { have: [], items: null, liveHave: () => false, reach: null, shown: null }, pos = null;
    let dirty = false;
    const pics = {};
    // pins on the same spot sit in a small ring around it (screen pixels, whatever the zoom)
    const spread = new Map();
    (function () {
      const groups = new Map();
      pins.forEach((q, k) => { const g = q.world + ':' + q.x + ':' + q.y; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k); });
      groups.forEach((ks) => { if (ks.length < 2) return; const r = ks.length < 4 ? 8 : ks.length < 7 ? 11 : 15; ks.forEach((k, j) => { const a = -Math.PI / 2 + j * 2 * Math.PI / ks.length; spread.set(k, [Math.cos(a) * r, Math.sin(a) * r]); }); });
    })();
    function screenXY(k) { const q = pins[k], o = spread.get(k) || [0, 0]; return [tx + q.x * zoom + o[0], ty + q.y * zoom + o[1]]; }
    const KEY = (o.key || 'rh') + ':map-follow';

    function picture(a) {
      if (pics[a] !== undefined) return pics[a];
      let p = null;
      try { p = worlds[a].picture(); } catch (e) { console.warn('[world-map]', e); p = null; }
      if (p) pics[a] = p;
      return p;
    }
    function pinsIn(a) { const out = []; pins.forEach((q, k) => { if (q.world === a && !(st.shown && st.shown[q.i] === false)) out.push(k); }); return out; }
    function box(a) {
      const p = picture(a); let x0 = 0, y0 = 0, x1 = worlds[a].width, y1 = worlds[a].height;
      if (p && p.box) [x0, y0, x1, y1] = p.box;
      return [x0, y0, x1, y1];
    }
    function size() { const r = stage.getBoundingClientRect(); return [Math.max(50, r.width), Math.max(50, r.height)]; }
    function fit() {
      const [cw, ch] = size(), [x0, y0, x1, y1] = box(area);
      const pad = 10, rw = x1 - x0 + pad * 2, rh = y1 - y0 + pad * 2;
      zoom = Math.max(0.02, Math.min(14, Math.min(cw / rw, ch / rh)));
      tx = (cw - (x1 - x0) * zoom) / 2 - x0 * zoom; ty = (ch - (y1 - y0) * zoom) / 2 - y0 * zoom;
      moved = false; redraw();
    }
    function zoomAt(sx, sy, k) {
      const z = Math.max(0.02, Math.min(24, zoom * k)); k = z / zoom;
      tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; zoom = z; moved = true; redraw();
    }
    function setWorld(a, user) {
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
      const p = picture(area), w = worlds[area];
      if (p) { ctx.imageSmoothingEnabled = zoom < 1; ctx.drawImage(p, tx, ty, w.width * zoom, w.height * zoom); }
      else { ctx.fillStyle = '#8a97b0'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.empty || 'The map is drawn from your ROM: play a seed, or pick your ROM in New seed.', cw / 2, ch / 2); }
      const css = getComputedStyle(document.documentElement), gold = css.getPropertyValue('--gold').trim() || '#ffd166', green = css.getPropertyValue('--green').trim() || '#3fb950';
      const list = pinsIn(area), R = Math.max(3.5, Math.min(7, 2 + zoom * 1.2));
      list.forEach((k) => {
        const q = pins[k], i = q.i, [x, y] = screenXY(k), have = !!st.have[i];
        const r = !have && st.reach ? st.reach[i] : null;
        const line = r === 'ok' ? green : r === 'back' ? '#ff9f43' : r === 'no' ? '#e5534b' : have ? green : gold;
        ctx.beginPath();
        if (q.boss) { ctx.moveTo(x, y - R - 1); ctx.lineTo(x + R + 1, y); ctx.lineTo(x, y + R + 1); ctx.lineTo(x - R - 1, y); ctx.closePath(); }
        else ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = have ? (st.reach ? 'rgba(63,185,80,.35)' : 'rgba(63,185,80,.85)') : r === 'ok' ? 'rgba(63,185,80,.75)' : r === 'back' ? 'rgba(255,159,67,.75)' : r === 'no' ? 'rgba(229,83,75,.6)' : 'rgba(10,14,22,.9)'; ctx.fill();
        ctx.lineWidth = k === sel ? 3 : 2; ctx.strokeStyle = line; ctx.globalAlpha = have && st.reach ? 0.55 : 1; ctx.stroke(); ctx.globalAlpha = 1;
        if (have) { ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 1, y + 2.5); ctx.lineTo(x + 3.5, y - 3); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      });
      if (pos && pos.world === area) {
        const x = tx + pos.x * zoom, y = ty + pos.y * zoom;
        ctx.globalAlpha = pos.dim ? 0.5 : 1;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,120,60,.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ff7a3c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (sel >= 0 && list.indexOf(sel) >= 0) {
        const i = pins[sel].i, [x, y] = screenXY(sel);
        label.hidden = false;
        const rs = !st.have[i] && st.reach ? st.reach[i] : null;
        label.querySelector('.n').textContent = o.name(i) + (st.items && st.items[i] ? ' · ' + st.items[i] : '') + (rs === 'ok' ? ' · in logic' : rs === 'back' ? ' · reachable, no way back yet' : rs === 'no' ? ' · not in logic yet' : '');
        const b = label.querySelector('button'); b.hidden = !o.onToggle || st.liveHave(i); b.textContent = st.have[i] ? 'Unmark' : 'Mark as done';
        const lw = label.offsetWidth, lh = label.offsetHeight;
        label.style.left = Math.max(4, Math.min(cw - lw - 4, x - lw / 2)) + 'px';
        label.style.top = (y - lh - 14 > 4 ? y - lh - 14 : y + 14) + 'px';
      } else label.hidden = true;
    }

    // pointer: drag to pan, pinch and wheel to zoom, tap a pin
    const ptrs = new Map(); let drag = null, pinch = null, lastTap = 0;
    function at(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function down(e) {
      if (e.button > 0) return;
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, at(e));
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, tx, ty, far: false };
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
    }
    function move(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, at(e));
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
      pinsIn(area).forEach((k) => { const [px, py] = screenXY(k), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = k; } });
      sel = best === sel ? -1 : best; redraw();
    }

    function setPos(p) {
      const was = pos; pos = p;
      if (!p) { if (was) redraw(); return; }
      if (follow && p.world !== area && !p.dim) setWorld(p.world, false);
      else if (follow && !moved && p.world === area) {
        const [cw, ch] = size(), x = tx + p.x * zoom, y = ty + p.y * zoom;
        if (x < 20 || y < 20 || x > cw - 20 || y > ch - 20) { tx = cw / 2 - p.x * zoom; ty = ch / 2 - p.y * zoom; }
      }
      if (!was || was.world !== p.world || Math.abs(was.x - p.x) > .2 || Math.abs(was.y - p.y) > .2 || was.dim !== p.dim) redraw();
    }

    try { follow = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
    host.innerHTML = '<div class="m-tabs" role="tablist">' + worlds.map((w, i) => '<button type="button" role="tab" data-area="' + i + '">' + w.name + '<small></small></button>').join('') +
      '<span class="m-sp"></span><button type="button" class="m-follow" aria-pressed="' + follow + '" title="Switch to the world the party is in and keep them in view">⌖ Follow</button></div>' +
      '<div class="m-stage"><canvas class="m-canvas"></canvas><button type="button" class="rh-map-reset" title="Re-center and fit the map" aria-label="Re-center and fit the map">\u27F2</button><div class="m-label" hidden><span class="n"></span><button type="button"></button></div></div>';
    tabs = host.querySelector('.m-tabs'); stage = host.querySelector('.m-stage'); cv = host.querySelector('canvas'); ctx = cv.getContext('2d'); label = host.querySelector('.m-label');
    followBtn = host.querySelector('.m-follow');
    tabs.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => setWorld(+b.dataset.area, true)));
    resetCss();
    host.querySelector('.rh-map-reset').addEventListener('click', fit);
    followBtn.addEventListener('click', () => { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); try { localStorage.setItem(KEY, follow ? 'on' : 'off'); } catch (e) {} if (follow && pos) { moved = false; const p = pos; pos = null; setPos(p); } });
    label.querySelector('button').addEventListener('click', () => { if (sel >= 0 && o.onToggle) o.onToggle(pins[sel].i); });
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = at(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(() => redraw()).observe(host);
    setWorld(0, false); lastArea = 0;

    return {
      update(s) {
        st = Object.assign(st, s);
        tabs.querySelectorAll('[data-area]').forEach((b) => { const idx = pinsIn(+b.dataset.area).filter((k) => !o.counts || o.counts(pins[k].i)), seen = new Set(), n = idx.filter((k) => { const i = pins[k].i; if (seen.has(i)) return false; seen.add(i); return st.have[i]; }).length; b.querySelector('small').textContent = seen.size ? n + '/' + seen.size : ''; b.classList.toggle('done', seen.size > 0 && n === seen.size); });
        redraw();
      },
      setPos, redraw, fit,
      setWorld(a) { setWorld(a, false); },
      invalidate() { for (const k in pics) delete pics[k]; moved = false; fit(); },
      repaint() { for (const k in pics) delete pics[k]; redraw(); },   // the pictures changed, the view stays
      get world() { return area; },
    };
  }
  window.RHWorldMap = { create };
})();
