// Rando Hub's names in the game's own ending (the scene captions), for seeds
// made in the hub. Only the joke captions are used (randomizer.js
// randomizeCredits); the ones that hint at items (pedestal, grove, house,
// kakariko2, witch, zora) are left alone. Written after the seed is made, so
// the seed itself (and its random numbers) doesn't change.
//
// The small line's font has lowercase letters, space , . - ' only; the big
// line's letters, ' ! and _ (randomizer/core/credits.js). No digits or @, so
// TikTok handles go on the hub's Credits page (credits.js) instead.
// Keep in step with credits.js.
export const HUB_CREDITS = [
  ['castle', 'rando hub by', 'huge_crank_hank'],
  ['sanctuary', 'playtested by', 'Gumby'],
  ['kakariko', 'playtested by', 'HydeOutGaming'],
  ['lumberjacks', 'playtested by', "Heffie's Homies"],
  ['bridge', 'tracker by', 'Hutch'],
  ['woods', 'randomizer branch by', 'Kara'],
  ['well', 'tracker logic by', 'Muffins'],
];

// Before world.writeToRom(rom): the small lines through the world (like the
// randomizer's own captions), the big lines straight into the ROM's credits.
export function applyHubCredits(world, rom) {
  for (const [scene, small, large] of HUB_CREDITS) {
    world.setCredit(scene, small);
    if (rom.credits) rom.credits.updateCreditLine(scene, 1, large);
  }
}
