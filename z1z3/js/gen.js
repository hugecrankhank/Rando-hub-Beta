/*
 * gen.js — Z1Z3: A Link to the Past and Zelda 1 in one seed, Rando Hub's own.
 * One item pool and one logic across the two games: the hub's Zelda 3
 * randomizer (../randomizer/, its port of alttpr.com's, the same seeds the
 * Zelda 3 page rolls) with Zelda 1's item spots added to its world as a region
 * of their own (the Zelda 1 + Metroid page's spots and rules, ../zm/js/).
 *
 * Kakariko is the hub: the Elder's House (either door) is the portal to Zelda
 * 1's Hyrule, open once Link can walk around Kakariko (in Standard, after the
 * escape). The way back is ⇄ (or P) anywhere, or only in a "take any road"
 * cave (an option). So Zelda 1's spots are in logic by its own rules, once the
 * village is.
 *
 * Items cross between the games:
 *   a Zelda 1 item in Hyrule (ALttP) is in a chest, as a look-alike pickup
 *     (a few rupees, bombs or arrows, different from everything else in that
 *     room): the page sees the chest give it (the room, $A0, and the item,
 *     $02D8, as the game's item counter goes up) and hands Link in Zelda 1 the
 *     real item (js/link.js);
 *   an ALttP item on a Zelda 1 spot is a rupee there (as the Zelda 1 + Metroid
 *     page does): the page sees the pickup and writes it into ALttP's save
 *     (js/give.js).
 * Dungeon items (keys, maps, compasses) stay in their ALttP dungeons.
 *
 * Zelda 1 can instead be rolled by ZORA (the Z1R page's randomizer, every Z1R option: dungeon
 * shapes, overworld, caves, shops, monsters, start items...), through ZORA's own Archipelago
 * interface (../zora/glue.py, js/zora.js): its places and their access rules join the fill (see
 * "ZORA mode" below), and ZORA writes the Zelda 1 ROM with the items where they landed.
 *
 *   Z1Z3Gen.generate({ jp, z1, seed, options, zora?: { flags, zoraFlags }, stage? }) → Promise<{ seed, hash, rom, z1, at, chests, spoiler, meta }>
 *     jp: the Japanese 1.0 ALttP ROM, z1: The Legend of Zelda (USA)
 *     at[i]: what's on Zelda 1 spot i (ZM.SPOTS order): { game: 'z1', type } | { game: 'z3', name }
 *     chests: [{ room, id, type, name, loc }]   the Zelda 1 items in ALttP's chests: the room ($A0), the look-alike ($02D8)
 *   Z1Z3Gen.OPTIONS, Z1Z3Gen.checkJp(bytes), Z1Z3Gen.GIVEABLE (the ALttP items a Zelda 1 spot can hold)
 */
import { seedRng, getRandomInt } from '../../randomizer/core/rng.js';
import { Item } from '../../randomizer/core/item.js';
import '../../randomizer/core/locations-special.js';
import { Boss } from '../../randomizer/core/boss.js';
import { Rom } from '../../randomizer/core/rom.js';
import { Randomizer, RandomAssumed } from '../../randomizer/core/randomizer.js';
import { HintService } from '../../randomizer/core/hints.js';
import { WorldCollection, ItemCollection, LocationCollection } from '../../randomizer/core/collections.js';
import { Location } from '../../randomizer/core/location.js';
import { Region } from '../../randomizer/core/region.js';
import { hash_array } from '../../randomizer/core/php.js';
import { World } from '../../randomizer/worlds/index.js';
import { md5 } from '../../randomizer/md5.js';
import { seedHash } from '../../randomizer/generate.js';
import LANG from '../../randomizer/data/lang-en.js';
import { GIVEABLE } from './give.js';

const Z = window.ZM, ZG = window.ZMGen, L = window.M1Logic;
const JP10_MD5 = '03a63945398191337e896e5771f77173';
const ROM_SIZE = 0x200000;

// ── the settings (the seed dialog) ─────────────────────────────────────────
const CRYSTALS = [['7', '7 crystals'], ['6', '6'], ['5', '5'], ['4', '4'], ['3', '3'], ['2', '2'], ['1', '1'], ['0', '0'], ['random', 'Random']];
const LEVELS = [['normal', 'Normal'], ['easy', 'Easy'], ['hard', 'Hard'], ['expert', 'Expert']];
export const OPTIONS = [
  { key: 'mode', label: 'World state', def: 'open', values: [['open', 'Open'], ['standard', 'Standard (the escape first)'], ['inverted', 'Inverted (the Zelda 1 portal: the C-Shaped House, Village of Outcasts)'], ['retro', 'Retro (rupee bow, universal keys, take-any caves)']] },
  { key: 'goal', label: 'Goal', def: 'both', values: [['both', 'Both Ganons (A Link to the Past’s and Zelda 1’s)'], ['z3', 'A Link to the Past’s Ganon'], ['z1', 'Zelda 1’s Ganon (and ALttP’s Ganon still ends it)']] },
  { key: 'z3goal', label: 'ALttP’s goal', def: 'ganon', values: [['ganon', 'Defeat Ganon'], ['fast_ganon', 'Fast Ganon (the pyramid hole open)'], ['dungeons', 'All Dungeons (then Ganon)']] },
  { key: 'tower', label: 'Open tower (Ganon’s Tower)', def: '7', values: CRYSTALS },
  { key: 'ganon', label: 'Ganon vulnerable', def: '7', values: CRYSTALS },
  { key: 'weapons', label: 'Swords (ALttP)', def: 'randomized', values: [['randomized', 'Randomized'], ['assured', 'Assured (start with one)'], ['vanilla', 'Vanilla spots'], ['swordless', 'Swordless']] },
  { key: 'boots', label: 'Boots (ALttP)', def: 'off', values: [['off', 'In the item pool'], ['casboots', 'Casboots: start with the Pegasus Boots'], ['pseudo', 'Pseudoboots: dash without them (the boots still in the pool)']] },
  { key: 'dungeon_items', label: 'ALttP dungeon items', def: 'standard', values: [['standard', 'In their own dungeons'], ['mc', 'Maps and compasses anywhere'], ['mcs', 'Maps, compasses and small keys anywhere'], ['full', 'Keysanity (all anywhere)']] },
  { key: 'placement', label: 'Item placement', def: 'advanced', values: [['advanced', 'Advanced'], ['basic', 'Basic']] },
  { key: 'accessibility', label: 'Accessibility', def: 'items', values: [['items', '100% Inventory'], ['locations', '100% Locations'], ['none', 'Beatable only']] },
  { key: 'pool', label: 'Item pool', def: 'normal', values: LEVELS },
  { key: 'func', label: 'Item functionality', def: 'normal', values: LEVELS },
  { key: 'hints', label: 'Hints (ALttP)', def: 'on', values: [['on', 'On'], ['off', 'Off']] },
  { key: 'exits', label: 'Back to ALttP from Zelda 1', def: 'anywhere', values: [['anywhere', '⇄ anywhere (or P)'], ['exits', 'Only in a “take any road” cave']] },
];
export function options(o) {
  o = Object.assign({}, o || {});
  if (o.crystals && o.tower === undefined) o.tower = o.crystals;   // (one "crystals" setting for both, before)
  if (o.crystals && o.ganon === undefined) o.ganon = o.crystals;
  const out = {}; OPTIONS.forEach((d) => { out[d.key] = d.values.some((v) => v[0] === o[d.key]) ? o[d.key] : d.def; }); return out;
}

export function checkJp(bytes) {
  let b = bytes && bytes.length % 1024 === 512 ? bytes.subarray(512) : bytes;
  if (!b || b.length < 0x100000) return '';
  if (b.length > 0x100000) b = b.subarray(0, 0x100000);
  return md5(b) === JP10_MD5 ? 'jp' : '';
}

// ── the Kakariko portal and Zelda 1's region ───────────────────────────────
// The Elder's House (either door): found by the door Link came in by ($7E:010E), as Rando Cross does
export const PORTAL = { name: 'the Elder’s House (either door)', region: 'Light World: Kakariko', hub: 'Kakariko', entrances: [0x0D, 0x0E] };
// Inverted: Link's home is the Dark World, so the portal is a house there: the C-Shaped House in the
// Village of Outcasts (Kakariko's Dark World twin): entrance $54, as the game's own overworld entrance
// table has it (area $58), and Kara's door table (../randomizer/kara/.../EntranceShuffle2.py)
export const PORTAL_INVERTED = { name: 'the C-Shaped House', region: 'Dark World: Village of Outcasts', hub: 'the Village of Outcasts', entrances: [0x54] };
export const portalFor = (mode) => (mode === 'inverted' ? PORTAL_INVERTED : PORTAL);
// when the portal's house can be reached: Kakariko once Link is free (Standard: after the escape);
// Inverted: the Village of Outcasts' own region
function portalOpen(world, opts) {
  if (opts.mode === 'inverted') return (locations, items) => world.getRegion('North West Dark World').canEnter(locations, items);
  return (locations, items) => items.has('RescueZelda');
}

const zName = (t) => 'Z1_' + t.toString(16).toUpperCase().padStart(2, '0');
const zType = (name) => parseInt(String(name).replace(/^Z1_/, '').replace(/:.*$/, ''), 16);
class Z1Item extends Item {
  constructor(type, world, label) { super(zName(type), [0x36], world); this.z1 = type; this.label = label || Z.NAMES[type] || 'Zelda 1 item'; }
  getNiceName() { return this.label + ' (Zelda 1)'; }
}
class Z1Location extends Location {
  writeItem() { return this; }   // Zelda 1's ROM is written by ZMGen (below)
}
// text the game's own hints and spoiler use (the randomizer's English text, extended)
function addLang() {
  LANG.item = LANG.item || {}; LANG.hint = LANG.hint || {}; LANG.hint.item = LANG.hint.item || {}; LANG.hint.location = LANG.hint.location || {};
  Object.keys(Z.NAMES).forEach((t) => {
    const n = Z.NAMES[t], k = zName(+t);
    LANG.item[k] = n + ' (Zelda 1)';
    LANG.hint.item[k] = 'the ' + n.toLowerCase() + ' from another Hyrule';
  });
  Z.SPOTS.forEach((s) => { LANG.hint.location['Zelda 1 · ' + s[1]] = 'can be found in another Hyrule'; });
  LANG.hint.location['Zelda 1 · Ganon'] = 'is in another Hyrule';
}

// Zelda 1's keys from what's collected (ZMGen's logic: SW, BOW, RAFT, LAD, REC; T8 when every level is open)
function z1Keys(items) {
  const v = new Set(['HYRULE', 'MM']);
  Object.keys(Z.KEY).forEach((t) => { if (items.has(zName(+t))) v.add(Z.KEY[t]); });
  if (Z.TRIFORCE.every((r) => L.has(r, v))) v.add('T8');
  return v;
}

function addZelda1(world, opts) {
  const R = new Region(world);
  R.name = 'Zelda 1';
  // in through the Elder's House: Kakariko, once Link is free to walk there
  R.can_enter = portalOpen(world, opts);
  const base = R.canFill.bind(R);
  R.canFill = (item) => item instanceof Z1Item || (base(item) && !(item instanceof Item.Key) && !(item instanceof Item.BigKey) && !(item instanceof Item.Map)
    && !(item instanceof Item.Compass) && GIVEABLE.has(item.getTarget().getRawName()));
  const locs = Z.SPOTS.map((s) => new Z1Location('Zelda 1 · ' + s[1], null, null, R, (locations, items) => L.has(s[5], z1Keys(items))));
  locs.forEach((l, i) => { l.z1spot = i; });
  // Zelda 1's Ganon, as an event (the goal "both")
  const ganon = new Z1Location('Zelda 1 · Ganon', null, null, R, (locations, items) => L.has(ZG.GOAL.z1, z1Keys(items)));
  ganon.setItem(new Item.Event('Z1Victory', [null], world));
  R.locations = new LocationCollection(locs.concat([ganon]));
  world.regions['Zelda 1'] = R;
  world.locations = world.locations.merge(R.locations);
  world.locations.setChecksForWorld(world.id);
  world.collectable_locations = null;
  // Zelda 1's items in the pools: the way-openers with ALttP's (the prize fill counts on them too), the rest with the nice items
  const adv = world.getAdvancementItems.bind(world), nice = world.getNiceItems.bind(world);
  world.getAdvancementItems = () => adv().concat(Z.SPOTS.filter((s) => Z.KEY[s[4]]).map((s) => new Z1Item(s[4], world)));
  world.getNiceItems = () => nice().concat(Z.SPOTS.filter((s) => !Z.KEY[s[4]]).map((s) => new Z1Item(s[4], world)));
  // ALttP's own item total (the HUD's counter): without Zelda 1's spots
  const total = world.getTotalItemCount.bind(world);
  world.getTotalItemCount = () => total() - Z.SPOTS.length - 1;
  // the goal: Zelda 1's Ganon too
  if (opts.goal === 'both' || opts.goal === 'z1') {
    const g = world.getLocation('Ganon'), req = g.requirement_callback;
    g.setRequirements((locations, items) => items.has('Z1Victory') && (!req || req(locations, items)));
  }
  // Zelda 1's items only in ALttP's chests (the page tells their pickup by the chest's room)
  world.getLocations().each((l) => {
    if (l.region === R || l instanceof Location.Chest) return;
    const f = l.fill_callback;
    l.setFillRules((item, locations, items) => !(item instanceof Z1Item) && (!f || f(item, locations, items)));
  });
  return R;
}

// The fill: alttpr.com's (assumed fill for the way-openers), except that its quick fill of the
// rest also asks each spot whether the item may go there (Zelda 1's items only in chests,
// ALttP items on Zelda 1's spots only those the page can hand over)
class SafeFill extends RandomAssumed {
  fastFillItemsInLocations(fill_items, locations) {
    const none = new ItemCollection(), empty = [];
    for (const location of locations) if (!location.hasItem()) empty.push(location);
    // the choosy ones first (Zelda 1's items: chests only), each in the first spot (of the shuffled order) that takes it
    for (let k = fill_items.length - 1; k >= 0; k--) {
      const it = fill_items[k]; if (!(it instanceof Z1Item)) continue;
      const l = empty.find((x) => !x.hasItem() && x.canFill(it, none, false));
      if (!l) throw new Error('no chest left for ' + it.getNiceName());
      l.setItem(it); fill_items.splice(k, 1);
    }
    for (const location of empty) {
      if (location.hasItem()) continue;
      if (!fill_items.length) break;
      // only Zelda 1's spots are asked (the items the page can hand over); ALttP's take the next
      // one as alttpr.com's quick fill does (asking them trips rules made for the assumed fill:
      // Link's Uncle's, with an assured sword, sees no weapon and takes nothing)
      const choosy = location instanceof Z1Location;
      let k = fill_items.length - 1;
      while (k >= 0 && choosy && !location.canFill(fill_items[k], none, false)) k--;
      if (k < 0) throw new Error('nothing fits ' + location.getName());
      location.setItem(fill_items.splice(k, 1)[0]);
    }
  }
}
class Z1Z3Randomizer extends Randomizer {
  randomize() {
    const filler = new SafeFill(this.worlds);
    for (const world of this.worlds) this.prepareWorld(world);
    filler.fill(this.dungeon_items, this.advancement_items, this.nice_items, this.trash_items);
    for (const world of this.worlds) { this.setTexts(world); this.randomizeCredits(world); }
    new HintService(this.worlds, this.advancement_items).applyHints();
  }
}

// ── the ROMs ───────────────────────────────────────────────────────────────
let basePatch = null;
async function buildBase(jp) {
  let b = jp.length % 1024 === 512 ? jp.subarray(512) : jp;
  if (b.length > 0x100000) b = b.subarray(0, 0x100000);
  if (!basePatch) {
    const res = await fetch(new URL('../../randomizer/data/base-patch.bin', import.meta.url));
    if (!res.ok) throw new Error('Could not load the base patch (' + res.status + ')');
    basePatch = new Uint8Array(await res.arrayBuffer());
  }
  const rom = new Uint8Array(ROM_SIZE), p = basePatch, dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  rom.set(b.subarray(0, 0x100000));
  if (String.fromCharCode(p[0], p[1], p[2], p[3]) !== 'Z3BP') throw new Error('Corrupt base patch file');
  let o = 8; const n = dv.getUint32(4, true);
  for (let i = 0; i < n; i++) { const off = dv.getUint32(o, true), len = dv.getUint32(o + 4, true); o += 8; rom.set(p.subarray(o, o + len), off); o += len; }
  return rom;
}
export function checksum(rom) {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) if (i < 0x7FDC || i >= 0x7FE0) sum += rom[i];
  const c = (sum + 0x1FE) & 0xFFFF, inv = c ^ 0xFFFF;
  rom[0x7FDC] = inv & 0xFF; rom[0x7FDD] = inv >> 8; rom[0x7FDE] = c & 0xFF; rom[0x7FDF] = c >> 8;
}

// the look-alikes for Zelda 1's items in ALttP's chests: a few rupees, bombs or arrows
const LOOK = ['TwentyRupees', 'FiftyRupees', 'FiveRupees', 'OneHundredRupees', 'ThreeBombs', 'TenArrows', 'OneRupee', 'TenBombs', 'TwentyRupees2', 'Arrow', 'Bomb', 'ThreeHundredRupees'];

function attempt(o, seed, B) {
  Item.clearCache(); Boss.clearCache(); World.max_world = 1; seedRng(seed);
  const cr = (v) => (v === 'random' ? String(getRandomInt(0, 7)) : v);
  const tower = cr(o.tower), ganonCr = cr(o.ganon);
  const di = o.dungeon_items;
  const world = World.factory(o.mode, {
    itemPlacement: o.placement, dungeonItems: di, accessibility: o.accessibility, goal: o.z3goal,
    'crystals.ganon': ganonCr, 'crystals.tower': tower, entrances: 'none', 'mode.weapons': o.weapons,
    tournament: false, spoilers: 'on', allow_quickswap: true, override_start_screen: false, pseudoboots: o.boots === 'pseudo',
    'spoil.Hints': o.hints, logic: 'NoGlitches', 'item.pool': o.pool, 'item.functionality': o.func,
    'enemizer.bossShuffle': 'none', 'enemizer.enemyShuffle': 'none', 'enemizer.enemyDamage': 'default', 'enemizer.enemyHealth': 'default', 'enemizer.potShuffle': 'off',
  });
  if (o.boots === 'casboots') {
    // Casboots: Link starts with the Pegasus Boots (the pool's pair becomes twenty rupees)
    world.addPreCollectedItem(Item.get('PegasusBoots', world));
    const advB = world.getAdvancementItems.bind(world), junkB = world.getItemPool.bind(world);
    world.getAdvancementItems = () => { const a = advB(), k = a.findIndex((it) => it.getRawName() === 'PegasusBoots'); if (k >= 0) a.splice(k, 1); return a; };
    world.getItemPool = () => junkB().concat([Item.get('TwentyRupees', world)]);
  }
  const R = B ? addZora(world, o, B) : addZelda1(world, o);
  const rom = new Rom();
  const rand = new Z1Z3Randomizer([world]);
  rand.randomize();
  if (!new WorldCollection(rand.getWorlds()).isWinnable()) throw new Error('not beatable');
  return { world, rom, R };
}


// ── ZORA mode: Zelda 1 rolled by ZORA, with every Z1R flag ─────────────────
// ZORA's own Archipelago interface (../zora/glue.py) builds a whole Zelda 1 seed and lists its
// places (dungeon rooms, cellars, caves, shop wares...) with their access rules: any one clause of
// a rule, every term in it (an item held, a count of an upgrade line, an event, a heart count).
// Those places join ALttP's world as the region "Zelda 1", each rule read from what Link holds
// across both games, ZORA's events (each level's Triforce, level 9's entry, the take-any caves'
// hearts, Zelda...) as event locations. The one fill then places both games' items. Then ZORA
// writes its ROM: its own items where they landed, the other game's (FOREIGN) as a rupee.
const zeName = (n) => 'ZE_' + String(n).replace(/[^A-Za-z0-9]/g, '_');
function zoraLogic(B) {
  const L1 = B.logic, code = (en) => B.codes[B.enumNames[en]];
  const count = (items, c) => { let n = 0; while (items.has(zName(c), n + 1)) n++; return n; };
  const HC = code('HEART_CONTAINER');
  function term(items, t) {
    if (t.item !== undefined) return items.has(zName(code(t.item)));
    if (t.count !== undefined) {
      const line = L1.lines[t.count];
      let n = line.starting || 0;
      line.items.forEach((en) => { n += count(items, code(en)); });
      if (line.ware_event && items.has(zeName(line.ware_event))) n++;
      return n >= t.at_least;
    }
    if (t.event !== undefined) return items.has(zeName(t.event));
    let h = L1.starting_hearts + count(items, HC);
    if (t.take_any) h += Math.max(0, L1.take_any_events.filter((e) => items.has(zeName(e))).length - 2);
    return h >= t.hearts;
  }
  return (rule) => (locations, items) => rule.some((clause) => clause.every((t) => term(items, t)));
}
function addZora(world, opts, B) {
  const R = new Region(world);
  R.name = 'Zelda 1';
  R.can_enter = portalOpen(world, opts);
  const base = R.canFill.bind(R);
  R.canFill = (item) => item instanceof Z1Item || (base(item) && !(item instanceof Item.Key) && !(item instanceof Item.BigKey) && !(item instanceof Item.Map)
    && !(item instanceof Item.Compass) && GIVEABLE.has(item.getTarget().getRawName()));
  const ruleOf = zoraLogic(B);
  const locs = B.places.map((p, i) => {
    const l = new Z1Location('Zelda 1 · ' + p.name, null, null, R, ruleOf(B.logic.places[p.name] || []));
    l.zplace = i;
    l.setFillRules((item) => !(item instanceof Z1Item) || p.forbids.indexOf(item.label) < 0);
    return l;
  });
  const events = Object.keys(B.logic.events).map((name) => {
    const l = new Z1Location('Zelda 1 · ' + name + ' (event)', null, null, R, ruleOf(B.logic.events[name]));
    l.setItem(new Item.Event(zeName(name), [null], world));
    return l;
  });
  R.locations = new LocationCollection(locs.concat(events));
  world.regions['Zelda 1'] = R;
  world.locations = world.locations.merge(R.locations);
  world.locations.setChecksForWorld(world.id);
  world.collectable_locations = null;
  // the pool: ZORA's items, one per place. The ones the other game can't hand over (rupees,
  // hearts, maps, compasses, Triforces...) stay in Zelda 1, put in its places before the fill
  const receivable = new Set(B.receivable), progression = new Set(B.logic.progression.map((en) => B.enumNames[en]));
  const mk = (name) => new Z1Item(B.codes[name], world, name);
  const fixed = [], adv = [], nice = [];
  B.places.forEach((p) => { (!receivable.has(p.item) ? fixed : progression.has(p.item) ? adv : nice).push(p.item); });
  const open = locs.slice();
  for (let i = open.length - 1; i > 0; i--) { const j = getRandomInt(0, i); [open[i], open[j]] = [open[j], open[i]]; }
  fixed.forEach((name) => {
    const it = mk(name), k = open.findIndex((l) => !l.hasItem() && B.places[l.zplace].forbids.indexOf(name) < 0);
    if (k < 0) throw new Error('no Zelda 1 place for ' + name);
    open[k].setItem(it); open.splice(k, 1);
  });
  const advP = world.getAdvancementItems.bind(world), niceP = world.getNiceItems.bind(world);
  world.getAdvancementItems = () => advP().concat(adv.map(mk));
  world.getNiceItems = () => niceP().concat(nice.map(mk));
  const total = world.getTotalItemCount.bind(world);
  world.getTotalItemCount = () => total() - locs.length - events.length;
  if (opts.goal === 'both' || opts.goal === 'z1') {
    const g = world.getLocation('Ganon'), req = g.requirement_callback, zelda = zeName('Zelda');
    g.setRequirements((locations, items) => items.has(zelda) && (!req || req(locations, items)));
  }
  world.getLocations().each((l) => {
    if (l.region === R || l instanceof Location.Chest) return;
    const f = l.fill_callback;
    l.setFillRules((item, locations, items) => !(item instanceof Z1Item) && (!f || f(item, locations, items)));
  });
  B.places.forEach((p) => { LANG.hint.location['Zelda 1 · ' + p.name] = 'can be found in another Hyrule'; });
  return R;
}

export async function generate({ jp, z1, seed, options: opt, zora: zo, stage }) {
  addLang();
  const o = options(opt), say = stage || (() => {});
  if (!checkJp(jp)) throw new Error('That isn’t the Japanese 1.0 A Link to the Past ROM (the one alttpr.com uses).');
  const zn = ZG.normalize(z1);
  if (!zn || zn.kind !== 'z1') throw new Error('That isn’t The Legend of Zelda (USA).');
  const base = await buildBase(jp);
  let res = null, s = seed || (Math.random() * 0x7FFFFFFF | 0) + 1, err = null;
  // ZORA mode: ZORA builds Zelda 1 first (its layout, its places and their rules)
  let B = null, ZR = null;
  const build = async (n) => {
    say('ZORA is building Zelda 1…');
    B = (await ZR.ask('build', { bytes: zn.bytes, seed: n, flags: zo.flags, zoraFlags: zo.zoraFlags || '' })).build;
    say('Placing both games’ items…');
  };
  if (zo) { say('Starting ZORA (the first time takes a little while)…'); ZR = await import('./zora.js'); await build(s); }
  for (let t = 0; t < 12 && !res; t++) {
    try { res = attempt(o, s, B); } catch (e) {
      err = e; if (seed) break;
      s = (Math.random() * 0x7FFFFFFF | 0) + 1;
      if (zo && t % 3 === 2) await build(s);   // a few tries with this Zelda 1, then another
    }
  }
  if (!res) throw new Error('Couldn’t make a seed' + (seed ? ' with seed ' + seed : '') + ': ' + (err && err.message || err));
  const { world, rom, R } = res;

  // Zelda 1's items in ALttP's chests: a look-alike each, different from everything else in that room
  const roomOf = (l) => { const a = l.address[0]; return base[a - 2] | (base[a - 1] & 0x7F) << 8; };
  const chests = [], byRoom = new Map();
  world.getLocations().each((l) => { if (l instanceof Location.Chest && l.hasItem()) { const r = roomOf(l); if (!byRoom.has(r)) byRoom.set(r, []); byRoom.get(r).push(l); } });
  const swapped = [];
  byRoom.forEach((list, room) => {
    const used = new Set(list.filter((l) => !(l.getItem() instanceof Z1Item)).map((l) => l.getItem().getTarget().getBytes()[0]));
    list.filter((l) => l.getItem() instanceof Z1Item).forEach((l) => {
      const z = l.getItem();
      const look = LOOK.map((n) => Item.get(n, world)).find((it) => !used.has(it.getBytes()[0]));
      used.add(look.getBytes()[0]);
      chests.push({ room, id: look.getBytes()[0], type: z.z1, name: z.label, loc: l.getName().replace(/:\d+$/, '') });
      swapped.push([l, z]); l.setItem(look);
    });
  });
  world.writeToRom(rom);
  swapped.forEach(([l, z]) => l.setItem(z));
  const hash = seedHash(s);
  rom.setSeedString(('VT ' + hash).padEnd(21, ' '));
  rom.setStartScreenHash(hash_array(s % 33554431));
  const z3 = base;
  for (const w of rom.getWriteLog()) for (const [off, bytes] of Object.entries(w)) z3.set(bytes, Number(off));
  z3[0x180033] = 0x40;   // heart beep: half
  z3[0x18021A] = 0x00;   // music on
  checksum(z3);

  const other = (it) => ({ game: 'z3', name: it.getTarget().getRawName(), nice: it.getTarget().getNiceName() });
  let at, z1rom, zoraMeta = null;
  if (!B) {
    // Zelda 1's spots: its own items, or a rupee for an ALttP item (handed over by the page)
    at = Z.SPOTS.map((sp, i) => {
      const it = R.getLocations().filter((l) => l.z1spot === i).first().getItem();
      return it instanceof Z1Item ? { game: 'z1', type: it.z1 } : other(it);
    });
    z1rom = ZG.writeZelda(zn.bytes, at);
  } else {
    // ZORA's places: its own items by name, or FOREIGN (null: ALttP's, a rupee there); the Zelda 1
    // items in ALttP's chests are "received" (ZORA's check counts them as Link's)
    const byPlace = new Map();
    R.getLocations().each((l) => { if (l.zplace !== undefined) byPlace.set(l.zplace, l); });
    const assignment = {};
    at = B.places.map((p, i) => {
      const it = byPlace.get(i).getItem();
      assignment[p.name] = it instanceof Z1Item ? it.label : null;
      return Object.assign(it instanceof Z1Item ? { game: 'z1', type: it.z1, name: it.label } : other(it), { place: p.name, check: p.check });
    });
    say('ZORA is writing Zelda 1…');
    z1rom = (await ZR.ask('finish', { assignment, received: chests.map((c) => c.name) })).rom;
    zoraMeta = { flags: B.flags, zoraFlags: B.zoraFlags, seed: B.seed, give: B.give, slots: B.slots, descriptors: B.descriptors, places: B.places.map((p) => ({ name: p.name, kind: p.kind, check: p.check })) };
  }

  const spoiler = spoilerText(world, s, hash, o, at, chests, B);
  const meta = { seed: String(s), hash, options: o, generator: 'Z1Z3', made: Date.now(), portal: portalFor(o.mode), zora: zoraMeta };
  return { seed: s, hash, rom: z3, z1: z1rom, at, chests, spoiler, meta };
}

function spoilerText(world, seed, hash, o, at, chests, B) {
  const out = ['Z1Z3 (Rando Hub): A Link to the Past + Zelda 1', 'Seed ' + seed + '  ' + hash, '',
    'Settings: ' + OPTIONS.map((d) => d.label + ': ' + (d.values.find((v) => v[0] === o[d.key]) || [])[1]).join(' · '), '',
    'Portal to Zelda 1: ' + portalFor(o.mode).name + ' (' + portalFor(o.mode).region + '). Back: ' + (o.exits === 'exits' ? 'a “take any road” cave' : '⇄ anywhere (or P)') + '.', ''];
  if (B) {
    out.push('Zelda 1: ZORA ' + B.flags + (B.zoraFlags ? ' ' + B.zoraFlags : '') + ', its seed ' + B.seed, '', 'Zelda 1 (its places):');
    at.forEach((it) => out.push('  ' + it.place + ': ' + (it.game === 'z1' ? it.name : it.nice + ' (ALttP)')));
  } else {
    out.push('Zelda 1 (its spots):');
    Z.SPOTS.forEach((s, i) => { const it = at[i]; out.push('  ' + s[1] + ': ' + (it.game === 'z1' ? Z.NAMES[it.type] : it.nice + ' (ALttP)')); });
  }
  out.push('', 'Zelda 1’s items in Hyrule (ALttP):');
  chests.forEach((c) => out.push('  ' + c.loc + ': ' + c.name));
  out.push('');
  for (const region of Object.values(world.getRegions())) {
    if (region.getName() === 'Zelda 1') continue;
    const lines = [];
    region.getLocations().each((l) => {
      if (l instanceof Location.Prize.Event || l instanceof Location.Trade || !l.hasItem()) return;
      lines.push('  ' + l.getName().replace(/:\d+$/, '') + ': ' + l.getItem().getTarget().getNiceName());
    });
    if (lines.length) out.push(region.getName() + ':', ...lines, '');
  }
  return out.join('\n');
}

window.Z1Z3Gen = { generate, OPTIONS, options, checkJp, checksum, PORTAL, portalFor, GIVEABLE };
