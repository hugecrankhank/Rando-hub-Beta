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

  window.FFGame = {
    id: 'ff1', short: 'FF1', system: 'nes',
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
