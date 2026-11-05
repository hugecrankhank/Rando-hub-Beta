/*
 * map.js — the SMZ3 map in the tracker: the Light and Dark World (the hub's
 * Zelda 3 tracker's own map pictures, ../tracker/map/, with its check
 * positions) and Super Metroid's six areas, drawn from the SM half of the ROM
 * being played the way the game draws its pause map (as ../sm/js/map.js; the
 * combo keeps SM's banks interleaved: bank b at b * $10000 + $8000, banks $40+
 * at (b − $40) * $10000). A pin on every overworld location (the dungeons'
 * are on the tracker's dungeon cards) and every Metroid item (where it sits,
 * from the SM page's pins by collected bit), Link or Samus where they are, in the hub's shared map
 * viewer (../world-map.js). ⧉ Map puts it in a window of its own.
 *
 *   SMZ3Map.init(el, { onToggle(i), names, locs })   locs: the tracker's LOCS (index = pin i)
 *   SMZ3Map.update({ have, items, liveHave, reach })
 *   SMZ3Map.live(live, rom)                           every poll: the game's reading and the ROM
 *   SMZ3Map.redraw()
 */
(function () {
  'use strict';
  const S = window.SMR;   // the SM page's tables (its LOCATIONS and MAP_PINS)
  const ZW = 438, ZH = 442, MW = 512, MH = 256;
  const HUB = (document.currentScript && document.currentScript.getAttribute('data-hub')) || '../';
  const pct = (w, l, t) => ({ world: w === 'lw' ? 0 : 1, x: l / 100 * ZW, y: t / 100 * ZH });
  // Zelda's places on the tracker's maps (its own check and dungeon positions, in per cent)
  const DUN = { 'Castle Tower': pct('lw', 50, 52.6), 'Eastern Palace': pct('lw', 97, 40.5), 'Desert Palace': pct('lw', 7.6, 78.4), 'Tower of Hera': pct('lw', 57, 3),
    'Palace of Darkness': pct('dw', 96, 40), 'Swamp Palace': pct('dw', 47, 91), 'Skull Woods': pct('dw', 4.5, 6.2), "Thieves' Town": pct('dw', 12.8, 47.9),
    'Ice Palace': pct('dw', 79.6, 85.8), 'Misery Mire': pct('dw', 7.75, 82.5), 'Turtle Rock': pct('dw', 92.8, 7.2), "Ganon's Tower": pct('dw', 57, 2), 'Hyrule Castle': pct('lw', 50, 44.1) };
  const PLACES = [
    ['Ether Tablet', 'lw', 42, 3.4], ['Spectacle Rock Cave', 'lw', 48.6, 14.8], ['Spectacle Rock', 'lw', 50.8, 8.5], ['Old Man', 'lw', 41.6, 20.4], ['Floating Island', 'lw', 81.5, 1.8],
    ['Spiral Cave', 'lw', 76.8, 9.3], ['Paradox Cave Upper', 'lw', 84.3, 18.6], ['Paradox Cave Lower', 'lw', 84.3, 18.6], ['Mimic Cave', 'lw', 85.2, 9.3], ['Master Sword Pedestal', 'lw', 5, 3.4], ['Mushroom', 'lw', 12.4, 8.6],
    ['Lost Woods Hideout', 'lw', 18.8, 13], ['Lumberjack Tree', 'lw', 30.2, 7.6], ['Pegasus Rocks', 'lw', 39, 29.3], ['Graveyard Ledge', 'lw', 56.2, 27], ["King's Tomb", 'lw', 61.6, 29.6],
    ['Kakariko Well', 'lw', 3.4, 41], ["Blind's Hideout", 'lw', 13.4, 41], ['Bottle Merchant', 'lw', 9, 47.3], ['Chicken House', 'lw', 8.8, 54.2], ['Sick Kid', 'lw', 16.2, 51.1],
    ['Kakariko Tavern', 'lw', 16.2, 57.8], ['Magic Bat', 'lw', 32, 58], ['King Zora', 'lw', 96, 14], ["Zora's Ledge", 'lw', 95.4, 17.3], ['Waterfall Fairy', 'lw', 89.8, 15.2],
    ['Potion Shop', 'lw', 81.6, 32.5], ["Sahasrahla's Hut", 'lw', 81.4, 41.4], ['Sahasrahla', 'lw', 81.4, 45], ['Maze Race', 'lw', 3.6, 67], ['Library', 'lw', 15.4, 65.9],
    ['Flute Spot', 'lw', 28.8, 66.2], ['South of Grove', 'lw', 28.2, 84.1], ["Link's House", 'lw', 54.8, 67.9], ["Aginah's Cave", 'lw', 20, 83.6], ['Mini Moldorm Cave', 'lw', 65.2, 93.4],
    ['Desert Ledge', 'lw', 3.6, 91], ['Checkerboard Cave', 'lw', 18.6, 77.3], ['Bombos Tablet', 'lw', 22, 92.2], ['Floodgate Chest', 'lw', 46.8, 93.4], ['Sunken Treasure', 'lw', 45, 93.4],
    ['Lake Hylia Island', 'lw', 72.2, 82.9], ['Hobo', 'lw', 70.8, 69.7], ['Ice Rod Cave', 'lw', 90.9, 76.9], ['Sanctuary', 'lw', 46.2, 27], ['Sewers - Secret Room', 'lw', 53.6, 32.4],
    ['Sewers - Dark Cross', 'lw', 51.2, 38.2], ['Hyrule Castle', 'lw', 50, 44.1], ["Link's Uncle", 'lw', 59.6, 41.8], ['Secret Passage', 'lw', 59.6, 41.8],
    ['Spike Cave', 'dw', 57.2, 13], ['Hookshot Cave', 'dw', 83.2, 7.5], ['Superbunny Cave', 'dw', 82.6, 15.7], ['Bumper Cave', 'dw', 34.2, 15.2], ['Chest Game', 'dw', 4.2, 46.4],
    ['C-Shaped House', 'dw', 19.7, 47.9], ['Brewery', 'dw', 10.8, 57.8], ['Hammer Pegs', 'dw', 31.6, 59.1], ['Blacksmith', 'lw', 30.4, 51.8], ['Purple Chest', 'dw', 30.4, 52.2],
    ['Catfish', 'dw', 90.5, 17.2], ['Pyramid Fairy', 'dw', 47, 48.5], ['Pyramid', 'dw', 58, 43.5], ['Digging Game', 'dw', 5.8, 69.2], ['Stumpy', 'dw', 31, 68.6], ['Hype Cave', 'dw', 60, 77.1], ['Mire Shed', 'dw', 3.4, 79.5],
  ];
  function zeldaPlace(loc) {
    if (DUN[loc.region] && loc.region !== 'Hyrule Castle') return null;   // a dungeon's checks are on its card, not the map
    const p = PLACES.find(([n]) => loc.name === n || loc.name.indexOf(n + ' - ') === 0);
    return p ? pct(p[1], p[2], p[3]) : DUN[loc.region] || null;
  }
  // Metroid's: the SM page's pins, by collected bit
  const smPin = (() => {
    const by = {};
    if (S && S.LOCATIONS && S.MAP_PINS) S.LOCATIONS.forEach((l, k) => { if (by[l[2]] === undefined && S.MAP_PINS[k]) by[l[2]] = S.MAP_PINS[k]; });
    return (mem) => { if (!mem || mem[0] !== 'sm') return null; let bit = 0; for (let m = mem[2]; m > 1; m >>= 1) bit++; const p = by[mem[1] * 8 + bit]; return p ? { world: 2 + p[0], x: p[1], y: p[2], boss: !!p[3] } : null; };
  })();

  // ── the pictures ─────────────────────────────────────────────────────────
  const imgs = {};
  function zeldaPicture(k, onLoad) {
    if (imgs[k]) return imgs[k].complete && imgs[k].naturalWidth ? imgs[k] : null;
    const im = new Image(); im.src = HUB + 'tracker/map/map_' + k + '.png'; imgs[k] = im;
    im.onload = onLoad;
    return null;
  }
  const smPc = (o) => { const b = o >> 15, off = o & 0x7FFF; return b < 0x40 ? b * 0x10000 + 0x8000 + off : (b - 0x40) * 0x10000 + off; };
  const SLOT = [1, 0, 2, 3, 4, 5], TILEMAP = 0x1A8000, GFX = 0x1B0000, BLANK = 0x1F;
  const COLORS = [[0, 0, 0, 0], [0x1d, 0x2b, 0x45, 255], [0xa9, 0xbd, 0xdf, 255], [0xff, 0xd1, 0x66, 255]];
  let rom = null, pics = {};
  function smPicture(a) {
    if (!rom) return null;
    if (pics[a]) return pics[a];
    const c = document.createElement('canvas'); c.width = MW; c.height = MH;
    const g = c.getContext('2d'), id = g.createImageData(MW, MH), px = id.data, tm = smPc(TILEMAP + SLOT[a] * 0x1000);
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (let i = 0; i < 0x800; i++) {
      const e = rom[tm + i * 2] | rom[tm + i * 2 + 1] << 8, t = e & 0x3FF;
      if (t === BLANK) continue;
      const scr = i >> 10, tX = ((scr << 5) + (i & 31)) * 8, tY = ((i & 1023) >> 5) * 8, hf = e & 0x4000, vf = e & 0x8000, o = smPc(GFX + t * 32);
      if (tX < x0) x0 = tX; if (tY < y0) y0 = tY; if (tX + 8 > x1) x1 = tX + 8; if (tY + 8 > y1) y1 = tY + 8;
      for (let y = 0; y < 8; y++) {
        const b0 = rom[o + y * 2], b1 = rom[o + y * 2 + 1], b2 = rom[o + 16 + y * 2], b3 = rom[o + 17 + y * 2];
        for (let x = 0; x < 8; x++) {
          const s = 7 - x, v = ((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3;
          if (!v) continue;
          const col = COLORS[v] || COLORS[2], p = ((tY + (vf ? 7 - y : y)) * MW + tX + (hf ? 7 - x : x)) * 4;
          px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = col[3];
        }
      }
    }
    g.putImageData(id, 0, 0);
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = MW; y1 = MH; }
    c.box = [x0, y0, x1, y1];
    return (pics[a] = c);
  }

  let viewer = null, names = null, locs = null, last = null;
  const AREAS = ['Crateria', 'Brinstar', 'Norfair', 'Wrecked Ship', 'Maridia', 'Tourian'];
  const SMZ3Map = {
    init(host, opts) {
      opts = opts || {}; names = opts.names || ((i) => 'Location ' + i); locs = opts.locs || [];
      const pins = [];
      locs.forEach((l, i) => {
        const p = l.z3 ? zeldaPlace(l) : smPin(l.mem);
        if (p) pins.push({ world: p.world, x: p.x, y: p.y, i, boss: !!p.boss || /Knights$|Lanmolas$|Moldorm$|Helmasaur King$|Arrghus$|Mothula$|Blind$|Kholdstare$|Vitreous$|Trinexx$/.test(l.name) });
      });
      const onLoad = () => { if (viewer) viewer.repaint(); };
      viewer = RHWorldMap.create(host, {
        key: 'smz3r',
        worlds: [{ name: 'Light', width: ZW, height: ZH, picture: () => zeldaPicture('lw', onLoad) }, { name: 'Dark', width: ZW, height: ZH, picture: () => zeldaPicture('dw', onLoad) }]
          .concat(AREAS.map((n, a) => ({ name: n, width: MW, height: MH, picture: () => smPicture(a) }))),
        pins, name: (i) => names(i), onToggle: opts.onToggle,
        empty: 'Zebes is drawn from the ROM being played: start a seed.',
      });
      return viewer;
    },
    update(s) { last = s; if (viewer) viewer.update(s); },
    redraw() { if (viewer) viewer.redraw(); },
    // every poll: the ROM (Zebes is drawn from it) and where Link or Samus is
    live(l, r) {
      if (!viewer) return;
      if (r && r.length >= 0x600000 && r !== rom) { rom = r; pics = {}; viewer.repaint(); }
      if (!l || !l.started) { viewer.setPos(null); return; }
      const w = l.wram; if (!w) { viewer.setPos(null); return; }
      if (l.game === 'z3') {
        const indoors = w[0x1B] !== 0, dark = !!(w[0x8A] & 0x40);
        const x = (w[0x22] | w[0x23] << 8) / 4096 * ZW, y = (w[0x20] | w[0x21] << 8) / 4096 * ZH;
        viewer.setPos({ world: dark ? 1 : 0, x, y, dim: indoors });
      } else if (l.game === 'sm' && rom) {
        const room = w[0x79B] | w[0x79C] << 8;
        if (room < 0x91F8) { viewer.setPos(null); return; }
        const h = smPc(0x78000 + (room - 0x8000)), a = rom[h + 1];
        if (a > 5) { viewer.setPos(null); return; }
        viewer.setPos({ world: 2 + a, x: rom[h + 2] * 8 + (w[0xAF6] | w[0xAF7] << 8) / 32, y: (rom[h + 3] + 1) * 8 + (w[0xAFA] | w[0xAFB] << 8) / 32, dim: false });
      } else viewer.setPos(null);
    },
  };
  window.SMZ3Map = SMZ3Map;
})();
