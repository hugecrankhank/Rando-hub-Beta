/*
 * Crowd effects for Zelda 1: lets TikTok LIVE viewers change the game, the
 * same way Rando Hub's crowd/effects.js does for ALTTP. Gifts, likes, follows
 * and shares arrive from Crowd Control+ (crowd-plus/bridge.mjs in Rando Hub,
 * run on the streaming PC) over a WebSocket. Each names an effect below,
 * which is queued and applied while Link is in normal play.
 *
 * Effect ids are the ALTTP ones wherever the effect means the same thing, so
 * one mapping.json drives both games. Gifts mapped to an ALTTP-only effect
 * (magic, arrows, bottles, warps, boss detours…) are skipped by the bridge
 * while Zelda 1 is connected; it says so in its log.
 *
 * The ROM is never changed. Effects write the NES's RAM (hearts, rupees,
 * bombs, the clock) or change the buttons the game sees, or use the player's
 * picture and speed tricks (emu/player.js fx).
 *
 *   Z1Crowd.trigger('heal_full', 'someone')   // test from the console
 *   Z1Crowd.list()                            // ids and names
 *
 * Settings are in the emulator menu (⋯) under "Crowd effects".
 */
(function (root) {
  'use strict';

  var SETTINGS_KEY = 'z1r-crowd-settings';
  var cfg = { enabled: false, url: 'ws://localhost:21214', feed: true, alerts: true, allowReroll: false, showTimer: true };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
  function saveCfg() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch (e) {} }

  // ── Zelda 1 RAM ($0000-$07FF) ────────────────────────────────────────────
  var A = {
    LEVEL: 0x10, MODE: 0x12, SLOT: 0x16,
    BOMBS: 0x658, MAXBOMBS: 0x67C,
    CLOCK: 0x66C,                  // the clock item: enemies stand still until Link leaves the screen
    RUPEES: 0x66D,
    HEARTS: 0x66F,                 // high nibble: containers - 1; low nibble: full hearts before the last one
    PARTIAL: 0x670,                // the last heart: 0 empty, 01-7F half, 80-FF full
    RUPEE_ADD: 0x67D, RUPEE_SUB: 0x67E,   // the game counts these into the wallet (with the sound), capped at 255
    // gear (aldonunez's disassembly, Variables.inc)
    SWORD: 0x657, ARROW: 0x659, BOW: 0x65A, CANDLE: 0x65B, RECORDER: 0x65C, ROD: 0x65F, RAFT: 0x660,
    RING: 0x662, LADDER: 0x663, BRACELET: 0x665, BOOMERANG: 0x674, MAGIC_BOOMERANG: 0x675,
    // the whirlwind (whistle warp): objects 1-11 (type $2E = whirlwind), Link's Y, the level it goes to
    OBJ_X: 0x70, OBJ_Y: 0x84, OBJ_TYPE: 0x34F, SUMMONED: 0x508, TELEPORTING: 0x522, TELEPORT_LEVEL: 0x523,
    TILEBUF_SEL: 0x14,
  };
  // Cartridge RAM ($6000-$7FFF, core.sram()): Link's colour in the menu palettes
  // (one row per save slot) and in the level palettes about to be sent
  var S = { MENU_PAL: 0x67F0 + 20, LEVEL_PAL: 0x6B7E + 20 };
  var LINK_COLORS = [0x29, 0x32, 0x16];   // green, blue ring, red ring
  var PLAY = 0x05, CAVE = 0x0B;

  function fileLoaded(r) { return r.length >= 0x800 && r[0xF5] === 0x5A && r[0x528] === 0x5A && r[A.SLOT] < 3; }
  function containers(r) { return (r[A.HEARTS] >> 4) + 1; }
  // Health in half hearts.
  function halves(r) {
    var p = r[A.PARTIAL];
    return (r[A.HEARTS] & 0x0F) * 2 + (p >= 0x80 ? 2 : p > 0 ? 1 : 0);
  }
  function setHalves(r, h) {
    h = Math.max(1, Math.min(containers(r) * 2, h | 0));
    var low = (h & 1) ? (h >> 1) : (h >> 1) - 1;
    r[A.HEARTS] = (r[A.HEARTS] & 0xF0) | low;
    r[A.PARTIAL] = (h & 1) ? 0x7F : 0xFF;
  }
  function inPlay(r) {
    return fileLoaded(r) && (r[A.MODE] === PLAY || r[A.MODE] === CAVE) && halves(r) > 0;
  }
  function P() { return root.EmuPlayer; }
  function fx() { var p = P(); return p && p.fx; }
  function core() { var p = P(); return p && p.core; }

  // NES pad bits, same order as EmuCore.BTN. A is the sword, B the item.
  var B = { B: 1 << 0, UP: 1 << 4, DOWN: 1 << 5, LEFT: 1 << 6, RIGHT: 1 << 7, A: 1 << 8 };
  function swapBits(pad, a, b) {
    var ha = pad & a, hb = pad & b;
    pad &= ~(a | b);
    if (ha) pad |= b;
    if (hb) pad |= a;
    return pad;
  }

  // ── gear on loan: an item held at a lower grade (or gone) for a while ────
  // Each frame the slot is held at the loaned value; at the end the real one
  // comes back, unless the game changed it meanwhile (Link found a better
  // one: that stays). A save state loaded mid-loan can't get the item stuck:
  // the loan ends on the clock either way.
  var loans = {};   // id → { addr, was, hold }
  function lend(id, addr, hold, r) { loans[id] = { addr: addr, was: r[addr], hold: hold }; r[addr] = hold; if (addr === A.RING) ringColor(r); }
  function holdLoan(id, r) { var l = loans[id]; if (l && r[l.addr] === l.hold) return; if (l) r[l.addr] = l.hold; }
  function giveBack(id) {
    var l = loans[id], c = core(), r = c && c.wram(); delete loans[id];
    if (!l || !r) return;
    if (r[l.addr] === l.hold) { r[l.addr] = l.was; if (l.addr === A.RING) ringColor(r); }
  }
  // Link's colour follows the ring right away (as when a ring is picked up:
  // the colour goes into the save slot's menu palette row and the level
  // palettes, and a palette transfer is cued)
  function ringColor(r) {
    var c = core(), sr = c && c.sram(); if (!sr || sr.length < 0x2000) return;
    var col = LINK_COLORS[Math.min(2, r[A.RING])] ;
    sr[S.MENU_PAL + 4 * r[A.SLOT] - 0x6000] = col;
    sr[S.LEVEL_PAL - 0x6000] = col;
    r[A.TILEBUF_SEL] = 0x18;
  }
  var ITEMS = [['candle', A.CANDLE, 'Candle'], ['bow', A.BOW, 'Bow'], ['boomerang', A.BOOMERANG, 'Boomerang'], ['mboomerang', A.MAGIC_BOOMERANG, 'Magical Boomerang'],
    ['rod', A.ROD, 'Magical Rod'], ['recorder', A.RECORDER, 'Recorder'], ['raft', A.RAFT, 'Raft'], ['ladder', A.LADDER, 'Ladder'], ['bracelet', A.BRACELET, 'Power Bracelet']];
  function gearOff(id, addr, what, secs) {
    return { name: what + ' gone', good: false, secs: secs || 30,
      check: function (r) { return r[addr] ? '' : 'Link has no ' + what.toLowerCase(); },
      start: function (r) { lend(id, addr, 0, r); }, frame: function (r) { holdLoan(id, r); }, end: function () { giveBack(id); } };
  }
  // The whirlwind, as the recorder summons it, but to a level of chat's choosing:
  // it sweeps in along Link's row, carries him off and drops him at that
  // level's entrance (the game's own tables, so shuffled entrances work too)
  function whirlwind(r, level) {
    if (r[A.LEVEL]) return 'Only on the overworld';
    if (r[A.MODE] !== PLAY) return 'Link isn\u2019t out in the open';
    if (r[A.SUMMONED] || r[A.TELEPORTING]) return 'A whirlwind is already here';
    var slot = 0;
    for (var y = 11; y >= 1; y--) if (!r[A.OBJ_TYPE + y]) { slot = y; break; }
    if (!slot) return 'The screen is too full';
    r[A.TELEPORT_LEVEL] = level & 7;
    r[A.SUMMONED] = 1;
    r[A.OBJ_Y + slot] = r[A.OBJ_Y]; r[A.OBJ_X + slot] = 0; r[A.OBJ_TYPE + slot] = 0x2E;
  }

  // ── a boss, right here (any screen, the overworld included) ───────────────
  // The game draws a boss from a 64-tile "boss" pattern block it loads into
  // the PPU at $0C00 only on entering its level (bank 3, TransferLevelPatternBlocks:
  // block 1257 for Aquamentus / Dodongo / Digdogger / Moldorm, 3468 for
  // Manhandla / Gleeok / Gohma, 9 for Patra). The emulator core exposes that
  // tile memory (core.chr), so the block is copied in from the ROM, the
  // screen's monsters are cleared (bosses with several parts use the next
  // slots, as in their rooms), and the boss is placed in slot 1 the way the
  // game places a room's monsters: type, "not initialized yet", spawn cloud.
  // The game's own init routine does the rest (HP, roar, heads, ring).
  // When the boss is gone the tiles go back, so the screen's own monsters
  // draw right again. Object types: aldonunez's disassembly, InitObject_JumpTable.
  var BOSS_BLOCKS = { b1257: 57307, b3468: 58331, b9: 59355 };   // bank 3 pattern blocks (headerless ROM offsets; bins.xml)
  var BOSSES = {
    boss_aquamentus: { name: 'Boss: Aquamentus', type: 0x3D, block: 'b1257' },
    boss_dodongo:    { name: 'Boss: Dodongo',    type: 0x31, block: 'b1257' },
    boss_manhandla:  { name: 'Boss: Manhandla',  type: 0x3C, block: 'b3468' },
    boss_gleeok:     { name: 'Boss: Gleeok',     type: [0x43, 0x44, 0x45], block: 'b3468' },   // 2, 3 or 4 heads
    boss_digdogger:  { name: 'Boss: Digdogger',  type: [0x38, 0x39], block: 'b1257' },         // splits in 1 or 3
    boss_gohma:      { name: 'Boss: Gohma',      type: [0x33, 0x34], block: 'b3468' },         // blue or red
    boss_patra:      { name: 'Boss: Patra',      type: [0x47, 0x48], block: 'b9' },
    boss_moldorm:    { name: 'Boss: Moldorm',    type: 0x41, block: 'b1257' },
  };
  var O = { TYPE: 0x34F, UNINIT: 0x492, META: 0x405, STATE: 0xAC, DIR: 0x98, STUN: 0x3D, SHOVE_DIR: 0xC0, SHOVE_DIST: 0xD3,
    ANIM: 0x3D0, QSPEED: 0x3BC, TIMER: 0x28, INVINC: 0x4F0, HP: 0x485 };
  var crowdBoss = null;   // { type, name, saved: Uint8Array(1024) of the tiles replaced, block }
  function bossTiles(c) {
    var rom; try { rom = c.rom(); } catch (e) { return null; }
    if (!rom || rom.length < 0x20000) return null;
    var hdr = rom.length % 1024 === 16 ? 16 : 0;
    return function (block) { var o = hdr + BOSS_BLOCKS[block]; return rom.subarray(o, o + 1024); };
  }
  function spawnBoss(r, id) {
    var B = BOSSES[id], c = core();
    if (!c || !c.chr) return 'this emulator can\u2019t reach the tile memory';
    if (r[A.MODE] !== PLAY) return 'Link isn\u2019t out in the open';
    if (crowdBoss && r[O.TYPE + 1] === crowdBoss.type) return 'one boss at a time: ' + crowdBoss.name + ' is still here';
    var tiles = bossTiles(c), page = c.chr(0xC00);
    if (!tiles || !page) return 'couldn\u2019t read the boss\u2019s picture from this ROM';
    var type = Array.isArray(B.type) ? B.type[Math.floor(Math.random() * B.type.length)] : B.type;
    var saved = page.slice(0);
    page.set(tiles(B.block));
    for (var i = 1; i < 12; i++) {   // every monster slot, cleared as the game does when it places a room's monsters
      r[O.TYPE + i] = 0; r[O.META + i] = 0; r[O.UNINIT + i] = 0; r[O.STATE + i] = 0; r[O.DIR + i] = 0; r[O.STUN + i] = 0;
      r[O.SHOVE_DIR + i] = 0; r[O.SHOVE_DIST + i] = 0; r[O.ANIM + i] = 1; r[O.QSPEED + i] = 0x20; r[O.TIMER + i] = 0; r[O.INVINC + i] = 0;
    }
    r[O.TYPE + 1] = type; r[O.UNINIT + 1] = 0xFF; r[O.META + 1] = 1;   // slot 1, in a spawn cloud; the game inits it next frame
    r[A.OBJ_X + 1] = 0x78; r[A.OBJ_Y + 1] = 0x80;                        // the middle of the screen
    crowdBoss = { type: type, name: B.name.replace(/^Boss: /, ''), saved: saved, block: B.block, started: Date.now(), tiles: tiles(B.block) };
    return true;
  }
  // The boss is gone (killed, or Link left the screen and the game cleared
  // the slot): the screen's tiles come back, if the game hasn't already
  // loaded others (a level entered meanwhile).
  function bossFrame(r) {
    var cb = crowdBoss; if (!cb) return;
    if (r[O.TYPE + 1] === cb.type && r[A.MODE] !== 0) return;
    var c = core(), page = c && c.chr && c.chr(0xC00);
    if (page) {
      var same = true;
      for (var i = 0; i < 1024; i += 37) if (page[i] !== cb.tiles[i]) { same = false; break; }
      if (same) page.set(cb.saved);
    }
    crowdBoss = null;
  }

  // ── the effects ─────────────────────────────────────────────────────────
  // Instant effects run once (apply; a string back means "couldn't", shown
  // in the feed). Timed ones last `secs` seconds of play and can only filter
  // input or hold a value down each frame, so a save state can't leave the
  // game stuck changed.
  var EFFECTS = {
    heal_full:   { name: 'Full heal', good: true,
      apply: function (r) { setHalves(r, containers(r) * 2); } },
    heal_1:      { name: '+1 heart', good: true,
      apply: function (r) { setHalves(r, halves(r) + 2); } },
    hurt_2:      { name: '-2 hearts', good: false,            // never kills
      apply: function (r) { var h = halves(r); setHalves(r, Math.max(Math.min(2, h), h - 4)); } },
    hp_1:        { name: 'Down to 1 heart', good: false,
      apply: function (r) { if (halves(r) > 2) setHalves(r, 2); } },
    rupees_plus: { name: '+50 rupees', good: true,
      apply: function (r) { r[A.RUPEE_ADD] = Math.min(255, r[A.RUPEE_ADD] + 50); } },
    rupees_minus:{ name: '-50 rupees', good: false,
      apply: function (r) { r[A.RUPEE_SUB] = Math.min(255, r[A.RUPEE_SUB] + 50); } },
    bombs_plus:  { name: '+4 bombs', good: true,               // up to the bag size
      apply: function (r) { if (r[A.BOMBS] >= r[A.MAXBOMBS]) return 'Bomb bag is full'; r[A.BOMBS] = Math.min(r[A.MAXBOMBS], r[A.BOMBS] + 4); } },
    bombs_none:  { name: 'Lose all bombs', good: false,
      apply: function (r) { r[A.BOMBS] = 0; } },
    clock:       { name: 'Clock: enemies freeze', good: true,
      apply: function (r) { r[A.CLOCK] = 1; } },

    invert:      { name: 'Inverted D-pad', good: false, secs: 20,
      input: function (p) { return swapBits(swapBits(p, B.UP, B.DOWN), B.LEFT, B.RIGHT); } },
    no_sword:    { name: 'No sword', good: false, secs: 20,
      input: function (p) { return p & ~B.A; } },
    no_item:     { name: 'No B item', good: false, secs: 20,
      input: function (p) { return p & ~B.B; } },
    swap_by:     { name: 'A and B swapped', good: false, secs: 20,
      input: function (p) { return swapBits(p, B.A, B.B); } },
    freeze:      { name: 'Freeze!', good: false, secs: 3,
      input: function () { return 0; } },
    one_hit:     { name: 'One-heart mode', good: false, secs: 30,
      frame: function (r) { if (halves(r) > 2) setHalves(r, 2); } },

    mirror:      { name: 'Mirror mode', good: false, secs: 20, start: function () { fx() && fx().setScreen('mirror', true); }, end: function () { fx() && fx().setScreen('mirror', false); } },
    upside_down: { name: 'Upside down', good: false, secs: 15, start: function () { fx() && fx().setScreen('flip', true); }, end: function () { fx() && fx().setScreen('flip', false); } },
    wobble:      { name: 'Drunk wobble', good: false, secs: 20, start: function () { fx() && fx().setScreen('wobble', true); }, end: function () { fx() && fx().setScreen('wobble', false); } },
    tiny:        { name: 'Tiny screen', good: false, secs: 20, start: function () { fx() && fx().setScreen('tiny', true); }, end: function () { fx() && fx().setScreen('tiny', false); } },
    crt:         { name: 'Retro CRT', good: true, secs: 30, start: function () { fx() && fx().setTempFilter('crt'); }, end: function () { fx() && fx().setTempFilter(null); } },
    speed_up:    { name: 'Speed up (1.5x)', good: false, secs: 20, start: function () { fx() && fx().setSpeed(1.5); }, end: function () { fx() && fx().setSpeed(1); } },
    slow_mo:     { name: 'Slow motion', good: true, secs: 15, start: function () { fx() && fx().setSpeed(0.5); }, end: function () { fx() && fx().setSpeed(1); } },

    // ── warps ──
    warp_random: { name: 'Whirlwind: random level', good: false,
      apply: function (r) { return whirlwind(r, Math.floor(Math.random() * 8)); } },
    warp_1:      { name: 'Whirlwind: Level 1', good: false, apply: function (r) { return whirlwind(r, 0); } },
    warp_8:      { name: 'Whirlwind: Level 8', good: false, apply: function (r) { return whirlwind(r, 7); } },

    // ── gear: swords ($657: 1 wood, 2 white, 3 magical) and rings ($662: 1 blue, 2 red) ──
    sword_off:   { name: 'Sword gone', good: false, secs: 30,
      check: function (r) { return r[A.SWORD] ? '' : 'Link has no sword'; },
      start: function (r) { lend('sword_off', A.SWORD, 0, r); }, frame: function (r) { holdLoan('sword_off', r); }, end: function () { giveBack('sword_off'); } },
    sword_down:  { name: 'Sword downgrade', good: false, secs: 30,
      check: function (r) { return r[A.SWORD] >= 2 ? '' : r[A.SWORD] ? 'Link only has the Wooden Sword' : 'Link has no sword'; },
      start: function (r) { lend('sword_down', A.SWORD, r[A.SWORD] - 1, r); }, frame: function (r) { holdLoan('sword_down', r); }, end: function () { giveBack('sword_down'); } },
    sword_up:    { name: 'Sword upgrade', good: true,
      apply: function (r) { if (r[A.SWORD] >= 3) return 'Link already has the Magical Sword'; r[A.SWORD]++; } },
    ring_off:    { name: 'Ring gone', good: false, secs: 30,
      check: function (r) { return r[A.RING] ? '' : 'Link has no ring'; },
      start: function (r) { lend('ring_off', A.RING, 0, r); }, frame: function (r) { holdLoan('ring_off', r); }, end: function () { giveBack('ring_off'); } },
    ring_down:   { name: 'Ring downgrade', good: false, secs: 30,
      check: function (r) { return r[A.RING] >= 2 ? '' : r[A.RING] ? 'Link only has the Blue Ring' : 'Link has no ring'; },
      start: function (r) { lend('ring_down', A.RING, 1, r); }, frame: function (r) { holdLoan('ring_down', r); }, end: function () { giveBack('ring_down'); } },
    ring_up:     { name: 'Ring upgrade', good: true,
      apply: function (r) { if (r[A.RING] >= 2) return 'Link already has the Red Ring'; r[A.RING]++; ringColor(r); } },

    // ── items on loan: one gone for 30 s ──
    item_off:    { name: 'Item gone (random)', good: false, secs: 30,
      check: function (r) { return ITEMS.some(function (it) { return r[it[1]]; }) ? '' : 'Link has no items to take'; },
      start: function (r) {
        var have = ITEMS.filter(function (it) { return r[it[1]]; });
        var it = have[Math.floor(Math.random() * have.length)];
        if (it) { lend('item_off', it[1], 0, r); feed('Took the ' + it[2] + ' for a while', 'bad'); }
      }, frame: function (r) { holdLoan('item_off', r); }, end: function () { giveBack('item_off'); } },
    candle_off:  gearOff('candle_off', A.CANDLE, 'Candle'),
    bow_off:     gearOff('bow_off', A.BOW, 'Bow'),
    boomerang_off: { name: 'Boomerang gone', good: false, secs: 30,
      check: function (r) { return r[A.BOOMERANG] || r[A.MAGIC_BOOMERANG] ? '' : 'Link has no boomerang'; },
      start: function (r) { lend('boomerang_off', A.BOOMERANG, 0, r); lend('boomerang_off2', A.MAGIC_BOOMERANG, 0, r); },
      frame: function (r) { holdLoan('boomerang_off', r); holdLoan('boomerang_off2', r); },
      end: function () { giveBack('boomerang_off'); giveBack('boomerang_off2'); } },
    rod_off:     gearOff('rod_off', A.ROD, 'Magical Rod'),
    ladder_off:  gearOff('ladder_off', A.LADDER, 'Ladder'),
    raft_off:    gearOff('raft_off', A.RAFT, 'Raft'),

    seed_roll:   { name: 'New seed (same flags)', good: false,
      app: function (job) { return startReroll(job, 'same'); } },
    seed_preset: { name: 'Random preset seed', good: false,
      app: function (job) { return startReroll(job, 'preset'); } },
    seed_chaos:  { name: 'CHAOS seed', good: false,
      app: function (job) { return startReroll(job, 'chaos'); } },

    // ── bosses, anywhere ──
    boss_random: { name: 'Boss: random', good: false,
      apply: function (r) { var ids = Object.keys(BOSSES); return spawnBoss(r, ids[Math.floor(Math.random() * ids.length)]); } },
  };
  Object.keys(BOSSES).forEach(function (id) {
    EFFECTS[id] = { name: BOSSES[id].name, good: false, apply: function (r) { return spawnBoss(r, id); } };
  });

  // ── new seed (off unless allowed; 10 s countdown, cancel in the menu) ────
  // same: the flags last used; preset: a random Zelda 1 preset; chaos: a
  // random preset too (Zelda 1 has no chaos generator). In Rando Hub with
  // "Rerolls can land on either game", preset and chaos may go to Zelda 3.
  var ROLL_KIND = {
    same:   { count: 'NEW SEED IN ', feed: 'New seed in ', roll: 'Rolling a new seed…', sub: 'Same flags as last time', done: 'New seed ready!' },
    preset: { count: 'RANDOM PRESET IN ', feed: 'Random preset in ', roll: 'Rolling a random preset…', sub: 'A random preset', done: 'Random preset ready!' },
    chaos:  { count: 'CHAOS SEED IN ', feed: 'CHAOS seed in ', roll: 'Rolling a CHAOS seed…', sub: 'A random preset', done: 'CHAOS seed ready!' },
  };
  var REROLL_SECS = 10, rerollT = null, rerollLeft = 0, rerollBy = '', rerollBusy = false, rerollMode = 'same';
  function startReroll(job, mode) {
    if (!rerollT && !rerollBusy) rerollMode = ROLL_KIND[mode] ? mode : 'same';
    var K = ROLL_KIND[rerollMode];
    if (!cfg.allowReroll) { feed('Seed reroll is turned off in Crowd effects', 'info'); return false; }
    if (rerollT || rerollBusy) { feed('A new seed is already coming', 'info'); return false; }
    if (!root.Z1Seed || !root.Z1Seed.rollAndPlay) { feed('Not available: new seed', 'info'); return false; }
    rerollBy = (job && job.user && job.user !== 'test') ? job.user : '';
    rerollLeft = REROLL_SECS;
    banner('count', K.count + rerollLeft, (rerollBy ? 'from ' + rerollBy + ' · ' : '') + 'this game ends', 0, 1);
    rerollT = setInterval(function () {
      rerollLeft--;
      if (rerollLeft > 0) {
        banner('count', K.count + rerollLeft, (rerollBy ? 'from ' + rerollBy + ' · ' : '') + 'this game ends', 0, rerollLeft / REROLL_SECS);
        if (rerollLeft <= 3) feed(K.feed + rerollLeft + '…', 'bad');
        render(); return;
      }
      clearInterval(rerollT); rerollT = null;
      rerollBusy = true;
      banner('roll', K.roll, K.sub, 0);
      root.Z1Seed.rollAndPlay({ mode: rerollMode, by: rerollBy }).then(function (seed) {
        banner('done-ok', K.done, (rerollBy ? 'Courtesy of ' + rerollBy : 'Good luck') + ' · seed ' + seed, 6000);
      }, function (e) {
        rerollBusy = false;
        banner('done-bad', 'Seed reroll failed', String((e && e.message) || e), 6000);
        render();
      });
      render();
    }, 1000);
    render();
    return true;
  }
  function cancelReroll() {
    if (!rerollT) return;
    clearInterval(rerollT); rerollT = null;
    feed('New seed cancelled', 'info');
    banner('done-bad', 'New seed cancelled', 'The streamer kept this seed', 4000);
  }

  // ── queue and timers ────────────────────────────────────────────────────
  var queue = [], active = {}, gap = 0, GAP_FRAMES = 45, MAX_QUEUE = 60, waitT = 0;
  var durations = {};
  function secsOf(id) {
    var f = EFFECTS[id]; if (!f || !f.secs) return 0;
    var d = +durations[id];
    return d > 0 && d <= 600 ? d : f.secs;
  }
  var hist = [];
  function note(t) {
    var d = new Date(); hist.push(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + ' ' + t);
    if (hist.length > 14) hist.shift();
  }
  function trigger(id, user, label) {
    if (!EFFECTS[id]) { note('unknown effect ' + id); return false; }
    if (queue.length >= MAX_QUEUE) { note('queue full, dropped ' + id); return false; }
    queue.push({ id: id, user: user || '', label: label || '' });
    note('queued ' + id + (user ? ' (' + user + ')' : '') + ', ' + queue.length + ' waiting');
    render();
    return true;
  }

  function onFrame(c) {
    try { onFrameInner(c); } catch (e) { console.warn('[crowd]', e); note('error: ' + (e && e.message || e)); }
  }
  function onFrameInner(c) {
    var ram = c.wram();
    sendRun(ram);
    if (crowdBoss) { try { bossFrame(ram); } catch (e) { console.warn('[crowd] boss', e); } }
    var playing = inPlay(ram);
    if (queue.length && !playing) {
      if (++waitT === 240) feed(queue.length + ' waiting: Link isn\'t in normal play', 'info');
    } else waitT = 0;
    if (!playing) return;
    for (var id in active) {
      var f = EFFECTS[id];
      if (f.frame) f.frame(ram);
      if (--active[id] <= 0) { delete active[id]; if (f.end) { try { f.end(); } catch (e) {} } feed(f.name + ' ended', 'end'); render(); }
    }
    if (gap > 0) { gap--; return; }
    var job = queue.shift();
    if (!job) return;
    note('running ' + job.id);
    var fe = EFFECTS[job.id];
    var secs = secsOf(job.id);
    if (fe.check) {
      var why = fe.check(ram);
      if (why) { feed(fe.name + ': ' + why, 'info'); render(); return; }
    }
    if (secs) {
      if (active[job.id]) { /* already on: the time just adds up */ }
      else if (fe.start) { try { fe.start(ram); } catch (e) { console.warn('[crowd]', job.id, e); } }
      active[job.id] = (active[job.id] || 0) + Math.round(secs * (c.fps || 60.1));
    } else if (fe.app) {
      try { if (fe.app(job) === false) { render(); return; } } catch (e) { console.warn('[crowd]', job.id, e); }
    } else {
      var res = fe.apply(ram);
      if (typeof res === 'string') { feed(fe.name + ': ' + res, 'info'); render(); return; }
    }
    gap = GAP_FRAMES;
    var who = job.user && job.user !== 'test' ? job.user : '';
    feed((who ? who + ': ' : '') + fe.name + (secs ? ' (' + secs + 's)' : '') + (/^boss_/.test(job.id) && crowdBoss ? ': ' + crowdBoss.name : ''), fe.good ? 'good' : 'bad');
    if (who) giftCard(who, job.label, fe.name, fe.good);
    send({ type: 'applied', effect: job.id, user: job.user });
    render();
  }
  function onInput(pad) {
    var c = core();
    if (!c) return pad;
    var any = false;
    for (var id in active) if (EFFECTS[id].input) { any = true; break; }
    if (!any || !inPlay(c.wram())) return pad;
    for (var k in active) if (EFFECTS[k].input) pad = EFFECTS[k].input(pad);
    return pad;
  }
  function endAll() {
    for (var id in active) { var f = EFFECTS[id]; if (f && f.end) { try { f.end(); } catch (e) {} } }
    active = {};
  }

  // ── run info for the control panel (once a second while connected) ──────
  var run = { game: 'z1r', deaths: 0, checks: 0, bonks: 0, place: '', seed: '', music: '', bosses: [], hearts: 0 };
  var runSent = '', runT = 0;
  function sendRun(ram) {
    if (status !== 'connected' || ++runT % 60) return;
    var p = P();
    run.seed = (p && p.gameName) || '';
    if (fileLoaded(ram)) {
      run.hearts = containers(ram);
      run.place = ram[A.LEVEL] ? 'Level ' + ram[A.LEVEL] : 'Overworld';
    }
    var j = JSON.stringify(run);
    if (j !== runSent) { runSent = j; send(Object.assign({ type: 'run' }, run)); }
  }

  // ── on-screen feed, gift card, banner, subathon clock ───────────────────
  function host() { return document.querySelector('.s9x'); }
  function style(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);
  }
  var CSS =
    '.cc-feed { position: absolute; right: 8px; top: 8px; z-index: 25; display: flex; flex-direction: column; align-items: flex-end;' +
    ' gap: 4px; pointer-events: none; max-width: 70%; font: 600 12px/1.25 system-ui, sans-serif; }' +
    '.cc-feed div { background: rgba(10,12,16,.82); color: #fff; padding: 4px 9px; border-radius: 6px; border-left: 3px solid #8b95a3;' +
    ' transition: opacity .4s; text-shadow: 0 1px 1px #000; }' +
    '.cc-feed .good { border-left-color: #3fb950; } .cc-feed .bad { border-left-color: #e5534b; } .cc-feed .end { opacity: .7; }' +
    '.cc-feed .info { border-left-color: #e3b341; }' +
    '.cc-gift { position: absolute; left: 50%; top: 40px; transform: translate(-50%, -8px); z-index: 26; pointer-events: none;' +
    ' display: flex; align-items: center; gap: 8px; max-width: 70%; padding: 5px 12px 5px 9px; border-radius: 8px;' +
    ' background: rgba(18,12,34,.92); border: 2px solid #e63946; box-shadow: 0 4px 14px rgba(0,0,0,.5); color: #fff;' +
    ' opacity: 0; transition: opacity .3s ease, transform .3s ease; font: 600 12px/1.25 system-ui, sans-serif; }' +
    '.cc-gift.show { opacity: 1; transform: translate(-50%, 0); } .cc-gift.good { border-color: #3fb950; }' +
    '.cc-gift .ic { font-size: 18px; } .cc-gift .nm { display: block; font-weight: 700; font-size: 13px; }' +
    '.cc-gift .fx { display: block; color: #ffd166; font-size: 11px; }' +
    '.cc-reroll { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); z-index: 26; pointer-events: none;' +
    ' min-width: 58%; max-width: 92%; box-sizing: border-box; padding: 10px 16px 12px; border-radius: 10px; text-align: center;' +
    ' background: rgba(10,12,16,.86); color: #fff; font: 700 13px/1.3 system-ui, sans-serif; text-shadow: 0 1px 2px #000;' +
    ' border: 2px solid #e5534b; transition: opacity .5s; }' +
    '.cc-reroll .t { font-size: clamp(15px, 3.6vw, 28px); } .cc-reroll .s { margin-top: 3px; font-weight: 600; opacity: .9; }' +
    '.cc-reroll .bar { margin-top: 8px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.18); overflow: hidden; }' +
    '.cc-reroll .bar i { display: block; height: 100%; background: #e5534b; transition: width 1s linear; }' +
    '.cc-reroll.roll { border-color: #e3b341; } .cc-reroll.done-ok { border-color: #3fb950; } .cc-reroll.done-bad { border-color: #8b95a3; }' +
    '.cc-clock { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 24; pointer-events: none;' +
    ' padding: 4px 12px; border-radius: 8px; background: rgba(10,12,16,.8); color: #fff;' +
    ' font: 800 18px/1.1 ui-monospace, Consolas, monospace; border: 1px solid rgba(227,179,65,.6); }' +
    '.cc-clock.paused { opacity: .6; } .cc-clock.ended { border-color: #e5534b; }';

  var feedEl = null;
  function feed(text, kind) {
    if (!cfg.feed || typeof document === 'undefined') return;
    if (!feedEl || !feedEl.isConnected) {
      var h = host(); if (!h) return;
      style('cc-css', CSS);
      feedEl = document.createElement('div'); feedEl.className = 'cc-feed'; h.appendChild(feedEl);
    }
    var d = document.createElement('div');
    d.className = kind || ''; d.textContent = text;
    feedEl.appendChild(d);
    while (feedEl.children.length > 4) feedEl.firstChild.remove();
    setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); }, 4000);
  }

  var giftQ = [], giftEl = null, giftBusy = false;
  function giftCard(user, label, what, good) {
    if (!cfg.alerts || typeof document === 'undefined') return;
    giftQ.push({ user: user, label: label, what: what, good: good });
    if (giftQ.length > 6) giftQ.splice(0, giftQ.length - 6);
    if (!giftBusy) giftNext();
  }
  function giftNext() {
    var g = giftQ.shift(); if (!g) { giftBusy = false; return; }
    var h = host(); if (!h) { giftBusy = false; giftQ = []; return; }
    giftBusy = true;
    style('cc-css', CSS);
    if (!giftEl || !giftEl.isConnected) {
      giftEl = document.createElement('div'); giftEl.className = 'cc-gift';
      giftEl.innerHTML = '<span class="ic">🎁</span><span><span class="nm"></span><span class="fx"></span></span>';
      h.appendChild(giftEl);
    }
    var lab = String(g.label || '');
    giftEl.querySelector('.ic').textContent = /follow/i.test(lab) ? '⭐' : /share/i.test(lab) ? '📣' : /like/i.test(lab) ? '❤️' : '🎁';
    giftEl.querySelector('.nm').textContent = g.user + (lab && lab !== 'test' ? ' · ' + lab : '');
    giftEl.querySelector('.fx').textContent = '→ ' + g.what;
    giftEl.classList.toggle('good', !!g.good);
    giftEl.classList.remove('show'); void giftEl.offsetWidth; giftEl.classList.add('show');
    setTimeout(function () { if (giftEl) giftEl.classList.remove('show'); setTimeout(giftNext, 350); }, giftQ.length ? 2200 : 3000);
  }

  var bannerEl = null, bannerHideT = null;
  function banner(kind, title, sub, hideAfter, frac) {
    if (typeof document === 'undefined') return;
    clearTimeout(bannerHideT);
    var h = host(); if (!h) return;
    style('cc-css', CSS);
    if (!bannerEl) { bannerEl = document.createElement('div'); bannerEl.innerHTML = '<div class="t"></div><div class="s"></div><div class="bar"><i></i></div>'; }
    if (bannerEl.parentNode !== h) h.appendChild(bannerEl);
    bannerEl.className = 'cc-reroll ' + kind;
    bannerEl.style.opacity = '1';
    bannerEl.querySelector('.t').textContent = title;
    bannerEl.querySelector('.s').textContent = sub || '';
    var bar = bannerEl.querySelector('.bar');
    bar.hidden = kind !== 'count';
    if (kind === 'count') bar.firstChild.style.width = Math.max(0, Math.min(1, frac || 0)) * 100 + '%';
    if (hideAfter) bannerHideT = setTimeout(function () {
      if (!bannerEl) return;
      bannerEl.style.opacity = '0';
      bannerHideT = setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 550);
    }, hideAfter);
  }

  var clockEl = null;
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function showClock(t) {
    if (typeof document === 'undefined') return;
    if (!(cfg.showTimer && t && t.active)) { if (clockEl) { clockEl.remove(); clockEl = null; } return; }
    var h = host(); if (!h) return;
    style('cc-css', CSS);
    if (!clockEl) clockEl = document.createElement('div');
    if (clockEl.parentNode !== h) h.appendChild(clockEl);
    clockEl.className = 'cc-clock' + (t.ended ? ' ended' : !t.running ? ' paused' : '');
    clockEl.textContent = t.ended ? 'TIME!' : fmtClock(t.remaining);
  }

  // ── connection to Crowd Control+ ────────────────────────────────────────
  var ws = null, status = 'off', retryT = null, retryMs = 2000, bridgeInfo = '';
  function send(msg) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } }
  function connect() {
    clearTimeout(retryT);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    if (!cfg.enabled) { status = 'off'; render(); return; }
    status = 'connecting'; render();
    try { ws = new WebSocket(cfg.url); } catch (e) { status = 'bad address'; render(); return; }
    ws.onopen = function () {
      status = 'connected'; retryMs = 2000; runSent = ''; render();
      send({ type: 'hello', app: 'z1r', effects: list() });
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'effect') {
        var n = Math.max(1, Math.min(10, m.count | 0 || 1));
        for (var i = 0; i < n; i++) trigger(m.effect, m.user, m.label);
      } else if (m.type === 'timer') showClock(m);
      else if (m.type === 'durations') { durations = m.secs && typeof m.secs === 'object' ? m.secs : {}; render(); }
      else if (m.type === 'status') { bridgeInfo = m.text || ''; render(); if (m.text) feed(m.text, 'info'); }
      else if (m.event && !m.type) { bridgeInfo = 'TikFinity, not the bridge: use ws://localhost:21214'; render(); }
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
    var timed = Object.keys(active).map(function (id) { return EFFECTS[id].name + ' ' + Math.ceil(active[id] / 60) + 's'; });
    var tests = Object.keys(EFFECTS).map(function (id) {
      return '<button type="button" data-ext="cc-test" data-id="' + id + '">' + esc(EFFECTS[id].name) + '</button>';
    }).join('');
    var recent = hist.length ? '<p class="hint" style="font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;margin-top:6px">' + esc(hist.slice().reverse().join('\n')) + '</p>' : '';
    return '<h4>Crowd effects</h4>' + recent +
      '<div class="row"><span>TikTok effects on</span><input type="checkbox" data-ext="cc-enabled"' + (cfg.enabled ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Bridge address</span><input type="text" data-ext="cc-url" value="' + esc(cfg.url) + '" style="width:55%;max-width:240px"></div>' +
      '<div class="row"><span>Gift alerts on the game</span><input type="checkbox" data-ext="cc-alerts"' + (cfg.alerts ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show feed on game</span><input type="checkbox" data-ext="cc-feed"' + (cfg.feed ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Allow seed reroll (ends this game)</span><input type="checkbox" data-ext="cc-reroll"' + (cfg.allowReroll ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show subathon clock on game</span><input type="checkbox" data-ext="cc-show-timer"' + (cfg.showTimer ? ' checked' : '') + '></div>' +
      (rerollT ? '<div class="acts"><button type="button" class="primary" data-ext="cc-cancel-reroll">Cancel new seed (' + rerollLeft + 's)</button></div>' : '') +
      '<p class="hint">Status: ' + esc(status) + (bridgeInfo ? ' · ' + esc(bridgeInfo) : '') +
        ' · ' + queue.length + ' queued' + (timed.length ? ' · active: ' + esc(timed.join(', ')) : '') + '</p>' +
      '<p class="hint">Test an effect (it runs when you return to the game):</p>' +
      '<div class="acts">' + tests + '</div>' +
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
    else if (a === 'cc-clear') { endAll(); queue.length = 0; cancelReroll(); }
    else if (a === 'cc-cancel-reroll') cancelReroll();
    else if (a === 'cc-plus') { send({ type: 'test', what: b.dataset.what }); feed('Sent to Crowd Control+: ' + (b.dataset.what === 'gift' ? 'fake gift' : 'mystery box'), 'info'); }
    rr();
  }
  function menuInput(el) {
    var a = el.dataset.ext;
    if (a === 'cc-enabled') { cfg.enabled = el.checked; saveCfg(); connect(); }
    else if (a === 'cc-feed') { cfg.feed = el.checked; saveCfg(); }
    else if (a === 'cc-alerts') { cfg.alerts = el.checked; saveCfg(); }
    else if (a === 'cc-show-timer') { cfg.showTimer = el.checked; saveCfg(); if (!el.checked && clockEl) { clockEl.remove(); clockEl = null; } }
    else if (a === 'cc-reroll') { cfg.allowReroll = el.checked; saveCfg(); if (!el.checked) cancelReroll(); rerender && rerender(); }
    else if (a === 'cc-url') { cfg.url = el.value.trim(); saveCfg(); clearTimeout(menuInput.t); menuInput.t = setTimeout(connect, 800); }
  }
  function render() {
    if (!rerender || typeof document === 'undefined') return;
    var m = document.querySelector('.s9x-menu');
    if (!m || m.hidden) return;
    var ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.ext === 'cc-url') return;
    clearTimeout(render.t); render.t = setTimeout(function () { try { rerender(); } catch (e) {} }, 50);
  }
  function list() {
    return Object.keys(EFFECTS).map(function (id) {
      return { id: id, name: EFFECTS[id].name, secs: secsOf(id), good: !!EFFECTS[id].good };
    });
  }

  // ── wire into the player ────────────────────────────────────────────────
  function install() {
    var p = P();
    if (!p || !p.hooks) return false;
    p.hooks.frame = onFrame;
    p.hooks.input = onInput;
    p.hooks.menu = { html: menuHtml, click: menuClick, input: menuInput };
    connect();
    return true;
  }
  root.Z1Crowd = {
    trigger: trigger, list: list, cancelReroll: cancelReroll, EFFECTS: EFFECTS, ADDR: A, inPlay: inPlay,
    halves: halves, setHalves: setHalves,
    get queue() { return queue.slice(); }, get active() { return Object.assign({}, active); },
    get status() { return status; },
    get recent() { return hist.slice(); },
    _onFrame: onFrame, _onInput: onInput,
  };
  if (!install()) {
    var tries = 0, t = setInterval(function () { if (install() || ++tries > 50) clearInterval(t); }, 200);
  }
})(window);
