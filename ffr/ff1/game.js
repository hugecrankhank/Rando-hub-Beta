/*
 * game.js — Final Fantasy Randomizer (FF1, NES): what the tracker shows and
 * where it reads it. Seeds come from finalfantasyrandomizer.com (it generates
 * in your browser); the ROM is played here on the hub's FCEUmm.
 *
 * Memory: FF1 keeps the party's game state in the cartridge's battery RAM
 * ($6000-$63FF, "unsram" in the randomizer's own symbols), which the core
 * exposes as sram(). Key items are one byte each at $6020 + id (FF1Lib
 * Items.cs / Assembly/Symbols.cs): Lute $6021 … Canoe $6031, then the four
 * orbs $6032-$6035 (Fire, Water, Air, Earth; in Shard Hunt the Earth slot
 * counts shards). Vehicles: ship $6000, airship $6004, bridge $6008, canal $600C.
 * Gold: three bytes at $601C.
 */
(function () {
  'use strict';
  const sr = (m, a) => (m.sram && m.sram.length > a ? m.sram[a] : 0);
  const KEY = ['Lute', 'Crown', 'Crystal', 'Herb', 'Key', 'TNT', 'Adamant', 'Slab', 'Ruby', 'Rod', 'Floater', 'Chime', 'Tail', 'Cube', 'Bottle', 'Oxyale', 'Canoe'];
  const ORBS = [['Fire', '#ff7a3a'], ['Water', '#4aa8ff'], ['Air', '#d8f0ff'], ['Earth', '#b8863a']];
  const VEH = [['Ship', 0x00], ['Airship', 0x04], ['Bridge', 0x08], ['Canal', 0x0C]];

  // ── the world map (common/map.js) ────────────────────────────────────────
  // From the ROM (Final Fantasy, NES; FF1R keeps these tables where they are,
  // though it may move the towns and dungeons around): the 256 x 256 world in
  // run-length rows (pointers at bank 1 $8000), the 2 x 2-tile squares
  // ($8100), their palette numbers ($8300) and the world palette ($8380) in
  // bank 0, the tiles in bank 2. A square whose properties ($8000) say
  // "entrance n" is where place n is, so the pins follow a shuffled map.
  // The party: $2D bit 0 clear = on the world map, square ($27 + 7, $28 + 7).
  const PLACE = ['Cardia', 'Coneria', 'Pravoka', 'Elfland', 'Melmond', 'Crescent Lake', 'Gaia', 'Onrac', 'Lefein', 'Coneria Castle', 'Elfland Castle', 'Northwest Castle', 'Castle of Ordeals',
    'Temple of Fiends', 'Earth Cave', 'Gurgu Volcano', 'Ice Cave', 'Cardia', "Bahamut's Cave", 'Waterfall', 'Dwarf Cave', "Matoya's Cave", "Sarda's Cave", 'Marsh Cave', 'Mirage Tower',
    "Titan's Tunnel", "Titan's Tunnel", 'Cardia', 'Cardia', 'Cardia'];
  const prg = (bank, addr) => bank * 0x4000 + (addr - 0x8000);
  function worldRows(r) {
    return FFMapGfx.rows(256, (y) => prg(1, r[prg(1, 0x8000) + y * 2] | r[prg(1, 0x8000) + y * 2 + 1] << 8), 256, (s, put) => {
      const b = r[s];
      if (b === 0xFF) { for (let k = 0; k < 256; k++) put(0); return s + 1; }
      if (b & 0x80) { const n = r[s + 1] || 256; for (let k = 0; k < n; k++) put(b & 0x7F); return s + 2; }
      put(b); return s + 1;
    });
  }
  function drawWorld(r) {
    const G = FFMapGfx;
    const ts = G.interlace(G.interlace(r.subarray(prg(0, 0x8100), prg(0, 0x8300)), 1, 4, 128), 2, 16, 2);
    const raw = r.subarray(prg(0, 0x8300), prg(0, 0x8380)), pa = new Uint8Array(512);
    for (let i = 0; i < 512; i++) pa[i] = (raw[i >> 2] >> ((i & 3) * 2)) & 3;
    const pas = G.interlace(pa, 2, 16, 2), pal = r.subarray(prg(0, 0x8380), prg(0, 0x83A0)), chr = r.subarray(prg(2, 0x8000), prg(2, 0x9000));
    const cols = Array.from(pal, (c) => G.nesColor(c));
    return G.drawWorld(256, worldRows(r), (t) => ((t & 0x70) << 2) | ((t & 0x0F) << 1), ts, G.nes2(chr), (k, v) => cols[v ? pas[k] * 4 + v : 0]);
  }
  // the places, from the ROM's entrance squares when there is one (the first square of each), else FF1's own map
  const HOME = [[92, 48], [152, 160], [210, 149], [134, 221], [81, 159], [219, 216], [222, 27], [61, 57], [235, 98], [152, 159], [135, 221], [102, 186], [129, 45], [129, 123], [65, 186], [188, 203], [197, 183],
    [79, 49], [96, 51], [54, 29], [100, 155], [168, 117], [30, 190], [102, 236], [194, 58], [42, 174], [30, 175], [93, 58], [105, 59], [116, 66]];
  const places = HOME.map((h, n) => ({ world: 0, x: h[0], y: h[1], name: PLACE[n], n })).filter((p) => [17, 27, 28, 29].indexOf(p.n) < 0);   // Cardia's six islands: one pin
  let placed = null;
  function placesFromRom(r) {
    if (placed) return;
    placed = true;
    try {
      const rows = worldRows(r), props = r.subarray(prg(0, 0x8000), prg(0, 0x8100)), first = {};
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const t = rows[y][x] & 0x7F, p = props[t * 2 + 1]; if ((p >> 6) === 2) { const n = p & 0x3F; if (!first[n]) first[n] = [x, y]; } }
      places.forEach((pl) => { if (first[pl.n]) { pl.x = first[pl.n][0]; pl.y = first[pl.n][1]; } });
    } catch (e) {}
  }
  const MAP = {
    worlds: [{ name: 'World', size: 256, draw: (r) => { placesFromRom(r); return drawWorld(r); } }],
    places,
    pos(m) { const w = m.wram; if (w[0x2D] & 1) return null; return { world: 0, x: (w[0x27] + 7) & 0xFF, y: (w[0x28] + 7) & 0xFF }; },
  };

  window.FFGame = {
    id: 'ff1', short: 'FF1', system: 'nes', map: MAP,
    name: 'Final Fantasy Randomizer',
    generator: { name: 'Final Fantasy Randomizer', url: 'https://finalfantasyrandomizer.com/',
      steps: ['Open the site, pick a preset or flags and your <b>Final Fantasy (USA)</b> NES ROM (it never leaves your browser there either).',
        'Generate, and download the randomized ROM.', 'Back here: <b>Play ROM file</b> and choose that ROM. The tracker follows the game.'] },
    checkRom(bytes, name) {
      const ines = bytes[0] === 0x4E && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1A;
      if (!ines) return { warn: '"' + name + '" doesn’t look like an NES ROM (.nes).' };
      return null;
    },
    tabs: [['items', 'Items']],
    sections: [
      { id: 'key', title: 'Key items', tab: 'items', kind: 'grid', cls: 'keys', cellCls: 'key',
        items: KEY.map((n, i) => ({ name: n, read: (m) => sr(m, 0x21 + i) !== 0 })) },
      { id: 'orbs', title: 'Orbs', tab: 'items', kind: 'grid', cls: 'orbs',
        items: ORBS.map((o, i) => ({ name: o[0], color: o[1], read: (m) => sr(m, 0x32 + i) !== 0 })) },
      { id: 'veh', title: 'Vehicles', tab: 'items', kind: 'grid', cls: 'veh',
        items: VEH.map((v) => ({ name: v[0], read: (m) => sr(m, v[1]) !== 0 })) },
    ],
    stats(m, s) {
      const out = [
        { ico: '🗝', n: s.key.filter(Boolean).length, of: KEY.length, title: 'Key items' },
        { ico: '●', n: s.orbs.filter(Boolean).length, of: 4, title: 'Orbs lit' },
      ];
      if (m) {
        const gold = sr(m, 0x1C) | (sr(m, 0x1D) << 8) | (sr(m, 0x1E) << 16);
        out.push({ ico: 'G', n: gold.toLocaleString(), title: 'Gold' });
        const shards = sr(m, 0x35);
        if (shards > 1) out.push({ ico: '◆', n: shards, title: 'Shards (Shard Hunt)' });
      }
      return out;
    },
    started(m) { for (let i = 0; i < 0x40; i++) if (sr(m, i)) return true; return false; },
    signature(m) { return [sr(m, 0x1C), sr(m, 0x1D), sr(m, 0x1E), sr(m, 0x35)].join(','); },
  };
})();
