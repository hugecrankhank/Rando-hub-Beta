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
import { getLocations } from "$DASH/packages/core/lib/locations";
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
