// Rando Hub's entry into DASH's core (packages/core, MIT): one call makes a
// seed from the vanilla ROM bytes, and the spoiler the way dashrando.net
// writes it (apps/web/lib/spoiler.ts).
import RandomizeRom from "$DASH/packages/core/lib/randomize";
import BpsPatch from "$DASH/packages/core/lib/bps-patch";
import { getAllPresets, getPreset } from "$DASH/packages/core/lib/presets";
import { getSignature, isHeadered, isVerified } from "$DASH/packages/core/lib/vanilla";
import { getSeedNumber } from "$DASH/packages/core/lib/sm-rando";
import { getAreaPortals } from "$DASH/packages/core/lib/graph/data/portals";
import { isAreaEdge, isBossEdge } from "$DASH/packages/core/data/doors";
import { BeamMode, BossMode, MapLayout, MajorDistributionMode, MinorDistributionMode, SuitMode, GravityHeatReduction } from "$DASH/packages/core/lib/params";
import { generateSeed } from "$DASH/packages/core/lib/graph/fill";
import { Item } from "$DASH/packages/core/lib/items";
import { getLocations, getArea } from "$DASH/packages/core/lib/locations";
import { bytesToParams, ENCODED_PARAMS_SIZE } from "$DASH/packages/core/lib/params";
import { TABLE_FLAGS } from "$DASH/packages/core/data/interface";
import { createLoadout, addItem, checkFlags } from "$DASH/packages/core/lib/loadout";
import type { Settings, Options } from "$DASH/packages/core/lib/params";
import type { Graph, Vertex } from "$DASH/packages/core/lib/graph/init";

export { getLocations, getAllPresets, getPreset, getSignature, isHeadered, isVerified, getSeedNumber, BeamMode, BossMode, MapLayout, MajorDistributionMode, MinorDistributionMode, SuitMode, GravityHeatReduction, Item };

// the base patches live next to this bundle
let patchBase = "";
export const setPatchBase = (url: string) => { patchBase = url; };
const origLoad = BpsPatch.Load;
BpsPatch.Load = (name: string) => origLoad(patchBase + name.replace(/^\/patches\//, ""));

const areaTransitions = (graph: Graph) => {
  const edges = graph.filter(isAreaEdge);
  const obj: any = {};
  getAreaPortals().forEach((p) => {
    const e = edges.find((x) => x.from.name === p.name);
    obj[p.name.replace("Door_", "")] = e ? e.to.name.replace("Door_", "") : "";
  });
  return obj;
};
const bosses = (graph: Graph) => {
  const edges = graph.filter(isBossEdge).filter((p) => p.to.type == "exit");
  const boss = (loc: string) => { const e = edges.find((p) => p.from.name === `Door_${loc}Boss`); return e ? e.to.name.slice(5) : ""; };
  return { "Kraid's Lair": boss("Kraid"), "Wrecked Ship": boss("Phantoon"), "East Maridia": boss("Draygon"), "Lower Norfair": boss("Ridley") };
};
const items = (graph: Graph) => {
  const vs = graph.map((e) => e.from).filter((v) => v.type == "major" || v.type == "minor").filter((v, i, a) => a.indexOf(v) === i);
  const by = (area: string) => {
    const obj: any = {};
    vs.filter((p) => p.area === area).sort((a, b) => a.type !== b.type ? a.type.localeCompare(b.type) : a.name.localeCompare(b.name))
      .forEach((v) => { obj[v.name] = v.item ? v.item.name : ""; });
    return obj;
  };
  const areas: [string, string][] = [["Crateria", "Crateria"], ["Green Brinstar", "GreenBrinstar"], ["Red Brinstar", "RedBrinstar"], ["Kraid's Lair", "KraidsLair"], ["Crocomire's Lair", "CrocomiresLair"],
    ["Wrecked Ship", "WreckedShip"], ["West Maridia", "WestMaridia"], ["East Maridia", "EastMaridia"], ["Upper Norfair", "UpperNorfair"], ["Lower Norfair", "LowerNorfair"]];
  const out: any = {}; areas.forEach(([n, k]) => { out[n] = by(k); }); return out;
};
// every item spot with its area, type and the item placed there (for the tracker)
const placed = (graph: Graph) => {
  const vs = graph.map((e) => e.from).filter((v) => v.type == "major" || v.type == "minor").filter((v, i, a) => a.indexOf(v) === i);
  return vs.map((v) => ({ name: v.name, area: v.area, type: v.type, item: v.item ? v.item.name : "" }));
};

export async function generate(vanilla: Uint8Array, seed: number, settings: Settings, options: Options, presetName: string) {
  const graph = generateSeed(seed, settings, options);
  const res = await RandomizeRom(seed, settings, options, { vanillaBytes: vanilla, presetName }, false, graph);
  return { data: res.data, name: res.name, hash: res.hash, spoiler: { Bosses: bosses(graph), "Area Transitions": areaTransitions(graph), Items: items(graph) }, placed: placed(graph) };
}

// ── logic for the tracker (sm/js/logic.js): which item spots DASH's own rules
// say Samus can reach, and get back from, with what she has now ─────────────
//
// DASH writes the seed number and every setting into the ROM (7 bytes at
// TABLE_FLAGS.SeedFlags, 0x2F8B00; race seeds blank the first four). From
// them the same graph the seed was made with is built again (generateSeed is
// deterministic), and checked against the item bytes in the ROM, so a ROM made
// anywhere (dashrando.net, another copy of the hub) gets the same logic, and a
// ROM that isn't that seed is refused rather than guessed at.
const SEED_FLAGS = TABLE_FLAGS.SeedFlags;
export function readSeedParams(rom: Uint8Array) {
  if (rom.length < SEED_FLAGS + 12) return { error: "not a Super Metroid ROM" };
  const b = rom.subarray(SEED_FLAGS, SEED_FLAGS + 12);
  for (let i = ENCODED_PARAMS_SIZE; i < 12; i++) if (b[i] !== 0xee) return { error: "not a DASH seed" };
  if (b[0] === 0xee && b[1] === 0xee && b[2] === 0xee && b[3] === 0xee) return { error: "a race seed: its settings are hidden" };
  try {
    const p = bytesToParams(b);
    if (!(p.seed >= 1 && p.seed <= 1000000)) return { error: "not a DASH seed" };
    return p;
  } catch (e) { return { error: "not a DASH seed (" + String((e as any)?.message || e) + ")" }; }
}

let logicGraph: Graph | null = null;
let logicStart: Vertex | null = null;
let logicBosses: Record<string, string> = {};

// Builds the seed's graph; with the ROM, checks every item spot's bytes agree.
export function logicLoad(seed: number, settings: Settings, options: Options, rom?: Uint8Array) {
  const graph = generateSeed(seed, settings, options);
  if (rom) {
    let bad = 0, n = 0;
    getLocations().forEach((l) => {
      const v = graph.find((e) => e.from.name == l.name && getArea(e.from.area) == l.area)?.from;
      if (!v || !v.item) return;
      n++;
      const want = l.GetItemBytes(v.item.type);
      if (rom[l.address] !== want[0] || rom[l.address + 1] !== want[1]) bad++;
    });
    if (!n || bad) { logicGraph = null; return { ok: false, error: bad ? "the ROM's items don't match seed " + seed + " (" + bad + " of " + n + " differ)" : "no items found" }; }
  }
  logicGraph = graph;
  logicStart = graph[0].from;
  logicBosses = bosses(graph);
  return { ok: true, seed, settings, options, placed: placed(graph), spoiler: { Bosses: logicBosses, "Area Transitions": areaTransitions(graph), Items: items(graph) } };
}
export function logicLoaded() { return !!logicGraph; }

// What Samus has, from the game (sm/js/tracker.js reads it) → DASH's loadout.
// gear: DASH item names; packs are counts; bosses: dead, by the boss's name.
export type Inventory = { gear: string[]; missiles: number; supers: number; pbs: number; etanks: number; reserves: number; bosses: Record<string, boolean>; minis: Record<string, boolean> };
const GEAR_ITEM: Record<string, number> = {
  Morph: Item.Morph, Bombs: Item.Bombs, SpringBall: Item.SpringBall, ScrewAttack: Item.ScrewAttack, Varia: Item.Varia, Gravity: Item.Gravity,
  HJB: Item.HJB, SpaceJump: Item.SpaceJump, Speed: Item.Speed, Grapple: Item.Grapple, Xray: Item.Xray,
  Charge: Item.Charge, Ice: Item.Ice, Wave: Item.Wave, Spazer: Item.Spazer, Plasma: Item.Plasma,
  DoubleJump: Item.DoubleJump, HeatShield: Item.HeatShield, PressureValve: Item.PressureValve,
};
const BOSS_AT: [string, string, number][] = [["Kraid's Lair", "Kraid", Item.DefeatedBrinstarBoss], ["Wrecked Ship", "Phantoon", Item.DefeatedWreckedShipBoss], ["East Maridia", "Draygon", Item.DefeatedMaridiaBoss], ["Lower Norfair", "Ridley", Item.DefeatedNorfairBoss]];
const MINI_ITEM: Record<string, number> = { SporeSpawn: Item.DefeatedSporeSpawn, Crocomire: Item.DefeatedCrocomire, Botwoon: Item.DefeatedBotwoon, GoldTorizo: Item.DefeatedGoldTorizo };
function loadoutOf(inv: Inventory) {
  const load = createLoadout();
  (inv.gear || []).forEach((g) => { if (GEAR_ITEM[g] != null) addItem(load, GEAR_ITEM[g]); });
  const times = (n: number, t: number) => { for (let i = 0; i < (n | 0); i++) addItem(load, t); };
  times(inv.missiles, Item.Missile); times(inv.supers, Item.Super); times(inv.pbs, Item.PowerBomb); times(inv.etanks, Item.EnergyTank); times(inv.reserves, Item.Reserve);
  // the boss at each boss spot (shuffled or not); its own flag says whether it's dead
  BOSS_AT.forEach(([spot, vanilla, item]) => { const who = logicBosses[spot] || vanilla; if (inv.bosses && inv.bosses[who]) addItem(load, item); });
  Object.keys(MINI_ITEM).forEach((k) => { if (inv.minis && inv.minis[k]) addItem(load, MINI_ITEM[k]); });
  return load;
}

// For every item spot: "ok" (there and back), "back" (there, but no way back
// to the ship with what she has), "no". Nothing in the graph is changed.
export function logicReach(inv: Inventory) {
  if (!logicGraph || !logicStart) return null;
  const graph = logicGraph, test = checkFlags(loadoutOf(inv));
  const memo = new Map<any, boolean>();
  const open = (c: any) => { if (c === true) return true; let r = memo.get(c); if (r === undefined) { try { r = !!test(c); } catch (e) { r = false; } memo.set(c, r); } return r; };
  const fwd = new Map<Vertex, any[]>(), rev = new Map<Vertex, any[]>();
  graph.forEach((e) => { (fwd.get(e.from) || fwd.set(e.from, []).get(e.from))!.push(e); (rev.get(e.to) || rev.set(e.to, []).get(e.to))!.push(e); });
  const flood = (adj: Map<Vertex, any[]>, other: (e: any) => Vertex) => {
    const seen = new Set<Vertex>([logicStart!]), q = [logicStart!];
    for (let i = 0; i < q.length; i++) (adj.get(q[i]) || []).forEach((e) => { const v = other(e); if (!seen.has(v) && open(e.condition)) { seen.add(v); q.push(v); } });
    return seen;
  };
  const there = flood(fwd, (e) => e.to), back = flood(rev, (e) => e.from);
  const out: Record<string, string> = {};
  graph.forEach((e) => {
    const v = e.from;
    if (v.type !== "major" && v.type !== "minor") return;
    out[v.name + "|" + v.area] = there.has(v) ? (back.has(v) ? "ok" : "back") : "no";
  });
  return out;
}
