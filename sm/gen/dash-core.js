var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../../../tmp/tmp.1FRopwCRfN/buffer-shim.js
var Buffer2 = {
  from(x, enc) {
    if (typeof x === "string" && enc === "base64") {
      const s = atob(x);
      const u = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return wrap(u);
    }
    return wrap(x instanceof Uint8Array ? x : new Uint8Array(x));
  }
};
function wrap(u) {
  u.toString = function(enc) {
    if (enc === "base64") {
      let s = "";
      for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
      return btoa(s);
    }
    return Uint8Array.prototype.toString.call(this);
  };
  return u;
}

// ../../../tmp/tmp.1FRopwCRfN/buffer-global.js
globalThis.Buffer = Buffer2;

// ../../../tmp/dash/packages/core/lib/bps-patch.js
var BpsPatch = class _BpsPatch {
  constructor(buffer) {
    this.patchBuffer = buffer;
  }
  Apply(bytes) {
    if (!_BpsPatch.IsBpsPatch(this.patchBuffer)) {
      return null;
    }
    this.patchOffset = 4;
    var sourceSize = this.Decode();
    var targetSize = this.Decode();
    var metaDataSize = this.Decode();
    var source = bytes;
    var target = new Uint8Array(targetSize);
    if (metaDataSize > 0) {
      this.patchOffset += metaDataSize;
    }
    var outputOffset = 0;
    var sourceRelativeOffset = 0;
    var targetRelativeOffset = 0;
    let eof = this.patchBuffer.length - 12;
    if (!this.VerifyChecksum(source, eof)) {
      throw "Source Checksum Mismatch";
    }
    var patch = this.patchBuffer.slice(0, eof + 8);
    if (!this.VerifyChecksum(patch, eof + 8)) {
      throw "Patch Checksum Mismatch";
    }
    while (this.patchOffset < eof) {
      var data = this.Decode();
      var command = data & 3;
      var length = (data >> 2) + 1;
      switch (command) {
        case 0:
          while (length--) {
            target[outputOffset] = source[outputOffset];
            outputOffset++;
          }
          break;
        case 1:
          while (length--) {
            target[outputOffset++] = this.Read();
          }
          break;
        case 2:
          var data = this.Decode();
          sourceRelativeOffset += (data & 1 ? -1 : 1) * (data >> 1);
          while (length--) {
            target[outputOffset++] = source[sourceRelativeOffset++];
          }
          break;
        case 3:
          var data = this.Decode();
          targetRelativeOffset += (data & 1 ? -1 : 1) * (data >> 1);
          while (length--) {
            target[outputOffset++] = target[targetRelativeOffset++];
          }
          break;
      }
    }
    if (!this.VerifyChecksum(target, eof + 4)) {
      throw "Target Checksum Mismatch";
    }
    return target;
  }
  static CRC32(buffer) {
    if (typeof _BpsPatch.crcTable == "undefined") {
      var c;
      _BpsPatch.crcTable = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        }
        _BpsPatch.crcTable[n] = c;
      }
    }
    var crc = 0 ^ -1;
    for (var i = 0; i < buffer.length; i++) {
      crc = crc >>> 8 ^ _BpsPatch.crcTable[(crc ^ buffer[i]) & 255];
    }
    return (crc ^ -1) >>> 0;
  }
  Decode() {
    var data = 0, shift = 1;
    while (true) {
      var x = this.Read();
      data += (x & 127) * shift;
      if ((x & 128) != 0) break;
      shift <<= 7;
      data += shift;
    }
    return data;
  }
  static IsBpsPatch(bytes) {
    var dec = new TextDecoder("utf-8");
    return dec.decode(bytes.slice(0, 4)) == "BPS1";
  }
  static async Load(FileName) {
    let response = await fetch(FileName);
    let buffer = await response.arrayBuffer();
    let bytes = new Uint8Array(buffer);
    if (!_BpsPatch.IsBpsPatch(bytes)) {
      return null;
    }
    return new _BpsPatch(bytes);
  }
  Read() {
    return this.patchBuffer[this.patchOffset++];
  }
  VerifyChecksum(bytes, index) {
    var crc = _BpsPatch.CRC32(bytes);
    return (crc & 255) == this.patchBuffer[index] & (crc >> 8 & 255) == this.patchBuffer[index + 1] & (crc >> 16 & 255) == this.patchBuffer[index + 2] & (crc >> 24 & 255) == this.patchBuffer[index + 3];
  }
};
var bps_patch_default = BpsPatch;

// ../../../tmp/dash/packages/core/lib/dotnet-random.js
var DotNetRandom = class {
  constructor(Seed) {
    __publicField(this, "MBIG", 2147483647);
    __publicField(this, "MSEED", 161803398);
    __publicField(this, "inext");
    __publicField(this, "inextp");
    __publicField(this, "SeedArray", new Array(56));
    const Int32MinValue = -2147483648;
    const Int32MaxValue = 2147483647;
    if (Seed < Int32MinValue) {
      throw new Error(`DotNetRandom: Seed too small ${Seed}`);
    }
    if (Seed > Int32MaxValue) {
      throw new Error(`DotNetRandom: Seed too large ${Seed}`);
    }
    let subtraction = Seed == Int32MinValue ? Int32MaxValue : Math.abs(Seed);
    let mj = this.MSEED - subtraction;
    this.SeedArray[55] = mj;
    let mk = 1;
    let ii;
    for (let i = 1; i < 55; i++) {
      ii = 21 * i % 55;
      this.SeedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += this.MBIG;
      mj = this.SeedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this.SeedArray[i] -= this.SeedArray[1 + (i + 30) % 55];
        if (this.SeedArray[i] < 0) this.SeedArray[i] += this.MBIG;
      }
    }
    this.inext = 0;
    this.inextp = 21;
    Seed = 1;
  }
  /*====================================Sample====================================
      **Action: Return a new random number [0..1) and reSeed the Seed array.
      **Returns: A double [0..1)
      **Arguments: None
      **Exceptions: None
      ==============================================================================*/
  Sample() {
    return this.InternalSample() * (1 / this.MBIG);
  }
  InternalSample() {
    let locINext = this.inext;
    let locINextp = this.inextp;
    if (++locINext >= 56) locINext = 1;
    if (++locINextp >= 56) locINextp = 1;
    let retVal = this.SeedArray[locINext] - this.SeedArray[locINextp];
    if (retVal == this.MBIG) retVal--;
    if (retVal < 0) retVal += this.MBIG;
    this.SeedArray[locINext] = retVal;
    this.inext = locINext;
    this.inextp = locINextp;
    return retVal;
  }
  /*=====================================Next=====================================
      **Returns: An int [0..Int32.MaxValue)
      **Arguments: None
      **Exceptions: None.
      ==============================================================================*/
  Next() {
    return this.InternalSample();
  }
  GetSampleForLargeRange() {
    let result = this.InternalSample();
    let negative = this.InternalSample() % 2 == 0 ? true : false;
    if (negative) {
      result = -result;
    }
    let d = result;
    d += this.MBIG - 1;
    d /= 2 * this.MBIG - 1;
    if (d < 0) {
      console.log("negative");
    }
    return d;
  }
  /*=====================================Next=====================================
      **Returns: An int [minvalue..maxvalue)
      **Arguments: minValue -- the least legal value for the Random number.
      **           maxValue -- One greater than the greatest legal return value.
      **Exceptions: None.
      ==============================================================================*/
  NextInRange(minValue, maxValue) {
    const methodName = "DotNetRandom::Next(minValue,maxValue)";
    if (minValue > maxValue) {
      console.log(methodName + " = min greater than max");
    }
    if (!Number.isInteger(minValue)) {
      console.log(methodName + " = min is non-integer");
    }
    if (!Number.isInteger(maxValue)) {
      console.log(methodName + " = max is non-integer");
    }
    const range = maxValue - minValue;
    if (range <= this.MBIG) {
      return Math.floor(this.Sample() * range) + minValue;
    } else {
      return Math.floor(this.GetSampleForLargeRange() * range) + minValue;
    }
  }
  /*=====================================Next=====================================
      **Returns: An int [0..maxValue)
      **Arguments: maxValue -- One more than the greatest legal return value.
      **Exceptions: None.
      ==============================================================================*/
  Next(maxValue) {
    const methodName = "DotNetRandom::Next()";
    if (maxValue < 0) {
      console.log(methodName + " = max is less than zero");
    }
    if (!Number.isInteger(maxValue)) {
      console.log(methodName + " = max is non-integer");
    }
    return Math.floor(this.Sample() * maxValue);
  }
  /*=====================================Next=====================================
      **Returns: A double [0..1)
      **Arguments: None
      **Exceptions: None
      ==============================================================================*/
  NextDouble() {
    return this.Sample();
  }
  /*==================================NextBytes===================================
      **Action:  Fills the byte array with random bytes [0..0x7f].  The entire array is filled.
      **Returns:Void
      **Arugments:  buffer -- the array to be filled.
      **Exceptions: None
      ==============================================================================*/
  /*NextBytes (buffer)
      {
         if (buffer == null) throw new ArgumentNullException ("buffer");
         Contract.EndContractBlock ();
         for (let i = 0; i < buffer.Length; i++)
         {
            buffer[i] = (byte)(InternalSample () % (0xff + 1));
         }
      }*/
};
var dotnet_random_default = DotNetRandom;

// ../../../tmp/dash/packages/core/lib/locations.ts
var Area = Object.freeze({
  Crateria: 0,
  GreenBrinstar: 1,
  RedBrinstar: 2,
  KraidsLair: 3,
  CrocomiresLair: 4,
  WreckedShip: 5,
  EastMaridia: 6,
  WestMaridia: 7,
  UpperNorfair: 8,
  LowerNorfair: 9
});
var AreaCounts = /* @__PURE__ */ new Map([
  [Area.Crateria, 3113017],
  [Area.GreenBrinstar, 3113019],
  [Area.UpperNorfair, 3113021],
  [Area.WreckedShip, 3113023],
  [Area.EastMaridia, 3113025],
  [Area.RedBrinstar, 3113033],
  [Area.KraidsLair, 3113035],
  [Area.WestMaridia, 3113037],
  [Area.LowerNorfair, 3113039],
  [Area.CrocomiresLair, 3113041]
]);
var Location = class _Location {
  constructor(address, modifier, area, name) {
    this.address = address;
    this.modifier = modifier;
    this.area = area;
    this.name = name;
  }
  Clone() {
    return new _Location(this.address, this.modifier, this.area, this.name);
  }
  GetItemBytes(itemCode) {
    const code = itemCode + this.modifier;
    return new Uint8Array([code & 255, code >> 8 & 255]);
  }
  GetItemCode(bytes) {
    const code = bytes[this.address + 1] << 8 & 65280 | bytes[this.address] & 255;
    return code - this.modifier;
  }
};
var getArea = (area) => {
  for (const [k, v] of Object.entries(Area)) {
    if (k === area) {
      return v;
    }
  }
  return -1;
};
var loc = (addr, modifier, area, _id, name) => {
  return new Location(addr, modifier, area, name);
};
var getLocations = () => [
  loc(493278, 0, Area.Crateria, 1, "Morphing Ball"),
  loc(491980, 0, Area.Crateria, 2, "Power Bombs (Landing Site)"),
  loc(492008, 0, Area.WreckedShip, 3, "Missiles (Ocean Bottom)"),
  loc(492014, 168, Area.WreckedShip, 4, "Missiles (Sky)"),
  loc(492020, 0, Area.WreckedShip, 5, "Missiles (Ocean Middle)"),
  loc(492104, 0, Area.Crateria, 6, "Missiles (Moat)"),
  loc(492132, 0, Area.Crateria, 7, "Energy Tank (Gauntlet)"),
  loc(492526, 0, Area.Crateria, 8, "Missiles (Mother Brain)"),
  loc(492548, 84, Area.Crateria, 9, "Bombs"),
  loc(492594, 0, Area.Crateria, 10, "Energy Tank (Terminator)"),
  loc(492644, 0, Area.Crateria, 11, "Missiles (Gauntlet Right)"),
  loc(492650, 0, Area.Crateria, 12, "Missiles (Gauntlet Left)"),
  loc(492664, 0, Area.Crateria, 13, "Supers (Climb)"),
  loc(492678, 0, Area.Crateria, 14, "Missiles (230)"),
  loc(492716, 84, Area.GreenBrinstar, 15, "Power Bombs (Etecoons)"),
  loc(492772, 84, Area.GreenBrinstar, 16, "Supers (Spore Spawn)"),
  loc(492824, 0, Area.GreenBrinstar, 17, "Missiles (Early Bridge)"),
  loc(492830, 0, Area.GreenBrinstar, 18, "Supers (Early Bridge)"),
  loc(492844, 84, Area.GreenBrinstar, 19, "Reserve Tank (Brinstar)"),
  loc(492850, 168, Area.GreenBrinstar, 20, "Missiles (Brin Reserve 2)"),
  loc(492856, 0, Area.GreenBrinstar, 21, "Missiles (Brin Reserve 1)"),
  loc(493064, 0, Area.GreenBrinstar, 22, "Missiles (Big Pink)"),
  loc(493070, 0, Area.GreenBrinstar, 23, "Missiles (Charge)"),
  loc(493076, 84, Area.GreenBrinstar, 24, "Charge Beam"),
  loc(493148, 0, Area.GreenBrinstar, 25, "Power Bombs (Mission Impossible)"),
  loc(493174, 0, Area.GreenBrinstar, 26, "Missiles (Brin Tube)"),
  loc(493388, 0, Area.Crateria, 27, "Power Bombs (Morph)"),
  loc(493464, 0, Area.Crateria, 28, "Missiles (Beta)"),
  loc(493470, 168, Area.Crateria, 29, "Energy Tank (Brinstar Ceiling)"),
  loc(493506, 0, Area.GreenBrinstar, 30, "Energy Tank (Etecoons)"),
  loc(493520, 0, Area.GreenBrinstar, 31, "Supers (Etecoons)"),
  loc(493562, 0, Area.GreenBrinstar, 32, "Energy Tank (Waterway)"),
  loc(493570, 84, Area.Crateria, 33, "Missiles (Alpha)"),
  loc(493604, 0, Area.GreenBrinstar, 34, "Energy Tank (Wave Gate)"),
  loc(493622, 0, Area.Crateria, 35, "Missiles (Billy Mays 1)"),
  loc(493628, 168, Area.Crateria, 36, "Missiles (Billy Mays 2)"),
  loc(493686, 84, Area.RedBrinstar, 37, "Xray Scope"),
  loc(493770, 0, Area.RedBrinstar, 38, "Power Bombs (Beta)"),
  loc(493838, 84, Area.RedBrinstar, 39, "Power Bombs (Alpha)"),
  loc(493844, 0, Area.RedBrinstar, 40, "Missiles (Alpha PBs)"),
  loc(493934, 84, Area.RedBrinstar, 41, "Spazer"),
  loc(493980, 168, Area.KraidsLair, 42, "Energy Tank (Kraid)"),
  loc(494060, 168, Area.KraidsLair, 43, "Missiles (Kraid)"),
  loc(494282, 84, Area.KraidsLair, 44, "Varia Suit"),
  loc(518650, 84, Area.WreckedShip, 101, "Varia Suit"),
  loc(518699, 84, Area.EastMaridia, 102, "Varia Suit"),
  loc(518601, 84, Area.LowerNorfair, 103, "Varia Suit"),
  loc(494308, 168, Area.UpperNorfair, 45, "Missiles (Cathedral)"),
  loc(494372, 84, Area.UpperNorfair, 46, "Ice Beam"),
  loc(494406, 168, Area.UpperNorfair, 47, "Missiles (Crumble Shaft)"),
  loc(494500, 0, Area.CrocomiresLair, 48, "Energy Tank (Crocomire)"),
  loc(494508, 84, Area.UpperNorfair, 49, "HiJump Boots"),
  loc(494528, 0, Area.UpperNorfair, 50, "Missiles (Croc Escape)"),
  loc(494566, 0, Area.UpperNorfair, 51, "Missiles (HJB)"),
  loc(494572, 0, Area.UpperNorfair, 52, "Energy Tank (HJB)"),
  loc(494596, 0, Area.CrocomiresLair, 53, "Power Bombs (Crocomire)"),
  loc(494612, 0, Area.CrocomiresLair, 54, "Missiles (Cosine)"),
  loc(494634, 0, Area.CrocomiresLair, 55, "Missiles (Indiana Jones)"),
  loc(494646, 84, Area.CrocomiresLair, 56, "Grapple Beam"),
  loc(494654, 84, Area.UpperNorfair, 57, "Reserve Tank (Norfair)"),
  loc(494660, 168, Area.UpperNorfair, 58, "Missiles (Norfair Reserve 2)"),
  loc(494674, 0, Area.UpperNorfair, 59, "Missiles (Norfair Reserve 1)"),
  loc(494694, 0, Area.UpperNorfair, 60, "Missiles (Bubble Mountain)"),
  loc(494708, 168, Area.UpperNorfair, 61, "Missiles (Speed)"),
  loc(494722, 84, Area.UpperNorfair, 62, "Speed Booster"),
  loc(494780, 0, Area.UpperNorfair, 63, "Missiles (Wave)"),
  loc(494794, 84, Area.UpperNorfair, 64, "Wave Beam"),
  loc(495214, 0, Area.LowerNorfair, 65, "Missiles (GT)"),
  loc(495220, 168, Area.LowerNorfair, 66, "Supers (GT)"),
  loc(495408, 0, Area.LowerNorfair, 67, "Missiles (Mickey Mouse)"),
  loc(495562, 0, Area.LowerNorfair, 68, "Missiles (Maze)"),
  loc(495570, 0, Area.LowerNorfair, 69, "Power Bombs (Maze)"),
  loc(495808, 0, Area.LowerNorfair, 70, "Power Bombs (Shame)"),
  loc(495872, 0, Area.LowerNorfair, 71, "Missiles (Three Musketeers)"),
  loc(495880, 168, Area.LowerNorfair, 72, "Energy Tank (Ridley)"),
  loc(519555, 168, Area.KraidsLair, 107, "Energy Tank (Ridley)"),
  loc(519604, 168, Area.WreckedShip, 108, "Energy Tank (Ridley)"),
  loc(519653, 168, Area.EastMaridia, 109, "Energy Tank (Ridley)"),
  loc(495888, 84, Area.LowerNorfair, 73, "Screw Attack"),
  loc(496004, 0, Area.LowerNorfair, 74, "Energy Tank (Firefleas)"),
  loc(508517, 0, Area.WreckedShip, 75, "Missiles (Spooky)"),
  loc(508649, 84, Area.WreckedShip, 76, "Reserve Tank (Wrecked Ship)"),
  loc(508655, 0, Area.WreckedShip, 77, "Missiles (Bowling)"),
  loc(508697, 0, Area.WreckedShip, 78, "Missiles (Attic)"),
  loc(508727, 0, Area.WreckedShip, 79, "Energy Tank (Wrecked Ship)"),
  loc(508759, 0, Area.WreckedShip, 80, "Supers (WS Left)"),
  loc(508773, 0, Area.WreckedShip, 81, "Supers (WS Right)"),
  loc(508781, 84, Area.WreckedShip, 82, "Gravity Suit"),
  loc(508983, 0, Area.WestMaridia, 83, "Missiles (Mainstreet)"),
  loc(508989, 0, Area.WestMaridia, 84, "Supers (Crab)"),
  loc(509053, 0, Area.WestMaridia, 85, "Energy Tank (Mama Turtle)"),
  loc(509059, 168, Area.WestMaridia, 86, "Missiles (Mama Turtle)"),
  loc(509103, 0, Area.WestMaridia, 87, "Supers (Watering Hole)"),
  loc(509109, 0, Area.WestMaridia, 88, "Missiles (Watering Hole)"),
  loc(509235, 0, Area.WestMaridia, 89, "Missiles (Beach)"),
  loc(509273, 84, Area.EastMaridia, 90, "Plasma Beam"),
  loc(509405, 0, Area.EastMaridia, 91, "Missiles (Sand Pit Left)"),
  loc(509411, 84, Area.EastMaridia, 92, "Reserve Tank (Maridia)"),
  loc(509419, 0, Area.EastMaridia, 93, "Missiles (Sand Pit Right)"),
  loc(509425, 0, Area.EastMaridia, 94, "Power Bombs (Sand Pit Right)"),
  loc(509443, 0, Area.EastMaridia, 95, "Missiles (Aqueduct)"),
  loc(509449, 0, Area.EastMaridia, 96, "Supers (Aqueduct)"),
  loc(509669, 84, Area.EastMaridia, 97, "Spring Ball"),
  loc(509773, 168, Area.EastMaridia, 98, "Missiles (Precious)"),
  loc(509781, 0, Area.EastMaridia, 99, "Energy Tank (Botwoon)"),
  loc(509863, 84, Area.EastMaridia, 100, "Space Jump"),
  loc(519186, 84, Area.KraidsLair, 104, "Space Jump"),
  loc(519284, 84, Area.WreckedShip, 105, "Space Jump"),
  loc(519235, 84, Area.LowerNorfair, 106, "Space Jump")
];

// ../../../tmp/dash/packages/core/lib/items.ts
var Item = Object.freeze({
  // Vanilla items
  EnergyTank: 61143,
  Missile: 61147,
  Super: 61151,
  PowerBomb: 61155,
  Bombs: 61159,
  Charge: 61163,
  Ice: 61167,
  HJB: 61171,
  Speed: 61175,
  Wave: 61179,
  Spazer: 61183,
  SpringBall: 61187,
  Varia: 61191,
  Plasma: 61203,
  Grapple: 61207,
  Morph: 61219,
  Reserve: 61223,
  Gravity: 61195,
  Xray: 61199,
  SpaceJump: 61211,
  ScrewAttack: 61215,
  // Custom DASH items
  DoubleJump: 61408,
  PressureValve: 61416,
  HeatShield: 61412,
  BeamUpgrade: 61420,
  // Pseudo items for bosses
  DefeatedBrinstarBoss: 45141,
  DefeatedWreckedShipBoss: 45142,
  DefeatedMaridiaBoss: 45143,
  DefeatedNorfairBoss: 45144,
  DefeatedSporeSpawn: 45145,
  DefeatedCrocomire: 45146,
  DefeatedBotwoon: 45147,
  DefeatedGoldTorizo: 45148
});
var ItemNames = /* @__PURE__ */ new Map([
  [Item.EnergyTank, "Energy Tank"],
  [Item.Missile, "Missile"],
  [Item.Super, "Super Missile"],
  [Item.PowerBomb, "Power Bomb"],
  [Item.Bombs, "Bomb"],
  [Item.Charge, "Charge Beam"],
  [Item.Ice, "Ice Beam"],
  [Item.HJB, "HiJump Boots"],
  [Item.Speed, "Speed Booster"],
  [Item.Wave, "Wave Beam"],
  [Item.Spazer, "Spazer"],
  [Item.SpringBall, "Spring Ball"],
  [Item.Varia, "Varia Suit"],
  [Item.Plasma, "Plasma Beam"],
  [Item.Grapple, "Grappling Beam"],
  [Item.Morph, "Morph Ball"],
  [Item.Reserve, "Reserve Tank"],
  [Item.Gravity, "Gravity Suit"],
  [Item.Xray, "Xray Scope"],
  [Item.SpaceJump, "Space Jump"],
  [Item.ScrewAttack, "Screw Attack"],
  [Item.DoubleJump, "Double Jump"],
  [Item.PressureValve, "Pressure Valve"],
  [Item.HeatShield, "Heat Shield"],
  [Item.BeamUpgrade, "Beam Upgrade"],
  [Item.DefeatedBrinstarBoss, "Brinstar Boss"],
  [Item.DefeatedWreckedShipBoss, "Wrecked Ship Boss"],
  [Item.DefeatedMaridiaBoss, "Maridia Boss"],
  [Item.DefeatedNorfairBoss, "Norfair Boss"],
  [Item.DefeatedSporeSpawn, "Spore Spawn"],
  [Item.DefeatedCrocomire, "Crocomire"],
  [Item.DefeatedBotwoon, "Botwoon"],
  [Item.DefeatedGoldTorizo, "Gold Torizo"]
]);
var bossItem = (type) => newItem(type, false);
var majorItem = (type) => newItem(type, true);
var minorItem = (type) => newItem(type, false);
var newItem = (type, isMajor) => {
  const name = ItemNames.get(type);
  if (name == void 0) {
    throw new Error(`newItem: unknown item type [${type}]`);
  }
  return {
    type,
    name,
    isMajor
  };
};
var isFungible = (itemType) => {
  switch (itemType) {
    case Item.Super:
    case Item.PowerBomb:
    case Item.Missile:
    case Item.EnergyTank:
    case Item.Reserve:
      return true;
    default:
      return false;
  }
};

// ../../../tmp/dash/packages/core/data/interface.ts
var BOSS_DOORS = {
  // Boss Entry Door Pointers
  DoorToKraidBoss: 501140,
  DoorToPhantoonBoss: 511161,
  DoorToDraygonBoss: 514007,
  DoorToRidleyBoss: 504737,
  // Boss Entry Door Vectors
  DoorVectorToKraidInBrinstar: 102838,
  DoorVectorToKraidInWreckedShip: 110008,
  DoorVectorToKraidInMaridia: 110020,
  DoorVectorToKraidInNorfair: 110032,
  DoorVectorToPhantoonInBrinstar: 110044,
  DoorVectorToPhantoonInWreckedShip: 107180,
  DoorVectorToPhantoonInMaridia: 110056,
  DoorVectorToPhantoonInNorfair: 110068,
  DoorVectorToDraygonInBrinstar: 110152,
  DoorVectorToDraygonInWreckedShip: 110164,
  DoorVectorToDraygonInMaridia: 108608,
  DoorVectorToDraygonInNorfair: 110176,
  DoorVectorToRidleyInBrinstar: 110260,
  DoorVectorToRidleyInWreckedShip: 110272,
  DoorVectorToRidleyInMaridia: 110284,
  DoorVectorToRidleyInNorfair: 104650,
  // Boss Exit Door Pointers
  DoorFromKraidInBrinstar: 501221,
  DoorFromKraidInWreckedShip: 518851,
  DoorFromKraidInMaridia: 518925,
  DoorFromKraidInNorfair: 518777,
  DoorFromPhantoonInBrinstar: 518999,
  DoorFromPhantoonInWreckedShip: 511321,
  DoorFromPhantoonInMaridia: 519143,
  DoorFromPhantoonInNorfair: 519071,
  DoorFromDraygonInBrinstar: 519362,
  DoorFromDraygonInWreckedShip: 519510,
  DoorFromDraygonInMaridia: 514726,
  DoorFromDraygonInNorfair: 519436,
  DoorFromRidleyInBrinstar: 519733,
  DoorFromRidleyInWreckedShip: 519807,
  DoorFromRidleyInMaridia: 519881,
  DoorFromRidleyInNorfair: 504694,
  // Boss Exit Door Vectors
  DoorVectorToPreKraid: 102862,
  DoorVectorToPrePhantoon: 107204,
  DoorVectorToPreDraygon: 108908,
  DoorVectorToPreRidley: 104638
};
var AREA_DOORS = {
  // Door Pointers
  Door_RetroPBs: 499429,
  Door_GreenHills: 499323,
  Door_Moat: 497192,
  Door_Ocean: 496677,
  Door_G4: 498152,
  Door_Tourian: 501268,
  Door_Kago: 498066,
  Door_GreenElevator: 498015,
  Door_Crabs: 496823,
  Door_RedElevator: 497233,
  Door_HighwayExit: 497062,
  Door_Highway: 497103,
  Door_NoobBridge: 499683,
  Door_RedTower: 500348,
  Door_MaridiaEscape: 500561,
  Door_RedFish: 512301,
  Door_MaridiaTube: 511809,
  Door_MainStreet: 511984,
  Door_KraidEntry: 511913,
  Door_ElevatorEntry: 501448,
  Door_AboveKraid: 511915,
  Door_MaridiaMap: 512583,
  Door_KraidMouth: 501450,
  Door_KraidsLair: 500888,
  Door_CrocEntry: 502098,
  Door_Croc: 502229,
  Door_SingleChamber: 503181,
  Door_Muskateers: 505469,
  Door_LavaDive: 503455,
  Door_RidleyMouth: 503611,
  Door_PreAqueduct: 512462,
  Door_Aqueduct: 513486,
  // Vanilla Door Vectors
  DoorVectorToRetroPBs: 102022,
  DoorVectorToGreenHills: 102046,
  DoorVectorToMoat: 100810,
  DoorVectorToOcean: 101098,
  DoorVectorToG4: 102886,
  DoorVectorToTourian: 101458,
  DoorVectorToKago: 101374,
  DoorVectorToGreenElevator: 101410,
  DoorVectorToCrabs: 101110,
  DoorVectorToRedElevator: 100930,
  DoorVectorToHighwayExit: 101026,
  DoorVectorToHighway: 101038,
  DoorVectorToNoobBridge: 102442,
  DoorVectorToRedTower: 102154,
  DoorVectorToMaridiaEscape: 107648,
  DoorVectorToRedFish: 102598,
  DoorVectorToMaridiaTube: 107420,
  DoorVectorToMainStreet: 107312,
  DoorVectorToKraidEntry: 102958,
  DoorVectorToElevatorEntry: 107396,
  DoorVectorToAboveKraid: 107792,
  DoorVectorToMaridiaMap: 107408,
  DoorVectorToKraidMouth: 102718,
  DoorVectorToKraidsLair: 102970,
  DoorVectorToCrocEntry: 103402,
  DoorVectorToCroc: 103378,
  DoorVectorToSingleChamber: 105034,
  DoorVectorToMuskateers: 103930,
  DoorVectorToLavaDive: 104146,
  DoorVectorToRidleyMouth: 104062,
  DoorVectorToPreAqueduct: 108296,
  DoorVectorToAqueduct: 107720
};
var TABLE_FLAGS = {
  // File Select Code: 4 bytes
  FileSelectCode: 3112960,
  // Charge Modes: 0x00 = Vanilla  0x01 = Starter,
  //               0x02 = Recall   0x03 = Starter+
  ChargeMode: 3112964,
  // HUD bits: 0x01 = Charge  0x02 = Item Counts,
  //           0x04 = Area    0x08 = Dash Items
  HUDBitField: 3112965,
  // Seed key: reserved block for seed key
  SeedKey: 3115760,
  SeedKeySize: 16,
  // Seed flags: reserved block for seed flags
  SeedFlags: 3115776,
  SeedFlagsSize: 12,
  // Fanfare: 0x0000 = On  0x0001 = Off
  NoFanfare: 3115788,
  // Gravity Heat Damage:
  GravityHeatDamage: 3115792,
  // LN Chozo Trigger: 0x0000 = Require Space Jump
  //                   0x0001 = Nothing Required
  LNChozoTrigger: 3115816,
  // Show Bosses: 0x0000 = Don't show  0x0001 = Show
  ShowBosses: 3115818
};
var PATCHES = {
  Room_Waterway_Patch_01: 13546485,
  Room_WreckedShipReserve_Patch_01: 13546808,
  Room_WreckedShipReserve_Patch_02: 13546776,
  Room_PreBotwoon_Patch_01: 13546679
};
var ROOM_PATCH_ADDR = {
  Waterway: 3116198,
  WreckedShipReserve: 3116654,
  PreBotwoon: 3116894
};
var DASH_CLASSIC_PATCHES = [
  {
    room: ROOM_PATCH_ADDR.Waterway,
    patch: PATCHES.Room_Waterway_Patch_01
  },
  {
    room: ROOM_PATCH_ADDR.WreckedShipReserve,
    patch: PATCHES.Room_WreckedShipReserve_Patch_01
  },
  {
    room: ROOM_PATCH_ADDR.PreBotwoon,
    patch: PATCHES.Room_PreBotwoon_Patch_01
  }
];

// ../../../tmp/dash/packages/core/lib/loadout.ts
function createLoadout() {
  return {
    hasBombs: false,
    hasMorph: false,
    hasGravity: false,
    hasVaria: false,
    hasHiJump: false,
    hasSpaceJump: false,
    hasScrewAttack: false,
    hasSpringBall: false,
    hasSpeed: false,
    hasHeatShield: false,
    hasPressureValve: false,
    hasDoubleJump: false,
    hasIce: false,
    hasWave: false,
    hasCharge: false,
    hasSpazer: false,
    hasPlasma: false,
    hasGrapple: false,
    hasDefeatedBrinstarBoss: false,
    hasDefeatedWreckedShipBoss: false,
    hasDefeatedMaridiaBoss: false,
    hasDefeatedNorfairBoss: false,
    hasDefeatedSporeSpawn: false,
    hasDefeatedCrocomire: false,
    hasDefeatedBotwoon: false,
    hasDefeatedGoldTorizo: false,
    missilePacks: 0,
    superPacks: 0,
    powerPacks: 0,
    energyTanks: 0,
    reserveTanks: 0,
    totalTanks: 0,
    canUseBombs: false,
    canUsePowerBombs: false,
    canPassBombPassages: false,
    canDestroyBombWalls: false,
    canDamageBosses: false,
    canOpenGreenDoors: false,
    canOpenRedDoors: false,
    canFly: false
  };
}
function cloneLoadout(load2) {
  return { ...load2 };
}
function copyLoadout(destination, source) {
  destination.hasBombs = source.hasBombs;
  destination.hasMorph = source.hasMorph;
  destination.hasGravity = source.hasGravity;
  destination.hasVaria = source.hasVaria;
  destination.hasHiJump = source.hasHiJump;
  destination.hasSpaceJump = source.hasSpaceJump;
  destination.hasScrewAttack = source.hasScrewAttack;
  destination.hasSpringBall = source.hasSpringBall;
  destination.hasSpeed = source.hasSpeed;
  destination.hasHeatShield = source.hasHeatShield;
  destination.hasPressureValve = source.hasPressureValve;
  destination.hasDoubleJump = source.hasDoubleJump;
  destination.hasIce = source.hasIce;
  destination.hasWave = source.hasWave;
  destination.hasCharge = source.hasCharge;
  destination.hasSpazer = source.hasSpazer;
  destination.hasPlasma = source.hasPlasma;
  destination.hasGrapple = source.hasGrapple;
  destination.hasDefeatedBrinstarBoss = source.hasDefeatedBrinstarBoss;
  destination.hasDefeatedWreckedShipBoss = source.hasDefeatedWreckedShipBoss;
  destination.hasDefeatedMaridiaBoss = source.hasDefeatedMaridiaBoss;
  destination.hasDefeatedNorfairBoss = source.hasDefeatedNorfairBoss;
  destination.hasDefeatedSporeSpawn = source.hasDefeatedSporeSpawn;
  destination.hasDefeatedCrocomire = source.hasDefeatedCrocomire;
  destination.hasDefeatedBotwoon = source.hasDefeatedBotwoon;
  destination.hasDefeatedGoldTorizo = source.hasDefeatedGoldTorizo;
  destination.missilePacks = source.missilePacks;
  destination.superPacks = source.superPacks;
  destination.powerPacks = source.powerPacks;
  destination.energyTanks = source.energyTanks;
  destination.reserveTanks = source.reserveTanks;
  destination.totalTanks = source.totalTanks;
  destination.canUseBombs = source.canUseBombs;
  destination.canUsePowerBombs = source.canUsePowerBombs;
  destination.canPassBombPassages = source.canPassBombPassages;
  destination.canDestroyBombWalls = source.canDestroyBombWalls;
  destination.canDamageBosses = source.canDamageBosses;
  destination.canOpenGreenDoors = source.canOpenGreenDoors;
  destination.canOpenRedDoors = source.canOpenRedDoors;
  destination.canFly = source.canFly;
}
function canDestroyBombWalls(load2) {
  return canPassBombPassages(load2) || load2.hasScrewAttack;
}
function canFly(load2) {
  return canUseBombs(load2) || load2.hasSpaceJump;
}
function canUseBombs(load2) {
  return load2.hasBombs && load2.hasMorph;
}
function canPassBombPassages(load2) {
  return load2.hasMorph && (load2.hasBombs || load2.powerPacks > 0);
}
function addItem(load2, itemType) {
  switch (itemType) {
    case Item.Bombs:
      load2.hasBombs = true;
      load2.canUseBombs = load2.hasMorph;
      load2.canPassBombPassages = canPassBombPassages(load2);
      load2.canDestroyBombWalls = canDestroyBombWalls(load2);
      load2.canFly = canFly(load2);
      break;
    case Item.Morph:
      load2.hasMorph = true;
      load2.canUseBombs = load2.hasBombs;
      load2.canUsePowerBombs = load2.powerPacks > 0;
      load2.canPassBombPassages = canPassBombPassages(load2);
      load2.canDestroyBombWalls = canDestroyBombWalls(load2);
      load2.canFly = canFly(load2);
      break;
    case Item.Gravity:
      load2.hasGravity = true;
      break;
    case Item.PressureValve:
      load2.hasPressureValve = true;
      break;
    case Item.HeatShield:
      load2.hasHeatShield = true;
      break;
    case Item.Varia:
      load2.hasVaria = true;
      break;
    case Item.HJB:
      load2.hasHiJump = true;
      break;
    case Item.DoubleJump:
      load2.hasDoubleJump = true;
      break;
    case Item.SpaceJump:
      load2.hasSpaceJump = true;
      load2.canFly = true;
      break;
    case Item.ScrewAttack:
      load2.hasScrewAttack = true;
      load2.canDestroyBombWalls = true;
      break;
    case Item.SpringBall:
      load2.hasSpringBall = true;
      break;
    case Item.Speed:
      load2.hasSpeed = true;
      break;
    case Item.Ice:
      load2.hasIce = true;
      break;
    case Item.Wave:
      load2.hasWave = true;
      break;
    case Item.Charge:
    case Item.BeamUpgrade:
      load2.hasCharge = true;
      load2.canDamageBosses = true;
      break;
    case Item.Spazer:
      load2.hasSpazer = true;
      break;
    case Item.Plasma:
      load2.hasPlasma = true;
      break;
    case Item.Grapple:
      load2.hasGrapple = true;
      break;
    case Item.Missile:
      load2.missilePacks += 1;
      load2.canOpenRedDoors = true;
      load2.canDamageBosses = true;
      break;
    case Item.Super:
      load2.superPacks += 1;
      load2.canOpenRedDoors = true;
      load2.canOpenGreenDoors = true;
      load2.canDamageBosses = true;
      break;
    case Item.PowerBomb:
      load2.powerPacks += 1;
      load2.canUsePowerBombs = load2.hasMorph;
      load2.canPassBombPassages = canPassBombPassages(load2);
      load2.canDestroyBombWalls = canDestroyBombWalls(load2);
      break;
    case Item.EnergyTank:
      load2.energyTanks += 1;
      load2.totalTanks += 1;
      break;
    case Item.Reserve:
      load2.reserveTanks += 1;
      load2.totalTanks += 1;
      break;
    case Item.Xray:
      break;
    case Item.DefeatedBotwoon:
      load2.hasDefeatedBotwoon = true;
      break;
    case Item.DefeatedCrocomire:
      load2.hasDefeatedCrocomire = true;
      break;
    case Item.DefeatedMaridiaBoss:
      load2.hasDefeatedMaridiaBoss = true;
      break;
    case Item.DefeatedBrinstarBoss:
      load2.hasDefeatedBrinstarBoss = true;
      break;
    case Item.DefeatedWreckedShipBoss:
      load2.hasDefeatedWreckedShipBoss = true;
      break;
    case Item.DefeatedNorfairBoss:
      load2.hasDefeatedNorfairBoss = true;
      break;
    case Item.DefeatedGoldTorizo:
      load2.hasDefeatedGoldTorizo = true;
      break;
    case Item.DefeatedSporeSpawn:
      load2.hasDefeatedSporeSpawn = true;
      break;
    default:
      console.error("[Loadout] Unknown item type:", itemType);
      break;
  }
}
var checkFlags = (load) => {
  const CanUseBombs = load.canUseBombs;
  const CanUsePowerBombs = load.canUsePowerBombs;
  const CanOpenRedDoors = load.canOpenRedDoors;
  const CanOpenGreenDoors = load.canOpenGreenDoors;
  const HasCharge = load.hasCharge;
  const HasDoubleJump = load.hasDoubleJump;
  const HasGravity = load.hasGravity;
  const HasGrapple = load.hasGrapple;
  const HasHeatShield = load.hasHeatShield;
  const HasHiJump = load.hasHiJump;
  const HasIce = load.hasIce;
  const HasMorph = load.hasMorph;
  const HasPlasma = load.hasPlasma;
  const HasPressureValve = load.hasPressureValve;
  const HasScrewAttack = load.hasScrewAttack;
  const HasSpaceJump = load.hasSpaceJump;
  const HasSpazer = load.hasSpazer;
  const HasSpeed = load.hasSpeed;
  const HasSpringBall = load.hasSpringBall;
  const HasVaria = load.hasVaria;
  const HasWave = load.hasWave;
  const EnergyTanks = load.energyTanks;
  const MissilePacks = load.missilePacks;
  const PowerBombPacks = load.powerPacks;
  const SuperPacks = load.superPacks;
  const TotalTanks = load.totalTanks;
  const HellRunTanks = load.hasVaria || load.hasHeatShield ? 9999 : load.totalTanks;
  const CanFly = load.canFly;
  const CanDoSuitlessMaridia = load.hasHiJump && load.hasGrapple && (load.hasIce || load.hasSpringBall);
  const CanPassBombPassages = load.canPassBombPassages;
  const CanDestroyBombWalls = load.canDestroyBombWalls;
  const CanMoveInWestMaridia = load.hasGravity || load.hasPressureValve;
  const CanKillKraid = load.canDamageBosses;
  const CanKillPhantoon = load.canDamageBosses;
  const CanKillDraygon = load.hasGravity && load.canDamageBosses;
  const CanKillRidley = load.hasVaria && (load.hasCharge || load.missilePacks * 500 + load.superPacks * 3e3 + load.powerPacks * 1e3 >= 19e3);
  const CanKillCrocomire = load.hasCharge || load.superPacks * 1500 + load.missilePacks * 500 >= 5e3;
  const CanKillBotwoon = load.hasCharge || load.superPacks * 1500 + load.missilePacks * 500 >= 6e3;
  const CanKillGoldTorizo = load.hasVaria && load.totalTanks >= 4 && (load.hasCharge || load.superPacks >= 3);
  const HasDefeatedMaridiaBoss = load.hasDefeatedMaridiaBoss;
  const HasDefeatedBrinstarBoss = load.hasDefeatedBrinstarBoss;
  const HasDefeatedWreckedShipBoss = load.hasDefeatedWreckedShipBoss;
  const HasDefeatedNorfairBoss = load.hasDefeatedNorfairBoss;
  return (condition) => eval(`(${condition.toString()})()`);
};

// ../../../tmp/dash/packages/core/lib/graph/search.ts
var searchAndCache = (graph, vertex, test) => {
  let queue = [vertex];
  let pos = 0;
  while (pos < queue.length) {
    const v = queue[pos++];
    const connections = graph.filter((c) => c.from == v);
    connections.forEach((c) => {
      if (c.condition === true || test(c.condition)) {
        c.condition = true;
        if (!queue.includes(c.to)) {
          queue.push(c.to);
        }
      }
    });
  }
  return queue;
};
var canReachStart = (graph, vertex, test) => {
  if (vertex.pathToStart) {
    return true;
  }
  let queue = [vertex];
  let pos = 0;
  while (pos < queue.length) {
    const v = queue[pos++];
    const connections = graph.filter((c) => c.from == v);
    for (let i = 0; i < connections.length; i++) {
      const c = connections[i];
      if (c.condition === true || test(c.condition)) {
        if (c.to.pathToStart) {
          c.from.pathToStart = true;
          return true;
        }
        if (!queue.includes(c.to)) {
          queue.push(c.to);
        }
      }
    }
  }
  return false;
};
var canReachVertex = (graph, startVertex, endVertex, test) => {
  if (startVertex == endVertex) {
    return true;
  }
  let queue = [startVertex];
  let pos = 0;
  while (pos < queue.length) {
    const v = queue[pos++];
    const connections = graph.filter((c) => c.from == v);
    for (let i = 0; i < connections.length; i++) {
      const c = connections[i];
      if (c.condition === true || test(c.condition)) {
        if (c.to == endVertex) {
          return true;
        }
        if (!queue.includes(c.to)) {
          queue.push(c.to);
        }
      }
    }
  }
  return false;
};

// ../../../tmp/dash/packages/core/helpers/converters.ts
function toHexString(data) {
  const value = new Uint8Array(data);
  return Array.from(value, function(byte) {
    return ("0" + (byte & 255).toString(16)).slice(-2);
  }).join("");
}
function base64ToSafe(b642, trim = false) {
  const safe = b642.replaceAll("/", "_").replaceAll("+", "-");
  if (!trim) {
    return safe;
  }
  return safe.replace(/=*$/, "");
}

// ../../../tmp/dash/packages/core/lib/params.ts
var ENCODED_PARAMS_SIZE = 7;
var MapLayout = {
  Standard: 1,
  Classic: 2
};
var MajorDistributionMode = {
  Chozo: 25,
  Standard: 34,
  Full: 38
};
var MinorDistributionMode = {
  Standard: 0,
  // 3:2:1
  Dash: 1
  // 2:1:1
};
var BeamMode = {
  Vanilla: 0,
  Starter: 1,
  DashRecall: 2,
  StarterPlus: 3
};
var SuitMode = {
  Standard: 1,
  Dash: 2
};
var GravityHeatReduction = {
  Off: 16384,
  On: 12288
};
var BossMode = {
  Vanilla: 0,
  Shuffled: 1,
  Shifted: 2,
  Surprise: 3,
  Scramble: 4
};
var majorModeToBits = (mode) => {
  switch (mode) {
    case MajorDistributionMode.Standard:
      return 0;
    case MajorDistributionMode.Full:
      return 2;
    case MajorDistributionMode.Chozo:
      return 3;
  }
  throw new Error("unknown major mode");
};
var minorModeToBits = (minorDistribution) => {
  switch (minorDistribution) {
    case MinorDistributionMode.Standard:
      return 0;
    case MinorDistributionMode.Dash:
      return 1;
    default:
      throw new Error("unknown minor mode");
  }
};
var mapLayoutToBits = (layout) => {
  switch (layout) {
    case MapLayout.Standard:
      return 0;
    case MapLayout.Classic:
      return 2;
  }
  throw new Error("unknown map layout");
};
var paramsToBytes = (seed, settings, options) => {
  const { mapLayout, majorDistribution, minorDistribution, extraItems } = settings;
  let bytes = new Uint8Array(ENCODED_PARAMS_SIZE);
  bytes[0] = seed & 255;
  bytes[1] = seed >> 8 & 255;
  bytes[2] = seed >> 16 & 255;
  const version = 0;
  const major = majorModeToBits(majorDistribution) << 2;
  const minor = minorModeToBits(minorDistribution) << 4;
  const area = (settings.randomizeAreas ? 1 : 0) << 6;
  bytes[3] = version | major | minor | area;
  const boss = settings.bossMode;
  const extra = extraItems;
  const doubleJump = extra.filter((i) => i == Item.DoubleJump).length;
  const heatShield = extra.filter((i) => i == Item.HeatShield).length;
  const pressureValve = extra.filter((i) => i == Item.PressureValve).length;
  const dash = (doubleJump | heatShield << 1 | pressureValve << 2) << 4;
  bytes[4] = boss | dash;
  const map = mapLayoutToBits(mapLayout);
  const beam = settings.beamMode << 2;
  const suit = settings.suitMode << 4;
  const gravity = (settings.gravityHeatReduction == GravityHeatReduction.On ? 1 : 0) << 6;
  const fanfare = (options.DisableFanfare ? 0 : 1) << 7;
  bytes[5] = map | beam | suit | gravity | fanfare;
  const relaxed = (options.RelaxedLogic ? 1 : 0) << 6;
  const mystery = (options.Mystery ? 1 : 0) << 5;
  const spoiler = (options.Spoiler ? 1 : 0) << 4;
  const bossesKnown = (options.BossesKnown ? 1 : 0) << 3;
  bytes[6] = relaxed | mystery | spoiler | bossesKnown;
  return bytes;
};

// ../../../tmp/dash/packages/core/lib/graph/solver.ts
var isGraphValid = (graph, settings, loadout) => {
  const solver = new GraphSolver(graph, settings);
  return solver.isValid(loadout);
};
var revSolve = (solver, load2, node) => {
  const prevStartVertex = solver.startVertex;
  const state = solver.graph.map((e) => {
    const { pathToStart, progression } = e.from;
    e.from.pathToStart = false;
    return {
      pathToStart,
      progression
    };
  });
  solver.startVertex = node;
  node.pathToStart = true;
  let result = false;
  try {
    if (solver.isValid(load2, false)) {
      result = true;
    }
  } catch (e) {
  }
  solver.startVertex = prevStartVertex;
  solver.graph.forEach((e, i) => {
    e.from.pathToStart = state[i].pathToStart;
    e.from.progression = state[i].progression;
  });
  return result;
};
var GraphSolver = class {
  constructor(graph, settings) {
    this.graph = graph;
    this.settings = settings;
    this.startVertex = graph[0].from;
    if (settings.majorDistribution == MajorDistributionMode.Chozo) {
      this.graph.forEach((n) => {
        if (n.from.progression === 0 && n.from.type == "minor") {
          n.from.progression = -1;
        }
      });
    }
  }
  isValid(initLoad, favorProximity = false) {
    let samus = cloneLoadout(initLoad);
    let progression = 0;
    let searchVertex = this.startVertex;
    const findAll = (vertex) => searchAndCache(this.graph, vertex, checkFlags(samus));
    const collectItem = (p) => {
      p.progression = ++progression;
    };
    const collectSafeItems = (itemLocations) => {
      const load2 = cloneLoadout(samus);
      let collectedItem = false;
      for (let i = 0; i < itemLocations.length; i++) {
        const p = itemLocations[i];
        addItem(load2, p.item.type);
        if (!canReachStart(this.graph, p, checkFlags(load2))) {
          copyLoadout(load2, samus);
          continue;
        }
        addItem(samus, p.item.type);
        collectedItem = true;
        collectItem(p);
        if (favorProximity) {
          searchVertex = p;
          break;
        }
      }
      if (collectedItem) {
        return true;
      }
      const reverseSolve = (filtered) => {
        const p = filtered.find((n) => revSolve(this, samus, n));
        if (p == void 0) {
          return false;
        }
        addItem(samus, p.item.type);
        collectItem(p);
        if (favorProximity) {
          searchVertex = p;
        }
        return true;
      };
      if (reverseSolve(itemLocations.filter((p) => !isFungible(p.item.type)))) {
        return true;
      }
      if (reverseSolve(itemLocations.filter((p) => isFungible(p.item.type)))) {
        return true;
      }
      return false;
    };
    while (true) {
      const all = findAll(searchVertex);
      const uncollected = all.filter((v) => v.progression === 0);
      if (uncollected.length == 0) {
        break;
      }
      if (!collectSafeItems(uncollected)) {
        return false;
      }
    }
    return !this.graph.some((n) => n.from.progression === 0);
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/standard/area.js
var Crateria_PreMoat_to_Crabs = {
  edges: ["PreMoat", "Door_CrateriaCrabs"],
  requires: true
};
var Crateria_Terminator_to_G4 = {
  edges: ["Energy Tank (Terminator)", "Door_G4"],
  requires: true
};
var GreenBrinstar_Tube_to_GreenHillsPortal = {
  edges: ["Missiles (Brin Tube)", "Door_GreenHills"],
  requires: true
};
var GreenBrinstar_Tube_to_NoobBridgePortal = {
  edges: ["Missiles (Brin Tube)", "Door_NoobBridge"],
  requires: true
};
var GreenBrinstar_NoobBridgePortal_to_Tube = {
  edges: ["Door_NoobBridge", "Missiles (Brin Tube)"],
  requires: true
};
var UpperNorfair_PreCrocomire_to_CrocEntry = {
  edges: ["PreCrocomire", "Door_CrocEntry"],
  requires: true
};
var UpperNorfair_KingCacLedge_to_SingleChamberPortal = {
  edges: ["BubbleMountainKingCacLedge", "SingleChamberTopRightDoor"],
  requires: () => HasMorph && CanDestroyBombWalls && HellRunTanks >= 2
};
var UpperNorfair_KronicBoostBottom_to_KronicBoostPortal = {
  edges: ["KronicBoostBottom", "Door_KronicBoost"],
  requires: true
};
var RedBrinstar_RedTowerElevator_to_MaridiaEscapePortal = {
  edges: ["RedTowerElevatorRoom", "Door_MaridiaEscape"],
  requires: true
};
var RedBrinstar_MaridiaEscapePortal_to_RedTowerElevator = {
  edges: ["Door_MaridiaEscape", "RedTowerElevatorRoom"],
  requires: true
};
var RedBrinstar_RedTowerBottom_to_AboveKraidPortal = {
  edges: ["RedTowerBottom", "Door_RedTowerToMaridiaMap"],
  requires: true
};
var RedBrinstar_AboveKraidPortal_to_RedTowerBottom = {
  edges: ["Door_RedTowerToMaridiaMap", "RedTowerBottom"],
  requires: true
};
var WreckedShip_ShipHallway_to_SpongeBath = {
  edges: ["ShipHallway", "SpongeBathLeft"],
  requires: true
};
var WreckedShip_RearExit_to_WSHighway = {
  edges: ["ShipRearExit", "Door_WSHighway"],
  requires: () => (HasHiJump || CanMoveInWestMaridia) && HasMorph
};
var EastMaridia_OasisBottom_to_Aqueduct = {
  edges: ["OasisBottom", "Aqueduct"],
  requires: () => HasGravity
};
var EastMaridia_AqueductPortal_to_Aqueduct = {
  edges: ["Door_Aqueduct", "Aqueduct"],
  requires: () => CanUseBombs || CanUsePowerBombs || HasGravity && HasScrewAttack
};
var EastMaridia_OasisBottom_to_AboveMaridiaMap = {
  edges: ["OasisBottom", "AboveMaridiaMap"],
  requires: false
};
var WestMaridia_AboveMaridiaMap_to_OasisBottom = {
  edges: ["AboveMaridiaMap", "OasisBottom"],
  requires: false
};
var WestMaridia_MainStreet_to_AboveMaridiaMap = {
  edges: ["MainStreet", "AboveMaridiaMap"],
  // Removes the requirement for supers to open the green gate
  requires: () => CanOpenRedDoors
};
var WestMaridia_AboveMaridiaMap_to_MainStreet = {
  edges: ["AboveMaridiaMap", "MainStreet"],
  // Removes the requirement for supers to green gate glitch
  requires: true
};
var WestMaridia_EverestTopRight_to_PreAqueductPortal = {
  edges: ["EverestTopRight", "Door_PreAqueduct"],
  requires: true
};
var StandardAreaEdgeUpdates = [
  Crateria_PreMoat_to_Crabs,
  Crateria_Terminator_to_G4,
  GreenBrinstar_Tube_to_GreenHillsPortal,
  GreenBrinstar_Tube_to_NoobBridgePortal,
  GreenBrinstar_NoobBridgePortal_to_Tube,
  UpperNorfair_KingCacLedge_to_SingleChamberPortal,
  UpperNorfair_KronicBoostBottom_to_KronicBoostPortal,
  UpperNorfair_PreCrocomire_to_CrocEntry,
  RedBrinstar_RedTowerElevator_to_MaridiaEscapePortal,
  RedBrinstar_RedTowerBottom_to_AboveKraidPortal,
  RedBrinstar_MaridiaEscapePortal_to_RedTowerElevator,
  RedBrinstar_AboveKraidPortal_to_RedTowerBottom,
  WreckedShip_ShipHallway_to_SpongeBath,
  WreckedShip_RearExit_to_WSHighway,
  EastMaridia_OasisBottom_to_Aqueduct,
  EastMaridia_OasisBottom_to_AboveMaridiaMap,
  WestMaridia_AboveMaridiaMap_to_OasisBottom,
  WestMaridia_MainStreet_to_AboveMaridiaMap,
  WestMaridia_AboveMaridiaMap_to_MainStreet,
  WestMaridia_EverestTopRight_to_PreAqueductPortal,
  EastMaridia_AqueductPortal_to_Aqueduct
];

// ../../../tmp/dash/packages/core/lib/graph/data/portals.ts
var samePortal = (a, b) => {
  return a.name === b.name && a.area === b.area;
};
var samePortals = (unshuffled, shuffled) => {
  if (unshuffled.length != shuffled.length) {
    throw new Error(`Mismatch number of portals`);
  }
  for (const [u_left, u_right] of unshuffled) {
    for (const [s_left, s_right] of shuffled) {
      if (samePortal(u_left, s_left)) {
        if (samePortal(u_right, s_right)) {
          continue;
        }
        return false;
      }
      if (samePortal(u_right, s_left)) {
        if (samePortal(u_left, s_right)) {
          continue;
        }
        return false;
      }
    }
  }
  return true;
};
var getNumLoops = (mappings) => {
  return mappings.filter((p) => p[0].area === p[1].area).length;
};
var hasInvalidSequence = (mappings) => {
  const deadAreas = ["KraidsLair", "CrocomiresLair", "Tourian"];
  const duoAreas = ["LowerNorfair", "EastMaridia", "WreckedShip"];
  const duoConnections = duoAreas.map((p) => {
    return {
      name: p,
      duo: false,
      dead: false
    };
  });
  mappings.forEach((m) => {
    const fromArea = duoConnections.find((p) => p.name == m[0].area);
    if (fromArea) {
      if (deadAreas.includes(m[1].area)) {
        fromArea.dead = true;
      }
      if (duoAreas.includes(m[1].area)) {
        fromArea.duo = true;
      }
    }
    const toArea = duoConnections.find((p) => p.name == m[1].area);
    if (toArea) {
      if (deadAreas.includes(m[0].area)) {
        toArea.dead = true;
      }
      if (duoAreas.includes(m[0].area)) {
        toArea.duo = true;
      }
    }
  });
  if (duoConnections.filter((p) => p.duo).length > 2) {
    return true;
  }
  if (duoConnections.find((p) => p.dead && p.duo)) {
    return true;
  }
  return false;
};
var vanillaCount = (vanilla, shuffled) => {
  let count = 0;
  vanilla.forEach((p) => {
    shuffled.forEach((s) => {
      if (samePortal(s[0], p[0]) && samePortal(s[1], p[1])) {
        count += 1;
      } else if (samePortal(s[1], p[0]) && samePortal(s[0], p[1])) {
        count += 1;
      }
    });
  });
  return count;
};
var shuffle = (rng, arr) => {
  const swap = (arr2, x, y) => {
    const tmp = arr2[x];
    arr2[x] = arr2[y];
    arr2[y] = tmp;
  };
  for (let i = 0; i < arr.length; i++) {
    swap(arr, i, rng.NextInRange(i, arr.length));
  }
};
var getAreaPortals = () => {
  return [
    { name: "Door_RetroPBs", area: "Crateria" },
    { name: "Door_GreenHills", area: "GreenBrinstar" },
    { name: "Door_Moat", area: "Crateria" },
    { name: "Door_Ocean", area: "WreckedShip" },
    { name: "Door_G4", area: "Crateria" },
    { name: "Door_Tourian", area: "Tourian" },
    { name: "Door_Kago", area: "Crateria" },
    { name: "Door_GreenElevator", area: "GreenBrinstar" },
    { name: "Door_CrateriaCrabs", area: "Crateria" },
    { name: "Door_RedElevator", area: "RedBrinstar" },
    { name: "Door_WSHighway", area: "WreckedShip" },
    { name: "Door_EMHighway", area: "EastMaridia" },
    { name: "Door_NoobBridge", area: "GreenBrinstar" },
    { name: "Door_RedTower", area: "RedBrinstar" },
    { name: "Door_MaridiaEscape", area: "RedBrinstar" },
    { name: "Door_RedFish", area: "WestMaridia" },
    { name: "Door_MaridiaTube", area: "RedBrinstar" },
    { name: "Door_MainStreet", area: "WestMaridia" },
    { name: "Door_RedTowerToKraid", area: "RedBrinstar" },
    { name: "Door_BusinessCenterLeft", area: "UpperNorfair" },
    { name: "Door_RedTowerToMaridiaMap", area: "RedBrinstar" },
    { name: "Door_MaridiaMap", area: "WestMaridia" },
    { name: "Door_BusinessCenterRight", area: "UpperNorfair" },
    { name: "Door_KraidsLair", area: "KraidsLair" },
    { name: "Door_CrocEntry", area: "UpperNorfair" },
    { name: "Door_CrocsLair", area: "CrocomiresLair" },
    { name: "Door_SingleChamber", area: "UpperNorfair" },
    { name: "Door_Musketeers", area: "LowerNorfair" },
    { name: "Door_KronicBoost", area: "UpperNorfair" },
    { name: "Door_RidleyMouth", area: "LowerNorfair" },
    { name: "Door_PreAqueduct", area: "WestMaridia" },
    { name: "Door_Aqueduct", area: "EastMaridia" }
  ];
};
var generateAreaPortals = (seed) => {
  const areaPortals = getAreaPortals();
  let areas = [];
  for (let i = 0; i < areaPortals.length; i += 2) {
    areas.push([areaPortals[i], areaPortals[i + 1]]);
  }
  if (seed == 0) {
    return areas;
  }
  const rng = new dotnet_random_default(seed);
  const maxIntra = rng.NextDouble() < 0.1 ? 1 : 0;
  const maxVanilla = rng.NextDouble() < 0.1 ? 1 : 0;
  const shuffleAreas = () => {
    const all = areas.flat();
    shuffle(rng, all);
    const shuffled2 = [];
    for (let i = 0; i < all.length; i += 2) {
      shuffled2.push([all[i], all[i + 1]]);
    }
    return shuffled2;
  };
  let shuffled = shuffleAreas();
  while (getNumLoops(shuffled) > maxIntra || vanillaCount(areas, shuffled) > maxVanilla || hasInvalidSequence(shuffled)) {
    shuffled = shuffleAreas();
  }
  return shuffled;
};
var getBossPortals = () => {
  return [
    { name: "Door_KraidBoss", area: "KraidsLair" },
    { name: "Exit_Kraid", area: "KraidsLair" },
    { name: "Door_PhantoonBoss", area: "WreckedShip" },
    { name: "Exit_Phantoon", area: "WreckedShip" },
    { name: "Door_DraygonBoss", area: "EastMaridia" },
    { name: "Exit_Draygon", area: "EastMaridia" },
    { name: "Door_RidleyBoss", area: "LowerNorfair" },
    { name: "Exit_Ridley", area: "LowerNorfair" }
  ];
};
var generateBossPortals = (mode, seed) => {
  const bossPortals = getBossPortals();
  let bosses2 = [];
  for (let i = 0; i < bossPortals.length; i += 2) {
    bosses2.push([bossPortals[i], bossPortals[i + 1]]);
  }
  if (mode == BossMode.Vanilla) {
    return bosses2;
  }
  const rng = new dotnet_random_default(seed + 1e7);
  const shuffleBosses = () => {
    const doorPortals = bosses2.map((b) => b[0]);
    const exitPortals = bosses2.map((b) => b[1]);
    if (mode == BossMode.Surprise || mode == BossMode.Scramble) {
      return doorPortals.map((d) => {
        const exit = { ...exitPortals[rng.NextInRange(0, 4)] };
        return [d, exit];
      });
    }
    shuffle(rng, exitPortals);
    return doorPortals.map((d, idx) => [d, exitPortals[idx]]);
  };
  let shuffled = shuffleBosses();
  while (samePortals(bosses2, shuffled)) {
    shuffled = shuffleBosses();
  }
  if (mode == BossMode.Scramble) {
    const areas = ["KraidsLair", "LowerNorfair", "EastMaridia", "WreckedShip"];
    shuffle(rng, areas);
    shuffled.forEach((p, i) => {
      p[1].area = areas[i];
    });
  } else if (mode !== BossMode.Shuffled) {
    shuffled.forEach((p) => p[1].area = p[0].area);
  }
  return shuffled;
};
var generatePortals = (seed, area, boss) => {
  if (seed == 0 && (area || boss)) {
    throw new Error("Seed of 0 with areas or bosses randomized");
  }
  const areaSeed = seed > 0 && area ? seed + 2e7 : 0;
  return generateAreaPortals(areaSeed).concat(generateBossPortals(boss, seed));
};

// ../../../tmp/dash/packages/core/lib/graph/data/chozo/vertex.js
var Crateria_Missiles_Alpha = {
  name: "Missiles (230)",
  type: "major"
};
var Crateria_Missiles_230 = {
  name: "Missiles (Alpha)",
  type: "major"
};
var GreenBrinstar_Supers_SporeSpawn = {
  name: "Supers (Spore Spawn)",
  type: "major"
};
var RedBrinstar_PowerBombs_Alpha = {
  name: "Power Bombs (Alpha)",
  type: "major"
};
var WreckedShip_Missiles_Bowling = {
  name: "Missiles (Bowling)",
  type: "major"
};
var Crateria_EnergyTank_Terminator = {
  name: "Energy Tank (Terminator)",
  type: "minor"
};
var BlueBrinstar_EnergyTank_Ceiling = {
  name: "Energy Tank (Brinstar Ceiling)",
  type: "minor"
};
var Crocomire_EnergyTank = {
  name: "Energy Tank (Crocomire)",
  type: "minor"
};
var Kraid_EnergyTank = {
  name: "Energy Tank (Kraid)",
  type: "minor"
};
var GreenBrinstar_EnergyTank_Etecoons = {
  name: "Energy Tank (Etecoons)",
  type: "minor"
};
var GreenBrinstar_EnergyTank_WaveGate = {
  name: "Energy Tank (Wave Gate)",
  type: "minor"
};
var GreenBrinstar_EnergyTank_Waterway = {
  name: "Energy Tank (Waterway)",
  type: "minor"
};
var WreckedShip_ReserveTank = {
  name: "Reserve Tank (Wrecked Ship)",
  type: "minor"
};
var WreckedShip_GravitySuit = {
  name: "Gravity Suit",
  type: "minor"
};
var EastMaridia_ReserveTank = {
  name: "Reserve Tank (Maridia)",
  type: "minor"
};
var EastMaridia_EnergyTank_Botwoon = {
  name: "Energy Tank (Botwoon)",
  type: "minor"
};
var WestMaridia_EnergyTank_MamaTurtle = {
  name: "Energy Tank (Mama Turtle)",
  type: "minor"
};
var LowerNorfair_EnergyTank_Firefleas = {
  name: "Energy Tank (Firefleas)",
  type: "minor"
};
var UpperNorfair_EnergyTank_HJB = {
  name: "Energy Tank (HJB)",
  type: "minor"
};
var UpperNorfair_ReserveTank = {
  name: "Reserve Tank (Norfair)",
  type: "minor"
};
var ChozoVertexUpdates = [
  Crateria_Missiles_Alpha,
  Crateria_Missiles_230,
  Crateria_EnergyTank_Terminator,
  BlueBrinstar_EnergyTank_Ceiling,
  GreenBrinstar_Supers_SporeSpawn,
  RedBrinstar_PowerBombs_Alpha,
  Crocomire_EnergyTank,
  Kraid_EnergyTank,
  WreckedShip_Missiles_Bowling,
  WreckedShip_ReserveTank,
  WreckedShip_GravitySuit,
  EastMaridia_ReserveTank,
  EastMaridia_EnergyTank_Botwoon,
  WestMaridia_EnergyTank_MamaTurtle,
  LowerNorfair_EnergyTank_Firefleas,
  UpperNorfair_EnergyTank_HJB,
  UpperNorfair_ReserveTank,
  GreenBrinstar_EnergyTank_Etecoons,
  GreenBrinstar_EnergyTank_Waterway,
  GreenBrinstar_EnergyTank_WaveGate
];

// ../../../tmp/dash/packages/core/lib/graph/data/relaxed/edges.js
var WestMaridia_DoorMainStreet_to_MainStreet = {
  edges: ["Door_MainStreet", "MainStreet"],
  requires: () => CanMoveInWestMaridia
};
var WestMaridia_DoorPreAqueduct_to_EverestTopRight = {
  edges: ["Door_PreAqueduct", "EverestTopRight"],
  requires: () => CanMoveInWestMaridia
};
var WestMaridia_DoorMaridiaMap_to_AboveMaridiaMap = {
  edges: ["Door_MaridiaMap", "AboveMaridiaMap"],
  requires: () => HasMorph && CanMoveInWestMaridia
};
var WestMaridia_DoorRedFish_to_RedFish = {
  edges: ["Door_RedFish", "RedFish"],
  requires: () => HasMorph && CanMoveInWestMaridia
};
var EastMaridia_DoorAqueduct_to_Aqueduct = {
  edges: ["Door_Aqueduct", "Aqueduct"],
  requires: () => CanUsePowerBombs && HasGravity
};
var EastMaridia_DoorEMHighway_to_MaridiaHighway = {
  edges: ["Door_EMHighway", "MaridiaHighway"],
  requires: () => HasGravity
};
var EastMaridia_Aqueduct_to_Missiles = {
  edges: ["Aqueduct", "Missiles (Aqueduct)"],
  requires: () => HasGravity && HasSpeed
};
var EastMaridia_OasisBottom_to_SpringBall = {
  edges: ["OasisBottom", "Spring Ball"],
  requires: () => HasGravity && CanUsePowerBombs && HasGrapple && (CanFly || HasHiJump)
};
var UpperNorfair_BusinessCenter_to_CathedralEntrance = {
  edges: ["BusinessCenter", "CathedralEntrance"],
  requires: () => HasVaria || HasHeatShield
};
var UpperNorfair_BusinessCenter_to_BCSaveStation = {
  edges: ["BusinessCenter", "BusinessCenterSaveStation"],
  requires: () => HasVaria || HasHeatShield
};
var UpperNorfair_DoorSingleChamber_to_TopRightDoor = {
  edges: ["Door_SingleChamber", "SingleChamberTopRightDoor"],
  requires: () => HasVaria || HasHeatShield
};
var UpperNorfair_DoorKronicBoost_to_KronicBoostBottom = {
  edges: ["Door_KronicBoost", "KronicBoostBottom"],
  requires: () => HasVaria || HasHeatShield
};
var UpperNorfair_DoorCrocEntry_to_PreCrocomire = {
  edges: ["Door_CrocEntry", "PreCrocomire"],
  requires: () => HasVaria || HasHeatShield
};
var UpperNorfair_IceBeamGatesTopLeft_to_IceBeam = {
  edges: ["IceBeamGatesTopLeftDoor", "Ice Beam"],
  requires: () => HasMorph && (HasVaria || HasHeatShield)
};
var UpperNorfair_IceBeamGatesBottomLeft_to_CrumbleShaft = {
  edges: ["IceBeamGatesBottomLeftDoor", "Missiles (Crumble Shaft)"],
  requires: () => HasVaria || HasHeatShield
};
var RelaxedEdgeUpdates = [
  WestMaridia_DoorMainStreet_to_MainStreet,
  WestMaridia_DoorPreAqueduct_to_EverestTopRight,
  WestMaridia_DoorMaridiaMap_to_AboveMaridiaMap,
  WestMaridia_DoorRedFish_to_RedFish,
  EastMaridia_DoorAqueduct_to_Aqueduct,
  EastMaridia_DoorEMHighway_to_MaridiaHighway,
  EastMaridia_Aqueduct_to_Missiles,
  EastMaridia_OasisBottom_to_SpringBall,
  UpperNorfair_BusinessCenter_to_CathedralEntrance,
  UpperNorfair_BusinessCenter_to_BCSaveStation,
  UpperNorfair_DoorSingleChamber_to_TopRightDoor,
  UpperNorfair_DoorKronicBoost_to_KronicBoostBottom,
  UpperNorfair_DoorCrocEntry_to_PreCrocomire,
  UpperNorfair_IceBeamGatesTopLeft_to_IceBeam,
  UpperNorfair_IceBeamGatesBottomLeft_to_CrumbleShaft
];

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/crateria.js
var crateriaEdges = {
  Ship: {
    "Power Bombs (Landing Site)": () => (CanFly || HasSpeed) && CanUsePowerBombs,
    PreGauntlet: () => CanDestroyBombWalls,
    PreMoat: () => CanOpenGreenDoors,
    Parlor: true
  },
  "Power Bombs (Landing Site)": {
    Ship: true
  },
  PreMoat: {
    Ship: true,
    "Missiles (Moat)": () => CanUsePowerBombs,
    Door_CrateriaCrabs: () => CanUsePowerBombs
  },
  Door_CrateriaCrabs: {
    PreMoat: true
  },
  "Missiles (Moat)": {
    Door_CrateriaCrabs: true,
    Door_Moat: true
  },
  Door_Moat: {
    "Missiles (Moat)": true
  },
  PreGauntlet: {
    //more specifically, the door from landing site to gauntlet
    Ship: () => CanDestroyBombWalls,
    "Energy Tank (Gauntlet)": () => CanUseBombs && (TotalTanks >= 2 || HasVaria) || HasMorph && PowerBombPacks >= 2 && (TotalTanks >= 1 || HasVaria) || HasScrewAttack || TotalTanks >= 3 && HasSpeed
  },
  "Energy Tank (Gauntlet)": {
    PreGauntlet: () => CanUseBombs && TotalTanks >= 2 || HasMorph && PowerBombPacks >= 2 && TotalTanks >= 1 || HasScrewAttack,
    GauntletBackSideLeftDoor: () => CanPassBombPassages
  },
  GauntletBackSideLeftDoor: {
    "Energy Tank (Gauntlet)": () => CanPassBombPassages,
    "Missiles (Gauntlet Left)": true
  },
  "Missiles (Gauntlet Left)": {
    "Missiles (Gauntlet Right)": true
  },
  "Missiles (Gauntlet Right)": {
    "Energy Tank (Terminator)": true
  },
  "Energy Tank (Terminator)": {
    Parlor: () => CanDestroyBombWalls || HasSpeed,
    Door_G4: () => CanOpenRedDoors,
    Door_Kago: true
  },
  Door_G4: {
    "Energy Tank (Terminator)": true
  },
  Door_Kago: {
    "Energy Tank (Terminator)": true
  },
  Parlor: {
    "Energy Tank (Terminator)": () => CanDestroyBombWalls || HasSpeed,
    Bombs: () => HasMorph && CanOpenRedDoors,
    Climb: true,
    "Missiles (230)": () => CanPassBombPassages,
    Ship: true
  },
  Bombs: {
    Parlor: () => HasMorph
  },
  "Missiles (230)": {
    Parlor: () => HasMorph
  },
  Climb: {
    Parlor: true,
    ClimbSupersBottom: () => CanUsePowerBombs,
    "Missiles (Mother Brain)": () => CanDestroyBombWalls,
    "Morphing Ball": true
  },
  ClimbSupersBottom: {
    Climb: () => CanPassBombPassages,
    "Supers (Climb)": () => HasSpeed && EnergyTanks >= 1
  },
  "Supers (Climb)": {
    Climb: () => HasGrapple || HasSpaceJump || EnergyTanks >= 1 && TotalTanks >= 2
  },
  "Missiles (Mother Brain)": {
    Climb: () => CanDestroyBombWalls
  },
  "Morphing Ball": {
    Climb: true,
    "Power Bombs (Morph)": () => CanUsePowerBombs,
    "Construction Zone": true
  },
  "Construction Zone": {
    "Missiles (Alpha)": () => HasMorph,
    "Missiles (Beta)": () => HasMorph,
    BoulderRoom: () => CanUsePowerBombs,
    "Energy Tank (Brinstar Ceiling)": true,
    "Morphing Ball": true
  },
  "Power Bombs (Morph)": {
    "Morphing Ball": () => CanUsePowerBombs,
    Door_RetroPBs: () => CanPassBombPassages
  },
  Door_RetroPBs: {
    "Power Bombs (Morph)": () => CanPassBombPassages
  },
  "Missiles (Alpha)": {
    "Morphing Ball": () => HasMorph
  },
  "Energy Tank (Brinstar Ceiling)": {
    "Construction Zone": true
  },
  "Missiles (Beta)": {
    "Construction Zone": () => HasMorph
  },
  BoulderRoom: {
    "Missiles (Billy Mays 1)": true,
    "Missiles (Billy Mays 2)": true,
    "Construction Zone": () => CanUseBombs || CanUsePowerBombs || HasScrewAttack && HasMorph
  },
  "Missiles (Billy Mays 1)": {
    BoulderRoom: true
  },
  "Missiles (Billy Mays 2)": {
    BoulderRoom: true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/greenbrinstar.js
var greenbrinstarEdges = {
  Door_GreenElevator: {
    "Missiles (Early Bridge)": () => CanOpenRedDoors,
    "Energy Tank (Etecoons)": () => CanUsePowerBombs,
    DachoraRoomLeft: () => CanOpenRedDoors
  },
  "Missiles (Early Bridge)": {
    Door_GreenElevator: true,
    "Supers (Early Bridge)": () => HasMorph || HasSpeed
  },
  "Supers (Early Bridge)": {
    "Missiles (Early Bridge)": true,
    "Reserve Tank (Brinstar)": () => CanOpenRedDoors
  },
  "Reserve Tank (Brinstar)": {
    "Supers (Early Bridge)": true,
    "Missiles (Brin Reserve 1)": () => HasMorph
  },
  "Missiles (Brin Reserve 1)": {
    "Reserve Tank (Brinstar)": () => HasMorph,
    "Missiles (Brin Reserve 2)": () => CanUseBombs || CanUsePowerBombs
  },
  "Missiles (Brin Reserve 2)": {
    "Missiles (Brin Reserve 1)": true,
    "Reserve Tank (Brinstar)": () => HasMorph
  },
  "Energy Tank (Etecoons)": {
    Door_GreenElevator: () => CanUsePowerBombs,
    "Supers (Etecoons)": () => CanOpenGreenDoors,
    "Power Bombs (Etecoons)": () => HasMorph
  },
  "Supers (Etecoons)": {
    "Energy Tank (Etecoons)": true
  },
  "Power Bombs (Etecoons)": {
    "Energy Tank (Etecoons)": () => HasMorph
  },
  DachoraRoomLeft: {
    Door_GreenElevator: true,
    DachoraRoomRight: () => CanDestroyBombWalls || HasSpeed
  },
  DachoraRoomRight: {
    DachoraRoomLeft: () => CanDestroyBombWalls || HasSpeed,
    "Missiles (Big Pink)": true
  },
  "Missiles (Big Pink)": {
    DachoraRoomRight: true,
    "Missiles (Charge)": true,
    "Energy Tank (Wave Gate)": () => CanUsePowerBombs && (SuperPacks >= 1 || HasWave),
    "Supers (Spore Spawn)": () => CanOpenRedDoors,
    "Power Bombs (Mission Impossible)": () => CanUsePowerBombs && CanOpenGreenDoors
  },
  "Power Bombs (Mission Impossible)": {
    "Missiles (Big Pink)": () => CanPassBombPassages
  },
  "Supers (Spore Spawn)": {
    "Missiles (Big Pink)": () => CanPassBombPassages && CanOpenGreenDoors
  },
  "Missiles (Charge)": {
    "Missiles (Big Pink)": true,
    "Charge Beam": () => CanPassBombPassages,
    "Missiles (Brin Tube)": () => CanOpenGreenDoors
  },
  "Charge Beam": {
    "Missiles (Charge)": () => CanPassBombPassages,
    "Energy Tank (Waterway)": () => CanUsePowerBombs && CanOpenRedDoors && HasSpeed
  },
  "Energy Tank (Waterway)": {
    "Charge Beam": () => CanUsePowerBombs
  },
  "Missiles (Brin Tube)": {
    "Missiles (Charge)": true,
    Door_NoobBridge: () => CanOpenGreenDoors,
    Door_GreenHills: () => CanUsePowerBombs
  },
  Door_GreenHills: {
    "Missiles (Brin Tube)": true
  },
  Door_NoobBridge: {
    "Missiles (Brin Tube)": () => CanOpenRedDoors || HasWave
  },
  "Energy Tank (Wave Gate)": {
    "Missiles (Big Pink)": true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/redbrinstar.js
var redbrinstarEdges = {
  Door_RedTower: {
    RedTowerMid: true
  },
  XrayHallway: {
    RedTowerMid: () => CanUsePowerBombs,
    "Xray Scope": () => CanOpenRedDoors && HasMorph && (HasSpaceJump || HasGrapple || (TotalTanks >= 6 || HasVaria && TotalTanks >= 2) && (HasHiJump && (HasSpeed || HasSpringBall) || HasIce || HasDoubleJump || CanUseBombs))
  },
  "Xray Scope": {
    XrayHallway: () => CanPassBombPassages && (HasSpaceJump || HasGrapple || TotalTanks >= 6 || HasVaria && TotalTanks >= 2)
  },
  Door_RedTowerToMaridiaMap: {
    RedTowerBottom: () => SuperPacks >= 1
  },
  Door_RedTowerToKraid: {
    RedTowerBottom: true
  },
  Spazer: {
    RedTowerBottom: () => HasMorph
  },
  Door_MaridiaTube: {
    RedTowerBottom: () => HasMorph
  },
  RedBrinstarElevatorRoom: {
    Door_RedElevator: true,
    RedTowerElevatorRoom: true
  },
  RedTowerElevatorRoom: {
    Door_MaridiaEscape: false,
    RedBrinstarElevatorRoom: true,
    RedTowerTop: () => CanUsePowerBombs,
    "Power Bombs (Alpha)": () => CanOpenGreenDoors,
    "Power Bombs (Beta)": () => CanOpenGreenDoors && CanUsePowerBombs
  },
  RedTowerTop: {
    RedTowerElevatorRoom: true,
    RedTowerMid: true
  },
  RedTowerMid: {
    Door_RedTower: true,
    RedTowerTop: true,
    RedTowerBottom: true,
    XrayHallway: () => CanUsePowerBombs
  },
  RedTowerBottom: {
    Door_RedTowerToMaridiaMap: false,
    Door_RedTowerToKraid: true,
    Door_MaridiaTube: () => CanUsePowerBombs && (HasHiJump || CanMoveInWestMaridia),
    RedTowerMid: true,
    Spazer: () => HasMorph && CanOpenGreenDoors
  },
  Door_RedElevator: {
    RedBrinstarElevatorRoom: true
  },
  "Power Bombs (Alpha)": {
    RedTowerElevatorRoom: true,
    "Missiles (Alpha PBs)": () => CanUsePowerBombs
  },
  "Missiles (Alpha PBs)": {
    "Power Bombs (Alpha)": true
  },
  "Power Bombs (Beta)": {
    RedTowerElevatorRoom: true
  },
  Door_MaridiaEscape: {
    RedTowerElevatorRoom: () => HasMorph && SuperPacks >= 1
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/kraid.js
var kraidslairEdges = {
  Door_KraidsLair: {
    "Energy Tank (Kraid)": () => HasDefeatedBrinstarBoss && (CanOpenRedDoors || CanDestroyBombWalls),
    KraidsHallway: () => CanPassBombPassages
  },
  "Energy Tank (Kraid)": {
    Door_KraidsLair: true
  },
  KraidsHallway: {
    Door_KraidsLair: () => CanPassBombPassages,
    "Missiles (Kraid)": () => CanUsePowerBombs,
    Door_KraidBoss: () => CanOpenRedDoors
  },
  "Missiles (Kraid)": {
    KraidsHallway: true
  },
  Door_KraidBoss: {
    KraidsHallway: true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/crocomire.js
var crocomireEdges = {
  Door_CrocsLair: {
    PostCroc: () => CanKillCrocomire
  },
  PostCroc: {
    Door_CrocsLair: true,
    "Energy Tank (Crocomire)": () => HasSpaceJump || HasGrapple || HasVaria || TotalTanks >= 2,
    "Power Bombs (Crocomire)": () => CanOpenRedDoors && (CanFly || HasGrapple || HasSpeed && TotalTanks >= 1 || HasHiJump || HasIce || HasDoubleJump),
    "Grapple Beam": () => SuperPacks >= 1 || HasMorph && (CanFly || HasDoubleJump) || CanUsePowerBombs && HasSpeed || HasHiJump && (HasSpeed || HasMorph && HasSpringBall),
    "Missiles (Indiana Jones)": () => (HasDoubleJump || CanFly) && (HasMorph || SuperPacks >= 1) || CanUsePowerBombs && HasSpeed,
    "Missiles (Cosine)": () => CanOpenRedDoors
  },
  "Energy Tank (Crocomire)": {
    PostCroc: () => HasSpaceJump || HasGrapple || HasVaria || TotalTanks >= 3
  },
  "Power Bombs (Crocomire)": {
    PostCroc: true
  },
  "Grapple Beam": {
    PostCroc: () => SuperPacks >= 1 || HasMorph
  },
  "Missiles (Indiana Jones)": {
    PostCroc: () => HasMorph || CanFly && SuperPacks >= 1
  },
  "Missiles (Cosine)": {
    PostCroc: true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/westmaridia.js
var westmaridiaEdges = {
  Door_MainStreet: {
    MainStreet: true
  },
  MainStreet: {
    Door_MainStreet: true,
    "Missiles (Mainstreet)": () => CanMoveInWestMaridia && HasSpeed,
    "Supers (Crab)": () => HasMorph && (CanMoveInWestMaridia || HasHiJump && (HasIce || HasSpringBall)),
    "Missiles (Mama Turtle)": () => CanOpenRedDoors && (CanMoveInWestMaridia || HasHiJump && (HasIce || HasSpringBall)),
    AboveMaridiaMap: () => CanOpenGreenDoors,
    EverestTopRight: () => CanMoveInWestMaridia || CanDoSuitlessMaridia,
    RedFish: () => CanMoveInWestMaridia || CanDoSuitlessMaridia
  },
  "Missiles (Mainstreet)": {
    MainStreet: true
  },
  EverestTopRight: {
    MainStreet: true,
    "Missiles (Beach)": () => CanMoveInWestMaridia || HasHiJump && (HasIce || HasSpringBall),
    Door_PreAqueduct: () => CanOpenGreenDoors,
    "Missiles (Mama Turtle)": () => CanOpenRedDoors && (CanMoveInWestMaridia || HasHiJump)
  },
  Door_PreAqueduct: {
    EverestTopRight: () => CanMoveInWestMaridia || HasHiJump
  },
  "Missiles (Beach)": {
    EverestTopRight: true,
    "Supers (Watering Hole)": () => CanMoveInWestMaridia || HasHiJump && (HasIce || HasSpringBall)
  },
  "Missiles (Watering Hole)": {
    "Missiles (Beach)": true
  },
  "Supers (Watering Hole)": {
    "Missiles (Watering Hole)": true
  },
  Door_MaridiaMap: {
    AboveMaridiaMap: () => HasMorph && (CanMoveInWestMaridia || HasHiJump && HasIce)
  },
  AboveMaridiaMap: {
    MainStreet: () => CanOpenGreenDoors,
    OasisBottom: () => HasGravity,
    Door_MaridiaMap: () => HasMorph
  },
  "Supers (Crab)": {
    MainStreet: () => HasMorph
  },
  Door_RedFish: {
    RedFish: () => HasMorph
  },
  RedFish: {
    Door_RedFish: () => HasMorph && (CanMoveInWestMaridia || HasHiJump),
    MainStreet: true,
    "Missiles (Mama Turtle)": () => CanOpenRedDoors && (CanMoveInWestMaridia || HasHiJump),
    EverestTopRight: () => CanMoveInWestMaridia || HasGrapple,
    "Supers (Crab)": () => HasMorph
  },
  "Missiles (Mama Turtle)": {
    "Energy Tank (Mama Turtle)": () => CanFly || CanMoveInWestMaridia && HasSpeed || HasMorph && HasSpringBall || HasGrapple || HasDoubleJump,
    MainStreet: () => CanMoveInWestMaridia || HasHiJump
  },
  "Energy Tank (Mama Turtle)": {
    "Missiles (Mama Turtle)": true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/eastmaridia.js
var eastmaridiaEdges = {
  Door_Aqueduct: {
    Aqueduct: () => CanUsePowerBombs
  },
  Aqueduct: {
    //TODO: Snail climb is technically in logic
    Door_Aqueduct: () => (HasGravity || HasHiJump) && (CanUseBombs || CanUsePowerBombs || HasGravity && HasScrewAttack),
    //TODO: Snail clip is technically in logic
    "Missiles (Aqueduct)": () => HasGravity,
    //TODO: Snail climb is technically in logic
    BotwoonHallwayLeft: () => HasGravity || HasHiJump,
    LeftSandPitBottom: () => HasGravity,
    RightSandPitBottom: () => HasGravity,
    OasisBottom: () => HasGravity
  },
  LeftSandPitBottom: {
    "Missiles (Sand Pit Left)": () => HasGravity && HasMorph && (CanUseBombs || CanUsePowerBombs || HasSpringBall),
    "Reserve Tank (Maridia)": () => HasGravity && HasMorph && (CanUseBombs || CanUsePowerBombs || HasSpringBall),
    OasisBottom: () => HasGravity
  },
  RightSandPitBottom: {
    "Missiles (Sand Pit Right)": () => HasGravity,
    "Power Bombs (Sand Pit Right)": () => HasGravity && HasMorph,
    OasisBottom: () => HasGravity
  },
  BotwoonHallwayLeft: {
    BotwoonHallwayRight: () => HasGravity && HasSpeed || HasIce,
    Aqueduct: true,
    Door_Aqueduct: () => CanUseBombs || CanUsePowerBombs || HasGravity && HasScrewAttack
  },
  "Missiles (Sand Pit Left)": {
    LeftSandPitBottom: () => HasGravity && HasMorph
  },
  "Reserve Tank (Maridia)": {
    LeftSandPitBottom: () => HasGravity && HasMorph
  },
  "Missiles (Sand Pit Right)": {
    RightSandPitBottom: () => HasGravity
  },
  "Power Bombs (Sand Pit Right)": {
    RightSandPitBottom: () => HasGravity && HasMorph
  },
  OasisBottom: {
    AboveMaridiaMap: () => HasGravity,
    // Ice clip in logic
    "Spring Ball": () => HasGravity && CanUsePowerBombs && (HasGrapple && (CanFly || HasHiJump) || HasIce),
    OasisTop: () => CanUsePowerBombs || CanUseBombs || HasGravity && HasScrewAttack,
    Aqueduct: false
  },
  OasisTop: {
    PlasmaSparkRoomTop: () => CanOpenGreenDoors,
    OasisBottom: () => CanUsePowerBombs || CanUseBombs || HasGravity && HasScrewAttack
  },
  PlasmaSparkRoomTop: {
    OasisTop: () => CanOpenGreenDoors,
    PrePlasmaBeam: () => HasDefeatedMaridiaBoss,
    MaridiaHighway: () => HasGravity || HasHiJump || HasSpaceJump,
    PlasmaSparkRoomBottom: true
  },
  PlasmaSparkRoomBottom: {
    PlasmaSparkRoomTop: () => HasGravity,
    ColosseumTopLeft: () => HasDefeatedMaridiaBoss && HasGravity
  },
  PrePlasmaBeam: {
    "Plasma Beam": true,
    PlasmaSparkRoomTop: true
  },
  "Plasma Beam": {
    PrePlasmaBeam: () => (HasScrewAttack || HasPlasma || HasGravity && HasCharge && TotalTanks >= 3) && (CanFly || HasHiJump || HasSpeed || HasSpringBall)
  },
  "Spring Ball": {
    OasisBottom: () => HasGravity && HasMorph
  },
  BotwoonHallwayRight: {
    PostBotwoon: () => CanKillBotwoon
  },
  PostBotwoon: {
    Aqueduct: true,
    "Energy Tank (Botwoon)": () => HasMorph && (HasGravity || HasHiJump),
    ColosseumTopLeft: () => HasGravity && HasSpeed
  },
  "Energy Tank (Botwoon)": {
    PostBotwoon: true,
    // if we got here, we can get back
    ColosseumTopLeft: () => HasMorph && HasGravity
  },
  ColosseumTopLeft: {
    PostBotwoon: () => HasGravity && HasSpeed,
    "Energy Tank (Botwoon)": () => HasMorph && (HasGravity || HasHiJump || HasSpringBall),
    ColosseumTopRight: () => HasGravity || HasSpaceJump || CanDoSuitlessMaridia,
    PlasmaSparkRoomBottom: () => HasDefeatedMaridiaBoss && (HasGravity || HasHiJump && HasSpaceJump)
  },
  ColosseumTopRight: {
    "Missiles (Precious)": () => CanOpenGreenDoors,
    ColosseumTopLeft: () => HasGravity || HasSpaceJump || CanDoSuitlessMaridia
  },
  "Missiles (Precious)": {
    ColosseumTopRight: () => HasGravity || CanDoSuitlessMaridia,
    Door_DraygonBoss: () => CanOpenRedDoors
  },
  Door_DraygonBoss: {
    "Missiles (Precious)": () => HasGravity || HasHiJump && HasSpringBall
  },
  "Missiles (Aqueduct)": {
    "Supers (Aqueduct)": true
  },
  "Supers (Aqueduct)": {
    Aqueduct: true
  },
  Door_EMHighway: {
    MaridiaHighway: true
  },
  MaridiaHighway: {
    Door_EMHighway: true,
    PlasmaSparkRoomTop: () => HasGravity || HasHiJump || HasSpaceJump
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/uppernorfair.js
var uppernorfairEdges = {
  Door_BusinessCenterLeft: {
    BusinessCenter: true
  },
  BusinessCenter: {
    Door_BusinessCenterLeft: true,
    Door_BusinessCenterRight: () => SuperPacks >= 1,
    IceBeamGatesTopLeftDoor: () => CanOpenGreenDoors && (HasMorph || HasSpeed),
    CathedralEntrance: true,
    BusinessCenterSaveStation: true,
    "Energy Tank (HJB)": () => CanOpenRedDoors
  },
  IceBeamGatesTopLeftDoor: {
    BusinessCenter: () => CanPassBombPassages,
    "Ice Beam": () => HasMorph && HellRunTanks >= 2,
    IceBeamGatesBottomLeftDoor: () => CanUsePowerBombs
  },
  IceBeamGatesBottomLeftDoor: {
    "Missiles (Crumble Shaft)": () => HellRunTanks >= 2,
    IceBeamGatesTopLeftDoor: () => CanUsePowerBombs
  },
  CathedralEntrance: {
    BusinessCenter: true,
    BubbleMountainMain: () => HellRunTanks >= 4 && CanOpenGreenDoors,
    "Missiles (Cathedral)": () => HellRunTanks >= 5 && CanOpenRedDoors
  },
  BusinessCenterSaveStation: {
    BusinessCenter: true,
    BubbleMountainBottomLeftDoor: () => HasSpeed
  },
  "Energy Tank (HJB)": {
    BusinessCenter: true,
    "HiJump Boots": () => HasMorph
  },
  "HiJump Boots": {
    "Missiles (HJB)": true
  },
  "Missiles (HJB)": {
    "Energy Tank (HJB)": () => HasMorph
  },
  "Missiles (Cathedral)": {
    CathedralEntrance: () => HellRunTanks >= 5,
    BubbleMountainMain: () => CanOpenGreenDoors && HellRunTanks >= 5
  },
  BubbleMountainMain: {
    "Missiles (Bubble Mountain)": true,
    BubbleMountainKingCacLedge: true,
    BubbleMountainTopLeftDoor: () => CanFly || HasIce || HasSpringBall || HasHiJump,
    BubbleMountainBottomLeftDoor: () => CanPassBombPassages,
    "Missiles (Cathedral)": () => HellRunTanks >= 6,
    CathedralEntrance: () => HellRunTanks >= 4
  },
  BubbleMountainKingCacLedge: {
    BubbleMountainMain: true,
    BubbleMountainTopLeftDoor: true,
    //NOTE: dboost in logic
    SingleChamberTopRightDoor: false,
    "Missiles (Speed)": () => HellRunTanks >= 3 || HasSpeed && HellRunTanks >= 2,
    "Speed Booster": () => SuperPacks >= 1 && (HellRunTanks >= 3 || HasSpeed && HellRunTanks >= 2),
    "Missiles (Wave)": () => CanOpenRedDoors && HellRunTanks >= 2 || HellRunTanks >= 7,
    BubbleMountainBottomLeftDoor: () => HellRunTanks >= 8
  },
  SingleChamberTopRightDoor: {
    Door_SingleChamber: true,
    BubbleMountainKingCacLedge: () => HellRunTanks >= 2 && CanDestroyBombWalls && HasMorph
  },
  BubbleMountainTopLeftDoor: {
    BubbleMountainMain: true,
    "Missiles (Norfair Reserve 1)": () => CanOpenGreenDoors && HellRunTanks >= 1
  },
  BubbleMountainBottomLeftDoor: {
    BubbleMountainMain: () => CanPassBombPassages,
    BusinessCenterSaveStation: () => HasSpeed,
    NutellaRefill: () => HellRunTanks >= 1 && (HasWave || CanOpenRedDoors),
    KronicBoostBottom: () => HellRunTanks >= 2,
    BubbleMountainKingCacLedge: () => HellRunTanks >= 6
  },
  KronicBoostBottom: {
    BubbleMountainBottomLeftDoor: () => HellRunTanks >= 2,
    //TODO: pretty aggressive
    Door_KronicBoost: () => CanUsePowerBombs
    //TODO: could probably remove this because going around requires less
    //NutellaRefill: () =>
    //HasMorph &&
    //(HasWave || CanOpenGreenDoors) &&
    //(HasGrapple || HasSpaceJump) &&
    //HellRunTanks >= 3,
  },
  NutellaRefill: {
    BubbleMountainBottomLeftDoor: () => HellRunTanks >= 1,
    KronicBoostBottom: () => HellRunTanks >= 2 && HasMorph && (HasGrapple || HasSpaceJump),
    PreCrocomire: () => HellRunTanks >= 1
  },
  "Missiles (Wave)": {
    BubbleMountainKingCacLedge: () => HellRunTanks >= 3,
    "Wave Beam": () => CanOpenRedDoors && HellRunTanks >= 3
  },
  "Wave Beam": {
    BubbleMountainKingCacLedge: () => HellRunTanks >= 4
  },
  "Missiles (Norfair Reserve 1)": {
    BubbleMountainTopLeftDoor: () => HellRunTanks >= 1,
    "Reserve Tank (Norfair)": () => HellRunTanks >= 2
  },
  "Missiles (Norfair Reserve 2)": {
    "Missiles (Norfair Reserve 1)": () => HellRunTanks >= 3
  },
  "Reserve Tank (Norfair)": {
    "Missiles (Norfair Reserve 2)": true
  },
  Door_SingleChamber: {
    SingleChamberTopRightDoor: true
  },
  Door_KronicBoost: {
    KronicBoostBottom: true
  },
  "Missiles (Speed)": {
    BubbleMountainKingCacLedge: () => HellRunTanks >= 4 || HasSpeed && HellRunTanks >= 2
  },
  "Speed Booster": {
    BubbleMountainKingCacLedge: () => HellRunTanks >= 4 || HasSpeed && HellRunTanks >= 2
  },
  "Missiles (Bubble Mountain)": {
    BubbleMountainMain: true
  },
  Door_BusinessCenterRight: {
    BusinessCenter: () => SuperPacks >= 1
  },
  "Ice Beam": {
    IceBeamGatesTopLeftDoor: () => HasMorph && HellRunTanks >= 2
  },
  "Missiles (Crumble Shaft)": {
    IceBeamGatesBottomLeftDoor: () => HellRunTanks >= 2,
    PreCrocomire: () => HasSpeed && HellRunTanks >= 2
  },
  PreCrocomire: {
    Door_CrocEntry: () => CanOpenGreenDoors,
    NutellaRefill: () => HellRunTanks >= 1,
    "Missiles (Croc Escape)": () => (
      //((HasVaria || HasHeatShield) && HasHiJump && HasIce) ||
      HellRunTanks >= 2 && (HasSpaceJump || HasGrapple || HasDoubleJump) || HellRunTanks >= 3 && HasHiJump && (HasSpringBall || HasSpeed) || (HasVaria || HasHeatShield || EnergyTanks >= 4) && CanUseBombs
    )
  },
  "Missiles (Croc Escape)": {
    BusinessCenter: () => CanOpenGreenDoors,
    PreCrocomire: () => HasMorph && HellRunTanks >= 2
  },
  Door_CrocEntry: {
    PreCrocomire: true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/lowernorfair.js
var lowernorfairEdges = {
  Door_RidleyMouth: {
    Ruins: () => HasVaria && (HasGravity || HasHiJump && TotalTanks >= 2 || HasPressureValve && TotalTanks >= 3)
  },
  Door_Musketeers: {
    Musketeers: () => HasVaria && (HasScrewAttack || HasPlasma || HasCharge || HasWave || HasIce || HasSpazer || TotalTanks >= 2 || HasGravity && TotalTanks >= 1)
  },
  Musketeers: {
    Door_Musketeers: true,
    "Missiles (Three Musketeers)": () => HasMorph && CanDestroyBombWalls,
    "Missiles (Maze)": () => HasMorph
  },
  "Missiles (Three Musketeers)": {
    Musketeers: true
    // If we got here, we can get back
  },
  Ruins: {
    Door_RidleyMouth: true,
    "Missiles (GT)": () => CanUsePowerBombs,
    // Space Jump not required
    PrePillars: () => CanUsePowerBombs
  },
  PrePillars: {
    Ruins: () => CanUsePowerBombs,
    ScrewAttackTop: () => SuperPacks >= 1,
    WorstRoomBottom: () => CanDestroyBombWalls || HasSpeed
  },
  WorstRoomBottom: {
    PrePillars: () => CanDestroyBombWalls,
    WorstRoomTop: () => CanUseBombs || HasScrewAttack && (HasSpaceJump || HasDoubleJump) || CanUsePowerBombs && (HasHiJump || HasSpringBall || HasSpaceJump || HasDoubleJump)
    //TODO: include killing pirates
  },
  WorstRoomTop: {
    WorstRoomBottom: () => CanDestroyBombWalls,
    "Missiles (Mickey Mouse)": () => CanDestroyBombWalls && HasMorph,
    Ruins: () => CanDestroyBombWalls,
    RedKihunterShaftTop: true
  },
  RedKihunterShaftTop: {
    Wasteland: () => CanUsePowerBombs,
    "Energy Tank (Firefleas)": true,
    WorstRoomTop: () => CanMoveInWestMaridia && TotalTanks >= 4 || TotalTanks >= 6,
    "Missiles (Maze)": true
  },
  Wasteland: {
    "Power Bombs (Shame)": () => CanDestroyBombWalls,
    Door_RidleyBoss: () => CanUsePowerBombs && CanOpenGreenDoors,
    RedKihunterShaftTop: () => CanPassBombPassages
  },
  "Energy Tank (Firefleas)": {
    //RedKihunterShaftTop: () => CanFly || HasHiJump || HasSpringBall,
    RedKihunterShaftTop: true
    // note: wall jump in logic
  },
  "Missiles (Maze)": {
    RedKihunterShaftTop: true,
    "Power Bombs (Maze)": () => CanPassBombPassages,
    Musketeers: () => HasMorph
  },
  "Power Bombs (Maze)": {
    RedKihunterShaftTop: true
  },
  "Power Bombs (Shame)": {
    Wasteland: () => CanPassBombPassages
  },
  Door_RidleyBoss: {
    //don't think escaping ridley with 1 PB pack is in logic, but this line implies it
    Wasteland: () => CanUsePowerBombs
  },
  "Missiles (Mickey Mouse)": {
    //TODO: check for SJ, DJ, or SB if only PBs available?
    WorstRoomTop: () => HasMorph,
    Ruins: true
  },
  "Missiles (GT)": {
    GoldTorizoFight: true
  },
  "Supers (GT)": {
    GoldTorizoFight: true
  },
  GoldTorizoFight: {
    "Supers (GT)": () => CanDestroyBombWalls,
    DefeatedGoldTorizo: () => CanKillGoldTorizo
  },
  DefeatedGoldTorizo: {
    "Screw Attack": true,
    ScrewAttackTop: () => HasSpeed
    // Charge a spark in GT room
  },
  ScrewAttackTop: {
    "Screw Attack": () => CanDestroyBombWalls,
    PrePillars: () => SuperPacks >= 1
  },
  "Screw Attack": {
    ScrewAttackTop: () => (HasSpaceJump || HasDoubleJump) && CanDestroyBombWalls || (CanUseBombs || HasSpringBall) && CanPassBombPassages || HasSpeed && HasHiJump && HasScrewAttack,
    GoldTorizoFight: true
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/wreckedship.js
var wreckedshipEdges = {
  Door_Ocean: {
    "Missiles (Ocean Bottom)": true
  },
  "Missiles (Ocean Bottom)": {
    Door_Ocean: true,
    ShipHallway: () => CanOpenGreenDoors
  },
  ShipHallway: {
    "Missiles (Ocean Bottom)": true,
    "Missiles (Spooky)": () => CanPassBombPassages,
    Door_PhantoonBoss: () => CanOpenGreenDoors && (HasSpeed || CanPassBombPassages),
    "Supers (WS Left)": () => HasDefeatedWreckedShipBoss,
    "Supers (WS Right)": () => HasDefeatedWreckedShipBoss && CanPassBombPassages,
    "Missiles (Attic)": () => HasDefeatedWreckedShipBoss,
    SpongeBathLeft: () => HasDefeatedWreckedShipBoss
  },
  SpongeBathLeft: {
    SpongeBathRight: () => !HasDefeatedWreckedShipBoss || HasDefeatedWreckedShipBoss && (CanFly || CanUsePowerBombs || HasSpeed || HasHiJump || CanMoveInWestMaridia),
    ShipHallway: true
  },
  SpongeBathRight: {
    SpongeBathLeft: true,
    ShipRearExit: true
  },
  "Missiles (Spooky)": {
    ShipHallway: true
  },
  ShipRearExit: {
    "Energy Tank (Wrecked Ship)": () => HasDefeatedWreckedShipBoss,
    SpongeBathRight: true,
    Door_WSHighway: () => CanUsePowerBombs && (CanMoveInWestMaridia || HasHiJump && (HasSpaceJump || HasSpringBall))
  },
  "Energy Tank (Wrecked Ship)": {
    ShipRearExit: true
  },
  Door_WSHighway: {
    ShipRearExit: () => (CanMoveInWestMaridia || HasHiJump) && HasMorph
  },
  "Missiles (Attic)": {
    ShipHallway: true,
    "Missiles (Sky)": true,
    "Missiles (Ocean Middle)": () => SuperPacks >= 1 && HasMorph,
    "Gravity Suit": () => HasMorph && (CanPassBombPassages || HasSpringBall) && (HasGrapple || HasSpaceJump || TotalTanks >= 1 || HasVaria)
  },
  "Missiles (Sky)": {
    "Missiles (Attic)": true
  },
  "Missiles (Ocean Middle)": {
    "Missiles (Attic)": () => HasMorph && SuperPacks >= 1,
    "Missiles (Ocean Bottom)": () => HasMorph
  },
  "Gravity Suit": {
    "Missiles (Bowling)": () => CanDestroyBombWalls,
    "Missiles (Ocean Bottom)": true
  },
  "Missiles (Bowling)": {
    "Reserve Tank (Wrecked Ship)": () => CanUsePowerBombs && HasSpeed,
    "Gravity Suit": () => CanPassBombPassages
  },
  "Reserve Tank (Wrecked Ship)": {
    "Missiles (Bowling)": true
  },
  Door_PhantoonBoss: {
    ShipHallway: () => CanPassBombPassages
  },
  "Supers (WS Left)": {
    ShipHallway: true
  },
  "Supers (WS Right)": {
    ShipHallway: () => CanPassBombPassages
  }
};

// ../../../tmp/dash/packages/core/lib/graph/data/base/edges/boss.js
var kraidEdges = {
  Exit_Kraid: {
    Boss_Kraid: true
  },
  Boss_Kraid: {
    Exit_Kraid: () => CanKillKraid,
    "Varia Suit": () => CanKillKraid
  },
  "Varia Suit": {
    Boss_Kraid: true
  }
};
var phantoonEdges = {
  Exit_Phantoon: {
    Boss_Phantoon: true
  },
  Boss_Phantoon: {
    Exit_Phantoon: () => CanKillPhantoon
  }
};
var draygonEdges = {
  Exit_Draygon: {
    Boss_Draygon: true
  },
  Boss_Draygon: {
    Exit_Draygon: () => CanKillDraygon,
    "Space Jump": () => CanKillDraygon
  },
  "Space Jump": {
    Boss_Draygon: true
  }
};
var ridleyEdges = {
  Exit_Ridley: {
    Boss_Ridley: true
  },
  Boss_Ridley: {
    Exit_Ridley: () => CanKillRidley,
    "Energy Tank (Ridley)": () => CanKillRidley
  },
  "Energy Tank (Ridley)": {
    Boss_Ridley: true
  }
};
var bossEdges = [
  kraidEdges,
  phantoonEdges,
  draygonEdges,
  ridleyEdges
];

// ../../../tmp/dash/packages/core/lib/graph/data/base/definitions.ts
var getAllVertices = () => {
  return [
    {
      "name": "Ship",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Power Bombs (Landing Site)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "PreGauntlet",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Energy Tank (Gauntlet)",
      "type": "major",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "GauntletBackSideLeftDoor",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Gauntlet Left)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Gauntlet Right)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Moat)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_Moat",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Parlor",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (230)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Bombs",
      "type": "major",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Terminator)",
      "type": "major",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_G4",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_Kago",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_CrateriaCrabs",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "PreMoat",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Climb",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "ClimbSupersBottom",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Supers (Climb)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Mother Brain)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Construction Zone",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Morphing Ball",
      "type": "major",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_RetroPBs",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Power Bombs (Morph)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Alpha)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Brinstar Ceiling)",
      "type": "major",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Beta)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "BoulderRoom",
      "type": "",
      "area": "Crateria",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Billy Mays 1)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Billy Mays 2)",
      "type": "minor",
      "area": "Crateria",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_GreenElevator",
      "type": "",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Supers (Early Bridge)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Early Bridge)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Reserve Tank (Brinstar)",
      "type": "major",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Brin Reserve 1)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Brin Reserve 2)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Etecoons)",
      "type": "major",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (Etecoons)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Etecoons)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "DachoraRoomLeft",
      "type": "",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "DachoraRoomRight",
      "type": "",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Big Pink)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Mission Impossible)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Wave Gate)",
      "type": "major",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (Spore Spawn)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Charge)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Charge Beam",
      "type": "major",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Waterway)",
      "type": "major",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_GreenHills",
      "type": "",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Brin Tube)",
      "type": "minor",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_NoobBridge",
      "type": "",
      "area": "GreenBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RedTower",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Spazer",
      "type": "major",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Alpha)",
      "type": "minor",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Alpha PBs)",
      "type": "minor",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Beta)",
      "type": "minor",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Xray Scope",
      "type": "major",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "XrayHallway",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RedElevator",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_MaridiaEscape",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_MaridiaTube",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RedTowerToMaridiaMap",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RedTowerToKraid",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedTowerTop",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedTowerMid",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedTowerBottom",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedTowerElevatorRoom",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedBrinstarElevatorRoom",
      "type": "",
      "area": "RedBrinstar",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_BusinessCenterLeft",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_BusinessCenterRight",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Ice Beam",
      "type": "major",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Crumble Shaft)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (HJB)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "HiJump Boots",
      "type": "major",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (HJB)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Croc Escape)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Cathedral)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Bubble Mountain)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Reserve Tank (Norfair)",
      "type": "major",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Norfair Reserve 1)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Norfair Reserve 2)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Speed Booster",
      "type": "major",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Speed)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Wave Beam",
      "type": "major",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Wave)",
      "type": "minor",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_CrocEntry",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_SingleChamber",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_KronicBoost",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "PreCrocomire",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BubbleMountainMain",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BubbleMountainBottomLeftDoor",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BubbleMountainKingCacLedge",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BubbleMountainTopLeftDoor",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "KronicBoostBottom",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "NutellaRefill",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BusinessCenter",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "CathedralEntrance",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BusinessCenterSaveStation",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "IceBeamGatesTopLeftDoor",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "IceBeamGatesBottomLeftDoor",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "SingleChamberTopRightDoor",
      "type": "",
      "area": "UpperNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RidleyMouth",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_Musketeers",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Ruins",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (GT)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (GT)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Screw Attack",
      "type": "major",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "PrePillars",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RidleyBoss",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "WorstRoomBottom",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "WorstRoomTop",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Mickey Mouse)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "RedKihunterShaftTop",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Wasteland",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Energy Tank (Firefleas)",
      "type": "major",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Maze)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Maze)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Three Musketeers)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Musketeers",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Power Bombs (Shame)",
      "type": "minor",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "GoldTorizoFight",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "DefeatedGoldTorizo",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "ScrewAttackTop",
      "type": "",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Exit_Ridley",
      "type": "exit",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Ridley",
      "type": "boss",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Ridley)",
      "type": "major",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Kraid",
      "type": "exit",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Kraid",
      "type": "boss",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Varia Suit",
      "type": "major",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Phantoon",
      "type": "exit",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Phantoon",
      "type": "boss",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Draygon",
      "type": "exit",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Draygon",
      "type": "boss",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Space Jump",
      "type": "major",
      "area": "LowerNorfair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_KraidsLair",
      "type": "",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Energy Tank (Kraid)",
      "type": "major",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "KraidsHallway",
      "type": "",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Kraid)",
      "type": "minor",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_KraidBoss",
      "type": "",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Exit_Kraid",
      "type": "exit",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Kraid",
      "type": "boss",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Varia Suit",
      "type": "major",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Phantoon",
      "type": "exit",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Phantoon",
      "type": "boss",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Draygon",
      "type": "exit",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Draygon",
      "type": "boss",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Space Jump",
      "type": "major",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Ridley",
      "type": "exit",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Ridley",
      "type": "boss",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Ridley)",
      "type": "major",
      "area": "KraidsLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_Ocean",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Ocean Bottom)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "ShipHallway",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "ShipRearExit",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Spooky)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_PhantoonBoss",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Supers (WS Left)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (WS Right)",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Wrecked Ship)",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Reserve Tank (Wrecked Ship)",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Gravity Suit",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Attic)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Bowling)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Ocean Middle)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Sky)",
      "type": "minor",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_WSHighway",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "SpongeBathLeft",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "SpongeBathRight",
      "type": "",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Exit_Phantoon",
      "type": "exit",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Phantoon",
      "type": "boss",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Kraid",
      "type": "exit",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Kraid",
      "type": "boss",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Varia Suit",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Draygon",
      "type": "exit",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Draygon",
      "type": "boss",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Space Jump",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Ridley",
      "type": "exit",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Ridley",
      "type": "boss",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Ridley)",
      "type": "major",
      "area": "WreckedShip",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_MainStreet",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "MainStreet",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Mainstreet)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (Crab)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Mama Turtle)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Mama Turtle)",
      "type": "major",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_MaridiaMap",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "AboveMaridiaMap",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "EverestTopRight",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_RedFish",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Beach)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Watering Hole)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (Watering Hole)",
      "type": "minor",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_PreAqueduct",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RedFish",
      "type": "",
      "area": "WestMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_DraygonBoss",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_Aqueduct",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Door_EMHighway",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BotwoonHallwayLeft",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "BotwoonHallwayRight",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Aqueduct",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "ColosseumTopLeft",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "ColosseumTopRight",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "MaridiaHighway",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Spring Ball",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Plasma Beam",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "PrePlasmaBeam",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "PlasmaSparkRoomTop",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "PlasmaSparkRoomBottom",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "OasisTop",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "OasisBottom",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "LeftSandPitBottom",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "RightSandPitBottom",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Missiles (Sand Pit Left)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Reserve Tank (Maridia)",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Sand Pit Right)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Sand Pit Right)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Botwoon)",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Precious)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Aqueduct)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Supers (Aqueduct)",
      "type": "minor",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "PostBotwoon",
      "type": "",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Exit_Draygon",
      "type": "exit",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Draygon",
      "type": "boss",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Space Jump",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Kraid",
      "type": "exit",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Kraid",
      "type": "boss",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Varia Suit",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Phantoon",
      "type": "exit",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Phantoon",
      "type": "boss",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Exit_Ridley",
      "type": "exit",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Boss_Ridley",
      "type": "boss",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Energy Tank (Ridley)",
      "type": "major",
      "area": "EastMaridia",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_CrocsLair",
      "type": "",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "PostCroc",
      "type": "",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": -1
    },
    {
      "name": "Energy Tank (Crocomire)",
      "type": "major",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Power Bombs (Crocomire)",
      "type": "minor",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Grapple Beam",
      "type": "major",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Indiana Jones)",
      "type": "minor",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Missiles (Cosine)",
      "type": "minor",
      "area": "CrocomiresLair",
      "pathToStart": false,
      "progression": 0
    },
    {
      "name": "Door_Tourian",
      "type": "",
      "area": "Tourian",
      "pathToStart": false,
      "progression": -1
    }
  ];
};
var getStandardEdges = () => {
  return [
    crateriaEdges,
    greenbrinstarEdges,
    redbrinstarEdges,
    kraidslairEdges,
    crocomireEdges,
    westmaridiaEdges,
    eastmaridiaEdges,
    uppernorfairEdges,
    lowernorfairEdges,
    wreckedshipEdges
  ];
};

// ../../../tmp/dash/packages/core/lib/graph/data/chozo/edges.js
var UpperNorfair_CathedralEntrance_to_BubbleMountainMain = {
  edges: ["CathedralEntrance", "BubbleMountainMain"],
  requires: () => HellRunTanks >= 3 && CanOpenGreenDoors
};
var ChozoEdgeUpdates = [
  UpperNorfair_CathedralEntrance_to_BubbleMountainMain
];

// ../../../tmp/dash/packages/core/lib/graph/init.ts
var createGraph = (portalMapping, vertexUpdates, edgeUpdates) => {
  const allVertices = getAllVertices();
  const findVertex = (name, area) => {
    const vertex = allVertices.find((v) => {
      if (area != void 0 && v.area != area) {
        return false;
      }
      return v.name == name;
    });
    if (vertex == void 0) {
      const msg = `createGraph: could not find vertex, ${name} ${area}`;
      throw new Error(msg);
    }
    return vertex;
  };
  const loadEdges = (areaEdges, area) => {
    return Object.entries(areaEdges).map(([from, w]) => {
      return Object.entries(w).map(([to, condition2]) => {
        return {
          from: findVertex(from, area),
          to: findVertex(to, area),
          condition: condition2
        };
      });
    }).reduce((acc, cur) => {
      return acc.concat(cur);
    }, []);
  };
  vertexUpdates.forEach((v) => {
    findVertex(v.name).type = v.type;
  });
  let edges = getStandardEdges().map((areaEdges) => loadEdges(areaEdges)).reduce((acc, cur) => acc.concat(cur), []);
  const bossAreas = [
    "KraidsLair",
    "WreckedShip",
    "EastMaridia",
    "LowerNorfair"
  ];
  bossEdges.forEach((b) => {
    const keys = Object.keys(b);
    bossAreas.forEach((area) => {
      const portal = portalMapping.find((p) => {
        if (p[1].area != area) {
          return false;
        }
        return keys.includes(p[1].name);
      });
      if (portal != null) {
        edges = edges.concat(loadEdges(b, area));
      }
    });
  });
  edges = edges.concat(
    portalMapping.map((a) => {
      return {
        from: findVertex(a[0].name, a[0].area),
        to: findVertex(a[1].name, a[1].area),
        condition: true
      };
    })
  ).concat(
    portalMapping.map((a) => {
      return {
        from: findVertex(a[1].name, a[1].area),
        to: findVertex(a[0].name, a[0].area),
        condition: true
      };
    })
  );
  edgeUpdates.forEach((c) => {
    const [from, to] = c.edges;
    const edge = edges.find((n) => n.from.name == from && n.to.name == to);
    if (edge == null) {
      throw new Error(`Could not find edge from ${from} to ${to}`);
    }
    edge.condition = c.requires;
  });
  edges[0].from.pathToStart = true;
  return edges.filter((e) => e.condition !== false);
};
var cloneGraph = (graph) => {
  const newVertices = getAllVertices();
  const remap = (orig) => {
    let v = newVertices.find((v2) => v2.name == orig.name && v2.area == orig.area);
    if (v == void 0) {
      throw new Error("cloneGraph: missing vertex to remap");
    }
    v.type = orig.type;
    v.pathToStart = orig.pathToStart;
    v.progression = orig.progression;
    v.item = orig.item;
    return v;
  };
  return graph.map((e) => {
    return {
      from: remap(e.from),
      to: remap(e.to),
      condition: e.condition
    };
  });
};
var getEdgeUpdates = (mapLayout, areaShuffle, majorDistributionMode) => {
  const majorModeEdgeUpdates = majorDistributionMode === MajorDistributionMode.Chozo ? ChozoEdgeUpdates : [];
  switch (mapLayout) {
    case MapLayout.Standard:
    case MapLayout.Classic:
      if (areaShuffle) {
        return majorModeEdgeUpdates.concat(StandardAreaEdgeUpdates);
      }
      return majorModeEdgeUpdates;
    default:
      throw new Error(`Unknown map layout: ${mapLayout}`);
  }
};
var getVertexUpdates = (mode) => {
  switch (mode) {
    case MajorDistributionMode.Chozo:
      return ChozoVertexUpdates;
    default:
      return [];
  }
};
var addBossItems = (graph) => {
  const isUnique = (value, index, array) => {
    return array.indexOf(value) === index;
  };
  const bosses2 = graph.filter((e) => e.from.type == "boss").map((e) => e.from).filter(isUnique);
  bosses2.forEach((boss) => {
    switch (boss.area) {
      case "KraidsLair":
        boss.item = bossItem(Item.DefeatedBrinstarBoss);
        break;
      case "WreckedShip":
        boss.item = bossItem(Item.DefeatedWreckedShipBoss);
        break;
      case "EastMaridia":
        boss.item = bossItem(Item.DefeatedMaridiaBoss);
        break;
      case "LowerNorfair":
        boss.item = bossItem(Item.DefeatedNorfairBoss);
        break;
    }
  });
};
var loadGraph = (seed, attempt, mapLayout, majorDistributionMode, areaShuffle = false, relaxed = false, bossMode = BossMode.Vanilla, portals) => {
  const getSeed = () => {
    if (attempt == 1) {
      return seed;
    }
    const seedGen = new dotnet_random_default(-seed);
    for (let i = 0; i < attempt - 2; i++) {
      seedGen.InternalSample();
    }
    return seedGen.NextInRange(1, 1e6);
  };
  const getPortals = () => portals ? portals : generatePortals(getSeed(), areaShuffle, bossMode);
  const edgeUpdates = relaxed ? RelaxedEdgeUpdates : [];
  const g = createGraph(
    getPortals(),
    getVertexUpdates(majorDistributionMode),
    edgeUpdates.concat(getEdgeUpdates(mapLayout, areaShuffle, majorDistributionMode))
  );
  addBossItems(g);
  return g;
};

// ../../../tmp/dash/packages/core/lib/graph/itemPool.ts
var getItemPool = (seed, settings, count) => {
  const { majorDistribution, minorDistribution, extraItems, beamMode } = settings;
  const rnd = new dotnet_random_default(seed);
  let itemPool = [
    majorItem(Item.EnergyTank),
    minorItem(Item.Missile),
    minorItem(Item.Super),
    minorItem(Item.PowerBomb),
    majorItem(Item.Bombs),
    majorItem(Item.Ice),
    majorItem(Item.HJB),
    majorItem(Item.Speed),
    majorItem(Item.Wave),
    majorItem(Item.Spazer),
    majorItem(Item.SpringBall),
    majorItem(Item.Varia),
    majorItem(Item.Plasma),
    majorItem(Item.Grapple),
    majorItem(Item.Morph),
    majorItem(Item.Reserve),
    majorItem(Item.Gravity),
    majorItem(Item.Xray),
    majorItem(Item.SpaceJump),
    majorItem(Item.ScrewAttack)
  ];
  let extraItem = majorItem;
  if (majorDistribution == MajorDistributionMode.Chozo) {
    itemPool.forEach((i) => i.isMajor = true);
    extraItem = minorItem;
  }
  switch (beamMode) {
    case BeamMode.Vanilla:
      itemPool.push(majorItem(Item.Charge));
      break;
    case BeamMode.Starter:
      itemPool.push(majorItem(Item.BeamUpgrade));
      break;
    case BeamMode.DashRecall:
      itemPool.push(
        majorItem(Item.BeamUpgrade),
        extraItem(Item.BeamUpgrade),
        extraItem(Item.BeamUpgrade),
        extraItem(Item.BeamUpgrade)
      );
      break;
    case BeamMode.StarterPlus:
      itemPool.push(
        majorItem(Item.BeamUpgrade),
        extraItem(Item.BeamUpgrade)
      );
      break;
  }
  extraItems.forEach((i) => {
    if (i == Item.DoubleJump) {
      itemPool.push(extraItem(Item.DoubleJump));
    } else if (i == Item.PressureValve) {
      itemPool.push(extraItem(Item.PressureValve));
    } else if (i == Item.HeatShield) {
      itemPool.push(extraItem(Item.HeatShield));
    }
  });
  const setAmountInPool = (type, count2, isMajor) => {
    const item = itemPool.find((i) => i.type == type && i.isMajor == isMajor);
    if (item == void 0) {
      throw new Error("setAmountInPool: failed to find item");
    }
    while (itemPool.filter((i) => i == item).length < count2) {
      itemPool.unshift(item);
    }
  };
  if (majorDistribution == MajorDistributionMode.Full) {
    setAmountInPool(Item.Reserve, 4, true);
    setAmountInPool(Item.EnergyTank, 14, true);
  } else if (majorDistribution == MajorDistributionMode.Chozo) {
    let majorEnergyTanks = count > 100 ? 4 : 3;
    let majorMissiles = 2;
    let majorSupers = 2;
    if (count < 100) {
      const r = itemPool.findIndex((i) => i.isMajor && i.type == Item.Reserve);
      itemPool[r].isMajor = false;
      if (count < 99) {
        majorMissiles = 1;
        if (count < 98) {
          majorSupers = 1;
        }
      }
    }
    setAmountInPool(Item.EnergyTank, majorEnergyTanks, true);
    setAmountInPool(Item.Missile, majorMissiles, true);
    setAmountInPool(Item.Super, majorSupers, true);
    itemPool.push(minorItem(Item.EnergyTank));
    setAmountInPool(Item.EnergyTank, 14 - majorEnergyTanks, false);
    itemPool.push(minorItem(Item.Reserve));
    setAmountInPool(Item.EnergyTank, 3, false);
    itemPool.push(
      minorItem(Item.Missile),
      minorItem(Item.Super),
      minorItem(Item.PowerBomb)
    );
  } else {
    const getNumMajors = () => {
      switch (majorDistribution) {
        case MajorDistributionMode.Standard:
          return 34 - (100 - count);
        default:
          throw new Error("Unknown major distribution");
      }
    };
    const numMajors = getNumMajors();
    const numNonTanks = itemPool.filter((i) => i.isMajor).length - 2;
    const maxEnergyTanks = count > 100 ? 15 : 14;
    const numReserves = Math.max(2, Math.min(4, numMajors - numNonTanks - 14));
    setAmountInPool(Item.Reserve, numReserves, true);
    const numEnergyTanks = Math.min(maxEnergyTanks, numMajors - numNonTanks - numReserves);
    setAmountInPool(Item.EnergyTank, numEnergyTanks, true);
  }
  let numMissiles = 1;
  let numSupers = 1;
  let numPBs = 1;
  let itemCount = itemPool.length;
  const getDistribution = () => {
    switch (minorDistribution) {
      case MinorDistributionMode.Standard:
        return [3, 5, 6];
      case MinorDistributionMode.Dash:
        return [2, 3, 4];
      default:
        throw new Error("Unknown minor distribution");
    }
  };
  const distribution = getDistribution();
  while (itemCount < count) {
    const draw = rnd.Next(distribution[distribution.length - 1]);
    if (draw < distribution[0]) {
      numMissiles += 1;
    } else if (draw < distribution[1]) {
      numSupers += 1;
    } else {
      numPBs += 1;
    }
    itemCount += 1;
  }
  setAmountInPool(Item.Missile, numMissiles, false);
  setAmountInPool(Item.Super, numSupers, false);
  setAmountInPool(Item.PowerBomb, numPBs, false);
  if (itemPool.length != count) {
    const msg = `Not ${count} items`;
    throw new Error(msg);
  }
  return itemPool;
};

// ../../../tmp/dash/packages/core/lib/graph/fill.ts
var canPlaceItem_Full = (item, vertex) => {
  if (vertex.item != void 0) {
    return false;
  }
  if (item.type == Item.Gravity || item.type == Item.HeatShield || item.type == Item.PressureValve) {
    switch (vertex.area) {
      case "Crateria":
        return false;
      default:
        break;
    }
  } else if (item.type == Item.Varia) {
    switch (vertex.area) {
      case "Crateria":
      case "LowerNorfair":
        return false;
      default:
        break;
    }
  }
  return true;
};
var canPlaceItem_MajorMinor = (item, vertex) => {
  if (vertex.item != void 0) {
    return false;
  }
  if (item.isMajor != (vertex.type == "major")) {
    return false;
  }
  if (item.type == Item.Gravity || item.type == Item.HeatShield || item.type == Item.PressureValve) {
    switch (vertex.area) {
      case "Crateria":
        return false;
      default:
        break;
    }
  } else if (item.type == Item.Varia) {
    switch (vertex.area) {
      case "Crateria":
      case "LowerNorfair":
        return false;
      default:
        break;
    }
  }
  return true;
};
var getFullPrePool = (rnd) => {
  const prePool = [Item.Morph];
  if (rnd.Next(100) < 65) {
    prePool.push(Item.Missile);
  } else {
    prePool.push(Item.Super);
  }
  switch (rnd.Next(13)) {
    case 0:
      prePool.push(Item.Missile, Item.ScrewAttack);
      break;
    case 1:
      prePool.push(Item.Missile, Item.Speed);
      break;
    case 2:
      prePool.push(Item.Missile, Item.Bombs);
      break;
    default:
      break;
  }
  prePool.push(Item.PowerBomb);
  return prePool;
};
var getMajorMinorPrePool = (rnd) => {
  const prePool = [Item.Morph];
  if (rnd.Next(100) < 65) {
    prePool.push(Item.Missile);
  } else {
    prePool.push(Item.Super);
  }
  switch (rnd.Next(13)) {
    case 0:
      prePool.push(Item.Speed);
      break;
    case 1:
    case 2:
      prePool.push(Item.ScrewAttack);
      break;
    case 3:
    case 4:
    case 5:
    case 6:
      prePool.push(Item.Bombs);
      break;
    default:
      prePool.push(Item.PowerBomb);
      break;
  }
  return prePool;
};
var getChozoPrePool = (rnd) => {
  const prePool = [Item.Morph];
  switch (rnd.Next(10)) {
    case 0:
      prePool.push(Item.ScrewAttack);
      break;
    case 1:
      prePool.push(Item.Bombs);
      break;
    case 2:
    case 3:
      prePool.push(Item.PowerBomb);
      break;
    case 4:
    case 5:
    case 6:
      prePool.push(Item.Super);
      break;
    default:
      prePool.push(Item.Missile);
      break;
  }
  return prePool;
};
var graphFill = (seed, rnd, graph, settings, maxAttempts = 10) => {
  const restrictType = settings.majorDistribution != MajorDistributionMode.Full;
  const swap = (arr, x, y) => {
    const tmp = arr[x];
    arr[x] = arr[y];
    arr[y] = tmp;
  };
  const shuffle2 = (arr) => {
    for (let i = 0; i < arr.length; i++) {
      swap(arr, i, rnd.NextInRange(i, arr.length));
    }
  };
  let itemVertices = graph.map((e) => e.from).filter((v) => {
    return v.type == "major" || v.type == "minor";
  });
  const isUnique = (value, index, array) => {
    return array.indexOf(value) === index;
  };
  let shuffledLocations = itemVertices.filter(isUnique);
  shuffle2(shuffledLocations);
  const canPlaceItem = restrictType ? canPlaceItem_MajorMinor : canPlaceItem_Full;
  const itemPool = getItemPool(seed, settings, shuffledLocations.length);
  const getPrePool = restrictType ? settings.majorDistribution == MajorDistributionMode.Chozo ? getChozoPrePool : getMajorMinorPrePool : getFullPrePool;
  let prefillLoadout = createLoadout();
  const startVertex = graph[0].from;
  getPrePool(rnd).forEach((itemType) => {
    const itemIndex = itemPool.findIndex((i) => {
      if (settings.majorDistribution != MajorDistributionMode.Chozo) {
        return i.type == itemType;
      }
      return i.isMajor && i.type == itemType;
    });
    const item = itemPool.splice(itemIndex, 1)[0];
    const checker = checkFlags(prefillLoadout);
    const available = shuffledLocations.find(
      (v) => canPlaceItem(item, v) && canReachVertex(graph, startVertex, v, checker) && canReachVertex(graph, v, startVertex, checker)
    );
    if (available == void 0) {
      throw new Error("graphFill: failed to find available location for item");
    }
    available.item = item;
    addItem(prefillLoadout, itemType);
  });
  const placeItems = (itemPool2, vertices) => {
    let shuffledItems = [...itemPool2];
    shuffle2(shuffledItems);
    for (let j = 0; j < vertices.length; j++) {
      let v = vertices[j];
      const itemIndex = shuffledItems.findIndex((i) => canPlaceItem(i, v));
      if (itemIndex < 0) {
        return false;
      }
      v.item = shuffledItems.splice(itemIndex, 1)[0];
    }
    return true;
  };
  const nonPrefilled = shuffledLocations.filter((n) => n.item == void 0);
  const emptyLoadout = createLoadout();
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    nonPrefilled.forEach((n) => n.item = void 0);
    if (!placeItems(itemPool, nonPrefilled)) {
      continue;
    }
    if (isGraphValid(cloneGraph(graph), settings, emptyLoadout)) {
      return attempts;
    }
  }
  throw new Error(
    `Failed to fill graph for seed ${seed} after ${attempts} attempts`
  );
};
var generateSeed = (seed, settings, options) => {
  const maxOuterLoop = 40;
  let maxInnerLoop = 40;
  const rnd = new dotnet_random_default(seed);
  if (settings.majorDistribution == MajorDistributionMode.Chozo) {
    maxInnerLoop *= 5;
  }
  if (!settings.randomizeAreas) {
    maxInnerLoop *= 10;
  }
  let attempts = 1;
  while (attempts < maxOuterLoop) {
    const graph = loadGraph(
      seed,
      attempts,
      settings.mapLayout,
      settings.majorDistribution,
      settings.randomizeAreas,
      options.RelaxedLogic,
      settings.bossMode
    );
    try {
      graphFill(seed, rnd, graph, settings, maxInnerLoop);
      return graph;
    } catch (e) {
      attempts += 1;
    }
  }
  throw new Error(`Failed to generate seed ${seed}`);
};

// ../../../tmp/dash/packages/core/data/doors.ts
var DOORS = [
  {
    door: "Door_KraidBoss",
    area: "KraidsLair",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorToKraidBoss,
    vector: BOSS_DOORS.DoorVectorToPreKraid
  },
  {
    door: "Exit_Kraid",
    area: "KraidsLair",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromKraidInBrinstar,
    vector: BOSS_DOORS.DoorVectorToKraidInBrinstar
  },
  {
    door: "Exit_Kraid",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromKraidInWreckedShip,
    vector: BOSS_DOORS.DoorVectorToKraidInWreckedShip
  },
  {
    door: "Exit_Kraid",
    area: "EastMaridia",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromKraidInMaridia,
    vector: BOSS_DOORS.DoorVectorToKraidInMaridia
  },
  {
    door: "Exit_Kraid",
    area: "LowerNorfair",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromKraidInNorfair,
    vector: BOSS_DOORS.DoorVectorToKraidInNorfair
  },
  {
    door: "Door_PhantoonBoss",
    area: "WreckedShip",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorToPhantoonBoss,
    vector: BOSS_DOORS.DoorVectorToPrePhantoon
  },
  {
    door: "Exit_Phantoon",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromPhantoonInWreckedShip,
    vector: BOSS_DOORS.DoorVectorToPhantoonInWreckedShip
  },
  {
    door: "Exit_Phantoon",
    area: "KraidsLair",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromPhantoonInBrinstar,
    vector: BOSS_DOORS.DoorVectorToPhantoonInBrinstar
  },
  {
    door: "Exit_Phantoon",
    area: "EastMaridia",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromPhantoonInMaridia,
    vector: BOSS_DOORS.DoorVectorToPhantoonInMaridia
  },
  {
    door: "Exit_Phantoon",
    area: "LowerNorfair",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromPhantoonInNorfair,
    vector: BOSS_DOORS.DoorVectorToPhantoonInNorfair
  },
  {
    door: "Door_DraygonBoss",
    area: "EastMaridia",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorToDraygonBoss,
    vector: BOSS_DOORS.DoorVectorToPreDraygon
  },
  {
    door: "Exit_Draygon",
    area: "EastMaridia",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromDraygonInMaridia,
    vector: BOSS_DOORS.DoorVectorToDraygonInMaridia
  },
  {
    door: "Exit_Draygon",
    area: "KraidsLair",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromDraygonInBrinstar,
    vector: BOSS_DOORS.DoorVectorToDraygonInBrinstar
  },
  {
    door: "Exit_Draygon",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromDraygonInWreckedShip,
    vector: BOSS_DOORS.DoorVectorToDraygonInWreckedShip
  },
  {
    door: "Exit_Draygon",
    area: "LowerNorfair",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromDraygonInNorfair,
    vector: BOSS_DOORS.DoorVectorToDraygonInNorfair
  },
  {
    door: "Door_RidleyBoss",
    area: "LowerNorfair",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorToRidleyBoss,
    vector: BOSS_DOORS.DoorVectorToPreRidley
  },
  {
    door: "Exit_Ridley",
    area: "LowerNorfair",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromRidleyInNorfair,
    vector: BOSS_DOORS.DoorVectorToRidleyInNorfair
  },
  {
    door: "Exit_Ridley",
    area: "KraidsLair",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromRidleyInBrinstar,
    vector: BOSS_DOORS.DoorVectorToRidleyInBrinstar
  },
  {
    door: "Exit_Ridley",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: BOSS_DOORS.DoorFromRidleyInWreckedShip,
    vector: BOSS_DOORS.DoorVectorToRidleyInWreckedShip
  },
  {
    door: "Exit_Ridley",
    area: "EastMaridia",
    from: "right",
    to: "left",
    address: BOSS_DOORS.DoorFromRidleyInMaridia,
    vector: BOSS_DOORS.DoorVectorToRidleyInMaridia
  },
  {
    door: "Door_RetroPBs",
    area: "Crateria",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_RetroPBs,
    vector: AREA_DOORS.DoorVectorToRetroPBs
  },
  {
    door: "Door_GreenHills",
    area: "GreenBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_GreenHills,
    vector: AREA_DOORS.DoorVectorToGreenHills
  },
  {
    door: "Door_Moat",
    area: "Crateria",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_Moat,
    vector: AREA_DOORS.DoorVectorToMoat
  },
  {
    door: "Door_Ocean",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_Ocean,
    vector: AREA_DOORS.DoorVectorToOcean
  },
  {
    door: "Door_G4",
    area: "Crateria",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_G4,
    vector: AREA_DOORS.DoorVectorToG4
  },
  {
    door: "Door_Tourian",
    area: "Tourian",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_Tourian,
    vector: AREA_DOORS.DoorVectorToTourian
  },
  {
    door: "Door_Kago",
    area: "Crateria",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_Kago,
    vector: AREA_DOORS.DoorVectorToKago
  },
  {
    door: "Door_GreenElevator",
    area: "GreenBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_GreenElevator,
    vector: AREA_DOORS.DoorVectorToGreenElevator
  },
  {
    door: "Door_CrateriaCrabs",
    area: "Crateria",
    from: "bottom",
    to: "top",
    address: AREA_DOORS.Door_Crabs,
    vector: AREA_DOORS.DoorVectorToCrabs
  },
  {
    door: "Door_RedElevator",
    area: "RedBrinstar",
    from: "top",
    to: "bottom",
    address: AREA_DOORS.Door_RedElevator,
    vector: AREA_DOORS.DoorVectorToRedElevator
  },
  {
    door: "Door_WSHighway",
    area: "WreckedShip",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_HighwayExit,
    vector: AREA_DOORS.DoorVectorToHighwayExit
  },
  {
    door: "Door_EMHighway",
    area: "EastMaridia",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_Highway,
    vector: AREA_DOORS.DoorVectorToHighway
  },
  {
    door: "Door_NoobBridge",
    area: "GreenBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_NoobBridge,
    vector: AREA_DOORS.DoorVectorToNoobBridge
  },
  {
    door: "Door_RedTower",
    area: "RedBrinstar",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_RedTower,
    vector: AREA_DOORS.DoorVectorToRedTower
  },
  {
    door: "Door_MaridiaEscape",
    area: "RedBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_MaridiaEscape,
    vector: AREA_DOORS.DoorVectorToMaridiaEscape
  },
  {
    door: "Door_RedFish",
    area: "WestMaridia",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_RedFish,
    vector: AREA_DOORS.DoorVectorToRedFish
  },
  {
    door: "Door_MaridiaTube",
    area: "RedBrinstar",
    from: "top",
    to: "bottom",
    address: AREA_DOORS.Door_MaridiaTube,
    vector: AREA_DOORS.DoorVectorToMaridiaTube
  },
  {
    door: "Door_MainStreet",
    area: "WestMaridia",
    from: "bottom",
    to: "top",
    address: AREA_DOORS.Door_MainStreet,
    vector: AREA_DOORS.DoorVectorToMainStreet
  },
  {
    door: "Door_RedTowerToKraid",
    area: "RedBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_KraidEntry,
    vector: AREA_DOORS.DoorVectorToKraidEntry
  },
  {
    door: "Door_BusinessCenterLeft",
    area: "UpperNorfair",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_ElevatorEntry,
    vector: AREA_DOORS.DoorVectorToElevatorEntry
  },
  {
    door: "Door_RedTowerToMaridiaMap",
    area: "RedBrinstar",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_AboveKraid,
    vector: AREA_DOORS.DoorVectorToAboveKraid
  },
  {
    door: "Door_MaridiaMap",
    area: "WestMaridia",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_MaridiaMap,
    vector: AREA_DOORS.DoorVectorToMaridiaMap
  },
  {
    door: "Door_BusinessCenterRight",
    area: "UpperNorfair",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_KraidMouth,
    vector: AREA_DOORS.DoorVectorToKraidMouth
  },
  {
    door: "Door_KraidsLair",
    area: "KraidsLair",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_KraidsLair,
    vector: AREA_DOORS.DoorVectorToKraidsLair
  },
  {
    door: "Door_CrocEntry",
    area: "UpperNorfair",
    from: "bottom",
    to: "top",
    address: AREA_DOORS.Door_CrocEntry,
    vector: AREA_DOORS.DoorVectorToCrocEntry
  },
  {
    door: "Door_CrocsLair",
    area: "CrocomiresLair",
    from: "top",
    to: "bottom",
    address: AREA_DOORS.Door_Croc,
    vector: AREA_DOORS.DoorVectorToCroc
  },
  {
    door: "Door_SingleChamber",
    area: "UpperNorfair",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_SingleChamber,
    vector: AREA_DOORS.DoorVectorToSingleChamber
  },
  {
    door: "Door_Musketeers",
    area: "LowerNorfair",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_Muskateers,
    vector: AREA_DOORS.DoorVectorToMuskateers
  },
  {
    door: "Door_KronicBoost",
    area: "UpperNorfair",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_LavaDive,
    vector: AREA_DOORS.DoorVectorToLavaDive
  },
  {
    door: "Door_RidleyMouth",
    area: "LowerNorfair",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_RidleyMouth,
    vector: AREA_DOORS.DoorVectorToRidleyMouth
  },
  {
    door: "Door_PreAqueduct",
    area: "WestMaridia",
    from: "right",
    to: "left",
    address: AREA_DOORS.Door_PreAqueduct,
    vector: AREA_DOORS.DoorVectorToPreAqueduct
  },
  {
    door: "Door_Aqueduct",
    area: "EastMaridia",
    from: "left",
    to: "right",
    address: AREA_DOORS.Door_Aqueduct,
    vector: AREA_DOORS.DoorVectorToAqueduct
  }
];
var isAreaEdge = (edge) => {
  const doors = getAreaPortals().map((p) => p.name);
  if (void 0 == doors.find((d) => d == edge.from.name)) {
    return false;
  }
  if (void 0 == doors.find((d) => d == edge.to.name)) {
    return false;
  }
  return true;
};
var isBossEdge = (edge) => {
  const doors = getBossPortals().map((p) => p.name);
  if (void 0 == doors.find((d) => d == edge.from.name)) {
    return false;
  }
  if (void 0 == doors.find((d) => d == edge.to.name)) {
    return false;
  }
  return true;
};
var doors_default = DOORS;

// ../../../tmp/dash/packages/core/data.ts
var Vanilla = {
  headered: "9a4441809ac9331cdbc6a50fba1a8fbfd08bc490bc8644587ee84a4d6f924fea",
  unheadered: "12b77c4bc9c1832cee8881244659065ee1d84c70c3d29e6eaf92e6798cc2ca72",
  headeredLength: 512
};

// ../../../tmp/dash/packages/core/lib/vanilla.ts
var getCrypto = () => {
  try {
    return window.crypto;
  } catch (_e) {
    try {
      return globalThis.crypto;
    } catch (_e2) {
      throw Error("Could not crypto module");
    }
  }
};
async function getSignature(data) {
  const value = await getCrypto().subtle.digest("SHA-256", data);
  return toHexString(value);
}
var isHeadered = (signature) => signature === Vanilla.headered;
var isVerified = (signature) => signature === Vanilla.unheadered;

// ../../../tmp/dash/packages/core/helpers/patcher.ts
var patchRom = (vanillaRom, basePatch, seedPatch) => {
  let rom = basePatch.Apply(vanillaRom);
  seedPatch.forEach((p) => {
    const [off, cnt, pay] = p;
    for (let i = 0; i < cnt; i++) {
      rom?.set(pay, off + i * pay.length);
    }
  });
  return rom;
};

// ../../../tmp/dash/packages/core/lib/presets.ts
var defaultOptions = {
  DisableFanfare: false,
  RelaxedLogic: false,
  Mystery: false,
  Spoiler: false,
  BossesKnown: false
};
var getAllPresets = () => {
  return [
    Preset_Classic_MM,
    Preset_SurpriseSurprise,
    Preset_Chozo_Bozo,
    Preset_2017_MM,
    Preset_SGL23,
    Preset_SGL24,
    Preset_SGL25,
    Preset_SGL26,
    Preset_Spring_2024,
    Preset_MM_Surprise,
    Preset_MM_Area_Surprise,
    Preset_Full_Surprise,
    Preset_Chozo_Surprise,
    Preset_Chozo_Area_Surprise,
    Preset_Classic_Full,
    Preset_Chozo,
    Preset_Chozo_Bozo_Area,
    Preset_Chozo_Area_Shifted,
    Preset_MM_Area_Shuffled,
    Preset_Full_Area_Shuffled,
    Preset_MM_Area_Scrambled,
    Preset_Chozo_Area_Scrambled,
    Preset_Full_Area_Scrambled
  ];
};
var getPreset = (tag) => {
  if (tag === "mystery") {
    return generateMysteryPreset();
  }
  if (tag === "mystery-ii") {
    return generateMysteryIIPreset();
  }
  return getAllPresets().find((p) => p.tags.includes(tag));
};
var generateMysteryIIPreset = () => {
  const MAX_SEED = 2000001;
  const timestamp = Math.floor(Date.now() % MAX_SEED);
  const rnd = new dotnet_random_default(timestamp);
  const getWeightedRandom = (options) => {
    let sum = 0;
    const draw = rnd.NextDouble();
    for (let i = 0; i < options.length; i++) {
      sum += options[i].weight;
      if (draw < sum) {
        return options[i].value;
      }
    }
    throw new Error("Invalid weights");
  };
  return {
    title: "Mystery II",
    fileName: "MysteryII",
    tags: ["mystery-ii"],
    settings: {
      mapLayout: MapLayout.Standard,
      majorDistribution: getWeightedRandom([
        { value: MajorDistributionMode.Standard, weight: 0.4 },
        { value: MajorDistributionMode.Chozo, weight: 0.4 },
        { value: MajorDistributionMode.Full, weight: 0.2 }
      ]),
      minorDistribution: getWeightedRandom([
        { value: MinorDistributionMode.Standard, weight: 0.7 },
        { value: MinorDistributionMode.Dash, weight: 0.3 }
      ]),
      extraItems: [getWeightedRandom([
        { value: [], weight: 0.5 },
        { value: [Item.DoubleJump], weight: 0.5 }
      ])].concat(
        getWeightedRandom([
          { value: [], weight: 0.5 },
          { value: [Item.HeatShield], weight: 0.5 }
        ])
      ).concat(
        getWeightedRandom([
          { value: [], weight: 0.5 },
          { value: [Item.PressureValve], weight: 0.5 }
        ])
      ),
      beamMode: getWeightedRandom([
        { value: BeamMode.Vanilla, weight: 0.6 },
        { value: BeamMode.Starter, weight: 0.2 },
        { value: BeamMode.StarterPlus, weight: 0.2 }
      ]),
      suitMode: SuitMode.Dash,
      gravityHeatReduction: getWeightedRandom([
        { value: GravityHeatReduction.Off, weight: 0.5 },
        { value: GravityHeatReduction.On, weight: 0.5 }
      ]),
      randomizeAreas: true,
      bossMode: getWeightedRandom([
        { value: BossMode.Scramble, weight: 0.25 },
        { value: BossMode.Shuffled, weight: 0.25 },
        { value: BossMode.Shifted, weight: 0.25 },
        { value: BossMode.Surprise, weight: 0.25 }
      ])
    },
    options: {
      DisableFanfare: false,
      RelaxedLogic: false,
      BossesKnown: getWeightedRandom([
        { value: false, weight: 0.5 },
        { value: true, weight: 0.5 }
      ]),
      Mystery: true,
      Spoiler: false
    }
  };
};
var generateMysteryPreset = () => {
  const MAX_SEED = 2000001;
  const timestamp = Math.floor(Date.now() % MAX_SEED);
  const rnd = new dotnet_random_default(timestamp);
  const getWeightedRandom = (options) => {
    let sum = 0;
    const draw = rnd.NextDouble();
    for (let i = 0; i < options.length; i++) {
      sum += options[i].weight;
      if (draw < sum) {
        return options[i].value;
      }
    }
    throw new Error("Invalid weights");
  };
  return {
    title: "Mystery",
    fileName: "Mystery",
    tags: ["mystery"],
    settings: {
      mapLayout: MapLayout.Standard,
      majorDistribution: getWeightedRandom([
        { value: MajorDistributionMode.Standard, weight: 0.34 },
        { value: MajorDistributionMode.Chozo, weight: 0.33 },
        { value: MajorDistributionMode.Full, weight: 0.33 }
      ]),
      minorDistribution: getWeightedRandom([
        { value: MinorDistributionMode.Standard, weight: 0.5 },
        { value: MinorDistributionMode.Dash, weight: 0.5 }
      ]),
      extraItems: [getWeightedRandom([
        { value: [], weight: 0.5 },
        { value: [Item.DoubleJump], weight: 0.5 }
      ])].concat(
        getWeightedRandom([
          { value: [], weight: 0.75 },
          { value: [Item.HeatShield], weight: 0.25 }
        ])
      ),
      beamMode: getWeightedRandom([
        { value: BeamMode.Vanilla, weight: 0.34 },
        { value: BeamMode.Starter, weight: 0.33 },
        { value: BeamMode.StarterPlus, weight: 0.33 }
      ]),
      suitMode: SuitMode.Dash,
      gravityHeatReduction: getWeightedRandom([
        { value: GravityHeatReduction.Off, weight: 0.75 },
        { value: GravityHeatReduction.On, weight: 0.25 }
      ]),
      randomizeAreas: getWeightedRandom([
        { value: true, weight: 0.67 },
        { value: false, weight: 0.33 }
      ]),
      bossMode: getWeightedRandom([
        { value: BossMode.Vanilla, weight: 0.3 },
        { value: BossMode.Shuffled, weight: 0.3 },
        { value: BossMode.Shifted, weight: 0.3 },
        { value: BossMode.Surprise, weight: 0.1 }
      ])
    },
    options: {
      DisableFanfare: false,
      RelaxedLogic: false,
      Mystery: true,
      Spoiler: false,
      BossesKnown: false
    }
  };
};
var Preset_MM_Surprise = {
  title: "MM Surprise",
  fileName: "MMSurprise",
  tags: ["mm_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_MM_Area_Surprise = {
  title: "MM Area Surprise",
  fileName: "MMAreaSurprise",
  tags: ["mm_area_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_MM_Area_Shuffled = {
  title: "MM Area Shuffled",
  fileName: "MMAreaShuffled",
  tags: ["mm_area_shuffled"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shuffled
  },
  options: defaultOptions
};
var Preset_MM_Area_Scrambled = {
  title: "MM Area Scrambled",
  fileName: "MMAreaScrambled",
  tags: ["mm_area_scrambled"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Scramble
  },
  options: defaultOptions
};
var Preset_Full_Area_Shuffled = {
  title: "Full Area Shuffled",
  fileName: "FullAreaShuffled",
  tags: ["full_area_shuffled"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shuffled
  },
  options: defaultOptions
};
var Preset_Full_Area_Scrambled = {
  title: "Full Area Scrambled",
  fileName: "FullAreaScrambled",
  tags: ["full_area_scrambled"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Scramble
  },
  options: defaultOptions
};
var Preset_Full_Surprise = {
  title: "Full Surprise",
  fileName: "FullSurprise",
  tags: ["full_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_SurpriseSurprise = {
  title: "Surprise Surprise",
  fileName: "SurpriseSurprise",
  tags: ["surprise_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_Chozo_Surprise = {
  title: "Chozo Surprise",
  fileName: "ChozoSurprise",
  tags: ["chozo_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_Chozo_Area_Surprise = {
  title: "Chozo Area Surprise",
  fileName: "ChozoAreaSurprise",
  tags: ["chozo_area_surprise"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_Chozo_Area_Scrambled = {
  title: "Chozo Area Scrambled",
  fileName: "ChozoAreaScrambled",
  tags: ["chozo_area_scrambled"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Scramble
  },
  options: defaultOptions
};
var Preset_Chozo = {
  title: "Chozo",
  fileName: "Chozo",
  tags: ["chozo"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Vanilla
  },
  options: defaultOptions
};
var Preset_Chozo_Bozo = {
  title: "Chozo Bozo",
  fileName: "ChozoBozo",
  tags: ["chozo_bozo"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Shuffled
  },
  options: defaultOptions
};
var Preset_Chozo_Bozo_Area = {
  title: "Chozo Bozo Area",
  fileName: "ChozoBozoArea",
  tags: ["chozo_bozo_area"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shuffled
  },
  options: defaultOptions
};
var Preset_Chozo_Area_Shifted = {
  title: "Chozo Area Shifted",
  fileName: "ChozoAreaShifted",
  tags: ["chozo_area_shifted"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shifted
  },
  options: defaultOptions
};
var Preset_SGL23 = {
  title: "SGL23",
  fileName: "SGL23",
  tags: ["sgl23"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [Item.DoubleJump],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shifted
  },
  options: defaultOptions
};
var Preset_SGL24 = {
  title: "SGL24",
  fileName: "SGL24",
  tags: ["sgl24"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [Item.DoubleJump],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Surprise
  },
  options: defaultOptions
};
var Preset_SGL25 = {
  title: "SGL25",
  fileName: "SGL25",
  tags: ["sgl25"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [Item.DoubleJump],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shifted
  },
  options: defaultOptions
};
var Preset_SGL26 = {
  title: "SGL26",
  fileName: "SGL26",
  tags: ["sgl26"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [Item.DoubleJump, Item.HeatShield, Item.PressureValve],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Shuffled
  },
  options: {
    ...defaultOptions,
    BossesKnown: true
  }
};
var Preset_Spring_2024 = {
  title: "Spring Invitational 2024",
  fileName: "Spring24",
  tags: ["spring24"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Chozo,
    minorDistribution: MinorDistributionMode.Dash,
    extraItems: [],
    beamMode: BeamMode.StarterPlus,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: true,
    bossMode: BossMode.Vanilla
  },
  options: defaultOptions
};
var Preset_Classic_MM = {
  title: "Classic M/M",
  fileName: "ClassicMM",
  tags: ["classic", "classic_mm", "standard_mm"],
  settings: {
    mapLayout: MapLayout.Classic,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Dash,
    extraItems: [],
    beamMode: BeamMode.Starter,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.On,
    randomizeAreas: false,
    bossMode: BossMode.Vanilla
  },
  options: defaultOptions
};
var Preset_Classic_Full = {
  title: "Classic Full",
  fileName: "ClassicFull",
  tags: ["classic_full", "standard_full"],
  settings: {
    mapLayout: MapLayout.Classic,
    majorDistribution: MajorDistributionMode.Full,
    minorDistribution: MinorDistributionMode.Dash,
    extraItems: [],
    beamMode: BeamMode.Starter,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.On,
    randomizeAreas: false,
    bossMode: BossMode.Vanilla
  },
  options: defaultOptions
};
var Preset_2017_MM = {
  title: "Throwback 2017",
  fileName: "2017MM",
  tags: ["2017_mm", "mm"],
  settings: {
    mapLayout: MapLayout.Standard,
    majorDistribution: MajorDistributionMode.Standard,
    minorDistribution: MinorDistributionMode.Standard,
    extraItems: [],
    beamMode: BeamMode.Vanilla,
    suitMode: SuitMode.Dash,
    gravityHeatReduction: GravityHeatReduction.Off,
    randomizeAreas: false,
    bossMode: BossMode.Vanilla
  },
  options: defaultOptions
};

// ../../../tmp/dash/packages/core/lib/graph/utils.ts
var getAreaTransitions = (graph) => {
  return graph.filter((n) => isAreaEdge(n)).map((n) => {
    return [
      { name: n.from.name.slice(), area: n.from.area.slice() },
      { name: n.to.name.slice(), area: n.to.area.slice() }
    ];
  });
};
var getBossTransitions = (graph) => {
  return graph.filter((n) => isBossEdge(n) && n.from.type == "exit").map((n) => {
    return [
      { name: n.from.name.slice(), area: n.from.area.slice() },
      { name: n.to.name.slice(), area: n.to.area.slice() }
    ];
  });
};
var getItemLocations = (graph, sorted) => {
  const nodes = [];
  const getItem = (vertex) => {
    if (vertex === void 0 || vertex.item === void 0) {
      return null;
    }
    return vertex.item;
  };
  getLocations().forEach((l) => {
    const vertex = graph.find((e) => {
      return e.from.name == l.name && getArea(e.from.area) == l.area;
    })?.from;
    nodes.push({
      location: l,
      item: getItem(vertex)
    });
  });
  if (!sorted) {
    return nodes;
  }
  return nodes.sort((a, b) => a.location.address - b.location.address);
};

// ../../../tmp/dash/packages/core/helpers/encoder.ts
var SEED_ENCODING_VERSION = 0;
var BOSS_NAMES = ["Kraid", "Phantoon", "Draygon", "Ridley"];
var BOSS_AREAS = ["KraidsLair", "WreckedShip", "EastMaridia", "LowerNorfair"];
var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var toChar = (val) => {
  if (val > 63) {
    throw new Error("too big");
  }
  return b64.charAt(val);
};
var bossItemLocations = [
  494282,
  // K@K
  0,
  519186,
  // D@K
  519555,
  // R@K
  518650,
  // K@P
  0,
  519284,
  // D@P
  519604,
  // R@P
  518699,
  // K@D
  0,
  509863,
  // D@D
  519653,
  // R@D
  518601,
  // K@R
  0,
  519235,
  // D@R
  495880
  // R@R
];
var encodeSeed = (params, graph) => {
  let encoded = toChar(SEED_ENCODING_VERSION);
  const bytes = new Uint8Array(ENCODED_PARAMS_SIZE + 2);
  const paramBytes = paramsToBytes(
    params.seed,
    params.settings,
    params.options
  );
  bytes.set(paramBytes);
  let pos = paramBytes.length;
  const bosses2 = getBossTransitions(graph);
  const ignore = [...bossItemLocations];
  BOSS_AREAS.forEach((a, i) => {
    const boss = bosses2.find(([_, p]) => p.area === a);
    if (boss === void 0) {
      throw new Error(`encodeSeed: Failed to find boss in ${a}`);
    }
    const to_area = BOSS_AREAS.findIndex((q) => q === boss[0].area);
    const boss_idx = BOSS_NAMES.findIndex((q) => boss[0].name.endsWith(q));
    const word = to_area << 2 | boss_idx;
    ignore[word] = 0;
    if (i % 2 === 0) {
      bytes[pos] = word;
    } else {
      bytes[pos++] |= word << 4 & 240;
    }
  });
  encoded += Buffer.from(bytes).toString("base64");
  const areaPortals = getAreaPortals();
  const portals = getAreaTransitions(graph);
  areaPortals.forEach((p, i) => {
    const mapping = portals.find(
      ([m, _]) => m.name === p.name && m.area === p.area
    );
    if (mapping === void 0) {
      throw new Error(`encodeSeed: Failed to find portal ${p.name}`);
    }
    const idx = areaPortals.findIndex(
      (n) => n.name === mapping[1].name && n.area === mapping[1].area
    );
    if (idx < i) {
      return;
    }
    encoded += toChar(idx);
  });
  const itemTypes = Object.values(Item);
  const itemLocations = getItemLocations(graph, true);
  itemLocations.forEach((p) => {
    if (ignore.includes(p.location.address)) {
      return;
    }
    if (!p.item) {
      return;
    }
    const item = p.item;
    const itemIndex = itemTypes.findIndex((q) => q === item.type) + 1;
    encoded += toChar((p.item.isMajor ? 32 : 0) | itemIndex);
  });
  return base64ToSafe(encoded);
};

// ../../../tmp/dash/packages/core/index.ts
var computeCRC32 = bps_patch_default.CRC32;

// ../../../tmp/dash/packages/core/lib/sm-rando.ts
var generateSeedPatch = (seed, settings, graph, options, race, key) => {
  if (!Number.isInteger(seed)) {
    throw new Error("Seed is not an integer!");
  }
  const encodeRepeating = (patch, offset, length, bytes) => {
    patch.push([offset, length, bytes]);
  };
  const encodeBytes = (patch, offset, bytes) => {
    encodeRepeating(patch, offset, 1, bytes);
  };
  const U8toBytes = (u8) => {
    return new Uint8Array([u8]);
  };
  const U16toBytes = (u16) => {
    return new Uint8Array(new Uint16Array([u16]).buffer);
  };
  const nodes = getItemNodes(graph);
  const seedPatch = [];
  const rnd = new dotnet_random_default(seed);
  encodeBytes(
    seedPatch,
    TABLE_FLAGS.FileSelectCode,
    U16toBytes(rnd.Next(65535))
  );
  encodeBytes(
    seedPatch,
    TABLE_FLAGS.FileSelectCode + 2,
    U16toBytes(rnd.Next(65535))
  );
  if (settings.mapLayout == MapLayout.Classic) {
    DASH_CLASSIC_PATCHES.forEach((p) => {
      encodeBytes(seedPatch, p.room, U16toBytes(p.patch));
    });
  }
  nodes.forEach((n) => {
    const itemBytes = n.location.GetItemBytes(n.item.type);
    encodeBytes(seedPatch, n.location.address, itemBytes);
  });
  const eTanks = nodes.filter((n) => n.item.type == Item.EnergyTank);
  const majors = nodes.filter(
    (n) => n.item.isMajor && n.item.type != Item.EnergyTank && n.item.type != Item.Reserve
  );
  AreaCounts.forEach((addr, area) => {
    const numTanks = eTanks.filter((p) => p.location.area == area).length;
    const numMajors = majors.filter((p) => p.location.area == area).length;
    encodeBytes(seedPatch, addr, new Uint8Array([numMajors, numTanks]));
  });
  encodeBytes(seedPatch, TABLE_FLAGS.ShowBosses, U16toBytes(options.BossesKnown ? 1 : 0));
  getBosses(graph).forEach((bossArray, index) => {
    encodeBytes(seedPatch, 3115800 + index * 2, U16toBytes(bossArray[0]));
    encodeBytes(seedPatch, 3115808 + index * 2, U16toBytes(bossArray[1]));
  });
  const sortedLocations = getLocations().sort((a, b) => a.address - b.address);
  const beamUpgradeSpoilers = [3113005, 3113007, 3113009, 3113011];
  let beamUpgradeIndex = 0;
  sortedLocations.forEach((l, i) => {
    const node = nodes.find((n) => n.location.address === l.address);
    switch (node?.item?.type) {
      case Item.Morph:
        encodeBytes(seedPatch, 3112967, U16toBytes(i + 1));
        break;
      case Item.Bombs:
        encodeBytes(seedPatch, 3112969, U16toBytes(i + 1));
        break;
      case Item.Ice:
        encodeBytes(seedPatch, 3112971, U16toBytes(i + 1));
        break;
      case Item.Charge:
        encodeBytes(seedPatch, 3113003, U16toBytes(i + 1));
        break;
      case Item.HJB:
        encodeBytes(seedPatch, 3112983, U16toBytes(i + 1));
        break;
      case Item.Speed:
        encodeBytes(seedPatch, 3112987, U16toBytes(i + 1));
        break;
      case Item.Wave:
        encodeBytes(seedPatch, 3112973, U16toBytes(i + 1));
        break;
      case Item.Spazer:
        encodeBytes(seedPatch, 3112975, U16toBytes(i + 1));
        break;
      case Item.SpringBall:
        encodeBytes(seedPatch, 3112991, U16toBytes(i + 1));
        break;
      case Item.Varia:
        encodeBytes(seedPatch, 3112979, U16toBytes(i + 1));
        break;
      case Item.Plasma:
        encodeBytes(seedPatch, 3112977, U16toBytes(i + 1));
        break;
      case Item.Grapple:
        encodeBytes(seedPatch, 3112995, U16toBytes(i + 1));
        break;
      case Item.Gravity:
        encodeBytes(seedPatch, 3112981, U16toBytes(i + 1));
        break;
      case Item.Xray:
        encodeBytes(seedPatch, 3112993, U16toBytes(i + 1));
        break;
      case Item.SpaceJump:
        encodeBytes(seedPatch, 3112985, U16toBytes(i + 1));
        break;
      case Item.ScrewAttack:
        encodeBytes(seedPatch, 3112989, U16toBytes(i + 1));
        break;
      case Item.DoubleJump:
        encodeBytes(seedPatch, 3113001, U16toBytes(i + 1));
        break;
      case Item.PressureValve:
        encodeBytes(seedPatch, 3112999, U16toBytes(i + 1));
        break;
      case Item.HeatShield:
        encodeBytes(seedPatch, 3112997, U16toBytes(i + 1));
        break;
      case Item.BeamUpgrade:
        encodeBytes(
          seedPatch,
          beamUpgradeSpoilers[beamUpgradeIndex++],
          U16toBytes(i + 1)
        );
        break;
      default:
        break;
    }
  });
  let hudBits = 29;
  if (settings.majorDistribution == MajorDistributionMode.Full) {
    hudBits |= 2;
  }
  encodeBytes(seedPatch, TABLE_FLAGS.HUDBitField, U8toBytes(hudBits));
  encodeBytes(seedPatch, TABLE_FLAGS.ChargeMode, U8toBytes(settings.beamMode));
  encodeBytes(
    seedPatch,
    TABLE_FLAGS.GravityHeatDamage,
    U16toBytes(settings.gravityHeatReduction)
  );
  const edgePatch = [];
  const encodeEdge = (e) => {
    const x = doors_default.find(
      (d) => d.door == e.from.name && d.area == e.from.area
    );
    const y = doors_default.find((d) => d.door == e.to.name && d.area == e.to.area);
    if (x == void 0 || y == void 0) {
      const msg = `Failed to find boss edge: ${e.from.name} ${e.from.area} to ${e.to.name} ${e.to.area}`;
      throw new Error(msg);
    }
    if (x.address == void 0) {
      return;
    }
    encodeBytes(edgePatch, x.address, U16toBytes(y.vector & 65535));
  };
  graph.filter((e) => isBossEdge(e) || isAreaEdge(e)).forEach((e) => encodeEdge(e));
  edgePatch.sort((a, b) => a[0] - b[0]).forEach((p) => seedPatch.push(p));
  if (options != null) {
    encodeBytes(
      seedPatch,
      TABLE_FLAGS.NoFanfare,
      U16toBytes(options.DisableFanfare ? 1 : 0)
    );
  }
  const seedFlags = new Uint8Array(TABLE_FLAGS.SeedFlagsSize).fill(238);
  seedFlags.set(paramsToBytes(seed, settings, options));
  if (race) {
    seedFlags.set(new Uint8Array(4).fill(238));
  }
  encodeBytes(seedPatch, TABLE_FLAGS.SeedFlags, seedFlags);
  if (key.length > 0) {
    const keyBytes = Buffer.from(key, "base64");
    const size = key.length | (race ? 128 : 0);
    encodeBytes(seedPatch, TABLE_FLAGS.SeedKey, U8toBytes(size));
    keyBytes.forEach((p, i) => {
      encodeBytes(seedPatch, TABLE_FLAGS.SeedKey + i + 1, U8toBytes(p));
    });
  }
  return seedPatch;
};
var getBasePatch = (settings) => {
  const area = settings.randomizeAreas ? "_area" : "";
  return `dash_standard${area}.bps`;
};
var getFileName = (params, graph, rootName, seedKey) => {
  const mode = rootName ? rootName : "Custom";
  if (seedKey) {
    return `DASH_${mode}_${seedKey}.sfc`;
  }
  const encoded = encodeSeed(params, graph);
  const key = computeCRC32(encoded).toString(16);
  return `DASH_${mode}_${key}.sfc`;
};
var getItemNodes = (graph) => {
  const nodes = [];
  getLocations().forEach((l) => {
    const vertex = graph.find((e) => {
      return e.from.name == l.name && getArea(e.from.area) == l.area;
    })?.from;
    if (vertex == void 0 || vertex.item == void 0) {
      return;
    }
    nodes.push({
      location: l,
      item: { ...vertex.item }
    });
  });
  return nodes;
};
var getSeedNumber = (seedNumber) => {
  const MAX_SEED = 1e6;
  if (seedNumber != void 0 && seedNumber != 0) {
    if (seedNumber > 0 && seedNumber <= MAX_SEED) {
      return seedNumber;
    }
    throw new Error("Invalid seed number: " + seedNumber);
  }
  const timestamp = Math.floor(Date.now() % MAX_SEED);
  return new dotnet_random_default(timestamp).NextInRange(1, MAX_SEED);
};
var getBosses = (graph) => {
  const bossEdges2 = graph.filter(isBossEdge).filter((p) => p.to.type == "exit");
  const getBoss = (location) => {
    const edge = bossEdges2.find((p) => p.from.name === `Door_${location}Boss`);
    if (!edge) {
      return [15, 15];
    }
    const boss = graph.find((e) => e.to === edge.to && e.from.type === "boss")?.from.item?.name;
    const getUnlock = () => {
      switch (boss) {
        case "Brinstar Boss":
          return 0;
        case "Wrecked Ship Boss":
          return 1;
        case "Maridia Boss":
          return 2;
        case "Norfair Boss":
          return 3;
        default:
          return 15;
      }
    };
    switch (edge.to.name.slice(5)) {
      case "Kraid":
        return [0, getUnlock()];
      case "Phantoon":
        return [1, getUnlock()];
      case "Draygon":
        return [2, getUnlock()];
      case "Ridley":
        return [3, getUnlock()];
      default:
        return [15, 15];
    }
  };
  return [
    getBoss("Kraid"),
    getBoss("Phantoon"),
    getBoss("Draygon"),
    getBoss("Ridley")
  ];
};

// ../../../tmp/dash/packages/core/lib/randomize.ts
async function RandomizeRom(seed = 0, settings, opts, config, race = false, permaGraph = []) {
  if (!config.vanillaBytes) {
    throw Error("No vanilla ROM data found");
  }
  const defaultOptions2 = {
    DisableFanfare: false,
    RelaxedLogic: false,
    Mystery: false,
    Spoiler: false,
    BossesKnown: false
  };
  const options = { ...defaultOptions2, ...opts };
  const graph = permaGraph.length > 0 ? permaGraph : generateSeed(seed, settings, options);
  const patch = getBasePatch(settings);
  const basePatch = await bps_patch_default.Load(`/patches/${patch}`);
  const seedPatch = generateSeedPatch(
    seed,
    settings,
    graph,
    options,
    race,
    config.seedKey ? config.seedKey : ""
  );
  return {
    data: patchRom(config.vanillaBytes, basePatch, seedPatch),
    name: getFileName(
      { seed, settings, options },
      graph,
      config.presetName,
      config.seedKey
    ),
    hash: encodeSeed({ seed, settings, options }, graph)
  };
}
var randomize_default = RandomizeRom;

// ../../../tmp/tmp.1FRopwCRfN/entry.ts
var patchBase = "";
var setPatchBase = (url) => {
  patchBase = url;
};
var origLoad = bps_patch_default.Load;
bps_patch_default.Load = (name) => origLoad(patchBase + name.replace(/^\/patches\//, ""));
var areaTransitions = (graph) => {
  const edges = graph.filter(isAreaEdge);
  const obj = {};
  getAreaPortals().forEach((p) => {
    const e = edges.find((x) => x.from.name === p.name);
    obj[p.name.replace("Door_", "")] = e ? e.to.name.replace("Door_", "") : "";
  });
  return obj;
};
var bosses = (graph) => {
  const edges = graph.filter(isBossEdge).filter((p) => p.to.type == "exit");
  const boss = (loc2) => {
    const e = edges.find((p) => p.from.name === `Door_${loc2}Boss`);
    return e ? e.to.name.slice(5) : "";
  };
  return { "Kraid's Lair": boss("Kraid"), "Wrecked Ship": boss("Phantoon"), "East Maridia": boss("Draygon"), "Lower Norfair": boss("Ridley") };
};
var items = (graph) => {
  const vs = graph.map((e) => e.from).filter((v) => v.type == "major" || v.type == "minor").filter((v, i, a) => a.indexOf(v) === i);
  const by = (area) => {
    const obj = {};
    vs.filter((p) => p.area === area).sort((a, b) => a.type !== b.type ? a.type.localeCompare(b.type) : a.name.localeCompare(b.name)).forEach((v) => {
      obj[v.name] = v.item ? v.item.name : "";
    });
    return obj;
  };
  const areas = [
    ["Crateria", "Crateria"],
    ["Green Brinstar", "GreenBrinstar"],
    ["Red Brinstar", "RedBrinstar"],
    ["Kraid's Lair", "KraidsLair"],
    ["Crocomire's Lair", "CrocomiresLair"],
    ["Wrecked Ship", "WreckedShip"],
    ["West Maridia", "WestMaridia"],
    ["East Maridia", "EastMaridia"],
    ["Upper Norfair", "UpperNorfair"],
    ["Lower Norfair", "LowerNorfair"]
  ];
  const out = {};
  areas.forEach(([n, k]) => {
    out[n] = by(k);
  });
  return out;
};
var placed = (graph) => {
  const vs = graph.map((e) => e.from).filter((v) => v.type == "major" || v.type == "minor").filter((v, i, a) => a.indexOf(v) === i);
  return vs.map((v) => ({ name: v.name, area: v.area, type: v.type, item: v.item ? v.item.name : "" }));
};
async function generate(vanilla, seed, settings, options, presetName) {
  const graph = generateSeed(seed, settings, options);
  const res = await randomize_default(seed, settings, options, { vanillaBytes: vanilla, presetName }, false, graph);
  return { data: res.data, name: res.name, hash: res.hash, spoiler: { Bosses: bosses(graph), "Area Transitions": areaTransitions(graph), Items: items(graph) }, placed: placed(graph) };
}
export {
  BeamMode,
  BossMode,
  GravityHeatReduction,
  Item,
  MajorDistributionMode,
  MapLayout,
  MinorDistributionMode,
  SuitMode,
  generate,
  getAllPresets,
  getLocations,
  getPreset,
  getSeedNumber,
  getSignature,
  isHeadered,
  isVerified,
  setPatchBase
};
