/*
 * Crowd effects for the Snes9x player: lets TikTok LIVE viewers change the
 * game. Gifts, likes, follows and shares arrive from the TikTok bridge
 * (Crowd Control+, crowd-plus/bridge.mjs, run on the streaming PC) over a WebSocket; each
 * one names an effect from the list below, which is queued and applied when
 * Link is in normal play (not in a menu, text box or transition).
 *
 * The ROM is never changed. Effects either write ALTTP's RAM (hearts, magic,
 * rupees, bombs, arrows) or change the buttons the game sees (inverted
 * D-pad, no sword...). The tracker reads the same RAM, so it follows along.
 *
 *   CrowdEffects.trigger('heal_full', 'someone')   // test from the console
 *   CrowdEffects.list()                            // ids and names
 *
 * Three effects use the app's own buttons instead of RAM: a random sprite,
 * a random favourite MSU-1 pack, and a whole new seed (off unless "Allow
 * seed reroll" is checked in the menu; it counts down 10 s first and can be
 * cancelled there).
 *
 * Settings (bridge address, on/off) are in the emulator menu under
 * "Crowd effects". The bridge address defaults to ws://localhost:21214
 * (21213 is TikFinity's own port).
 */
(function (root) {
  'use strict';

  var SETTINGS_KEY = 's9x-crowd-settings';
  var cfg = { enabled: false, url: 'ws://localhost:21214', feed: true, alerts: true, allowReroll: false, rerollOverlay: true, showTimer: true };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
  function saveCfg() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch (e) {} }

  // ── ALTTP RAM (offsets into the 128 KB WRAM, i.e. $7E0000 = 0) ─────────
  var A = {
    MODE: 0x0010, SUBMODE: 0x0011,     // main game module / its step
    FROZEN: 0x02E4,                    // nonzero: Link can't move (text, cutscene)
    BOMBS: 0xF343, ARROWS: 0xF377,
    RUPEES: 0xF360,                    // 16-bit target; the HUD counts toward it
    HP_MAX: 0xF36C, HP: 0xF36D,        // 8 per heart
    MAGIC: 0xF36E,                     // 0x80 = full meter
    HP_FILL: 0xF372, MAGIC_FILL: 0xF373, BOMB_FILL: 0xF375, ARROW_FILL: 0xF376,
  };
  var PLAY_MODES = { 0x07: 1, 0x09: 1, 0x0B: 1 };   // dungeon, overworld, special overworld

  function inPlay(ram) {
    return ram.length >= 0x20000 && PLAY_MODES[ram[A.MODE]] && ram[A.SUBMODE] === 0 &&
      ram[A.FROZEN] === 0 && ram[A.HP_MAX] >= 8 && ram[A.HP] > 0;
  }
  function rupees(ram) { return ram[A.RUPEES] | (ram[A.RUPEES + 1] << 8); }
  // randomizer ROMs count to 9999 (the HUD has four digits); never cut a bigger wallet down
  function setRupees(ram, v) { v = Math.max(0, Math.min(9999, v)); ram[A.RUPEES] = v & 0xFF; ram[A.RUPEES + 1] = v >> 8; }
  function fill(ram, addr, amount, cap) { ram[addr] = Math.min(cap, ram[addr] + amount); }
  function fx() { var p = root.Snes9xPlayer; return p && p.fx; }
  function core() { var p = root.Snes9xPlayer; return p && p.core; }

  // Bottles ($7EF35C-$7EF35F): 2 = empty, 6 = fairy, 7 = bee, 8 = good bee.
  function fillBottle(r, what) {
    for (var a = 0xF35C; a <= 0xF35F; a++) if (r[a] === 2) { r[a] = what; return true; }
    return 'No empty bottle';
  }

  // Pink Link: tint Link's palette (main palette buffer $7EC6E2, 15 colours)
  // and ask the game to re-upload palettes ($15). The original colours are
  // kept and put back when it ends; if the game reloads them meanwhile (new
  // area, tunic change) the new ones are kept instead.
  var LINK_PAL = 0xC6E2, LINK_N = 15, pinkSaved = null, pinkWritten = null;
  function pinkify(c) {
    var r = c & 31, g = (c >> 5) & 31, b = (c >> 10) & 31;
    var l = (r * 3 + g * 6 + b) / 10;
    r = Math.min(31, Math.round(l * 0.55 + 14)); g = Math.round(l * 0.45 + 2); b = Math.min(31, Math.round(l * 0.6 + 9));
    return r | (g << 5) | (b << 10);
  }
  function pinkFrame(r) {
    var cur = [], same = !!pinkWritten;
    for (var i = 0; i < LINK_N; i++) { cur[i] = r[LINK_PAL + i * 2] | (r[LINK_PAL + i * 2 + 1] << 8); if (pinkWritten && cur[i] !== pinkWritten[i]) same = false; }
    if (!same) pinkSaved = cur;            // first frame, or the game loaded new colours
    if (!pinkWritten || !same) {
      pinkWritten = pinkSaved.map(pinkify);
      for (var k = 0; k < LINK_N; k++) { r[LINK_PAL + k * 2] = pinkWritten[k] & 0xFF; r[LINK_PAL + k * 2 + 1] = pinkWritten[k] >> 8; }
      r[0x15] = 1;
    }
  }
  function pinkEnd(r) {
    if (pinkSaved && pinkWritten) {
      var still = true;
      for (var i = 0; i < LINK_N; i++) if ((r[LINK_PAL + i * 2] | (r[LINK_PAL + i * 2 + 1] << 8)) !== pinkWritten[i]) still = false;
      if (still) { for (var k = 0; k < LINK_N; k++) { r[LINK_PAL + k * 2] = pinkSaved[k] & 0xFF; r[LINK_PAL + k * 2 + 1] = pinkSaved[k] >> 8; } r[0x15] = 1; }
    }
    pinkSaved = pinkWritten = null;
  }

  // SNES pad bits, same order as Snes9xCore.BTN
  var B = { B: 1 << 0, Y: 1 << 1, UP: 1 << 4, DOWN: 1 << 5, LEFT: 1 << 6, RIGHT: 1 << 7 };
  function swapBits(pad, a, b) {
    var ha = pad & a, hb = pad & b;
    pad &= ~(a | b);
    if (ha) pad |= b;
    if (hb) pad |= a;
    return pad;
  }

  // ── extra enemy: copy an enemy that's already in the room ───────────────
  // A sprite only draws right if its graphics are loaded for this area, and
  // only the enemies already here are guaranteed to be. So the new enemy is a
  // full copy of one of them (every per-sprite table, offsets from the
  // zelda3 reverse engineering), put into a free slot next to the original.
  var SLOT_TABLES = [0xB58, 0xB6B, 0xB89, 0xBA0, 0xBB0, 0xBE0, 0xC9A, 0xCAA, 0xCBA, 0xCD2, 0xCE2,
    0xD00, 0xD10, 0xD20, 0xD30, 0xD40, 0xD50, 0xD60, 0xD70, 0xD80, 0xD90, 0xDA0, 0xDB0, 0xDC0, 0xDD0, 0xDE0, 0xDF0,
    0xE00, 0xE10, 0xE20, 0xE30, 0xE40, 0xE50, 0xE60, 0xE70, 0xE80, 0xE90, 0xEA0, 0xEB0, 0xEC0, 0xED0, 0xEE0, 0xEF0,
    0xF00, 0xF10, 0xF20, 0xF30, 0xF40, 0xF50, 0xF60, 0xF70, 0xF80, 0xF90,
    0x1F9C2, 0x1FA1C, 0x1FA2C, 0x1FA3C, 0x1FA4C];
  var S = { STATE: 0xDD0, TYPE: 0xE20, N: 0xBC0, XL: 0xD10, XH: 0xD30, YL: 0xD00, YH: 0xD20, FLOOR: 0xF20, HIT: 0xEF0 };
  // Ordinary enemies only: no bosses, NPCs, items, switches, traps, or
  // anything that grabs Link (Wallmaster) or is part of a bigger enemy.
  var CLONEABLE = {};
  [0x08, 0x0A, 0x0D, 0x0E, 0x0F, 0x11, 0x12, 0x13, 0x18, 0x19, 0x20, 0x22, 0x23, 0x24, 0x26, 0x27,
   0x41, 0x42, 0x43, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x58,
   0x6A, 0x6B, 0x6D, 0x6E, 0x6F, 0x71, 0x7C, 0x81, 0x83, 0x84, 0x85, 0x86, 0x8B, 0x8E, 0x8F, 0x91,
   0x94, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0xA1, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xC3, 0xC4, 0xC7,
   0xC9, 0xCF, 0xD0, 0xD3].forEach(function (t) { CLONEABLE[t] = 1; });
  function sx(r, k) { return r[S.XL + k] | (r[S.XH + k] << 8); }
  function sy(r, k) { return r[S.YL + k] | (r[S.YH + k] << 8); }
  function cloneEnemy(r) {
    var lx = r[0x22] | (r[0x23] << 8), ly = r[0x20] | (r[0x21] << 8);
    var src = [], free = -1;
    for (var k = 0; k < 16; k++) {
      var st = r[S.STATE + k];
      if (st === 0) { if (free < 0 || k > free) free = k; continue; }
      if (st === 9 && CLONEABLE[r[S.TYPE + k]] && r[S.FLOOR + k] === r[0xEE] &&
          Math.abs(sx(r, k) - lx) < 0x140 && Math.abs(sy(r, k) - ly) < 0x120) src.push(k);
    }
    if (!src.length) return 'No enemies here to copy';
    if (free < 0) return 'Too many sprites on screen';
    var from = src[Math.floor(Math.random() * src.length)];
    for (var i = 0; i < SLOT_TABLES.length; i++) r[SLOT_TABLES[i] + free] = r[SLOT_TABLES[i] + from];
    r[S.N + free] = 0xFF;                 // not from the room's list: killing it marks nothing
    r[S.HIT + free] = 0;
    // next to the original, nudged toward Link so it joins the fight
    var x = sx(r, from) + (lx > sx(r, from) ? 12 : -12), y = sy(r, from) + (ly > sy(r, from) ? 12 : -12);
    r[S.XL + free] = x & 0xFF; r[S.XH + free] = (x >> 8) & 0xFF;
    r[S.YL + free] = y & 0xFF; r[S.YH + free] = (y >> 8) & 0xFF;
    return true;
  }

  // Random enemy: only enemies whose graphics are already loaded here. Each
  // area loads 4 sprite sheets ($7EC2FC-F); an enemy needs particular sheets in
  // particular slots, or it shows up as garbled tiles. Sheet needs per enemy from
  // Enemizer (github.com/Zarby89/Enemizer, MIT); 0 = any sheet in that slot.
  var RANDOM_ENEMIES = [
    [0x08, [[0,0,[12,24],0]]], [0x0A, [[0,0,[12],0]]], [0x0D, [[0,0,0,[17]]]], [0x0E, [[[22],0,[23],0]]],
    [0x0F, [[0,0,[12],0]]], [0x11, [[[22],0,0,0]]], [0x12, [[0,0,[23],0]]], [0x13, [[0,[30],0,0]]],
    [0x17, [[0,0,0,[17]]]], [0x18, [[0,[30],0,0]]], [0x19, [[0,0,0,[14,21]]]], [0x20, [[0,0,[37],0]]],
    [0x22, [[[22],0,0,0]]], [0x23, [[[31],0,0,0]]], [0x24, [[[31],0,0,0]]], [0x26, [[0,[30],0,0]]],
    [0x27, [[0,0,0,[16]]]], [0x3E, [[0,0,0,[17]]]], [0x41, [[0,[13,73],0,0]]], [0x42, [[0,[73],0,0]]],
    [0x43, [[0,[13,73],0,0]]], [0x44, [[[70],[13,73],0,0]]], [0x46, [[[72],[73],0,0]]], [0x47, [[[72],[73],0,0]]],
    [0x48, [[[70],[73],0,0]]], [0x4B, [[0,[73],[19],0],[0,[73],[28],0],[0,[73],[35],0]]], [0x4E, [[0,[44],0,0]]],
    [0x4F, [[0,[44],0,0]]], [0x51, [[0,0,0,[16]]]], [0x58, [[0,0,[12],0]]], [0x6D, [[0,0,[28,36],0]]],
    [0x6E, [[0,0,[28,36],0]]], [0x71, [[[47],0,0,0]]], [0x7C, [[[31],0,0,[82,83]]]], [0x83, [[0,[44],0,0]]],
    [0x8E, [[0,0,[42],0]]], [0x91, [[0,[32],0,0]]], [0x99, [[0,0,[38],0]]], [0xA5, [[0,0,[40],0]]],
    [0xA6, [[0,0,[40],0]]], [0xA7, [[[31],0,0,0]]], [0xA8, [[0,0,0,[27]]]], [0xA9, [[0,0,0,[27]]]],
    [0xAA, [[0,0,0,[27]]]], [0xC3, [[0,0,[40],0]]], [0xC4, [[[14,21],0,0,0]]], [0xC7, [[0,0,[39],0]]],
    [0xC9, [[0,0,0,[16]]]], [0xD0, [[0,0,0,[20]]]],
  ];
  function enemiesThatFit(r) {
    var sheets = [r[0xC2FC], r[0xC2FD], r[0xC2FE], r[0xC2FF]];
    return RANDOM_ENEMIES.filter(function (e) {
      return e[1].some(function (opt) { return opt.every(function (need, i) { return !need || need.indexOf(sheets[i]) >= 0; }); });
    }).map(function (e) { return e[0]; });
  }
  function spawnRandomEnemy(r) {
    var types = enemiesThatFit(r);
    if (!types.length) return cloneEnemy(r) === true ? true : 'No enemy fits this area';
    var free = -1;
    for (var k = 15; k >= 1; k--) if (r[S.STATE + k] === 0) { free = k; break; }
    if (free < 0) return 'Too many sprites on screen';
    var lx = r[0x22] | (r[0x23] << 8), ly = r[0x20] | (r[0x21] << 8), indoors = r[0x1B];
    // a spot 3-4 tiles from Link; indoors, one with open floor (BG2 tile attributes)
    var spots = [[48, 0], [-48, 0], [0, 40], [0, -40], [36, 32], [-36, 32], [36, -32], [-36, -32]], at = null;
    for (var t = 0; t < 16 && !at; t++) {
      var d = spots[Math.floor(Math.random() * spots.length)], x = lx + d[0], y = ly + d[1];
      if (!indoors) { at = [x, y]; break; }
      var tx = ((x + 8) & 0x1FF) >> 3, ty = ((y + 12) & 0x1FF) >> 3, ok = true;
      for (var dy = -1; dy <= 1 && ok; dy++) for (var dx = -1; dx <= 1 && ok; dx++) {
        var a = r[0x12000 + (((ty + dy) & 63) * 64) + ((tx + dx) & 63)];
        if (!(a === 0x00 || a === 0x09 || a === 0x0E || a === 0x0F)) ok = false;
      }
      if (ok) at = [x, y];
    }
    if (!at) return 'No room for an enemy here';
    for (var i = 0; i < SLOT_TABLES.length; i++) r[SLOT_TABLES[i] + free] = 0;
    r[S.TYPE + free] = types[Math.floor(Math.random() * types.length)];
    r[S.XL + free] = at[0] & 0xFF; r[S.XH + free] = (at[0] >> 8) & 0xFF;
    r[S.YL + free] = at[1] & 0xFF; r[S.YH + free] = (at[1] >> 8) & 0xFF;
    r[S.FLOOR + free] = r[0xEE];
    if (indoors) r[S.N + free] = 0xFF; else { r[0xBC0 + free * 2] = 0xFF; r[0xBC1 + free * 2] = 0xFF; }   // not from the room's list
    r[S.STATE + free] = 0x08;    // "initialize": the game loads its stats and sets it up
    return true;
  }

  // ── warps ──
  // Dungeon: drop in through a dungeon's front entrance (Module $11, like the
  // boss detour, but for keeps). The dungeon Link is in keeps its small keys.
  var DUNGEON_ENTRANCES = [
    ['Hyrule Castle', 0x04], ['Eastern Palace', 0x08], ['Desert Palace', 0x09], ['Tower of Hera', 0x33],
    ['Castle Tower', 0x24], ['Palace of Darkness', 0x26], ['Swamp Palace', 0x25], ['Skull Woods', 0x2B],
    ["Thieves' Town", 0x34], ['Ice Palace', 0x2D], ['Misery Mire', 0x27], ['Turtle Rock', 0x35], ["Ganon's Tower", 0x37],
  ];
  var lastWarp = '';
  function warpDungeon(r) {
    var pick = DUNGEON_ENTRANCES[Math.floor(Math.random() * DUNGEON_ENTRANCES.length)];
    if (r[0x1B]) {   // indoors: save this dungeon's keys like leaving it would (SaveDungeonKeys)
      var idx = r[0x40C];
      if (idx !== 0xFF) { if (idx === 2) idx = 0; r[0xF37C + (idx >> 1)] = r[0xF36F]; }
    }
    r[0x10E] = pick[1]; r[0x10F] = 0;
    r[0x10] = 0x11; r[0x11] = 0; r[0xB0] = 0;
    lastWarp = pick[0];
    return true;
  }
  // Flute: open the game's own flute menu (Module $0E.0A, as the bird does),
  // choose a random spot for the player, and let the bird carry Link there.
  // Only outdoors in the Light World, where the flute works.
  var fluteWarp = null;
  function canFlute(r) { return r[A.MODE] === 0x09 && r[0x8A] < 0x40; }
  function warpFlute(r) {
    if (!canFlute(r)) return warpDungeon(r) && 'flute only works outside in the Light World, so: ' + lastWarp;
    r[0x10C] = 0x09; r[0x10] = 0x0E; r[0x11] = 0x0A; r[0x200] = 0; r[0xC8] = 0; r[0xB0] = 0;
    fluteWarp = { spot: Math.floor(Math.random() * 8), frames: 0 };
    lastWarp = 'flute spot ' + (fluteWarp.spot + 1);
    return true;
  }
  function fluteFrame(r) {
    if (!fluteWarp) return;
    if (++fluteWarp.frames > 60 * 20 || r[0x10] !== 0x0E) { fluteWarp = null; return; }
    if (r[0x11] === 0x0A && r[0x200] === 5) {   // the map is up and waiting for a choice
      r[0x1AF0] = fluteWarp.spot; r[0xC8] = 0; r[0x200] = 6;
      fluteWarp = null;
    }
  }

  // ── the effects ─────────────────────────────────────────────────────────
  // Instant effects run once (apply). Timed ones last `secs` seconds of play
  // (the clock stops in menus and text boxes); a second gift adds more time.
  // Timed effects only filter input or hold a value down each frame, so a
  // save state, reset or reload can never leave the game stuck changed.
  var EFFECTS = {
    heal_full:   { name: 'Full heal', good: true,
      apply: function (r) { fill(r, A.HP_FILL, r[A.HP_MAX] - r[A.HP], 0xA0); } },
    heal_1:      { name: '+1 heart', good: true,
      apply: function (r) { fill(r, A.HP_FILL, 8, 0xA0); } },
    hurt_2:      { name: '-2 hearts', good: false,          // never kills
      apply: function (r) { r[A.HP] = Math.max(Math.min(8, r[A.HP]), r[A.HP] - 16); } },
    hp_1:        { name: 'Down to 1 heart', good: false,
      apply: function (r) { if (r[A.HP] > 8) r[A.HP] = 8; } },
    magic_full:  { name: 'Refill magic', good: true,
      apply: function (r) { r[A.MAGIC_FILL] = 0x80; } },
    magic_drain: { name: 'Drain magic', good: false,
      apply: function (r) { r[A.MAGIC] = 0; r[A.MAGIC_FILL] = 0; } },
    rupees_plus: { name: '+50 rupees', good: true,
      apply: function (r) { setRupees(r, rupees(r) + 50); } },
    rupees_minus:{ name: '-50 rupees', good: false,
      apply: function (r) { setRupees(r, rupees(r) - 50); } },
    bombs_plus:  { name: '+10 bombs', good: true,          // the game caps it at your bag size
      apply: function (r) { fill(r, A.BOMB_FILL, 10, 50); } },
    bombs_none:  { name: 'Lose all bombs', good: false,
      apply: function (r) { r[A.BOMBS] = 0; r[A.BOMB_FILL] = 0; } },
    arrows_plus: { name: '+10 arrows', good: true,
      apply: function (r) { fill(r, A.ARROW_FILL, 10, 70); } },
    arrows_none: { name: 'Lose all arrows', good: false,
      apply: function (r) { r[A.ARROWS] = 0; r[A.ARROW_FILL] = 0; } },

    invert:      { name: 'Inverted D-pad', good: false, secs: 20,
      input: function (p) { return swapBits(swapBits(p, B.UP, B.DOWN), B.LEFT, B.RIGHT); } },
    no_sword:    { name: 'No sword', good: false, secs: 20,
      input: function (p) { return p & ~B.B; } },
    no_item:     { name: 'No Y item', good: false, secs: 20,
      input: function (p) { return p & ~B.Y; } },
    swap_by:     { name: 'B and Y swapped', good: false, secs: 20,
      input: function (p) { return swapBits(p, B.B, B.Y); } },
    // Hands the game a hit worth all of Link's hearts, so it runs its own
    // death: a bottled fairy still saves him, and the cape / Cane of
    // Byrna's invincibility still blocks it, exactly like a real hit.
    insta_kill:  { name: 'Instant death', good: false,
      apply: function (r) { r[0x373] = r[A.HP]; } },
    enemy_spawn: { name: 'Extra enemy', good: false,
      apply: function (r) { return cloneEnemy(r); } },
    enemy_random: { name: 'Random enemy', good: false,
      apply: function (r) { return spawnRandomEnemy(r); } },
    magic_small: { name: 'Small magic refill', good: true,
      apply: function (r) { r[A.MAGIC_FILL] = Math.min(0x80, r[A.MAGIC_FILL] + 0x20); } },
    warp_dungeon: { name: 'Warp to a random dungeon', good: false,
      apply: function (r) { return warpDungeon(r); } },
    warp_flute:  { name: 'Flute warp (random spot)', good: false,
      apply: function (r) { return warpFlute(r); } },
    warp_random: { name: 'Random warp (flute spot or dungeon)', good: false,
      apply: function (r) { return canFlute(r) && Math.random() < 0.5 ? warpFlute(r) : warpDungeon(r); } },

    // These two flip switches the randomizer ROM itself keeps for crowd
    // control (z3randomizer: IceModifier $7F50C7, CuccoStormer $7F50C5).
    // `hold` sets the switch while the effect runs and clears it otherwise,
    // so a save state taken mid-effect can't leave it stuck on. `romCheck` is
    // the ROM's own read of that switch; without it the effect is skipped.
    ice:         { name: 'Ice physics', good: false, secs: 20,
      hold: { addr: 0x150C7, on: 0x01 }, romCheck: [0x0F, 0xC7, 0x50, 0x7F] },   // ORA.l $7F50C7
    cucco_storm: { name: 'Cucco attack', good: false, secs: 30, outdoors: true,
      hold: { addr: 0x150C5, on: 0x01 }, romCheck: [0xAF, 0xC5, 0x50, 0x7F] },   // LDA.l $7F50C5

    // ── screen and speed tricks (the emulator, so they work on any seed) ──
    mirror:      { name: 'Mirror mode', good: false, secs: 20, start: function () { fx() && fx().setScreen('mirror', true); }, end: function () { fx() && fx().setScreen('mirror', false); } },
    upside_down: { name: 'Upside down', good: false, secs: 15, start: function () { fx() && fx().setScreen('flip', true); }, end: function () { fx() && fx().setScreen('flip', false); } },
    wobble:      { name: 'Drunk wobble', good: false, secs: 20, start: function () { fx() && fx().setScreen('wobble', true); }, end: function () { fx() && fx().setScreen('wobble', false); } },
    tiny:        { name: 'Tiny screen', good: false, secs: 20, start: function () { fx() && fx().setScreen('tiny', true); }, end: function () { fx() && fx().setScreen('tiny', false); } },
    crt:         { name: 'Retro CRT', good: true, secs: 30, start: function () { fx() && fx().setTempFilter('crt'); }, end: function () { fx() && fx().setTempFilter(null); } },
    speed_up:    { name: 'Speed up (1.5x)', good: false, secs: 20, start: function () { fx() && fx().setSpeed(1.5); }, end: function () { fx() && fx().setSpeed(1); } },
    slow_mo:     { name: 'Slow motion', good: true, secs: 15, start: function () { fx() && fx().setSpeed(0.5); }, end: function () { fx() && fx().setSpeed(1); } },

    // ── Link ──
    freeze:      { name: 'Freeze!', good: false, secs: 3,
      input: function () { return 0; } },
    fairy:       { name: 'Fairy in a bottle', good: true,
      apply: function (r) { return fillBottle(r, 6); } },
    bee_bottle:  { name: 'Bee in a bottle', good: true,
      apply: function (r) { return fillBottle(r, 7); } },
    pink_link:   { name: 'Pink Link', good: true, secs: 60,
      frame: pinkFrame, end: function () { var c = core(); if (c) pinkEnd(c.wram()); } },
    music_roulette: { name: 'Music roulette', good: true,
      app: function () {
        var m = root.UnifiedRando && root.UnifiedRando.music;
        if (!m || !m.count) { feed('Music roulette needs an MSU-1 pack (♪)', 'info'); return false; }
        return !!m.roulette();
      } },

    // ── boss detours: a trip to a boss fight that always comes back (see below) ──
    boss_ganon:  { name: 'Boss detour: Ganon', good: false, detour: 'ganon' },
    boss_aga:    { name: 'Boss detour: Agahnim', good: false, detour: 'aga1' },
    boss_random: { name: 'Boss detour: random boss', good: false, detour: 'random' },

    one_hit:     { name: 'One-heart mode', good: false, secs: 30,
      frame: function (r) { if (r[A.HP] > 8) r[A.HP] = 8; r[A.HP_FILL] = 0; } },
    no_magic:    { name: 'Magic locked', good: false, secs: 30,
      frame: function (r) { r[A.MAGIC] = 0; r[A.MAGIC_FILL] = 0; } },

    // These press the app's own roll buttons (randomizer/app.js, reroll.js).
    sprite_roll: { name: 'Random sprite', good: true,
      app: function () { return press(['r-sprite-random', 'sprite-btn'], 'the sprite buttons'); } },
    sprite_fav:  { name: 'Random favourite sprite', good: true,
      app: function () { return press(['r-sprite-fav-roll', 'sprite-fav-btn'], 'the sprite buttons'); } },
    msu_roll:    { name: 'Random MSU pack', good: true,
      app: function () { return press(['music-roll-btn'], 'MSU packs (add some and star favourites in ♪)'); } },
    // Item sound packs (addons/sound-packs.js): what plays on item pickups in
    // the broadcast view. Off → each pack → Mix, or a random different one.
    sound_pack_next:   { name: 'Next item sound pack', good: true,
      app: function () { return soundPack('next'); } },
    sound_pack_random: { name: 'Random item sound pack', good: true,
      app: function () { return soundPack('random'); } },
    seed_roll:   { name: 'New seed!', good: false,
      app: function (job) { return startReroll(job, 'same'); } },
    seed_preset: { name: 'Random preset seed!', good: false,
      app: function (job) { return startReroll(job, 'preset'); } },
    seed_chaos:  { name: 'CHAOS seed!', good: false,
      app: function (job) { return startReroll(job, 'chaos'); } },
  };

  // ── app actions ────────────────────────────────────────────────────────
  // The roll functions show an alert() when they can't do it (no favourites
  // yet...). A dialog would freeze the stream, so while one of ours is
  // running, alerts go to the feed instead.
  var quietUntil = 0, realAlert = null;
  function quietAlerts() {
    if (typeof window === 'undefined' || !window.alert) return;
    quietUntil = Date.now() + 20000;
    if (realAlert) return;
    realAlert = window.alert;
    window.alert = function (msg) {
      if (Date.now() < quietUntil) { feed(String(msg), 'info'); return; }
      return realAlert.call(window, msg);
    };
  }
  function soundPack(how) {
    var sp = root.RandoSoundPacks;
    if (!sp) { feed('Not available: item sound packs', 'info'); return false; }
    if (!sp.packs().length) { feed('Add an item sound pack first (♪ Item Sounds in the broadcast view)', 'info'); return false; }
    sp[how]().then(function (id) { if (id !== null) feed('Item sounds: ' + sp.activeName(id), 'info'); });
    return true;
  }
  function press(ids, what) {
    if (typeof document === 'undefined') return false;
    for (var i = 0; i < ids.length; i++) {
      var b = document.getElementById(ids[i]);
      if (!b) continue;
      if (b.disabled) { feed('Busy, try again in a moment', 'info'); return false; }
      quietAlerts();
      b.click();
      return true;
    }
    feed('Not available: ' + what, 'info');
    return false;
  }

  // A new seed closes this game, so: only if allowed, and with a countdown.
  // A banner over the game shows viewers who triggered it, the countdown, the
  // seed being made, and the result. Three kinds of roll:
  //   same    the settings the streamer has now
  //   preset  a random preset from the Saved presets menu
  //   chaos   a random generator with every one of its menus randomized
  // (the last two use the randomizer's own helpers, randomizer/app.js crowdApi)
  var REROLL_SECS = 10, MAX_TRIES = 3;
  // A random preset or chaos pick that's still being made after this long is
  // given up on (the randomizer's Stop button) and another one is picked, so
  // a heavy combination doesn't hold the stream up for many minutes.
  var GIVE_UP_SECS = 180;
  var ROLL_KIND = {
    same:   { count: 'NEW SEED IN ', roll: 'Rolling a new seed…' },
    preset: { count: 'RANDOM PRESET IN ', roll: 'Rolling a random preset…' },
    chaos:  { count: 'CHAOS SEED IN ', roll: 'Rolling a CHAOS seed…' },
  };
  var rerollT = null, rerollLeft = 0, rerollBy = '', rerollMode = 'same', rerollPick = '', rerollTry = 0, rerollBusy = false;
  function randoApi() { var r = root.UnifiedRando; return r && r.crowd; }
  function startReroll(job, mode) {
    mode = ROLL_KIND[mode] ? mode : 'same';
    if (!cfg.allowReroll) { feed('Seed reroll is turned off in Crowd effects', 'info'); return false; }
    if (rerollT || rollWatch || rerollBusy) { feed('A new seed is already coming', 'info'); return false; }
    if (typeof document === 'undefined' || !document.getElementById('r-generate')) { feed('Not available: the randomizer', 'info'); return false; }
    if (mode !== 'same' && !randoApi()) { feed('Not available: the randomizer isn\'t ready', 'info'); return false; }
    rerollBy = (job && job.user && job.user !== 'test') ? job.user : '';
    rerollMode = mode; rerollPick = ''; rerollTry = 0;
    rerollLeft = REROLL_SECS;
    feed(ROLL_KIND[mode].count + REROLL_SECS + 's!', 'bad');
    showRerollCountdown();
    rerollT = setInterval(function () {
      rerollLeft--;
      if (rerollLeft > 0) {
        if (rerollLeft <= 3 || rerollLeft === 5) feed(ROLL_KIND[rerollMode].count + rerollLeft + '…', 'bad');
        showRerollCountdown(); render(); return;
      }
      clearInterval(rerollT); rerollT = null; render();
      rollNow();
    }, 1000);
    render();
    return true;
  }

  // Set up the settings for this kind of roll, then press Generate & Play.
  function rollNow() {
    // "Rerolls can land on either game" (games.js): this one may be Zelda 1,
    // which rolls in z1r/ with the flags last used there.
    var G = root.RandoGames;
    if (G && rerollTry === 0 && G.pickZ1()) {
      feed('The new seed is Zelda 1!', 'bad');
      banner('roll', 'Zelda 1 seed!', (rerollBy ? 'Courtesy of ' + rerollBy + ' · ' : '') + 'switching games', 0);
      setTimeout(function () { G.goZ1(rerollBy); }, 1500);
      return;
    }
    var gen = document.getElementById('r-generate');
    if (!gen || gen.disabled) { feed('A seed is already being made', 'info'); banner('done-bad', 'No new seed', 'A seed was already being made', 4000); return; }
    rerollTry++;
    rerollBusy = true;
    var setup;
    try {
      var api = randoApi();
      if (rerollMode === 'preset') {
        var list = api.pool ? api.pool() : api.presets();
        if (!list.length) throw new Error('there are no presets in the menu');
        var pick = list[Math.floor(Math.random() * list.length)];
        setup = api.usePreset(pick.value).then(function (label) {
          if (!label) throw new Error('couldn\'t set up ' + pick.label);
          return label;
        });
      } else if (rerollMode === 'chaos') {
        setup = api.chaos();
      } else setup = Promise.resolve('');
    } catch (e) { setup = Promise.reject(e); }
    setup.then(function (pickText) {
      rerollBusy = false;
      rerollPick = pickText;
      var g = document.getElementById('r-generate'), seed = document.getElementById('r-seed');
      if (!g || g.disabled) { banner('done-bad', 'No new seed', 'A seed was already being made', 4000); return; }
      quietAlerts();
      // reroll.js without its "are you sure?" box: empty the Seed box, Generate & Play
      if (seed) {
        seed.value = '';
        seed.dispatchEvent(new Event('input', { bubbles: true }));
        seed.dispatchEvent(new Event('change', { bubbles: true }));
      }
      feed(rerollMode === 'preset' ? 'Random preset: ' + pickText : rerollMode === 'chaos' ? 'CHAOS seed: ' + pickText.split(':')[0] : 'Rolling a new seed…', 'bad');
      g.click();
      watchRoll();
    }, function (e) {
      rerollBusy = false;
      console.warn('[crowd] seed roll setup', e);
      banner('done-bad', 'Seed reroll failed', String((e && e.message) || e), 6000);
      render();
    });
  }

  function cancelReroll() {
    if (!rerollT) return;
    clearInterval(rerollT); rerollT = null;
    feed('New seed cancelled', 'info');
    banner('done-bad', 'New seed cancelled', 'The streamer kept this seed', 4000);
  }
  function showRerollCountdown() {
    banner('count', ROLL_KIND[rerollMode].count + rerollLeft,
      (rerollBy ? 'from ' + rerollBy + ' · ' : '') + 'this game ends', 0, rerollLeft / REROLL_SECS);
  }

  // Follow the randomizer while it works: its Generate button stays disabled
  // until the seed is ready, and its status line says what it's doing. A
  // random preset or chaos roll that fails picks again (up to 3 tries).
  var rollWatch = null;
  function watchRoll() {
    var started = Date.now(), seenBusy = false, gaveUp = false;
    var title = ROLL_KIND[rerollMode].roll;
    var detail = rerollPick;
    clearInterval(rollWatch);
    rollWatch = setInterval(function () {
      var gen = document.getElementById('r-generate'), st = document.getElementById('r-status');
      var text = st ? st.textContent.trim() : '';
      var secs = Math.round((Date.now() - started) / 1000);
      if (gen && gen.disabled) seenBusy = true;
      if (!seenBusy && secs < 3) { banner('roll', title, 'Starting', 0, 0, detail); return; }
      var stop = document.getElementById('r-stop');
      var canGiveUp = rerollMode !== 'same' && rerollTry < MAX_TRIES && stop && !stop.hidden;
      if (gen && gen.disabled && canGiveUp && secs >= GIVE_UP_SECS && !gaveUp) {
        gaveUp = true;
        feed('Too slow, picking again', 'info');
        stop.click();
        return;
      }
      if (gen && gen.disabled && (secs < 900 || gaveUp)) {
        banner('roll', title, (text.replace(/\s*\d+s$/, '') || 'Working') + ' · ' + secs + 's' +
          (canGiveUp && !gaveUp ? ' (new pick at ' + GIVE_UP_SECS + 's)' : ''), 0, 0, detail);
        return;
      }
      clearInterval(rollWatch); rollWatch = null;
      var ok = st && st.className === 'ok' && /^(.*\. )?Ready/.test(text);
      if (ok) {
        var code = (text.match(/code ([^,(.]+(?: \/ [^,(.]+)*)/) || [])[1];
        var sub = (rerollBy ? 'Courtesy of ' + rerollBy : 'Good luck') + (code ? ' · code ' + code.trim() : '');
        var head = rerollMode === 'chaos' ? 'CHAOS seed ready!' : rerollMode === 'preset' ? 'Random preset ready!' : 'New seed ready!';
        banner('done-ok', head, sub, rerollPick ? 10000 : 6000, 0, detail);
      } else if (rerollMode !== 'same' && rerollTry < MAX_TRIES && (gaveUp || !/^Stopped/.test(text))) {
        feed('That one didn\'t work, picking again (' + (rerollTry + 1) + '/' + MAX_TRIES + ')', 'info');
        banner('roll', ROLL_KIND[rerollMode].roll, gaveUp ? 'That one was taking too long, picking again' : 'That pick didn\'t work, picking again', 0);
        setTimeout(rollNow, 800);
      } else {
        banner('done-bad', 'Seed reroll failed', text || 'Kept the current game', 6000);
      }
      render();
    }, 300);
  }

  // ── subathon clock (the bridge keeps the time; this just shows it) ──────
  var clockEl = null, clockPopT = null, lastAddId = 0;
  var CLOCK_CSS =
    '.cc-clock { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 24; pointer-events: none;' +
    ' display: flex; align-items: baseline; gap: 8px; padding: 4px 12px; border-radius: 8px; background: rgba(10,12,16,.8);' +
    ' color: #fff; font: 800 18px/1.1 ui-monospace, "Cascadia Mono", Consolas, monospace; text-shadow: 0 1px 2px #000;' +
    ' border: 1px solid rgba(227,179,65,.6); font-variant-numeric: tabular-nums; }' +
    '.cc-clock.paused .t { opacity: .6; } .cc-clock.ended { border-color: #e5534b; }' +
    '.cc-clock .p { color: #3fb950; font-size: 13px; font-family: system-ui, sans-serif; transition: opacity .6s; }';
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function showClock(t) {
    if (typeof document === 'undefined') return;
    var on = cfg.showTimer && t && t.active;
    if (!on) { if (clockEl) { clockEl.remove(); clockEl = null; } return; }
    var host = document.querySelector('.s9x'); if (!host) return;
    if (!document.getElementById('cc-clock-css')) { var st = document.createElement('style'); st.id = 'cc-clock-css'; st.textContent = CLOCK_CSS; document.head.appendChild(st); }
    if (!clockEl) { clockEl = document.createElement('div'); clockEl.innerHTML = '<span class="t"></span><span class="p"></span>'; }
    if (clockEl.parentNode !== host) host.appendChild(clockEl);
    clockEl.className = 'cc-clock' + (t.ended ? ' ended' : !t.running ? ' paused' : '');
    clockEl.querySelector('.t').textContent = t.ended ? 'TIME!' : fmtClock(t.remaining);
    var a = t.lastAdd;
    if (a && a.id !== lastAddId) {
      var first = !lastAddId; lastAddId = a.id;
      if (!first && a.seconds > 0) {
        var p = clockEl.querySelector('.p');
        var sx = a.seconds, add = sx < 60 ? sx + 's' : sx < 3600 ? Math.floor(sx / 60) + 'm' + (sx % 60 ? ' ' + sx % 60 + 's' : '') : fmtClock(sx);
        p.textContent = '+' + add + (a.user ? ' ' + a.user : '');
        p.style.opacity = '1';
        clearTimeout(clockPopT); clockPopT = setTimeout(function () { p.style.opacity = '0'; }, 4000);
      }
    }
  }

  // The banner itself: one element on the game picture, re-attached if the
  // player rebuilds its screen when the new ROM starts.
  var bannerEl = null, bannerHideT = null;
  var BANNER_CSS =
    '.cc-reroll { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); z-index: 26; pointer-events: none;' +
    ' min-width: 58%; max-width: 92%; box-sizing: border-box; padding: 10px 16px 12px; border-radius: 10px; text-align: center;' +
    ' background: rgba(10,12,16,.86); color: #fff; font: 700 13px/1.3 system-ui, sans-serif; text-shadow: 0 1px 2px #000;' +
    ' border: 2px solid #e5534b; box-shadow: 0 4px 18px rgba(0,0,0,.5); transition: opacity .5s; }' +
    '.cc-reroll .t { font-size: clamp(15px, 3.6vw, 28px); letter-spacing: .04em; }' +
    '.cc-reroll .s { margin-top: 3px; font-weight: 600; opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
    '.cc-reroll .d { margin-top: 5px; font-weight: 700; font-size: 13px; color: #f0c674; line-height: 1.35; }' +
    '.cc-reroll .bar { margin-top: 8px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.18); overflow: hidden; }' +
    '.cc-reroll .bar i { display: block; height: 100%; background: #e5534b; transition: width 1s linear; }' +
    '.cc-reroll.roll { border-color: #e3b341; } .cc-reroll.roll .bar i { width: 35% !important; background: #e3b341; animation: cc-slide 1.1s ease-in-out infinite alternate; }' +
    '.cc-reroll.done-ok { border-color: #3fb950; } .cc-reroll.done-bad { border-color: #8b95a3; }' +
    '.cc-reroll.count .t { animation: cc-pulse 1s ease-in-out infinite; }' +
    '@keyframes cc-slide { from { transform: translateX(0); } to { transform: translateX(185%); } }' +
    '@keyframes cc-pulse { 50% { transform: scale(1.06); } }' +
    '@media (prefers-reduced-motion: reduce) { .cc-reroll .t, .cc-reroll .bar i { animation: none !important; } }';
  function banner(kind, title, sub, hideAfter, frac, detail) {
    if (typeof document === 'undefined') return;
    clearTimeout(bannerHideT);
    if (!cfg.rerollOverlay) { if (bannerEl) bannerEl.remove(); return; }
    var host = document.querySelector('.s9x'); if (!host) return;
    if (!document.getElementById('cc-reroll-css')) { var st = document.createElement('style'); st.id = 'cc-reroll-css'; st.textContent = BANNER_CSS; document.head.appendChild(st); }
    if (!bannerEl) { bannerEl = document.createElement('div'); bannerEl.setAttribute('role', 'status'); bannerEl.innerHTML = '<div class="t"></div><div class="s"></div><div class="d"></div><div class="bar"><i></i></div>'; }
    if (bannerEl.parentNode !== host) host.appendChild(bannerEl);
    bannerEl.className = 'cc-reroll ' + kind;
    bannerEl.style.opacity = '1';
    bannerEl.querySelector('.t').textContent = title;
    bannerEl.querySelector('.s').textContent = sub || '';
    var dEl = bannerEl.querySelector('.d'); dEl.textContent = detail || ''; dEl.hidden = !detail;
    var bar = bannerEl.querySelector('.bar');
    bar.hidden = !(kind === 'count' || kind === 'roll');
    if (kind === 'count') bar.firstChild.style.width = Math.max(0, Math.min(1, frac || 0)) * 100 + '%';
    if (hideAfter) bannerHideT = setTimeout(function () {
      if (!bannerEl) return;
      bannerEl.style.opacity = '0';
      bannerHideT = setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 550);
    }, hideAfter);
  }

  // ── queue and timers ────────────────────────────────────────────────────
  var queue = [];              // { id, user, label }
  var active = {};             // id -> frames left
  var paused = {};             // outdoor-only effects waiting indoors
  var gap = 0;                 // frames until the next queued effect may run
  var GAP_FRAMES = 45;         // ~0.75 s between effects, so each one is seen
  var MAX_QUEUE = 60;
  var waitT = 0;
  var bossPick = 'ganon';

  // mapping.json can change how long timed effects last ("durations").
  var durations = {};
  function secsOf(id) {
    var f = EFFECTS[id]; if (!f || !f.secs) return 0;
    var d = +durations[id];
    return d > 0 && d <= 600 ? d : f.secs;
  }

  // a short history shown in the menu (Crowd effects → Recent), to see what
  // happened to each effect when something doesn't fire
  var hist = [];
  function note(t) {
    var d = new Date(); hist.push(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + ' ' + t);
    if (hist.length > 14) hist.shift();
  }
  function trigger(id, user, label) {
    var fx = EFFECTS[id];
    if (!fx) { console.warn('[crowd] unknown effect', id); note('unknown effect ' + id); return false; }
    if (queue.length >= MAX_QUEUE) { note('queue full, dropped ' + id); return false; }
    queue.push({ id: id, user: user || '', label: label || '' });
    note('queued ' + id + (user ? ' (' + user + ')' : '') + ', ' + queue.length + ' waiting');
    render();
    return true;
  }

  // Does this ROM read the switch an effect needs? Looked up once per ROM.
  var romSupport = {}, romKey = '';
  function romHas(core, sig) {
    var rom; try { rom = core.rom(); } catch (e) { return false; }
    if (!rom || !rom.length) return false;
    var key = rom.length + ':' + rom[0x7FDC] + ',' + rom[0x7FDD] + ',' + rom[0x7FC0] + ',' + rom[0x7FC1] + ',' + rom[0x7FC2];
    if (key !== romKey) { romKey = key; romSupport = {}; }
    var k = sig.join(',');
    if (!(k in romSupport)) {
      var found = false;
      outer: for (var i = 0, n = rom.length - sig.length; i <= n; i++) {
        if (rom[i] !== sig[0]) continue;
        for (var j = 1; j < sig.length; j++) if (rom[i + j] !== sig[j]) continue outer;
        found = true; break;
      }
      romSupport[k] = found;
    }
    return romSupport[k];
  }

  function holdSwitches(core, ram) {
    if (ram.length < 0x20000) return;
    for (var id in EFFECTS) {
      var h = EFFECTS[id].hold; if (!h) continue;
      var want = active[id] ? h.on : 0;
      if (ram[h.addr] !== want && romHas(core, EFFECTS[id].romCheck)) ram[h.addr] = want;
    }
  }

  function onFrame(core) {
    try { onFrameInner(core); } catch (e) { console.warn('[crowd]', e); note('error: ' + (e && e.message || e)); }
  }
  function onFrameInner(core) {
    var ram = core.wram();
    holdSwitches(core, ram);
    try { if (detour) detourFrame(core, ram); else sendRun(ram); } catch (e) { console.warn('[crowd] detour', e); }
    if (fluteWarp) fluteFrame(ram);
    // say why effects are waiting, once, if they wait more than ~4 s
    if (queue.length && (detour || !inPlay(ram))) {
      if (++waitT === 240) feed(queue.length + ' waiting: ' + (detour ? 'boss detour still running (' + detour.state + ')' :
        'Link isn\'t in normal play (mode ' + ram[A.MODE] + '/' + ram[A.SUBMODE] + ', frozen ' + ram[A.FROZEN] + ', hearts ' + ram[A.HP] + '/' + ram[A.HP_MAX] + ')'), 'info');
    } else waitT = 0;
    if (!inPlay(ram)) return;
    // timed effects
    var outside = ram[A.MODE] === 0x09;   // the ROM only spawns cuccos on the overworld
    for (var id in active) {
      var fx = EFFECTS[id];
      if (fx.frame) fx.frame(ram);
      if (fx.outdoors) {
        // Outdoor-only effects pause their clock indoors and pick up again outside.
        if (!outside) {
          if (!paused[id]) { paused[id] = true; feed(fx.name + ' paused indoors (' + Math.ceil(active[id] / 60) + 's left)', 'info'); render(); }
          continue;
        }
        if (paused[id]) { delete paused[id]; feed(fx.name + ' resumed', 'bad'); render(); }
      }
      if (--active[id] <= 0) { delete active[id]; delete paused[id]; if (fx.end) { try { fx.end(); } catch (e) {} } feed(fx.name + ' ended', 'end'); render(); }
    }
    if (gap > 0) { gap--; return; }
    if (detour) return;                      // queued effects wait until Link is back
    var job = queue.shift();
    if (!job) return;
    note('running ' + job.id);
    var f = EFFECTS[job.id];
    if (f.romCheck && !romHas(core, f.romCheck)) {
      feed(f.name + ' needs a randomizer ROM (not this one)', 'info'); render(); return;
    }
    var secs = secsOf(job.id);
    if (secs) {
      if (!active[job.id] && f.start) { try { f.start(); } catch (e) { console.warn('[crowd]', job.id, e); } }
      active[job.id] = (active[job.id] || 0) + Math.round(secs * (core.fps || 60.1));
    }
    else if (f.detour) {
      var dres = startDetour(job, f.detour, core, ram);
      if (typeof dres === 'string') { note('detour refused: ' + dres); feed(f.name + ': ' + dres, 'info'); render(); return; }
    }
    else if (f.app) { try { f.app(job); } catch (e) { console.warn('[crowd]', job.id, e); } }
    else {
      var res = f.apply(ram);
      if (typeof res === 'string' && !/^flute only/.test(res)) { feed(f.name + ': ' + res, 'info'); render(); return; }
      if (typeof res === 'string') feed(res, 'info');
      if (/^warp_/.test(job.id) && lastWarp) note('warp: ' + lastWarp);
    }
    gap = GAP_FRAMES;
    if (!f.detour) giftCard(job.user, job.label, f.name + (secs ? ' · ' + secs + 's' : '') + (/^warp_/.test(job.id) && lastWarp ? ': ' + lastWarp : ''), f.good);
    if (!cfg.alerts) feed((job.user ? job.user + ': ' : '') + (job.label ? job.label + ' → ' : '') + f.name + (secs ? ' (' + secs + 's)' : ''),
      f.good ? 'good' : 'bad');   // the gift card already says it
    send({ type: 'applied', effect: job.id, user: job.user });
    render();
  }

  // ── boss detour ────────────────────────────────────────────────────────
  // A save state is taken, Link is sent to a boss, and when the fight ends
  // (time's up, Link falls, or he wins) the save state is loaded again: the
  // run is exactly as it was. Nothing from the detour sticks, so it can't
  // break a seed, end the game early or count as a death.
  //
  // Getting there uses the game's own code (zelda3: Module11 falling
  // entrance, and the warp-tile transition Module07_15):
  //   1. $010E = entrance, module $11: Link drops in through that entrance
  //   2. for bosses deeper in a dungeon, a warp ($A0 = boss room, submodule
  //      $15) from that dungeon's lobby straight to the boss room
  // Entrance ids from the entrance randomizer's tables; rooms are vanilla.
  var BOSSES = {
    ganon:      { name: 'Ganon',      entrance: 0x37, room: 0x00 },   // via Ganon's Tower's lobby, like the others (the Pyramid drop could leave Link in a dark, unfinished room)
    aga1:       { name: 'Agahnim',    entrance: 0x24, room: 0x20, at: [0x078, 0x1C0] },
    aga2:       { name: 'Agahnim 2',  entrance: 0x37, room: 0x0D },
    armos:      { name: 'Eastern Palace boss', entrance: 0x08, room: 0xC8, at: [0x178, 0x1C0] },
    lanmolas:   { name: 'Desert Palace boss',  entrance: 0x09, room: 0x33, at: [0x028, 0x1C0] },
    moldorm:    { name: 'Tower of Hera boss',  entrance: 0x33, room: 0x07 },
    helmasaur:  { name: 'Palace of Darkness boss', entrance: 0x26, room: 0x5A },
    arrghus:    { name: 'Swamp Palace boss',   entrance: 0x25, room: 0x06 },
    mothula:    { name: 'Skull Woods boss',    entrance: 0x2B, room: 0x29, at: [0x178, 0x1C0] },
    blind:      { name: "Thieves' Town boss",  entrance: 0x34, room: 0xAC, at: [0x178, 0x1C0] },
    kholdstare: { name: 'Ice Palace boss',     entrance: 0x2D, room: 0xDE },
    vitreous:   { name: 'Misery Mire boss',    entrance: 0x27, room: 0x90 },
    trinexx:    { name: 'Turtle Rock boss',    entrance: 0x35, room: 0xA4, at: [0x078, 0x1C0] },
  };
  // After the warp Link still has the lobby's spot in the room and the lobby's
  // camera quarter, which can be inside a wall or the wrong part of the boss
  // room. placeLink() puts him on open floor in the arena and sets the camera
  // like a fresh room entry (bounds and scroll lines as lttphack's
  // ConfigureCameraToCoordinates; full-size quarters as Dungeon_AdjustForRoomLayout).
  // at: [x, y] in the room = where the boss door lets him in (lttphack presets);
  // otherwise the quarter with the most floor (and real walls) is the arena.
  var LQF = [0xF, 0xF, 0xF, 0xF, 0xB, 0xB, 7, 7, 0xF, 0xB, 0xF, 7, 0xB, 0xF, 7, 0xF, 0xE, 0xD, 0xE, 0xD, 0xF, 0xF, 0xE, 0xD, 0xE, 0xD, 0xF, 0xF, 0xA, 9, 6, 5];
  var FLOOR = { 0x00: 1, 0x09: 1, 0x0E: 1, 0x0F: 1 };   // floor, shallow water, ice
  // boss sprites (zelda3 sprite ids): Moldorm, Armos, Lanmolas, Agahnim, Mothula, Arrghus,
  // Helmasaur, Kholdstare, Vitreous, Trinexx, Blind, Ganon. The quarter the boss is
  // in is the arena, whatever boss shuffle put there.
  var BOSS_SPRITES = { 0x09: 1, 0x53: 1, 0x54: 1, 0x7A: 1, 0x88: 1, 0x8C: 1, 0x92: 1, 0xA2: 1, 0xA3: 1, 0xBD: 1, 0xCB: 1, 0xCC: 1, 0xCD: 1, 0xCE: 1, 0xD6: 1, 0xD7: 1 };
  function bossSpot(ram) {
    for (var k = 0; k < 16; k++) {
      if (ram[0xDD0 + k] && BOSS_SPRITES[ram[0xE20 + k]]) return [ram[0xD10 + k] | ram[0xD30 + k] << 8, ram[0xD00 + k] | ram[0xD20 + k] << 8];
    }
    return null;
  }
  function placeLink(ram, at) {
    var R = ram[0xA0] | ram[0xA1] << 8; if (R > 0x127) return false;
    var Bx = (R & 0xF) << 9, By = (R >> 4) << 9;
    var attr = function (tx, ty) { return tx < 0 || ty < 0 || tx > 63 || ty > 63 ? 1 : ram[0x12000 + ty * 64 + tx]; };
    var clear = function (tx, ty) { for (var dy = -1; dy <= 2; dy++) for (var dx = -1; dx <= 2; dx++) if (!FLOOR[attr(tx + dx, ty + dy)]) return false; return true; };
    // nearest clear spot to (sx, sy) tiles inside quarter (qx, qy)
    var nearest = function (sx, sy, qx, qy, maxR) {
      var x0 = qx * 32 + 3, x1 = qx * 32 + 28, y0 = qy * 32 + 4, y1 = qy * 32 + 27;
      for (var r = 0; r <= maxR; r++) {
        var hit = null, hd = 1e9;
        for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var tx = sx + dx, ty = sy + dy;
          if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 && dx * dx + dy * dy < hd && clear(tx, ty)) { hit = [tx, ty]; hd = dx * dx + dy * dy; }
        }
        if (hit) return hit;
      }
      return null;
    };
    var spot = null, boss = bossSpot(ram);
    if (boss) {
      var bx = (boss[0] - Bx) & 0x1FF, by = (boss[1] - By) & 0x1FF, bqx = bx >> 8, bqy = by >> 8;
      if (at && (at[0] >> 8) === bqx && (at[1] >> 8) === bqy) spot = nearest(at[0] >> 3, at[1] >> 3, bqx, bqy, 10);
      // otherwise the side of the boss's quarter away from the boss
      if (!spot) spot = nearest(bqx * 32 + 15, bqy * 32 + ((by & 0xFF) < 0x80 ? 24 : 8), bqx, bqy, 24);
    }
    if (!spot && at) spot = nearest(at[0] >> 3, at[1] >> 3, at[0] >> 8, at[1] >> 8, 10);
    if (!spot) {
      var best = -1, bq = null;
      for (var q = 0; q < 4; q++) {
        var qx = q & 1, qy = q >> 1, fl = 0, wl = 0;
        for (var ty = qy * 32; ty < qy * 32 + 32; ty++) for (var tx = qx * 32; tx < qx * 32 + 32; tx++) { var a = attr(tx, ty); if (FLOOR[a]) fl++; else if (a >= 1 && a <= 3) wl++; }
        if (wl > 60 && fl > best) { best = fl; bq = [qx, qy]; }
      }
      if (bq) spot = nearest(bq[0] * 32 + 15, bq[1] * 32 + 24, bq[0], bq[1], 24);   // start low and central, away from the boss
    }
    if (!spot) return false;
    var w16 = function (a, v) { ram[a] = v & 0xFF; ram[a + 1] = (v >> 8) & 0xFF; };
    var X = Bx + spot[0] * 8, Y = By + spot[1] * 8;
    var qx2 = (X & 0x100) ? 1 : 0, qy2 = (Y & 0x100) ? 2 : 0;
    w16(0x22, X); w16(0x20, Y);
    ram[0xEE] = 0; ram[0x476] = 0; ram[0x6C] = 0; ram[0x2F] = 0;      // upper floor, not in a doorway, facing up
    ram[0xA9] = qx2; ram[0xAA] = qy2;
    var yA0 = Y & 0xFF00, yB0 = Y & 0xFE00, xA0 = X & 0xFF00, xB0 = X & 0xFE00;
    w16(0x600, yA0); w16(0x602, yB0); w16(0x604, yA0 | 0x10); w16(0x606, yB0 | 0x110);
    w16(0x608, xA0); w16(0x60A, xB0); w16(0x60C, xA0); w16(0x60E, xB0 + 0x100);
    var comp = (ram[0x40E] & 0x1C) | qy2 | qx2; ram[0xA8] = comp;
    var fsx = (LQF[comp] & (qx2 ? 2 : 1)) ? 0 : 2, fsy = (LQF[comp] & (qy2 ? 8 : 4)) ? 0 : 2;
    ram[0xA6] = fsx; ram[0xA7] = fsy;
    var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
    var cx = fsx ? clamp(X - 0x78, xB0, xB0 + 0x100) : xA0;
    var cy = fsy ? clamp(Y - 0x70, yB0, yB0 + 0x110) : clamp(Y - 0x70, yA0, yA0 + 0x10);
    [0xE2, 0xE0, 0x11E, 0x120].forEach(function (a) { w16(a, cx); });
    [0xE8, 0xE6, 0x122, 0x124].forEach(function (a) { w16(a, cy); });
    var yh = (cy - 0x186) & 0x1FF, xh = (cx - 0x17F) & 0x1FF;
    w16(0x61A, yh); w16(0x618, yh - 2); w16(0x61E, xh); w16(0x61C, xh - 2);
    // and as this room's entry point, so falling in a pit puts him back here
    w16(0xC180, cx); w16(0xC182, cy); w16(0xC184, Y); w16(0xC186, X);
    w16(0xC188, yA0); w16(0xC18A, yA0 | 0x10); w16(0xC18C, xA0); w16(0xC18E, xA0);
    w16(0xC198, yh - 2); w16(0xC19A, xh - 2);
    ram[0xC19C] = fsx; ram[0xC19D] = fsy; ram[0xC19E] = qx2; ram[0xC19F] = qy2;
    ram[0xC1A6] = 0; ram[0xC1A7] = 0; ram[0xC1A8] = 0;
    return true;
  }
  var WIN_MODULES = { 0x13: 1, 0x15: 1, 0x16: 1, 0x18: 1, 0x19: 1, 0x1A: 1 };   // prize, Aga warp, crystal, Ganon emerges, triforce, credits
  var detour = null;          // { id, boss, by, state, snap, frames, total, hpMax, wait }
  var detourEl = null;
  function detourSecs(id) { var d = +(durations[id] || durations.boss_detour); return d >= 10 && d <= 600 ? d : 60; }
  function startDetour(job, which, core, ram) {
    if (detour) return 'Already on a boss detour';
    var ids = Object.keys(BOSSES);
    // random: only bosses not beaten yet in this run (their room's "boss beaten" flag),
    // so viewers never send Link to an arena he already cleared. Ganon is always in.
    var fresh = ids.filter(function (k) {
      var b = BOSSES[k];
      if (k === 'ganon' || b.room == null) return true;
      if (k === 'aga1') return ram[0xF3C5] < 3;            // game progress: 3 = Agahnim beaten
      return !(ram[0xF000 + b.room * 2 + 1] & 0x08);     // room flags "dddd bkut": b = boss beaten
    });
    if (!fresh.length) fresh = ids;
    var key = which === 'random' ? fresh[Math.floor(Math.random() * fresh.length)] : which;
    var b = BOSSES[key]; if (!b) return 'Unknown boss';
    var snap; try { snap = core.saveState(); } catch (e) { snap = null; }
    if (!snap || !snap.length) return 'Could not save the game first, so no detour';
    detour = { key: key, boss: b, by: job.user || '', state: 'entering', snap: snap.slice ? snap.slice() : snap, frames: 0,
      total: Math.round(detourSecs(job.id) * (core.fps || 60.1)), hpMax: ram[A.HP_MAX], wait: 0 };
    // Blind only shows up once the maiden has turned into him: his room's
    // flag (save word bit 0x0200, which the game moves to $0402 bit 0x2000;
    // zelda3 SpritePrep_Blind_PrepareBattle) and no maiden following Link.
    // Set for the trip only; the save state puts both back.
    if (b.room === 0xAC) {
      ram[0xF000 + 0xAC * 2 + 1] |= 0x02;
      if (ram[0xF3CC] === 0x06) ram[0xF3CC] = 0;
    }
    // 1. drop in through the entrance
    ram[0x10E] = b.entrance; ram[0x10F] = 0;
    ram[0x10] = 0x11; ram[0x11] = 0; ram[0xB0] = 0;
    note('detour start: ' + b.name);
    detourHud('BOSS DETOUR', b.name + (detour.by ? ' · sent by ' + detour.by : ''), 1);
    send({ type: 'detour', phase: 'start', boss: b.name, user: detour.by, secs: detourSecs(job.id) });
    return true;
  }
  function detourFrame(core, ram) {
    if (!detour) return;
    var d = detour, mode = ram[0x10], sub = ram[0x11];
    if (++d.wait > 60 * 30 && d.state !== 'fight') return endDetour(core, 'lost', 'Couldn\'t reach the boss');
    if (d.state === 'entering') {
      // In some lobbies (Swamp) Link stays "frozen" a long time after landing, so
      // don't wait for that: a room that's been steady for a third of a second will do.
      d.steady = (mode === 0x07 && sub === 0) ? (d.steady || 0) + 1 : 0;
      if (d.boss.room != null && !d.fellBack && d.wait > 60 * 10 && d.steady === 0) {
        // still not in a dungeon room after 10 s: drop in through the Eastern Palace lobby instead
        d.fellBack = true; ram[0x10E] = 0x08; ram[0x10F] = 0; ram[0x10] = 0x11; ram[0x11] = 0; ram[0xB0] = 0;
        return;
      }
      if (d.steady >= 20) {
        if (d.boss.room != null && ram[0xA0] !== d.boss.room) {
          // 2. warp from the lobby to the boss room
          // the boss is always there: clear "boss beaten" for that room, and for
          // Blind the "maiden revealed" flag his fight needs (no maiden following).
          // The save state puts both back afterwards.
          var rb = 0xF000 + d.boss.room * 2 + 1;
          ram[rb] &= ~0x08 & 0xFF;
          if (d.boss.room === 0xAC) { ram[rb] |= 0x20; if (ram[0xF3CC] === 6) ram[0xF3CC] = 0; }
          ram[0xA2] = ram[0xA0]; ram[0xA3] = ram[0xA1];
          ram[0xA0] = d.boss.room; ram[0xA1] = 0;
          ram[0x11] = 0x15; ram[0xB0] = 0;
          d.state = 'warping'; note('warp to room ' + d.boss.room.toString(16));
        } else { d.state = 'fight'; d.frames = 0; }
      }
      return;
    }
    if (d.state === 'warping') {
      if (mode === 0x07 && sub === 0) {
        try { if (!placeLink(ram, d.boss.at)) console.warn('[crowd] detour: no clear floor found, Link stays where the warp put him'); } catch (e) { console.warn('[crowd] detour place', e); }
        // a screen mask left on from the entrance (spotlight/water windows) would show
        // only a strip of the room: turn window masking off (W12SEL, W34SEL, WOBJSEL, TMW, TSW)
        ram[0x96] = 0; ram[0x97] = 0; ram[0x98] = 0; ram[0x1E] = 0; ram[0x1F] = 0;
        d.state = 'fight'; d.frames = 0;
      }
      return;
    }
    if (d.state !== 'fight') return;
    // how did it go?
    if (mode === 0x12 || ram[A.HP] === 0) return endDetour(core, 'ko', 'Link went down!');
    if (WIN_MODULES[mode] || ram[A.HP_MAX] > d.hpMax) return endDetour(core, 'won', 'BOSS DEFEATED!');
    if (mode === 0x09 || mode === 0x0B) return endDetour(core, 'escaped', 'LINK ESCAPED!');
    if (mode === 0x07 || mode === 0x09 || mode === 0x0B) d.frames++;   // menus don't count
    if (d.wait > d.total + 60 * 45) return endDetour(core, 'survived', 'SURVIVED!');   // never stuck on a detour
    var left = Math.max(0, d.total - d.frames);
    if (d.frames % 15 === 0) detourHud('BOSS DETOUR ' + Math.ceil(left / 60) + 's', d.boss.name + (d.by ? ' · sent by ' + d.by : ''), left / d.total);
    if (left <= 0) endDetour(core, 'survived', 'SURVIVED!');
  }
  function endDetour(core, result, title) {
    var d = detour; if (!d || d.state === 'ending') return;
    note('detour end (' + result + ') from ' + d.state);
    d.state = 'ending';
    // load the save state between frames, not in the middle of one
    setTimeout(function () {
      try { if (!core.loadState(d.snap)) throw new Error('state did not load'); } catch (e) { console.warn('[crowd] detour return', e); feed('Boss detour: couldn\'t return automatically. Load your last save state.', 'info'); }
      detour = null; runSent = ''; note('back to the run');
      detourHud(title, d.boss.name + ' · back to the run', -1);
      feed('Boss detour (' + d.boss.name + '): ' + ({ won: 'won!', survived: 'survived', ko: 'knocked out', escaped: 'escaped' }[result] || 'cancelled'), result === 'ko' || result === 'lost' ? 'bad' : 'good');
      send({ type: 'detour', phase: 'end', result: result, boss: d.boss.name, user: d.by });
      render();
    }, 0);
  }
  // Testing: send Link to one boss in particular (Studio's "Test this boss",
  // or CrowdEffects.detourTo('blind') in the console). Gifts still pick at random.
  function testBoss(key, user) {
    if (!BOSSES[key]) { feed('Unknown boss: ' + key, 'info'); return false; }
    var id = '_detour_' + key;   // one per boss, so queued tests keep their boss
    EFFECTS[id] = { name: 'Boss detour: ' + BOSSES[key].name, good: false, detour: key };
    return trigger(id, user || 'test', 'test');
  }
  function cancelDetour() { var c = core(); if (detour && c) endDetour(c, 'lost', 'DETOUR CANCELLED'); }
  var DETOUR_CSS =
    '.cc-detour { position: absolute; z-index: 27; pointer-events: none; transform: translateX(-50%); text-align: center;' +
    ' padding: 5px 12px 6px; border-radius: 8px; background: rgba(18,12,34,.92); border: 2px solid #e63946; color: #fff;' +
    ' box-shadow: 0 4px 14px rgba(0,0,0,.5); transition: opacity .5s; min-width: 150px; }' +
    '.cc-detour .t { font: 9px/1.3 "Rando Pixel", ui-monospace, monospace; color: #ff8a92; letter-spacing: .04em; }' +
    '.cc-detour .s { font: 700 12px/1.25 system-ui, sans-serif; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }' +
    '.cc-detour .b { margin-top: 4px; height: 4px; border-radius: 3px; background: rgba(255,255,255,.18); overflow: hidden; }' +
    '.cc-detour .b i { display: block; height: 100%; background: #e63946; transition: width .3s linear; }' +
    '.cc-detour.done { border-color: #ffd166; } .cc-detour.done .t { color: #ffd166; font-size: 11px; } .cc-detour.done .b { display: none; }';
  var detourHideT = null;
  function detourHud(title, sub, frac) {
    if (typeof document === 'undefined') return;
    var host = document.querySelector('.s9x'); if (!host) return;
    if (!document.getElementById('cc-detour-css')) { var st = document.createElement('style'); st.id = 'cc-detour-css'; st.textContent = DETOUR_CSS; document.head.appendChild(st); }
    if (!detourEl || !detourEl.isConnected) { detourEl = document.createElement('div'); detourEl.className = 'cc-detour'; detourEl.innerHTML = '<div class="t"></div><div class="s"></div><div class="b"><i></i></div>'; host.appendChild(detourEl); }
    // top right of the game picture, over the hearts' row edge but off the play area
    var P = root.Snes9xPlayer, r = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (r && r.w) { detourEl.style.left = Math.round(r.x + r.w * 0.5) + 'px'; detourEl.style.top = Math.round(r.y + r.h * 0.012) + 'px'; }
    clearTimeout(detourHideT);
    detourEl.style.opacity = '1';
    detourEl.classList.toggle('done', frac < 0);
    detourEl.querySelector('.t').textContent = title;
    detourEl.querySelector('.s').textContent = sub || '';
    if (frac >= 0) detourEl.querySelector('.b i').style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    if (frac < 0) detourHideT = setTimeout(function () { if (detourEl) { detourEl.style.opacity = '0'; } }, 3500);
  }

  function endAll() {
    for (var id in active) { var f = EFFECTS[id]; if (f && f.end) { try { f.end(); } catch (e) {} } }
    active = {};
  }

  // ── run stats for the bridge (deaths, checks, dungeon, seed, music) ─────
  // SRAM counters from z3randomizer sram.asm (see tracker/js/items.js):
  // TotalItemCounter $7EF423 (2 bytes), DeathCounter $7EF449, BonkCounter $7EF420.
  var DUNGEONS = ['Hyrule Castle', 'Hyrule Castle', 'Eastern Palace', 'Desert Palace', "Agahnim's Tower", 'Swamp Palace',
    'Palace of Darkness', 'Misery Mire', 'Skull Woods', 'Ice Palace', 'Tower of Hera', "Thieves' Town", 'Turtle Rock', "Ganon's Tower"];
  // Bosses beaten, from each boss room's "boss beaten" flag (room flags
  // "dddd bkut", b = 0x08 in the high byte; the same bit Hutch's tracker
  // reads), and Agahnim from the game's progress. Never read during a boss
  // detour (sendRun isn't called then), and the detour's save state puts the
  // flags back afterwards, so a detour win doesn't count.
  var BOSS_ROOMS = [['armos', 0xC8], ['lanmolas', 0x33], ['moldorm', 0x07], ['helmasaur', 0x5A], ['arrghus', 0x06],
    ['mothula', 0x29], ['blind', 0xAC], ['kholdstare', 0xDE], ['vitreous', 0x90], ['trinexx', 0xA4], ['aga2', 0x0D]];
  // Ganon's Tower chests (room-flag offsets from $7EF000, the same table as
  // Hutch's tracker, js/dngpanel.js, MIT): 26 chests, not Bob's Torch. For the
  // "which GT chest has the big key?" guessing game: gt.at is how many GT chests
  // were open when the big key arrived (that chest included). Only known if the
  // key was seen missing first and it turned up inside GT.
  var GT_CHESTS = [[0x118, 0x20], [0x118, 0x40], [0x11a, 0x10], [0x13a, 0x10], [0x13a, 0x20], [0x13a, 0x40], [0x13a, 0x80],
    [0x0f6, 0x10], [0x0f6, 0x20], [0x0f6, 0x40], [0x0f6, 0x80], [0x116, 0x10], [0x0fa, 0x10], [0x0f8, 0x10], [0x0f8, 0x20],
    [0x0f8, 0x40], [0x0f8, 0x80], [0x118, 0x80], [0x118, 0x10], [0x038, 0x20], [0x038, 0x40], [0x038, 0x10], [0x07a, 0x10],
    [0x07a, 0x20], [0x07a, 0x40], [0x09a, 0x10]];
  function gtOpened(ram) {
    var n = 0;
    for (var i = 0; i < GT_CHESTS.length; i++) if (ram[0xF000 + GT_CHESTS[i][0]] & GT_CHESTS[i][1]) n++;
    return n;
  }
  var gtArmed = false;
  var run = { deaths: -1, checks: 0, bonks: 0, place: '', seed: '', music: '', bosses: [],
    gt: { opened: 0, total: 26, found: false, at: null } }, runSent = '', runT = 0;
  function readRun(ram) {
    if (ram.length < 0x20000) return;
    var mode = ram[A.MODE];
    var P0 = root.Snes9xPlayer, seed0 = (P0 && P0.gameName) || '';
    if (seed0 && run.seed && seed0 !== run.seed) {
      // another game: its counts start over (the bridge sees the new seed and
      // doesn't count the drop as anything)
      run.checks = 0; run.bonks = 0; run.deaths = -1; run.bosses = [];
      run.gt = { opened: 0, total: 26, found: false, at: null }; gtArmed = false;
    }
    if (PLAY_MODES[mode]) {
      var gtFound = !!(ram[0xF366] & 0x04), gtNow = gtOpened(ram);
      if (!gtFound) { gtArmed = true; run.gt = { opened: gtNow, total: 26, found: false, at: null }; }
      else {
        // the key just turned up: the chest count right now is the answer
        // (if it came from a GT chest; $040C 0x1A = in Ganon's Tower)
        if (gtArmed && run.gt.at === null && !run.gt.found) run.gt.at = ram[0x40C] === 0x1A ? gtNow : null;
        run.gt.opened = gtNow; run.gt.found = true;
      }
      if (ram[0xF3C5] >= 3 && run.bosses.indexOf('aga1') < 0) run.bosses.push('aga1');
      BOSS_ROOMS.forEach(function (b) {
        if ((ram[0xF000 + b[1] * 2 + 1] & 0x08) && run.bosses.indexOf(b[0]) < 0) run.bosses.push(b[0]);
      });
      var checks = ram[0xF423] | (ram[0xF424] << 8), deaths = ram[0xF449], bonks = ram[0xF420];
      if (checks < 2000 && checks >= run.checks) run.checks = checks;
      if (bonks >= run.bonks && bonks < 10000) run.bonks = bonks;
      if (run.deaths < 0) run.deaths = deaths;                    // first read: no "death" for old ones
      else if (deaths > run.deaths && deaths - run.deaths < 5) { run.deaths = deaths; send({ type: 'death', deaths: deaths }); }
      var d = ram[0x40C];
      run.place = mode === 0x07 && d !== 0xFF && d / 2 < DUNGEONS.length ? DUNGEONS[d >> 1] : mode === 0x07 ? 'Indoors' : ram[0x8A] >= 0x40 ? 'Dark World' : 'Light World';
    }
    var P = root.Snes9xPlayer;
    run.seed = (P && P.gameName) || '';
    var m = root.UnifiedRando && root.UnifiedRando.music;
    run.music = m && m.count ? m.pack || 'MSU-1' : '';
    run.hearts = ram[A.HP_MAX] >> 3;
  }
  function sendRun(ram) {
    if (status !== 'connected') return;
    if (++runT % 60) return;                                       // about once a second
    readRun(ram);
    var j = JSON.stringify(run);
    if (j !== runSent) {
      if (run.music !== JSON.parse(runSent || '{}').music && runSent) send({ type: 'music', pack: run.music });
      runSent = j; send(Object.assign({ type: 'run' }, run, { deaths: Math.max(0, run.deaths) }));
    }
  }

  function onInput(pad) {
    var p = window.Snes9xPlayer, core = p && p.core;
    if (!core) return pad;
    var any = false;
    for (var id in active) { if (EFFECTS[id].input) { any = true; break; } }
    if (!any || !inPlay(core.wram())) return pad;
    for (var k in active) if (EFFECTS[k].input) pad = EFFECTS[k].input(pad);
    return pad;
  }

  // ── on-screen feed (top-right of the game, so a TikTok viewer sees it) ──
  var feedEl = null;
  var CSS =
    '.cc-feed { position: absolute; right: 8px; top: 8px; z-index: 25; display: flex; flex-direction: column; align-items: flex-end;' +
    ' gap: 4px; pointer-events: none; max-width: 70%; font: 600 12px/1.25 system-ui, sans-serif; }' +
    '.cc-feed div { background: rgba(10,12,16,.82); color: #fff; padding: 4px 9px; border-radius: 6px; border-left: 3px solid #8b95a3;' +
    ' transition: opacity .4s; text-shadow: 0 1px 1px #000; }' +
    '.cc-feed .good { border-left-color: #3fb950; } .cc-feed .bad { border-left-color: #e5534b; } .cc-feed .end { opacity: .7; }' +
    '.cc-feed .info { border-left-color: #e3b341; }';
  // Gift alert on the game itself, over the hearts (top right of the HUD), like
  // the MSU "NOW PLAYING" card: shows on stream with the game, no overlay needed.
  var GIFT_CSS =
    '@font-face { font-family: "Rando Pixel"; src: url(fonts/PressStart2P-Regular.ttf) format("truetype"); font-display: swap; }' +
    '.cc-gift { position: absolute; left: 79%; top: 8px; transform: translate(-50%, -8px); z-index: 26; pointer-events: none;' +
    ' display: flex; align-items: center; gap: 8px; max-width: 40%; padding: 5px 12px 5px 9px; border-radius: 8px;' +
    ' background: rgba(18,12,34,.92); border: 2px solid #e63946; box-shadow: 0 4px 14px rgba(0,0,0,.5); color: #fff;' +
    ' opacity: 0; transition: opacity .3s ease, transform .3s ease; }' +
    '.cc-gift.show { opacity: 1; transform: translate(-50%, 0); }' +
    '.cc-gift.good { border-color: #3fb950; }' +
    '.cc-gift .ic { font-size: 18px; line-height: 1; animation: cc-gift-bop .45s ease-in-out infinite alternate; }' +
    '@keyframes cc-gift-bop { to { transform: translateY(-3px) scale(1.1); } }' +
    '.cc-gift > span:last-child { min-width: 0; }' +
    '.cc-gift .lab { display: block; font: 7px/1.2 "Rando Pixel", ui-monospace, monospace; color: #ff8a92; letter-spacing: .04em; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.cc-gift.good .lab { color: #7ee787; }' +
    '.cc-gift .nm { display: block; font: 700 13px/1.2 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; }' +
    '.cc-gift .fx { display: block; font: 600 11px/1.2 system-ui, sans-serif; color: #ffd166; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }';
  var giftQ = [], giftEl = null, giftBusy = false;
  function giftCard(user, label, what, good) {
    if (!cfg.alerts || typeof document === 'undefined') return;
    giftQ.push({ user: user, label: label, what: what, good: good });
    if (giftQ.length > 6) giftQ.splice(0, giftQ.length - 6);
    if (!giftBusy) giftNext();
  }
  function giftNext() {
    var g = giftQ.shift(); if (!g) { giftBusy = false; return; }
    var host = document.querySelector('.s9x'); if (!host) { giftBusy = false; giftQ = []; return; }
    giftBusy = true;
    if (!document.getElementById('cc-gift-css')) { var st = document.createElement('style'); st.id = 'cc-gift-css'; st.textContent = GIFT_CSS; document.head.appendChild(st); }
    if (!giftEl || !giftEl.isConnected) {
      giftEl = document.createElement('div'); giftEl.className = 'cc-gift';
      giftEl.innerHTML = '<span class="ic">🎁</span><span><span class="lab"></span><span class="nm"></span><span class="fx"></span></span>';
      host.appendChild(giftEl);
    }
    var P = window.Snes9xPlayer, r = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (r && r.w > 0) {   // over the hearts: right part of the HUD, near the top of the picture
      giftEl.style.left = Math.round(r.x + r.w * 0.79) + 'px';
      giftEl.style.top = Math.round(r.y + r.h * 0.035) + 'px';
      giftEl.style.maxWidth = Math.round(r.w * 0.4) + 'px';
    }
    var lab = String(g.label || '');
    var kind = /^followed$/i.test(lab) ? 'NEW FOLLOWER' : /^shared$/i.test(lab) ? 'STREAM SHARED' : /^likes?\b/i.test(lab) ? 'LIKES' : lab && lab !== 'test' ? 'GIFT · ' + lab : 'CROWD EFFECT';
    giftEl.querySelector('.ic').textContent = /follow/i.test(kind) ? '⭐' : /share/i.test(kind) ? '📣' : /like/i.test(kind) ? '❤️' : '🎁';
    giftEl.querySelector('.lab').textContent = kind.toUpperCase();
    giftEl.querySelector('.nm').textContent = g.user || 'Someone';
    giftEl.querySelector('.fx').textContent = '→ ' + g.what;
    giftEl.classList.toggle('good', !!g.good);
    giftEl.classList.remove('show'); void giftEl.offsetWidth; giftEl.classList.add('show');
    setTimeout(function () {
      if (giftEl) giftEl.classList.remove('show');
      setTimeout(giftNext, 350);
    }, giftQ.length ? 2200 : 3000);
  }

  function feed(text, kind) {
    if (!cfg.feed || typeof document === 'undefined') return;
    if (!feedEl || !feedEl.isConnected) {
      var host = document.querySelector('.s9x'); if (!host) return;
      if (!document.getElementById('cc-css')) { var st = document.createElement('style'); st.id = 'cc-css'; st.textContent = CSS; document.head.appendChild(st); }
      feedEl = document.createElement('div'); feedEl.className = 'cc-feed'; host.appendChild(feedEl);
    }
    var d = document.createElement('div');
    d.className = kind || ''; d.textContent = text;
    feedEl.appendChild(d);
    while (feedEl.children.length > 4) feedEl.firstChild.remove();
    setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); }, 4000);
  }

  // ── connection to the bridge ────────────────────────────────────────────
  var ws = null, status = 'off', retryT = null, retryMs = 2000, bridgeInfo = '';
  function send(msg) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } }

  function connect() {
    clearTimeout(retryT);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    if (!cfg.enabled) { status = 'off'; render(); return; }
    status = 'connecting'; render();
    try { ws = new WebSocket(cfg.url); } catch (e) { status = 'bad address'; render(); return; }
    ws.onopen = function () {
      status = 'connected'; retryMs = 2000; render();
      send({ type: 'hello', app: 'alttpr-snes9x', effects: list() });
      runSent = '';
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'effect') {
        var n = Math.max(1, Math.min(10, m.count | 0 || 1));
        for (var i = 0; i < n; i++) trigger(m.effect, m.user, m.label);
      } else if (m.type === 'timer') {
        showClock(m);
      } else if (m.type === 'detour-test') {
        testBoss(m.boss, m.user);
      } else if (m.type === 'detour-end') {
        cancelDetour();
      } else if (m.type === 'durations') {
        durations = m.secs && typeof m.secs === 'object' ? m.secs : {};
        render();
      } else if (m.type === 'status') {
        bridgeInfo = m.text || ''; render();
        if (m.text) feed(m.text, 'info');
      } else if (m.event && !m.type && bridgeInfo.indexOf('TikFinity') !== 0) {
        // TikFinity's own feed ({event, data}): the address points at TikFinity,
        // not the bridge, which listens one port up in TikFinity mode.
        bridgeInfo = 'TikFinity, not the bridge: use ws://localhost:21214'; render();
      }
    };
    ws.onclose = function () {
      ws = null;
      if (!cfg.enabled) return;
      status = 'waiting for bridge'; render();
      retryT = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };
    ws.onerror = function () {};
  }

  // ── menu section (in the emulator's ⋯ menu) ─────────────────────────────
  var rerender = null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function menuHtml(rr) {
    if (rr) rerender = rr;
    var timed = Object.keys(active).map(function (id) { return EFFECTS[id].name + ' ' + Math.ceil(active[id] / 60) + 's' + (paused[id] ? ' (paused indoors)' : ''); });
    var tests = Object.keys(EFFECTS).filter(function (id) { return id.charAt(0) !== '_'; }).map(function (id) {
      return '<button type="button" data-ext="cc-test" data-id="' + id + '">' + esc(EFFECTS[id].name) + '</button>';
    }).join('');
    var recent = hist.length ? '<p class="hint" style="font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;margin-top:6px">' + esc(hist.slice().reverse().join('\n')) + '</p>' : '';
    return '<h4>Crowd effects</h4>' + recent +
      '<div class="row"><span>TikTok effects on</span><input type="checkbox" data-ext="cc-enabled"' + (cfg.enabled ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Bridge address</span><input type="text" data-ext="cc-url" value="' + esc(cfg.url) + '" style="width:55%;max-width:240px"></div>' +
      '<div class="row"><span>Gift alerts over the hearts</span><input type="checkbox" data-ext="cc-alerts"' + (cfg.alerts ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show feed on game</span><input type="checkbox" data-ext="cc-feed"' + (cfg.feed ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Allow seed reroll (ends this game)</span><input type="checkbox" data-ext="cc-reroll"' + (cfg.allowReroll ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show subathon clock on game</span><input type="checkbox" data-ext="cc-show-timer"' + (cfg.showTimer ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show seed-reroll banner on game</span><input type="checkbox" data-ext="cc-reroll-overlay"' + (cfg.rerollOverlay ? ' checked' : '') + '></div>' +
      (rerollT ? '<div class="acts"><button type="button" class="primary" data-ext="cc-cancel-reroll">Cancel new seed (' + rerollLeft + 's)</button></div>' : '') +
      (detour ? '<div class="acts"><button type="button" class="primary" data-ext="cc-end-detour">End boss detour now</button></div>' : '') +
      '<p class="hint">Status: ' + esc(status) + (bridgeInfo ? ' · ' + esc(bridgeInfo) : '') +
        (queue.length ? ' · ' + queue.length + ' waiting' : '') + (detour ? ' · boss detour: ' + esc(detour.boss.name) + ' (' + detour.state + ')' : '') +
        ' · ' + queue.length + ' queued' + (timed.length ? ' · active: ' + esc(timed.join(', ')) : '') + '</p>' +
      '<p class="hint">Test an effect (it runs when you return to the game):</p>' +
      '<div class="acts">' + tests + '</div>' +
      '<div class="row" style="margin-top:6px"><span>Test one boss</span><span><select data-ext="cc-boss-pick">' +
        Object.keys(BOSSES).map(function (k) { return '<option value="' + k + '"' + (k === bossPick ? ' selected' : '') + '>' + esc(BOSSES[k].name) + '</option>'; }).join('') +
        '</select> <button type="button" data-ext="cc-boss-go">Go</button></span></div>' +
      (status === 'connected'
        ? '<div class="acts" style="margin-top:6px"><button type="button" data-ext="cc-plus" data-what="gift">Fake gift (alert + effect)</button>' +
          '<button type="button" data-ext="cc-plus" data-what="mystery_box">Mystery box</button></div>'
        : '<p class="hint">Connect to Crowd Control+ for the mystery box and fake-gift tests.</p>') +
      '<div class="acts" style="margin-top:6px"><button type="button" data-ext="cc-clear">Clear queue and timers</button></div>';
  }
  function menuClick(b, rr) {
    rerender = rr;
    var a = b.dataset.ext;
    if (a === 'cc-test') { note('test button: ' + b.dataset.id); trigger(b.dataset.id, 'test'); }
    else if (a === 'cc-clear') { endAll(); queue.length = 0; paused = {}; cancelReroll(); }
    else if (a === 'cc-cancel-reroll') cancelReroll();
    else if (a === 'cc-end-detour') cancelDetour();
    else if (a === 'cc-boss-go') { note('test button: boss ' + bossPick); testBoss(bossPick, 'test'); }
    else if (a === 'cc-plus') { note('test via Crowd Control+: ' + b.dataset.what); send({ type: 'test', what: b.dataset.what }); feed('Sent to Crowd Control+: ' + (b.dataset.what === 'gift' ? 'fake gift' : 'mystery box'), 'info'); }
    rr();
  }
  function menuInput(el) {
    var a = el.dataset.ext;
    if (a === 'cc-enabled') { cfg.enabled = el.checked; saveCfg(); connect(); }
    else if (a === 'cc-feed') { cfg.feed = el.checked; saveCfg(); }
    else if (a === 'cc-alerts') { cfg.alerts = el.checked; saveCfg(); }
    else if (a === 'cc-boss-pick') { bossPick = el.value; }
    else if (a === 'cc-show-timer') { cfg.showTimer = el.checked; saveCfg(); if (!el.checked && clockEl) { clockEl.remove(); clockEl = null; } }
    else if (a === 'cc-reroll-overlay') { cfg.rerollOverlay = el.checked; saveCfg(); if (!el.checked && bannerEl) { bannerEl.remove(); bannerEl = null; } }
    else if (a === 'cc-reroll') { cfg.allowReroll = el.checked; saveCfg(); if (!el.checked) cancelReroll(); rerender && rerender(); }
    else if (a === 'cc-url') {
      cfg.url = el.value.trim(); saveCfg();
      clearTimeout(menuInput.t); menuInput.t = setTimeout(connect, 800);
    }
  }
  function render() {
    // keep the menu's status line current while it's open (not while typing)
    if (!rerender || typeof document === 'undefined') return;
    var m = document.querySelector('.s9x-menu');
    if (!m || m.hidden) return;
    var ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.ext === 'cc-url') return;
    clearTimeout(render.t); render.t = setTimeout(function () { try { rerender(); } catch (e) {} }, 50);
  }

  function list() {
    return Object.keys(EFFECTS).filter(function (id) { return id.charAt(0) !== '_'; }).map(function (id) {
      return { id: id, name: EFFECTS[id].name, secs: EFFECTS[id].detour ? detourSecs(id) : secsOf(id), good: !!EFFECTS[id].good };
    });
  }

  // ── wire into the player ────────────────────────────────────────────────
  function install() {
    var P = root.Snes9xPlayer;
    if (!P || !P.hooks) return false;
    P.hooks.frame = onFrame;
    P.hooks.input = onInput;
    P.hooks.menu = { html: menuHtml, click: menuClick, input: menuInput };
    connect();
    return true;
  }

  var api = {
    trigger: trigger, list: list, cancelReroll: cancelReroll, EFFECTS: EFFECTS, ADDR: A, inPlay: inPlay,
    BOSSES: BOSSES, endDetour: cancelDetour, get detour() { return detour && { boss: detour.boss.name, state: detour.state, frames: detour.frames, total: detour.total }; },
    // for testing a single boss from the console: CrowdEffects.detourTo('moldorm')
    placeLink: function () { var c = core(); return !!(c && placeLink(c.wram(), detour && detour.boss.at)); },
    giftCard: giftCard,
    get waiting() { return queue.length + (gap > 0 ? 1 : 0); },
    detourTo: function (key) { return testBoss(key, 'test'); },
    _onFrame: onFrame, _onInput: onInput, _showClock: showClock,
    get queue() { return queue.slice(); }, get active() { return Object.assign({}, active); },
    get status() { return status; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.CrowdEffects = api;
    if (!install()) document.addEventListener('DOMContentLoaded', install);
  }
})(typeof self !== 'undefined' ? self : this);
