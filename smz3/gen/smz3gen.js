/*
 * smz3gen.js — the SMZ3 randomizer (Super Metroid & A Link to the Past
 * Combo Randomizer, v11.3.2), ported to JavaScript from its C# source:
 * github.com/tewtal/SMZ3Randomizer (MIT, © 2020 Thomas Backmark), the
 * generator behind samus.link. Same logic, same fill, same random numbers
 * (.NET's System.Random, ported below), so a seed and its settings make the
 * same item placement as samus.link's v11.3.2 does.
 *
 *   SMZ3Gen.generate(options, seed)   → { seed, config, world, patches: [[pcOffset, bytes]...], playthrough, spoiler }
 *   SMZ3Gen.buildRom(smRom, z3Rom, baseIps, result)   → Uint8Array (6 MB ExHiROM)
 *   SMZ3Gen.OPTIONS                   → the options (as samus.link offers them)
 *
 * Single player only (no multiworld). The region files (Regions/…) are
 * converted mechanically (tools: smz3/gen/README.md), the rest by hand.
 */
(function () {
  'use strict';

  // ── .NET System.Random (the seeded, "Net5Compat" algorithm: Knuth's subtractive generator)
  class NetRandom {
    constructor(seed) {
      const MBIG = 2147483647, MSEED = 161803398;
      const a = this.a = new Array(56).fill(0);
      const sub = seed === -2147483648 ? 2147483647 : Math.abs(seed | 0);
      let mj = MSEED - sub, mk = 1;
      a[55] = mj;
      for (let i = 1; i < 55; i++) {
        const ii = (21 * i) % 55;
        a[ii] = mk; mk = mj - mk; if (mk < 0) mk += MBIG; mj = a[ii];
      }
      for (let k = 1; k < 5; k++) for (let i = 1; i < 56; i++) { a[i] -= a[1 + (i + 30) % 55]; a[i] |= 0; if (a[i] < 0) a[i] += MBIG; }
      this.inext = 0; this.inextp = 21;
    }
    sample() {
      const MBIG = 2147483647, a = this.a;
      let i = this.inext + 1; if (i >= 56) i = 1;
      let j = this.inextp + 1; if (j >= 56) j = 1;
      let v = a[i] - a[j];
      if (v === MBIG) v--;
      if (v < 0) v += MBIG;
      a[i] = v; this.inext = i; this.inextp = j;
      return v;
    }
    Next(a, b) {
      if (a === undefined) return this.sample();
      if (b === undefined) return Math.trunc(this.sample() * (1.0 / 2147483647) * a);
      const range = b - a;
      if (range <= 2147483647) return Math.trunc(this.sample() * (1.0 / 2147483647) * range) + a;
      throw new Error('large ranges are not used');
    }
  }

  // ── LINQ-ish helpers, as the C# uses them
  function shuffle(src, rnd) {
    const c = Array.from(src); let n = c.length;
    while ((n -= 1) > 0) { const k = rnd.Next(n + 1); const t = c[n]; c[n] = c[k]; c[k] = t; }
    return c;
  }
  function pick(src, rnd) { const l = Array.from(src); const i = rnd.Next(l.length); if (i >= l.length) return null; return l[i]; }
  function except(a, b) { const s = new Set(b), seen = new Set(); return a.filter((x) => { if (s.has(x) || seen.has(x)) return false; seen.add(x); return true; }); }
  function distinct(a) { return Array.from(new Set(a)); }

  // ── enums
  const IT = {
    Nothing: 0, Random: 1,
    MapHC: 0x7F, MapEP: 0x7D, MapDP: 0x7C, MapTH: 0x75, MapPD: 0x79, MapSP: 0x7A, MapSW: 0x77, MapTT: 0x74, MapIP: 0x76, MapMM: 0x78, MapTR: 0x73, MapGT: 0x72,
    CompassEP: 0x8D, CompassDP: 0x8C, CompassTH: 0x85, CompassPD: 0x89, CompassSP: 0x8A, CompassSW: 0x87, CompassTT: 0x84, CompassIP: 0x86, CompassMM: 0x88, CompassTR: 0x83, CompassGT: 0x82,
    BigKeyEP: 0x9D, BigKeyDP: 0x9C, BigKeyTH: 0x95, BigKeyPD: 0x99, BigKeySP: 0x9A, BigKeySW: 0x97, BigKeyTT: 0x94, BigKeyIP: 0x96, BigKeyMM: 0x98, BigKeyTR: 0x93, BigKeyGT: 0x92,
    KeyHC: 0xA0, KeyCT: 0xA4, KeyDP: 0xA3, KeyTH: 0xAA, KeyPD: 0xA6, KeySP: 0xA5, KeySW: 0xA8, KeyTT: 0xAB, KeyIP: 0xA9, KeyMM: 0xA7, KeyTR: 0xAC, KeyGT: 0xAD,
    Key: 0x24, Compass: 0x25, BigKey: 0x32, Map: 0x33,
    ProgressiveTunic: 0x60, ProgressiveShield: 0x5F, ProgressiveSword: 0x5E, Bow: 0x0B, SilverArrows: 0x58, BlueBoomerang: 0x0C, RedBoomerang: 0x2A,
    Hookshot: 0x0A, Mushroom: 0x29, Powder: 0x0D, Firerod: 0x07, Icerod: 0x08, Bombos: 0x0F, Ether: 0x10, Quake: 0x11, Lamp: 0x12, Hammer: 0x09,
    Shovel: 0x13, Flute: 0x14, Bugnet: 0x21, Book: 0x1D, Bottle: 0x16, Somaria: 0x15, Byrna: 0x18, Cape: 0x19, Mirror: 0x1A, Boots: 0x4B,
    ProgressiveGlove: 0x61, Flippers: 0x1E, MoonPearl: 0x1F, HalfMagic: 0x4E, HeartPiece: 0x17, HeartContainer: 0x3E, HeartContainerRefill: 0x3F,
    ThreeBombs: 0x28, Arrow: 0x43, TenArrows: 0x44, OneRupee: 0x34, FiveRupees: 0x35, TwentyRupees: 0x36, TwentyRupees2: 0x47, FiftyRupees: 0x41,
    OneHundredRupees: 0x40, ThreeHundredRupees: 0x46, BombUpgrade5: 0x51, BombUpgrade10: 0x52, ArrowUpgrade5: 0x53, ArrowUpgrade10: 0x54,
    CardCrateriaL1: 0xD0, CardCrateriaL2: 0xD1, CardCrateriaBoss: 0xD2, CardBrinstarL1: 0xD3, CardBrinstarL2: 0xD4, CardBrinstarBoss: 0xD5,
    CardNorfairL1: 0xD6, CardNorfairL2: 0xD7, CardNorfairBoss: 0xD8, CardMaridiaL1: 0xD9, CardMaridiaL2: 0xDA, CardMaridiaBoss: 0xDB,
    CardWreckedShipL1: 0xDC, CardWreckedShipBoss: 0xDD, CardLowerNorfairL1: 0xDE, CardLowerNorfairBoss: 0xDF,
    SmMapBrinstar: 0xCA, SmMapWreckedShip: 0xCB, SmMapMaridia: 0xCC, SmMapLowerNorfair: 0xCD,
    Missile: 0xC2, Super: 0xC3, PowerBomb: 0xC4, Grapple: 0xB0, XRay: 0xB1, ETank: 0xC0, ReserveTank: 0xC1, Charge: 0xBB, Ice: 0xBC, Wave: 0xBD,
    Spazer: 0xBE, Plasma: 0xBF, Varia: 0xB2, Gravity: 0xB6, Morph: 0xB4, Bombs: 0xB9, SpringBall: 0xB3, ScrewAttack: 0xB5, HiJump: 0xB7,
    SpaceJump: 0xB8, SpeedBooster: 0xBA,
    BottleWithRedPotion: 0x2B, BottleWithGreenPotion: 0x2C, BottleWithBluePotion: 0x2D, BottleWithFairy: 0x3D, BottleWithBee: 0x3C, BottleWithGoldBee: 0x48,
    RedContent: 0x2E, GreenContent: 0x2F, BlueContent: 0x30, BeeContent: 0x0E,
  };
  const IT_NAME = {}; for (const k in IT) IT_NAME[IT[k]] = k;
  const IT_DESC = {
    Nothing: 'Nothing', Random: 'Random', MapHC: 'Hyrule Castle Map', MapEP: 'Eastern Palace Map', MapDP: 'Desert Palace Map', MapTH: 'Tower of Hera Map', MapPD: 'Palace of Darkness Map',
    MapSP: 'Swamp Palace Map', MapSW: 'Skull Woods Map', MapTT: 'Thieves Town Map', MapIP: 'Ice Palace Map', MapMM: 'Misery Mire Map', MapTR: 'Turtle Rock Map', MapGT: 'Ganons Tower Map',
    CompassEP: 'Eastern Palace Compass', CompassDP: 'Desert Palace Compass', CompassTH: 'Tower of Hera Compass', CompassPD: 'Palace of Darkness Compass', CompassSP: 'Swamp Palace Compass',
    CompassSW: 'Skull Woods Compass', CompassTT: 'Thieves Town Compass', CompassIP: 'Ice Palace Compass', CompassMM: 'Misery Mire Compass', CompassTR: 'Turtle Rock Compass', CompassGT: 'Ganons Tower Compass',
    BigKeyEP: 'Eastern Palace Big Key', BigKeyDP: 'Desert Palace Big Key', BigKeyTH: 'Tower of Hera Big Key', BigKeyPD: 'Palace of Darkness Big Key', BigKeySP: 'Swamp Palace Big Key',
    BigKeySW: 'Skull Woods Big Key', BigKeyTT: 'Thieves Town Big Key', BigKeyIP: 'Ice Palace Big Key', BigKeyMM: 'Misery Mire Big Key', BigKeyTR: 'Turtle Rock Big Key', BigKeyGT: 'Ganons Tower Big Key',
    KeyHC: 'Sewer Key', KeyCT: 'Castle Tower Key', KeyDP: 'Desert Palace Key', KeyTH: 'Tower of Hera Key', KeyPD: 'Palace of Darkness Key', KeySP: 'Swamp Palace Key', KeySW: 'Skull Woods Key',
    KeyTT: 'Thieves Town Key', KeyIP: 'Ice Palace Key', KeyMM: 'Misery Mire Key', KeyTR: 'Turtle Rock Key', KeyGT: 'Ganons Tower Key', Key: 'Small Key', Compass: 'Compass', BigKey: 'Big Key', Map: 'Map',
    ProgressiveTunic: 'Progressive Mail', ProgressiveShield: 'Progressive Shield', ProgressiveSword: 'Progressive Sword', Bow: 'Bow', SilverArrows: 'Silver Arrows', BlueBoomerang: 'Blue Boomerang',
    RedBoomerang: 'Red Boomerang', Hookshot: 'Hookshot', Mushroom: 'Mushroom', Powder: 'Magic Powder', Firerod: 'Fire Rod', Icerod: 'Ice Rod', Bombos: 'Bombos', Ether: 'Ether', Quake: 'Quake',
    Lamp: 'Lamp', Hammer: 'Hammer', Shovel: 'Shovel', Flute: 'Flute', Bugnet: 'Bug Catching Net', Book: 'Book of Mudora', Bottle: 'Bottle', Somaria: 'Cane of Somaria', Byrna: 'Cane of Byrna',
    Cape: 'Magic Cape', Mirror: 'Magic Mirror', Boots: 'Pegasus Boots', ProgressiveGlove: 'Progressive Glove', Flippers: "Zora's Flippers", MoonPearl: 'Moon Pearl', HalfMagic: 'Half Magic',
    HeartPiece: 'Piece of Heart', HeartContainer: 'Heart Container', HeartContainerRefill: 'Sanctuary Heart Container', ThreeBombs: 'Three Bombs', Arrow: 'Single Arrow', TenArrows: 'Ten Arrows',
    OneRupee: 'One Rupee', FiveRupees: 'Five Rupees', TwentyRupees: 'Twenty Rupees', TwentyRupees2: 'Twenty Rupees', FiftyRupees: 'Fifty Rupees', OneHundredRupees: 'One Hundred Rupees',
    ThreeHundredRupees: 'Three Hundred Rupees', BombUpgrade5: '+5 Bomb Capacity', BombUpgrade10: '+10 Bomb Capacity', ArrowUpgrade5: '+5 Arrow Capacity', ArrowUpgrade10: '+10 Arrow Capacity',
    CardCrateriaL1: 'Crateria Level 1 Keycard', CardCrateriaL2: 'Crateria Level 2 Keycard', CardCrateriaBoss: 'Crateria Boss Keycard', CardBrinstarL1: 'Brinstar Level 1 Keycard',
    CardBrinstarL2: 'Brinstar Level 2 Keycard', CardBrinstarBoss: 'Brinstar Boss Keycard', CardNorfairL1: 'Norfair Level 1 Keycard', CardNorfairL2: 'Norfair Level 2 Keycard',
    CardNorfairBoss: 'Norfair Boss Keycard', CardMaridiaL1: 'Maridia Level 1 Keycard', CardMaridiaL2: 'Maridia Level 2 Keycard', CardMaridiaBoss: 'Maridia Boss Keycard',
    CardWreckedShipL1: 'Wrecked Ship Level 1 Keycard', CardWreckedShipBoss: 'Wrecked Ship Boss Keycard', CardLowerNorfairL1: 'Lower Norfair Level 1 Keycard', CardLowerNorfairBoss: 'Lower Norfair Boss Keycard',
    SmMapBrinstar: 'Brinstar Map', SmMapWreckedShip: 'Wrecked Ship Map', SmMapMaridia: 'Maridia Map', SmMapLowerNorfair: 'Lower Norfair Map',
    Missile: 'Missile', Super: 'Super Missile', PowerBomb: 'Power Bomb', Grapple: 'Grappling Beam', XRay: 'X-Ray Scope', ETank: 'Energy Tank', ReserveTank: 'Reserve Tank', Charge: 'Charge Beam',
    Ice: 'Ice Beam', Wave: 'Wave Beam', Spazer: 'Spazer', Plasma: 'Plasma Beam', Varia: 'Varia Suit', Gravity: 'Gravity Suit', Morph: 'Morphing Ball', Bombs: 'Morph Bombs', SpringBall: 'Spring Ball',
    ScrewAttack: 'Screw Attack', HiJump: 'Hi-Jump Boots', SpaceJump: 'Space Jump', SpeedBooster: 'Speed Booster',
  };
  const RewardType = { None: 0, Agahnim: 1, PendantGreen: 2, PendantNonGreen: 4, CrystalBlue: 8, CrystalRed: 16, BossTokenKraid: 32, BossTokenPhantoon: 64, BossTokenDraygon: 128, BossTokenRidley: 256 };
  RewardType.AnyPendant = RewardType.PendantGreen | RewardType.PendantNonGreen;
  RewardType.AnyCrystal = RewardType.CrystalBlue | RewardType.CrystalRed;
  RewardType.AnyBossToken = 32 | 64 | 128 | 256;
  const REWARD_DESC = { 1: 'Agahnim', 2: 'Green Pendant', 4: 'Blue/Red Pendant', 8: 'Blue Crystal', 16: 'Red Crystal', 32: 'Kraid Boss Token', 64: 'Phantoon Boss Token', 128: 'Draygon Boss Token', 256: 'Ridley Boss Token' };
  const Medallion = { Bombos: 0, Ether: 1, Quake: 2 };
  const MEDALLION_NAME = ['Bombos', 'Ether', 'Quake'];
  const SMLogic = { Normal: 0, Hard: 1 };

  // ── items
  class Item {
    constructor(type, world) { this.Type = type; this.Name = IT_DESC[IT_NAME[type]]; this.World = world || null; this.Progression = false; }
    get IsDungeonItem() { return /^(BigKey|Key|Map|Compass)/.test(IT_NAME[this.Type]); }
    get IsBigKey() { return /^BigKey/.test(IT_NAME[this.Type]); }
    get IsKey() { return /^Key/.test(IT_NAME[this.Type]); }
    get IsMap() { return /^Map/.test(IT_NAME[this.Type]); }
    get IsCompass() { return /^Compass/.test(IT_NAME[this.Type]); }
    get IsKeycard() { return /^Card/.test(IT_NAME[this.Type]); }
    get IsSmMap() { return /^SmMap/.test(IT_NAME[this.Type]); }
    Is(type, world) { return this.Type === type && this.World === world; }
    IsNot(type, world) { return !this.Is(type, world); }

    static copies(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f()); return a; }
    static CreateProgressionPool(world) {
      const T = IT, p = [T.ProgressiveShield, T.ProgressiveShield, T.ProgressiveShield, T.ProgressiveSword, T.ProgressiveSword, T.Bow, T.Hookshot, T.Mushroom, T.Powder, T.Firerod, T.Icerod,
        T.Bombos, T.Ether, T.Quake, T.Lamp, T.Hammer, T.Shovel, T.Flute, T.Bugnet, T.Book, T.Bottle, T.Somaria, T.Byrna, T.Cape, T.Mirror, T.Boots, T.ProgressiveGlove, T.ProgressiveGlove,
        T.Flippers, T.MoonPearl, T.HalfMagic,
        T.Grapple, T.Charge, T.Ice, T.Wave, T.Plasma, T.Varia, T.Gravity, T.Morph, T.Bombs, T.SpringBall, T.ScrewAttack, T.HiJump, T.SpaceJump, T.SpeedBooster,
        T.Missile, T.Super, T.PowerBomb, T.PowerBomb, T.ETank, T.ETank, T.ETank, T.ETank, T.ETank, T.ReserveTank, T.ReserveTank, T.ReserveTank, T.ReserveTank]
        .map((t) => new Item(t));
      p.forEach((i) => { i.Progression = true; i.World = world; });
      return p;
    }
    static CreateNicePool(world) {
      const T = IT, p = [T.ProgressiveTunic, T.ProgressiveTunic, T.ProgressiveSword, T.ProgressiveSword, T.SilverArrows, T.BlueBoomerang, T.RedBoomerang, T.Bottle, T.Bottle, T.Bottle,
        T.HeartContainerRefill, T.Spazer, T.XRay].map((t) => new Item(t));
      p.push(...Item.copies(10, () => new Item(T.HeartContainer, world)));
      p.forEach((i) => { i.World = world; });
      return p;
    }
    static CreateJunkPool(world) {
      const T = IT, p = [new Item(T.Arrow), new Item(T.OneHundredRupees)];
      const add = (n, t) => p.push(...Item.copies(n, () => new Item(t)));
      add(24, T.HeartPiece); add(8, T.TenArrows); add(13, T.ThreeBombs); add(4, T.ArrowUpgrade5); add(4, T.BombUpgrade5); add(2, T.OneRupee); add(4, T.FiveRupees);
      add(world.Config.Keysanity ? 21 : 28, T.TwentyRupees); add(7, T.FiftyRupees); add(5, T.ThreeHundredRupees);
      add(9, T.ETank); add(39, T.Missile); add(15, T.Super); add(8, T.PowerBomb);
      p.forEach((i) => { i.World = world; });
      return p;
    }
    static CreateDungeonPool(world) {
      const T = IT, p = [];
      [T.BigKeyEP, T.BigKeyDP, T.BigKeyTH, T.BigKeyPD, T.BigKeySP, T.BigKeySW, T.BigKeyTT, T.BigKeyIP, T.BigKeyMM, T.BigKeyTR, T.BigKeyGT].forEach((t) => p.push(new Item(t)));
      [[1, T.KeyHC], [2, T.KeyCT], [1, T.KeyDP], [1, T.KeyTH], [6, T.KeyPD], [1, T.KeySP], [3, T.KeySW], [1, T.KeyTT], [2, T.KeyIP], [3, T.KeyMM], [4, T.KeyTR], [4, T.KeyGT]]
        .forEach(([n, t]) => p.push(...Item.copies(n, () => new Item(t))));
      [T.MapEP, T.MapDP, T.MapTH, T.MapPD, T.MapSP, T.MapSW, T.MapTT, T.MapIP, T.MapMM, T.MapTR].forEach((t) => p.push(new Item(t)));
      if (!world.Config.Keysanity) [T.MapHC, T.MapGT, T.CompassEP, T.CompassDP, T.CompassTH, T.CompassPD, T.CompassSP, T.CompassSW, T.CompassTT, T.CompassIP, T.CompassMM, T.CompassTR, T.CompassGT].forEach((t) => p.push(new Item(t)));
      p.forEach((i) => { i.World = world; });
      return p;
    }
    static CreateKeycards(world) {
      const T = IT;
      return [T.CardCrateriaL1, T.CardCrateriaL2, T.CardCrateriaBoss, T.CardBrinstarL1, T.CardBrinstarL2, T.CardBrinstarBoss, T.CardNorfairL1, T.CardNorfairL2, T.CardNorfairBoss,
        T.CardMaridiaL1, T.CardMaridiaL2, T.CardMaridiaBoss, T.CardWreckedShipL1, T.CardWreckedShipBoss, T.CardLowerNorfairL1, T.CardLowerNorfairBoss].map((t) => new Item(t, world));
    }
    static CreateSmMaps(world) { return [IT.SmMapBrinstar, IT.SmMapWreckedShip, IT.SmMapMaridia, IT.SmMapLowerNorfair].map((t) => new Item(t, world)); }
  }
  function getItem(items, type) { const it = items.find((i) => i.Type === type); if (!it) throw new Error('Could not find an item of type ' + IT_NAME[type]); return it; }
  function removeItem(list, item) { const i = list.indexOf(item); if (i >= 0) { list.splice(i, 1); return true; } return false; }

  // ── progression (what a set of items allows)
  const FLAGS = ['BigKeyEP', 'BigKeyDP', 'BigKeyTH', 'BigKeyPD', 'BigKeySP', 'BigKeySW', 'BigKeyTT', 'BigKeyIP', 'BigKeyMM', 'BigKeyTR', 'BigKeyGT', 'KeyHC', 'KeyDP', 'KeyTH', 'KeySP', 'KeyTT',
    'CardCrateriaL1', 'CardCrateriaL2', 'CardCrateriaBoss', 'CardBrinstarL1', 'CardBrinstarL2', 'CardBrinstarBoss', 'CardNorfairL1', 'CardNorfairL2', 'CardNorfairBoss', 'CardMaridiaL1',
    'CardMaridiaL2', 'CardMaridiaBoss', 'CardWreckedShipL1', 'CardWreckedShipBoss', 'CardLowerNorfairL1', 'CardLowerNorfairBoss', 'Bow', 'Hookshot', 'Mushroom', 'Powder', 'Firerod', 'Icerod',
    'Bombos', 'Ether', 'Quake', 'Lamp', 'Hammer', 'Shovel', 'Flute', 'Book', 'Bottle', 'Somaria', 'Byrna', 'Cape', 'Mirror', 'Boots', 'Flippers', 'MoonPearl', 'HalfMagic', 'Grapple', 'Charge',
    'Ice', 'Wave', 'Plasma', 'Varia', 'Gravity', 'Morph', 'Bombs', 'SpringBall', 'ScrewAttack', 'HiJump', 'SpaceJump', 'SpeedBooster', 'Missile', 'Super'];
  const FLAG_OF = {}; FLAGS.forEach((f) => { FLAG_OF[IT[f]] = f; });
  const COUNT_OF = { [IT.KeyCT]: 'KeyCT', [IT.KeyPD]: 'KeyPD', [IT.KeySW]: 'KeySW', [IT.KeyIP]: 'KeyIP', [IT.KeyMM]: 'KeyMM', [IT.KeyTR]: 'KeyTR', [IT.KeyGT]: 'KeyGT', [IT.ETank]: 'ETank', [IT.ReserveTank]: 'ReserveTank' };
  class Progression {
    constructor(items) {
      FLAGS.forEach((f) => { this[f] = false; });
      this.KeyCT = this.KeyPD = this.KeySW = this.KeyIP = this.KeyMM = this.KeyTR = this.KeyGT = this.ETank = this.ReserveTank = 0;
      this.Sword = this.MasterSword = this.Glove = this.Mitt = this.PowerBomb = this.TwoPowerBombs = false; this.shield = 0;
      if (items) this.Add(items);
    }
    Add(items) {
      for (const item of items) {
        const t = item.Type, f = FLAG_OF[t];
        if (f) { this[f] = true; continue; }
        const c = COUNT_OF[t];
        if (c) { this[c] += 1; continue; }
        if (t === IT.ProgressiveShield) this.shield += 1;
        else if (t === IT.ProgressiveSword) { this.MasterSword = this.Sword; this.Sword = true; }
        else if (t === IT.ProgressiveGlove) { this.Mitt = this.Glove; this.Glove = true; }
        else if (t === IT.PowerBomb) { this.TwoPowerBombs = this.PowerBomb; this.PowerBomb = true; }
      }
    }
    get CanBlockLasers() { return this.shield >= 3; }
    CanLiftLight() { return this.Glove; }
    CanLiftHeavy() { return this.Mitt; }
    CanLightTorches() { return this.Firerod || this.Lamp; }
    CanMeltFreezors() { return this.Firerod || this.Bombos && this.Sword; }
    CanExtendMagic(bars = 2) { return (this.HalfMagic ? 2 : 1) * (this.Bottle ? 2 : 1) >= bars; }
    CanKillManyEnemies() { return this.Sword || this.Hammer || this.Bow || this.Firerod || this.Somaria || this.Byrna && this.CanExtendMagic(); }
    CanAccessDeathMountainPortal() { return (this.CanDestroyBombWalls() || this.SpeedBooster) && this.Super && this.Morph; }
    CanAccessDarkWorldPortal(config) {
      return config.SMLogic === SMLogic.Normal ?
        this.CardMaridiaL1 && this.CardMaridiaL2 && this.CanUsePowerBombs() && this.Super && this.Gravity && this.SpeedBooster :
        this.CardMaridiaL1 && this.CardMaridiaL2 && this.CanUsePowerBombs() && this.Super && (this.Charge || this.Super && this.Missile) &&
        (this.Gravity || this.HiJump && this.Ice && this.Grapple) && (this.Ice || this.Gravity && this.SpeedBooster);
    }
    CanAccessMiseryMirePortal(config) {
      return config.SMLogic === SMLogic.Normal ?
        (this.CardNorfairL2 || this.SpeedBooster && this.Wave) && this.Varia && this.Super && this.Gravity && this.SpaceJump && this.CanUsePowerBombs() :
        (this.CardNorfairL2 || this.SpeedBooster) && this.Varia && this.Super && (this.CanFly() || this.HiJump || this.SpeedBooster || this.CanSpringBallJump() || this.Ice) &&
        (this.Gravity || this.HiJump) && this.CanUsePowerBombs();
    }
    CanIbj() { return this.Morph && this.Bombs; }
    CanFly() { return this.SpaceJump || this.CanIbj(); }
    CanUsePowerBombs() { return this.Morph && this.PowerBomb; }
    CanPassBombPassages() { return this.Morph && (this.Bombs || this.PowerBomb); }
    CanDestroyBombWalls() { return this.CanPassBombPassages() || this.ScrewAttack; }
    CanSpringBallJump() { return this.Morph && this.SpringBall; }
    CanHellRun() { return this.Varia || this.HasEnergyReserves(5); }
    HasEnergyReserves(n) { return (this.ETank + this.ReserveTank) >= n; }
    CanOpenRedDoors() { return this.Missile || this.Super; }
    CanAccessNorfairUpperPortal() { return this.Flute || this.CanLiftLight() && this.Lamp; }
    CanAccessNorfairLowerPortal() { return this.Flute && this.CanLiftHeavy(); }
    CanAccessMaridiaPortal(world) {
      return world.Config.SMLogic === SMLogic.Normal ?
        this.MoonPearl && this.Flippers && this.Gravity && this.Morph &&
        (world.CanAcquire(this, RewardType.Agahnim) || this.Hammer && this.CanLiftLight() || this.CanLiftHeavy()) :
        this.MoonPearl && this.Flippers && (this.CanSpringBallJump() || this.HiJump || this.Gravity) && this.Morph &&
        (world.CanAcquire(this, RewardType.Agahnim) || this.Hammer && this.CanLiftLight() || this.CanLiftHeavy());
    }
  }

  // ── locations and regions
  class Location {
    constructor(region, id, address, type, name, access) {
      this.Region = region; this.Id = id; this.Name = name; this.Type = type; this.Address = address; this.Item = null;
      this.canAccess = access || (() => true); this.alwaysAllow = () => false; this.allow = () => true; this.weight = null;
    }
    get Weight() { return this.weight !== null && this.weight !== undefined ? this.weight : this.Region.Weight; }
    ItemIs(type, world) { return !!this.Item && this.Item.Is(type, world); }
    ItemIsNot(type, world) { return !this.ItemIs(type, world); }
    Weighted(w) { this.weight = w; return this; }
    AlwaysAllow(f) { this.alwaysAllow = f; return this; }
    Allow(f) { this.allow = f; return this; }
    Available(items) { return this.Region.CanEnter(items) && this.canAccess(items); }
    CanFill(item, items) {
      const old = this.Item; this.Item = item;
      const ok = this.alwaysAllow(item, items) || (this.Region.CanFill(item, items) && this.allow(item, items) && this.Available(items));
      this.Item = old; return ok;
    }
  }
  const empty = (locs) => locs.filter((l) => l.Item === null);
  const filled = (locs) => locs.filter((l) => l.Item !== null);
  function available(locs, items) { const p = new Progression(items); return locs.filter((l) => l.Available(p)); }
  function availableWithinWorld(locs, items) {
    const worlds = distinct(locs.map((l) => l.Region.World));
    return [].concat(...worlds.map((w) => available(locs.filter((l) => l.Region.World === w), items.filter((i) => i.World === w))));
  }
  function canFillWithinWorld(locs, item, items) {
    const itemWorldProgression = new Progression(items.filter((i) => i.World === item.World).concat([item]));
    const wp = {}; distinct(locs.map((l) => l.Region.World)).forEach((w) => { wp[w.Id] = new Progression(items.filter((i) => i.World === w)); });
    return locs.filter((l) => l.CanFill(item, wp[l.Region.World.Id]) && item.World.Locations.find((ll) => ll.Id === l.Id).Available(itemWorldProgression));
  }

  class Region {
    constructor(world, config) { this.Config = config; this.World = world; this.Weight = 0; this.RegionItems = []; this.lookup = {}; this.Locations = []; }
    get Area() { return this.Name; }
    GetLocation(name) { return this.lookup[name]; }
    GenerateLocationLookup() { this.lookup = {}; this.Locations.forEach((l) => { this.lookup[l.Name] = l; }); }
    IsRegionItem(item) { return this.RegionItems.indexOf(item.Type) >= 0; }
    CanFill(item, items) { return this.Config.Keysanity || !item.IsDungeonItem || this.IsRegionItem(item); }
    CanEnter(items) { return true; }
  }
  class Z3Region extends Region {}
  Z3Region.prototype.isZ3 = true;
  class SMRegion extends Region { get Logic() { return this.Config.SMLogic; } }
  SMRegion.prototype.isSM = true;

  // Zelda.CastleTower
  class Zelda_CastleTower extends Z3Region {

        get Name() { return "Castle Tower"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.Agahnim;
            this.RegionItems = [ IT.KeyCT ];

            this.Locations = [
                new Location(this, 256+101, 0x1EAB5, 'Regular', "Castle Tower - Foyer"),
                new Location(this, 256+102, 0x1EAB2, 'Regular', "Castle Tower - Dark Maze",
                    items => items.Lamp && items.KeyCT >= 1),
            ];
        }

        CanEnter(items) {
            return items.CanKillManyEnemies() && (items.Cape || items.MasterSword);
        }

        CanComplete(items) {
            return this.CanEnter(items) && items.Lamp && items.KeyCT >= 2 && items.Sword;
        }
  }
  Zelda_CastleTower.prototype.kind = 'CastleTower';
  Zelda_CastleTower.prototype.isIReward = true;
  // Zelda.EasternPalace
  class Zelda_EasternPalace extends Z3Region {

        get Name() { return "Eastern Palace"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.BigKeyEP, IT.MapEP, IT.CompassEP ];

            this.Locations = [
                new Location(this, 256+103, 0x1E9B3, 'Regular', "Eastern Palace - Cannonball Chest"),
                new Location(this, 256+104, 0x1E9F5, 'Regular', "Eastern Palace - Map Chest"),
                new Location(this, 256+105, 0x1E977, 'Regular', "Eastern Palace - Compass Chest"),
                new Location(this, 256+106, 0x1E97D, 'Regular', "Eastern Palace - Big Chest",
                    items => items.BigKeyEP),
                new Location(this, 256+107, 0x1E9B9, 'Regular', "Eastern Palace - Big Key Chest",
                    items => items.Lamp),
                new Location(this, 256+108, 0x308150, 'Regular', "Eastern Palace - Armos Knights",
                    items => items.BigKeyEP && items.Bow && items.Lamp),
            ];
        }

        CanComplete(items) {
            return this.GetLocation("Eastern Palace - Armos Knights").Available(items);
        }
  }
  Zelda_EasternPalace.prototype.kind = 'EasternPalace';
  Zelda_EasternPalace.prototype.isIReward = true;
  // Zelda.DesertPalace
  class Zelda_DesertPalace extends Z3Region {

        get Name() { return "Desert Palace"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.KeyDP, IT.BigKeyDP, IT.MapDP, IT.CompassDP ];

            this.Locations = [
                new Location(this, 256+109, 0x1E98F, 'Regular', "Desert Palace - Big Chest",
                    items => items.BigKeyDP),
                new Location(this, 256+110, 0x308160, 'Regular', "Desert Palace - Torch",
                    items => items.Boots),
                new Location(this, 256+111, 0x1E9B6, 'Regular', "Desert Palace - Map Chest"),
                new Location(this, 256+112, 0x1E9C2, 'Regular', "Desert Palace - Big Key Chest",
                    items => items.KeyDP),
                new Location(this, 256+113, 0x1E9CB, 'Regular', "Desert Palace - Compass Chest",
                    items => items.KeyDP),
                new Location(this, 256+114, 0x308151, 'Regular', "Desert Palace - Lanmolas",
                    items => (
                        items.CanLiftLight() ||
                        items.CanAccessMiseryMirePortal(this.Config) && items.Mirror
                    ) && items.BigKeyDP && items.KeyDP && items.CanLightTorches() && this.CanBeatBoss(items)),
            ];
        }

        CanBeatBoss(items) {
            return items.Sword || items.Hammer || items.Bow ||
                items.Firerod || items.Icerod ||
                items.Byrna || items.Somaria;
        }

        CanEnter(items) {
            return items.Book ||
                items.Mirror && items.CanLiftHeavy() && items.Flute ||
                items.CanAccessMiseryMirePortal(this.Config) && items.Mirror;
        }

        CanComplete(items) {
            return this.GetLocation("Desert Palace - Lanmolas").Available(items);
        }
  }
  Zelda_DesertPalace.prototype.kind = 'DesertPalace';
  Zelda_DesertPalace.prototype.isIReward = true;
  // Zelda.TowerOfHera
  class Zelda_TowerOfHera extends Z3Region {

        get Name() { return "Tower of Hera"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.KeyTH, IT.BigKeyTH, IT.MapTH, IT.CompassTH ];

            this.Locations = [
                new Location(this, 256+115, 0x308162, 'HeraStandingKey', "Tower of Hera - Basement Cage"),
                new Location(this, 256+116, 0x1E9AD, 'Regular', "Tower of Hera - Map Chest"),
                new Location(this, 256+117, 0x1E9E6, 'Regular', "Tower of Hera - Big Key Chest",
                    items => items.KeyTH && items.CanLightTorches())
                    .AlwaysAllow((item, items) => item.Is(IT.KeyTH, this.World)),
                new Location(this, 256+118, 0x1E9FB, 'Regular', "Tower of Hera - Compass Chest",
                    items => items.BigKeyTH),
                new Location(this, 256+119, 0x1E9F8, 'Regular', "Tower of Hera - Big Chest",
                    items => items.BigKeyTH),
                new Location(this, 256+120, 0x308152, 'Regular', "Tower of Hera - Moldorm",
                    items => items.BigKeyTH && this.CanBeatBoss(items)),
            ];
        }

        CanBeatBoss(items) {
            return items.Sword || items.Hammer;
        }

        CanEnter(items) {
            return (items.Mirror || items.Hookshot && items.Hammer) && this.World.CanEnter("Light this.World Death Mountain West", items);
        }

        CanComplete(items) {
            return this.GetLocation("Tower of Hera - Moldorm").Available(items);
        }
  }
  Zelda_TowerOfHera.prototype.kind = 'TowerOfHera';
  Zelda_TowerOfHera.prototype.isIReward = true;
  // Zelda.PalaceOfDarkness
  class Zelda_PalaceOfDarkness extends Z3Region {

        get Name() { return "Palace of Darkness"; }
        get Area() { return "Dark Palace"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.KeyPD, IT.BigKeyPD, IT.MapPD, IT.CompassPD ];

            this.Locations = [
                new Location(this, 256+121, 0x1EA5B, 'Regular', "Palace of Darkness - Shooter Room"),
                new Location(this, 256+122, 0x1EA37, 'Regular', "Palace of Darkness - Big Key Chest",
                    items => items.KeyPD >= (this.GetLocation("Palace of Darkness - Big Key Chest").ItemIs(IT.KeyPD, this.World) ? 1 :
                        (items.Hammer && items.Bow && items.Lamp) || config.Keysanity ? 6 : 5))
                    .AlwaysAllow((item, items) => item.Is(IT.KeyPD, this.World) && items.KeyPD >= 5),
                new Location(this, 256+123, 0x1EA49, 'Regular', "Palace of Darkness - Stalfos Basement",
                    items => items.KeyPD >= 1 || items.Bow && items.Hammer),
                new Location(this, 256+124, 0x1EA3D, 'Regular', "Palace of Darkness - The Arena - Bridge",
                    items => items.KeyPD >= 1 || items.Bow && items.Hammer),
                new Location(this, 256+125, 0x1EA3A, 'Regular', "Palace of Darkness - The Arena - Ledge",
                    items => items.Bow),
                new Location(this, 256+126, 0x1EA52, 'Regular', "Palace of Darkness - Map Chest",
                    items => items.Bow),
                new Location(this, 256+127, 0x1EA43, 'Regular', "Palace of Darkness - Compass Chest",
                    items => items.KeyPD >= ((items.Hammer && items.Bow && items.Lamp) || config.Keysanity ? 4 : 3)),
                new Location(this, 256+128, 0x1EA46, 'Regular', "Palace of Darkness - Harmless Hellway",
                    items => items.KeyPD >= (this.GetLocation("Palace of Darkness - Harmless Hellway").ItemIs(IT.KeyPD, this.World) ?
                        (items.Hammer && items.Bow && items.Lamp) || config.Keysanity ? 4 : 3 :
                        (items.Hammer && items.Bow && items.Lamp) || config.Keysanity ? 6 : 5))
                    .AlwaysAllow((item, items) => item.Is(IT.KeyPD, this.World) && items.KeyPD >= 5),
                new Location(this, 256+129, 0x1EA4C, 'Regular', "Palace of Darkness - Dark Basement - Left",
                    items => items.Lamp && items.KeyPD >= ((items.Hammer && items.Bow) || config.Keysanity ? 4 : 3)),
                new Location(this, 256+130, 0x1EA4F, 'Regular', "Palace of Darkness - Dark Basement - Right",
                    items => items.Lamp && items.KeyPD >= ((items.Hammer && items.Bow) || config.Keysanity ? 4 : 3)),
                new Location(this, 256+131, 0x1EA55, 'Regular', "Palace of Darkness - Dark Maze - Top",
                    items => items.Lamp && items.KeyPD >= ((items.Hammer && items.Bow) || config.Keysanity ? 6 : 5)),
                new Location(this, 256+132, 0x1EA58, 'Regular', "Palace of Darkness - Dark Maze - Bottom",
                    items => items.Lamp && items.KeyPD >= ((items.Hammer && items.Bow) || config.Keysanity ? 6 : 5)),
                new Location(this, 256+133, 0x1EA40, 'Regular', "Palace of Darkness - Big Chest",
                    items => items.BigKeyPD && items.Lamp && items.KeyPD >= ((items.Hammer && items.Bow) || config.Keysanity ? 6 : 5)),
                new Location(this, 256+134, 0x308153, 'Regular', "Palace of Darkness - Helmasaur King",
                    items => items.Lamp && items.Hammer && items.Bow && items.BigKeyPD && items.KeyPD >= 6),
            ];
        }

        CanEnter(items) {
            return items.MoonPearl && this.World.CanEnter("Dark this.World North East", items);
        }

        CanComplete(items) {
            return this.GetLocation("Palace of Darkness - Helmasaur King").Available(items);
        }
  }
  Zelda_PalaceOfDarkness.prototype.kind = 'PalaceOfDarkness';
  Zelda_PalaceOfDarkness.prototype.isIReward = true;
  // Zelda.SwampPalace
  class Zelda_SwampPalace extends Z3Region {

        get Name() { return "Swamp Palace"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Weight = 3;
            this.RegionItems = [ IT.KeySP, IT.BigKeySP, IT.MapSP, IT.CompassSP ];

            this.Locations = [
                new Location(this, 256+135, 0x1EA9D, 'Regular', "Swamp Palace - Entrance")
                    .Allow((item, items) => this.Config.Keysanity || item.Is(IT.KeySP, this.World)),
                new Location(this, 256+136, 0x1E986, 'Regular', "Swamp Palace - Map Chest",
                    items => items.KeySP),
                new Location(this, 256+137, 0x1E989, 'Regular', "Swamp Palace - Big Chest",
                    items => items.BigKeySP && items.KeySP && items.Hammer)
                    .AlwaysAllow((item, items) => item.Is(IT.BigKeySP, this.World)),
                new Location(this, 256+138, 0x1EAA0, 'Regular', "Swamp Palace - Compass Chest",
                    items => items.KeySP && items.Hammer),
                new Location(this, 256+139, 0x1EAA3, 'Regular', "Swamp Palace - West Chest",
                    items => items.KeySP && items.Hammer),
                new Location(this, 256+140, 0x1EAA6, 'Regular', "Swamp Palace - Big Key Chest",
                    items => items.KeySP && items.Hammer),
                new Location(this, 256+141, 0x1EAA9, 'Regular', "Swamp Palace - Flooded Room - Left",
                    items => items.KeySP && items.Hammer && items.Hookshot),
                new Location(this, 256+142, 0x1EAAC, 'Regular', "Swamp Palace - Flooded Room - Right",
                    items => items.KeySP && items.Hammer && items.Hookshot),
                new Location(this, 256+143, 0x1EAAF, 'Regular', "Swamp Palace - Waterfall Room",
                    items => items.KeySP && items.Hammer && items.Hookshot),
                new Location(this, 256+144, 0x308154, 'Regular', "Swamp Palace - Arrghus",
                    items => items.KeySP && items.Hammer && items.Hookshot),
            ];
        }

        CanEnter(items) {
            return items.MoonPearl && items.Mirror && items.Flippers && this.World.CanEnter("Dark this.World South", items);
        }

        CanComplete(items) {
            return this.GetLocation("Swamp Palace - Arrghus").Available(items);
        }
  }
  Zelda_SwampPalace.prototype.kind = 'SwampPalace';
  Zelda_SwampPalace.prototype.isIReward = true;
  // Zelda.SkullWoods
  class Zelda_SkullWoods extends Z3Region {

        get Name() { return "Skull Woods"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.KeySW, IT.BigKeySW, IT.MapSW, IT.CompassSW ];

            this.Locations = [
                new Location(this, 256+145, 0x1E9A1, 'Regular', "Skull Woods - Pot Prison"),
                new Location(this, 256+146, 0x1E992, 'Regular', "Skull Woods - Compass Chest"),
                new Location(this, 256+147, 0x1E998, 'Regular', "Skull Woods - Big Chest",
                    items => items.BigKeySW)
                    .AlwaysAllow((item, items) => item.Is(IT.BigKeySW, this.World)),
                new Location(this, 256+148, 0x1E99B, 'Regular', "Skull Woods - Map Chest"),
                new Location(this, 256+149, 0x1E9C8, 'Regular', "Skull Woods - Pinball Room")
                    .Allow((item, items) => item.Is(IT.KeySW, this.World)),
                new Location(this, 256+150, 0x1E99E, 'Regular', "Skull Woods - Big Key Chest"),
                new Location(this, 256+151, 0x1E9FE, 'Regular', "Skull Woods - Bridge Room",
                    items => items.Firerod),
                new Location(this, 256+152, 0x308155, 'Regular', "Skull Woods - Mothula",
                    items => items.Firerod && items.Sword && items.KeySW >= 3),
            ];
        }

        CanEnter(items) {
            return items.MoonPearl && this.World.CanEnter("Dark this.World North West", items);
        }

        CanComplete(items) {
            return this.GetLocation("Skull Woods - Mothula").Available(items);
        }
  }
  Zelda_SkullWoods.prototype.kind = 'SkullWoods';
  Zelda_SkullWoods.prototype.isIReward = true;
  // Zelda.ThievesTown
  class Zelda_ThievesTown extends Z3Region {

        get Name() { return "Thieves' Town"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.RegionItems = [ IT.KeyTT, IT.BigKeyTT, IT.MapTT, IT.CompassTT ];

            this.Locations = [
                new Location(this, 256+153, 0x1EA01, 'Regular', "Thieves' Town - Map Chest"),
                new Location(this, 256+154, 0x1EA0A, 'Regular', "Thieves' Town - Ambush Chest"),
                new Location(this, 256+155, 0x1EA07, 'Regular', "Thieves' Town - Compass Chest"),
                new Location(this, 256+156, 0x1EA04, 'Regular', "Thieves' Town - Big Key Chest"),
                new Location(this, 256+157, 0x1EA0D, 'Regular', "Thieves' Town - Attic",
                    items => items.BigKeyTT && items.KeyTT),
                new Location(this, 256+158, 0x1EA13, 'Regular', "Thieves' Town - Blind's Cell",
                    items => items.BigKeyTT),
                new Location(this, 256+159, 0x1EA10, 'Regular', "Thieves' Town - Big Chest",
                    items => items.BigKeyTT && items.Hammer &&
                        (this.GetLocation("Thieves' Town - Big Chest").ItemIs(IT.KeyTT, this.World) || items.KeyTT))
                    .AlwaysAllow((item, items) => item.Is(IT.KeyTT, this.World) && items.Hammer),
                new Location(this, 256+160, 0x308156, 'Regular', "Thieves' Town - Blind",
                    items => items.BigKeyTT && items.KeyTT && this.CanBeatBoss(items)),
            ];
        }

        CanBeatBoss(items) {
            return items.Sword || items.Hammer ||
                items.Somaria || items.Byrna;
        }

        CanEnter(items) {
            return items.MoonPearl && this.World.CanEnter("Dark this.World North West", items);
        }

        CanComplete(items) {
            return this.GetLocation("Thieves' Town - Blind").Available(items);
        }
  }
  Zelda_ThievesTown.prototype.kind = 'ThievesTown';
  Zelda_ThievesTown.prototype.isIReward = true;
  // Zelda.IcePalace
  class Zelda_IcePalace extends Z3Region {

        get Name() { return "Ice Palace"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Weight = 4;
            this.RegionItems = [ IT.KeyIP, IT.BigKeyIP, IT.MapIP, IT.CompassIP ];

            this.Locations = [
                new Location(this, 256+161, 0x1E9D4, 'Regular', "Ice Palace - Compass Chest"),
                new Location(this, 256+162, 0x1E9E0, 'Regular', "Ice Palace - Spike Room",
                    items => items.Hookshot || items.KeyIP >= 1 && this.CanNotWasteKeysBeforeAccessible(items, [
                        this.GetLocation("Ice Palace - Map Chest"),
                        this.GetLocation("Ice Palace - Big Key Chest")
                    ])),
                new Location(this, 256+163, 0x1E9DD, 'Regular', "Ice Palace - Map Chest",
                    items => items.Hammer && items.CanLiftLight() && (
                        items.Hookshot || items.KeyIP >= 1 && this.CanNotWasteKeysBeforeAccessible(items, [
                            this.GetLocation("Ice Palace - Spike Room"),
                            this.GetLocation("Ice Palace - Big Key Chest")
                        ])
                    )),
                new Location(this, 256+164, 0x1E9A4, 'Regular', "Ice Palace - Big Key Chest",
                    items => items.Hammer && items.CanLiftLight() && (
                        items.Hookshot || items.KeyIP >= 1 && this.CanNotWasteKeysBeforeAccessible(items, [
                            this.GetLocation("Ice Palace - Spike Room"),
                            this.GetLocation("Ice Palace - Map Chest")
                        ])
                    )),
                new Location(this, 256+165, 0x1E9E3, 'Regular', "Ice Palace - Iced T Room"),
                new Location(this, 256+166, 0x1E995, 'Regular', "Ice Palace - Freezor Chest"),
                new Location(this, 256+167, 0x1E9AA, 'Regular', "Ice Palace - Big Chest",
                    items => items.BigKeyIP),
                new Location(this, 256+168, 0x308157, 'Regular', "Ice Palace - Kholdstare",
                    items => items.BigKeyIP && items.Hammer && items.CanLiftLight() &&
                        items.KeyIP >= (items.Somaria ? 1 : 2)),
            ];
        }

        CanNotWasteKeysBeforeAccessible(items, locations) {
            return this.World.ForwardSearch || !items.BigKeyIP || locations.some(l => l.ItemIs(IT.BigKeyIP, this.World));
        }

        CanEnter(items) {
            return items.MoonPearl && items.Flippers && items.CanLiftHeavy() && items.CanMeltFreezors();
        }

        CanComplete(items) {
            return this.GetLocation("Ice Palace - Kholdstare").Available(items);
        }
  }
  Zelda_IcePalace.prototype.kind = 'IcePalace';
  Zelda_IcePalace.prototype.isIReward = true;
  // Zelda.MiseryMire
  class Zelda_MiseryMire extends Z3Region {

        get Name() { return "Misery Mire"; }

        
        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Medallion = null;
            this.Weight = 2;
            this.RegionItems = [ IT.KeyMM, IT.BigKeyMM, IT.MapMM, IT.CompassMM ];

            this.Locations = [
                new Location(this, 256+169, 0x1EA5E, 'Regular', "Misery Mire - Main Lobby",
                    items => items.BigKeyMM || items.KeyMM >= 1),
                new Location(this, 256+170, 0x1EA6A, 'Regular', "Misery Mire - Map Chest",
                    items => items.BigKeyMM || items.KeyMM >= 1),
                new Location(this, 256+171, 0x1EA61, 'Regular', "Misery Mire - Bridge Chest"),
                new Location(this, 256+172, 0x1E9DA, 'Regular', "Misery Mire - Spike Chest"),
                new Location(this, 256+173, 0x1EA64, 'Regular', "Misery Mire - Compass Chest",
                    items => items.CanLightTorches() &&
                        items.KeyMM >= (this.GetLocation("Misery Mire - Big Key Chest").ItemIs(IT.BigKeyMM, this.World) ? 2 : 3)),
                new Location(this, 256+174, 0x1EA6D, 'Regular', "Misery Mire - Big Key Chest",
                    items => items.CanLightTorches() &&
                        items.KeyMM >= (this.GetLocation("Misery Mire - Compass Chest").ItemIs(IT.BigKeyMM, this.World) ? 2 : 3)),
                new Location(this, 256+175, 0x1EA67, 'Regular', "Misery Mire - Big Chest",
                    items => items.BigKeyMM),
                new Location(this, 256+176, 0x308158, 'Regular', "Misery Mire - Vitreous",
                    items => items.BigKeyMM && items.Lamp && items.Somaria),
            ];
        }

        
        CanEnter(items) {
            return ((this.Medallion === Medallion.Bombos ? (items.Bombos) : (this.Medallion === Medallion.Ether ? (items.Ether) : (items.Quake)))) && items.Sword &&
                items.MoonPearl && (items.Boots || items.Hookshot) &&
                this.World.CanEnter("Dark this.World Mire", items);
        }

        CanComplete(items) {
            return this.GetLocation("Misery Mire - Vitreous").Available(items);
        }
  }
  Zelda_MiseryMire.prototype.kind = 'MiseryMire';
  Zelda_MiseryMire.prototype.isIReward = true;
  Zelda_MiseryMire.prototype.isIMedallionAccess = true;
  // Zelda.TurtleRock
  class Zelda_TurtleRock extends Z3Region {

        get Name() { return "Turtle Rock"; }

        
        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Medallion = null;
            this.Weight = 6;
            this.RegionItems = [ IT.KeyTR, IT.BigKeyTR, IT.MapTR, IT.CompassTR ];

            this.Locations = [
                new Location(this, 256+177, 0x1EA22, 'Regular', "Turtle Rock - Compass Chest"),
                new Location(this, 256+178, 0x1EA1C, 'Regular', "Turtle Rock - Roller Room - Left",
                    items => items.Firerod),
                new Location(this, 256+179, 0x1EA1F, 'Regular', "Turtle Rock - Roller Room - Right",
                    items => items.Firerod),
                new Location(this, 256+180, 0x1EA16, 'Regular', "Turtle Rock - Chain Chomps",
                    items => items.KeyTR >= 1),
                new Location(this, 256+181, 0x1EA25, 'Regular', "Turtle Rock - Big Key Chest",
                    items => items.KeyTR >=
                        (!this.Config.Keysanity || this.GetLocation("Turtle Rock - Big Key Chest").ItemIs(IT.BigKeyTR, this.World) ? 2 :
                            this.GetLocation("Turtle Rock - Big Key Chest").ItemIs(IT.KeyTR, this.World) ? 3 : 4))
                    .AlwaysAllow((item, items) => item.Is(IT.KeyTR, this.World) && items.KeyTR >= 3),
                new Location(this, 256+182, 0x1EA19, 'Regular', "Turtle Rock - Big Chest",
                    items => items.BigKeyTR && items.KeyTR >= 2)
                    .Allow((item, items) => item.IsNot(IT.BigKeyTR, this.World)),
                new Location(this, 256+183, 0x1EA34, 'Regular', "Turtle Rock - Crystaroller Room",
                    items => items.BigKeyTR && items.KeyTR >= 2),
                new Location(this, 256+184, 0x1EA28, 'Regular', "Turtle Rock - Eye Bridge - Top Right", (items) => this.LaserBridge(items)),
                new Location(this, 256+185, 0x1EA2B, 'Regular', "Turtle Rock - Eye Bridge - Top Left", (items) => this.LaserBridge(items)),
                new Location(this, 256+186, 0x1EA2E, 'Regular', "Turtle Rock - Eye Bridge - Bottom Right", (items) => this.LaserBridge(items)),
                new Location(this, 256+187, 0x1EA31, 'Regular', "Turtle Rock - Eye Bridge - Bottom Left", (items) => this.LaserBridge(items)),
                new Location(this, 256+188, 0x308159, 'Regular', "Turtle Rock - Trinexx",
                    items => items.BigKeyTR && items.KeyTR >= 4 && items.Lamp && this.CanBeatBoss(items)),
            ];
        }

        LaserBridge(items) {
            return items.BigKeyTR && items.KeyTR >= 3 && items.Lamp && (items.Cape || items.Byrna || items.CanBlockLasers);
        }

        CanBeatBoss(items) {
            return items.Firerod && items.Icerod;
        }

        CanEnter(items) {
            return ((this.Medallion === Medallion.Bombos ? (items.Bombos) : (this.Medallion === Medallion.Ether ? (items.Ether) : (items.Quake)))) && items.Sword &&
                items.MoonPearl && items.CanLiftHeavy() && items.Hammer && items.Somaria &&
                this.World.CanEnter("Light this.World Death Mountain East", items);
        }

        CanComplete(items) {
            return this.GetLocation("Turtle Rock - Trinexx").Available(items);
        }
  }
  Zelda_TurtleRock.prototype.kind = 'TurtleRock';
  Zelda_TurtleRock.prototype.isIReward = true;
  Zelda_TurtleRock.prototype.isIMedallionAccess = true;
  // Zelda.GanonsTower
  class Zelda_GanonsTower extends Z3Region {

        get Name() { return "Ganon's Tower"; }

        constructor(world, config) {
            super(world, config);
            this.RegionItems = [ IT.KeyGT, IT.BigKeyGT, IT.MapGT, IT.CompassGT ];

            this.Locations = [
                new Location(this, 256+189, 0x308161, 'Regular', "Ganon's Tower - Bob's Torch",
                    items => items.Boots),
                new Location(this, 256+190, 0x1EAB8, 'Regular', "Ganon's Tower - DMs Room - Top Left",
                    items => items.Hammer && items.Hookshot),
                new Location(this, 256+191, 0x1EABB, 'Regular', "Ganon's Tower - DMs Room - Top Right",
                    items => items.Hammer && items.Hookshot),
                new Location(this, 256+192, 0x1EABE, 'Regular', "Ganon's Tower - DMs Room - Bottom Left",
                    items => items.Hammer && items.Hookshot),
                new Location(this, 256+193, 0x1EAC1, 'Regular', "Ganon's Tower - DMs Room - Bottom Right",
                    items => items.Hammer && items.Hookshot),
                new Location(this, 256+194, 0x1EAD3, 'Regular', "Ganon's Tower - Map Chest",
                    items => items.Hammer && (items.Hookshot || items.Boots) && items.KeyGT >=
                        ([ IT.BigKeyGT, IT.KeyGT ].some(type => this.GetLocation("Ganon's Tower - Map Chest").ItemIs(type, this.World)) ? 3 : 4))
                    .AlwaysAllow((item, items) => item.Is(IT.KeyGT, this.World) && items.KeyGT >= 3),
                new Location(this, 256+195, 0x1EAD0, 'Regular', "Ganon's Tower - Firesnake Room",
                    items => items.Hammer && items.Hookshot && items.KeyGT >= ([
                            this.GetLocation("Ganon's Tower - Randomizer Room - Top Right"),
                            this.GetLocation("Ganon's Tower - Randomizer Room - Top Left"),
                            this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Left"),
                            this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Right")
                        ].some(l => l.ItemIs(IT.BigKeyGT, this.World)) ||
                        this.GetLocation("Ganon's Tower - Firesnake Room").ItemIs(IT.KeyGT, this.World) ? 2 : 3)),
                new Location(this, 256+230, 0x1EAC4, 'Regular', "Ganon's Tower - Randomizer Room - Top Left",
                    items => this.LeftSide(items, [
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Left"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Right")
                    ])),
                new Location(this, 256+231, 0x1EAC7, 'Regular', "Ganon's Tower - Randomizer Room - Top Right",
                    items => this.LeftSide(items, [
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Left"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Right")
                    ])),
                new Location(this, 256+232, 0x1EACA, 'Regular', "Ganon's Tower - Randomizer Room - Bottom Left",
                    items => this.LeftSide(items, [
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Right")
                    ])),
                new Location(this, 256+233, 0x1EACD, 'Regular', "Ganon's Tower - Randomizer Room - Bottom Right",
                    items => this.LeftSide(items, [
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Randomizer Room - Bottom Left")
                    ])),
                new Location(this, 256+234, 0x1EAD9, 'Regular', "Ganon's Tower - Hope Room - Left"),
                new Location(this, 256+235, 0x1EADC, 'Regular', "Ganon's Tower - Hope Room - Right"),
                new Location(this, 256+236, 0x1EAE2, 'Regular', "Ganon's Tower - Tile Room",
                    items => items.Somaria),
                new Location(this, 256+203, 0x1EAE5, 'Regular', "Ganon's Tower - Compass Room - Top Left",
                    items => this.RightSide(items, [
                        this.GetLocation("Ganon's Tower - Compass Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Left"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Right")
                    ])),
                new Location(this, 256+204, 0x1EAE8, 'Regular', "Ganon's Tower - Compass Room - Top Right",
                    items => this.RightSide(items, [
                        this.GetLocation("Ganon's Tower - Compass Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Left"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Right")
                    ])),
                new Location(this, 256+205, 0x1EAEB, 'Regular', "Ganon's Tower - Compass Room - Bottom Left",
                    items => this.RightSide(items, [
                        this.GetLocation("Ganon's Tower - Compass Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Compass Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Right")
                    ])),
                new Location(this, 256+206, 0x1EAEE, 'Regular', "Ganon's Tower - Compass Room - Bottom Right",
                    items => this.RightSide(items, [
                        this.GetLocation("Ganon's Tower - Compass Room - Top Right"),
                        this.GetLocation("Ganon's Tower - Compass Room - Top Left"),
                        this.GetLocation("Ganon's Tower - Compass Room - Bottom Left")
                    ])),
                new Location(this, 256+207, 0x1EADF, 'Regular', "Ganon's Tower - Bob's Chest",
                    items => items.KeyGT >= 3 && (
                        items.Hammer && items.Hookshot ||
                        items.Somaria && items.Firerod)),
                new Location(this, 256+208, 0x1EAD6, 'Regular', "Ganon's Tower - Big Chest",
                    items => items.BigKeyGT && items.KeyGT >= 3 && (
                        items.Hammer && items.Hookshot ||
                        items.Somaria && items.Firerod))
                    .Allow((item, items) => item.IsNot(IT.BigKeyGT, this.World)),
                new Location(this, 256+209, 0x1EAF1, 'Regular', "Ganon's Tower - Big Key Chest", (items) => this.BigKeyRoom(items)),
                new Location(this, 256+210, 0x1EAF4, 'Regular', "Ganon's Tower - Big Key Room - Left", (items) => this.BigKeyRoom(items)),
                new Location(this, 256+211, 0x1EAF7, 'Regular', "Ganon's Tower - Big Key Room - Right", (items) => this.BigKeyRoom(items)),
                new Location(this, 256+212, 0x1EAFD, 'Regular', "Ganon's Tower - Mini Helmasaur Room - Left", (items) => this.TowerAscend(items))
                    .Allow((item, items) => item.IsNot(IT.BigKeyGT, this.World)),
                new Location(this, 256+213, 0x1EB00, 'Regular', "Ganon's Tower - Mini Helmasaur Room - Right", (items) => this.TowerAscend(items))
                    .Allow((item, items) => item.IsNot(IT.BigKeyGT, this.World)),
                new Location(this, 256+214, 0x1EB03, 'Regular', "Ganon's Tower - Pre-Moldorm Chest", (items) => this.TowerAscend(items))
                    .Allow((item, items) => item.IsNot(IT.BigKeyGT, this.World)),
                new Location(this, 256+215, 0x1EB06, 'Regular', "Ganon's Tower - Moldorm Chest",
                    items => items.BigKeyGT && items.KeyGT >= 4 &&
                        items.Bow && items.CanLightTorches() &&
                        this.CanBeatMoldorm(items) && items.Hookshot)
                    .Allow((item, items) => [ IT.KeyGT, IT.BigKeyGT ].every(type => item.IsNot(type, this.World))),
            ];
        }

        LeftSide(items, locations) {
            return items.Hammer && items.Hookshot && items.KeyGT >= (locations.some(l => l.ItemIs(IT.BigKeyGT, this.World)) ? 3 : 4);
        }

        RightSide(items, locations) {
            return items.Somaria && items.Firerod && items.KeyGT >= (locations.some(l => l.ItemIs(IT.BigKeyGT, this.World)) ? 3 : 4);
        }

        BigKeyRoom(items) {
            return items.KeyGT >= 3 && (
                items.Hammer && items.Hookshot ||
                items.Firerod && items.Somaria
            ) && this.CanBeatArmos(items);
        }

        TowerAscend(items) {
            return items.BigKeyGT && items.KeyGT >= 3 && items.Bow && items.CanLightTorches();
        }

        CanBeatArmos(items) {
            return items.Sword || items.Hammer || items.Bow ||
                items.CanExtendMagic(2) && (items.Somaria || items.Byrna) ||
                items.CanExtendMagic(4) && (items.Firerod || items.Icerod);
        }

        CanBeatMoldorm(items) {
            return items.Sword || items.Hammer;
        }

        CanEnter(items) {
            return items.MoonPearl && this.World.CanEnter("Dark this.World Death Mountain East", items) &&
                this.World.CanAcquireAtLeast(this.World.TowerCrystals, items, RewardType.AnyCrystal) &&
                this.World.CanAcquireAtLeast(Math.trunc((this.World.TourianBossTokens * this.World.TowerCrystals) / 7), items, RewardType.AnyBossToken);
        }

        CanFill(item, items) {
            if (this.Config.MultiWorld) {
                if (item.World != this.World || item.Progression) {
                    return false;
                }

                if (this.Config.Keysanity && !((item.Type == IT.BigKeyGT || item.Type == IT.KeyGT) && item.World == this.World) && (item.IsKey || item.IsBigKey || item.IsKeycard)) {
                    return false;
                }
            }

            return super.CanFill(item, items);
        }
  }
  Zelda_GanonsTower.prototype.kind = 'GanonsTower';
  // Zelda.LightWorld.DeathMountain.West
  class Zelda_LightWorld_DeathMountain_West extends Z3Region {

        get Name() { return "Light this.World Death Mountain West"; }
        get Area() { return "Death Mountain"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+0, 0x308016, 'Ether', "Ether Tablet",
                    items => items.Book && items.MasterSword && (items.Mirror || items.Hammer && items.Hookshot)),
                new Location(this, 256+1, 0x308140, 'Regular', "Spectacle Rock",
                    items => items.Mirror),
                new Location(this, 256+2, 0x308002, 'Regular', "Spectacle Rock Cave"),
                new Location(this, 256+3, 0x1EE9FA, 'Regular', "Old Man",
                    items => items.Lamp),
            ];
        }

        CanEnter(items) {
            return items.Flute || items.CanLiftLight() && items.Lamp || items.CanAccessDeathMountainPortal();
        }
  }
  Zelda_LightWorld_DeathMountain_West.prototype.kind = 'West';
  // Zelda.LightWorld.DeathMountain.East
  class Zelda_LightWorld_DeathMountain_East extends Z3Region {

        get Name() { return "Light this.World Death Mountain East"; }
        get Area() { return "Death Mountain"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+4, 0x308141, 'Regular', "Floating Island",
                    items => items.Mirror && items.MoonPearl && items.CanLiftHeavy()),
                new Location(this, 256+5, 0x1E9BF, 'Regular', "Spiral Cave"),
                new Location(this, 256+6, 0x1EB39, 'Regular', "Paradox Cave Upper - Left"),
                new Location(this, 256+7, 0x1EB3C, 'Regular', "Paradox Cave Upper - Right"),
                new Location(this, 256+8, 0x1EB2A, 'Regular', "Paradox Cave Lower - Far Left"),
                new Location(this, 256+9, 0x1EB2D, 'Regular', "Paradox Cave Lower - Left"),
                new Location(this, 256+10, 0x1EB36, 'Regular', "Paradox Cave Lower - Middle"),
                new Location(this, 256+11, 0x1EB30, 'Regular', "Paradox Cave Lower - Right"),
                new Location(this, 256+12, 0x1EB33, 'Regular', "Paradox Cave Lower - Far Right"),
                new Location(this, 256+13, 0x1E9C5, 'Regular', "Mimic Cave",
                    items => items.Mirror && items.KeyTR >= 2 && this.World.CanEnter("Turtle Rock", items)),
            ];
        }

        CanEnter(items) {
            return this.World.CanEnter("Light this.World Death Mountain West", items) && (
                items.Hammer && items.Mirror ||
                items.Hookshot
            );
        }
  }
  Zelda_LightWorld_DeathMountain_East.prototype.kind = 'East';
  // Zelda.LightWorld.NorthWest
  class Zelda_LightWorld_NorthWest extends Z3Region {

        get Name() { return "Light this.World North West"; }
        get Area() { return "Light this.World"; }

        constructor(world, config) {
            super(world, config);
            const sphereOne = -14;
            this.Locations = [
                new Location(this, 256+14, 0x589B0, 'Pedestal', "Master Sword Pedestal",
                    items => this.World.CanAcquireAll(items, RewardType.AnyPendant)),
                new Location(this, 256+15, 0x308013, 'Regular', "Mushroom").Weighted(sphereOne),
                new Location(this, 256+16, 0x308000, 'Regular', "Lost Woods Hideout").Weighted(sphereOne),
                new Location(this, 256+17, 0x308001, 'Regular', "Lumberjack Tree",
                    items => this.World.CanAcquire(items, RewardType.Agahnim) && items.Boots),
                new Location(this, 256+18, 0x1EB3F, 'Regular', "Pegasus Rocks",
                    items => items.Boots),
                new Location(this, 256+19, 0x308004, 'Regular', "Graveyard Ledge",
                    items => items.Mirror && items.MoonPearl && this.World.CanEnter("Dark this.World North West", items)),
                new Location(this, 256+20, 0x1E97A, 'Regular', "King's Tomb",
                    items => items.Boots && (
                        items.CanLiftHeavy() ||
                        items.Mirror && items.MoonPearl && this.World.CanEnter("Dark this.World North West", items))),
                new Location(this, 256+21, 0x1EA8E, 'Regular', "Kakariko Well - Top").Weighted(sphereOne),
                new Location(this, 256+22, 0x1EA91, 'Regular', "Kakariko Well - Left").Weighted(sphereOne),
                new Location(this, 256+23, 0x1EA94, 'Regular', "Kakariko Well - Middle").Weighted(sphereOne),
                new Location(this, 256+24, 0x1EA97, 'Regular', "Kakariko Well - Right").Weighted(sphereOne),
                new Location(this, 256+25, 0x1EA9A, 'Regular', "Kakariko Well - Bottom").Weighted(sphereOne),
                new Location(this, 256+26, 0x1EB0F, 'Regular', "Blind's Hideout - Top").Weighted(sphereOne),
                new Location(this, 256+27, 0x1EB18, 'Regular', "Blind's Hideout - Far Left").Weighted(sphereOne),
                new Location(this, 256+28, 0x1EB12, 'Regular', "Blind's Hideout - Left").Weighted(sphereOne),
                new Location(this, 256+29, 0x1EB15, 'Regular', "Blind's Hideout - Right").Weighted(sphereOne),
                new Location(this, 256+30, 0x1EB1B, 'Regular', "Blind's Hideout - Far Right").Weighted(sphereOne),
                new Location(this, 256+31, 0x5EB18, 'Regular', "Bottle Merchant").Weighted(sphereOne),
                new Location(this, 256+250, 0x1E9E9, 'Regular', "Chicken House").Weighted(sphereOne),
                new Location(this, 256+33, 0x6B9CF, 'Regular', "Sick Kid",
                    items => items.Bottle),
                new Location(this, 256+34, 0x1E9CE, 'Regular', "Kakariko Tavern").Weighted(sphereOne),
                new Location(this, 256+35, 0x308015, 'Regular', "Magic Bat",
                    items => items.Powder && (items.Hammer || items.MoonPearl && items.Mirror && items.CanLiftHeavy())),
            ];
        }
  }
  Zelda_LightWorld_NorthWest.prototype.kind = 'NorthWest';
  // Zelda.LightWorld.NorthEast
  class Zelda_LightWorld_NorthEast extends Z3Region {

        get Name() { return "Light this.World North East"; }
        get Area() { return "Light this.World"; }

        constructor(world, config) {
            super(world, config);
            const sphereOne = -10;
            this.Locations = [
                new Location(this, 256+36, 0x1DE1C3, 'Regular', "King Zora",
                    items => items.CanLiftLight() || items.Flippers),
                new Location(this, 256+37, 0x308149, 'Regular', "Zora's Ledge",
                    items => items.Flippers),
                new Location(this, 256+254, 0x1E9B0, 'Regular', "Waterfall Fairy - Left",
                    items => items.Flippers),
                new Location(this, 256+39, 0x1E9D1, 'Regular', "Waterfall Fairy - Right",
                    items => items.Flippers),
                new Location(this, 256+40, 0x308014, 'Regular', "Potion Shop",
                    items => items.Mushroom),
                new Location(this, 256+41, 0x1EA82, 'Regular', "Sahasrahla's Hut - Left").Weighted(sphereOne),
                new Location(this, 256+42, 0x1EA85, 'Regular', "Sahasrahla's Hut - Middle").Weighted(sphereOne),
                new Location(this, 256+43, 0x1EA88, 'Regular', "Sahasrahla's Hut - Right").Weighted(sphereOne),
                new Location(this, 256+44, 0x5F1FC, 'Regular', "Sahasrahla",
                    items => this.World.CanAcquire(items, RewardType.PendantGreen)),
            ];
        }
  }
  Zelda_LightWorld_NorthEast.prototype.kind = 'NorthEast';
  // Zelda.LightWorld.South
  class Zelda_LightWorld_South extends Z3Region {

        get Name() { return "Light this.World South"; }
        get Area() { return "Light this.World"; }

        constructor(world, config) {
            super(world, config);
            const sphereOne = -10;
            this.Locations = [
                new Location(this, 256+45, 0x308142, 'Regular', "Maze Race").Weighted(sphereOne),
                new Location(this, 256+240, 0x308012, 'Regular', "Library",
                    items => items.Boots),
                new Location(this, 256+241, 0x30814A, 'Regular', "Flute Spot",
                    items => items.Shovel),
                new Location(this, 256+242, 0x308003, 'Regular', "South of Grove",
                    items => items.Mirror && this.World.CanEnter("Dark this.World South", items)),
                new Location(this, 256+243, 0x1E9BC, 'Regular', "Link's House").Weighted(sphereOne),
                new Location(this, 256+244, 0x1E9F2, 'Regular', "Aginah's Cave").Weighted(sphereOne),
                new Location(this, 256+51, 0x1EB42, 'Regular', "Mini Moldorm Cave - Far Left").Weighted(sphereOne),
                new Location(this, 256+52, 0x1EB45, 'Regular', "Mini Moldorm Cave - Left").Weighted(sphereOne),
                new Location(this, 256+53, 0x308010, 'Regular', "Mini Moldorm Cave - NPC").Weighted(sphereOne),
                new Location(this, 256+54, 0x1EB48, 'Regular', "Mini Moldorm Cave - Right").Weighted(sphereOne),
                new Location(this, 256+251, 0x1EB4B, 'Regular', "Mini Moldorm Cave - Far Right").Weighted(sphereOne),
                new Location(this, 256+252, 0x308143, 'Regular', "Desert Ledge",
                    items => this.World.CanEnter("Desert Palace", items)),
                new Location(this, 256+253, 0x308005, 'Regular', "Checkerboard Cave",
                    items => items.Mirror && (
                        items.Flute && items.CanLiftHeavy() ||
                        items.CanAccessMiseryMirePortal(this.Config)
                    ) && items.CanLiftLight()),
                new Location(this, 256+58, 0x308017, 'Bombos', "Bombos Tablet",
                    items => items.Book && items.MasterSword && items.Mirror && this.World.CanEnter("Dark this.World South", items)),
                new Location(this, 256+59, 0x1E98C, 'Regular', "Floodgate Chest").Weighted(sphereOne),
                new Location(this, 256+60, 0x308145, 'Regular', "Sunken Treasure").Weighted(sphereOne),
                new Location(this, 256+61, 0x308144, 'Regular', "Lake Hylia Island",
                    items => items.Flippers && items.MoonPearl && items.Mirror && (
                        this.World.CanEnter("Dark this.World South", items) ||
                        this.World.CanEnter("Dark this.World North East", items))),
                new Location(this, 256+62, 0x6BE7D, 'Regular', "Hobo",
                    items => items.Flippers),
                new Location(this, 256+63, 0x1EB4E, 'Regular', "Ice Rod Cave").Weighted(sphereOne),
            ];

        }
  }
  Zelda_LightWorld_South.prototype.kind = 'South';
  // Zelda.HyruleCastle
  class Zelda_HyruleCastle extends Z3Region {

        get Name() { return "Hyrule Castle"; }

        constructor(world, config) {
            super(world, config);
            this.RegionItems = [ IT.KeyHC, IT.MapHC ];

            const sphereOne = -10;
            this.Locations = [
                new Location(this, 256+91, 0x1EA79, 'Regular', "Sanctuary").Weighted(sphereOne),
                new Location(this, 256+92, 0x1EB5D, 'Regular', "Sewers - Secret Room - Left",
                    items => items.CanLiftLight() || items.Lamp && items.KeyHC),
                new Location(this, 256+93, 0x1EB60, 'Regular', "Sewers - Secret Room - Middle",
                    items => items.CanLiftLight() || items.Lamp && items.KeyHC),
                new Location(this, 256+94, 0x1EB63, 'Regular', "Sewers - Secret Room - Right",
                    items => items.CanLiftLight() || items.Lamp && items.KeyHC),
                new Location(this, 256+95, 0x1E96E, 'Regular', "Sewers - Dark Cross",
                    items => items.Lamp),
                new Location(this, 256+96, 0x1EB0C, 'Regular', "Hyrule Castle - Map Chest").Weighted(sphereOne),
                new Location(this, 256+97, 0x1E974, 'Regular', "Hyrule Castle - Boomerang Chest",
                    items => items.KeyHC).Weighted(sphereOne),
                new Location(this, 256+98, 0x1EB09, 'Regular', "Hyrule Castle - Zelda's Cell",
                    items => items.KeyHC).Weighted(sphereOne),
                new Location(this, 256+99, 0x5DF45, 'NotInDungeon', "Link's Uncle")
                    .Allow((item, items) => this.Config.Keysanity || !item.IsDungeonItem).Weighted(sphereOne),
                new Location(this, 256+100, 0x1E971, 'NotInDungeon', "Secret Passage")
                    .Allow((item, items) => this.Config.Keysanity || !item.IsDungeonItem).Weighted(sphereOne),
            ];
        }
  }
  Zelda_HyruleCastle.prototype.kind = 'HyruleCastle';
  // Zelda.DarkWorld.DeathMountain.West
  class Zelda_DarkWorld_DeathMountain_West extends Z3Region {

        get Name() { return "Dark this.World Death Mountain West"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+64, 0x1EA8B, 'Regular', "Spike Cave",
                    items => items.MoonPearl && items.Hammer && items.CanLiftLight() &&
                        (items.CanExtendMagic() && items.Cape || items.Byrna) &&
                        this.World.CanEnter("Light this.World Death Mountain West", items)),
            ];
        }
  }
  Zelda_DarkWorld_DeathMountain_West.prototype.kind = 'West';
  // Zelda.DarkWorld.DeathMountain.East
  class Zelda_DarkWorld_DeathMountain_East extends Z3Region {

        get Name() { return "Dark this.World Death Mountain East"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+65, 0x1EB51, 'Regular', "Hookshot Cave - Top Right",
                    items => items.MoonPearl && items.Hookshot),
                new Location(this, 256+66, 0x1EB54, 'Regular', "Hookshot Cave - Top Left",
                    items => items.MoonPearl && items.Hookshot),
                new Location(this, 256+67, 0x1EB57, 'Regular', "Hookshot Cave - Bottom Left",
                    items => items.MoonPearl && items.Hookshot),
                new Location(this, 256+68, 0x1EB5A, 'Regular', "Hookshot Cave - Bottom Right",
                    items => items.MoonPearl && (items.Hookshot || items.Boots)),
                new Location(this, 256+69, 0x1EA7C, 'Regular', "Superbunny Cave - Top",
                    items => items.MoonPearl),
                new Location(this, 256+70, 0x1EA7F, 'Regular', "Superbunny Cave - Bottom",
                    items => items.MoonPearl),
            ];
        }

        CanEnter(items) {
            return items.CanLiftHeavy() && this.World.CanEnter("Light this.World Death Mountain East", items);
        }
  }
  Zelda_DarkWorld_DeathMountain_East.prototype.kind = 'East';
  // Zelda.DarkWorld.NorthWest
  class Zelda_DarkWorld_NorthWest extends Z3Region {

        get Name() { return "Dark this.World North West"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+71, 0x308146, 'Regular', "Bumper Cave",
                    items => items.CanLiftLight() && items.Cape),
                new Location(this, 256+72, 0x1EDA8, 'Regular', "Chest Game"),
                new Location(this, 256+73, 0x1E9EF, 'Regular', "C-Shaped House"),
                new Location(this, 256+74, 0x1E9EC, 'Regular', "Brewery"),
                new Location(this, 256+75, 0x308006, 'Regular', "Hammer Pegs",
                    items => items.CanLiftHeavy() && items.Hammer),
                new Location(this, 256+76, 0x30802A, 'Regular', "Blacksmith",
                    items => items.CanLiftHeavy()),
                new Location(this, 256+77, 0x6BD68, 'Regular', "Purple Chest",
                    items => items.CanLiftHeavy()),
            ];
        }

        CanEnter(items) {
            return items.MoonPearl && ((
                    this.World.CanAcquire(items, RewardType.Agahnim) ||
                    items.CanAccessDarkWorldPortal(this.Config) && items.Flippers
                ) && items.Hookshot && (items.Flippers || items.CanLiftLight() || items.Hammer) ||
                items.Hammer && items.CanLiftLight() ||
                items.CanLiftHeavy()
            );
        }
  }
  Zelda_DarkWorld_NorthWest.prototype.kind = 'NorthWest';
  // Zelda.DarkWorld.NorthEast
  class Zelda_DarkWorld_NorthEast extends Z3Region {

        get Name() { return "Dark this.World North East"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+78, 0x1DE185, 'Regular', "Catfish",
                    items => items.MoonPearl && items.CanLiftLight()),
                new Location(this, 256+79, 0x308147, 'Regular', "Pyramid"),
                new Location(this, 256+80, 0x1E980, 'Regular', "Pyramid Fairy - Left",
                    items => this.World.CanAcquireAll(items, RewardType.CrystalRed) && items.MoonPearl && this.World.CanEnter("Dark this.World South", items) &&
                        (items.Hammer || items.Mirror && this.World.CanAcquire(items, RewardType.Agahnim))),
                new Location(this, 256+81, 0x1E983, 'Regular', "Pyramid Fairy - Right",
                    items => this.World.CanAcquireAll(items, RewardType.CrystalRed) && items.MoonPearl && this.World.CanEnter("Dark this.World South", items) &&
                        (items.Hammer || items.Mirror && this.World.CanAcquire(items, RewardType.Agahnim)))
            ];
        }

        CanEnter(items) {
            return this.World.CanAcquire(items, RewardType.Agahnim) || items.MoonPearl && (
                items.Hammer && items.CanLiftLight() ||
                items.CanLiftHeavy() && items.Flippers ||
                items.CanAccessDarkWorldPortal(this.Config) && items.Flippers
            );
        }
  }
  Zelda_DarkWorld_NorthEast.prototype.kind = 'NorthEast';
  // Zelda.DarkWorld.South
  class Zelda_DarkWorld_South extends Z3Region {

        get Name() { return "Dark this.World South"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+82, 0x308148, 'Regular', "Digging Game"),
                new Location(this, 256+83, 0x6B0C7, 'Regular', "Stumpy"),
                new Location(this, 256+84, 0x1EB1E, 'Regular', "Hype Cave - Top"),
                new Location(this, 256+85, 0x1EB21, 'Regular', "Hype Cave - Middle Right"),
                new Location(this, 256+86, 0x1EB24, 'Regular', "Hype Cave - Middle Left"),
                new Location(this, 256+87, 0x1EB27, 'Regular', "Hype Cave - Bottom"),
                new Location(this, 256+88, 0x308011, 'Regular', "Hype Cave - NPC"),
            ];
        }

        CanEnter(items) {
            return items.MoonPearl && ((
                    this.World.CanAcquire(items, RewardType.Agahnim) ||
                    items.CanAccessDarkWorldPortal(this.Config) && items.Flippers
                ) && (items.Hammer || items.Hookshot && (items.Flippers || items.CanLiftLight())) ||
                items.Hammer && items.CanLiftLight() ||
                items.CanLiftHeavy()
            );
        }
  }
  Zelda_DarkWorld_South.prototype.kind = 'South';
  // Zelda.DarkWorld.Mire
  class Zelda_DarkWorld_Mire extends Z3Region {

        get Name() { return "Dark this.World Mire"; }
        get Area() { return "Dark this.World"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 256+89, 0x1EA73, 'Regular', "Mire Shed - Left",
                    items => items.MoonPearl),
                new Location(this, 256+90, 0x1EA76, 'Regular', "Mire Shed - Right",
                    items => items.MoonPearl),
            ];
        }

        CanEnter(items) {
            return items.Flute && items.CanLiftHeavy() || items.CanAccessMiseryMirePortal(this.Config);
        }
  }
  Zelda_DarkWorld_Mire.prototype.kind = 'Mire';
  // SuperMetroid.Crateria.West
  class SuperMetroid_Crateria_West extends SMRegion {

        get Name() { return "Crateria West"; }
        get Area() { return "Crateria"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 8, 0x8F8432, 'Visible', "Energy Tank, Terminator"),
                new Location(this, 5, 0x8F8264, 'Visible', "Energy Tank, Gauntlet", ((this.Logic === SMLogic.Normal ? (items => this.CanEnterAndLeaveGauntlet(items) && items.HasEnergyReserves(1)) : ((items => this.CanEnterAndLeaveGauntlet(items)))))),
                new Location(this, 9, 0x8F8464, 'Visible', "Missile (Crateria gauntlet right)", ((this.Logic === SMLogic.Normal ? (items => this.CanEnterAndLeaveGauntlet(items) && items.CanPassBombPassages() && items.HasEnergyReserves(2)) : ((items => this.CanEnterAndLeaveGauntlet(items) && items.CanPassBombPassages()))))),
                new Location(this, 10, 0x8F846A, 'Visible', "Missile (Crateria gauntlet left)", ((this.Logic === SMLogic.Normal ? (items => this.CanEnterAndLeaveGauntlet(items) && items.CanPassBombPassages() && items.HasEnergyReserves(2)) : ((items => this.CanEnterAndLeaveGauntlet(items) && items.CanPassBombPassages())))))
            ];
        }

        CanEnter(items) {
            return items.CanDestroyBombWalls() || items.SpeedBooster;
        }

        CanEnterAndLeaveGauntlet(items) {
            return ((this.Logic === SMLogic.Normal ? (items.CardCrateriaL1 && items.Morph && (items.CanFly() || items.SpeedBooster) && (
                        items.CanIbj() ||
                        items.CanUsePowerBombs() && items.TwoPowerBombs ||
                        items.ScrewAttack
                    )) : (items.CardCrateriaL1 && (
                        items.Morph && (items.Bombs || items.TwoPowerBombs) ||
                        items.ScrewAttack ||
                        items.SpeedBooster && items.CanUsePowerBombs() && items.HasEnergyReserves(2)
                    ))));
        }
  }
  SuperMetroid_Crateria_West.prototype.kind = 'West';
  // SuperMetroid.Crateria.Central
  class SuperMetroid_Crateria_Central extends SMRegion {

        get Name() { return "Crateria Central"; }
        get Area() { return "Crateria"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 0, 0x8F81CC, 'Visible', "Power Bomb (Crateria surface)", (((items => (config.Keysanity ? items.CardCrateriaL1 : items.CanUsePowerBombs()) && (items.SpeedBooster || items.CanFly()))))),
                new Location(this, 12, 0x8F8486, 'Visible', "Missile (Crateria middle)", (((items => items.CanPassBombPassages())))),
                new Location(this, 6, 0x8F83EE, 'Visible', "Missile (Crateria bottom)", (((items => items.CanDestroyBombWalls())))),
                new Location(this, 11, 0x8F8478, 'Visible', "Super Missile (Crateria)", (((items => items.CanUsePowerBombs() && items.HasEnergyReserves(2) && items.SpeedBooster)))),
                new Location(this, 7, 0x8F8404, 'Chozo', "Bombs", ((this.Logic === SMLogic.Normal ? (items => (config.Keysanity ? items.CardCrateriaBoss : items.CanOpenRedDoors()) && items.CanPassBombPassages()) : ((items => (config.Keysanity ? items.CardCrateriaBoss : items.CanOpenRedDoors()) && items.Morph)))))
            ];
        }
  }
  SuperMetroid_Crateria_Central.prototype.kind = 'Central';
  // SuperMetroid.Crateria.East
  class SuperMetroid_Crateria_East extends SMRegion {

        get Name() { return "Crateria East"; }
        get Area() { return "Crateria"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 1, 0x8F81E8, 'Visible', "Missile (outside Wrecked Ship bottom)", ((this.Logic === SMLogic.Normal ? (items => items.Morph && (
                        items.SpeedBooster || items.Grapple || items.SpaceJump ||
                        items.Gravity && (items.CanIbj() || items.HiJump) ||
                        this.World.CanEnter("Wrecked Ship", items)
                    )) : ((items => items.Morph))))),
                new Location(this, 2, 0x8F81EE, 'Hidden', "Missile (outside Wrecked Ship top)", (((items => this.World.CanEnter("Wrecked Ship", items) && items.CardWreckedShipBoss && items.CanPassBombPassages())))),
                new Location(this, 3, 0x8F81F4, 'Visible', "Missile (outside Wrecked Ship middle)", (((items => this.World.CanEnter("Wrecked Ship", items) && items.CardWreckedShipBoss && items.CanPassBombPassages())))),
                new Location(this, 4, 0x8F8248, 'Visible', "Missile (Crateria moat)", (((items => true)))),
            ];
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? ((this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) && items.Super ||
                    
                    (this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) && items.CanAccessNorfairUpperPortal() &&
                        (items.Ice || items.HiJump || items.SpaceJump) ||
                    
                    items.CanAccessMaridiaPortal(this.World) && items.Gravity && items.Super && (
                        
                        items.CardMaridiaL2 && items.CanDestroyBombWalls() ||
                        
                        this.World.GetLocation("Space Jump").Available(items)
                    ) ||
                    
                    items.CanUsePowerBombs() && items.Super && items.Gravity) : ((this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) && items.Super ||
                    
                    (this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) && items.CanAccessNorfairUpperPortal() &&
                        (items.Ice || items.HiJump || items.CanFly() || items.CanSpringBallJump()) ||
                    
                    items.CanAccessMaridiaPortal(this.World) && (
                        
                        items.CardMaridiaL2 && items.Super && (
                            items.HiJump && items.CanPassBombPassages() ||
                            items.Gravity && items.CanDestroyBombWalls()
                        ) ||
                        
                        items.Gravity && this.World.GetLocation("Space Jump").Available(items)
                    ) ||
                    
                    items.CanUsePowerBombs() && items.Super && (
                        items.Gravity ||
                        items.HiJump && (items.Ice || items.CanSpringBallJump()) && items.Grapple && items.CardMaridiaL1
                    ))));
        }
  }
  SuperMetroid_Crateria_East.prototype.kind = 'East';
  // SuperMetroid.Brinstar.Blue
  class SuperMetroid_Brinstar_Blue extends SMRegion {

        get Name() { return "Brinstar Blue"; }
        get Area() { return "Brinstar"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 26, 0x8F86EC, 'Visible', "Morphing Ball"),
                new Location(this, 27, 0x8F874C, 'Visible', "Power Bomb (blue Brinstar)", (((items => items.CanUsePowerBombs())))),
                new Location(this, 28, 0x8F8798, 'Visible', "Missile (blue Brinstar middle)", (((items => items.CardBrinstarL1 && items.Morph)))),
                new Location(this, 29, 0x8F879E, 'Hidden', "Energy Tank, Brinstar Ceiling", ((this.Logic === SMLogic.Normal ? (items => items.CardBrinstarL1 && (items.CanFly() || items.HiJump || items.SpeedBooster || items.Ice)) : ((items => items.CardBrinstarL1))))),
                new Location(this, 34, 0x8F8802, 'Chozo', "Missile (blue Brinstar bottom)", (((items => items.Morph)))),
                new Location(this, 36, 0x8F8836, 'Visible', "Missile (blue Brinstar top)", (((items => items.CardBrinstarL1 && items.CanUsePowerBombs())))),
                new Location(this, 37, 0x8F883C, 'Hidden', "Missile (blue Brinstar behind missile)", (((items => items.CardBrinstarL1 && items.CanUsePowerBombs())))),
            ];
        }
  }
  SuperMetroid_Brinstar_Blue.prototype.kind = 'Blue';
  // SuperMetroid.Brinstar.Green
  class SuperMetroid_Brinstar_Green extends SMRegion {

        get Name() { return "Brinstar Green"; }
        get Area() { return "Brinstar"; }

        constructor(world, config) {
            super(world, config);
            this.Weight = -6;

            this.Locations = [
                new Location(this, 13, 0x8F84AC, 'Chozo', "Power Bomb (green Brinstar bottom)", (((items => items.CardBrinstarL2 && items.CanUsePowerBombs())))),
                new Location(this, 15, 0x8F8518, 'Visible', "Missile (green Brinstar below super missile)", (((items => items.CanPassBombPassages() && items.CanOpenRedDoors())))),
                new Location(this, 16, 0x8F851E, 'Visible', "Super Missile (green Brinstar top)", ((this.Logic === SMLogic.Normal ? (items => items.CanOpenRedDoors() && items.SpeedBooster) : ((items => items.CanOpenRedDoors() && (items.Morph || items.SpeedBooster)))))),
                new Location(this, 17, 0x8F852C, 'Chozo', "Reserve Tank, Brinstar", ((this.Logic === SMLogic.Normal ? (items => items.CanOpenRedDoors() && items.SpeedBooster) : ((items => items.CanOpenRedDoors() && (items.Morph || items.SpeedBooster)))))),
                new Location(this, 18, 0x8F8532, 'Hidden', "Missile (green Brinstar behind missile)", ((this.Logic === SMLogic.Normal ? (items => items.SpeedBooster && items.CanPassBombPassages() && items.CanOpenRedDoors()) : ((items => (items.CanPassBombPassages() || items.Morph && items.ScrewAttack) && items.CanOpenRedDoors()))))),
                new Location(this, 19, 0x8F8538, 'Visible', "Missile (green Brinstar behind reserve tank)", ((this.Logic === SMLogic.Normal ? (items => items.SpeedBooster && items.CanOpenRedDoors() && items.Morph) : ((items => items.CanOpenRedDoors() && items.Morph))))),
                new Location(this, 30, 0x8F87C2, 'Visible', "Energy Tank, Etecoons", (((items => items.CardBrinstarL2 && items.CanUsePowerBombs())))),
                new Location(this, 31, 0x8F87D0, 'Visible', "Super Missile (green Brinstar bottom)", (((items => items.CardBrinstarL2 && items.CanUsePowerBombs() && items.Super)))),
            ];
        }

        CanEnter(items) {
            return items.CanDestroyBombWalls() || items.SpeedBooster;
        }
  }
  SuperMetroid_Brinstar_Green.prototype.kind = 'Green';
  // SuperMetroid.Brinstar.Pink
  class SuperMetroid_Brinstar_Pink extends SMRegion {

        get Name() { return "Brinstar Pink"; }
        get Area() { return "Brinstar"; }

        constructor(world, config) {
            super(world, config);
            this.Weight = -4;

            this.Locations = [
                new Location(this, 14, 0x8F84E4, 'Chozo', "Super Missile (pink Brinstar)", ((this.Logic === SMLogic.Normal ? ((items => items.CardBrinstarBoss && items.CanPassBombPassages() && items.Super)) : ((items => (items.CardBrinstarBoss || items.CardBrinstarL2) && items.CanPassBombPassages() && items.Super))))),
                new Location(this, 21, 0x8F8608, 'Visible', "Missile (pink Brinstar top)"),
                new Location(this, 22, 0x8F860E, 'Visible', "Missile (pink Brinstar bottom)"),
                new Location(this, 23, 0x8F8614, 'Chozo', "Charge Beam", (((items => items.CanPassBombPassages())))),
                new Location(this, 24, 0x8F865C, 'Visible', "Power Bomb (pink Brinstar)", ((this.Logic === SMLogic.Normal ? (items => items.CanUsePowerBombs() && items.Super && items.HasEnergyReserves(1)) : ((items => items.CanUsePowerBombs() && items.Super))))),
                new Location(this, 25, 0x8F8676, 'Visible', "Missile (green Brinstar pipe)", (((items => items.Morph &&
                        (items.PowerBomb || items.Super || items.CanAccessNorfairUpperPortal()))))),
                new Location(this, 33, 0x8F87FA, 'Visible', "Energy Tank, Waterway", (((items => items.CanUsePowerBombs() && items.CanOpenRedDoors() && items.SpeedBooster &&
                        (items.HasEnergyReserves(1) || items.Gravity))))),
                new Location(this, 35, 0x8F8824, 'Visible', "Energy Tank, Brinstar Gate", ((this.Logic === SMLogic.Normal ? (items => items.CardBrinstarL2 && items.CanUsePowerBombs() && items.Wave && items.HasEnergyReserves(1)) : ((items => items.CardBrinstarL2 && items.CanUsePowerBombs() && (items.Wave || items.Super)))))),
            ];
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.CanOpenRedDoors() && (items.CanDestroyBombWalls() || items.SpeedBooster) ||
                    items.CanUsePowerBombs() ||
                    items.CanAccessNorfairUpperPortal() && items.Morph && items.Wave &&
                        (items.Ice || items.HiJump || items.SpaceJump)) : (items.CanOpenRedDoors() && (items.CanDestroyBombWalls() || items.SpeedBooster) ||
                    items.CanUsePowerBombs() ||
                    items.CanAccessNorfairUpperPortal() && items.Morph && (items.Missile || items.Super || items.Wave ) &&
                        (items.Ice || items.HiJump || items.CanSpringBallJump() || items.CanFly()))));
        }
  }
  SuperMetroid_Brinstar_Pink.prototype.kind = 'Pink';
  // SuperMetroid.Brinstar.Red
  class SuperMetroid_Brinstar_Red extends SMRegion {

        get Name() { return "Brinstar Red"; }
        get Area() { return "Brinstar"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 38, 0x8F8876, 'Chozo', "X-Ray Scope", ((this.Logic === SMLogic.Normal ? (items => items.CanUsePowerBombs() && items.CanOpenRedDoors() && (items.Grapple || items.SpaceJump)) : ((items => items.CanUsePowerBombs() && items.CanOpenRedDoors() && (
                        items.Grapple || items.SpaceJump ||
                        (items.CanIbj() || items.HiJump && items.SpeedBooster || items.CanSpringBallJump()) &&
                            (items.Varia && items.HasEnergyReserves(3) || items.HasEnergyReserves(5)))))))),
                new Location(this, 39, 0x8F88CA, 'Visible', "Power Bomb (red Brinstar sidehopper room)", (((items => items.CanUsePowerBombs() && items.Super)))),
                new Location(this, 40, 0x8F890E, 'Chozo', "Power Bomb (red Brinstar spike room)", ((this.Logic === SMLogic.Normal ? (items => (items.CanUsePowerBombs() || items.Ice) && items.Super) : ((items => items.Super))))),
                new Location(this, 41, 0x8F8914, 'Visible', "Missile (red Brinstar spike room)", (((items => items.CanUsePowerBombs() && items.Super)))),
                new Location(this, 42, 0x8F896E, 'Chozo', "Spazer", (((items => items.CanPassBombPassages() && items.Super)))),
            ];
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? ((items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                    items.CanAccessNorfairUpperPortal() && (items.Ice || items.HiJump || items.SpaceJump)) : ((items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                    items.CanAccessNorfairUpperPortal() && (items.Ice || items.CanSpringBallJump() || items.HiJump || items.CanFly()))));
        }
  }
  SuperMetroid_Brinstar_Red.prototype.kind = 'Red';
  // SuperMetroid.Brinstar.Kraid
  class SuperMetroid_Brinstar_Kraid extends SMRegion {

        get Name() { return "Brinstar Kraid"; }
        get Area() { return "Brinstar"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Locations = [
                new Location(this, 43, 0x8F899C, 'Hidden', "Energy Tank, Kraid",
                    items => items.CardBrinstarBoss),
                new Location(this, 48, 0x8F8ACA, 'Chozo', "Varia Suit",
                    items => items.CardBrinstarBoss),
                new Location(this, 44, 0x8F89EC, 'Hidden', "Missile (Kraid)", (((items => items.CanUsePowerBombs())))),
            ];
        }

        CanEnter(items) {
            return (items.CanDestroyBombWalls() || items.SpeedBooster || items.CanAccessNorfairUpperPortal()) &&
                items.Super && items.CanPassBombPassages();
        }

        CanComplete(items) {
            return this.GetLocation("Varia Suit").Available(items);
        }
  }
  SuperMetroid_Brinstar_Kraid.prototype.kind = 'Kraid';
  SuperMetroid_Brinstar_Kraid.prototype.isIReward = true;
  // SuperMetroid.WreckedShip
  class SuperMetroid_WreckedShip extends SMRegion {

        get Name() { return "Wrecked Ship"; }
        get Area() { return "Wrecked Ship"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Weight = 4;

            this.Locations = [
                new Location(this, 128, 0x8FC265, 'Visible', "Missile (Wrecked Ship middle)", (((items => items.CanPassBombPassages())))),
                new Location(this, 129, 0x8FC2E9, 'Chozo', "Reserve Tank, Wrecked Ship", ((this.Logic === SMLogic.Normal ? (items => this.CanUnlockShip(items) && items.CardWreckedShipL1 && items.CanUsePowerBombs() && items.SpeedBooster &&
                        (items.Grapple || items.SpaceJump || items.Varia && items.HasEnergyReserves(2) || items.HasEnergyReserves(3))) : ((items => this.CanUnlockShip(items) && items.CardWreckedShipL1 && items.CanUsePowerBombs() && items.SpeedBooster &&
                        (items.Varia || items.HasEnergyReserves(2))))))),
                new Location(this, 130, 0x8FC2EF, 'Visible', "Missile (Gravity Suit)", ((this.Logic === SMLogic.Normal ? (items => this.CanUnlockShip(items) && items.CardWreckedShipL1 &&
                        (items.Grapple || items.SpaceJump || items.Varia && items.HasEnergyReserves(2) || items.HasEnergyReserves(3))) : ((items => this.CanUnlockShip(items) && items.CardWreckedShipL1 && (items.Varia || items.HasEnergyReserves(1))))))),
                new Location(this, 131, 0x8FC319, 'Visible', "Missile (Wrecked Ship top)",
                    items => this.CanUnlockShip(items)),
                new Location(this, 132, 0x8FC337, 'Visible', "Energy Tank, Wrecked Ship", ((this.Logic === SMLogic.Normal ? (items => this.CanUnlockShip(items) &&
                        (items.HiJump || items.SpaceJump || items.SpeedBooster || items.Gravity)) : ((items => this.CanUnlockShip(items) && (
                        items.Morph && (items.Bombs || items.PowerBomb)  || items.CanSpringBallJump() ||
                        items.HiJump || items.SpaceJump || items.SpeedBooster || items.Gravity
                    )))))),
                new Location(this, 133, 0x8FC357, 'Visible', "Super Missile (Wrecked Ship left)",
                    items => this.CanUnlockShip(items)),
                new Location(this, 134, 0x8FC365, 'Visible', "Right Super, Wrecked Ship",
                    items => this.CanUnlockShip(items)),
                new Location(this, 135, 0x8FC36D, 'Chozo', "Gravity Suit", ((this.Logic === SMLogic.Normal ? (items => this.CanUnlockShip(items) && items.CardWreckedShipL1 &&
                        (items.Grapple || items.SpaceJump || items.Varia && items.HasEnergyReserves(2) || items.HasEnergyReserves(3))) : ((items => this.CanUnlockShip(items) && items.CardWreckedShipL1 && (items.Varia || items.HasEnergyReserves(1)))))))
            ];
        }

        CanUnlockShip(items) {
            return items.CardWreckedShipBoss && items.CanPassBombPassages();
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Super && (
                        
                        (this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) && (
                            items.SpeedBooster || items.Grapple || items.SpaceJump ||
                            items.Gravity && (items.CanIbj() || items.HiJump)
                        ) ||
                        
                        items.CanUsePowerBombs() && items.Gravity ||
                        
                        items.CanAccessMaridiaPortal(this.World) && items.Gravity && (
                            items.CanDestroyBombWalls() && items.CardMaridiaL2 ||
                            this.World.GetLocation("Space Jump").Available(items)
                        )
                    )) : (items.Super && (
                        
                        (this.Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()) ||
                        
                        items.CanUsePowerBombs() && (
                            items.Gravity ||
                            
                            items.HiJump && (items.Ice || items.CanSpringBallJump()) && items.Grapple && items.CardMaridiaL1
                        ) ||
                        
                        items.CanAccessMaridiaPortal(this.World) && ( 
                            items.HiJump && items.CanPassBombPassages() && items.CardMaridiaL2 ||
                            items.Gravity && (
                                items.CanDestroyBombWalls() && items.CardMaridiaL2 ||
                                this.World.GetLocation("Space Jump").Available(items)
                            )
                        )
                    ))));
        }

        CanComplete(items) {
            return this.CanEnter(items) && this.CanUnlockShip(items);
        }
  }
  SuperMetroid_WreckedShip.prototype.kind = 'WreckedShip';
  SuperMetroid_WreckedShip.prototype.isIReward = true;
  // SuperMetroid.Maridia.Outer
  class SuperMetroid_Maridia_Outer extends SMRegion {

        get Name() { return "Maridia Outer"; }
        get Area() { return "Maridia"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 136, 0x8FC437, 'Visible', "Missile (green Maridia shinespark)", ((this.Logic === SMLogic.Normal ? (items => items.SpeedBooster) : ((items => items.Gravity && items.SpeedBooster))))),
                new Location(this, 137, 0x8FC43D, 'Visible', "Super Missile (green Maridia)"),
                new Location(this, 138, 0x8FC47D, 'Visible', "Energy Tank, Mama turtle", ((this.Logic === SMLogic.Normal ? (items => items.CanOpenRedDoors() && (items.CanFly() || items.SpeedBooster || items.Grapple)) : ((items => items.CanOpenRedDoors() && (
                        items.CanFly() || items.SpeedBooster || items.Grapple ||
                        items.CanSpringBallJump() && (items.Gravity || items.HiJump)
                    )))))),
                new Location(this, 139, 0x8FC483, 'Hidden', "Missile (green Maridia tatori)", (((items => items.CanOpenRedDoors())))),
            ];
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Gravity && (
                        this.World.CanEnter("Norfair Upper West", items) && items.CanUsePowerBombs() ||
                        items.CanAccessMaridiaPortal(this.World) && items.CardMaridiaL1 && items.CardMaridiaL2 && (items.CanPassBombPassages() || items.ScrewAttack)
                    )) : (this.World.CanEnter("Norfair Upper West", items) && items.CanUsePowerBombs() &&
                        (items.Gravity || items.HiJump && (items.CanSpringBallJump() || items.Ice)) ||
                    items.CanAccessMaridiaPortal(this.World) && items.CardMaridiaL1 && items.CardMaridiaL2 && (
                        items.CanPassBombPassages() ||
                        items.Gravity && items.ScrewAttack ||
                        items.Super && (items.Gravity || items.HiJump && (items.CanSpringBallJump() || items.Ice))
                    ))));
        }
  }
  SuperMetroid_Maridia_Outer.prototype.kind = 'Outer';
  // SuperMetroid.Maridia.Inner
  class SuperMetroid_Maridia_Inner extends SMRegion {

        get Name() { return "Maridia Inner"; }
        get Area() { return "Maridia"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Locations = [
                new Location(this, 140, 0x8FC4AF, 'Visible', "Super Missile (yellow Maridia)", (((items => items.CardMaridiaL1 && items.CanPassBombPassages() && this.CanReachAqueduct(items)
                         && (items.Gravity || items.Ice || items.HiJump && items.SpringBall))))),
                new Location(this, 141, 0x8FC4B5, 'Visible', "Missile (yellow Maridia super missile)", (((items => items.CardMaridiaL1 && items.CanPassBombPassages() && this.CanReachAqueduct(items)
                         && (items.Gravity || items.Ice || items.HiJump && items.SpringBall))))),
                new Location(this, 142, 0x8FC533, 'Visible', "Missile (yellow Maridia false wall)", (((items => items.CardMaridiaL1 && items.CanPassBombPassages() && this.CanReachAqueduct(items)
                         && (items.Gravity || items.Ice || items.HiJump && items.SpringBall))))),
                new Location(this, 143, 0x8FC559, 'Chozo', "Plasma Beam", ((this.Logic === SMLogic.Normal ? (items => this.CanDefeatDraygon(items) && (items.ScrewAttack || items.Plasma) && (items.HiJump || items.CanFly())) : ((items => this.CanDefeatDraygon(items) &&
                        (items.Charge && items.HasEnergyReserves(3) || items.ScrewAttack || items.Plasma || items.SpeedBooster) &&
                        (items.HiJump || items.CanSpringBallJump() || items.CanFly() || items.SpeedBooster)))))),
                new Location(this, 144, 0x8FC5DD, 'Visible', "Missile (left Maridia sand pit room)", ((this.Logic === SMLogic.Normal ? (items => this.CanReachAqueduct(items) && items.Super && items.CanPassBombPassages()) : ((items => this.CanReachAqueduct(items) && items.Super &&
                        (items.Gravity || items.HiJump && (items.SpaceJump || items.CanSpringBallJump()))))))),
                new Location(this, 145, 0x8FC5E3, 'Chozo', "Reserve Tank, Maridia", ((this.Logic === SMLogic.Normal ? (items => this.CanReachAqueduct(items) && items.Super && items.CanPassBombPassages()) : ((items => this.CanReachAqueduct(items) && items.Super &&
                        (items.Gravity || items.HiJump && (items.SpaceJump || items.CanSpringBallJump()))))))),
                new Location(this, 146, 0x8FC5EB, 'Visible', "Missile (right Maridia sand pit room)", ((this.Logic === SMLogic.Normal ? ((items => this.CanReachAqueduct(items) && items.Super)) : (items => this.CanReachAqueduct(items) && items.Super && (items.HiJump || items.Gravity))))),
                new Location(this, 147, 0x8FC5F1, 'Visible', "Power Bomb (right Maridia sand pit room)", ((this.Logic === SMLogic.Normal ? ((items => this.CanReachAqueduct(items) && items.Super)) : (items => this.CanReachAqueduct(items) && items.Super && (items.Gravity || items.HiJump && items.CanSpringBallJump()))))),
                new Location(this, 148, 0x8FC603, 'Visible', "Missile (pink Maridia)", ((this.Logic === SMLogic.Normal ? (items => this.CanReachAqueduct(items) && items.SpeedBooster) : ((items => this.CanReachAqueduct(items) && items.Gravity))))),
                new Location(this, 149, 0x8FC609, 'Visible', "Super Missile (pink Maridia)", ((this.Logic === SMLogic.Normal ? (items => this.CanReachAqueduct(items) && items.SpeedBooster) : ((items => this.CanReachAqueduct(items) && items.Gravity))))),
                new Location(this, 150, 0x8FC6E5, 'Chozo', "Spring Ball", ((this.Logic === SMLogic.Normal ? (items => items.Super && items.Grapple && items.CanUsePowerBombs() && (items.SpaceJump || items.HiJump)) : ((items => items.Super && items.Grapple && items.CanUsePowerBombs() && (
                        items.Gravity && (items.CanFly() || items.HiJump) ||
                        items.Ice && items.HiJump && items.CanSpringBallJump() && items.SpaceJump)
                    ))))),
                new Location(this, 151, 0x8FC74D, 'Hidden', "Missile (Draygon)", ((this.Logic === SMLogic.Normal ? (items =>
                        items.CardMaridiaL1 && items.CardMaridiaL2 && this.CanDefeatBotwoon(items) ||
                        items.CanAccessMaridiaPortal(this.World)) : ((items => (
                            items.CardMaridiaL1 && items.CardMaridiaL2 && this.CanDefeatBotwoon(items) ||
                            items.CanAccessMaridiaPortal(this.World)
                        ) && items.Gravity))))),
                new Location(this, 152, 0x8FC755, 'Visible', "Energy Tank, Botwoon", (((items =>
                        items.CardMaridiaL1 && items.CardMaridiaL2 && this.CanDefeatBotwoon(items) ||
                        items.CanAccessMaridiaPortal(this.World) && items.CardMaridiaL2)))),
                new Location(this, 154, 0x8FC7A7, 'Chozo', "Space Jump", (((items => this.CanDefeatDraygon(items)))))
            ];
        }

        CanReachAqueduct(items) {
            return ((this.Logic === SMLogic.Normal ? (items.CardMaridiaL1 && (items.CanFly() || items.SpeedBooster || items.Grapple) 
                        || items.CardMaridiaL2 && items.CanAccessMaridiaPortal(this.World)) : (items.CardMaridiaL1 && (items.Gravity || items.HiJump && (items.Ice || items.CanSpringBallJump()) && items.Grapple) 
                        || items.CardMaridiaL2 && items.CanAccessMaridiaPortal(this.World))));
        }

        CanDefeatDraygon(items) {
            return ((this.Logic === SMLogic.Normal ? ((
                    items.CardMaridiaL1 && items.CardMaridiaL2 && this.CanDefeatBotwoon(items) ||
                    items.CanAccessMaridiaPortal(this.World)
                ) && items.CardMaridiaBoss && items.Gravity && (items.SpeedBooster && items.HiJump || items.CanFly())) : ((
                    items.CardMaridiaL1 && items.CardMaridiaL2 && this.CanDefeatBotwoon(items) ||
                    items.CanAccessMaridiaPortal(this.World)
                ) && items.CardMaridiaBoss && items.Gravity)));
        }

        CanDefeatBotwoon(items) {
            return ((this.Logic === SMLogic.Normal ? (items.SpeedBooster || items.CanAccessMaridiaPortal(this.World)) : (items.Ice || items.SpeedBooster && items.Gravity || items.CanAccessMaridiaPortal(this.World))));
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Gravity && (
                    this.World.CanEnter("Norfair Upper West", items) && items.Super && items.CanUsePowerBombs() &&
                        (items.CanFly() || items.SpeedBooster || items.Grapple) ||
                    items.CanAccessMaridiaPortal(this.World)
                )) : (items.Super && this.World.CanEnter("Norfair Upper West", items) && items.CanUsePowerBombs() &&
                        (items.Gravity || items.HiJump && (items.Ice || items.CanSpringBallJump()) && items.Grapple) ||
                    items.CanAccessMaridiaPortal(this.World))));
        }

        CanComplete(items) {
            return this.GetLocation("Space Jump").Available(items);
        }
  }
  SuperMetroid_Maridia_Inner.prototype.kind = 'Inner';
  SuperMetroid_Maridia_Inner.prototype.isIReward = true;
  // SuperMetroid.NorfairUpper.West
  class SuperMetroid_NorfairUpper_West extends SMRegion {

        get Name() { return "Norfair Upper West"; }
        get Area() { return "Norfair Upper"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 49, 0x8F8AE4, 'Hidden', "Missile (lava room)", ((this.Logic === SMLogic.Normal ? (items => items.Varia && (
                            items.CanOpenRedDoors() && (items.CanFly() || items.HiJump || items.SpeedBooster) ||
                            this.World.CanEnter("Norfair Upper East", items) && items.CardNorfairL2
                        ) && items.Morph) : ((items => items.CanHellRun() && (
                            items.CanOpenRedDoors() && (
                                items.CanFly() || items.HiJump || items.SpeedBooster ||
                                items.CanSpringBallJump() || items.Varia && items.Ice
                            ) ||
                            this.World.CanEnter("Norfair Upper East", items) && items.CardNorfairL2
                        ) && items.Morph))))),
                new Location(this, 50, 0x8F8B24, 'Chozo', "Ice Beam", ((this.Logic === SMLogic.Normal ? (items => (config.Keysanity ? items.CardNorfairL1 : items.Super) && items.CanPassBombPassages() && items.Varia && items.SpeedBooster) : ((items => (config.Keysanity ? items.CardNorfairL1 : items.Super) && items.Morph && (items.Varia || items.HasEnergyReserves(3))))))),
                new Location(this, 51, 0x8F8B46, 'Hidden', "Missile (below Ice Beam)", ((this.Logic === SMLogic.Normal ? (items => (config.Keysanity ? items.CardNorfairL1 : items.Super) && items.CanUsePowerBombs() && items.Varia && items.SpeedBooster) : ((items =>
                        (config.Keysanity ? items.CardNorfairL1 : items.Super) && items.CanUsePowerBombs() && (items.Varia || items.HasEnergyReserves(3)) ||
                        (items.Missile || items.Super || items.Wave ) && items.Varia && items.SpeedBooster &&
                            
                            (config.Keysanity ? items.CardNorfairBoss : items.Super) && items.CardNorfairL1))))),
                new Location(this, 53, 0x8F8BAC, 'Chozo', "Hi-Jump Boots", (((items => items.CanOpenRedDoors() && items.CanPassBombPassages())))),
                new Location(this, 55, 0x8F8BE6, 'Visible', "Missile (Hi-Jump Boots)", (((items => items.CanOpenRedDoors() && items.Morph)))),
                new Location(this, 56, 0x8F8BEC, 'Visible', "Energy Tank (Hi-Jump Boots)", (((items => items.CanOpenRedDoors())))),
            ];
        }

        CanEnter(items) {
            return (items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                items.CanAccessNorfairUpperPortal();
        }
  }
  SuperMetroid_NorfairUpper_West.prototype.kind = 'West';
  // SuperMetroid.NorfairUpper.East
  class SuperMetroid_NorfairUpper_East extends SMRegion {

        get Name() { return "Norfair Upper East"; }
        get Area() { return "Norfair Upper"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 61, 0x8F8C3E, 'Chozo', "Reserve Tank, Norfair", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && items.Morph && (
                        items.CanFly() ||
                        items.Grapple && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    )) : ((items => items.CardNorfairL2 && items.Morph && items.Super))))),
                new Location(this, 62, 0x8F8C44, 'Hidden', "Missile (Norfair Reserve Tank)", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && items.Morph && (
                        items.CanFly() ||
                        items.Grapple && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    )) : ((items => items.CardNorfairL2 && items.Morph && items.Super))))),
                new Location(this, 63, 0x8F8C52, 'Visible', "Missile (bubble Norfair green door)", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && (
                        items.CanFly() ||
                        items.Grapple && items.Morph && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    )) : ((items => items.CardNorfairL2 && items.Super))))),
                new Location(this, 64, 0x8F8C66, 'Visible', "Missile (bubble Norfair)", (((items => items.CardNorfairL2)))),
                new Location(this, 65, 0x8F8C74, 'Hidden', "Missile (Speed Booster)", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && (
                        items.CanFly() ||
                        items.Morph && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    )) : ((items => items.CardNorfairL2 && items.Super))))),
                new Location(this, 66, 0x8F8C82, 'Chozo', "Speed Booster", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && (
                        items.CanFly() ||
                        items.Morph && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    )) : ((items => items.CardNorfairL2 && items.Super))))),
                new Location(this, 67, 0x8F8CBC, 'Visible', "Missile (Wave Beam)", ((this.Logic === SMLogic.Normal ? (items => items.CardNorfairL2 && (
                        items.CanFly() ||
                        items.Morph && (items.SpeedBooster || items.CanPassBombPassages()) ||
                        items.HiJump || items.Ice
                    ) ||
                    items.SpeedBooster && items.Wave && items.Morph && items.Super) : ((items => items.CardNorfairL2 || items.Varia))))),
                new Location(this, 68, 0x8F8CCA, 'Chozo', "Wave Beam", ((this.Logic === SMLogic.Normal ? (items => items.Morph && (
                        items.CardNorfairL2 && (
                            items.CanFly() ||
                            items.Morph && (items.SpeedBooster || items.CanPassBombPassages()) ||
                            items.HiJump || items.Ice
                        ) ||
                        items.SpeedBooster && items.Wave && items.Morph && items.Super
                    )) : ((items => items.CanOpenRedDoors() && (items.CardNorfairL2 || items.Varia) &&
                        (items.Morph || items.Grapple || items.HiJump && items.Varia || items.SpaceJump)))))),
            ];
        }

        
        
        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? ((
                        (items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                        items.CanAccessNorfairUpperPortal()
                    ) && items.Varia && items.Super && (
                        
                        items.CanOpenRedDoors() && (this.Config.Keysanity ? items.CardNorfairL2 : items.Super) &&
                            (items.CanFly() || items.HiJump || items.SpeedBooster) ||
                        
                        items.SpeedBooster && (items.CardNorfairL2 || items.Wave ) && items.CanUsePowerBombs()
                    )) : ((
                        (items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                        items.CanAccessNorfairUpperPortal()
                    ) &&
                    items.CanHellRun() && (
                        
                        items.CanOpenRedDoors() && (this.Config.Keysanity ? items.CardNorfairL2 : items.Super) && (
                            items.CanFly() || items.HiJump || items.SpeedBooster ||
                            items.CanSpringBallJump() || items.Varia && items.Ice
                        ) ||
                        
                        items.SpeedBooster && (items.CardNorfairL2 || items.Missile || items.Super || items.Wave ) && items.CanUsePowerBombs()
                    ))));
        }
  }
  SuperMetroid_NorfairUpper_East.prototype.kind = 'East';
  // SuperMetroid.NorfairUpper.Crocomire
  class SuperMetroid_NorfairUpper_Crocomire extends SMRegion {

        get Name() { return "Norfair Upper Crocomire"; }
        get Area() { return "Norfair Upper"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 52, 0x8F8BA4, 'Visible', "Energy Tank, Crocomire", ((this.Logic === SMLogic.Normal ? (items => this.CanAccessCrocomire(items) && (items.HasEnergyReserves(1) || items.SpaceJump || items.Grapple)) : ((items => this.CanAccessCrocomire(items)))))),
                new Location(this, 54, 0x8F8BC0, 'Visible', "Missile (above Crocomire)", ((this.Logic === SMLogic.Normal ? (items => items.CanFly() || items.Grapple || items.HiJump && items.SpeedBooster) : ((items => (
                            items.CanFly() || items.Grapple ||
                            items.HiJump && (items.SpeedBooster || items.CanSpringBallJump() || items.Varia && items.Ice)
                        ) && items.CanHellRun()))))),
                new Location(this, 57, 0x8F8C04, 'Visible', "Power Bomb (Crocomire)", ((this.Logic === SMLogic.Normal ? (items => this.CanAccessCrocomire(items) && (items.CanFly() || items.HiJump || items.Grapple)) : ((items => this.CanAccessCrocomire(items)))))),
                new Location(this, 58, 0x8F8C14, 'Visible', "Missile (below Crocomire)", (((items => this.CanAccessCrocomire(items) && items.Morph)))),
                new Location(this, 59, 0x8F8C2A, 'Visible', "Missile (Grappling Beam)", ((this.Logic === SMLogic.Normal ? (items => this.CanAccessCrocomire(items) && items.Morph && (items.CanFly() || items.SpeedBooster && items.CanUsePowerBombs())) : ((items => this.CanAccessCrocomire(items) && (items.SpeedBooster || items.Morph && (items.CanFly() || items.Grapple))))))),
                new Location(this, 60, 0x8F8C36, 'Chozo', "Grappling Beam", ((this.Logic === SMLogic.Normal ? (items => this.CanAccessCrocomire(items) && items.Morph && (items.CanFly() || items.SpeedBooster && items.CanUsePowerBombs())) : ((items => this.CanAccessCrocomire(items) && (
                        items.SpaceJump || items.Morph || items.Grapple || items.HiJump && items.SpeedBooster
                    )))))),
            ];
        }

        CanAccessCrocomire(items) {
            return this.Config.Keysanity ? items.CardNorfairBoss : items.Super;
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? ((
                        (items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                        items.CanAccessNorfairUpperPortal()
                    ) && items.Varia && (
                        
                        (this.Config.Keysanity ? items.CardNorfairL1 : items.Super) && items.CanUsePowerBombs() && items.SpeedBooster ||
                        
                        items.SpeedBooster && items.Wave ||
                        
                        items.CanOpenRedDoors() && (this.Config.Keysanity ? items.CardNorfairL2 : items.Super) &&
                            (items.CanFly() || items.HiJump || items.SpeedBooster) &&
                            (items.CanPassBombPassages() || items.Gravity && items.Morph) && items.Wave
                    ) ||
                    
                    items.Varia && items.CanAccessNorfairLowerPortal() && items.ScrewAttack && items.SpaceJump && items.Super &&
                        items.Gravity && items.Wave && (items.CardNorfairL2 || items.Morph)) : ((
                        (items.CanDestroyBombWalls() || items.SpeedBooster) && items.Super && items.Morph ||
                        items.CanAccessNorfairUpperPortal()
                    ) && (
                        
                        (this.Config.Keysanity ? items.CardNorfairL1 : items.Super) && items.CanUsePowerBombs() &&
                            items.SpeedBooster && (items.HasEnergyReserves(3) || items.Varia) ||
                        
                        items.SpeedBooster && (items.HasEnergyReserves(2) || items.Varia) &&
                            (items.Missile || items.Super || items.Wave ) ||
                        
                        items.CanHellRun() && items.CanOpenRedDoors() && (this.Config.Keysanity ? items.CardNorfairL2 : items.Super) &&
                            (items.CanFly() || items.HiJump || items.SpeedBooster || items.CanSpringBallJump() || items.Varia && items.Ice) &&
                            (items.CanPassBombPassages() || items.Varia && items.Morph) &&
                            (items.Missile || items.Super || items.Wave )
                    ) ||
                    
                    items.Varia && items.CanAccessNorfairLowerPortal() && items.ScrewAttack && items.SpaceJump && items.Super && 
                        items.HasEnergyReserves(2) && (items.CardNorfairL2 || items.Morph))));
        }
  }
  SuperMetroid_NorfairUpper_Crocomire.prototype.kind = 'Crocomire';
  // SuperMetroid.NorfairLower.West
  class SuperMetroid_NorfairLower_West extends SMRegion {

        get Name() { return "Norfair Lower West"; }
        get Area() { return "Norfair Lower"; }

        constructor(world, config) {
            super(world, config);
            this.Locations = [
                new Location(this, 70, 0x8F8E6E, 'Visible', "Missile (Gold Torizo)", ((this.Logic === SMLogic.Normal ? (items => items.CanUsePowerBombs() && items.SpaceJump && items.Super) : ((items => items.CanUsePowerBombs() && items.SpaceJump && items.Varia && (
                        items.HiJump || items.Gravity ||
                        items.CanAccessNorfairLowerPortal() && (items.CanFly() || items.CanSpringBallJump() || items.SpeedBooster) && items.Super
                    )))))),
                new Location(this, 71, 0x8F8E74, 'Hidden', "Super Missile (Gold Torizo)", ((this.Logic === SMLogic.Normal ? (items => items.CanDestroyBombWalls() && (items.Super || items.Charge) &&
                        (items.CanAccessNorfairLowerPortal() || items.CanUsePowerBombs() && items.SpaceJump)) : ((items => items.CanDestroyBombWalls() && items.Varia && (items.Super || items.Charge)))))),
                new Location(this, 79, 0x8F9110, 'Chozo', "Screw Attack", ((this.Logic === SMLogic.Normal ? (items => items.CanDestroyBombWalls() && (items.CanAccessNorfairLowerPortal() || items.CanUsePowerBombs() && items.SpaceJump)) : ((items => items.CanDestroyBombWalls() && (items.CanAccessNorfairLowerPortal() || items.Varia)))))),
                new Location(this, 73, 0x8F8F30, 'Visible', "Missile (Mickey Mouse room)", ((this.Logic === SMLogic.Normal ? (items => items.Morph && items.Super &&
                        
                        items.CanFly() && items.CanUsePowerBombs() && (
                            
                            (items.CardLowerNorfairL1 || items.Gravity)  && items.CardNorfairL2  ||
                            items.Gravity && items.Wave  &&
                                (items.Grapple || items.SpaceJump)  ||
                            
                            items.CanUsePowerBombs() && items.SpaceJump && (items.Super || items.Charge)
                        )) : ((items => items.Varia && items.Morph && items.Super &&
                        
                        (items.CanFly() || items.HiJump || items.CanSpringBallJump() || items.Ice && items.Charge) &&
                        (items.CanPassBombPassages() || items.ScrewAttack && items.SpaceJump) && (
                            
                            items.CardNorfairL2 || items.SpeedBooster || items.CanFly() || items.Grapple ||
                            items.HiJump && (items.CanSpringBallJump() || items.Ice) ||
                            
                            items.CanUsePowerBombs()
                        )))))),
            ];
        }

        
        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Varia && (
                        this.World.CanEnter("Norfair Upper East", items) && items.CanUsePowerBombs() && items.SpaceJump && items.Gravity && (
                            
                            items.CardNorfairL2 ||
                            
                            items.SpeedBooster && items.Wave
                        ) ||
                        items.CanAccessNorfairLowerPortal() && items.CanDestroyBombWalls()
                    )) : (this.World.CanEnter("Norfair Upper East", items) && items.CanUsePowerBombs() && items.Varia && (items.HiJump || items.Gravity) && (
                        
                        items.CardNorfairL2 ||
                        
                        items.SpeedBooster && (items.Missile || items.Super || items.Wave )
                    ) ||
                    items.CanAccessNorfairLowerPortal() && items.CanDestroyBombWalls())));
        }
  }
  SuperMetroid_NorfairLower_West.prototype.kind = 'West';
  // SuperMetroid.NorfairLower.East
  class SuperMetroid_NorfairLower_East extends SMRegion {

        get Name() { return "Norfair Lower East"; }
        get Area() { return "Norfair Lower"; }

        

        constructor(world, config) {
            super(world, config);
            this.Reward = RewardType.None;
            this.Locations = [
                new Location(this, 74, 0x8F8FCA, 'Visible', "Missile (lower Norfair above fire flea room)", (((items => this.CanExit(items))))),
                new Location(this, 75, 0x8F8FD2, 'Visible', "Power Bomb (lower Norfair above fire flea room)", ((this.Logic === SMLogic.Normal ? ((items => this.CanExit(items))) : (items => this.CanExit(items) && items.CanPassBombPassages())))),
                new Location(this, 76, 0x8F90C0, 'Visible', "Power Bomb (Power Bombs of shame)", (((items => this.CanExit(items) && items.CanUsePowerBombs())))),
                new Location(this, 77, 0x8F9100, 'Visible', "Missile (lower Norfair near Wave Beam)", ((this.Logic === SMLogic.Normal ? ((items => this.CanExit(items))) : (items => this.CanExit(items) && items.Morph && items.CanDestroyBombWalls())))),
                new Location(this, 78, 0x8F9108, 'Hidden', "Energy Tank, Ridley", (((items => this.CanExit(items) && items.CardLowerNorfairBoss && items.CanUsePowerBombs() && items.Super)))),
                new Location(this, 80, 0x8F9184, 'Visible', "Energy Tank, Firefleas", (((items => this.CanExit(items)))))
            ];
        }

        CanExit(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Morph && (
                        items.CardNorfairL2  ||
                        items.Gravity && items.Wave  &&
                            (items.Grapple || items.SpaceJump) 
                    )) : (items.Morph && (
                        items.CardNorfairL2  ||
                        (items.Missile || items.Super || items.Wave ) && (
                            items.SpeedBooster || items.CanFly() || items.Grapple ||
                            items.HiJump && (items.CanSpringBallJump() || items.Ice) 
                        )
                    ) ||
                    
                    items.HasEnergyReserves(5))));
        }

        CanEnter(items) {
            return ((this.Logic === SMLogic.Normal ? (items.Varia && items.CardLowerNorfairL1 && (
                        this.World.CanEnter("Norfair Upper East", items) && items.CanUsePowerBombs() && items.SpaceJump && items.Gravity ||
                        items.CanAccessNorfairLowerPortal() && items.CanDestroyBombWalls() && items.Super && items.CanUsePowerBombs() && items.CanFly()
                    )) : (items.Varia && items.CardLowerNorfairL1 && (
                        this.World.CanEnter("Norfair Upper East", items) && items.CanUsePowerBombs() && (items.HiJump || items.Gravity) ||
                        items.CanAccessNorfairLowerPortal() && items.CanDestroyBombWalls() && items.Super && (items.CanFly() || items.CanSpringBallJump() || items.SpeedBooster)
                    ) &&
                    (items.CanFly() || items.HiJump || items.CanSpringBallJump() || items.Ice && items.Charge) &&
                    (items.CanPassBombPassages() || items.ScrewAttack && items.SpaceJump))));
        }

        CanComplete(items) {
            return this.GetLocation("Energy Tank, Ridley").Available(items);
        }
  }
  SuperMetroid_NorfairLower_East.prototype.kind = 'East';
  SuperMetroid_NorfairLower_East.prototype.isIReward = true;
  const REGION_CLASSES = [Zelda_CastleTower, Zelda_EasternPalace, Zelda_DesertPalace, Zelda_TowerOfHera, Zelda_PalaceOfDarkness, Zelda_SwampPalace, Zelda_SkullWoods, Zelda_ThievesTown, Zelda_IcePalace, Zelda_MiseryMire, Zelda_TurtleRock, Zelda_GanonsTower, Zelda_LightWorld_DeathMountain_West, Zelda_LightWorld_DeathMountain_East, Zelda_LightWorld_NorthWest, Zelda_LightWorld_NorthEast, Zelda_LightWorld_South, Zelda_HyruleCastle, Zelda_DarkWorld_DeathMountain_West, Zelda_DarkWorld_DeathMountain_East, Zelda_DarkWorld_NorthWest, Zelda_DarkWorld_NorthEast, Zelda_DarkWorld_South, Zelda_DarkWorld_Mire, SuperMetroid_Crateria_West, SuperMetroid_Crateria_Central, SuperMetroid_Crateria_East, SuperMetroid_Brinstar_Blue, SuperMetroid_Brinstar_Green, SuperMetroid_Brinstar_Pink, SuperMetroid_Brinstar_Red, SuperMetroid_Brinstar_Kraid, SuperMetroid_WreckedShip, SuperMetroid_Maridia_Outer, SuperMetroid_Maridia_Inner, SuperMetroid_NorfairUpper_West, SuperMetroid_NorfairUpper_East, SuperMetroid_NorfairUpper_Crocomire, SuperMetroid_NorfairLower_West, SuperMetroid_NorfairLower_East];

  // ── the world
  class World {
    constructor(config, player, id, guid) {
      this.Config = config; this.Player = player; this.Id = id; this.Guid = guid; this.WorldState = null; this.ForwardSearch = false;
      this.Regions = REGION_CLASSES.map((C) => new C(this, config));
      this.Locations = [].concat(...this.Regions.map((r) => r.Locations));
      this.regionLookup = {}; this.Regions.forEach((r) => { this.regionLookup[r.Name] = r; });
      this.locationLookup = {}; this.Locations.forEach((l) => { this.locationLookup[l.Name] = l; });
      this.Regions.forEach((r) => r.GenerateLocationLookup());
    }
    get TowerCrystals() { return this.WorldState ? this.WorldState.TowerCrystals : 7; }
    get GanonCrystals() { return this.WorldState ? this.WorldState.GanonCrystals : 7; }
    get TourianBossTokens() { return this.WorldState ? this.WorldState.TourianBossTokens : 4; }
    get Items() { return this.Locations.map((l) => l.Item).filter((i) => i !== null); }
    GetLocation(name) { const l = this.locationLookup[name]; if (!l) throw new Error('no location ' + name); return l; }
    GetRegion(name) { return this.regionLookup[name]; }
    get rewardRegions() { return this.Regions.filter((r) => r.isIReward); }
    CanEnter(name, items) { return this.regionLookup[name].CanEnter(items); }
    CanAcquire(items, reward) { const r = this.rewardRegions.find((x) => x.Reward === reward); return r ? r.CanComplete(items) : true; }
    CanAcquireAll(items, mask) { return this.rewardLookup[mask].every((x) => x.CanComplete(items)); }
    CanAcquireAtLeast(n, items, mask) { return this.rewardLookup[mask].filter((x) => x.CanComplete(items)).length >= n; }
    Setup(state) {
      this.WorldState = state;
      const regions = this.rewardRegions.filter((x) => x.Reward === RewardType.None);
      regions.forEach((r, i) => { if (i < state.Rewards.length) r.Reward = state.Rewards[i]; });
      this.GetRegion('Misery Mire').Medallion = state.Medallions[0];
      this.GetRegion('Turtle Rock').Medallion = state.Medallions[1];
      this.rewardLookup = {};
      for (let i = 0; i < 512; i++) this.rewardLookup[i] = this.rewardRegions.filter((x) => (x.Reward & i) !== 0);
    }
  }

  // ── world state: rewards, medallions, crystals, drop prizes
  const DropPrize = { Heart: 0xD8, Green: 0xD9, Blue: 0xDA, Red: 0xDB, Bomb1: 0xDC, Bomb4: 0xDD, Bomb8: 0xDE, Magic: 0xDF, FullMagic: 0xE0, Arrow5: 0xE1, Arrow10: 0xE2, Fairy: 0xE3 };
  function worldState(config, rnd) {
    const R = RewardType;
    // rewards
    const BASE = [R.PendantGreen, R.PendantNonGreen, R.PendantNonGreen, R.CrystalRed, R.CrystalRed, R.CrystalBlue, R.CrystalBlue, R.CrystalBlue, R.CrystalBlue, R.CrystalBlue,
      R.AnyBossToken, R.AnyBossToken, R.AnyBossToken, R.AnyBossToken];
    let d = { Boss: 12, Blue: 15, Red: 6, Pend: 2, Green: 1 };
    const sm = [];
    for (let n = 0; n < 4; n++) {
      let p = rnd.Next(d.Boss + d.Blue + d.Red + d.Pend + d.Green);
      if ((p -= d.Boss) < 0) { sm.push(R.AnyBossToken); d = Object.assign({}, d, { Boss: d.Boss - 3 }); }
      else if ((p -= d.Blue) < 0) { sm.push(R.CrystalBlue); d = Object.assign({}, d, { Blue: d.Blue - 3 }); }
      else if ((p -= d.Red) < 0) { sm.push(R.CrystalRed); d = Object.assign({}, d, { Red: d.Red - 3 }); }
      else if ((p -= d.Pend) < 0) { sm.push(R.PendantNonGreen); d = Object.assign({}, d, { Pend: d.Pend - 1 }); }
      else { sm.push(R.PendantGreen); d = Object.assign({}, d, { Green: d.Green - 1 }); }
    }
    const z3 = BASE.slice(); sm.forEach((r) => { const i = z3.indexOf(r); if (i >= 0) z3.splice(i, 1); });
    let rewards = shuffle(z3, rnd).concat(sm);
    const tokens = shuffle([R.BossTokenKraid, R.BossTokenPhantoon, R.BossTokenDraygon, R.BossTokenRidley], rnd);   // a Stack: popped from the end
    rewards = rewards.map((r) => r === R.AnyBossToken ? tokens.pop() : r);
    const medallions = [rnd.Next(3), rnd.Next(3)];
    const towerCrystals = config.OpenTower === -1 ? rnd.Next(8) : config.OpenTower;
    const ganonCrystals = config.GanonVulnerable === -1 ? rnd.Next(8) : config.GanonVulnerable;
    const tourian = config.OpenTourian === -1 ? rnd.Next(5) : config.OpenTourian;
    const P = DropPrize;
    const BASE_DROPS = [P.Heart, P.Heart, P.Heart, P.Heart, P.Green, P.Heart, P.Heart, P.Green, P.Blue, P.Green, P.Blue, P.Red, P.Blue, P.Green, P.Blue, P.Blue,
      P.FullMagic, P.Magic, P.Magic, P.Blue, P.FullMagic, P.Magic, P.Heart, P.Magic, P.Bomb1, P.Bomb1, P.Bomb1, P.Bomb4, P.Bomb1, P.Bomb1, P.Bomb8, P.Bomb1,
      P.Arrow5, P.Heart, P.Arrow5, P.Arrow10, P.Arrow5, P.Heart, P.Arrow5, P.Arrow10, P.Magic, P.Green, P.Heart, P.Arrow5, P.Magic, P.Bomb1, P.Green, P.Heart,
      P.Heart, P.Fairy, P.FullMagic, P.Red, P.Bomb8, P.Heart, P.Red, P.Arrow10, P.Green, P.Blue, P.Red, P.Green, P.Red, P.Green, P.Red];
    const pr = shuffle(BASE_DROPS, rnd);
    const drops = { Packs: pr.slice(0, 56), TreePulls: pr.slice(56, 59), CrabContinous: pr[59], CrabFinal: pr[60], Stun: pr[61], Fish: pr[62] };
    return { Rewards: rewards, Medallions: medallions, TowerCrystals: towerCrystals, GanonCrystals: ganonCrystals, TourianBossTokens: tourian, DropPrizes: drops };
  }

  // ── the filler
  class Filler {
    constructor(worlds, config, rnd) {
      this.Worlds = worlds; this.Config = config; this.Rnd = rnd;
      worlds.forEach((w) => w.Setup(worldState(config, rnd)));
    }
    Fill() {
      const C = this.Config, rnd = this.Rnd;
      let progressionItems = [], baseItems = [];
      for (const world of this.Worlds) {
        const dungeon = Item.CreateDungeonPool(world);
        const progression = Item.CreateProgressionPool(world);
        this.InitialFillInOwnWorld(dungeon, progression, world);
        if (!C.Keysanity) {
          const worldLocations = shuffle(empty(world.Locations), rnd);
          const keyCards = Item.CreateKeycards(world);
          this.AssumedFill(dungeon, progression.concat(keyCards), worldLocations, [world]);
          baseItems = baseItems.concat(keyCards);
        } else {
          progressionItems.push(...Item.CreateKeycards(world));
          progressionItems.push(...Item.CreateSmMaps(world));
        }
        progressionItems.push(...dungeon);
        progressionItems.push(...progression);
      }
      progressionItems = shuffle(progressionItems, rnd);
      const niceItems = shuffle([].concat(...this.Worlds.map((w) => Item.CreateNicePool(w))), rnd);
      const junkItems = shuffle([].concat(...this.Worlds.map((w) => Item.CreateJunkPool(w))), rnd);
      let locations = shuffle(empty([].concat(...this.Worlds.map((w) => w.Locations))), rnd);
      // ApplyLocationWeighting: a stable order by (index - weight)
      locations = locations.map((x, i) => ({ x, i: i - x.Weight })).sort((a, b) => a.i - b.i).map((o) => o.x);
      this.GanonTowerFill(junkItems, 0.5);
      this.AssumedFill(progressionItems, baseItems, locations, this.Worlds);
      this.FastFill(niceItems, locations);
      this.FastFill(junkItems, locations);
    }
    InitialFillInOwnWorld(dungeonItems, progressionItems, world) {
      const C = this.Config;
      this.FillItemAtLocation(dungeonItems, IT.KeySW, world.GetLocation('Skull Woods - Pinball Room'));
      if (C.SwordLocation === 2) this.FillItemAtLocation(progressionItems, IT.ProgressiveSword, world.GetLocation("Link's Uncle"));
      else if (C.SwordLocation === 1) this.FrontFillItemInOwnWorld(progressionItems, IT.ProgressiveSword, world);
      if (C.MorphLocation === 2) this.FillItemAtLocation(progressionItems, IT.Morph, world.GetLocation('Morphing Ball'));
      else if (C.MorphLocation === 1) this.FrontFillItemInOwnWorld(progressionItems, IT.Morph, world);
      this.FrontFillItemInOwnWorld(progressionItems, IT.Super, world);
      this.FrontFillItemInOwnWorld(progressionItems, IT.PowerBomb, world);
    }
    AssumedFill(itemPool, baseItems, locations, worlds) {
      const assumed = itemPool.slice();
      let guard = 0;
      while (assumed.length > 0) {
        if (++guard > 100000) throw new Error('The fill could not place every item (seed impossible).');
        const item = assumed[0]; assumed.splice(0, 1);
        const inventory = this.CollectItems(assumed.concat(baseItems), worlds);
        const location = canFillWithinWorld(empty(locations), item, inventory)[0];
        if (!location) { assumed.push(item); continue; }
        location.Item = item;
        removeItem(itemPool, item);
      }
    }
    CollectItems(items, worlds) {
      const assumed = items.slice();
      let remaining = filled([].concat(...worlds.map((w) => w.Locations)));
      for (;;) {
        const avail = availableWithinWorld(remaining, assumed);
        remaining = except(remaining, avail);
        const found = avail.map((x) => x.Item);
        if (found.length === 0) break;
        assumed.push(...found);
      }
      return assumed;
    }
    FrontFillItemInOwnWorld(itemPool, type, world) {
      const item = getItem(itemPool, type);
      const location = pick(available(empty(world.Locations), world.Items), this.Rnd);
      if (!location) throw new Error('Tried to front fill ' + item.Name + ' in, but no location was available');
      location.Item = item; removeItem(itemPool, item);
    }
    GanonTowerFill(itemPool, factor) {
      for (const world of this.Worlds) {
        const locations = shuffle(empty(world.Locations.filter((x) => x.Region.kind === 'GanonsTower')), this.Rnd);
        // (int)(Count * factor * (TowerCrystals / 7)): an integer division, as in the C#
        this.FastFill(itemPool, locations.slice(0, Math.trunc(locations.length * factor * Math.trunc(world.TowerCrystals / 7))));
      }
    }
    FastFill(itemPool, locations) {
      const e = empty(locations), pairs = [];
      for (let i = 0; i < e.length && i < itemPool.length; i++) pairs.push([e[i], itemPool[i]]);
      pairs.forEach(([l, it]) => { l.Item = it; removeItem(itemPool, it); });
    }
    FillItemAtLocation(itemPool, type, location) {
      const item = getItem(itemPool, type);
      location.Item = item; removeItem(itemPool, item);
    }
  }

  // ── the playthrough (spoiler spheres; it also proves the seed can be beaten)
  function playthrough(worlds, config) {
    const spheres = [], locations = [], items = [];
    worlds.forEach((w) => { w.ForwardSearch = true; if (!w.Config.Keysanity) items.push(...Item.CreateKeycards(w)); });
    const total = [].concat(...worlds.map((w) => w.Items)).length;
    while (items.length < total) {
      const sphere = [];
      const all = [].concat(...worlds.map((w) => available(w.Locations, items.filter((i) => i.World === w))));
      const added = except(all, locations);
      const addedItems = added.map((l) => l.Item);
      locations.push(...added); items.push(...addedItems);
      if (!addedItems.length) {
        const inacc = except([].concat(...worlds.map((w) => w.Locations)), locations);
        if (inacc.length >= 15 * worlds.length) throw new Error('Too many inaccessible items, seed likely impossible.');
        let n = 0; inacc.forEach((l) => sphere.push(['Inaccessible Item #' + (n += 1) + ': ' + l.Name, l.Item.Name]));
        spheres.push(sphere); break;
      }
      added.forEach((l) => { if (l.Item.Progression || config.Keysanity && (l.Item.IsDungeonItem || l.Item.IsKeycard || l.Item.IsSmMap)) sphere.push([l.Name, l.Item.Name]); });
      spheres.push(sphere);
      if (spheres.length > 100) throw new Error('Too many spheres, seed likely impossible.');
    }
    worlds.forEach((w) => { w.ForwardSearch = false; });
    const reward = [];
    worlds.forEach((w) => w.rewardRegions.filter((r) => r.Reward !== RewardType.Agahnim).forEach((r) => reward.push(['Prize - ' + r.Area, REWARD_DESC[r.Reward]])));
    worlds.forEach((w) => w.Regions.filter((r) => r.isIMedallionAccess).forEach((r) => reward.push(['Medallion Required - ' + r.Area, MEDALLION_NAME[r.Medallion]])));
    spheres.push(reward);
    return spheres;
  }

  // ── texts: the dialog compiler and the string table
  const TX = window.SMZ3_TEXTS;
  const LETTERS = { ' ': [0x4F], '?': [0xC6], '!': [0xC7], ',': [0xC8], '-': [0xC9], '…': [0xCC], '.': [0xCD], '~': [0xCE], '～': [0xCE], "'": [0xD8], '’': [0xD8], '"': [0xD8],
    ':': [0x4A], '@': [0x4B], '#': [0x4C], '¤': [0x4D, 0x4E], '_': [0xFF], '£': [0xFE, 0x6A], '>': [0xD2, 0xD3], '%': [0xDD], '^': [0xDE], '=': [0xDF], '↑': [0xE0], '↓': [0xE1],
    '→': [0xE2], '←': [0xE3], '≥': [0xE4], '¼': [0xE5, 0xE7], '½': [0xE6, 0xE7], '¾': [0xE8, 0xE9], '♥': [0xEA, 0xEB], 'ᚋ': [0xFE, 0x6C, 0x00], 'ᚌ': [0xFE, 0x6C, 0x01],
    'ᚍ': [0xFE, 0x6C, 0x02], 'ᚎ': [0xFE, 0x6C, 0x03] };
  'あいうえおやゆよかきくけこわをんさしすせそがぎぐたちつてとげござなにぬねのじずぜはひふへほぞだぢ'.split('').forEach((c, i) => { LETTERS[c] = [i]; });
  'アイウエオヤユヨカキクケコワヲンサシスセソガギグタチツテトゲゴザナニヌネノジズゼハヒフヘホゾダ'.split('').forEach((c, i) => { LETTERS[c] = [0x50 + i]; });
  'マミムメモヅデドラリルレロバビブベボパピプペポャュョッァィゥェォ'.split('').forEach((c, i) => { LETTERS[c] = [0x80 + i]; });
  function letterBytes(c) {
    if (/[0-9]/.test(c)) return [c.charCodeAt(0) - 48 + 0xA0];
    if (/[A-Z]/.test(c)) return [c.charCodeAt(0) - 65 + 0xAA];
    if (/[a-z]/.test(c)) return [c.charCodeAt(0) - 97 + 0x30];
    return LETTERS[c] || [0xFF];
  }
  const COMMANDS = { '{SPEED0}': [0xFC, 0x00], '{SPEED2}': [0xFC, 0x02], '{SPEED6}': [0xFC, 0x06], '{PAUSE1}': [0xFE, 0x78, 0x01], '{PAUSE3}': [0xFE, 0x78, 0x03],
    '{PAUSE5}': [0xFE, 0x78, 0x05], '{PAUSE7}': [0xFE, 0x78, 0x07], '{PAUSE9}': [0xFE, 0x78, 0x09], '{INPUT}': [0xFA], '{CHOICE}': [0xFE, 0x68], '{ITEMSELECT}': [0xFE, 0x69],
    '{CHOICE2}': [0xFE, 0x71], '{CHOICE3}': [0xFE, 0x72], '{C:GREEN}': [0xFE, 0x77, 0x07], '{C:YELLOW}': [0xFE, 0x77, 0x02], '{HARP}': [0xFE, 0x79, 0x2D], '{MENU}': [0xFE, 0x6D, 0x00],
    '{BOTTOM}': [0xFE, 0x6D, 0x01], '{NOBORDER}': [0xFE, 0x6B, 0x02], '{CHANGEPIC}': [0xFE, 0x67, 0xFE, 0x67], '{CHANGEMUSIC}': [0xFE, 0x67],
    '{INTRO}': [0xFE, 0x6E, 0x00, 0xFE, 0x77, 0x07, 0xFC, 0x03, 0xFE, 0x6B, 0x02, 0xFE, 0x67], '{IBOX}': [0xFE, 0x6B, 0x02, 0xFE, 0x77, 0x07, 0xFC, 0x03, 0xF7] };
  const chars = (s) => Array.from(s);   // C# strings count UTF-16 units; every letter here is in the BMP
  function wordwrap(text, width) {
    const out = [];
    text.split('\n').forEach((line) => {
      line = line.replace(/\s+$/, '');
      if (chars(line).length <= width) { out.push(line); return; }
      const stack = [''];
      line.split(' ').forEach((word) => {
        let l = stack.pop();
        if (chars(l).length + chars(word).length <= width) l = l + word + ' ';
        else {
          if (chars(l).length > 0) stack.push(l);
          l = word;
          while (chars(l).length > width) { stack.push(chars(l).slice(0, width).join('')); l = chars(l).slice(width).join(''); }
          l = l + ' ';
        }
        stack.push(l);
      });
      stack.forEach((l) => out.push(l.replace(/\s+$/, '')));
    });
    return out;
  }
  function dialog(text) {
    const maxBytes = 2046, wrap = 19, cmd = /^\{[^}]*\}/;
    let padOut = false, pause = true;
    const bytes = [0xFB];
    const lines = wordwrap(text, wrap);
    const lineCount = lines.filter((l) => !cmd.test(l)).length;
    let idx = 0;
    for (const line of lines) {
      const m = line.match(cmd);
      if (m) {
        if (m[0] === '{NOTEXT}') return [0xFB, 0xFE, 0x6E, 0x00, 0xFE, 0x6B, 0x04];
        if (m[0] === '{INTRO}') padOut = true;
        if (m[0] === '{NOPAUSE}') { pause = false; continue; }
        if (!COMMANDS[m[0]]) throw new Error('Dialog text contained unknown command ' + m[0]);
        bytes.push(...COMMANDS[m[0]]);
        continue;
      }
      if (idx > 0) bytes.push(idx === 1 ? 0xF8 : idx === 2 ? 0xF9 : 0xF6);
      let letters = chars(line);
      if (padOut && idx < 3) while (letters.length < wrap) letters.push(' ');
      letters.forEach((c) => bytes.push(...letterBytes(c)));
      idx += 1;
      if (pause && idx % 3 === 0 && idx < lineCount) bytes.push(0xFA);
    }
    return bytes.slice(0, maxBytes);
  }
  let TEMPLATE = null;
  class StringTable {
    constructor() {
      if (!TEMPLATE) TEMPLATE = TX.stringTable.map(([n, v]) => [n, typeof v === 'string' ? dialog(v) : v]);
      this.entries = TEMPLATE.map((e) => e.slice());
    }
    set(name, text) { const i = this.entries.findIndex((e) => e[0] === name); this.entries[i] = [name, dialog(text)]; }
    padded() {
      const max = 0x7355, data = [].concat(...this.entries.map((e) => e[1]));
      if (data.length > max) throw new Error('String Table exceeds 0x7355 bytes');
      while (data.length < max) data.push(0xFF);
      return data;
    }
  }
  const G = () => TX.general;
  function itemTextbox(item) {
    const n = IT_NAME[item.Type];
    const name = item.IsMap ? 'Map' : item.IsCompass ? 'Compass' : item.IsSmMap ? 'SmMap' : n === 'BottleWithGoldBee' ? 'BottleWithBee' : n === 'HeartContainerRefill' ? 'HeartContainer' :
      (n === 'OneRupee' || n === 'FiveRupees') ? 'PocketRupees' : (n === 'TwentyRupees' || n === 'TwentyRupees2' || n === 'FiftyRupees') ? 'CouchRupees' :
      (n === 'BombUpgrade5' || n === 'BombUpgrade10') ? 'BombUpgrade' : (n === 'ArrowUpgrade5' || n === 'ArrowUpgrade10') ? 'ArrowUpgrade' : n;
    const items = G().Items;
    return items[name] !== undefined && items[name] !== null ? items[name] : items['default'];
  }
  const randomLine = (rnd, lines) => lines[rnd.Next(lines.length)];

  // ── the patch: every change this seed makes to the combo ROM
  function snes(addr) {
    if ((addr & 0xFF8000) === 0x308000) addr = 0x400000 | (addr & 0x7FFF);
    else addr = (addr < 0x800000 ? 0x400000 : 0) | (addr & 0x3FFFFF);
    if (addr > 0x600000) throw new Error('Unmapped pc address target $' + addr.toString(16));
    return addr;
  }
  const u16 = (v) => [v & 0xFF, (v >> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  const ascii = (s) => Array.from(s, (c) => c.charCodeAt(0) & 0x7F);

  const REWARD_ADDR = {
    EasternPalace: [0x2A09D, 0xABEF8, 0xABEF9, 0x308052, 0x30807C, 0x1C6FE, 0x30D100], DesertPalace: [0x2A09E, 0xABF1C, 0xABF1D, 0x308053, 0x308078, 0x1C6FF, 0x30D101],
    TowerOfHera: [0x2A0A5, 0xABF0A, 0xABF0B, 0x30805A, 0x30807A, 0x1C706, 0x30D102], PalaceOfDarkness: [0x2A0A1, 0xABF00, 0xABF01, 0x308056, 0x30807D, 0x1C702, 0x30D103],
    SwampPalace: [0x2A0A0, 0xABF6C, 0xABF6D, 0x308055, 0x308071, 0x1C701, 0x30D104], SkullWoods: [0x2A0A3, 0xABF12, 0xABF13, 0x308058, 0x30807B, 0x1C704, 0x30D105],
    ThievesTown: [0x2A0A6, 0xABF36, 0xABF37, 0x30805B, 0x308077, 0x1C707, 0x30D106], IcePalace: [0x2A0A4, 0xABF5A, 0xABF5B, 0x308059, 0x308073, 0x1C705, 0x30D107],
    MiseryMire: [0x2A0A2, 0xABF48, 0xABF49, 0x308057, 0x308075, 0x1C703, 0x30D108], TurtleRock: [0x2A0A7, 0xABF24, 0xABF25, 0x30805C, 0x308079, 0x1C708, 0x30D109],
    Kraid: [0xF26002, 0xF26004, 0xF26005, 0xF26000, 0xF26006, 0xF26007, 0x82FD36], WreckedShip: [0xF2600A, 0xF2600C, 0xF2600D, 0xF26008, 0xF2600E, 0xF2600F, 0x82FE26],
    Inner: [0xF26012, 0xF26014, 0xF26015, 0xF26010, 0xF26016, 0xF26017, 0x82FE76], East_NorfairLower: [0xF2601A, 0xF2601C, 0xF2601D, 0xF26018, 0xF2601E, 0xF2601F, 0x82FDD6],
  };
  const regionKey = (r) => r.kind === 'East' && r.Name === 'Norfair Lower East' ? 'East_NorfairLower' : r.kind;
  const CRYSTAL = { 1: [0x02, 0x34, 0x64, 0x40, 0x7F, 0x06, 0x10], 2: [0x10, 0x34, 0x64, 0x40, 0x79, 0x06, 0x10], 3: [0x40, 0x34, 0x64, 0x40, 0x6C, 0x06, 0x10], 4: [0x20, 0x34, 0x64, 0x40, 0x6D, 0x06, 0x10],
    5: [0x04, 0x32, 0x64, 0x40, 0x6E, 0x06, 0x11], 6: [0x01, 0x32, 0x64, 0x40, 0x6F, 0x06, 0x11], 7: [0x08, 0x34, 0x64, 0x40, 0x7C, 0x06, 0x10] };
  const PENDANT = { 1: [0x04, 0x38, 0x62, 0x00, 0x69, 0x01, 0x12], 2: [0x01, 0x32, 0x60, 0x00, 0x69, 0x03, 0x14], 3: [0x02, 0x34, 0x60, 0x00, 0x69, 0x02, 0x13] };
  const TOKEN = { 1: [0x01, 0x38, 0x40, 0x80, 0x69, 0x80, 0x15], 2: [0x02, 0x34, 0x42, 0x80, 0x69, 0x81, 0x16], 3: [0x04, 0x34, 0x44, 0x80, 0x69, 0x82, 0x17], 4: [0x08, 0x32, 0x46, 0x80, 0x69, 0x83, 0x18] };
  const MUSIC_ADDR = { EasternPalace: [0x2D59A], DesertPalace: [0x2D59B, 0x2D59C, 0x2D59D, 0x2D59E], TowerOfHera: [0x2D5C5, 0x2907A, 0x28B8C], PalaceOfDarkness: [0x2D5B8],
    SwampPalace: [0x2D5B7], SkullWoods: [0x2D5BA, 0x2D5BB, 0x2D5BC, 0x2D5BD, 0x2D608, 0x2D609, 0x2D60A, 0x2D60B], ThievesTown: [0x2D5C6], IcePalace: [0x2D5BF], MiseryMire: [0x2D5B9],
    TurtleRock: [0x2D5C7, 0x2D5A7, 0x2D5AA, 0x2D5AB] };
  const SM_PLM = { ETank: 0xEED7, Missile: 0xEEDB, Super: 0xEEDF, PowerBomb: 0xEEE3, Bombs: 0xEEE7, Charge: 0xEEEB, Ice: 0xEEEF, HiJump: 0xEEF3, SpeedBooster: 0xEEF7, Wave: 0xEEFB,
    Spazer: 0xEEFF, SpringBall: 0xEF03, Varia: 0xEF07, Plasma: 0xEF13, Grapple: 0xEF17, Morph: 0xEF23, ReserveTank: 0xEF27, Gravity: 0xEF0B, XRay: 0xEF0F, SpaceJump: 0xEF1B, ScrewAttack: 0xEF1F };

  function makePatch(world, worlds, seedGuid, seed, rnd, config) {
    const patches = [], st = new StringTable();
    const add = (off, bytes) => patches.push([off, Array.from(bytes)]);
    const rr = world.rewardRegions;
    // medallions
    const tr = world.GetRegion('Turtle Rock'), mm = world.GetRegion('Misery Mire');
    const trV = [[0x00, 0x51, 0x10, 0x00], [0x01, 0x51, 0x18, 0x00], [0x02, 0x14, 0xEF, 0xC4]][tr.Medallion];
    const mmV = [[0x00, 0x51, 0x00, 0x00], [0x01, 0x13, 0x9F, 0xF1], [0x02, 0x51, 0x08, 0x00]][mm.Medallion];
    [0x308023, 0xD020, 0xD0FF, 0xD1DE].forEach((a, i) => add(snes(a), [trV[i]]));
    [0x308022, 0xCFF2, 0xD0D1, 0xD1B0].forEach((a, i) => add(snes(a), [mmV[i]]));
    // rewards
    const R = RewardType;
    const crystals = shuffle([1, 2, 3, 4, 7], rnd).concat(shuffle([5, 6], rnd));
    const pendants = [1].concat(shuffle([2, 3], rnd));
    const of = (t) => rr.filter((x) => x.Reward === t);
    const rewardPatches = (regions, values, table) => regions.forEach((r, i) => { if (i < values.length) REWARD_ADDR[regionKey(r)].forEach((a, k) => add(snes(a), [table[values[i]][k]])); });
    rewardPatches(of(R.CrystalBlue).concat(of(R.CrystalRed)), crystals, CRYSTAL);
    rewardPatches(of(R.PendantGreen).concat(of(R.PendantNonGreen)), pendants, PENDANT);
    rewardPatches(of(R.BossTokenKraid).concat(of(R.BossTokenPhantoon), of(R.BossTokenDraygon), of(R.BossTokenRidley)), [1, 2, 3, 4], TOKEN);
    // dungeon music
    if (!config.Keysanity) {
      rr.filter((x) => x.isZ3 && x.Reward !== R.None && x.Reward !== R.Agahnim).forEach((r) => {
        const m = (r.Reward === R.PendantGreen || r.Reward === R.PendantNonGreen) ? 0x11 : 0x16;
        MUSIC_ADDR[r.kind].forEach((a) => add(snes(a), [m]));
      });
    }
    // digging game
    const digs = rnd.Next(30) + 1;
    add(snes(0x308020), [digs]); add(snes(0x1DFD95), [digs]);
    // drop prizes
    const dp = world.WorldState.DropPrizes;
    add(snes(0x6FA78), dp.Packs); add(snes(0x1DFBD4), dp.TreePulls); add(snes(0x6A9C8), [dp.CrabContinous]); add(snes(0x6A9C4), [dp.CrabFinal]);
    add(snes(0x6F993), [dp.Stun]); add(snes(0x1D82CC), [dp.Fish]);
    enemyPrizePacks(rnd).forEach(([o, b]) => add(snes(o), b));
    add(snes(0x6FA62), [1, 1, 1, 1, 1, 1, 1]);
    // uncle's equipment
    const uncle = world.GetLocation("Link's Uncle").Item;
    if (uncle.Type !== IT.ProgressiveSword) [[0xDD263, 0x00, 0x0E], [0xDD26B, 0x00, 0x0E], [0xDD293, 0x00, 0x0E], [0xDD29B, 0x00, 0x0E, 0xF7], [0xDD2B3, 0x02, 0x0E], [0xDD2BB, 0x02, 0x0E],
      [0xDD2E3, 0x02, 0x0E, 0xF7], [0xDD2EB, 0x02, 0x0E, 0xF7], [0xDD31B, 0x08, 0x0E, 0xE4], [0xDD323, 0x08, 0x0E, 0xE4]].forEach(([a, x, y, z]) => add(snes(a), [0x00, 0x00, z || 0xF6, 0xFF, x, y]));
    if (uncle.Type !== IT.ProgressiveShield) [[0xDD253, 0x00, 0xF6], [0xDD25B, 0x00, 0xF6], [0xDD283, 0x00, 0xF6], [0xDD28B, 0x00, 0xF7], [0xDD2CB, 0x02, 0xF6], [0xDD2FB, 0x02, 0xF7],
      [0xDD313, 0x08, 0xE4]].forEach(([a, x, z]) => add(snes(a), [0x00, 0x00, z, 0xFF, x, 0x0E]));
    // goal
    add(snes(0x30803E), [[0x03, 0x04, 0x02][config.Goal]]);
    if (config.Goal === 1) add(snes(0x30808B), [1]);
    add(snes(0x30805E), [world.TowerCrystals]); add(snes(0x30805F), [world.GanonCrystals]);
    st.set('sign_ganons_tower', 'You need ' + world.TowerCrystals + " crystals to enter Ganon's Tower.");
    st.set('sign_ganon', config.Goal === 2 ? 'You need to complete all the dungeons and bosses to defeat Ganon.' : 'You need ' + world.GanonCrystals + ' crystals to defeat Ganon.');
    add(snes(0xF47200), u16(world.TourianBossTokens));
    // the RNG block
    const block = []; for (let i = 0; i < 1024; i++) block.push(rnd.Next(0x100));
    add(0x420000, block);
    add(snes(0x308042), [0x01]);
    // texts
    const green = of(R.PendantGreen)[0], reds = of(R.CrystalRed);
    st.set('sahasrahla_quest_information', G().SahasrahlaReveal.replace('<dungeon>', green.Area));
    st.set('bomb_shop', G().BombShopReveal.replace('<first>', reds[0].Area).replace('<second>', reds[1].Area));
    st.set('blind_by_the_light', randomLine(rnd, TX.blind));
    st.set('kakariko_tavern_fisherman', randomLine(rnd, TX.tavernMan));
    st.set('ganon_fall_in', randomLine(rnd, TX.ganon));
    const silvers = world.Locations.find((l) => l.ItemIs(IT.SilverArrows, world));
    const silverRegion = silvers ? silvers.Region : world.GetRegion("Ganon's Tower");
    const third = G().GanonSilversReveal.single[silverRegion.kind === 'GanonsTower' ? 'local' : 'remote'].replace('<region>', silverRegion.Area);
    ['ganon_phase_3', 'ganon_phase_3_no_silvers', 'ganon_phase_3_no_silvers_alt'].forEach((n) => st.set(n, third));
    st.set('end_triforce', '{NOBORDER}\n' + randomLine(rnd, TX.triforceRoom));
    // the items: Super Metroid's PLMs, Zelda's item ids
    world.Regions.filter((r) => r.isSM).forEach((r) => r.Locations.forEach((l) => {
      let plm = SM_PLM[IT_NAME[l.Item.Type]] || 0xEFE0;
      plm += plm === 0xEFE0 ? (l.Type === 'Chozo' ? 4 : l.Type === 'Hidden' ? 8 : 0) : (l.Type === 'Chozo' ? 0x54 : l.Type === 'Hidden' ? 0xA8 : 0);
      add(snes(l.Address), u16(plm));
      if (plm >= 0xEFE0) add(snes(l.Address + 5), [z3ItemId(l, world)]);
    }));
    world.Regions.filter((r) => r.isZ3).forEach((r) => r.Locations.forEach((l) => {
      if (l.Type === 'HeraStandingKey') add(snes(0x9E3BB), [l.Item.Type === IT.KeyTH ? 0xE4 : 0xEB]);
      else if (l.Type === 'Pedestal') st.set('mastersword_pedestal_translated', itemTextbox(l.Item));
      else if (l.Type === 'Ether') st.set('tablet_ether_book', itemTextbox(l.Item));
      else if (l.Type === 'Bombos') st.set('tablet_bombos_book', itemTextbox(l.Item));
      add(snes(l.Address), [z3ItemId(l, world)]);
    }));
    add(snes(0x1C8000), st.padded());
    // keycard doors (keysanity), the Tourian plaque
    keycardDoors(world, config, add);
    if (config.Keysanity) { add(snes(0x40003B), [1]); add(snes(0x400045), [0x0f]); add(snes(0x40016A), [1]); }
    // player name, seed data, title
    let name = world.Player.length > 12 ? world.Player.slice(0, 12).trimEnd() : world.Player;
    const pad = Math.trunc((12 - name.length) / 2); name = (' '.repeat(pad) + name).padEnd(12);
    add(0x385000 + world.Id * 16, ascii(name).concat(u32(0)));
    const f1 = ((config.Race ? 1 : 0) << 15) | ((config.Keysanity ? 1 : 0) << 13) | (0 << 12) | (0 << 10) | (config.SMLogic << 8) | (11 << 4) | 3;
    const f2 = (config.SwordLocation << 14) | (config.MorphLocation << 12) | (config.Goal << 8);
    add(snes(0x80FF50), u16(world.Id)); add(snes(0x80FF52), u16(f1)); add(snes(0x80FF54), u32(seed)); add(snes(0x80FF58), u16(f2));
    add(snes(0x80FF5A), [0, 0, 0, 0, 0, 0]); add(snes(0x80FF60), ascii(seedGuid)); add(snes(0x80FF80), ascii(world.Guid));
    const title = ascii(('ZSM11.3.2C' + (config.SMLogic ? 'H' : 'N') + (seed >>> 0).toString(16).toUpperCase().padStart(8, '0')).padEnd(21).slice(0, 21));
    add(snes(0x00FFC0), title); add(snes(0x80FFC0), title);
    if (config.Keysanity) add(snes(0xF47006), u16(1));
    add(snes(0x403039), [0x68]);   // initial items: none but the default flags
    return patches;
  }
  function z3ItemId(l, world) {
    const it = l.Item;
    if (l.Type === 'NotInDungeon' || !(it.IsDungeonItem && l.Region.IsRegionItem(it) && it.World === world)) return it.Type;
    return it.IsKey ? IT.Key : it.IsBigKey ? IT.BigKey : it.IsMap ? IT.Map : IT.Compass;
  }
  function enemyPrizePacks(rnd) {
    const off = 0xDB632;
    const packs = [[0x6888D, [0x00]], [0x688A8, [0x00]], [0x68967, [0x00, 0x00]], [0x69125, [0x00, 0x00]], [off + 0x01, [0x90]], [off + 0x08, [0x00]], [off + 0x0A, [0x00]],
      [off + 0x0D, [0x80, 0x90]], [off + 0x11, [0x90, 0x90, 0x00]], [off + 0x18, [0x90, 0x90]], [off + 0x20, [0x00]], [off + 0x22, [0x80, 0x00, 0x00]],
      [off + 0x41, [0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x10, 0x90, 0x90, 0x80]], [off + 0x4F, [0x80]], [off + 0x51, [0x80]], [off + 0x55, [0x00, 0x00]],
      [off + 0x58, [0x90]], [off + 0x64, [0x80]], [off + 0x6A, [0x90, 0x90]], [off + 0x6D, [0x80, 0x80]], [off + 0x71, [0x80]], [off + 0x7C, [0x90]], [off + 0x81, [0xC0]],
      [off + 0x83, [0x10, 0x10, 0x10, 0x00]], [off + 0x8B, [0x10]], [off + 0x8E, [0x00, 0x00]], [off + 0x91, [0x10]], [off + 0x99, [0x10]], [off + 0x9B, [0x10]],
      [off + 0xA5, [0x10, 0x10, 0x10, 0x80, 0x80, 0x80]], [off + 0xC7, [0x10]], [off + 0xC9, [0x10]], [off + 0xD0, [0x10]], [off + 0xD3, [0x00]]];
    const n = packs.reduce((s, p) => s + p[1].length, 0);
    // PrizePackRandomization(n, 1): at least one of each of the 7 packs
    const m = 7, g = [0, 1, 2, 3, 4, 5, 6], seq = [];
    for (let left = m * n; left > 0; left -= m) {
      const r = rnd.Next(left), k = Math.trunc(r / m);
      seq.push((k < g.length ? g[k] : r % m) + 1);
      if (k < g.length) g.splice(k, 1);
    }
    let at = 0;
    const out = packs.map(([o, b]) => [o, b.map((x) => x | seq[at++])]);
    const pop2 = out.find((p) => p[0] === off + 0x4F);
    out.push([off + 0x4E, pop2[1]]);
    return out;
  }
  function keycardDoors(world, config, add) {
    const plaquePlm = 0xd410; let pos = 0xf800;
    const P = { Level1: 0xe0, Level2: 0xe1, Boss: 0xe2, None: 0x00, Zero: 0xe3 };
    const D = { Left: 0xd414, Right: 0xd41a, Up: 0xd420, Down: 0xd426, BossLeft: 0xc842, BossRight: 0xc848 };
    if (config.Keysanity) {
      const E = { CL1: 0x0000, CL2: 0x0100, CB: 0x0200, BL1: 0x0300, BL2: 0x0400, BB: 0x0500, NL1: 0x0600, NL2: 0x0700, NB: 0x0800, ML1: 0x0900, ML2: 0x0a00, MB: 0x0b00,
        WL1: 0x0c00, WB: 0x0d00, LL1: 0x0e00, LB: 0x0f00 };
      const doors = [
        [0x91F8, D.Right, 0x2601, E.CL1, P.Level1, 0x2400, 0x0000], [0x91F8, D.Left, 0x168E, E.CL1, P.Level1, 0x148F, 0x801E], [0x948C, D.Left, 0x062E, E.CL2, P.Level2, 0x042F, 0x8222],
        [0x99BD, D.Left, 0x660E, E.CB, P.Boss, 0x640F, 0x8470], [0x9879, D.Left, 0x062E, E.CB, P.Boss, 0x042F, 0x8420],
        [0x9F11, D.Left, 0x060E, E.BL1, P.Level1, 0x040F, 0x8784],
        [0x9AD9, D.Right, 0xA601, E.BL2, P.Level2, 0xA400, 0x0000], [0x9D9C, D.Down, 0x0336, E.BB, P.Boss, 0x0234, 0x863A], [0xA130, D.Left, 0x161E, E.BL2, P.Level2, 0x141F, 0x881C],
        [0xA0A4, D.Left, 0x062E, E.BL2, P.Level2, 0x042F, 0x0000],
        [0xA56B, D.Left, 0x161E, E.BB, P.Boss, 0x141F, 0x8A1A],
        [0xA7DE, D.Right, 0x3601, E.NL1, P.Level1, 0x3400, 0x8B00], [0xA923, D.Right, 0x0601, E.NL1, P.Level1, 0x0400, 0x0000],
        [0xA788, D.Left, 0x162E, E.NL2, P.Level2, 0x142F, 0x8AEA], [0xAF72, D.Left, 0x061E, E.NL2, P.Level2, 0x041F, 0x0000], [0xAEDF, D.Down, 0x0206, E.NL2, P.Level2, 0x0204, 0x0000],
        [0xAD5E, D.Right, 0x0601, E.NL2, P.Level2, 0x0400, 0x0000],
        [0xA923, D.Up, 0x2DC6, E.NB, P.Boss, 0x2EC4, 0x8B96],
        [0xB4AD, D.Left, 0x160E, E.LL1, P.Level1, 0x140F, 0x0000], [0xAD5E, D.Left, 0x065E, E.LL1, P.Level1, 0x045F, 0x0000], [0xB37A, D.Right, 0x0601, E.LB, P.Boss, 0x0400, 0x8EA6],
        [0xD0B9, D.Left, 0x065E, E.ML1, P.Level1, 0x045F, 0x0000], [0xD5A7, D.Right, 0x1601, E.ML1, P.Level1, 0x1400, 0x0000],
        [0xD617, D.Left, 0x063E, E.ML2, P.Level2, 0x043F, 0x0000], [0xD913, D.Right, 0x2601, E.ML2, P.Level2, 0x2400, 0x0000],
        [0xD78F, D.Right, 0x2601, E.MB, P.Boss, 0x2400, 0xC73B],
        [0xDA2B, D.BossLeft, 0x164E, 0x00f0, P.None, 0x144F, 0x0000],
        [0x93FE, D.Left, 0x167E, E.WL1, P.Level1, 0x147F, 0x0000], [0x968F, D.Left, 0x060E, E.WL1, P.Level1, 0x040F, 0x0000], [0xCE40, D.Left, 0x060E, E.WL1, P.Level1, 0x040F, 0x0000],
        [0xCC6F, D.Left, 0x064E, E.WB, P.Boss, 0x044F, 0xC29D],
      ];
      let doorId = 0;
      for (const d of doors) {
        if (d[0] === 0x99BD && config.Goal === 1) continue;
        const args = d[4] !== P.None ? (doorId | d[3]) : d[3];
        if (d[6] === 0) { add(snes(0x8f0000 + pos), [].concat(u16(d[0]), u16(d[1]), u16(d[2]), u16(args))); pos += 8; }
        else {
          add(snes(0x8f0000 + d[6]), [].concat(u16(d[1]), u16(d[2]), u16(args)));
          if ((d[3] === E.BB && d[0] !== 0x9D9C) || d[3] === E.LB || d[3] === E.MB || d[3] === E.WB) add(snes(0x8f0000 + d[6] + 0x06), [0x2F, 0xB6, 0, 0, 0, 0, 0x2F, 0xB6, 0, 0, 0, 0]);
        }
        if (d[4] !== P.None) { add(snes(0x8f0000 + pos), [].concat(u16(d[0]), u16(plaquePlm), u16(d[5]), u16(d[4]))); pos += 8; }
        doorId += 1;
      }
    }
    if (config.OpenTourian !== 4) { add(snes(0x8f0000 + pos), [].concat(u16(0xA5ED), u16(plaquePlm), u16(0x044F), u16(P.Zero + world.TourianBossTokens))); pos += 8; }
    add(snes(0x8f0000 + pos), [0, 0, 0, 0, 0, 0, 0, 0]);
  }

  // ── options, as samus.link offers them (value: [label, setting])
  const OPTIONS = [
    { key: 'smlogic', label: 'Super Metroid logic', def: 'normal', values: [['normal', 'Normal', 0], ['hard', 'Hard', 1]] },
    { key: 'goal', label: 'Goal', def: 'defeatboth', values: [['defeatboth', 'Defeat Ganon and Mother Brain', 0], ['fastganondefeatmotherbrain', 'Fast Ganon and Defeat Mother Brain', 1], ['alldungeonsdefeatmotherbrain', 'All Dungeons and Defeat Mother Brain', 2]] },
    { key: 'opentower', label: "Open Ganon's Tower", def: 'sevencrystals', values: [['random', 'Random', -1]].concat(['No Crystals', 'One Crystal', 'Two Crystals', 'Three Crystals', 'Four Crystals', 'Five Crystals', 'Six Crystals', 'Seven Crystals'].map((d, i) => [d.toLowerCase().replace(/ /g, ''), d, i])) },
    { key: 'ganonvulnerable', label: 'Ganon vulnerable', def: 'sevencrystals', values: [['random', 'Random', -1]].concat(['No Crystals', 'One Crystal', 'Two Crystals', 'Three Crystals', 'Four Crystals', 'Five Crystals', 'Six Crystals', 'Seven Crystals'].map((d, i) => [d.toLowerCase().replace(/ /g, ''), d, i])) },
    { key: 'opentourian', label: 'Open Tourian', def: 'fourbosses', values: [['random', 'Random', -1]].concat(['No Bosses', 'One Boss', 'Two Bosses', 'Three Bosses', 'Four Bosses'].map((d, i) => [d.toLowerCase().replace(/ /g, ''), d, i])) },
    { key: 'swordlocation', label: 'First sword', def: 'randomized', values: [['randomized', 'Randomized', 0], ['early', 'Early', 1], ['uncle', 'Uncle assured', 2]] },
    { key: 'morphlocation', label: 'Morph Ball', def: 'randomized', values: [['randomized', 'Randomized', 0], ['early', 'Early', 1], ['original', 'Original location', 2]] },
    { key: 'keyshuffle', label: 'Key shuffle', def: 'none', values: [['none', 'None', 0], ['keysanity', 'Keysanity', 1]] },
    { key: 'race', label: 'Race ROM (no spoilers)', def: 'false', values: [['false', 'Off', false], ['true', 'On', true]] },
  ];
  function parseConfig(o) {
    const v = (k) => { const opt = OPTIONS.find((x) => x.key === k), want = String((o && o[k]) || opt.def).toLowerCase(); const hit = opt.values.find((x) => x[0] === want) || opt.values.find((x) => x[0] === opt.def); return hit[2]; };
    const c = { SMLogic: v('smlogic'), Goal: v('goal'), OpenTower: v('opentower'), GanonVulnerable: v('ganonvulnerable'), OpenTourian: v('opentourian'), SwordLocation: v('swordlocation'),
      MorphLocation: v('morphlocation'), KeyShuffle: v('keyshuffle'), Race: v('race'), Z3Logic: 0, GameMode: 0 };
    c.Keysanity = c.KeyShuffle !== 0; c.SingleWorld = true; c.MultiWorld = false;
    return c;
  }
  function hexGuid() { const b = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256 | 0; }); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); }

  // ── the whole seed
  function generate(options, seedText) {
    let seed;
    if (seedText === undefined || seedText === null || seedText === '') seed = Math.floor(Math.random() * 2147483647);
    else { seed = parseInt(seedText, 10); if (!(seed >= 0 && seed <= 2147483647)) throw new Error('The seed is a number from 0 to 2147483647.'); }
    const config = parseConfig(options);
    let rnd = new NetRandom(seed);
    if (config.Race) rnd = new NetRandom(rnd.Next());
    const world = new World(config, 'Player', 0, hexGuid());
    const filler = new Filler([world], config, rnd);
    filler.Fill();
    const spheres = config.Race ? [] : playthrough([world], config);
    const patchSeed = rnd.Next();
    const patches = makePatch(world, [world], hexGuid(), config.Race ? 0 : seed, new NetRandom(patchSeed), config);
    return { seed, config, world, patches, playthrough: spheres,
      locations: world.Locations.map((l) => ({ id: l.Id, name: l.Name, region: l.Region.Name, area: l.Region.Area, item: l.Item.Type, itemName: l.Item.Name })),
      rewards: world.rewardRegions.map((r) => ({ region: r.Name, area: r.Area, reward: REWARD_DESC[r.Reward] || 'None' })),
      medallions: { 'Misery Mire': MEDALLION_NAME[world.GetRegion('Misery Mire').Medallion], 'Turtle Rock': MEDALLION_NAME[world.GetRegion('Turtle Rock').Medallion] },
      towerCrystals: world.TowerCrystals, ganonCrystals: world.GanonCrystals, tourianBosses: world.TourianBossTokens };
  }

  // ── the ROM: Super Metroid + Zelda merged into ExHiROM, the base patch, the seed
  function mergeRoms(sm, z3) {
    const rom = new Uint8Array(0x600000);
    let pos = 0;
    for (let i = 0; i < 0x40; i++) {
      rom.set(sm.subarray((i + 0x40) * 0x8000, (i + 0x41) * 0x8000), pos);
      rom.set(sm.subarray(i * 0x8000, (i + 1) * 0x8000), pos + 0x8000);
      pos += 0x10000;
    }
    pos = 0x400000;
    for (let i = 0; i < 0x20; i++) { rom.set(z3.subarray(i * 0x8000, (i + 1) * 0x8000), pos + 0x8000); pos += 0x10000; }
    return rom;
  }
  function applyIps(rom, p) {
    let o = 5;
    while (o + 3 < p.length) {
      const dest = (p[o] << 16) | (p[o + 1] << 8) | p[o + 2], len = (p[o + 3] << 8) | p[o + 4];
      o += 5;
      if (len > 0) { rom.set(p.subarray(o, o + len), dest); o += len; }
      else { const rl = (p[o] << 8) | p[o + 1]; rom.fill(p[o + 2], dest, dest + rl); o += 3; }
    }
  }
  // the web client's own defaults (samus.link "Patch" settings): red hearts, half-speed heart beep, no quick swap, energy beep on
  function clientDefaults(rom) {
    const pc = (a) => (a < 0x800000 ? 0x400000 : 0) | (a & 0x3FFFFF);
    for (let i = 0; i < 20; i += 2) rom[pc(0xDFA1E + i)] = 0x24;
    rom.set([0x18, 0x00], pc(0x1BD6AA));
    rom[0x400033] = 0x40;
    rom[0x40004B] = 0x00;
  }
  function buildRom(sm, z3, ips, result) {
    const rom = mergeRoms(sm, z3);
    applyIps(rom, ips);
    clientDefaults(rom);
    result.patches.forEach(([o, b]) => rom.set(b, o));
    return rom;
  }

  // ── for the tracker: the world as a given SMZ3 ROM has it (its settings,
  // dungeon prizes, medallions, crystal counts), any SMZ3 v11 ROM, ours or samus.link's
  const PRIZE_CODE = { 0x10: RewardType.CrystalBlue, 0x11: RewardType.CrystalRed, 0x12: RewardType.PendantGreen, 0x13: RewardType.PendantNonGreen, 0x14: RewardType.PendantNonGreen,
    0x15: RewardType.BossTokenKraid, 0x16: RewardType.BossTokenPhantoon, 0x17: RewardType.BossTokenDraygon, 0x18: RewardType.BossTokenRidley };
  function romWorld(rom) {
    if (!rom || rom.length < 0x600000) return null;
    const at = (a) => rom[snes(a)];
    const title = String.fromCharCode.apply(null, Array.from(rom.subarray(snes(0x00FFC0), snes(0x00FFC0) + 9)));
    if (!/^ZSM/.test(title)) return null;
    const f1 = at(0x80FF52) | at(0x80FF53) << 8, f2 = at(0x80FF58) | at(0x80FF59) << 8;
    const config = parseConfig({});
    config.SMLogic = (f1 >> 8) & 3; config.KeyShuffle = (f1 >> 13) & 1; config.Keysanity = !!config.KeyShuffle; config.Race = !!((f1 >> 15) & 1);
    config.Goal = (f2 >> 8) & 3; config.SwordLocation = (f2 >> 14) & 3; config.MorphLocation = (f2 >> 12) & 3;
    const world = new World(config, 'Player', 0, '');
    world.rewardRegions.forEach((r) => { if (r.Reward !== RewardType.Agahnim) { const k = REWARD_ADDR[regionKey(r)]; r.Reward = k ? (PRIZE_CODE[at(k[6])] || RewardType.None) : RewardType.None; } });
    world.GetRegion('Misery Mire').Medallion = at(0x308022) % 3;
    world.GetRegion('Turtle Rock').Medallion = at(0x308023) % 3;
    world.WorldState = { TowerCrystals: at(0x30805E), GanonCrystals: at(0x30805F), TourianBossTokens: at(0xF47200) };
    world.rewardLookup = {};
    for (let i = 0; i < 512; i++) world.rewardLookup[i] = world.rewardRegions.filter((x) => (x.Reward & i) !== 0);
    return { world, config, version: title.slice(3), rewardName: (r) => REWARD_DESC[r.Reward] || '', medallionName: (r) => MEDALLION_NAME[r.Medallion] };
  }
  // a Progression from item types (and, by default, every dungeon key and the keycards: the tracker doesn't count keys)
  function progression(types, world, opts) {
    const items = types.map((t) => new Item(t, world));
    if (!(opts && opts.exactKeys)) {
      Item.CreateDungeonPool(world).forEach((i) => items.push(i));
      Item.CreateKeycards(world).forEach((i) => items.push(i));
    }
    return new Progression(items);
  }
  // a blank world (no ROM): the locations and regions, for the tracker's lists
  function blankWorld(options) { return new World(parseConfig(options || {}), 'Player', 0, ''); }

  window.SMZ3Gen = { generate, buildRom, mergeRoms, applyIps, OPTIONS, NetRandom, IT, IT_NAME, IT_DESC, REWARD_DESC, RewardType, romWorld, progression, blankWorld, snes, version: '11.3.2' };
})();
