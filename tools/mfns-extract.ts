// Run with bun from inside Muffins' tracker source (copied there at build time):
// writes the map squares (where each sits, which locations are inside), the
// dungeon list and his entrance-shuffle rules as JSON, for Mudora 2.0. Reads
// his data and calls his own functions; changes nothing.
import { baseLocationsData, entranceLocations } from "@/data/locationsData";
import { getAllPossibleLocations, getDungeonIdForEntry, isSecondaryEntrance, isReplacedByEntrances } from "@/lib/logic/locationMapper";
import { DungeonsData } from "@/data/dungeonData";
import { getEntranceGroup, isHiddenPairedDoor, getActiveDropdownPairs } from "@/lib/dropdowns";
import { allConnectorEntrances, getConnectorGroup } from "@/data/entranceConnections";
import { getConnectorGroupSides } from "@/lib/entranceTrace";
import { defaultEntranceLabels } from "@/data/entranceLabels";

const out: { entries: Record<string, unknown>; dungeons: Record<string, unknown>; ent: Record<string, unknown> } = { entries: {}, dungeons: {}, ent: {} };
for (const [k, v] of Object.entries(baseLocationsData)) {
  out.entries[k] = {
    x: v.x, y: v.y, world: v.world, isDungeon: v.isDungeon, overworld: v.overworld, entrance: !!v.entrance,
    secondary: isSecondaryEntrance(k), replaced: isReplacedByEntrances(k), dungeon: getDungeonIdForEntry(k) || null,
    shopsanity: v.shopsanity, pots: v.pots, enemies: v.enemies, bonk: v.bonk,
    locs: getAllPossibleLocations(k),
  };
}
for (const [k, v] of Object.entries(DungeonsData)) out.dungeons[k] = { name: v.name, total: v.totalLocations, more: v.additionalEntries || [] };

// entrance shuffle: for each mode (and Zelga Woods on/off), each entrance's
// group ("vanilla" = not shuffled) and whether his map hides it (a door that
// moves with its hole); connector caves; his short labels
const MODES = ["dungeonssimple", "dungeonsfull", "lite", "lean", "simple", "restricted", "full", "district", "swapped", "crossed", "insanity"];
const names = Object.keys(entranceLocations);
const groups: Record<string, Record<string, string | null>> = {};
const hidden: Record<string, string[]> = {};
for (const m of MODES) for (const z of [false, true]) {
  const key = m + (z ? "|z" : "");
  groups[key] = {};
  hidden[key] = [];
  for (const n of names) {
    groups[key][n] = getEntranceGroup(n, m, z);
    if (isHiddenPairedDoor(n, m, z)) hidden[key].push(n);
  }
  // also the non-entrance squares that hold an entrance (shown unless shuffled)
  for (const k of Object.keys(baseLocationsData)) if (!(k in groups[key]) && baseLocationsData[k].entrance) groups[key][k] = getEntranceGroup(k, m, z);
}
const sides: Record<string, string[]> = {};
for (const n of allConnectorEntrances) { const s = getConnectorGroupSides(n); if (s) sides[n] = s; }
out.ent = {
  names, groups, hidden,
  connectors: allConnectorEntrances.filter((n) => !getConnectorGroup(n)?.isDropdown),
  sides,
  labels: defaultEntranceLabels,
  // a hole and its door move together (outside insanity): [hole, door]
  pairs: { "0": getActiveDropdownPairs(false).map((p) => [p.drop, p.partner]), "1": getActiveDropdownPairs(true).map((p) => [p.drop, p.partner]) },
};
console.log(JSON.stringify(out));
