// Run with bun from inside Muffins' tracker source (copied there at build time):
// writes the map squares (where each sits, which locations are inside) and the
// dungeon list as JSON, for Mudora 2.0. Reads his data; changes nothing.
import { baseLocationsData } from "@/data/locationsData";
import { getAllPossibleLocations, getDungeonIdForEntry, isSecondaryEntrance, isReplacedByEntrances } from "@/lib/logic/locationMapper";
import { DungeonsData } from "@/data/dungeonData";

const out: { entries: Record<string, unknown>; dungeons: Record<string, unknown> } = { entries: {}, dungeons: {} };
for (const [k, v] of Object.entries(baseLocationsData)) {
  out.entries[k] = {
    x: v.x, y: v.y, world: v.world, isDungeon: v.isDungeon, overworld: v.overworld, entrance: !!v.entrance,
    secondary: isSecondaryEntrance(k), replaced: isReplacedByEntrances(k), dungeon: getDungeonIdForEntry(k) || null,
    shopsanity: v.shopsanity, pots: v.pots, enemies: v.enemies, bonk: v.bonk,
    locs: getAllPossibleLocations(k),
  };
}
for (const [k, v] of Object.entries(DungeonsData)) out.dungeons[k] = { name: v.name, total: v.totalLocations, more: v.additionalEntries || [] };
console.log(JSON.stringify(out));
