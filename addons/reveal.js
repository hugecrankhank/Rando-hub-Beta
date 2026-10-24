/*
 * reveal.js — Crowd Control's "Reveal a go-mode item" (HydeOut's idea,
 * Oct 2026): a gift shows where one item the run still needs is.
 *
 * Read from the spoiler of the seed being played (randomizer/app.js keeps
 * it; race seeds keep theirs hidden). Both spoiler kinds the hub makes are
 * read: alttpr.com's ("Hammer:1" under "Light World" / "playthrough") and the
 * Door Randomizer's (Kara: "Hammer", "Moon Pearl"). Names are compared
 * without spaces or punctuation.
 *
 * "Go-mode worthy": a major item (below) that's in the spoiler's playthrough,
 * the items the seed needs to be beaten. Without a playthrough, any major
 * item. Items Link already has are skipped, and each item spot is revealed
 * only once per seed.
 *
 *   RandoReveal.parse(spoiler) → { list: [{ loc, region, item, key, name, icon, nth, req }], playthrough }
 *   RandoReveal.pick(parsed, ram, seedName) → one entry, or null; remembers it
 */
(function (root) {
  'use strict';
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var clean = function (s) { return String(s || '').replace(/:\d+$/, '').replace(/\s*\(Player \d+\)$/i, '').trim(); };

  // normalized item name → [group, display name, Mudora icon]
  var MAJOR = {
    hammer: ['hammer', 'Hammer', 'hammer'], hookshot: ['hookshot', 'Hookshot', 'hookshot'],
    firerod: ['firerod', 'Fire Rod', 'firerod'], icerod: ['icerod', 'Ice Rod', 'icerod'],
    bombos: ['bombos', 'Bombos', 'bombos'], ether: ['ether', 'Ether', 'ether'], quake: ['quake', 'Quake', 'quake'],
    lamp: ['lamp', 'Lamp', 'lamp'], bookofmudora: ['book', 'Book of Mudora', 'book'],
    caneofsomaria: ['somaria', 'Cane of Somaria', 'somaria'], caneofbyrna: ['byrna', 'Cane of Byrna', 'byrna'],
    cape: ['cape', 'Magic Cape', 'cape'], magicmirror: ['mirror', 'Magic Mirror', 'mirror'],
    pegasusboots: ['boots', 'Pegasus Boots', 'boots'], flippers: ['flippers', 'Flippers', 'flippers'],
    moonpearl: ['moonpearl', 'Moon Pearl', 'moonpearl'],
    progressiveglove: ['gloves', 'Power Glove', 'gloves1'], powerglove: ['gloves', 'Power Glove', 'gloves1'],
    titansmitt: ['gloves', "Titan's Mitt", 'gloves2'],
    progressivesword: ['sword', 'Sword', 'sword1'], fightersword: ['sword', 'Fighter Sword', 'sword1'],
    mastersword: ['sword', 'Master Sword', 'sword2'], temperedsword: ['sword', 'Tempered Sword', 'sword3'],
    goldensword: ['sword', 'Golden Sword', 'sword4'], unclesword: ['sword', 'Sword', 'sword1'],
    progressivebow: ['bow', 'Bow', 'bow2'], bow: ['bow', 'Bow', 'bow2'], bowandarrows: ['bow', 'Bow', 'bow2'],
    silverarrowupgrade: ['silvers', 'Silver Arrows', 'bow3'], silverarrows: ['silvers', 'Silver Arrows', 'bow3'],
    bowandsilverarrows: ['silvers', 'Silver Arrows', 'bow3'],
    ocarina: ['flute', 'Flute', 'flute'], ocarinainactive: ['flute', 'Flute', 'flute'], ocarinaactive: ['flute', 'Flute', 'flute'],
    flute: ['flute', 'Flute', 'flute'], activatedflute: ['flute', 'Flute', 'flute'],
  };
  // sections that aren't item spots
  var SKIP = { meta: 1, bosses: 1, shops: 1, special: 1, equipped: 1, entrances: 1, paths: 1, hashcode: 1, settings: 1, startinventory: 1,
    doors: 1, lobbies: 1, prizes: 1, medallions: 1, overworld: 1, maps: 1, versions: 1, required: 1 };

  // walk the spoiler: every "spot": "item" pair, with the region it's under
  function walk(o, region, out, depth) {
    if (!o || typeof o !== 'object' || depth > 5) return;
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (typeof v === 'string') {
        var m = MAJOR[norm(clean(v))];
        if (m) out.push({ loc: clean(k), region: region || '', item: clean(v), key: m[0], name: m[1], icon: m[2] });
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (SKIP[norm(k)]) return;
        walk(v, /^\d+$/.test(k) ? region : k, out, depth + 1);
      }
    });
  }
  function parse(sp) {
    if (!sp || typeof sp !== 'object') return { list: [], playthrough: false };
    var all = [], pt = [], ptKey = Object.keys(sp).filter(function (k) { return norm(k) === 'playthrough'; })[0];
    var rest = {}; Object.keys(sp).forEach(function (k) { if (k !== ptKey) rest[k] = sp[k]; });
    walk(rest, '', all, 0);
    if (ptKey) walk(sp[ptKey], '', pt, 0);
    // the same spot can be listed under several regions in some spoilers: once each
    var seen = {}, list = [];
    all.forEach(function (e) { var id = norm(e.loc); if (!seen[id]) { seen[id] = 1; list.push(e); } });
    var req = {};
    pt.forEach(function (e) { req[norm(e.loc)] = 1; });
    // copies of a progressive item, in playthrough order: the nth one needs level n
    var count = {};
    var ordered = pt.length ? pt.map(function (e) { return list.filter(function (x) { return norm(x.loc) === norm(e.loc); })[0] || e; }) : list;
    ordered.forEach(function (e) { count[e.key] = (count[e.key] || 0) + 1; e.nth = count[e.key]; });
    list.forEach(function (e) {
      e.req = !!req[norm(e.loc)]; if (!e.nth) e.nth = 1;
      // a progressive item's nth copy is that level: the 2nd glove is the Mitt
      if (/^progressive/.test(norm(e.item))) {
        if (e.key === 'gloves' && e.nth >= 2) { e.name = "Titan's Mitt"; e.icon = 'gloves2'; }
        if (e.key === 'sword') { var n = Math.min(4, e.nth); e.name = ['Fighter', 'Master', 'Tempered', 'Golden'][n - 1] + ' Sword'; e.icon = 'sword' + n; }
        if (e.key === 'bow' && e.nth >= 2) { e.name = 'Silver Arrows'; e.icon = 'bow3'; e.key = 'silvers'; }
      }
    });
    return { list: list, playthrough: pt.length > 0 };
  }

  // does Link have it already? ($7EF3xx = WRAM $F3xx)
  function owned(r, e) {
    if (!r || r.length < 0x10000) return false;
    var at = function (a) { return r[0xF000 + a]; };
    switch (e.key) {
      case 'hammer': return at(0x34B) > 0; case 'hookshot': return at(0x342) > 0;
      case 'firerod': return at(0x345) > 0; case 'icerod': return at(0x346) > 0;
      case 'bombos': return at(0x347) > 0; case 'ether': return at(0x348) > 0; case 'quake': return at(0x349) > 0;
      case 'lamp': return at(0x34A) > 0; case 'book': return at(0x34E) > 0;
      case 'somaria': return at(0x350) > 0; case 'byrna': return at(0x351) > 0; case 'cape': return at(0x352) > 0;
      case 'mirror': return at(0x353) >= 2; case 'boots': return at(0x355) > 0;
      case 'flippers': return at(0x356) > 0; case 'moonpearl': return at(0x357) > 0;
      case 'gloves': return at(0x354) >= (e.icon === 'gloves2' ? 2 : e.nth);
      case 'sword': { var s = at(0x359); return s !== 0xFF && s >= Math.max(e.nth, { sword2: 2, sword3: 3, sword4: 4 }[e.icon] || 1); }
      case 'bow': return at(0x340) >= 1;
      case 'silvers': return at(0x340) >= 3;
      case 'flute': return at(0x34C) >= 2;
    }
    return false;
  }

  var KEY = 'rhb-reveals:';
  function done(seed) { try { return JSON.parse(localStorage.getItem(KEY + seed) || '[]'); } catch (e) { return []; } }
  function pick(parsed, r, seed) {
    var shown = done(seed);
    var open = parsed.list.filter(function (e) { return shown.indexOf(norm(e.loc)) < 0 && !owned(r, e); });
    var need = open.filter(function (e) { return e.req; });
    var pool = parsed.playthrough ? need : open;
    if (!pool.length) return null;
    var e = pool[Math.floor(Math.random() * pool.length)];
    shown.push(norm(e.loc));
    try { localStorage.setItem(KEY + seed, JSON.stringify(shown.slice(-200))); } catch (x) {}
    return e;
  }

  root.RandoReveal = { parse: parse, pick: pick, owned: owned, norm: norm };
})(typeof window !== 'undefined' ? window : globalThis);
