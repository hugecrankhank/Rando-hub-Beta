/*
 * z3map.js — a world map for Zelda 3 ROM hacks (Patched games): the hack's own
 * overworld map, drawn from the ROM that's running, with Link on it and pins
 * you drop yourself. Nothing is known about the hack in advance: whatever map
 * its author put in the ROM is what's shown (Allhallows Eve, Parallel Worlds,
 * any hack made with ZScream).
 *
 *   Z3Map.attach({ player, host, gameId, hackOnly, onShow })
 *       watches the player; shows the map once a Zelda 3 ROM is running
 *       (hackOnly: only when its map isn't the vanilla one, for the hub, where
 *       vanilla and randomizer ROMs have Mudora's map already)
 *   Z3Map.isHack(rom)   true for a Zelda 3 ROM whose world map isn't vanilla's
 *
 * The picture is the game's own pause-screen map (press X): a Mode 7 picture of
 * 8x8 tiles, one byte a pixel, 256 tiles at ROM $18:C000 (PC 0x0C4000, 16 KB);
 * the Light World tilemap is 64x64 tiles at $0A:C727 (PC 0x54727) in four 32x32
 * quarters, the Dark World 32x32 at $0A:D727 (PC 0x55727), half the scale; the
 * colours at $0A:DB27 (PC 0x55B27), 128 a world. Offsets of the US ROM, which
 * ZScream hacks are built on. Link: $7E:008A the overworld area (bit 6 = Dark
 * World), $7E:0022 / $7E:0020 his x / y in the world (4096 px across, so an
 * eighth of that on the 512 px map), $7E:001B indoors.
 */
(function () {
  'use strict';
  var GFX = 0x0C4000, LW = 0x54727, DW = 0x55727, PAL = 0x55B27, W = 512;
  var WORLDS = ['Light World', 'Dark World'];
  var host, stage, cv, ctx, tabs, label, followBtn, pinBtn, atBtn;
  var player = null, gameId = '', rom = null, pics = {};
  var world = 0, follow = true, zoom = 1, tx = 0, ty = 0, moved = false, dirty = false, placing = false;
  var link = null, lastOut = null, pins = [], sel = -1, shown = false, hackOnly = false, onShow = null;

  function isZ3(r) {
    if (!r || r.length < 0x100000) return false;
    var t = ''; for (var i = 0x7FC0; i < 0x7FD5; i++) t += String.fromCharCode(r[i]);
    if (!/^THE LEGEND OF ZELDA|^ZELDANODENSETSU/.test(t)) return false;
    for (var j = 0; j < 256; j++) if ((r[PAL + j * 2] | r[PAL + j * 2 + 1] << 8) > 0x7FFF) return false;   // not the US layout
    return true;
  }
  // the vanilla map data (FNV-1a of PC 0x54727-0x55B27: both tilemaps), as the
  // Japanese 1.0 ROM has it; randomizer seeds keep it
  var VANILLA = ['ebec8708'];
  function mapHash(r) { var h = 0x811c9dc5; for (var i = 0x54727; i < 0x55B27; i++) { h ^= r[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
  function isHack(r) { return isZ3(r) && VANILLA.indexOf(mapHash(r)) < 0; }
  function picture(w) {
    if (pics[w]) return pics[w];
    var size = w ? 256 : 512, c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d'), id = g.createImageData(size, size), px = id.data, pb = w ? 128 : 0;
    var cols = [];
    for (var i = 0; i < 128; i++) { var v = rom[PAL + (pb + i) * 2] | rom[PAL + (pb + i) * 2 + 1] << 8; cols.push([(v & 31) << 3, ((v >> 5) & 31) << 3, ((v >> 10) & 31) << 3]); }
    function tile(t, x0, y0) {
      var o = GFX + t * 64;
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        var v = rom[o + y * 8 + x], col = cols[v & 127], p = ((y0 + y) * size + x0 + x) * 4;
        px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = 255;
      }
    }
    if (!w) { var p = LW; [[0, 0], [32, 0], [0, 32], [32, 32]].forEach(function (q) { for (var r = 0; r < 32; r++) for (var cc = 0; cc < 32; cc++) tile(rom[p++], (q[0] + cc) * 8, (q[1] + r) * 8); }); }
    else { var p2 = DW; for (var r2 = 0; r2 < 32; r2++) for (var c2 = 0; c2 < 32; c2++) tile(rom[p2++], c2 * 8, r2 * 8); }
    g.putImageData(id, 0, 0);
    return (pics[w] = c);
  }

  // ── pins ─────────────────────────────────────────────────────────────────
  function pkey() { return 'rhb-z3map-pins:' + (gameId || (rom ? 'map-' + mapHash(rom) : 'x')); }
  function loadPins() { try { pins = JSON.parse(localStorage.getItem(pkey()) || '[]') || []; } catch (e) { pins = []; } }
  function savePins() { try { localStorage.setItem(pkey(), JSON.stringify(pins)); } catch (e) {} }
  function addPin(w, x, y) {
    var name = prompt('What’s here? (a name for the pin)', ''); if (name === null) return;
    pins.push({ w: w, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: name.trim().slice(0, 60) || 'Pin', t: Date.now() });
    savePins(); sel = pins.length - 1; redraw();
  }

  // ── view ─────────────────────────────────────────────────────────────────
  function size() { var r = stage.getBoundingClientRect(); return [Math.max(50, r.width), Math.max(50, r.height)]; }
  function fit() { var s = size(); zoom = Math.min(s[0], s[1]) / W; tx = (s[0] - W * zoom) / 2; ty = (s[1] - W * zoom) / 2; moved = false; redraw(); }
  function zoomAt(sx, sy, k) { var z = Math.max(0.3, Math.min(12, zoom * k)); k = z / zoom; tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; zoom = z; moved = true; redraw(); }
  function setWorld(w, user) {
    if (w === world && pics[w]) { if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); } return; }
    world = w; sel = -1;
    tabs.querySelectorAll('[data-w]').forEach(function (b) { b.setAttribute('aria-selected', +b.dataset.w === w ? 'true' : 'false'); });
    if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); }
    fit();
  }
  function redraw() { if (dirty) return; dirty = true; requestAnimationFrame(draw); }
  function draw() {
    dirty = false;
    if (!shown || !host.isConnected || host.offsetParent === null) return;
    var s = size(), dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(s[0] * dpr) || cv.height !== Math.round(s[1] * dpr)) { cv.width = Math.round(s[0] * dpr); cv.height = Math.round(s[1] * dpr); if (!moved) { dirty = false; fit(); return; } }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, s[0], s[1]);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(picture(world), tx, ty, W * zoom, W * zoom);
    // pins
    pins.forEach(function (p, i) {
      if (p.w !== world) return;
      var x = tx + p.x * zoom, y = ty + p.y * zoom;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 12); ctx.arc(x, y - 14, 6.5, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x, y); ctx.closePath();
      ctx.fillStyle = i === sel ? '#fff' : '#ffd166'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#20232a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 14, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#20232a'; ctx.fill();
    });
    // Link (or where he went in)
    var l = link && link.w === world ? link : (lastOut && lastOut.w === world && (!link || link.indoors) ? lastOut : null);
    if (l) {
      var x = tx + l.x * zoom, y = ty + l.y * zoom, dim = !link || link.indoors;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = dim ? 'rgba(120,200,120,.2)' : 'rgba(80,220,100,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = dim ? '#6a9a6a' : '#3fe060'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    if (sel >= 0 && pins[sel] && pins[sel].w === world) {
      var p = pins[sel], lx = tx + p.x * zoom, ly = ty + p.y * zoom;
      label.hidden = false; label.querySelector('.n').textContent = p.n;
      var lw = label.offsetWidth, lh = label.offsetHeight;
      label.style.left = Math.max(4, Math.min(s[0] - lw - 4, lx - lw / 2)) + 'px';
      label.style.top = (ly - lh - 26 > 4 ? ly - lh - 26 : ly + 10) + 'px';
    } else label.hidden = true;
    atBtn.hidden = !(link && !link.indoors);
  }

  // ── pointer ──────────────────────────────────────────────────────────────
  var ptrs = new Map(), drag = null, pinch = null, lastTap = 0;
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function down(e) {
    if (e.button > 0) return;
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, far: false };
    else if (ptrs.size === 2) { var v = Array.from(ptrs.values()), a = v[0], b = v[1]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
  }
  function move(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 2 && pinch) {
      var v = Array.from(ptrs.values()), a = v[0], b = v[1], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pinch.d > 0) zoomAt(mx, my, d / pinch.d);
      tx += mx - pinch.mx; ty += my - pinch.my; pinch = { d: d, mx: mx, my: my }; moved = true; redraw();
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.far = true;
      if (drag.far) { tx = drag.tx + dx; ty = drag.ty + dy; moved = true; redraw(); }
    }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    var p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.far && ptrs.size === 0) {
      var now = Date.now();
      if (placing) { setPlacing(false); addPin(world, (p[0] - tx) / zoom, (p[1] - ty) / zoom); }
      else if (now - lastTap < 300) { zoomAt(p[0], p[1], 2); lastTap = 0; }
      else { lastTap = now; tap(p[0], p[1]); }
    }
    if (ptrs.size === 0) drag = null;
  }
  function tap(x, y) {
    var best = -1, bd = 18;
    pins.forEach(function (p, i) { if (p.w !== world) return; var d = Math.hypot(tx + p.x * zoom - x, ty + p.y * zoom - (y + 12)); if (d < bd) { bd = d; best = i; } });
    sel = best === sel ? -1 : best; redraw();
  }
  function setPlacing(on) { placing = on; pinBtn.setAttribute('aria-pressed', String(on)); cv.style.cursor = on ? 'crosshair' : 'grab'; host.querySelector('.z3m-hint').textContent = on ? 'Tap the map where the pin goes' : ''; }

  // ── the game ─────────────────────────────────────────────────────────────
  function hide() { if (shown) { shown = false; host.hidden = true; if (onShow) { try { onShow(false); } catch (e) {} } } }
  function poll() {
    var P = typeof player === 'function' ? player() : player, core = P && P.core, r = null, wr = null;
    try { r = core && core.rom && core.rom(); wr = core && core.wram && core.wram(); } catch (e) {}
    if (!r || !wr || wr.length < 0x20000) { hide(); return; }
    if (r !== rom) { rom = (hackOnly ? isHack(r) : isZ3(r)) ? r : null; pics = {}; }
    if (!rom) { hide(); return; }
    if (!shown) { shown = true; host.hidden = false; loadPins(); setTimeout(fit, 0); if (onShow) { try { onShow(true); } catch (e) {} } }
    var mod = wr[0x10], area = wr[0x8A], indoors = !!wr[0x1B];
    var x = (wr[0x22] | wr[0x23] << 8) / 8, y = (wr[0x20] | wr[0x21] << 8) / 8;
    var playing = (mod === 0x07 || mod === 0x09 || mod === 0x0B || mod === 0x0E || mod === 0x10) && x < W && y < W;
    var was = link;
    if (!playing) link = null;
    else { link = { w: area & 0x40 ? 1 : 0, x: x, y: y, indoors: indoors }; if (!indoors) lastOut = link; }
    if (link && !link.indoors && follow) {
      if (link.w !== world) setWorld(link.w, false);
      else if (!moved) { var s = size(), sx = tx + link.x * zoom, sy = ty + link.y * zoom; if (sx < 20 || sy < 20 || sx > s[0] - 20 || sy > s[1] - 20) { tx = s[0] / 2 - link.x * zoom; ty = s[1] / 2 - link.y * zoom; } }
    }
    if (!was !== !link || (link && was && (was.w !== link.w || was.indoors !== link.indoors || Math.abs(was.x - link.x) > .2 || Math.abs(was.y - link.y) > .2))) redraw();
  }

  window.Z3Map = {
    isHack: isHack, isZ3: isZ3, mapHash: mapHash,
    attach: function (o) {
      player = o.player; host = o.host; gameId = o.gameId || ''; hackOnly = !!o.hackOnly; onShow = o.onShow || null;
      try { follow = localStorage.getItem('rhb-z3map-follow') !== 'off'; } catch (e) {}
      host.hidden = true;
      host.innerHTML = '<style>' +
        '.z3m { display: flex; flex-direction: column; height: 360px; border: 1px solid var(--line, #30363d); border-radius: 8px; overflow: hidden; background: #0b0f16; }' +
        '.z3m-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px 4px 0; background: rgba(255,255,255,.04); border-bottom: 1px solid var(--line, #30363d); }' +
        '.z3m-tabs button { background: none; border: 0; padding: 6px 8px 7px; font: 500 13px/1 system-ui, sans-serif; color: var(--dim, #8b95a3); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap; }' +
        '.z3m-tabs button[aria-selected="true"] { color: #ffd166; border-bottom-color: #ffd166; }' +
        '.z3m-tabs .sp { flex: 1; } .z3m-tabs [aria-pressed="true"] { color: #3fe060; } .z3m-tabs .z3m-pin[aria-pressed="true"] { color: #ffd166; }' +
        '.z3m-stage { position: relative; flex: 1 1 0; min-height: 0; } .z3m-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }' +
        '.z3m-label { position: absolute; z-index: 2; background: rgba(12,16,26,.94); border: 1px solid var(--line, #30363d); border-radius: 6px; padding: 6px 8px; font-size: 12.5px; color: #e6edf3; display: flex; flex-direction: column; gap: 4px; max-width: 220px; }' +
        '.z3m-label[hidden], .z3m-at[hidden] { display: none; }' +
        '.z3m-label button { background: #1b2130; border: 1px solid #3a4556; color: #ff9f9f; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer; }' +
        '.z3m-hint { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 12px; color: #ffd166; padding: 4px; pointer-events: none; text-shadow: 0 1px 2px #000; }' +
        '.z3m-about { color: var(--dim, #8b95a3); font-size: 12px; margin: 6px 0 0; }</style>' +
        '<div class="z3m"><div class="z3m-tabs" role="tablist">' + WORLDS.map(function (n, i) { return '<button type="button" role="tab" data-w="' + i + '">' + n + '</button>'; }).join('') +
        '<span class="sp"></span><button type="button" class="z3m-at" title="Drop a pin where Link stands" hidden>⌖ Pin at Link</button><button type="button" class="z3m-pin" aria-pressed="false" title="Drop a pin: tap the map where it goes">📍 Pin</button>' +
        '<button type="button" class="z3m-follow" aria-pressed="' + follow + '" title="Switch to the world Link is in and keep him in view">⌖ Follow</button><button type="button" class="z3m-fit" title="Fit the map">⤢</button></div>' +
        '<div class="z3m-stage"><canvas></canvas><div class="z3m-label" hidden><span class="n"></span><button type="button">Remove pin</button></div><div class="z3m-hint"></div></div></div>' +
        '<p class="z3m-about">The hack’s own world map, from its ROM (the pause-screen map). Link is the green dot; pins are yours, kept for this game.</p>';
      stage = host.querySelector('.z3m-stage'); cv = stage.querySelector('canvas'); ctx = cv.getContext('2d'); tabs = host.querySelector('.z3m-tabs'); label = host.querySelector('.z3m-label');
      followBtn = host.querySelector('.z3m-follow'); pinBtn = host.querySelector('.z3m-pin'); atBtn = host.querySelector('.z3m-at');
      tabs.querySelectorAll('[data-w]').forEach(function (b) { b.addEventListener('click', function () { setWorld(+b.dataset.w, true); }); });
      host.querySelector('.z3m-fit').addEventListener('click', fit);
      followBtn.addEventListener('click', function () { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); try { localStorage.setItem('rhb-z3map-follow', follow ? 'on' : 'off'); } catch (e) {} if (follow) moved = false; });
      pinBtn.addEventListener('click', function () { setPlacing(!placing); });
      atBtn.addEventListener('click', function () { if (link && !link.indoors) addPin(link.w, link.x, link.y); });
      label.querySelector('button').addEventListener('click', function () { if (sel >= 0) { pins.splice(sel, 1); sel = -1; savePins(); redraw(); } });
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) { e.preventDefault(); var p = pos(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
      if (window.ResizeObserver) new ResizeObserver(function () { redraw(); }).observe(stage);
      tabs.querySelector('[data-w="0"]').setAttribute('aria-selected', 'true');
      setInterval(poll, 250);
    },
  };
})();
