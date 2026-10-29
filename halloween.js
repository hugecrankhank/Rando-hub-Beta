/*
 * Halloween decorations for A Link to the Past (HydeOut's idea, Oct 2026):
 * jack-o'-lanterns, cobwebs in the corners of dungeon rooms, spiders on
 * threads, a ghost or two and bats, drawn over the game and moving with the
 * camera, so they look like part of the world.
 *
 * Drawn on a 256 x 224 canvas laid over the game picture (pixel for pixel
 * with the SNES), nothing is changed in the game. Where things go comes from
 * the game's own memory:
 *   camera     $E2 / $E8 (BG2 scroll: the top-left of the screen in the world)
 *   dungeons   the room's tile types ($7F2000, 64 x 64 tiles of 8 px): a web in
 *              every inner corner, pumpkins and spiders along walls, on floor
 *   overworld  the area's map16 tiles ($7E2000) and the ROM's tile types for
 *              them ($1B:F110, zelda3 Overworld_ReadTileAttribute): pumpkins on
 *              open ground, a few bats overhead
 * Each room / area gets the same decorations every visit (positions come from
 * its number). Only while Link is playing (dungeon or overworld module), not in
 * menus, maps or text.
 *
 * ⚙ Settings → "Halloween decorations" (off by default). RandoHalloween.set(true).
 */
(function () {
  'use strict';
  var KEY = 'rhb-halloween';
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var W = 256, H = 224;

  // ── pixel art ───────────────────────────────────────────────────────────
  function sprite(rows, pal) {
    var w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); });
    var c = document.createElement('canvas'); c.width = w; c.height = rows.length;
    var x = c.getContext('2d');
    rows.forEach(function (r, y) { for (var i = 0; i < r.length; i++) { var p = pal[r[i]]; if (p) { x.fillStyle = p; x.fillRect(i, y, 1, 1); } } });
    return c;
  }
  var PUMPKIN_PAL = { k: '#2a1000', o: '#f0861a', d: '#b8550a', b: '#5a3a12', g: '#3f8a2a' };
  var PUMPKIN = [
    '......bg......',
    '......b.......',
    '...kkkkkkkk...',
    '..koodoooddk..',
    '.koooodooooook',
    '.kowwoodoowwok',
    'koowwwoooowwwok',
    'koooooodoooooook',
    'kooowooooowoook',
    '.koowwwwwwwook.',
    '..koowowowook..',
    '...kkkkkkkkk...',
  ];
  // the eyes and mouth ('w') glow: two frames, yellow and orange-yellow
  var pumpA = sprite(PUMPKIN, Object.assign({ w: '#ffe14a' }, PUMPKIN_PAL));
  var pumpB = sprite(PUMPKIN, Object.assign({ w: '#ffb02e' }, PUMPKIN_PAL));
  var GHOST = [
    '...wwwww...',
    '..wwwwwww..',
    '.wwwwwwwww.',
    '.ww.www.ww.',
    '.ww.www.ww.',
    '.wwwwwwwww.',
    '.wwww.wwww.',
    '.wwwwwwwww.',
    '.wwwwwwwww.',
    '.ww.www.ww.',
    '.w...w...w.',
  ];
  var ghost = sprite(GHOST, { w: '#eef3ff' });
  var BAT1 = ['k.......k', 'kk.kkk.kk', 'kkkkrkkrk', '.kkkkkkk.', '...k.k...'];
  var BAT2 = ['.........', '...kkk...', 'kkkkrkkrk', 'kkkkkkkkk', 'k..k.k..k'];
  var bat1 = sprite(BAT1, { k: '#1a1024', r: '#ff3a3a' }), bat2 = sprite(BAT2, { k: '#1a1024', r: '#ff3a3a' });
  var SPIDER = ['.k...k.', '..k.k..', 'kkkkkkk', '.krkrk.', 'kkkkkkk', '..k.k..', '.k...k.'];
  var spider = sprite(SPIDER, { k: '#141414', r: '#ff3030' });
  // a cobweb in a top-left corner: threads out from the corner, sagging rings
  function makeWeb(n) {
    var c = document.createElement('canvas'); c.width = n; c.height = n;
    var x = c.getContext('2d'), put = function (px, py, col) { if (px >= 0 && py >= 0 && px < n && py < n) { x.fillStyle = col; x.fillRect(px | 0, py | 0, 1, 1); } };
    var angles = [0, 0.4, 0.78, 1.17, 1.5708];
    angles.forEach(function (a) { for (var r = 0; r < n; r += 0.5) put(Math.cos(a) * r, Math.sin(a) * r, 'rgba(235,238,245,.85)'); });
    [0.35, 0.62, 0.9].forEach(function (f) {
      var R = n * f;
      for (var i = 0; i < angles.length - 1; i++) {
        var a0 = angles[i], a1 = angles[i + 1];
        for (var t = 0; t <= 1; t += 0.04) {
          var a = a0 + (a1 - a0) * t, sag = Math.sin(t * Math.PI) * R * 0.18;
          put(Math.cos(a) * (R - sag), Math.sin(a) * (R - sag), 'rgba(205,210,225,.75)');
        }
      }
    });
    return c;
  }
  var web = makeWeb(18), webR = (function () { var c = document.createElement('canvas'); c.width = web.width; c.height = web.height; var x = c.getContext('2d'); x.translate(web.width, 0); x.scale(-1, 1); x.drawImage(web, 0, 0); return c; })();

  // ── the game ───────────────────────────────────────────────────────────
  function core() { var P = window.Snes9xPlayer; return P && P.core; }
  function hash(a, b, c) { var h = (a * 374761393 + b * 668265263 + (c || 0) * 2246822519) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  var cacheKey = '', deco = null, waitFrames = 0;

  function dungeonDeco(r, room) {
    var at = function (tx, ty) { return tx < 0 || ty < 0 || tx > 63 || ty > 63 ? 1 : r[0x12000 + ty * 64 + tx]; };
    var solid = function (a) { return a >= 0x01 && a <= 0x04; };   // walls, and the wall edges (4) around a room's floor
    var floor = function (a) { return a === 0x00; };
    var Bx = (room & 0xF) << 9, By = (room >> 4) << 9;
    var out = { webs: [], pumpkins: [], spiders: [], ghosts: [] }, taken = [];
    var far = function (x, y, d) { return taken.every(function (p) { return Math.abs(p[0] - x) > d || Math.abs(p[1] - y) > d; }); };
    for (var ty = 1; ty < 63; ty++) for (var tx = 1; tx < 63; tx++) {
      if (!floor(at(tx, ty))) continue;
      var up = solid(at(tx, ty - 1)), left = solid(at(tx - 1, ty)), right = solid(at(tx + 1, ty));
      if (up && left && solid(at(tx - 1, ty - 1)) && hash(room, tx, ty) % 10 < 8) out.webs.push({ x: Bx + tx * 8, y: By + ty * 8, r: false });
      if (up && right && solid(at(tx + 1, ty - 1)) && hash(room, tx, ty + 99) % 10 < 8) out.webs.push({ x: Bx + tx * 8 + 8 - web.width, y: By + ty * 8, r: true });
      if (up && !left && !right && floor(at(tx, ty + 1)) && floor(at(tx + 1, ty)) && floor(at(tx + 1, ty + 1))) {
        var hx = Bx + tx * 8, hy = By + ty * 8, k = hash(room, tx, ty + 7) % 100;
        if (k < 7 && far(hx, hy, 40)) { out.pumpkins.push({ x: hx, y: hy + 1, f: k }); taken.push([hx, hy]); }
        else if (k > 95 && far(hx, hy, 40)) { out.spiders.push({ x: hx + 4, y: hy, len: 18 + k % 3 * 8, f: k }); taken.push([hx, hy]); }
      }
    }
    // a ghost floating in a big room, now and then
    var fl = []; for (var y = 4; y < 60; y += 8) for (var x2 = 4; x2 < 60; x2 += 8) if (floor(at(x2, y)) && floor(at(x2 + 2, y)) && floor(at(x2, y + 2))) fl.push([x2, y]);
    if (fl.length > 12 && hash(room, 1, 2) % 3 === 0) { var g = fl[hash(room, 3, 4) % fl.length]; out.ghosts.push({ x: Bx + g[0] * 8, y: By + g[1] * 8, f: hash(room, 5, 6) % 100 }); }
    return out;
  }

  function overworldDeco(r, rom, area) {
    var bx = r[0x70C] | r[0x70D] << 8, mx = r[0x70E] | r[0x70F] << 8, by = r[0x708] | r[0x709] << 8, my = r[0x70A] | r[0x70B] << 8;
    var attr = function (x, y) {
      var t = (((x >> 3) - bx) & mx) | (((y - by) & my) << 3);
      var idx = r[0x2000 + (t & ~1)] | r[0x2001 + (t & ~1)] << 8;
      return idx < 3824 ? rom[0xDF110 + idx] : 1;
    };
    var x0 = bx * 8, y0 = by, w = (mx + 2) * 8, h = my + 16;
    var out = { webs: [], pumpkins: [], spiders: [], ghosts: [], bats: true }, taken = [];
    for (var y = y0 + 16; y < y0 + h - 32; y += 16) for (var x = x0 + 16; x < x0 + w - 32; x += 16) {
      var ok = true;
      for (var dy = -16; dy <= 16 && ok; dy += 16) for (var dx = -16; dx <= 16 && ok; dx += 16) { var t = attr(x + dx, y + dy); if (t !== 0x00 && t !== 0x48) ok = false; }   // open ground, short grass
      if (!ok) continue;
      var k = hash(area + 1000, x >> 4, y >> 4) % 100;
      if (k < 6 && taken.every(function (p) { return Math.abs(p[0] - x) > 56 || Math.abs(p[1] - y) > 56; })) { out.pumpkins.push({ x: x, y: y + 2, f: k }); taken.push([x, y]); }
    }
    return out;
  }

  // ── drawing ────────────────────────────────────────────────────────────
  var cv = null, ctx = null, frame = 0;
  function host() { return document.querySelector('.s9x'); }
  function ensureCanvas() {
    var h = host(); if (!h) return null;
    if (!cv || !cv.isConnected || cv.parentNode !== h) {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'rh-halloween';
      cv.style.cssText = 'position:absolute;z-index:23;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
      h.appendChild(cv); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    }
    var P = window.Snes9xPlayer, pr = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (pr && pr.w > 0) { cv.style.left = pr.x + 'px'; cv.style.top = pr.y + 'px'; cv.style.width = pr.w + 'px'; cv.style.height = pr.h + 'px'; }
    return ctx;
  }
  function hide() { if (cv) { cv.remove(); cv = null; ctx = null; } }

  function draw() {
    requestAnimationFrame(draw);
    if (!on) { if (cv) hide(); return; }
    var c = core(), r = c && c.wram && c.wram();
    if (!r || r.length < 0x20000) { if (cv) hide(); return; }
    var mod = r[0x10], sub = r[0x11];
    var playing = mod === 0x07 || mod === 0x09 || mod === 0x0B;
    if (!playing) { if (ctx) ctx.clearRect(0, 0, W, H); return; }
    var g = ensureCanvas(); if (!g) return;
    frame++;
    var indoors = mod === 0x07;
    var key = indoors ? 'd' + (r[0xA0] | r[0xA1] << 8) : 'o' + r[0x8A];
    // a new room or area: build its decorations once its tiles are in (steady a few frames)
    if (key !== cacheKey) { cacheKey = key; deco = null; waitFrames = 12; }
    if (!deco) {
      if (sub !== 0 || --waitFrames > 0) { g.clearRect(0, 0, W, H); drips(g, r); return; }
      try {
        if (indoors) deco = dungeonDeco(r, r[0xA0] | r[0xA1] << 8);
        else { var rom = c.rom && c.rom(); deco = rom && rom.length > 0xE0000 ? overworldDeco(r, rom, r[0x8A]) : { webs: [], pumpkins: [], spiders: [], ghosts: [] }; }
      } catch (e) { deco = { webs: [], pumpkins: [], spiders: [], ghosts: [] }; }
    }
    var camX = r[0xE2] | r[0xE3] << 8, camY = r[0xE8] | r[0xE9] << 8;
    g.clearRect(0, 0, W, H);
    var vis = function (x, y, w, h) { return x + w > 0 && y + h > 0 && x < W && y < H; };
    deco.webs.forEach(function (d) { var x = d.x - camX, y = d.y - camY; if (vis(x, y, 18, 18)) g.drawImage(d.r ? webR : web, x, y); });
    deco.spiders.forEach(function (d) {
      var len = d.len + Math.round(Math.sin((frame + d.f * 7) / 40) * 6), x = d.x - camX, y = d.y - camY;
      if (!vis(x - 4, y, 8, len + 8)) return;
      g.fillStyle = 'rgba(230,230,240,.7)'; g.fillRect(x, y, 1, len);
      g.drawImage(spider, x - 3, y + len - 1);
    });
    deco.pumpkins.forEach(function (d) {
      var x = d.x - camX, y = d.y - camY; if (!vis(x, y, 16, 12)) return;
      g.drawImage(((frame + d.f * 3) >> 4) % 5 === 0 ? pumpB : pumpA, x, y);
    });
    deco.ghosts.forEach(function (d) {
      var t = (frame + d.f * 13) / 60, x = d.x - camX + Math.round(Math.sin(t) * 24), y = d.y - camY + Math.round(Math.sin(t * 1.7) * 6);
      if (!vis(x, y, 11, 11)) return;
      g.globalAlpha = 0.55 + 0.2 * Math.sin(t * 2); g.drawImage(ghost, x, y); g.globalAlpha = 1;
    });
    if (deco.bats) {
      for (var i = 0; i < 3; i++) {
        var p = (frame * (0.35 + i * 0.12) + i * 97) % (W + 60) - 30, yb = 28 + i * 22 + Math.round(Math.sin((frame + i * 50) / 18) * 6);
        g.drawImage(((frame >> 3) + i) % 2 ? bat1 : bat2, Math.round(p), yb);
      }
    }
    drips(g, r);
  }

  // Bleeding hearts (HydeOut): now and then a heart that isn't empty grows a drop
  // of blood at its tip, which runs down to the bottom of the screen leaving a
  // fading trail. The hearts sit at a fixed place in the HUD: ten to a row, 8 px
  // apart, the first one's tip at (164, 30), a second row 8 px lower; how many
  // aren't empty comes from Link's health ($7EF36D, 8 per heart).
  var drops = [], nextDrip = 120;
  function drips(g, r) {
    var hp = r[0xF36D], filled = Math.min(20, Math.ceil(hp / 8));
    if (--nextDrip <= 0) {
      nextDrip = 150 + Math.floor(Math.random() * 300);   // every 2.5 to 7.5 s
      if (filled > 0 && drops.length < 4) {
        var i = Math.floor(Math.random() * filled);
        drops.push({ x: 164 + (i % 10) * 8, y0: 30 + Math.floor(i / 10) * 8, t: 0, y: 0, v: 0 });
      }
    }
    for (var k = drops.length - 1; k >= 0; k--) {
      var d = drops[k];
      d.t++;
      if (d.t < 40) d.y = d.y0 + d.t / 20;                 // the drop swells at the tip
      else { d.v = Math.min(3.2, d.v + 0.06); d.y += d.v; } // then runs down
      var fade = d.y > H ? Math.max(0, 1 - (d.y - H) / 90) : 1;
      if (fade <= 0) { drops.splice(k, 1); continue; }
      // the trail: thin, darker, fading toward the top
      var top = d.y0 + 1, bottom = Math.min(H, d.y - 1);
      for (var y = top; y < bottom; y += 2) {
        g.fillStyle = 'rgba(130,0,10,' + (0.7 * fade * Math.min(1, (y - top + 8) / (bottom - top + 8))).toFixed(3) + ')';
        g.fillRect(d.x, y, 1, 2);
      }
      if (d.y < H + 2) {
        var yy = Math.round(d.y);
        g.fillStyle = '#b0000c'; g.fillRect(d.x - 1, yy - 1, 3, 3); g.fillRect(d.x, yy + 2, 1, 1);
        g.fillStyle = '#ff5a5a'; g.fillRect(d.x - 1, yy - 1, 1, 1);
      }
    }
  }
  requestAnimationFrame(draw);

  // ⚙ Settings: the switch
  function settings() {
    var panel = document.getElementById('trk-settings'); if (!panel || document.getElementById('halloween-deco')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'Jack-o’-lanterns, cobwebs in dungeon corners, spiders, a ghost now and then and bats, drawn over the game and moving with it. Nothing in the game changes.';
    lab.innerHTML = '🎃 Halloween decorations <span><input type="checkbox" id="halloween-deco"></span>';
    panel.appendChild(lab);
    var cb = lab.querySelector('input'); cb.checked = on;
    cb.addEventListener('change', function () { set(cb.checked); });
  }
  function set(v) { on = !!v; cacheKey = ''; deco = null; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} var cb = document.getElementById('halloween-deco'); if (cb) cb.checked = on; }
  function init() { settings(); var n = 0, t = setInterval(function () { settings(); if (document.getElementById('halloween-deco') || ++n > 50) clearInterval(t); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RandoHalloween = { set: set, get on() { return on; }, deco: function () { return deco; } };
})();
