/*
 * data.js — Super Mario World tables for the page: the overworld's level
 * spots (from the randomizer's own stage table, gen/js/randomizer.base.js
 * SMW_STAGES), and the game's memory.
 *
 * STAGES: [key, name, world, exits, castle (1-7 Koopa Kid, -1 fortress),
 * palace (1 yellow, 2 blue, 3 red, 4 green), level id, overworld x, y]. A spot
 * keeps its place on the map whatever the randomizer puts in it; its exits set
 * overworld events: the normal exit the event the ROM's table gives its
 * translevel ($05:D608 + translevel, file 0x2D608), the secret exit that + 1.
 * 92 exits + the 4 switch palaces = the game's 96.
 *
 * Memory (WRAM):
 *   $0100 game mode ($0B-$0E the overworld, $0F-$14 a level; under $0B the
 *         title and file select)   $13 frame counter   $19 power-up
 *   $0DBE lives - 1   $0DBF coins   $0DC1 Yoshi carried   $0DC2 item box
 *   $1F02.. event flags: event e is $1F02 + e/8, bit $80 >> e%8 (the game's
 *         own mask table, $04:E44B)   $1F2E exits found (the randomizer shows
 *         it on the file select)   $1F27-$1F2A switch palaces (green, yellow,
 *         blue, red)   $1F11 submap   $1F17 / $1F19 Mario on the overworld
 */
(function () {
  'use strict';
  const ROM = { size: 524288, crc32: 'b19ed489', name: 'Super Mario World (USA)' };
  const WORLDS = ['', "Yoshi's Island", 'Donut Plains', 'Vanilla Dome', 'Twin Bridges', 'Forest of Illusion', 'Chocolate Island', 'Valley of Bowser', 'Star World', 'Special Zone'];
  const STAGES = [["yi1", "Yoshi's Island 1", 1, 1, 0, 0, 261, 4, 40], ["yi2", "Yoshi's Island 2", 1, 1, 0, 0, 262, 10, 40], ["yi3", "Yoshi's Island 3", 1, 1, 0, 0, 259, 10, 38], ["yi4", "Yoshi's Island 4", 1, 1, 0, 0, 258, 12, 36], ["dp1", "Donut Plains 1", 2, 2, 0, 0, 21, 5, 17], ["dp2", "Donut Plains 2", 2, 2, 0, 0, 9, 3, 13], ["dp3", "Donut Plains 3", 2, 1, 0, 0, 5, 9, 10], ["dp4", "Donut Plains 4", 2, 1, 0, 0, 6, 11, 12], ["ds1", "Donut Secret 1", 2, 2, 0, 0, 10, 5, 14], ["ds2", "Donut Secret 2", 2, 1, 0, 0, 267, 17, 33], ["vd1", "Vanilla Dome 1", 3, 2, 0, 0, 282, 6, 50], ["vd2", "Vanilla Dome 2", 3, 2, 0, 0, 280, 9, 48], ["vd3", "Vanilla Dome 3", 3, 1, 0, 0, 266, 13, 46], ["vd4", "Vanilla Dome 4", 3, 1, 0, 0, 281, 13, 48], ["vs1", "Vanilla Secret 1", 3, 2, 0, 0, 265, 4, 46], ["vs2", "Vanilla Secret 2", 3, 1, 0, 0, 1, 12, 3], ["vs3", "Vanilla Secret 3", 3, 1, 0, 0, 2, 14, 3], ["cba", "Cheese Bridge Area", 4, 2, 0, 0, 15, 20, 5], ["soda", "Soda Lake", 4, 1, 0, 0, 17, 20, 8], ["cookie", "Cookie Mountain", 4, 1, 0, 0, 16, 23, 5], ["bb1", "Butter Bridge 1", 4, 1, 0, 0, 12, 20, 3], ["bb2", "Butter Bridge 2", 4, 1, 0, 0, 13, 22, 3], ["foi1", "Forest of Illusion 1", 5, 2, 0, 0, 286, 9, 55], ["foi2", "Forest of Illusion 2", 5, 2, 0, 0, 288, 11, 58], ["foi3", "Forest of Illusion 3", 5, 2, 0, 0, 291, 9, 60], ["foi4", "Forest of Illusion 4", 5, 2, 0, 0, 287, 5, 58], ["fsecret", "Forest Secret Area", 5, 1, 0, 0, 290, 5, 60], ["ci1", "Chocolate Island 1", 6, 1, 0, 0, 34, 24, 22], ["ci2", "Chocolate Island 2", 6, 2, 0, 0, 36, 21, 27], ["ci3", "Chocolate Island 3", 6, 2, 0, 0, 35, 19, 27], ["ci4", "Chocolate Island 4", 6, 1, 0, 0, 29, 15, 29], ["ci5", "Chocolate Island 5", 6, 1, 0, 0, 28, 12, 29], ["csecret", "Chocolate Secret", 6, 1, 0, 0, 279, 24, 41], ["vob1", "Valley of Bowser 1", 7, 1, 0, 0, 278, 28, 39], ["vob2", "Valley of Bowser 2", 7, 2, 0, 0, 277, 26, 39], ["vob3", "Valley of Bowser 3", 7, 1, 0, 0, 275, 21, 39], ["vob4", "Valley of Bowser 4", 7, 2, 0, 0, 271, 21, 37], ["c1", "Iggy's Castle", 1, 1, 1, 0, 257, 10, 34], ["c2", "Morton's Castle", 2, 1, 2, 0, 7, 13, 12], ["c3", "Lemmy's Castle", 3, 1, 3, 0, 284, 13, 50], ["c4", "Ludwig's Castle", 4, 1, 4, 0, 14, 26, 3], ["c5", "Roy's Castle", 5, 1, 5, 0, 32, 24, 18], ["c6", "Wendy's Castle", 6, 1, 6, 0, 26, 12, 27], ["c7", "Larry's Castle", 7, 1, 7, 0, 272, 24, 37], ["vfort", "Vanilla Fortress", 3, 1, -1, 0, 11, 16, 3], ["ffort", "Forest Fortress", 5, 1, -1, 0, 31, 22, 16], ["cfort", "Chocolate Fortress", 6, 1, -1, 0, 27, 15, 27], ["bfort", "Valley Fortress", 7, 1, -1, 0, 273, 26, 37], ["dgh", "Donut Ghost House", 2, 2, 0, 0, 4, 5, 10], ["dsh", "Donut Secret House", 2, 2, 0, 0, 19, 7, 16], ["vgh", "Vanilla Ghost House", 3, 1, 0, 0, 263, 9, 44], ["fgh", "Forest Ghost House", 5, 2, 0, 0, 285, 7, 55], ["cgh", "Choco-Ghost House", 6, 1, 0, 0, 33, 21, 22], ["sgs", "Sunken Ghost Ship", 6, 1, 0, 0, 24, 14, 23], ["bgh", "Valley Ghost House", 7, 2, 0, 0, 276, 24, 39], ["sw1", "Star World 1", 8, 2, 0, 0, 308, 21, 58], ["sw2", "Star World 2", 8, 2, 0, 0, 304, 22, 56], ["sw3", "Star World 3", 8, 2, 0, 0, 306, 26, 56], ["sw4", "Star World 4", 8, 2, 0, 0, 309, 27, 58], ["sw5", "Star World 5", 8, 2, 0, 0, 310, 24, 59], ["sp1", "Gnarly", 9, 1, 0, 0, 298, 20, 51], ["sp2", "Tubular", 9, 1, 0, 0, 299, 23, 51], ["sp3", "Way Cool", 9, 1, 0, 0, 300, 26, 51], ["sp4", "Awesome", 9, 1, 0, 0, 301, 29, 51], ["sp5", "Groovy", 9, 1, 0, 0, 296, 29, 49], ["sp6", "Mondo", 9, 1, 0, 0, 295, 26, 49], ["sp7", "Outrageous", 9, 1, 0, 0, 294, 23, 49], ["sp8", "Funky", 9, 1, 0, 0, 293, 20, 49], ["yswitch", "Yellow Switch Palace", 1, 0, 0, 1, 20, 2, 17], ["gswitch", "Green Switch Palace", 2, 0, 0, 4, 8, 1, 13], ["rswitch", "Red Switch Palace", 3, 0, 0, 3, 283, 11, 50], ["bswitch", "Blue Switch Palace", 5, 0, 0, 2, 289, 13, 58]];
  // switch palaces: [name, WRAM, colour]
  const PALACES = [['Yellow', 0x1F28, '#f0d040'], ['Green', 0x1F27, '#40c060'], ['Red', 0x1F2A, '#e04040'], ['Blue', 0x1F29, '#4080f0']];
  const TRANSLEVEL_EVENTS = 0x2D608;
  const translevel = (id) => id < 0x100 ? id : id - 0xDC;
  const MEM = { MODE: 0x100, FRAME: 0x13, POWER: 0x19, LIVES: 0xDBE, COINS: 0xDBF, YOSHI: 0xDC1, ITEM: 0xDC2, EVENTS: 0x1F02, EXITS: 0x1F2E, CUTSCENE: 0x13C6, SUBMAP: 0x1F11, OW_X: 0x1F17, OW_Y: 0x1F19 };
  window.SMWD = { ROM, WORLDS, STAGES, PALACES, TRANSLEVEL_EVENTS, translevel, MEM };
})();
