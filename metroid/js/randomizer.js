/*
 * randomizer.js — Rando Hub's own Metroid (NES) item randomizer. Every one of
 * the 38 power-up spots gets a new item: the type byte in the area's special
 * items table is rewritten (data.js SPOTS), and the game does the rest.
 *
 * Placement is an assumed fill with the rules in data.js (js/logic.js): the
 * items that open the way (Bombs, High Jump, Ice Beam, a first missile pack)
 * go in one at a time where they can be reached with everything else still
 * to come, then the rest fill in at random, and the whole seed is walked once
 * more to be sure every spot and both bosses can be reached. The same seed
 * number and settings give the same game.
 *
 * Options: startMaru — Samus begins with Maru Mari and its spot holds
 * something else (a patch in the new-game routine); otherwise Maru Mari stays
 * where it is, left of the start, since nearly everything needs it.
 *
 *   M1Rando.check(bytes, name)      → { error } | { warn } | { bytes }   (a Metroid ROM?)
 *   M1Rando.generate(bytes, opts)   → { rom, name, seed, hash, placed, spoiler, meta }
 */
(function () {
  'use strict';
  const D = window.M1, L = window.M1Logic;

  // ── the ROM ──────────────────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
  function isNes(b) { return b.length > 16 && b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A; }
  // Metroid (USA) dumped with or without its iNES header, whatever the header says: the standard file
  const HEADER = [0x4E, 0x45, 0x53, 0x1A, 0x08, 0x00, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  function normalize(bytes) {
    let body = isNes(bytes) ? bytes.subarray(16 + (bytes[6] & 4 ? 512 : 0)) : bytes;
    if (body.length !== 131072 || crc32(body) !== '70080810') return bytes;
    const o = new Uint8Array(16 + body.length); o.set(HEADER); o.set(body, 16); return o;
  }
  function check(bytes, name) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) return { error: 'That is a .zip file. Unzip it and pick the .nes inside.' };
    bytes = normalize(bytes);
    if (!isNes(bytes)) return { error: '"' + name + '" isn’t a .nes ROM (no iNES header).' };
    const out = new Uint8Array(bytes);
    out[6] |= 0x02;   // battery flag: the emulator then shows the cartridge RAM (Samus's gear and the taken items) to the tracker
    if (bytes.length !== D.ROM.size || crc32(bytes) !== D.ROM.crc32) return { warn: '"' + name + '" isn’t the usual ' + D.ROM.name + ' ROM (128 KB, CRC32 ' + D.ROM.crc32 + '). A seed from another randomizer or a hack plays fine; rolling a seed from it may not.', bytes: out };
    return { bytes: out };
  }
  function isBase(bytes) { return bytes.length === D.ROM.size && crc32(bytes) === D.ROM.crc32; }

  // ── a seeded random ──────────────────────────────────────────────────────
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  // ── placing ──────────────────────────────────────────────────────────────
  // returns at[i] = type per spot, or null if this try didn't work out
  function place(r, startMaru) {
    const N = D.SPOTS.length, at = new Array(N).fill(-1);
    const start = new Set(startMaru ? ['MM'] : []);
    let pool = D.SPOTS.map((s) => s[5]);
    if (startMaru) { pool = pool.filter((t) => t !== 4); pool.push(9); }   // Maru Mari out, one more missile pack in
    else { at[0] = 4; pool = pool.filter((t) => t !== 4); }                 // Maru Mari stays left of the start
    // the way-openers, placed first by assumed fill: Bombs, High Jump, both Ice Beams, one missile pack
    const prog = [];
    const takeOne = (t) => { const i = pool.indexOf(t); if (i >= 0) { pool.splice(i, 1); prog.push(t); } };
    takeOne(0); takeOne(1); takeOne(7); takeOne(7); takeOne(9);
    shuffle(prog, r);
    while (prog.length) {
      const t = prog.pop();
      const assumed = new Set(start); prog.forEach((p) => assumed.add(L.KEY[p]));
      const { inv, taken } = L.collect(assumed, at);
      const open = D.SPOTS.map((s, i) => i).filter((i) => at[i] < 0 && taken.has(i) && L.has(D.SPOTS[i][7], inv));
      if (!open.length) return null;
      at[open[Math.floor(r() * open.length)]] = t;
    }
    shuffle(pool, r);
    for (let i = 0; i < N; i++) if (at[i] < 0) at[i] = pool.pop();
    // the proof: from the start, taking what's there, everything is reached
    const { inv, taken } = L.collect(start, at);
    if (taken.size !== N) return null;
    if (!L.has(D.GOALS[2][1], inv)) return null;
    return at;
  }

  function generate(bytes, opts) {
    opts = opts || {};
    const seed = opts.seed > 0 ? Math.floor(opts.seed) : 1 + Math.floor(Math.random() * 999999);
    const startMaru = opts.startMaru !== false;
    const r = rng(seed * 2 + (startMaru ? 1 : 0));
    let at = null;
    for (let tries = 0; tries < 200 && !at; tries++) at = place(r, startMaru);
    if (!at) throw new Error('No placement found for seed ' + seed + '. Try another seed.');
    const rom = new Uint8Array(bytes);
    rom[6] |= 0x02;
    D.SPOTS.forEach((s, i) => { rom[s[4]] = at[i]; });
    if (startMaru) {
      // InitializeStats (bank 0, $9354: LDA #$02 / STA SwitchPending / RTS) → a stub at $BFE0 that also sets Maru Mari
      const o = 16 + (0x9354 - 0x8000), stub = 16 + (0xBFE0 - 0x8000);
      const want = [0xA9, 0x02, 0x85, 0x24, 0x60];
      if (want.every((b, k) => rom[o + k] === b)) {
        rom.set([0x4C, 0xE0, 0xBF, 0xEA, 0xEA], o);
        rom.set([0xA9, 0x10, 0x8D, 0x78, 0x68, 0xA9, 0x02, 0x85, 0x24, 0x60], stub);
      } else throw new Error('This ROM’s new-game code isn’t where Metroid (USA) keeps it: turn "Start with Maru Mari" off.');
    }
    const hash = crc32(rom).slice(0, 6).toUpperCase();
    const placed = D.SPOTS.map((s, i) => ({ area: D.AREAS[s[0]], name: s[6], item: D.ITEMS[at[i]], type: at[i], x: s[1], y: s[2] }));
    // the spheres, for the spoiler
    const spheres = [];
    { const inv = new Set(startMaru ? ['MM'] : []), done = new Set();
      for (let k = 0; k < 20; k++) {
        const v = L.collect(inv, null).inv;   // no taking: what's open with just inv
        const now = D.SPOTS.map((s, i) => i).filter((i) => !done.has(i) && L.has(D.SPOTS[i][7], v));
        if (!now.length) break;
        spheres.push(now); now.forEach((i) => { done.add(i); inv.add(L.KEY[at[i]]); });
      } }
    const name = 'Metroid_RH_' + seed + (startMaru ? '' : '_mm') + '_' + hash + '.nes';
    const meta = { seed: String(seed), hash, startMaru, generator: 'Rando Hub', made: Date.now() };
    return { rom, name, seed, hash, placed, spheres, meta };
  }

  function spoilerText(entry) {
    const m = entry.meta || {}, lines = ['Rando Hub Metroid (NES) randomizer', 'Seed ' + m.seed + '  ·  ' + (m.startMaru ? 'start with Maru Mari' : 'Maru Mari in place') + '  ·  ' + m.hash, 'File: ' + entry.name, ''];
    D.AREAS.forEach((a) => {
      const in_ = (entry.placed || []).filter((p) => p.area === a);
      if (!in_.length) return;
      lines.push('--- ' + a + ' ---');
      in_.forEach((p) => lines.push('  ' + p.name.padEnd(40) + p.item));
      lines.push('');
    });
    if (entry.spheres && entry.spheres.length) {
      lines.push('--- Spheres (what opens up, in order) ---');
      entry.spheres.forEach((sp, k) => { lines.push('  ' + (k + 1) + ': ' + sp.map((i) => D.AREAS[D.SPOTS[i][0]] + ' · ' + D.SPOTS[i][6] + ' = ' + (entry.placed[i] || {}).item).join('; ')); });
    }
    return lines.join('\n');
  }

  window.M1Rando = { check, isBase, normalize, crc32, generate, spoilerText };
})();
