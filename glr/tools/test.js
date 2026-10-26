#!/usr/bin/env node
/*
 * tools/test.js — checks the randomizer against your base ROM.
 *   node tools/test.js path/to/Guardian_Legend_The_USA.nes [seeds=300]
 *
 * For every seed it re-reads the generated ROM's own tables (corridor keys,
 * item kinds), replays the labyrinth on the door graph, and checks the
 * title-screen patch, determinism and that nothing outside the known tables
 * changed. It also builds all 370 screens with the 6502 interpreter.
 */
const fs = require('fs');
const T = require('../js/tgl-data.js');
const G = require('../js/randomizer.js');
const LabMap = require('../js/labmap.js');

const base = fs.readFileSync(process.argv[2] || 'tgl.nes');
const N = +(process.argv[3] || 300);
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } };

ok(!T.checkBase(base), 'base ROM: ' + T.checkBase(base));

// Map: every screen builds with the game's own code.
const m = LabMap.read(base);
const tiles = m.buildAll();
const failed = m.rooms.filter((r) => !r.empty && m.tilesOf(r.x, r.y).failed);
ok(failed.length === 0, failed.length + ' screens failed to build');
ok(tiles.length === 576 * 192, 'tile buffer size');

// Vanilla game must pass the logic (sanity check of the model).
const ctx0 = G.context(base);
ok(G.simulate(ctx0, ctx0.keys, (l) => l.kind).ok, 'vanilla game fails the logic');

// Bytes the randomizer may touch.
const allowed = new Set();
for (let c = 1; c <= 10; c++) allowed.add(T.AT.keyTable + c);
for (const l of ctx0.locations) allowed.add(T.AT.itemKind + l.flag);
for (let i = 0; i < T.AT.bonusCount; i++) allowed.add(T.AT.bonus + i * 2 + 1);
allowed.add(T.AT.menuToggle); allowed.add(T.AT.menuToggle + 1);
for (let i = 0; i < 17; i++) allowed.add(T.AT.menuText + i);

const flagSets = ['K1I2B1', 'K1I1B0', 'K0I2B0', 'K1I0B0', 'K0I0B0'];
let n = 0;
const t0 = Date.now();
for (let s = 0; s < N; s++) {
  const flags = flagSets[s % flagSets.length];
  let out;
  try { out = G.generate(base, { seed: 'test' + s, flags }); } catch (e) { ok(false, 'seed ' + s + ' ' + flags + ': ' + e.message); continue; }
  const rom = out.rom;
  // Only known bytes changed
  for (let i = 0; i < rom.length; i++) if (rom[i] !== base[i] && !allowed.has(i)) { ok(false, 'seed ' + s + ' changed $' + i.toString(16)); break; }
  // Password option locked
  ok(rom[T.AT.menuToggle] === 0x29 && rom[T.AT.menuToggle + 1] === 0x00, 'menu patch');
  // Re-read the ROM and replay it
  const ctx = G.context(rom);
  const keyOf = ctx.keys;
  const sim = G.simulate(ctx, keyOf, (l) => l.kind);
  ok(sim.ok, 'seed ' + s + ' ' + flags + ' not beatable from its own ROM');
  // Keys: exactly 1-7, once each
  const ks = keyOf.slice(1).filter(Boolean).sort();
  ok(ks.join() === '1,2,3,4,5,6,7', 'seed ' + s + ' keys ' + ks);
  // Item pool preserved
  const a = ctx0.locations.map((l) => l.kind).sort().join(), b = ctx.locations.map((l) => l.kind).sort().join();
  ok(a === b, 'seed ' + s + ' item pool changed');
  // Deterministic
  if (s < 10) ok(Buffer.compare(Buffer.from(G.generate(base, { seed: 'test' + s, flags }).rom), Buffer.from(rom)) === 0, 'not deterministic');
  n++;
}
console.log(n + ' seeds in ' + (Date.now() - t0) + ' ms; ' + (fail ? fail + ' FAILURES' : 'all good'));
process.exit(fail ? 1 : 0);
