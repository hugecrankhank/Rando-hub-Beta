/*
 * map.js — the Final Fantasy VI world maps (World of Balance, World of Ruin)
 * drawn from the player's own ROM, a pin on every check, and the party on it.
 * The viewer itself is the hub's ../world-map.js.
 *
 * The pictures are read from the ROM the way the game draws them: each
 * world's 256 x 256 tile layout (LZSS-packed at $EE/D434 and $EF/6A56), its
 * tileset, 8x8 graphics and palette assignment (one packed block at $EF/114F
 * and $EF/4A46: 1 KB tileset, 8 KB 4bpp graphics, 128 bytes of palette
 * numbers) and its 128-colour palette ($D2/EC00, $D2/ED00). Nothing of it is
 * shipped. Drawn at half size (2048 x 2048, a map square = 8 px) so phones
 * can hold it.
 *
 * The party: $7E:1F64 is the map (0 / 1 the worlds; $1F69 the parent map
 * inside a town or cave), $7E:1F60 / 1F61 the party's world-map square (kept
 * while inside, so the dot stays, dimmed, where they went in). The pins' squares come from the world maps' entrance
 * triggers ($DF/BB00); a few places with no fixed entrance (the Veldt,
 * Vector, Kefka's Tower, Zone Eater) are placed by hand.
 */
(function () {
  'use strict';
  const D = window.FF6;
  const WORLDS = [
    { name: 'World of Balance', layout: 0x2ED434, gfx: 0x2F114F, pal: 0x12EC00 },
    { name: 'World of Ruin', layout: 0x2F6A56, gfx: 0x2F4A46, pal: 0x12ED00 },
  ];
  const CELL = 8, SIZE = 256 * CELL;   // half the game's 16 px per square

  // where each check is: [world, map x, map y]; a check may be in both worlds
  const WOB = 0, WOR = 1;
  const PLACES = {
    'Narshe': [[WOB, 84, 33], [WOR, 115, 33]], 'Figaro Castle': [[WOB, 73, 93], [WOR, 106, 98]], 'South Figaro Cave': [[WOB, 90, 99], [WOR, 110, 97]],
    'South Figaro': [[WOB, 86, 112], [WOR, 113, 95]], 'Mt. Kolts': [[WOB, 102, 100]], 'Lete River': [[WOB, 104, 64]],
    'Imperial Camp': [[WOB, 178, 82]], 'Doma': [[WOB, 156, 84], [WOR, 171, 75]], 'Doma (WoR)': [[WOR, 171, 75]], 'Phantom Forest': [[WOB, 177, 92]], 'Baren Falls': [[WOB, 179, 97]],
    'Veldt': [[WOB, 205, 118], [WOR, 215, 115]], 'Veldt Cave': [[WOR, 207, 89]], 'Serpent Trench': [[WOB, 214, 148]], "Gau's Father's House": [[WOR, 178, 45]], 'Mobliz (WoR)': [[WOR, 237, 135]],
    'Zozo': [[WOB, 22, 92], [WOR, 43, 130]], 'Mt. Zozo': [[WOR, 43, 130]], 'Opera House': [[WOB, 45, 154], [WOR, 31, 183]], 'Jidoor': [[WOB, 27, 130], [WOR, 34, 156]], 'Jidoor (WoR)': [[WOR, 34, 156]],
    'Vector': [[WOB, 150, 180]], 'Sealed Gate': [[WOB, 169, 194]], 'Tzen': [[WOB, 119, 149], [WOR, 130, 179]], 'Tzen (WoR)': [[WOR, 130, 179]],
    'Esper Mountain': [[WOB, 241, 118]], 'Thamasa': [[WOB, 229, 130], [WOR, 251, 230]], "Ebot's Rock": [[WOR, 249, 223]], 'Floating Continent': [[WOB, 236, 45]],
    "Fanatic's Tower": [[WOR, 76, 240]], 'Kohlingen': [[WOB, 26, 39], [WOR, 38, 45]], "Daryl's Tomb": [[WOR, 25, 52]], 'Phoenix Cave': [[WOR, 160, 126]],
    'Ancient Castle': [[WOR, 106, 98]], "Umaro's Cave": [[WOR, 115, 33]], 'Zone Eater': [[WOR, 236, 48]], "Kefka's Tower": [[WOR, 137, 197]],
  };
  const WHERE = {
    'Whelk Gate': 'Narshe', 'Narshe Battle': 'Narshe', 'Narshe Moogle Defense': 'Narshe', 'Narshe Dragon': 'Narshe', 'Narshe Weapon Shop': 'Narshe', 'Narshe Weapon Shop Mines': 'Narshe', 'Tritoch Cliff': 'Narshe', 'Lone Wolf Chase': 'Narshe', 'Lone Wolf Moogle Room': 'Narshe',
    'Figaro Castle Throne': 'Figaro Castle', 'Figaro Castle Engine': 'Figaro Castle', 'South Figaro Cave': 'South Figaro Cave', 'South Figaro Prisoner': 'South Figaro', 'Mt. Kolts': 'Mt. Kolts', 'Lete River': 'Lete River',
    'Imperial Camp': 'Imperial Camp', 'Doma Siege': 'Doma', 'Doma Dream Door': 'Doma (WoR)', 'Doma Dream Awaken': 'Doma (WoR)', 'Doma Dream Throne': 'Doma (WoR)', 'Phantom Train': 'Phantom Forest', 'Baren Falls': 'Baren Falls',
    'Veldt': 'Veldt', 'Veldt Cave': 'Veldt Cave', 'Serpent Trench': 'Serpent Trench', "Gau's Father's House": "Gau's Father's House", 'Mobliz Attack': 'Mobliz (WoR)',
    'Zozo Tower': 'Zozo', 'Mt. Zozo': 'Mt. Zozo', 'Mt. Zozo Dragon': 'Mt. Zozo', 'Opera House Disruption': 'Opera House', 'Opera House Dragon': 'Opera House', "Owzer's Mansion": 'Jidoor (WoR)', 'Auction 1': 'Jidoor', 'Auction 2': 'Jidoor',
    'Magitek Factory Trash': 'Vector', 'Magitek Factory Guard': 'Vector', 'Magitek Factory Finish': 'Vector', 'Sealed Gate': 'Sealed Gate', 'Tzen Thief': 'Tzen', 'Collapsing House': 'Tzen (WoR)',
    'Esper Mountain': 'Esper Mountain', 'Burning House': 'Thamasa', "Ebot's Rock": "Ebot's Rock", 'Floating Cont. Arrive': 'Floating Continent', 'Floating Cont. Beast': 'Floating Continent', 'Floating Cont. Escape': 'Floating Continent',
    "Fanatic's Tower Follower": "Fanatic's Tower", "Fanatic's Tower Leader": "Fanatic's Tower", "Fanatic's Tower Dragon": "Fanatic's Tower",
    'Kohlingen Cafe': 'Kohlingen', "Daryl's Tomb": "Daryl's Tomb", 'Phoenix Cave': 'Phoenix Cave', 'Phoenix Cave Dragon': 'Phoenix Cave', 'Ancient Castle': 'Ancient Castle', 'Ancient Castle Dragon': 'Ancient Castle', "Umaro's Cave": "Umaro's Cave", 'Zone Eater': 'Zone Eater',
    "Kefka's Tower Cell Beast": "Kefka's Tower", "Kefka's Tower Dragon G": "Kefka's Tower", "Kefka's Tower Dragon S": "Kefka's Tower",
  };
  const PINS = [];
  D.CHECKS.forEach((c, i) => {
    const p = PLACES[WHERE[c[0]]]; if (!p) return;   // Search The Skies: the airship, nowhere to pin
    p.forEach((q) => PINS.push({ world: q[0], x: (q[1] + 0.5) * CELL, y: (q[2] + 0.5) * CELL, i, boss: /Dragon/.test(c[0]) }));
  });

  // ── the ROM ──────────────────────────────────────────────────────────────
  let romFn = null, base = null, baseAsked = 0;
  function rom() {
    let r = null;
    try { r = romFn && romFn(); } catch (e) {}
    if (r && r.length >= 0x300000) return r;
    if (base) return base;
    if (window.FF6Store && Date.now() - baseAsked > 5000) {
      baseAsked = Date.now();
      FF6Store.get('base').then((b) => { if (b && b.bytes && b.bytes.byteLength >= 0x300000) { base = new Uint8Array(b.bytes); if (viewer) viewer.invalidate(); } });
    }
    return null;
  }
  // FF6's LZSS: a 2-byte length, then runs of 8 flagged items (1 = a byte, 0 = a 2-byte back reference into a 2 KB ring)
  function lzss(src, at) {
    const length = src[at] | src[at + 1] << 8; let s = at + 2; const end = at + length;
    const dest = new Uint8Array(0x10000); let d = 0; const buf = new Uint8Array(0x800); let b = 0x7DE;
    while (s < end) {
      let h = src[s++];
      for (let p = 0; p < 8 && s < end; p++, h >>= 1) {
        if (h & 1) { const c = src[s++]; dest[d++] = c; buf[b++] = c; b &= 0x7FF; }
        else {
          let w = src[s++] | src[s++] << 8; const r = (w >> 11) + 3; w &= 0x7FF;
          for (let i = 0; i < r; i++) { const c = buf[(w + i) & 0x7FF]; if (d < dest.length) dest[d++] = c; buf[b++] = c; b &= 0x7FF; }
        }
      }
    }
    return dest.subarray(0, d);
  }
  // the tileset block is stored 2-byte-interlaced in groups of 64 bytes
  function interlace(data) {
    const out = new Uint8Array(data.length); let d = 0;
    for (let s = 0; s < data.length; s += 64) for (let s1 = s; s1 < s + 4; s1 += 2) for (let s2 = s1; s2 < s + 64; s2 += 4) { out[d++] = data[s2]; out[d++] = data[s2 + 1]; }
    return out;
  }
  function picture(wi) {
    const r = rom(); if (!r) return null;
    const W = WORLDS[wi];
    const layout = lzss(r, W.layout), g = lzss(r, W.gfx);
    if (layout.length < 65536 || g.length < 0x2480) return null;
    const ts = interlace(g.subarray(0, 0x400)), gfx = g.subarray(0x400, 0x2400), pa = g.subarray(0x2400, 0x2480);
    const pal = new Uint32Array(128);
    for (let i = 0; i < 128; i++) { const v = r[W.pal + i * 2] | r[W.pal + i * 2 + 1] << 8; pal[i] = 0xFF000000 | (((v >> 10) & 31) * 255 / 31 | 0) << 16 | (((v >> 5) & 31) * 255 / 31 | 0) << 8 | ((v & 31) * 255 / 31 | 0); }
    const palOf = new Uint8Array(256); for (let i = 0; i < 256; i++) palOf[i] = (pa[i >> 1] >> (i & 1 ? 4 : 0)) & 15;
    // half size: a 16 x 16 square becomes 8 x 8, each 8 x 8 graphics tile 4 x 4 (every other pixel)
    const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
    const g2 = cv.getContext('2d'), img = g2.createImageData(SIZE, SIZE), px = new Uint32Array(img.data.buffer);
    for (let ty = 0; ty < 256; ty++) for (let tx = 0; tx < 256; tx++) {
      const t = layout[ty * 256 + tx], b = ((t & 0xF0) << 2) | ((t & 0x0F) << 1);
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const st = ts[b + sy * 32 + sx], p = palOf[st] * 16, o = st * 32, ox = tx * 8 + sx * 4, oy = ty * 8 + sy * 4;
        for (let y = 0; y < 4; y++) { const row = (oy + y) * SIZE + ox, src = o + y * 2 * 4;   // rows 0,2,4,6 of the tile
          for (let x = 0; x < 4; x++) px[row + x] = pal[p + (gfx[src + x] & 15)]; }   // the low nibble: pixels 0,2,4,6
      }
    }
    g2.putImageData(img, 0, 0);
    return cv;
  }

  // ── the party ────────────────────────────────────────────────────────────
  let viewer = null, lastPos = null;
  function setParty(r) {
    if (!viewer) return;
    if (!r) { viewer.setPos(null); return; }
    const map = (r[0x1F64] | r[0x1F65] << 8) & 0x1FF;
    let p = null;
    if (map <= 1) p = { world: map, x: (r[0x1F60] + 0.5) * CELL, y: (r[0x1F61] + 0.5) * CELL };
    else { const pm = (r[0x1F69] | r[0x1F6A] << 8) & 0x1FF; if (pm <= 1) p = { world: pm, x: (r[0x1F60] + 0.5) * CELL, y: (r[0x1F61] + 0.5) * CELL, dim: true }; }   // in a town: the world square it was entered from
    if (!p && lastPos) p = Object.assign({}, lastPos, { dim: true });
    if (p && !p.dim) lastPos = p;
    viewer.setPos(p);
  }

  window.FF6Map = {
    set rom(fn) { romFn = fn; },
    init(host, opts) {
      viewer = RHWorldMap.create(host, { key: 'ff6wc', worlds: WORLDS.map((w, i) => ({ name: w.name, width: SIZE, height: SIZE, picture: () => picture(i) })), pins: PINS,
        name: (i) => D.CHECKS[i][0], onToggle: opts && opts.onToggle });
      return viewer;
    },
    update(s) { if (viewer) viewer.update(s); },
    setParty,
    redraw() { if (viewer) viewer.redraw(); },
    invalidate() { if (viewer) viewer.invalidate(); },
  };
})();
