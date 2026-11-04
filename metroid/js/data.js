/*
 * data.js — Metroid (NES, 1986) tables for the randomizer, the tracker and
 * the map. Worked out from the game itself (the ZaneDubya / Dirty McDingus
 * disassembly) and checked against the USA ROM.
 *
 * The ROM: 128 KB of PRG in 8 banks of 16 KB (bank 0 the title and ending,
 * 1 Brinstar, 2 Norfair, 3 Tourian, 4 Kraid, 5 Ridley, 6 the engine, 7
 * fixed), 16-byte iNES header, mapper 1. Each area bank has a table of
 * "special items" per map square ($9598 points to it) listing the power-ups:
 * `02 type pos`. Randomizing is rewriting the type byte of every spot; the
 * game then draws, awards and remembers the new item itself. Items are
 * remembered as (type, map x, map y): the type at the spot changes nothing
 * else.
 *
 * Power-up types: 0 Bombs, 1 High Jump, 2 Long Beam, 3 Screw Attack,
 * 4 Maru Mari, 5 Varia, 6 Wave Beam, 7 Ice Beam, 8 Energy Tank, 9 Missiles.
 * Beams respawn (the game doesn't record them: Wave and Ice swap each other).
 *
 * The game's memory ($6000-$7FFF is cartridge RAM, the emulator's "save RAM"):
 *   $6877 energy tanks    $6878 gear bits (0 Bombs, 1 High Jump, 2 Long, 3
 *   Screw, 4 Maru Mari, 5 Varia, 6 Wave, 7 Ice)    $6879 missiles  $687A max
 *   $687B / $687C Kraid / Ridley statue (bit 7: raised, the boss is dead)
 *   $6886 count (bytes) of taken items, pairs from $6887: lo = (x & 7) << 5 |
 *   y, hi = type << 2 | x >> 3
 * CPU RAM: $1D game mode (0 playing, 1 title / password)   $74 area ($10
 *   Brinstar, $11 Norfair, $12 Kraid, $13 Tourian, $14 Ridley)   $4F map y
 *   $50 map x   $51 / $52 Samus on screen   $106 / $107 health (BCD)
 *   $2D frame counter (the main loop; stops when the game crashes)
 */
(function () {
  'use strict';
  const ROM = { size: 131088, crc32: 'a2c89cb9', name: 'Metroid (USA)' };
  const AREAS = ['Brinstar', 'Norfair', 'Kraid', 'Ridley', 'Tourian'];
  const AREA_CODE = { 0: 0, 1: 1, 2: 2, 4: 3, 3: 4 };   // $74 & 15 → index ($74 is $10.. in play, 0 at the very start)
  const ITEMS = ['Bombs', 'High Jump', 'Long Beam', 'Screw Attack', 'Maru Mari', 'Varia', 'Wave Beam', 'Ice Beam', 'Energy Tank', 'Missiles'];
  const BEAMS = [2, 6, 7];
  // the gear, in the game's bit order at $6878
  const GEAR = [['Bombs', 0], ['High Jump', 1], ['Long Beam', 2], ['Screw Attack', 3], ['Maru Mari', 4], ['Varia', 5], ['Wave Beam', 6], ['Ice Beam', 7]];
  const BOSSES = [['Kraid', 0x87B], ['Ridley', 0x87C]];   // save-RAM offsets of the statue bytes
  const MEM = { TANKS: 0x877, GEAR: 0x878, MISSILES: 0x879, MAX_MISSILES: 0x87A, TAKEN_N: 0x886, TAKEN: 0x887,
    MODE: 0x1D, AREA: 0x74, MAP_Y: 0x4F, MAP_X: 0x50, SX: 0x51, SY: 0x52, HP_LO: 0x106, HP_HI: 0x107, FRAME: 0x2D };

  // Logic keys: MM Maru Mari, B Bombs, HJ High Jump, IB Ice Beam, MI a
  // missile pack (red doors and the bosses), ST both statues raised.
  // A requirement is a list: every string must be had; an inner list is any
  // one of. Deliberately careful: no bomb jumps, wall jumps or door tricks.
  const BR = ['MM'], NF = ['MM', 'B'], KR = ['MM', 'B', 'MI'], RD = ['MM', 'B', 'MI', ['HJ', 'IB']];
  // [area, map x, map y, position in the screen (y << 4 | x, 16 px tiles), file offset of the type byte, vanilla item, name, requirement]
  const SPOTS = [
    [0, 2, 14, 150, 25664, 4, 'Maru Mari room (left of the start)', []],
    [0, 9, 14, 18, 25670, 8, 'Energy Tank (start corridor, east)', ['MM', 'B']],
    [0, 7, 5, 55, 25609, 2, 'Long Beam room (north-west)', BR],
    [0, 15, 2, 55, 25585, 5, 'Varia room (top)', ['MM', 'B', ['HJ', 'IB']]],
    [0, 24, 3, 103, 25594, 9, 'Missiles (top right)', BR],
    [0, 27, 3, 135, 25600, 8, 'Energy Tank (top right)', ['MM', 'B']],
    [0, 25, 5, 55, 25615, 0, 'Bombs room (east)', BR],
    [0, 25, 7, 135, 25628, 8, 'Energy Tank (east corridor)', ['MM', 'B']],
    [0, 19, 9, 55, 25637, 7, 'Ice Beam room (centre)', ['MM', 'B']],
    [0, 18, 11, 103, 25650, 9, 'Missiles (south centre)', BR],
    [1, 27, 10, 52, 41711, 9, 'Missiles (upper right, 1)', NF],
    [1, 28, 10, 52, 41717, 9, 'Missiles (upper right, 2)', NF],
    [1, 26, 11, 52, 41731, 9, 'Missiles (upper right, 3)', NF],
    [1, 27, 11, 52, 41737, 9, 'Missiles (upper right, 4)', NF],
    [1, 28, 11, 52, 41743, 9, 'Missiles (upper right, 5)', NF],
    [1, 26, 12, 55, 41752, 7, 'Ice Beam room (upper right)', NF],
    [1, 18, 14, 52, 41769, 9, 'Missiles (upper left, 1)', NF],
    [1, 17, 15, 52, 41778, 9, 'Missiles (upper left, 2)', NF],
    [1, 19, 15, 52, 41785, 9, 'Missiles (upper left, 3)', NF],
    [1, 20, 15, 52, 41791, 9, 'Missiles (upper left, 4)', NF],
    [1, 15, 16, 55, 41809, 3, 'Screw Attack room (far left)', ['MM', 'B', ['HJ', 'IB']]],
    [1, 27, 17, 55, 41840, 1, 'High Jump room (right)', NF],
    [1, 26, 19, 66, 41859, 8, 'Energy Tank (lower right)', ['MM', 'B', ['HJ', 'IB']]],
    [1, 28, 20, 52, 41878, 9, 'Missiles (lower right)', ['MM', 'B', ['HJ', 'IB']]],
    [1, 18, 21, 55, 41887, 6, 'Wave Beam room (lower left)', ['MM', 'B', ['HJ', 'IB']]],
    [1, 19, 22, 52, 41901, 9, 'Missiles (bottom, 1)', ['MM', 'B', ['HJ', 'IB']]],
    [1, 20, 22, 52, 41907, 9, 'Missiles (bottom, 2)', ['MM', 'B', ['HJ', 'IB']]],
    [2, 4, 21, 71, 74387, 9, 'Missiles (upper left)', KR],
    [2, 9, 21, 71, 74393, 9, 'Missiles (upper right)', KR],
    [2, 10, 22, 102, 74402, 8, 'Energy Tank (upper right)', KR],
    [2, 10, 25, 71, 74411, 9, 'Missiles (middle right)', KR],
    [2, 5, 27, 71, 74420, 9, 'Missiles (lower left)', KR],
    [2, 8, 29, 190, 74436, 8, 'Energy Tank (bottom, by Kraid)', KR],
    [3, 18, 24, 109, 90659, 9, 'Missiles (upper)', RD],
    [3, 17, 25, 116, 90673, 8, 'Energy Tank (upper)', RD],
    [3, 24, 27, 109, 90682, 9, 'Missiles (middle right)', RD],
    [3, 15, 29, 102, 90691, 8, 'Energy Tank (lower left)', RD],
    [3, 20, 30, 109, 90700, 9, 'Missiles (bottom)', RD],
  ];
  // the bosses and the way out, for the logic readout
  const GOALS = [['Kraid', KR], ['Ridley', RD], ['Tourian (Mother Brain)', ['MM', 'B', 'MI', 'ST', 'IB']]];
  // Samus starts here (Brinstar); the elevators between the areas, for the map
  const START = [3, 14];
  const ELEVATORS = [[0, 3, 2, 4], [0, 22, 11, 1], [0, 7, 18, 2], [1, 25, 22, 3]];   // [area, x, y, to area]
  // The world map (bank 0, $A53E: 32 x 32 room numbers, $FF = nothing) with
  // every square given to its area: x * 32 + y. Tourian's squares overlap
  // Brinstar's on the game's single map, so each area is drawn on its own.
  const MAP_CELLS = [[353,417,641,98,130,162,194,226,258,290,322,354,418,450,482,514,546,578,610,642,962,355,419,451,483,515,547,579,611,643,675,707,739,771,803,835,867,899,931,963,356,420,964,197,229,261,293,325,357,421,773,805,837,869,901,933,965,358,422,582,710,966,103,135,167,199,231,263,295,327,359,391,423,455,487,519,551,583,615,647,679,711,743,775,807,839,871,903,935,967,328,360,424,584,712,968,329,361,425,585,617,649,681,713,777,969,330,362,426,586,714,331,363,427,459,491,523,555,587,619,651,683,715,364,365,46,78,110,142,174,206,238,270,302,334,366,207,367,208,272,368,209,273,305,337,369,210,242,274,306,338,370,211,275,307,339,371],[778,810,842,874,906,938,970,779,811,843,875,907,939,971,428,716,780,812,844,876,908,940,972,429,717,781,973,430,462,494,526,558,590,622,654,686,718,750,782,814,846,878,910,942,974,431,463,495,527,559,591,623,655,687,719,751,783,815,847,879,911,943,975,432,464,496,528,560,592,976,433,465,497,529,561,593,625,657,689,721,753,785,817,849,881,913,945,977,434,466,498,530,562,594,626,658,690,722,754,786,818,850,882,914,946,978,435,563,595,819,851,883,915,947,979,436,468,500,532,564,596,628,660,692,724,756,788,820,852,884,916,948,980,437,565,597,629,661,693,789,821,853,885,917,949,981,438,534,566,598,630,662,694,790,822,982],[243,52,244,276,372,53,85,117,149,181,213,245,277,309,341,373,54,86,118,150,182,214,246,278,310,342,374,55,151,247,407,56,152,184,216,248,280,312,344,376,408,57,153,249,313,345,377,409,58,154,186,218,250,282,314,378,410,59,91,123,155,187,219,251,283,315,347,379,411,60,124,156,188,220,252,284,316,348,380,412,285,317,349,381,413,414],[567,759,791,823,983,472,568,600,632,664,696,728,760,792,824,984,473,505,537,569,601,633,665,697,729,761,793,825,857,889,921,953,985,474,570,730,986,475,507,539,571,603,635,667,699,731,763,795,827,859,891,923,955,987,476,732,988,477,509,541,573,605,637,669,701,733,765,797,829,861,893,925,957,989,478,510,542,574,606,638,670,702,734,766,798,830,862,894,926,958,990],[35,99,36,100,37,101,38,102,39,40,41,42,43,75,107,139,171,203,235,267,299]];

  // the item id the game records for a spot holding `type` (lo, hi)
  function itemId(spot, type) { return [((spot[1] & 7) << 5) | spot[2], (type << 2) | (spot[1] >> 3)]; }
  window.M1 = { ROM, AREAS, AREA_CODE, ITEMS, BEAMS, GEAR, BOSSES, MEM, SPOTS, GOALS, START, ELEVATORS, MAP_CELLS, itemId };
})();
