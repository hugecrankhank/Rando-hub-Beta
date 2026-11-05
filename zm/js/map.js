/*
 * map.js — the two worlds in the tracker: Hyrule's overworld, drawn from the
 * Zelda ROM being played (../z1r/js/owmap.js), and Zebes, drawn from Metroid's
 * own 32 x 32 map (../metroid/js/data.js MAP_CELLS), in the hub's shared map
 * viewer (../world-map.js): a pin on every spot of both worlds (a dungeon's
 * spots sit on its entrance), the portals ringed in purple, Link and Samus
 * where they are. ⧉ Map puts it in a window of its own (../game-popout.js).
 *
 *   ZMMap.init(el, { onToggle(i), names })   i: ZMGen.SPOTS index
 *   ZMMap.update({ have, items, liveHave, reach })
 *   ZMMap.live()                             every poll: the ROMs (to draw) and where Link and Samus are
 *   ZMMap.redraw()
 */
(function () {
  'use strict';
  const Z = window.ZM, M = window.M1, K = () => window.ZMLink;   // (link.js loads after this)
  const ZN = Z.SPOTS.length;
  // Hyrule: 16 x 8 screens of 256 x 176, drawn at a quarter (64 x 44 a screen); Zebes: 32 x 32 squares of 16
  const HW = 1024, HH = 352, SQ = 16, ZW = 32 * SQ, ZH = 32 * SQ;
  const AREA_FILL = ['#2a4a8a', '#8a3a2a', '#3a6a3a', '#6a3a7a', '#5a5a5a'], AREA_LINE = ['#6c94d8', '#e08a6a', '#78c078', '#c080d0', '#a0a0a0'];
  let viewer = null, names = null, ow = null, owRom = null, hyrule = null, zebes = null;

  // ── the pictures ─────────────────────────────────────────────────────────
  function screenXY(s, col, row) { return [(s & 15) * 64 + (col + 0.5) * 4, (s >> 4) * 44 + (row + 0.5) * 4]; }
  function ring(ctx, x, y, r, colour) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = colour; ctx.stroke(); }
  function drawHyrule() {
    if (!ow) return null;
    const cv = document.createElement('canvas'); cv.width = HW; cv.height = HH;
    const ctx = cv.getContext('2d');
    ow.drawMap(ctx, HW, HH, () => false);
    // the portals: the four "take any road" caves
    Z.PORTAL_SCREENS.forEach((s) => { const e = ow.entranceSquare(s), [x, y] = screenXY(s, e.col, e.row); ring(ctx, x, y, 9, '#c080ff'); ring(ctx, x, y, 5, '#c080ff'); });
    return cv;
  }
  function drawZebes() {
    const cv = document.createElement('canvas'); cv.width = ZW; cv.height = ZH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, ZW, ZH);
    M.MAP_CELLS.forEach((cells, a) => {
      ctx.fillStyle = AREA_FILL[a]; ctx.strokeStyle = AREA_LINE[a]; ctx.lineWidth = 1;
      cells.forEach((c) => { const x = (c >> 5) * SQ, y = (c & 31) * SQ; ctx.fillRect(x, y, SQ, SQ); ctx.strokeRect(x + 0.5, y + 0.5, SQ - 1, SQ - 1); });
    });
    // the portals: the elevator rooms
    M.ELEVATORS.forEach((e) => { const x = e[1] * SQ + SQ / 2, y = e[2] * SQ + SQ / 2; ring(ctx, x, y, 7, '#c080ff'); ring(ctx, x, y, 3, '#c080ff'); });
    // the area names
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#e6edf3'; ctx.textAlign = 'center';
    M.AREAS.forEach((n, a) => { const cells = M.MAP_CELLS[a]; if (!cells.length) return; let sx = 0, sy = 0; cells.forEach((c) => { sx += c >> 5; sy += c & 31; }); ctx.fillText(n, (sx / cells.length + 0.5) * SQ, (sy / cells.length + 0.5) * SQ + 4); });
    return cv;
  }

  // ── the pins ─────────────────────────────────────────────────────────────
  function hyrulePins() {
    const out = [];
    if (!ow) return out;
    const levelScreen = {};
    for (let s = 0; s < 128; s++) { const d = ow.screen(s).dest; if (d >= 1 && d <= 9 && levelScreen[d] === undefined) levelScreen[d] = s; }
    const caveScreen = (dest) => { for (let s = 0; s < 128; s++) if (ow.screen(s).dest === dest) return s; return Z.CAVE_SCREEN[dest]; };
    Z.SPOTS.forEach((sp, i) => {
      let s = null, col = null, row = null;
      if (sp[2] === 'room') s = levelScreen[sp[3][2]];
      else if (sp[2] === 'cave') s = caveScreen(sp[3]);
      else if (sp[2] === 'armos') { const a = ow.armosItem(); if (a) { s = a.s; col = a.col; row = a.row; } else s = Z.ARMOS_SCREEN; }
      else if (sp[2] === 'coast') { s = Z.COAST_SCREEN; col = 13; row = 5; }
      if (s === undefined || s === null) return;
      if (col === null) { const e = ow.entranceSquare(s); col = e.col; row = e.row; }
      const [x, y] = screenXY(s, col, row);
      out.push({ world: 0, x, y, i, boss: sp[2] === 'room' && sp[3][2] === 9 });
    });
    return out;
  }
  function zebesPins() {
    return M.SPOTS.map((s, k) => ({ world: 1, x: s[1] * SQ + ((s[3] & 15) + 0.5) * (SQ / 16), y: s[2] * SQ + ((s[3] >> 4) + 0.5) * (SQ / 15), i: ZN + k, boss: false }));
  }

  function build(host, opts) {
    if (viewer) { host.innerHTML = ''; }
    viewer = RHWorldMap.create(host, {
      key: 'zmr',
      worlds: [
        { name: 'Hyrule', width: HW, height: HH, picture: () => hyrule || (hyrule = drawHyrule()) },
        { name: 'Zebes', width: ZW, height: ZH, picture: () => zebes || (zebes = drawZebes()) },
      ],
      pins: hyrulePins().concat(zebesPins()),
      name: (i) => names(i),
      onToggle: opts.onToggle,
      empty: 'Start a seed: Hyrule is drawn from its ROM.',
    });
  }

  const ZMMap = {
    init(host, opts) {
      opts = opts || {};
      names = opts.names || ((i) => 'Spot ' + i);
      ZMMap._host = host; ZMMap._opts = opts;
      build(host, opts);
      return viewer;
    },
    update(s) { if (viewer) viewer.update(s); },
    redraw() { if (viewer) viewer.redraw(); },
    // every poll: draw Hyrule once its ROM is known; Link / Samus where they are
    live() {
      if (!viewer) return;
      const L = K(); if (!L) return;
      const rom = L.roms && L.roms.z1;
      if (rom && rom !== owRom && window.OwMap) {
        owRom = rom; ow = OwMap.read(rom); hyrule = null;
        build(ZMMap._host, ZMMap._opts);   // the dungeons' entrances come from this ROM
        viewer.update(ZMMap._last || { have: [], items: null, liveHave: () => false, reach: null });
      }
      const g = L.game, r = L.ram(g);
      if (!r || !L.inPlay(g)) { viewer.setPos(null); return; }
      if (g === 'z1') {
        const s = r[Z.RAM.ROOM], mode = r[Z.RAM.MODE], lvl = r[Z.RAM.LEVEL];
        if (lvl || s > 127) { viewer.setPos(null); return; }   // in a dungeon: the dot waits outside
        const x = (s & 15) * 64 + r[Z.RAM.LINK_X] / 4, y = (s >> 4) * 44 + Math.max(0, r[Z.RAM.LINK_Y] - 64) / 4;
        viewer.setPos({ world: 0, x, y, dim: mode !== 5 });
      } else {
        const mx = r[M.MEM.MAP_X], my = r[M.MEM.MAP_Y];
        if (mx > 31 || my > 31) { viewer.setPos(null); return; }
        viewer.setPos({ world: 1, x: mx * SQ + r[M.MEM.SX] / 16, y: my * SQ + r[M.MEM.SY] * SQ / 240, dim: false });
      }
    },
  };
  const upd = ZMMap.update; ZMMap.update = (s) => { ZMMap._last = s; upd(s); };
  window.ZMMap = ZMMap;
})();
