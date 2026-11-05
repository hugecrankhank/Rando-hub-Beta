/*
 * data.js — Zelda 1 + Metroid, linked: the Zelda side's tables (the Metroid
 * side is ../metroid/js/data.js, loaded with this page).
 *
 * The Zelda ROM (The Legend of Zelda (USA), first quest):
 *   dungeon rooms: 6 tables of 0x80 per grid (levels 1–6 at 0x18700, 7–9 at
 *     0x18A00, file offsets + 16 for the header); table 4 (+0x200) low 5 bits
 *     is the room's item ($03 = nothing), the other bits stay;
 *   caves: 20 caves × 3 wares at 0x18600 + 16 (cave = destination − $10;
 *     low 6 bits the item, the top two bits stay); the sword and letter caves
 *     hold theirs in the middle slot;
 *   the Armos item at 0x10CF5 + 16, the coast item at 0x1788A + 16.
 *
 * RAM ($00xx..$07xx): $10 level, $12 mode (5 play, $B cave), $EB room/screen,
 *   $0657.. inventory, $066F hearts (high nibble: containers − 1), $0671
 *   triforces; $067F world flags: overworld screens, then levels 1–6 (+$80),
 *   7–9 (+$100): bit $10 = the room's / the cave's item taken.
 *
 * ZELDA spots: [key, name, kind, where, vanilla item, requirement]
 *   kind 'room' where = [grid (0 levels 1–6, 1 levels 7–9), room, level]
 *   kind 'cave' where = destination; 'armos' / 'coast' fixed
 *   requirement: keys all needed (an inner list: one of); the logic keys are
 *   SW (a sword), BOW, RAFT, LAD (ladder), REC (recorder), T8 (all eight
 *   triforces), and the Metroid ones (../metroid/js/logic.js). Shop wares
 *   (bombs, the blue candle, arrows, bait) count as always to hand.
 */
(function () {
  'use strict';
  const ROM = { size: 131088, crc32: '02bb0c56', name: 'The Legend of Zelda (USA)' };   // Rev 1 (with its header); a Rev 0 is taken too when its tables match (FINGERPRINT)
  const FINGERPRINT = [[0x18611, 0x01], [0x18617, 0x02], [0x18629, 0x15], [0x18910 + 0x7F, 0x0A], [0x10D05, 0x14], [0x1789A, 0x1A]];
  const IT = { BOMBS: 0x00, WOOD_SWORD: 0x01, WHITE_SWORD: 0x02, MAGICAL_SWORD: 0x03, BAIT: 0x04, RECORDER: 0x05, BLUE_CANDLE: 0x06, RED_CANDLE: 0x07, WOOD_ARROWS: 0x08, SILVER_ARROWS: 0x09,
    BOW: 0x0A, MAGICAL_KEY: 0x0B, RAFT: 0x0C, LADDER: 0x0D, TRIFORCE_OF_POWER: 0x0E, FIVE_RUPEES: 0x0F, WAND: 0x10, BOOK: 0x11, BLUE_RING: 0x12, RED_RING: 0x13, POWER_BRACELET: 0x14,
    LETTER: 0x15, COMPASS: 0x16, MAP: 0x17, KEY: 0x19, HEART_CONTAINER: 0x1A, TRIFORCE: 0x1B, MAGICAL_SHIELD: 0x1C, WOOD_BOOMERANG: 0x1D, MAGICAL_BOOMERANG: 0x1E, BLUE_POTION: 0x1F, RED_POTION: 0x20 };
  const NAMES = { 0x01: 'Wood Sword', 0x02: 'White Sword', 0x03: 'Magical Sword', 0x05: 'Recorder', 0x07: 'Red Candle', 0x09: 'Silver Arrows', 0x0A: 'Bow', 0x0B: 'Magical Key', 0x0C: 'Raft', 0x0D: 'Ladder',
    0x10: 'Wand', 0x11: 'Book of Magic', 0x13: 'Red Ring', 0x14: 'Power Bracelet', 0x15: 'Letter', 0x1A: 'Heart Container', 0x1D: 'Boomerang', 0x1E: 'Magical Boomerang', 0x0F: 'Five Rupees' };
  // what each item gives Link (RAM): [address, value or 'max' (keep the higher) or '+1']
  const GIVE = { 0x01: [0x657, 'max', 1], 0x02: [0x657, 'max', 2], 0x05: [0x65C, 1], 0x07: [0x65B, 2], 0x09: [0x659, 2], 0x0A: [0x65A, 1], 0x0B: [0x664, 1], 0x0C: [0x660, 1], 0x0D: [0x663, 1],
    0x10: [0x65F, 1], 0x11: [0x661, 1], 0x13: [0x662, 2], 0x14: [0x665, 1], 0x15: [0x666, 'max', 1], 0x1A: ['hc'], 0x1D: [0x674, 1], 0x1E: [0x675, 1] };
  // the logic key an item gives
  const KEY = { 0x01: 'SW', 0x02: 'SW', 0x0A: 'BOW', 0x0C: 'RAFT', 0x0D: 'LAD', 0x05: 'REC' };
  const PLACEHOLDER = IT.FIVE_RUPEES;   // a Metroid item in Hyrule looks like a rupee; the hub hands the real item over

  // the triforces (not shuffled) and what each boss needs: T8 = all of them
  const TRIFORCE = [['SW'], [], ['SW'], ['RAFT', 'LAD', 'SW'], ['REC', 'SW'], ['LAD', 'BOW', 'SW'], ['REC', 'SW'], ['LAD', 'SW']];

  const SPOTS = [
    ['z-l1-boom', 'Level 1 – Boomerang room', 'room', [0, 0x44, 1], IT.WOOD_BOOMERANG, []],
    ['z-l1-bow', 'Level 1 – Bow (basement)', 'room', [0, 0x7F, 1], IT.BOW, []],
    ['z-l2-mboom', 'Level 2 – Magical Boomerang room', 'room', [0, 0x4F, 2], IT.MAGICAL_BOOMERANG, []],
    ['z-l3-raft', 'Level 3 – Raft (basement)', 'room', [0, 0x0F, 3], IT.RAFT, []],
    ['z-l4-lad', 'Level 4 – Ladder (basement)', 'room', [0, 0x60, 4], IT.LADDER, ['RAFT']],
    ['z-l5-rec', 'Level 5 – Recorder (basement)', 'room', [0, 0x04, 5], IT.RECORDER, []],
    ['z-l6-wand', 'Level 6 – Wand (basement)', 'room', [0, 0x75, 6], IT.WAND, ['LAD']],
    ['z-l7-rc', 'Level 7 – Red Candle (basement)', 'room', [1, 0x4A, 7], IT.RED_CANDLE, ['REC', 'LAD']],
    ['z-l8-mk', 'Level 8 – Magical Key (basement)', 'room', [1, 0x0F, 8], IT.MAGICAL_KEY, ['LAD']],
    ['z-l8-book', 'Level 8 – Book (basement)', 'room', [1, 0x6F, 8], IT.BOOK, ['LAD']],
    ['z-l9-ring', 'Level 9 – Red Ring (basement)', 'room', [1, 0x00, 9], IT.RED_RING, ['T8', 'LAD', 'SW']],
    ['z-l9-silv', 'Level 9 – Silver Arrows (basement)', 'room', [1, 0x4F, 9], IT.SILVER_ARROWS, ['T8', 'LAD', 'SW']],
    ['z-wood', 'Wood Sword cave', 'cave', 0x10, IT.WOOD_SWORD, []],
    ['z-white', 'White Sword cave (5 hearts)', 'cave', 0x12, IT.WHITE_SWORD, ['SW']],
    ['z-letter', 'Letter cave', 'cave', 0x18, IT.LETTER, []],
    ['z-armos', 'Armos (the knight’s secret)', 'armos', null, IT.POWER_BRACELET, []],
    ['z-coast', 'Coast (ladder)', 'coast', null, IT.HEART_CONTAINER, ['LAD']],
  ];
  // the caves' screens (first quest) and the two overworld items', for the tracker
  const CAVE_SCREEN = { 0x10: 0x77, 0x12: 0x0A, 0x13: 0x21, 0x18: 0x0E };
  const ARMOS_SCREEN = 0x24, COAST_SCREEN = 0x5F;
  // the portals: Hyrule's four "take any road" caves (open caves, entered from these screens)
  const PORTAL_SCREENS = [0x1D, 0x23, 0x49, 0x79];
  const RAM = { LEVEL: 0x10, MODE: 0x12, ROOM: 0xEB, HEARTS: 0x66F, TRIFORCE: 0x671, WORLD: 0x67F, RUPEES: 0x66D, LINK_X: 0x70, LINK_Y: 0x84 };

  window.ZM = { ROM, FINGERPRINT, IT, NAMES, GIVE, KEY, PLACEHOLDER, TRIFORCE, SPOTS, CAVE_SCREEN, ARMOS_SCREEN, COAST_SCREEN, PORTAL_SCREENS, RAM,
    OFF: { GRID: [0x18710, 0x18A10], CAVES: 0x18610, ARMOS: 0x10D05, COAST: 0x1789A } };
})();
