/*
 * gen.js — the four-game combo: Zelda 1, Metroid, Super Metroid and A Link to
 * the Past in one seed, Rando Hub's own. One item pool and one logic across
 * the four: SMZ3's world (the combo ROM, ../smz3/gen/smz3gen.js, Zelda and
 * Super Metroid linked by their own portals) with the NES games' spots added
 * to it (the Zelda 1 + Metroid page's, ../zm/js/gen.js).
 *
 * Hyrule (ALttP) is the hub: two of its caves, picked at random each seed
 * from the caves with a chest, are portals: one to Zelda 1's Hyrule, one to
 * Zebes (Metroid). Going in takes Link to that game; the way back is Zelda
 * 1's "take any road" caves, Metroid's elevator rooms (js/link.js). So a NES
 * game's spots are in logic once its portal cave is (that chest's own rule,
 * SMZ3's logic), and then by the NES game's own rules.
 *
 * Items cross between the systems:
 *   an NES item in the SNES game is another player's item in SMZ3's
 *     multiworld (world 1 "ZELDA 1", world 2 "METROID"): the ROM shows a
 *     look-alike, says "sent to ZELDA 1", and writes it to its sent queue,
 *     which the hub reads (js/link.js);
 *   an SNES item on a NES spot is a placeholder there (five rupees, a
 *     missile pack, as on the Zelda 1 + Metroid page): the hub sees the pickup
 *     and writes the item into SMZ3's receive queue, the ROM gives it;
 *   a Zelda 1 item on Zebes, a Metroid item in Zelda 1's Hyrule: as on the
 *     Zelda 1 + Metroid page.
 *
 *   QuadGen.generate({ sm, z3, ips, z1, m1, seed, options, goal }) →
 *     { seed, rom, z1, m1, at, portals, sent, spoiler, meta }
 *   at[i]: what's on NES spot i (ZMGen.SPOTS): { game: 'z1' | 'm1', type } or { game: 'snes', type, id, name }
 *   portals: [{ to: 'z1' | 'm1', name, room, loc }]   room: the ALttP room id ($A0)
 *   sent: { [SMZ3 location id]: { game, type } }      the NES items in the SNES game
 */
(function () {
  'use strict';
  const G = window.SMZ3Gen, I = G.internals, ZG = window.ZMGen, Z = window.ZM, M = window.M1, L = window.M1Logic;
  const NES_ID = 1000;   // the NES spots' location ids in the SMZ3 world (SMZ3's own are under 512)
  const GOALS = [['all', 'All four final bosses (Ganon, Mother Brain, Zelda 1’s Ganon, Metroid’s Mother Brain)'], ['snes', 'The SNES pair (SMZ3’s Ganon and Mother Brain)'], ['nes', 'The NES pair (Zelda 1’s Ganon and Metroid’s Mother Brain)']];
  const IT = G.IT;
  // the NES half's settings (the seed dialog's "Zelda 1 + Metroid" section)
  const NES_OPTIONS = [
    { key: 'link', label: 'Portals between Zelda 1 and Metroid', def: 'hub', values: [['hub', 'None: each NES game is reached from Hyrule (ALttP) only'], ['linked', 'Linked: Zelda 1’s “take any road” caves ⇄ Metroid’s elevator rooms']] },
    { key: 'portals', label: 'ALttP caves that are portals', def: '1', values: [['1', 'One for each NES game'], ['2', 'Two for each NES game']] },
    { key: 'exits', label: 'Back to Hyrule (ALttP) from the NES', def: 'anywhere', values: [['anywhere', '⇄ anywhere'], ['exits', 'Only at the way out: a “take any road” cave or an elevator room']] },
    { key: 'items', label: 'NES items', def: 'mixed', values: [['mixed', 'Anywhere in the four games'], ['apart', 'On the NES only (and the SNES games’ on the SNES)']] },
  ];
  function nesOptions(n) { const o = {}; NES_OPTIONS.forEach((d) => { o[d.key] = n && d.values.some((v) => v[0] === n[d.key]) ? n[d.key] : d.def; }); return o; }

  // ── the look-alikes: what an NES item shows as in the SNES game ─────────
  const STAND = {
    z1: { 0x01: 0x49, 0x02: 0x01, 0x03: 0x03, 0x05: IT.Flute, 0x07: IT.Lamp, 0x09: IT.SilverArrows, 0x0A: IT.Bow, 0x0B: IT.Key, 0x0C: IT.Flippers, 0x0D: IT.Hookshot,
      0x10: IT.Firerod, 0x11: IT.Book, 0x13: 0x23, 0x14: 0x1B, 0x15: IT.Bottle, 0x1A: IT.HeartContainer, 0x1D: IT.BlueBoomerang, 0x1E: IT.RedBoomerang, 0x0F: IT.FiveRupees },
    m1: [IT.Bombs, IT.HiJump, IT.Spazer, IT.ScrewAttack, IT.Morph, IT.Varia, IT.Wave, IT.Ice, IT.ETank, IT.Missile],
  };
  const OWNER = { z1: 1, m1: 2 }, PLAYER = { 1: 'ZELDA 1', 2: 'METROID' };

  // ── the NES logic: a Set of keys (ZMGen's, without the worlds: the portals are the way in) ──
  function derive(keys) {
    const v = new Set(keys); v.add('MM');   // Samus starts with Maru Mari (the Zelda 1 + Metroid page's stub)
    if (L.has(M.GOALS[0][1], v) && L.has(M.GOALS[1][1], v)) v.add('ST');
    if (Z.TRIFORCE.every((r) => L.has(r, v))) v.add('T8');
    return v;
  }
  const nesInv = (items) => items._quad || (items._quad = derive(items.nes));
  // the keys any rule asks for: an item giving one of them is a way-opener (its first copy)
  const NEEDED = new Set();
  (function add(r) { if (Array.isArray(r)) r.forEach(add); else if (typeof r === 'string') NEEDED.add(r); })([ZG.SPOTS.map((s) => s.req), Z.TRIFORCE, ZG.GOAL.z1, ZG.GOAL.m1, M.GOALS.map((g) => g[1])]);

  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const nesName = (it) => ZG.itemName(it) + (it.game === 'z1' ? ' (Zelda 1)' : ' (Metroid)');

  // the caves a portal can be: ALttP overworld caves with a chest whose room no other cave's door leads to
  // (the hub knows the portal by Link's room, $A0: the room the chest is in, read from the ROM's chest table)
  const CAVES = ['Spiral Cave', 'Paradox Cave Upper', 'Paradox Cave Lower', "King's Tomb", 'Kakariko Well', 'Chicken House', "Sahasrahla's Hut", "Aginah's Cave", 'Mini Moldorm Cave',
    'Floodgate Chest', 'Ice Rod Cave', 'Spike Cave', 'Hookshot Cave', 'Superbunny Cave', 'Pyramid Fairy', 'Mire Shed'];
  function portalCaves(world) {
    const seen = new Set();
    return world.Locations.filter((l) => l.Region.isZ3 && CAVES.indexOf(l.Name.replace(/ - .*$/, '')) >= 0)
      .filter((l) => { const cave = l.Name.replace(/ - .*$/, ''); if (seen.has(cave)) return false; seen.add(cave); return true; });
  }

  function attempt(o, seed) {
    const config = I.parseConfig(o.options || {});
    config.MultiWorld = true; config.OtherPlayers = [[1, PLAYER[1]], [2, PLAYER[2]]];
    const rnd = new G.NetRandom(seed), r = rng(seed * 2 + 1);
    const world = new I.World(config, 'Player', 0, I.hexGuid());
    const N = nesOptions(o.nes);
    // the portals: one or two caves for each NES game
    const caves = portalCaves(world), pick = () => caves.splice(Math.floor(r() * caves.length), 1)[0];
    const per = N.portals === '2' ? 2 : 1, PZ = [], PM = [];
    for (let k = 0; k < per; k++) { PZ.push(pick()); PM.push(pick()); }
    const portals = PZ.map((l) => [l, 'z1']).concat(PM.map((l) => [l, 'm1']));
    // with the NES games linked, either game's portal is a way into both
    const into = (mine, theirs) => (items) => mine.some((l) => l.Available(items)) || (N.link === 'linked' && theirs.some((l) => l.Available(items)));
    if (N.items === 'apart') {   // the NES games keep their own items: the Zelda 1 + Metroid page's placement, the SNES fill as SMZ3's
      let at = null; const zr = ZG.rng(seed * 3 + 7);
      for (let t = 0; t < 300 && !at; t++) at = ZG.place(zr);
      if (!at) throw new Error('no NES placement');
      const filler = new I.Filler([world], config, rnd); filler.Fill();
      const spheres = I.playthrough([world], config);
      if (spheres.some((sp) => sp.some((e) => /^Inaccessible Item/.test(e[0])))) throw new Error('unreachable locations');
      return { config, world, rnd, spheres, portals, nesLocs: null, at, N };
    }
    // the NES spots, in two regions behind their portals
    const region = (name, enter) => ({ Name: name, Area: name, World: world, Config: config, Weight: 0, kind: 'NES', Locations: [], RegionItems: [], lookup: {},
      CanEnter: enter, CanFill: (item) => !(item.IsDungeonItem || item.IsKeycard || item.IsSmMap), IsRegionItem: () => false, GetLocation() { return null; } });
    const RZ = region('Zelda 1', into(PZ, PM)), RM = region('Metroid', into(PM, PZ));
    const nesLocs = ZG.SPOTS.map((s) => {
      const R = s.game === 'z1' ? RZ : RM;
      const l = new I.Location(R, NES_ID + s.i, 0, 'NES', (s.game === 'z1' ? 'Zelda 1 · ' : 'Metroid · ') + s.name, (items) => L.has(s.req, nesInv(items)));
      l.spot = s; R.Locations.push(l); return l;
    });
    world.Locations.push(...nesLocs);
    nesLocs.forEach((l) => { world.locationLookup[l.Name] = l; });
    // the NES items: Maru Mari stays with Samus (a missile pack in its place)
    let pool = ZG.SPOTS.map((s) => Object.assign({}, s.vanilla));
    pool = pool.filter((it) => !(it.game === 'm1' && it.type === 4)); pool.push({ game: 'm1', type: 9 });
    const firsts = new Set(), extra = { progression: [], other: [] };
    pool.forEach((v) => {
      const it = new I.Item(0x1000 + (v.game === 'm1' ? 0x100 : 0) + v.type, world);
      const key = ZG.keyOf(v) || '';
      it.game = v.game; it.ntype = v.type; it.owner = OWNER[v.game]; it.standIn = (STAND[v.game][v.type] !== undefined ? STAND[v.game][v.type] : IT.FiveRupees);
      it.Name = nesName(v);
      const prog = key && NEEDED.has(key) && !firsts.has(key);
      it.nes = prog ? key : '';   // a copy of a key already held changes nothing: junk to the logic
      if (prog) { firsts.add(key); it.Progression = true; extra.progression.push(it); } else extra.other.push(it);
    });
    // the fill: SMZ3's, over the five worlds' locations
    const filler = new I.Filler([world], config, rnd);
    filler.Extra = extra;
    filler.Fill();
    // the proof: from nothing, every location is reached
    const spheres = I.playthrough([world], config);
    if (spheres.some((sp) => sp.some((e) => /^Inaccessible Item/.test(e[0])))) throw new Error('unreachable locations');
    return { config, world, rnd, spheres, portals, nesLocs, N };
  }

  function generate(o) {
    const why = ZG.check(o.z1, o.m1); if (why) throw new Error(why);
    let seed;
    if (o.seed === undefined || o.seed === null || o.seed === '') seed = Math.floor(Math.random() * 2147483647);
    else { seed = parseInt(o.seed, 10); if (!(seed >= 0 && seed <= 2147483647)) throw new Error('The seed is a number from 0 to 2147483647.'); }
    const goal = GOALS.some((g) => g[0] === o.goal) ? o.goal : 'all';
    let res = null, err = null;
    for (let t = 0; t < 12 && !res; t++) { try { res = attempt(o, (seed + t * 7919) % 2147483647); } catch (e) { err = e; } }
    if (!res) throw new Error('No placement worked for this seed (' + (err && err.message) + '); try another.');
    const { config, world, rnd, spheres, nesLocs, N } = res;
    // the SNES ROM
    const patches = I.makePatch(world, [world], I.hexGuid(), seed, new G.NetRandom(rnd.Next()), config);
    const rom = G.buildRom(o.sm, o.z3, o.ips, { patches });
    const portals = res.portals.map(([l, to]) => { const a = G.snes(l.Address); return { to, name: l.Name.replace(/ - .*$/, ''), loc: l.Id, region: l.Region.Name, room: (rom[a - 2] | rom[a - 1] << 8) & 0x7FFF }; });
    // the NES spots and the NES items in the SNES game
    const at = nesLocs ? nesLocs.map((l) => { const it = l.Item; return it.nes !== undefined ? { game: it.game, type: it.ntype } : { game: 'snes', type: it.Type, id: it.Type, name: it.Name }; }) : res.at;
    const sent = {};
    world.Locations.forEach((l) => { if (l.Id < NES_ID && l.Item.nes !== undefined) sent[l.Id] = { game: l.Item.game, type: l.Item.ntype }; });
    const z1 = ZG.writeZelda(o.z1, at), m1 = ZG.writeMetroid(o.m1, at);
    // the spoiler
    const S = ['Rando Cross: Zelda 1 · Metroid · Super Metroid · A Link to the Past', 'Seed: ' + seed, 'Goal: ' + GOALS.find((g) => g[0] === goal)[1], '',
      'Portals (ALttP caves):', ...portals.map((p) => '  ' + p.name + ' (' + p.region + ') → ' + (p.to === 'z1' ? 'Zelda 1' : 'Metroid')), '',
      'Zelda 1 ⇄ Metroid: ' + (N.link === 'linked' ? 'linked (a “take any road” cave ⇄ an elevator room)' : 'only through Hyrule (ALttP)'),
      'Back to Hyrule (ALttP): ' + (N.exits === 'exits' ? 'at a “take any road” cave or an elevator room' : '⇄ anywhere') + (N.link === 'linked' ? '' : N.exits === 'exits' ? '' : ' (Zelda 1’s “take any road” caves take you by themselves)'),
      'NES items: ' + (N.items === 'apart' ? 'on the NES only' : 'anywhere in the four games'), ''];
    spheres.forEach((sp, i) => { if (!sp.length) return; S.push(i === spheres.length - 1 ? 'Prizes and medallions:' : 'Sphere ' + (i + 1) + ':'); sp.forEach(([a, b]) => S.push('  ' + a + ': ' + b)); S.push(''); });
    S.push('All locations:');
    let reg = '';
    world.Locations.forEach((l) => { const rn = l.Region.Name; if (rn !== reg) { reg = rn; S.push('  ' + rn); } S.push('    ' + l.Name + ': ' + l.Item.Name); });
    if (!nesLocs) ZG.SPOTS.forEach((sp, i) => { const rn = sp.game === 'z1' ? 'Zelda 1' : 'Metroid'; if (rn !== reg) { reg = rn; S.push('  ' + rn); } S.push('    ' + rn + ' · ' + sp.name + ': ' + ZG.itemName(at[i])); });
    const spoiler = S.join('\n');
    const meta = { seed: String(seed), goal, nes: N, generator: 'Rando Cross', made: Date.now(), portals, at: at.map((x) => [x.game, x.type]), sent, options: o.options || {},
      towerCrystals: world.TowerCrystals, ganonCrystals: world.GanonCrystals, tourianBosses: world.TourianBossTokens, spoiler };
    return { seed, rom, z1, m1, at, portals, sent, spoiler, meta, world };
  }

  window.QuadGen = { generate, GOALS, NES_OPTIONS, nesOptions, PLAYER, NES_ID, STAND, portalCaves };
})();
