/*
 * gen.js — the Zelda 1 + Metroid generator: both games' item spots in one
 * pool, shuffled across the two games with one logic, and both ROMs written.
 * Rando Hub's own (nothing of anyone else's randomizer): the Metroid half is
 * the hub's Metroid randomizer's spots and rules (../metroid/js/), the Zelda
 * half data.js.
 *
 *   ZMGen.check(z1Bytes, m1Bytes)              → '' or why not
 *   ZMGen.generate(z1, m1, { seed })           → { seed, z1: Uint8Array, m1: Uint8Array, at, spoiler, meta }
 *     at[i]: the item at spot i of ZMGen.SPOTS: { game: 'z1' | 'm1', type }
 *   ZMGen.SPOTS                                 the Zelda spots, then the Metroid spots (data.js order)
 *   ZMGen.reach(inv)                            per spot: 'ok' | 'no' for an inventory (a Set of logic keys)
 *
 * The link between the worlds (js/link.js): Hyrule's four "take any road"
 * caves lead to Zebes (where Samus is), and Zebes' four elevator rooms lead
 * back to Hyrule (where Link is). So Zebes is open from the start; Hyrule
 * from Zebes needs Maru Mari (to reach an elevator).
 *
 * A Metroid item in Hyrule sits in the ROM as five rupees, a Hyrule item on
 * Zebes as a missile pack: the hub sees the pickup and hands the real item to
 * the other game (link.js).
 */
(function () {
  'use strict';
  const Z = window.ZM, M = window.M1, L = window.M1Logic;
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
  const isNes = (b) => b && b.length > 16 && b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A;

  // Any dump of the two games: with its 16-byte iNES header or without one, whatever that header
  // says (an NES 2.0 header, other flags, a trainer), the game's 128 KB are what count. Out comes
  // the standard file (the usual header + the game), which everything here is made for.
  const HEADERS = { z1: [0x4E, 0x45, 0x53, 0x1A, 0x08, 0x00, 0x12, 0, 0, 0, 0, 0, 0, 0, 0, 0], m1: [0x4E, 0x45, 0x53, 0x1A, 0x08, 0x00, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const M_BODY = '70080810';   // Metroid (USA), the 128 KB without a header
  function normalize(bytes) {
    if (!bytes || !bytes.length) return null;
    let body = bytes;
    if (isNes(bytes)) body = bytes.subarray(16 + (bytes[6] & 4 ? 512 : 0));
    if (body.length !== 131072) return null;
    const out = (k) => { const o = new Uint8Array(16 + body.length); o.set(HEADERS[k]); o.set(body, 16); return { kind: k, bytes: o }; };
    if (crc32(body) === M_BODY) return out('m1');
    if (Z.FINGERPRINT.every(([o, v]) => body[o - 16] === v)) return out('z1');
    return null;
  }
  function whichRom(bytes) { const n = normalize(bytes); return n ? n.kind : null; }
  function check(z1, m1) {
    z1 = z1 && (normalize(z1) || {}).bytes || z1; m1 = m1 && (normalize(m1) || {}).bytes || m1;
    if (!z1) return 'the Zelda ROM is missing';
    if (!m1) return 'the Metroid ROM is missing';
    if (whichRom(z1) !== 'z1') return 'that isn’t The Legend of Zelda (USA)';
    if (whichRom(m1) !== 'm1') return 'that isn’t Metroid (USA)';
    return '';
  }

  // ── the spots: Zelda's, then Metroid's ──────────────────────────────────
  const ZN = Z.SPOTS.length;
  const SPOTS = Z.SPOTS.map((s, i) => ({ i, game: 'z1', key: s[0], name: s[1], region: 'Hyrule · ' + (s[2] === 'room' ? 'Level ' + s[3][2] : 'Overworld'), req: s[5], vanilla: { game: 'z1', type: s[4] } }))
    .concat(M.SPOTS.map((s, k) => ({ i: ZN + k, game: 'm1', key: 'm-' + k, name: s[6], region: 'Zebes · ' + M.AREAS[s[0]], req: s[7], vanilla: { game: 'm1', type: s[5] }, m: k })));

  // ── the logic: one inventory of keys from both games ─────────────────────
  // Hyrule's keys: SW, BOW, RAFT, LAD, REC, T8 (derived); Zebes': M1Logic's,
  // ST (derived); the worlds: ZEBES (from Hyrule: always), HYRULE (from Zebes: MM).
  function derive(inv) {
    const v = new Set(inv);
    v.add('ZEBES');
    if (v.has('MM')) v.add('HYRULE');
    if (Z.TRIFORCE.every((req) => L.has(req, v))) v.add('T8');
    return v;
  }
  function has(spot, inv) {
    if (spot.game === 'z1' && !inv.has('HYRULE')) return false;
    if (spot.game === 'm1' && !inv.has('ZEBES')) return false;
    return L.has(spot.req, inv);
  }
  function keyOf(item) { return item.game === 'z1' ? (Z.KEY[item.type] || null) : L.KEY[item.type]; }
  // from `start`, taking what's placed (at[i] = item or null): everything reachable
  function collect(start, at) {
    let inv = new Set(start), taken = new Set(), changed = true;
    while (changed) {
      changed = false;
      // Metroid's statues: Kraid and Ridley beatable
      if (L.has(M.GOALS[0][1], inv) && L.has(M.GOALS[1][1], inv)) inv.add('ST');
      inv = derive(inv);
      SPOTS.forEach((s) => {
        if (taken.has(s.i) || !has(s, inv)) return;
        taken.add(s.i);
        const it = at ? at[s.i] : null, k = it ? keyOf(it) : null;
        if (k && !inv.has(k)) { inv.add(k); changed = true; }
      });
    }
    if (L.has(M.GOALS[0][1], inv) && L.has(M.GOALS[1][1], inv)) inv.add('ST');
    return { inv: derive(inv), taken };
  }
  function reach(inv) { const v = derive(new Set(inv)); if (L.has(M.GOALS[0][1], v) && L.has(M.GOALS[1][1], v)) v.add('ST'); return SPOTS.map((s) => has(s, v) ? 'ok' : 'no'); }
  const GOAL = { z1: ['T8', 'LAD', 'SW', 'BOW'], m1: M.GOALS[2][1] };   // Ganon (silver arrows are in level 9), Mother Brain

  // ── placing ──────────────────────────────────────────────────────────────
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  const same = (a, b) => a.game === b.game && a.type === b.type;
  function place(r) {
    const N = SPOTS.length, at = new Array(N).fill(null);
    let pool = SPOTS.map((s) => Object.assign({}, s.vanilla));
    // Samus starts with Maru Mari (as the hub's Metroid randomizer): its spot holds another missile pack
    pool = pool.filter((it) => !(it.game === 'm1' && it.type === 4)); pool.push({ game: 'm1', type: 9 });
    const start = new Set(['MM']);
    // the way-openers first, by assumed fill
    const prog = [];
    const takeOne = (game, type) => { const i = pool.findIndex((it) => it.game === game && it.type === type); if (i >= 0) prog.push(pool.splice(i, 1)[0]); };
    takeOne('z1', Z.IT.WOOD_SWORD); takeOne('z1', Z.IT.WHITE_SWORD); takeOne('z1', Z.IT.BOW); takeOne('z1', Z.IT.RAFT); takeOne('z1', Z.IT.LADDER); takeOne('z1', Z.IT.RECORDER);
    takeOne('m1', 0); takeOne('m1', 1); takeOne('m1', 7); takeOne('m1', 7); takeOne('m1', 9);
    shuffle(prog, r);
    while (prog.length) {
      const it = prog.pop();
      const assumed = new Set(start); prog.forEach((p) => { const k = keyOf(p); if (k) assumed.add(k); });
      const { inv, taken } = collect(assumed, at);
      const open = SPOTS.filter((s) => !at[s.i] && taken.has(s.i) && has(s, inv)).map((s) => s.i);
      if (!open.length) return null;
      at[open[Math.floor(r() * open.length)]] = it;
    }
    shuffle(pool, r);
    for (let i = 0; i < N; i++) if (!at[i]) at[i] = pool.pop();
    // the proof: from the start, everything is reached and both ends are open
    const { inv, taken } = collect(start, at);
    if (taken.size !== N || !L.has(GOAL.z1, inv) || !L.has(GOAL.m1, inv)) return null;
    return at;
  }

  // ── writing the ROMs ─────────────────────────────────────────────────────
  function writeZelda(rom, at) {
    const out = rom.slice(0);
    Z.SPOTS.forEach((s, i) => {
      const it = at[i], code = it.game === 'z1' ? it.type : Z.PLACEHOLDER;
      if (s[2] === 'room') { const o = Z.OFF.GRID[s[3][0]] + 0x200 + s[3][1]; out[o] = (out[o] & 0xE0) | code; }
      else if (s[2] === 'cave') { const o = Z.OFF.CAVES + (s[3] - 0x10) * 3 + 1; out[o] = (out[o] & 0xC0) | code; }
      else if (s[2] === 'armos') out[Z.OFF.ARMOS] = code;
      else if (s[2] === 'coast') out[Z.OFF.COAST] = code;
    });
    return out;
  }
  function writeMetroid(rom, at) {
    const out = rom.slice(0);
    out[6] |= 0x02;   // battery: the cartridge RAM (Samus's gear, the taken items) is shown to the hub
    M.SPOTS.forEach((s, k) => { const it = at[ZN + k]; out[s[4]] = it.game === 'm1' ? it.type : 9; });
    // start with Maru Mari: the hub's Metroid randomizer's stub (InitializeStats → $BFE0 also sets the Maru Mari bit)
    const o = 16 + (0x9354 - 0x8000), stub = 16 + (0xBFE0 - 0x8000);   // InitializeStats: LDA #$02 / STA $24 / RTS
    out.set([0x4C, 0xE0, 0xBF, 0xEA, 0xEA], o);
    out.set([0xA9, 0x10, 0x8D, 0x78, 0x68, 0xA9, 0x02, 0x85, 0x24, 0x60], stub);
    return out;
  }

  function itemName(it) { return it.game === 'z1' ? (Z.NAMES[it.type] || ('Zelda item ' + it.type)) : M.ITEMS[it.type]; }
  function spoilerText(res) {
    const L2 = ['Zelda 1 + Metroid (Rando Hub)', 'Seed: ' + res.seed, 'Portals: Hyrule’s four take-any-road caves lead to Zebes; Zebes’ elevator rooms lead to Hyrule.', ''];
    // spheres: what's open with what's held, then what that gives
    const done = new Set(); let n = 0;
    let cur = new Set(['MM']);
    for (let guard = 0; guard < 40; guard++) {
      const r = reach(cur); const fresh = SPOTS.filter((s) => r[s.i] === 'ok' && !done.has(s.i));
      if (!fresh.length) break;
      n++; L2.push('Sphere ' + n + ':');
      fresh.forEach((s) => { done.add(s.i); L2.push('  ' + s.name + ': ' + itemName(res.at[s.i])); });
      cur = new Set(cur); fresh.forEach((s) => { const k = keyOf(res.at[s.i]); if (k) cur.add(k); });
      L2.push('');
    }
    L2.push('All spots:');
    let region = '';
    SPOTS.forEach((s) => { if (s.region !== region) { region = s.region; L2.push('  ' + region); } L2.push('    ' + s.name + ': ' + itemName(res.at[s.i])); });
    return L2.join('\n');
  }

  function generate(z1, m1, opts) {
    const why = check(z1, m1); if (why) throw new Error(why);
    z1 = normalize(z1).bytes; m1 = normalize(m1).bytes;
    const seed = opts && opts.seed ? (opts.seed >>> 0) : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
    const r = rng(seed * 2 + 1);
    let at = null;
    for (let tries = 0; tries < 300 && !at; tries++) at = place(r);
    if (!at) throw new Error('No placement worked for this seed; try another.');
    const res = { seed, at, z1: ZMTitleRom.bakeZelda(writeZelda(z1, at), m1), m1: ZMTitleRom.bakeMetroid(writeMetroid(m1, at), z1) };   // both titles carry both logos (js/title-rom.js)
    res.spoiler = spoilerText(res);
    res.meta = { seed: String(seed), generator: 'Rando Hub Zelda 1 + Metroid', made: Date.now(), items: at.map((it) => [it.game, it.type]), spoiler: res.spoiler };
    return res;
  }

  window.ZMGen = { check, whichRom, normalize, generate, SPOTS, reach, collect, keyOf, itemName, crc32, GOAL, writeZelda, writeMetroid, place, rng };
})();
