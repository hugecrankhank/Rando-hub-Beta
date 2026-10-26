/*
 * randomizer.js — The Guardian Legend randomizer (GLR).
 *
 *   const out = GLRandomizer.generate(baseRomBytes, { seed: '12345', flags: 'K1I2B1' });
 *   out.rom      Uint8Array, the randomized .nes
 *   out.spoiler  { keys, items, bonus, playthrough, ... }
 *   out.code     8-character seed code (also shown on the title screen)
 *
 * What it changes (see js/tgl-data.js for the ROM layout):
 *   K  keys:   which primary corridor (1-10) hands out which of the 7 keys
 *   I  items:  1 = shuffle the 34 labyrinth item rooms, 2 = also the 22 mini-boss drops
 *   B  bonus:  shuffle the items handed out on the "YOU GOT ITEM" screen after corridors
 * Always: the title screen's PASSWORD CONTINUE option is removed (the app
 * keeps your progress with save states instead).
 *
 * Logic: the labyrinth is a graph of screens; a door into a corridor gate,
 * shop, Blue Lander or message room needs that room's key symbol. Keys come
 * from clearing primary corridors; corridor 6 opens by firing a sub-weapon,
 * so one must be reachable first; corridor 4 opens after buying from a shop,
 * so a shop must be reachable; corridor 21 needs corridors 1-10. Leaving an
 * inner room into a normal room can need that room's key too. Every
 * seed is checked by playing it through on that graph.
 */
(function (root) {
  'use strict';
  const T = (typeof module !== 'undefined' && module.exports) ? require('./tgl-data.js') : root.TGL;

  const VERSION = '0.1.0';
  const DEFAULT_FLAGS = 'K1I2B1';

  function parseFlags(s) {
    const f = { keys: 1, items: 2, bonus: 1 };
    const str = String(s || DEFAULT_FLAGS).toUpperCase().replace(/\s+/g, '');
    const re = /([KIB])(\d)/g;
    let m, seen = 0;
    while ((m = re.exec(str))) {
      seen += m[0].length;
      const v = +m[2];
      if (m[1] === 'K') f.keys = Math.min(v, 1);
      if (m[1] === 'I') f.items = Math.min(v, 2);
      if (m[1] === 'B') f.bonus = Math.min(v, 1);
    }
    if (seen !== str.length) throw new Error('Unknown flags "' + s + '" (expected something like ' + DEFAULT_FLAGS + ')');
    return f;
  }
  const formatFlags = (f) => 'K' + f.keys + 'I' + f.items + 'B' + f.bonus;

  // sfc32 seeded from a string (FNV-1a mixes), deterministic everywhere.
  function rng(seedStr) {
    let h = 0x811c9dc5;
    const s = String(seedStr);
    const mix = () => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= h >>> 13; return h >>> 0; };
    let a = mix(), b = mix() ^ 0x9E3779B9, c = mix() ^ 0x243F6A88, d = mix() ^ 0xB7E15162;
    const next = () => {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 16; i++) next();
    return {
      next, int: (n) => Math.floor(next() * n),
      shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    };
  }

  function context(rom) {
    const rooms = T.parseRooms(rom);
    const E = T.edges(rooms);
    const corridorRoom = {};
    for (const r of rooms) if (r.type === 'corridor') corridorRoom[r.corridor] = r;
    const locations = rooms.filter((r) => r.type === 'item' || r.type === 'boss').map((r) => ({
      room: r, flag: r.flag, boss: r.type === 'boss', kind: rom[T.AT.itemKind + r.flag],
    }));
    const keys = [];
    for (let c = 0; c <= 10; c++) keys.push(rom[T.AT.keyTable + c]);
    const bonus = [];
    for (let i = 0; i < T.AT.bonusCount; i++) bonus.push({ at: rom[T.AT.bonus + i * 2], kind: rom[T.AT.bonus + i * 2 + 1] });
    return { rooms, E, corridorRoom, locations, keys, bonus };
  }

  // Play the seed through: returns spheres of what becomes available.
  function simulate(ctx, keyOf, kindAt) {
    const keys = new Set(), cleared = new Set(), spheres = [];
    let sub = null, reach;
    for (let guard = 0; guard < 40; guard++) {
      reach = T.reachable(ctx.rooms, ctx.E, keys);
      const sphere = { keys: [...keys].sort(), rooms: reach.size, corridors: [], items: [] };
      for (const loc of ctx.locations) {
        if (!reach.has(loc.room) || loc.seen) continue;
        loc.seen = true;
        sphere.items.push(loc);
        if (!sub && T.isWeapon(kindAt(loc))) sub = loc;
      }
      let progress = false;
      for (let c = 1; c <= 10; c++) {
        if (cleared.has(c)) continue;
        if (!reach.has(ctx.corridorRoom[c])) continue;
        if (c === 6 && !sub) continue;                       // fire a sub-weapon in the room
        if (c === 4 && !ctx.rooms.some((r) => r.type === 'shop' && reach.has(r))) continue;   // buy from a shop first
        cleared.add(c); progress = true;
        sphere.corridors.push(c);
        if (keyOf[c]) keys.add(keyOf[c]);
      }
      spheres.push(sphere);
      if (!progress) break;
    }
    for (const loc of ctx.locations) delete loc.seen;
    const final = T.reachable(ctx.rooms, ctx.E, keys);
    const ok = cleared.size === 10 && final.has(ctx.corridorRoom[21]) && final.size === ctx.rooms.filter((r) => !r.empty).length;
    return { ok, spheres, cleared, keys, firstSub: sub };
  }

  function generate(base, opts) {
    opts = opts || {};
    const err = T.checkBase(base);
    if (err) throw new Error('Base ROM: ' + err);
    const flags = parseFlags(opts.flags);
    const seed = opts.seed != null && String(opts.seed).trim() !== '' ? String(opts.seed).trim() : String(Math.floor(Math.random() * 1e9));
    const R = rng('GLR|' + VERSION + '|' + formatFlags(flags) + '|' + seed);
    const rom = new Uint8Array(base);
    const ctx = context(rom);

    let keyOf = ctx.keys.slice(), placed = ctx.locations.map((l) => l.kind), result = null;
    const pool = ctx.locations.map((l, i) => i).filter((i) => flags.items === 2 || !ctx.locations[i].boss);
    for (let attempt = 0; attempt < 5000; attempt++) {
      if (flags.keys) {
        keyOf = new Array(11).fill(0);
        const slots = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        for (let k = 1; k <= 7; k++) keyOf[slots[k - 1]] = k;
      }
      placed = ctx.locations.map((l) => l.kind);
      if (flags.items) {
        const kinds = R.shuffle(pool.map((i) => ctx.locations[i].kind));
        pool.forEach((i, j) => { placed[i] = kinds[j]; });
      }
      const idx = new Map(ctx.locations.map((l, i) => [l, i]));
      result = simulate(ctx, keyOf, (loc) => placed[idx.get(loc)]);
      if (result.ok) break;
      result = null;
    }
    if (!result) throw new Error('Could not place a beatable seed (try another seed number)');

    // ── write the ROM ──────────────────────────────────────────────────────
    for (let c = 1; c <= 10; c++) rom[T.AT.keyTable + c] = keyOf[c];
    ctx.locations.forEach((l, i) => { rom[T.AT.itemKind + l.flag] = placed[i]; });
    let bonus = ctx.bonus.map((b) => b.kind);
    if (flags.bonus) {
      bonus = R.shuffle(bonus.slice());
      bonus.forEach((k, i) => { rom[T.AT.bonus + i * 2 + 1] = k; });
    }
    // Title menu: lock the cursor on NEW GAME and replace the PASSWORD line.
    if (rom[T.AT.menuToggle] !== 0x49 || rom[T.AT.menuToggle + 1] !== 0x01) throw new Error('menu patch site moved');
    rom[T.AT.menuToggle] = 0x29; rom[T.AT.menuToggle + 1] = 0x00;     // EOR #$01 -> AND #$00
    const code = seedCode(rom);
    const text = ('GLR ' + code).padEnd(17, ' ').slice(0, 17);
    for (let i = 0; i < 17; i++) rom[T.AT.menuText + i] = text.charCodeAt(i);

    const name = (l) => T.KINDS[placed[ctx.locations.indexOf(l)]];
    const spoiler = {
      version: VERSION, seed, flags: formatFlags(flags), code,
      keys: Array.from({ length: 10 }, (_, i) => ({ corridor: i + 1, key: keyOf[i + 1] ? T.KEYS[keyOf[i + 1] - 1] : null, keyIndex: keyOf[i + 1] })),
      items: ctx.locations.map((l, i) => ({
        x: l.room.x, y: l.room.y, area: l.room.area, flag: l.flag, boss: l.boss,
        item: T.KINDS[placed[i]], kind: placed[i], vanilla: T.KINDS[l.kind],
      })),
      bonus: ctx.bonus.map((b, i) => ({ threshold: b.at, item: T.KINDS[bonus[i]] || ('#' + bonus[i]) })),
      playthrough: result.spheres.map((s, i) => ({
        step: i + 1, keys: s.keys.map((k) => T.KEYS[k - 1]), corridors: s.corridors,
        items: s.items.map((l) => name(l) + ' @ ' + l.room.x + ',' + l.room.y + (l.boss ? ' (mini-boss)' : '')),
      })),
    };
    return { rom, spoiler, code, seed, flags: formatFlags(flags), version: VERSION, text: spoilerText(spoiler) };
  }

  function seedCode(rom) {
    // Hash of the patched PRG (title text excluded): same seed+flags -> same code.
    const save = rom.slice(T.AT.menuText, T.AT.menuText + 17);
    rom.fill(0x20, T.AT.menuText, T.AT.menuText + 17);
    const h = T.crc32(rom, T.HEADER, rom.length);
    rom.set(save, T.AT.menuText);
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '', v = h;
    for (let i = 0; i < 6; i++) { s += A[v & 31]; v >>>= 5; }
    return s;
  }

  function spoilerText(sp) {
    const L = [];
    L.push('The Guardian Legend Randomizer ' + sp.version);
    L.push('Seed: ' + sp.seed + '   Flags: ' + sp.flags + '   Code: ' + sp.code, '');
    L.push('Corridor keys');
    for (const k of sp.keys) L.push('  Corridor ' + String(k.corridor).padStart(2) + ': ' + (k.key ? k.key + ' key (' + k.keyIndex + ')' : '-'));
    L.push('', 'Items (X,Y area)');
    for (const it of sp.items.slice().sort((a, b) => a.area - b.area || a.y - b.y || a.x - b.x))
      L.push('  ' + (it.x + ',' + it.y).padEnd(6) + ' area ' + String(it.area).padEnd(3) + (it.boss ? 'mini-boss ' : 'item room ') + it.item + (it.item !== it.vanilla ? '   (was ' + it.vanilla + ')' : ''));
    L.push('', 'Playthrough');
    for (const s of sp.playthrough) {
      L.push('  ' + s.step + '. keys: ' + (s.keys.join(', ') || 'none') + (s.corridors.length ? '   clear corridors ' + s.corridors.join(', ') : ''));
      for (const it of s.items) L.push('       ' + it);
    }
    L.push('', 'Corridor bonus items (in order)');
    L.push('  ' + sp.bonus.map((b) => b.item).join(', '));
    return L.join('\n');
  }

  const api = { VERSION, DEFAULT_FLAGS, parseFlags, formatFlags, generate, context, simulate, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GLRandomizer = api;
})(typeof self !== 'undefined' ? self : this);
