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
 *   Z1Z3Gen.generate({ jp, z1, seed, options }) → Promise<{ seed, hash, rom, z1, at, chests, spoiler, meta }>
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
export const OPTIONS = [
  { key: 'mode', label: 'World state', def: 'open', values: [['open', 'Open'], ['standard', 'Standard (the escape first)']] },
  { key: 'goal', label: 'Goal', def: 'both', values: [['both', 'Both Ganons (A Link to the Past’s and Zelda 1’s)'], ['z3', 'A Link to the Past’s Ganon'], ['z1', 'Zelda 1’s Ganon (and ALttP’s Ganon still ends it)']] },
  { key: 'crystals', label: 'Crystals for Ganon’s Tower and Ganon', def: '7', values: [['7', '7 and 7'], ['6', '6 and 6'], ['5', '5 and 5'], ['4', '4 and 4'], ['random', 'Random']] },
  { key: 'weapons', label: 'Swords (ALttP)', def: 'randomized', values: [['randomized', 'Randomized'], ['assured', 'Assured (start with one)'], ['vanilla', 'Vanilla spots'], ['swordless', 'Swordless']] },
  { key: 'dungeon_items', label: 'ALttP dungeon items', def: 'standard', values: [['standard', 'In their own dungeons'], ['mc', 'Maps and compasses anywhere'], ['mcs', 'Maps, compasses and small keys anywhere'], ['full', 'Keysanity (all anywhere)']] },
  { key: 'exits', label: 'Back to Kakariko from Zelda 1', def: 'anywhere', values: [['anywhere', '⇄ anywhere (or P)'], ['exits', 'Only in a “take any road” cave']] },
];
export function options(o) { const out = {}; OPTIONS.forEach((d) => { out[d.key] = o && d.values.some((v) => v[0] === o[d.key]) ? o[d.key] : d.def; }); return out; }

export function checkJp(bytes) {
  let b = bytes && bytes.length % 1024 === 512 ? bytes.subarray(512) : bytes;
  if (!b || b.length < 0x100000) return '';
  if (b.length > 0x100000) b = b.subarray(0, 0x100000);
  return md5(b) === JP10_MD5 ? 'jp' : '';
}

// ── the Kakariko portal and Zelda 1's region ───────────────────────────────
// The Elder's House (either door): found by the door Link came in by ($7E:010E), as Rando Cross does
export const PORTAL = { name: 'the Elder’s House (either door)', region: 'Light World: Kakariko', entrances: [0x0D, 0x0E] };

const zName = (t) => 'Z1_' + t.toString(16).toUpperCase().padStart(2, '0');
const zType = (name) => parseInt(String(name).replace(/^Z1_/, '').replace(/:.*$/, ''), 16);
class Z1Item extends Item {
  constructor(type, world) { super(zName(type), [0x36], world); this.z1 = type; }
  getNiceName() { return (Z.NAMES[this.z1] || 'Zelda 1 item') + ' (Zelda 1)'; }
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
  R.can_enter = (locations, items) => items.has('RescueZelda');
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

function attempt(o, seed) {
  Item.clearCache(); Boss.clearCache(); World.max_world = 1; seedRng(seed);
  const crystals = o.crystals === 'random' ? String(getRandomInt(0, 7)) : o.crystals;
  const di = o.dungeon_items;
  const world = World.factory(o.mode, {
    itemPlacement: 'advanced', dungeonItems: di, accessibility: 'items', goal: 'ganon',
    'crystals.ganon': crystals, 'crystals.tower': crystals, entrances: 'none', 'mode.weapons': o.weapons,
    tournament: false, spoilers: 'on', allow_quickswap: true, override_start_screen: false, pseudoboots: false,
    'spoil.Hints': 'on', logic: 'NoGlitches', 'item.pool': 'normal', 'item.functionality': 'normal',
    'enemizer.bossShuffle': 'none', 'enemizer.enemyShuffle': 'none', 'enemizer.enemyDamage': 'default', 'enemizer.enemyHealth': 'default', 'enemizer.potShuffle': 'off',
  });
  const R = addZelda1(world, o);
  const rom = new Rom();
  const rand = new Z1Z3Randomizer([world]);
  rand.randomize();
  if (!new WorldCollection(rand.getWorlds()).isWinnable()) throw new Error('not beatable');
  return { world, rom, R };
}

export async function generate({ jp, z1, seed, options: opt }) {
  addLang();
  const o = options(opt);
  if (!checkJp(jp)) throw new Error('That isn’t the Japanese 1.0 A Link to the Past ROM (the one alttpr.com uses).');
  const zn = ZG.normalize(z1);
  if (!zn || zn.kind !== 'z1') throw new Error('That isn’t The Legend of Zelda (USA).');
  const base = await buildBase(jp);
  let res = null, s = seed || (Math.random() * 0x7FFFFFFF | 0) + 1, err = null;
  for (let t = 0; t < 12 && !res; t++) {
    try { res = attempt(o, s); } catch (e) { err = e; if (seed) break; s = (Math.random() * 0x7FFFFFFF | 0) + 1; }
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
      chests.push({ room, id: look.getBytes()[0], type: z.z1, name: Z.NAMES[z.z1], loc: l.getName().replace(/:\d+$/, '') });
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

  // Zelda 1's spots: its own items, or a rupee for an ALttP item (handed over by the page)
  const at = Z.SPOTS.map((sp, i) => {
    const it = R.getLocations().filter((l) => l.z1spot === i).first().getItem();
    return it instanceof Z1Item ? { game: 'z1', type: it.z1 } : { game: 'z3', name: it.getTarget().getRawName(), nice: it.getTarget().getNiceName() };
  });
  const z1rom = ZG.writeZelda(zn.bytes, at);

  const spoiler = spoilerText(world, s, hash, o, at, chests);
  const meta = { seed: String(s), hash, options: o, generator: 'Z1Z3', made: Date.now(), portal: PORTAL };
  return { seed: s, hash, rom: z3, z1: z1rom, at, chests, spoiler, meta };
}

function spoilerText(world, seed, hash, o, at, chests) {
  const out = ['Z1Z3 (Rando Hub): A Link to the Past + Zelda 1', 'Seed ' + seed + '  ' + hash, '',
    'Settings: ' + OPTIONS.map((d) => d.label + ': ' + (d.values.find((v) => v[0] === o[d.key]) || [])[1]).join(' · '), '',
    'Portal to Zelda 1: ' + PORTAL.name + ' (Kakariko). Back: ' + (o.exits === 'exits' ? 'a “take any road” cave' : '⇄ anywhere (or P)') + '.', ''];
  out.push('Zelda 1 (its spots):');
  Z.SPOTS.forEach((s, i) => { const it = at[i]; out.push('  ' + s[1] + ': ' + (it.game === 'z1' ? Z.NAMES[it.type] : it.nice + ' (ALttP)')); });
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

window.Z1Z3Gen = { generate, OPTIONS, options, checkJp, checksum, PORTAL, GIVEABLE };
