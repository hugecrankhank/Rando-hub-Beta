/*
 * map-prizes.js — mark crystals and pendants on the game's own map
 * (HydeOut's idea, Oct 2026).
 *
 * While the world map is open in the game, a small button sits by each
 * dungeon on it, showing the prize the tracker has for that dungeon (or "?").
 *
 * Whatever prize the game itself draws on its map is copied to the tracker
 * on its own: the randomizer draws a dungeon's crystal or pendant there once
 * you may know it (its map or compass, by the seed's settings). Read from the
 * game's sprite list ($7E0800, 4 bytes a sprite; sizes in $7E0A00): a 16 x 16
 * sprite by the dungeon with the crystal picture ($64) or a pendant ($60/$62),
 * its colour from the palette (z3randomizer overworldmap.asm / tables.asm
 * WorldMapIcon_tile: palette 1 red, 2 blue, 4 green). The red X and the
 * crystal numbers are small sprites, so they never count. A prize is copied
 * once it's been seen the same a few times, and only when the game shows
 * something new: a change made by hand afterwards stays.
 *
 * Click a button for a picker: green pendant, pendant, crystal, red crystal,
 * or ? (not known). The buttons only show while the map is open, and only
 * with Mudora or Mudora 2.0.
 *
 * Where each dungeon is on the map: the game's own sum for its map markers
 * (zelda3 messaging.c WorldMap_CalculateOamCoordinates, MIT), for both zoom
 * levels, from the map's scroll ($E0 BG1HOFS, $063A M7Y, $0636 zoom). The
 * map is open when $10 = $0E (menus), $11 = 7 (world map) and $0200 = 5
 * (Link can move it). Light or Dark World: $8A & $40.
 *
 * ⚙ Settings → "Prize marks on the game's map" turns it off.
 */
(function () {
  'use strict';
  var KEY = 'rhb-map-prizes';
  var on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  // [tracker key, world]: the dungeons that have a prize
  var DGS = [['ep', 'lw'], ['dp', 'lw'], ['toh', 'lw'], ['pod', 'dw'], ['sp', 'dw'], ['sw', 'dw'], ['tt', 'dw'], ['ip', 'dw'], ['mm', 'dw'], ['tr', 'dw']];
  var NAMES = { ep: 'Eastern Palace', dp: 'Desert Palace', toh: 'Tower of Hera', pod: 'Palace of Darkness', sp: 'Swamp Palace', sw: 'Skull Woods',
    tt: "Thieves' Town", ip: 'Ice Palace', mm: 'Misery Mire', tr: 'Turtle Rock' };
  var PRIZE_ICON = { crystal: 'crystal', redcrystal: 'crystal_red', pendant: 'pendant_blue', greenpendant: 'pendant_green' };
  var TAB1 = [
    0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xdf, 0xde, 0xdd, 0xdc, 0xdb, 0xda, 0xd8, 0xd7, 0xd6, 0xd5, 0xd4, 0xd3, 0xd2, 0xd1, 0xd0, 0xcf, 0xce,
    0xcd, 0xcc, 0xcb, 0xca, 0xc9, 0xc7, 0xc6, 0xc5, 0xc4, 0xc3, 0xc2, 0xc1, 0xc0, 0xbf, 0xbe, 0xbd, 0xbc, 0xbb, 0xba, 0xb9, 0xb8, 0xb7, 0xb6, 0xb5, 0xb4, 0xb3, 0xb2, 0xb1, 0xb0, 0xaf, 0xae, 0xad,
    0xac, 0xab, 0xaa, 0xa9, 0xa8, 0xa7, 0xa6, 0xa5, 0xa4, 0xa3, 0xa2, 0xa1, 0xa0, 0x9f, 0x9e, 0x9d, 0x9c, 0x9b, 0x9b, 0x9a, 0x99, 0x98, 0x97, 0x96, 0x95, 0x94, 0x93, 0x92, 0x91, 0x90, 0x8f, 0x8e,
    0x8d, 0x8c, 0x8b, 0x8b, 0x8a, 0x89, 0x88, 0x87, 0x86, 0x85, 0x84, 0x83, 0x82, 0x81, 0x81, 0x80, 0x7f, 0x7e, 0x7d, 0x7c, 0x7b, 0x7a, 0x79, 0x79, 0x78, 0x77, 0x76, 0x75, 0x74, 0x73, 0x72, 0x72,
    0x71, 0x70, 0x6f, 0x6e, 0x6d, 0x6c, 0x6c, 0x6b, 0x6a, 0x69, 0x68, 0x67, 0x67, 0x66, 0x65, 0x64, 0x63, 0x62, 0x62, 0x61, 0x60, 0x5f, 0x5e, 0x5d, 0x5d, 0x5c, 0x5b, 0x5a, 0x59, 0x59, 0x58, 0x57,
    0x56, 0x55, 0x55, 0x54, 0x53, 0x52, 0x51, 0x51, 0x50, 0x4f, 0x4e, 0x4e, 0x4d, 0x4c, 0x4b, 0x4a, 0x4a, 0x49, 0x48, 0x47, 0x47, 0x46, 0x45, 0x44, 0x44, 0x43, 0x42, 0x41, 0x41, 0x40, 0x3f, 0x3e,
    0x3e, 0x3d, 0x3c, 0x3c, 0x3b, 0x3a, 0x39, 0x39, 0x38, 0x37, 0x36, 0x36, 0x35, 0x34, 0x34, 0x33, 0x32, 0x32, 0x31, 0x30, 0x2f, 0x2f, 0x2e, 0x2d, 0x2d, 0x2c, 0x2b, 0x2b, 0x2a, 0x29, 0x29, 0x28,
    0x27, 0x27, 0x26, 0x25, 0x25, 0x24, 0x23, 0x23, 0x22, 0x21, 0x21, 0x20, 0x1f, 0x1f, 0x1e, 0x1d, 0x1d, 0x1c, 0x1c, 0x1b, 0x1a, 0x1a, 0x19, 0x18, 0x18, 0x17, 0x17, 0x16, 0x15, 0x15, 0x14, 0x14,
    0x13, 0x12, 0x12, 0x11, 0x10, 0x10, 0xf, 0xf, 0xe, 0xe, 0xd, 0xc, 0xc, 0xb, 0xb, 0xa, 9, 9, 8, 8, 7, 7, 6, 5, 5, 4, 4, 3, 3, 2, 1, 1,
    0, 0, 0, 0, 0xff, 0xfe, 0xfe, 0xfd, 0xfc, 0xfc, 0xfb, 0xfb, 0xfa, 0xf9, 0xf9, 0xf8, 0xf7, 0xf7, 0xf6, 0xf5, 0xf4, 0xf4, 0xf3, 0xf2, 0xf2, 0xf1, 0xf0, 0xef, 0xee, 0xee, 0xed, 0xec,
    0xeb, 0xea, 0xe9, 0xe8, 0xe8, 0xe7, 0xe6, 0xe5, 0xe4, 0xe3, 0xe2, 0xe1, 0xe0];

  // a spot in the world (game pixels, 0-4095) → where the map draws it (screen pixels, 256 x 224), or null if off screen
  function mapPoint(r, X, Y) {
    var flags = r[0x636], m7y = r[0x63A] | r[0x63B] << 8, hofs = r[0xE0] | r[0xE1] << 8;
    var x, y, below;
    if (!flags) {
      var j = ((-(Y >> 4) + m7y + (Y >> 3 & 1) - 0xC0) << 16) >> 16;
      if (j < 0 || j >= TAB1.length) return null;
      var yv = (13 * TAB1[j]) >> 4 & 0xFF;
      var at = X >> 4 & 0xFF; below = at < 0x80; at = (at - 0x80) & 0xFF; if (at & 0x80) at = ~at & 0xFF;
      var t1 = (((yv < 224 ? yv : 0) * 0x54 >> 8) + 0xB2) & 0xFF, t2 = (at * t1 >> 8) & 0xFF;
      var t3 = (below ? 0x80 - t2 : t2 + 0x80) & 0xFF;
      x = (t3 - hofs + 0x80) & 0xFFFF; y = yv + 12;
    } else {
      var t0 = (-(Y >> 4) + m7y - 0x80) & 0xFFFF;
      if (t0 >= 0x100) return null;
      var u1 = t0 * 37 >> 4;
      if (u1 >= 333) return null;
      var yval = TAB1[u1], u2 = X;
      below = u2 < 0x7F8; u2 = (u2 - 0x7F8) & 0xFFFF; if (u2 & 0x8000) u2 = -u2 & 0xFFFF;
      var u3 = yval < 226 ? yval : 0, u4 = ((u3 * 84 >> 8) + 178) & 0xFF, u5 = ((u2 & 0xFF) * u4 >> 8) & 0xFF;
      var u6 = ((u2 >> 8) * u4 + u5) & 0xFFFF, u7 = (below ? 0x800 - u6 : u6 + 0x800) & 0xFFFF, below2 = u7 < 0x800;
      u7 = (u7 - 0x800) & 0xFFFF;
      var u8 = below2 ? -u7 & 0xFFFF : u7, u9 = ((u8 & 0xFF) * 45 >> 8) & 0xFF, u10 = ((u8 >> 8) * 45 + u9) & 0xFFFF;
      var u11 = (below2 ? 0x80 - u10 : u10 + 0x80) & 0xFFFF, xval = (u11 - hofs) & 0xFFFF;
      if (((xval + 0x80) & 0xFFFF) >= 0x100) return null;
      x = (xval + 0x81) & 0xFFFF; y = yval + 16;
    }
    if (x & 0x8000) x -= 0x10000;
    if (x < -8 || x > 264 || y < -8 || y > 232) return null;
    return { x: x, y: y };
  }

  function tracker() {
    var f = document.getElementById('emo-frame'), M = null;
    try { M = f && f.contentWindow && f.contentWindow.Mudora; } catch (e) {}
    return M && M.dungeonAct && M.dungeonAt ? M : null;
  }

  var CSS = [
    '.mapz { position: absolute; z-index: 6; pointer-events: none; }',
    '.mapz button { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; padding: 2px; border-radius: 50%; pointer-events: auto; cursor: pointer;',
    '  background: rgba(10,12,16,.82); border: 2px solid #ffd166; color: #ffd166; font: 900 14px/1 system-ui, sans-serif; display: flex; align-items: center; justify-content: center;',
    '  box-shadow: 0 0 6px rgba(0,0,0,.8); }',
    '.mapz button:hover { background: rgba(40,46,56,.95); border-color: #fff; }',
    '.mapz button img { width: 18px; height: 18px; object-fit: contain; image-rendering: pixelated; pointer-events: none; }',
    '.mapz button.got { border-color: #5ee37a; }',
    '.mapz .pick { position: absolute; transform: translate(-50%, 0); display: flex; gap: 3px; padding: 4px; border-radius: 8px; pointer-events: auto;',
    '  background: rgba(10,12,16,.92); border: 1px solid #ffd166; box-shadow: 0 4px 14px rgba(0,0,0,.7); z-index: 2; }',
    '.mapz .pick button { position: static; margin: 0; width: 34px; height: 34px; border-radius: 6px; border: 1px solid #4a535c; }',
    '.mapz .pick button img { width: 26px; height: 26px; }',
    '.mapz .hint { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,.7);',
    '  color: #fff; font: 600 11px/1.4 system-ui, sans-serif; white-space: nowrap; pointer-events: none; }',
  ].join('\n');
  var layer = null, btns = {}, lastSig = '';
  function host() { return document.querySelector('.s9x'); }
  function ensure() {
    var h = host(); if (!h) return null;
    if (!document.getElementById('mapz-css')) { var st = document.createElement('style'); st.id = 'mapz-css'; st.textContent = CSS; document.head.appendChild(st); }
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div'); layer.className = 'mapz'; layer.hidden = true;
      var hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Prizes the map shows are copied to the tracker · tap a ? to pick one';
      layer.appendChild(hint);
      h.appendChild(layer); btns = {};
    }
    return layer;
  }
  // the picker: one tap on a dungeon's button, one tap on the prize
  var CHOICES = [['greenpendant', 'pendant_green', 'Green pendant'], ['pendant', 'pendant_blue', 'Pendant'], ['crystal', 'crystal', 'Crystal'],
    ['redcrystal', 'crystal_red', 'Red crystal'], ['unknown', '', 'Not known']];
  var pick = null;
  function closePick() { if (pick) { pick.remove(); pick = null; } }
  function setPrize(k, name) {
    var M = tracker(); if (!M) return;
    if (M.setPrize) M.setPrize(k, name);
    setTimeout(paint, 150);
  }
  function openPick(k, b) {
    var was = pick && pick.__k; closePick();
    if (was === k) return;
    var M = tracker(); if (!M) return;
    pick = document.createElement('div'); pick.className = 'pick'; pick.__k = k;
    CHOICES.forEach(function (c) {
      var o = document.createElement('button'); o.type = 'button'; o.title = c[2];
      var src = c[1] && M.icons && M.icons[c[1]];
      if (src) { var im = new Image(); im.src = src; im.alt = ''; o.appendChild(im); } else o.textContent = '?';
      o.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setPrize(k, c[0]); closePick(); });
      ['pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) { o.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
      pick.appendChild(o);
    });
    pick.style.left = b.style.left; pick.style.top = (parseFloat(b.style.top) + 18) + 'px';
    layer.appendChild(pick);
  }
  function button(k) {
    if (btns[k]) return btns[k];
    var b = document.createElement('button'); b.type = 'button';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPick(k, b); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); openPick(k, b); });
    ['pointerdown', 'mousedown'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    layer.appendChild(b); btns[k] = b;
    return b;
  }

  // ── what the game draws on its map ────────────────────────────────────────
  var seen = {}, copied = {}, copiedFor = '';
  function gameSprites(r) {
    var out = [];
    for (var i = 0; i < 128; i++) {
      var o = 0x800 + i * 4, y = r[o + 1];
      if (y >= 0xE0 && y < 0xF8) continue;
      var hi = (r[0xA00 + (i >> 2)] >> ((i & 3) * 2)) & 3;
      if (!(hi & 2)) continue;                         // only the 16 x 16 ones: the prize pictures
      var ch = r[o + 2], at = r[o + 3];
      if (ch !== 0x64 && ch !== 0x60 && ch !== 0x62) continue;
      var x = r[o] | ((hi & 1) << 8); if (x >= 256) x -= 512;
      out.push({ x: x + 8, y: (y >= 0xF8 ? y - 256 : y) + 8, ch: ch, pal: (at >> 1) & 7 });
    }
    return out;
  }
  function kindOf(s) {
    if (s.ch === 0x64) return s.pal === 1 ? 'redcrystal' : 'crystal';
    return s.pal === 4 ? 'greenpendant' : 'pendant';
  }
  function copyFromGame(r, M, pts) {
    var game = M.game || '';
    if (game !== copiedFor) { copiedFor = game; copied = {}; seen = {}; }
    var spr = gameSprites(r), now = Date.now();
    spr.forEach(function (s) {
      var best = null, bd = 18;
      Object.keys(pts).forEach(function (k) { var p = pts[k], d = Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)); if (d < bd) { bd = d; best = k; } });
      if (!best) return;
      var kind = kindOf(s), o = seen[best];
      if (!o || o.kind !== kind || now - o.t > 3000) seen[best] = o = { kind: kind, n: 0, t: now };
      o.n++; o.t = now;
      var it = M.items || {};
      if (o.n >= 3 && copied[best] !== kind) {
        copied[best] = kind;
        if (it[best + 'Prize'] !== kind && M.setPrize) { M.setPrize(best, kind); setTimeout(paint, 200); }
      }
    });
  }
  function hide() { closePick(); if (layer && !layer.hidden) layer.hidden = true; }
  function paint() {
    var P = window.Snes9xPlayer, core = P && P.core, r;
    if (!on || !core) return hide();
    try { r = core.wram(); } catch (e) { return hide(); }
    if (!r || r.length < 0x10000 || r[0x10] !== 0x0E || r[0x11] !== 7 || r[0x200] !== 5 || r[0x1B]) return hide();
    var M = tracker(); if (!M) return hide();
    var rect = P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (!rect || !rect.w || !ensure()) return hide();
    var dark = !!(r[0x8A] & 0x40), it = M.items || {}, sx = rect.w / 256, sy = rect.h / 224, shown = {}, pts = {};
    layer.style.left = rect.x + 'px'; layer.style.top = rect.y + 'px'; layer.style.width = rect.w + 'px'; layer.style.height = rect.h + 'px';
    DGS.forEach(function (d) {
      var k = d[0];
      if ((d[1] === 'dw') !== dark) return;
      var at = M.dungeonAt(k); if (!at) return;
      var p = mapPoint(r, at.x, at.y); if (!p) return;
      pts[k] = p;
      var b = button(k); shown[k] = 1;
      // beside the dungeon (up and right), so the game's own marker stays visible
      b.style.left = ((p.x + 9) * sx) + 'px'; b.style.top = ((p.y - 9) * sy) + 'px';
      var pn = it[k + 'Prize'], ik = PRIZE_ICON[pn], src = ik && M.icons && M.icons[ik];
      var sig = (src || '?') + (it[k + 'PrizeObtained'] ? '+' : '');
      if (b.__sig !== sig) {
        b.__sig = sig; b.textContent = '';
        if (src) { var im = new Image(); im.src = src; im.alt = ''; b.appendChild(im); } else b.textContent = '?';
        b.classList.toggle('got', !!it[k + 'PrizeObtained']);
      }
      b.title = NAMES[k] + ': ' + (pn && pn !== 'unknown' ? pn.replace('green', 'green ').replace('red', 'red ') : 'prize not marked') + '\nTap: pick its prize';
    });
    Object.keys(btns).forEach(function (k) { btns[k].style.display = shown[k] ? '' : 'none'; });
    if (pick && !shown[pick.__k]) closePick();
    layer.hidden = false;
    try { copyFromGame(r, M, pts); } catch (e) {}
  }
  setInterval(paint, 100);

  // ⚙ Settings: on / off
  function addSetting() {
    var panel = document.getElementById('trk-settings');
    if (!panel || document.getElementById('map-prizes-on')) return !!panel;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'While the game’s world map is open: a button by each dungeon to mark its crystal or pendant on Mudora (click: next, right click: back)';
    lab.innerHTML = '<span>Prize marks on the game’s map</span>';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'map-prizes-on'; cb.checked = on;
    cb.addEventListener('change', function () { on = cb.checked; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} if (!on) hide(); });
    lab.appendChild(cb);
    var before = document.getElementById('seed-history-btn');
    panel.insertBefore(lab, before || null);
    return true;
  }
  if (!addSetting()) document.addEventListener('DOMContentLoaded', addSetting);
  window.RandoMapPrizes = { mapPoint: mapPoint, get on() { return on; }, _sprites: gameSprites, _kind: kindOf };
})();
