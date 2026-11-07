/*
 * gen.js — M1SM: Metroid and Super Metroid in one seed, Rando Hub's own. One
 * item pool across both Zebes: a DASH Super Metroid seed (../sm/gen/dash-core.js,
 * the Super Metroid page's generator, its own logic graph) and a Metroid
 * placement (the hub's Metroid rules, ../metroid/js/logic.js), then items
 * traded between the two games, each trade kept only if the whole run is
 * still beatable: a solver walks both games together (DASH's graph and its
 * loadout checks for Super Metroid, Metroid's rules for Metroid), picking up
 * what each spot holds wherever it belongs.
 *
 * The portal: Crateria's Map Station (past the Parlor's top right door and
 * the Pre-Map Flyway, open from the start) is the way to Metroid's Zebes. Back:
 * ⇄ / P anywhere, or (an option) only in one of Metroid's elevator rooms.
 *
 * Items cross between the games:
 *   a Metroid item in Super Metroid is a missile pack there (that spot's own
 *     kind: visible, Chozo or hidden): the page sees the spot's collected bit
 *     ($7E:D870..) and hands Samus in Metroid the real item;
 *   a Super Metroid item on a Metroid spot is a missile pack there (as the
 *     Zelda 1 + Metroid page does): picked up, it goes into Super Metroid's
 *     save (js/give.js).
 *
 *   M1SMGen.generate({ sm, m1, seed, preset, settings, options, mix, goal, exits }) → Promise<{ seed, rom, m1, at, sent, spoiler, meta }>
 *     at[i]: what's on Metroid spot i, ZMGen.SPOTS order (Zelda 1's spots first, unused): { game: 'm1', type } | { game: 'sm', type, name }
 *     sent: [{ bit, type, name, spot }]   the Metroid items in Super Metroid: the spot's collected bit
 */
import * as D from '../../sm/gen/dash-core.js';
import { GIVEABLE } from './give.js';

D.setPatchBase(new URL('../../sm/gen/patches/', import.meta.url).href);   // (DASH's base patches, the Super Metroid page's)
const M = () => window.M1, L = () => window.M1Logic, ZG = () => window.ZMGen, Z = () => window.ZM;

export const MIX = [['some', 'Some: about a dozen items change games'], ['lots', 'Lots: about twenty-five'], ['most', 'Most: as many as the logic allows']];
export const GOALS = [['both', 'Both Mother Brains (Super Metroid’s and Metroid’s)'], ['sm', 'Super Metroid’s Mother Brain'], ['m1', 'Metroid’s Mother Brain']];
export const EXITS = [['anywhere', '⇄ anywhere (or P)'], ['exits', 'Only in one of Metroid’s elevator rooms']];
export const PORTAL = { name: 'Crateria’s Map Station', room: 0x9994, how: 'through the Parlor’s top right door and the Pre-Map Flyway' };

function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── Metroid: a placement of its own first (the Zelda 1 + Metroid page's way: Samus starts with Maru Mari) ──
function m1Keys(start, add) { const v = new Set(start); add.forEach((k) => v.add(k)); return v; }
function m1With(inv) { const Mm = M(), Lg = L(); if (Lg.has(Mm.GOALS[0][1], inv) && Lg.has(Mm.GOALS[1][1], inv)) inv.add('ST'); return inv; }
function placeMetroid(r) {
  const Mm = M(), Lg = L(), N = Mm.SPOTS.length;
  for (let t = 0; t < 200; t++) {
    const at = new Array(N).fill(-1);
    let pool = Mm.SPOTS.map((s) => s[5]).filter((x) => x !== 4); pool.push(9);   // (Maru Mari from the start: its spot holds missiles)
    const prog = [];
    [0, 1, 7, 7, 9].forEach((ty) => { const i = pool.indexOf(ty); if (i >= 0) prog.push(pool.splice(i, 1)[0]); });
    shuffle(prog, r);
    let ok = true;
    while (prog.length && ok) {
      const it = prog.pop();
      const inv = m1Keys(['MM'], prog.map((p) => Lg.KEY[p]));
      // reachable now, taking what's placed
      let changed = true; const taken = new Set();
      while (changed) { changed = false; m1With(inv); Mm.SPOTS.forEach((s, i) => { if (taken.has(i) || !Lg.has(s[7], inv)) return; taken.add(i); if (at[i] >= 0 && !inv.has(Lg.KEY[at[i]])) { inv.add(Lg.KEY[at[i]]); changed = true; } }); }
      const open = Mm.SPOTS.map((s, i) => i).filter((i) => at[i] < 0 && taken.has(i));
      if (!open.length) { ok = false; break; }
      at[open[Math.floor(r() * open.length)]] = it;
    }
    if (!ok) continue;
    shuffle(pool, r);
    for (let i = 0; i < N; i++) if (at[i] < 0) at[i] = pool.pop();
    return at;
  }
  throw new Error('no Metroid placement');
}

// ── the two games together: can everything be reached? ─────────────────────
// smAt: Map(vertex → { g: 'sm', item } | { g: 'm1', type }); m1At[k]: { g: 'm1', type } | { g: 'sm', item }
function solve(graph, smAt, m1At, goal) {
  const Mm = M(), Lg = L();
  const start = graph[0].from;
  const fwd = new Map(), rev = new Map();
  graph.forEach((e) => { (fwd.get(e.from) || fwd.set(e.from, []).get(e.from)).push(e); (rev.get(e.to) || rev.set(e.to, []).get(e.to)).push(e); });
  const flood = (adj, other, test) => {
    const memo = new Map(), open = (c) => { if (c === true) return true; let r = memo.get(c); if (r === undefined) { try { r = !!test(c); } catch (x) { r = false; } memo.set(c, r); } return r; };
    const seen = new Set([start]), q = [start];
    for (let i = 0; i < q.length; i++) (adj.get(q[i]) || []).forEach((e) => { const v = other(e); if (!seen.has(v) && open(e.condition)) { seen.add(v); q.push(v); } });
    return seen;
  };
  const bossVerts = [], seenV = new Set();
  graph.forEach((e) => { const v = e.from; if (!seenV.has(v)) { seenV.add(v); if (v.type === 'boss' && v.item) bossVerts.push(v); } });
  let samus = D.createLoadout();
  const keys = new Set(['MM']), got = new Set(), m1Got = new Set();
  const take = (it) => { if (it.g === 'sm') D.addItem(samus, it.item.type); else keys.add(Lg.KEY[it.type]); };
  for (let round = 0; round < 400; round++) {
    let progress = false;
    const test = D.checkFlags(samus);
    const there = flood(fwd, (e) => e.to, test), back = flood(rev, (e) => e.from, test);
    // Super Metroid's spots and bosses she can reach and come back from
    const pending = [];
    smAt.forEach((it, v) => { if (!got.has(v) && there.has(v)) pending.push([v, it]); });
    bossVerts.forEach((v) => { if (!got.has(v) && there.has(v)) pending.push([v, { g: 'sm', item: v.item }]); });
    for (const [v, it] of pending) {
      if (back.has(v)) { got.add(v); take(it); progress = true; continue; }
    }
    if (!progress) {
      // one that opens its own way back (DASH's "safe item")
      for (const [v, it] of pending) {
        if (it.g !== 'sm') continue;
        const trial = { ...samus }; D.addItem(trial, it.item.type);
        if (flood(rev, (e) => e.from, D.checkFlags(trial)).has(v)) { got.add(v); samus = trial; progress = true; break; }
      }
    }
    // Metroid (its portal is open from the start)
    m1With(keys);
    Mm.SPOTS.forEach((s, k) => { if (m1Got.has(k) || !Lg.has(s[7], keys)) return; m1Got.add(k); take(m1At[k]); progress = true; });
    if (!progress) break;
  }
  m1With(keys);
  const allSm = Array.from(smAt.keys()).every((v) => got.has(v)) && bossVerts.every((v) => got.has(v));
  const allM1 = m1Got.size === Mm.SPOTS.length;
  const m1Goal = Lg.has(Mm.GOALS[2][1], keys);
  return allSm && allM1 && m1Goal;
}

// ── the seed ───────────────────────────────────────────────────────────────
export async function generate(o) {
  const Mm = M(), ZGm = ZG(), ZN = Z().SPOTS.length;
  const t0 = Date.now();
  const seed = D.getSeedNumber(o.seed ? Number(o.seed) : undefined);
  const r = rng(seed * 7 + 3);
  const graph = D.generateSeed(seed, o.settings, o.options);
  // Super Metroid's item spots
  const smAt = new Map(), verts = [];
  graph.forEach((e) => { const v = e.from; if ((v.type === 'major' || v.type === 'minor') && v.item && !smAt.has(v)) { smAt.set(v, { g: 'sm', item: v.item }); verts.push(v); } });
  const m1Types = placeMetroid(r);
  const m1At = m1Types.map((t) => ({ g: 'm1', type: t }));
  if (!solve(graph, smAt, m1At, o.goal)) throw new Error('that DASH seed doesn’t solve here: try another');
  // trades: an SM spot's item for a Metroid spot's, kept when the whole run still solves
  const want = { some: 12, lots: 25, most: 60 }[o.mix] || 12;
  let done = 0;
  const canGive = (it) => it.g !== 'sm' || GIVEABLE.has(it.item.type);
  for (let tries = 0; tries < want * 6 && done < want; tries++) {
    const v = verts[Math.floor(r() * verts.length)], k = Math.floor(r() * Mm.SPOTS.length);
    const a = smAt.get(v), b = m1At[k];
    if (a.g === 'm1' || b.g === 'sm') continue;   // (each spot trades once)
    if (!canGive(a)) continue;
    // keep it interesting: at least one of the two opens a way
    const prog = (a.item.isMajor || a.item.type !== D.Item.Missile) || [0, 1, 7].indexOf(b.type) >= 0;
    if (!prog && r() < 0.6) continue;
    smAt.set(v, b); m1At[k] = a;
    if (solve(graph, smAt, m1At, o.goal)) done++;
    else { smAt.set(v, a); m1At[k] = b; }
  }

  // the Super Metroid ROM: a missile pack where a Metroid item is (the spot's own kind)
  const missile = verts.map((v) => v.item).find((it) => it.type === D.Item.Missile);
  const sentVerts = [];
  smAt.forEach((it, v) => { if (it.g === 'm1') { sentVerts.push([v, it]); v.item = missile; } });
  const res = await D.randomizeRom(seed, o.settings, o.options, { vanillaBytes: o.sm, presetName: o.preset || 'Custom' }, false, graph);
  const rom = res.data;
  // the collected bit of each spot a Metroid item is in (the item PLM's argument)
  const LOCS = D.getLocations();
  const sent = sentVerts.map(([v, it]) => {
    const l = LOCS.find((x) => x.name === v.name && x.area === D.getArea(v.area));
    return { bit: rom[l.address + 4], type: it.type, name: Mm.ITEMS[it.type], spot: v.name };
  });
  // the Super Metroid tracker's spoiler (its Reveal): what's really there, Metroid's items by name
  sentVerts.forEach(([v, it]) => { v.item = { name: Mm.ITEMS[it.type] + ' (Metroid)', type: -1, isMajor: true }; });
  let smSpoiler = {}, smPlaced = [];
  try { smSpoiler = { Bosses: D.graphBosses(graph), 'Area Transitions': D.graphAreaTransitions(graph), Items: D.graphItems(graph) }; smPlaced = D.graphPlaced(graph); } catch (e) { console.warn('[m1sm] spoiler', e); }

  // the Metroid ROM: its spots in ZMGen's order (Zelda 1's first, unused here)
  const at = new Array(ZN).fill(null).concat(m1At.map((it) => (it.g === 'm1' ? { game: 'm1', type: it.type } : { game: 'sm', type: it.item.type, name: it.item.name })));
  const zn = ZGm.normalize(o.m1);
  if (!zn || zn.kind !== 'm1') throw new Error('That isn’t Metroid (USA).');
  const m1 = ZGm.writeMetroid(zn.bytes, at);

  const spoiler = spoilerText(seed, o, graph, smAt, m1At, done);
  const meta = { seed: String(seed), hash: res.hash, generator: 'M1SM', made: Date.now(), preset: o.preset, settings: o.settings, options: o.options,
    mix: o.mix, goal: o.goal || 'both', exits: o.exits || 'anywhere', portal: PORTAL, trades: done, sent, at, spoiler, smSpoiler, smPlaced };
  return { seed, rom, m1, at, sent, spoiler, meta, name: res.name, ms: Date.now() - t0 };
}

function spoilerText(seed, o, graph, smAt, m1At, done) {
  const Mm = M(), area = (a) => String(a).replace(/([a-z])([A-Z])/g, '$1 $2');
  const out = ['M1SM (Rando Hub): Metroid + Super Metroid', 'DASH seed ' + seed + ' · ' + (o.preset || 'Custom') + ' · ' + done + ' items traded between the games', '',
    'Portal to Metroid: ' + PORTAL.name + ' (' + PORTAL.how + '). Back: ' + (o.exits === 'exits' ? 'one of Metroid’s elevator rooms' : '⇄ anywhere (or P)') + '.', ''];
  out.push('Metroid’s spots:');
  Mm.SPOTS.forEach((s, k) => { const it = m1At[k]; out.push('  ' + s[6] + ': ' + (it.g === 'm1' ? Mm.ITEMS[it.type] : it.item.name + ' (Super Metroid)')); });
  out.push('', 'Super Metroid’s spots:');
  const byArea = {};
  smAt.forEach((it, v) => { (byArea[v.area] = byArea[v.area] || []).push('  ' + v.name + ': ' + (it.g === 'sm' ? it.item.name : Mm.ITEMS[it.type] + ' (Metroid)')); });
  Object.keys(byArea).forEach((a) => { out.push(area(a) + ':', ...byArea[a]); });
  return out.join('\n');
}

window.M1SMGen = { generate, MIX, GOALS, EXITS, PORTAL, presets: () => D.getAllPresets(), D };
