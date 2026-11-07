/*
 * give.js — handing an A Link to the Past item to Link from outside the game:
 * written straight into his save as the game keeps it in work RAM
 * ($7E:F000..$7E:F4FF; the cartridge's copy follows at his next save), the
 * way alttpr.com's ROM gives each one. Used when Link (Zelda 1's) picks up an
 * ALttP item on a Zelda 1 spot (js/link.js); the game shows it at the next
 * menu or screen.
 *
 *   GIVEABLE        the item names (the randomizer's) a Zelda 1 spot may hold
 *   give(wram, name) → true when given
 */
const S = 0xF000;   // $7E:F000 in work RAM
const A = {
  bow: 0x340, boomerang: 0x341, hookshot: 0x342, bombs: 0x343, mushroom: 0x344, firerod: 0x345, icerod: 0x346, bombos: 0x347, ether: 0x348, quake: 0x349,
  lamp: 0x34A, hammer: 0x34B, flute: 0x34C, net: 0x34D, book: 0x34E, bottleSel: 0x34F, somaria: 0x350, byrna: 0x351, cape: 0x352, mirror: 0x353, gloves: 0x354,
  boots: 0x355, flippers: 0x356, pearl: 0x357, sword: 0x359, shield: 0x35A, armor: 0x35B, bottles: 0x35C, rupees: 0x360, pieces: 0x36B, maxHp: 0x36C, hp: 0x36D,
  heartFill: 0x372, bombFill: 0x375, arrowFill: 0x376, abilities: 0x379, magicUse: 0x37B, invFlags: 0x38C, bowFlags: 0x38E,
};
const BOTTLE = { Bottle: 2, BottleWithRedPotion: 3, BottleWithGreenPotion: 4, BottleWithBluePotion: 5, BottleWithFairy: 6, BottleWithBee: 7, BottleWithGoldBee: 8 };
const RUPEES = { OneRupee: 1, FiveRupees: 5, TwentyRupees: 20, TwentyRupees2: 20, FiftyRupees: 50, OneHundredRupees: 100, ThreeHundredRupees: 300 };
const SIMPLE = { Hookshot: 'hookshot', FireRod: 'firerod', IceRod: 'icerod', Bombos: 'bombos', Ether: 'ether', Quake: 'quake', Lamp: 'lamp', Hammer: 'hammer',
  BugCatchingNet: 'net', BookOfMudora: 'book', CaneOfSomaria: 'somaria', CaneOfByrna: 'byrna', Cape: 'cape', MoonPearl: 'pearl' };

export const GIVEABLE = new Set(Object.keys(SIMPLE).concat(Object.keys(BOTTLE), Object.keys(RUPEES), [
  'ProgressiveSword', 'ProgressiveShield', 'ProgressiveArmor', 'ProgressiveGlove', 'ProgressiveBow', 'Boomerang', 'RedBoomerang', 'Mushroom', 'Powder', 'Shovel',
  'OcarinaInactive', 'MagicMirror', 'PegasusBoots', 'Flippers', 'HalfMagic', 'BossHeartContainer', 'HeartContainer', 'PieceOfHeart',
  'Arrow', 'TenArrows', 'Bomb', 'ThreeBombs', 'TenBombs']));

export function give(w, name) {
  if (!w || w.length < 0x10000) return false;
  const g = (k) => w[S + A[k]], set = (k, v) => { w[S + A[k]] = v & 0xFF; }, or = (k, b) => { w[S + A[k]] |= b; };
  const up = (k, max) => { let c = g(k); if (c === 0xFF) c = 0; set(k, Math.min(max, c + 1)); };
  const add = (k, n, max) => set(k, Math.min(max, g(k) + n));
  if (SIMPLE[name]) { set(SIMPLE[name], 1); return true; }
  if (BOTTLE[name] !== undefined) {
    for (let i = 0; i < 4; i++) if (!w[S + A.bottles + i]) { w[S + A.bottles + i] = BOTTLE[name]; if (!g('bottleSel')) set('bottleSel', i + 1); return true; }
    return true;   // (four already: nothing to fill)
  }
  if (RUPEES[name] !== undefined) {
    const r = Math.min(999, (w[S + A.rupees] | w[S + A.rupees + 1] << 8) + RUPEES[name]);
    w[S + A.rupees] = r & 0xFF; w[S + A.rupees + 1] = r >> 8; return true;
  }
  switch (name) {
    case 'ProgressiveSword': up('sword', 4); return true;
    case 'ProgressiveShield': up('shield', 3); return true;
    case 'ProgressiveArmor': up('armor', 2); return true;
    case 'ProgressiveGlove': up('gloves', 2); return true;
    case 'ProgressiveBow': {
      const arrows = w[S + 0x377] > 0;
      if (!(g('bowFlags') & 0x80)) { or('bowFlags', 0x80); if (g('bow') < 3) set('bow', arrows ? 2 : 1); }
      else { or('bowFlags', 0x40); set('bow', arrows ? 4 : 3); }
      add('arrowFill', 10, 0xFF); return true;
    }
    case 'Boomerang': or('invFlags', 0x80); if (!g('boomerang')) set('boomerang', 1); return true;
    case 'RedBoomerang': or('invFlags', 0x40); set('boomerang', 2); return true;
    case 'Mushroom': or('invFlags', 0x20); if (!g('mushroom')) set('mushroom', 1); return true;
    case 'Powder': or('invFlags', 0x10); if (!g('mushroom')) set('mushroom', 2); return true;
    case 'Shovel': or('invFlags', 0x04); if (!g('flute')) set('flute', 1); return true;
    case 'OcarinaInactive': or('invFlags', 0x02); if (g('flute') < 2) set('flute', 2); return true;
    case 'MagicMirror': set('mirror', 2); return true;
    case 'PegasusBoots': set('boots', 1); or('abilities', 0x04); return true;
    case 'Flippers': set('flippers', 1); or('abilities', 0x02); return true;
    case 'HalfMagic': set('magicUse', Math.max(1, g('magicUse'))); return true;
    case 'BossHeartContainer': case 'HeartContainer': add('maxHp', 8, 0xA0); add('heartFill', 8, 0xA0); return true;
    case 'PieceOfHeart': { const p = g('pieces') + 1; if (p >= 4) { set('pieces', 0); add('maxHp', 8, 0xA0); add('heartFill', 8, 0xA0); } else set('pieces', p); return true; }
    case 'Arrow': add('arrowFill', 1, 0xFF); return true;
    case 'TenArrows': add('arrowFill', 10, 0xFF); return true;
    case 'Bomb': add('bombFill', 1, 0xFF); return true;
    case 'ThreeBombs': add('bombFill', 3, 0xFF); return true;
    case 'TenBombs': add('bombFill', 10, 0xFF); return true;
  }
  return false;
}

window.Z1Z3Give = { GIVEABLE, give };
