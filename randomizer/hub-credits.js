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
import { Credits } from './core/credits.js';

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

// Seeds made elsewhere (Kara's branch, AVIANART, alttpr.com) arrive with their own
// ending. Every generator writes it the same way (alttpr's Credits.php, z3randomizer,
// Kara's Text.py): 16 scenes in a fixed order, each a run of text records at
// 0x181500, with a 16-bit pointer per scene (and one past the end) at 0x76CC0.
// Our seven scenes are drawn again; the others are kept byte for byte, so item
// hints and the seed's own jokes stay. Done only when the pointers look right and
// the result fits in the space the generator used. Returns true if it changed.
const SCENE_ORDER = ['castle', 'sanctuary', 'kakariko', 'desert', 'hera', 'house', 'zora', 'witch',
  'lumberjacks', 'grove', 'well', 'smithy', 'kakariko2', 'bridge', 'woods', 'pedestal'];
const DATA_AT = 0x181500, PTR_AT = 0x76CC0;
export function patchRomCredits(rom) {
  const off = rom.length % 1024 === 512 ? 512 : 0;   // a copier header
  if (rom.length < off + DATA_AT + 0x800) return false;
  const ptr = [];
  for (let i = 0; i <= SCENE_ORDER.length; i++) ptr.push(rom[off + PTR_AT + i * 2] | (rom[off + PTR_AT + i * 2 + 1] << 8));
  if (ptr[0] !== 0) return false;
  for (let i = 1; i < ptr.length; i++) if (ptr[i] < ptr[i - 1] || ptr[i] > 0x800) return false;
  const total = ptr[ptr.length - 1];
  const want = Object.fromEntries(HUB_CREDITS.map(([scene, small, large]) => [scene, [small, large]]));
  const C = new Credits();
  const out = [], newPtr = [];
  SCENE_ORDER.forEach((scene, i) => {
    newPtr.push(out.length);
    if (want[scene]) {
      C.updateCreditLine(scene, 0, want[scene][0]);
      C.updateCreditLine(scene, 1, want[scene][1]);
      const [sm, lg] = C.scenes[scene];
      out.push(...C.getSmallConverted(sm), ...C.getLargeConverted(lg));
    } else {
      for (let b = ptr[i]; b < ptr[i + 1]; b++) out.push(rom[off + DATA_AT + b]);
    }
  });
  newPtr.push(out.length);
  if (out.length > total) return false;                // never write past what the generator used
  for (let b = 0; b < total; b++) rom[off + DATA_AT + b] = b < out.length ? out[b] : 0;
  newPtr.forEach((v, i) => { rom[off + PTR_AT + i * 2] = v & 0xFF; rom[off + PTR_AT + i * 2 + 1] = v >> 8; });
  return true;
}
