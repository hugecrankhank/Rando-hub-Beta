/*
 * Rando Hub — item sounds and small keys for EVERY tracker.
 *
 * Reads the game straight from the built-in emulator (the same RAM every
 * tracker reads), so it doesn't matter which tracker is showing:
 *
 *  - Item sound packs (addons/sound-packs.js): a sound from the live pack on
 *    every new item. Hutch's broadcast view stops playing pack sounds itself
 *    while this page is open, so nothing plays twice.
 *  - Small keys: keys in hand and keys found for each dungeon, published for
 *    the trackers (addons/keys-client.js reads them in Mudora, Mudora 2.0 and
 *    EmoTracker; Hutch's tracker has its own reader, addons/key-display.js).
 *
 * Header controls (next to "Tracker dungeon items"): Item sounds (which pack)
 * and Tracker keys (Found / In hand / Both). Both settings are shared with
 * Hutch's tracker through localStorage.
 */
(function () {
  'use strict';
  var KEY_MODE = 'rando-hub-key-display';
  var MODES = { found: 'Found  1/6', held: 'In hand  0/6', both: 'Both  1(0)/6' };
  var SP = function () { return window.RandoSoundPacks; };

  // ── ALTTP save RAM, as offsets into the emulator's 128 KB WRAM ($7E0000) ──
  var INV = 0xF340;
  function inv(r, a) { return r[INV + a]; }
  function bits(n) { var c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
  // What each item is worth now (a level, or a count of bits for the dungeon
  // items). The keys are the sound-pack folders; mapping as Hutch's items.js.
  function levels(r) {
    var x = inv(r, 0x4C);                      // $7EF38C: randomizer's boomerang / mushroom / powder / flute / shovel flags
    var bow = inv(r, 0x00);
    var sword = inv(r, 0x19);
    return {
      bow: bow === 0 ? 0 : bow === 1 ? 1 : bow === 2 ? 2 : 3,
      boomerang: bits(x & 0xC0),
      hookshot: inv(r, 0x02) ? 1 : 0,
      mushroom: (x & 0x20) ? 1 : 0, powder: (x & 0x10) ? 1 : 0,
      flute: (x & 0x03) ? 1 : 0, shovel: (x & 0x04) ? 1 : 0,
      firerod: inv(r, 0x05) ? 1 : 0, icerod: inv(r, 0x06) ? 1 : 0,
      bombos: inv(r, 0x07) ? 1 : 0, ether: inv(r, 0x08) ? 1 : 0, quake: inv(r, 0x09) ? 1 : 0,
      lamp: inv(r, 0x0A) ? 1 : 0, hammer: inv(r, 0x0B) ? 1 : 0, net: inv(r, 0x0D) ? 1 : 0, book: inv(r, 0x0E) ? 1 : 0,
      bottle1: [0x1C, 0x1D, 0x1E, 0x1F].filter(function (o) { return inv(r, o); }).length,
      somaria: inv(r, 0x10) ? 1 : 0, byrna: inv(r, 0x11) ? 1 : 0, cape: inv(r, 0x12) ? 1 : 0,
      mirror: (inv(r, 0x13) & 0x02) ? 1 : 0,
      gloves: Math.min(2, inv(r, 0x14)), boots: inv(r, 0x15) ? 1 : 0, flippers: inv(r, 0x16) ? 1 : 0,
      moonpearl: inv(r, 0x17) ? 1 : 0,
      sword: sword === 0xFF ? 0 : Math.min(4, sword), shield: Math.min(3, inv(r, 0x1A)), tunic: Math.min(2, inv(r, 0x1B)),
      halfmagic: inv(r, 0x3B) ? 1 : 0,
      agahnim: inv(r, 0x85) >= 3 ? 1 : 0,           // $7EF3C5 game progress
      bigkey: bits(inv(r, 0x26)) + bits(inv(r, 0x27)),
      compass: bits(inv(r, 0x24)) + bits(inv(r, 0x25)),
      map: bits(inv(r, 0x28)) + bits(inv(r, 0x29)),
      smallkey: (function () { var n = 0; for (var i = 0; i < 14; i++) n += r[0xF4E0 + i]; return n; })(),
    };
  }
  // Items whose level picks a level folder (sword-2 = Master Sword...)
  var LEVELLED = { bow: 1, sword: 1, gloves: 1, shield: 1, tunic: 1 };

  // ── small keys, per dungeon ───────────────────────────────────────────────
  // index in the game's dungeon order: $7EF37C + i = keys in hand (for the
  // dungeons Link isn't in), $7EF4E0 + i = keys found (only ever rises);
  // $7EF36F = keys in hand in the dungeon he's in ($040C = its id x2).
  var DG = { hc: 0, ep: 2, dp: 3, ct: 4, sp: 5, pod: 6, mm: 7, sw: 8, ip: 9, toh: 10, tt: 11, tr: 12, gt: 13 };
  function readKeys(r) {
    var here = r[0x040C], cur = r[0xF36F], held = {}, found = {};
    Object.keys(DG).forEach(function (k) {
      var i = DG[k];
      var h = r[0xF37C + i], f = r[0xF4E0 + i];
      if (k === 'hc') { h = Math.max(h, r[0xF37D]); f = Math.max(f, r[0xF4E1]); }
      if (here !== 0xFF && (here >> 1) === i && cur !== 0xFF) h = cur;
      if (k === 'hc' && here !== 0xFF && (here >> 1) === 1 && cur !== 0xFF) h = cur;   // Hyrule Castle proper
      held[k] = h === 0xFF ? 0 : h; found[k] = f === 0xFF ? 0 : f;
    });
    held.at = held.ct; found.at = found.ct;     // EmoTracker calls Agahnim's Tower "at"
    return { held: held, found: found };
  }

  // ── run counters, for trackers without their own (Mudora 2.0) ───────────
  // z3randomizer's counters: total checks $7EF423 (2 bytes), deaths $7EF449,
  // bonks $7EF420. GT big key game: Ganon's Tower chests opened (room flags,
  // the same table as crowd/effects.js) and how many were open when the big
  // key ($7EF366 bit 0x04) turned up, if it came from a GT chest.
  var GT_CHESTS = [[0x119, 0x04], [0x118, 0x20], [0x118, 0x40], [0x11a, 0x10], [0x13a, 0x10], [0x13a, 0x20], [0x13a, 0x40], [0x13a, 0x80],
    [0x0f6, 0x10], [0x0f6, 0x20], [0x0f6, 0x40], [0x0f6, 0x80], [0x116, 0x10], [0x0fa, 0x10], [0x0f8, 0x10], [0x0f8, 0x20],
    [0x0f8, 0x40], [0x0f8, 0x80], [0x118, 0x80], [0x038, 0x20], [0x038, 0x40], [0x038, 0x10]];
  var gt = { armed: false, at: null }, stats = null;
  // the digging game (Dark World, south of the Village of Outcasts, screen $68): digs this visit
  // ($7FFE01), its prize taken ($7EF2E8 bit $40), and which dig it came on (the seed's dig, ROM
  // $180020, or the count when it was picked up), as crowd/effects.js reads them
  var dig = { digs: 0, armed: false, at: null };
  function digRng() {
    var P = window.Snes9xPlayer, core = P && P.core, rom = null;
    try { rom = core && core.rom(); } catch (e) {}
    var v = rom && rom.length > 0x180020 ? rom[0x180020] : 0;
    return v >= 1 && v <= 30 ? v : 0;
  }
  function readStats(r) {
    var opened = 0;
    GT_CHESTS.forEach(function (c) { if (r[0xF000 + c[0]] & c[1]) opened++; });
    var found = !!(r[0xF366] & 0x04);
    if (!found) gt = { armed: true, at: null };
    else if (gt.armed && gt.at === null) { gt.at = r[0x040C] === 0x1A ? opened : '?'; gt.armed = false; }
    var digHere = r[0x10] === 0x09 && !r[0x1B] && r[0x8A] === 0x68, digFound = !!(r[0xF2E8] & 0x40);
    if (digHere && r[0x1FE01] <= 60) dig.digs = r[0x1FE01];
    if (!digFound) { dig.armed = true; dig.at = null; }
    else if (dig.armed && dig.at === null) { var rr = digRng(); dig.at = rr && dig.digs >= rr ? rr : (dig.digs || '?'); dig.armed = false; }
    var checks = r[0xF423] | (r[0xF424] << 8);
    var prev = stats || {};
    stats = {
      checks: checks < 2000 ? Math.max(checks, prev.checks || 0) : (prev.checks || 0),
      deaths: Math.max(r[0xF449], prev.deaths || 0),
      bonks: Math.max(r[0xF420], prev.bonks || 0),
      gt: { chests: opened, total: GT_CHESTS.length, found: found, at: found ? gt.at : null },
      dig: { digs: dig.digs, total: 30, found: digFound, at: digFound ? dig.at : null },
    };
  }

  // ── watching the game ─────────────────────────────────────────────────────
  var best = null, gameKey = '', keys = { held: {}, found: {} }, keysSent = '';
  var bc = null;
  try { bc = new BroadcastChannel('rando-hub-keys'); } catch (e) {}
  function mode() { try { var m = localStorage.getItem(KEY_MODE); return MODES[m] ? m : 'found'; } catch (e) { return 'found'; } }
  function publish(force) {
    var msg = { type: 'keys', held: keys.held, found: keys.found, mode: mode(), live: !!best, stats: stats };
    var j = JSON.stringify(msg);
    if (!force && j === keysSent) return;
    keysSent = j;
    window.RandoKeys = msg;
    try { bc && bc.postMessage(msg); } catch (e) {}
  }
  if (bc) bc.onmessage = function (e) { if (e.data && e.data.type === 'ask') publish(true); };

  function playable(r) {
    var m = r[0x10];
    return (m === 0x07 || m === 0x09 || m === 0x0B) && r[0xF36C] >= 8;      // in a dungeon or overworld, hearts loaded
  }
  function tick() {
    var P = window.Snes9xPlayer, core = P && P.core;
    if (!core) { if (best) { best = null; publish(); } return; }
    var r = core.wram();
    if (!r || r.length < 0x20000) return;
    var name = P.gameName || '';
    if (name !== gameKey) { gameKey = name; best = null; stats = null; gt = { armed: false, at: null }; dig = { digs: 0, armed: false, at: null }; }   // a new seed: start from what it has
    if (!playable(r)) return;
    var any = false;
    for (var i = 0; i < 0x40 && !any; i++) if (r[INV + i]) any = true;
    if (!any) return;                                         // a blank block (save & quit): not a reading

    var now = levels(r);
    if (!best) best = now;                                    // first reading: what's already there makes no sound
    else {
      var played = false;
      Object.keys(now).forEach(function (k) {
        if (now[k] > (best[k] || 0)) {
          if (!played && SP() && SP().getActive()) {
            // one sound per poll: two items in a quarter second is a seed starting, not a pickup
            played = SP().play(k, LEVELLED[k] ? now[k] : undefined);
          }
          best[k] = now[k];
        }
      });
    }
    keys = readKeys(r);
    readStats(r);
    publish();
  }
  setInterval(tick, 250);
  // for the console: RandoHubItems.best (what's been seen), RandoHubItems.now()
  window.RandoHubItems = {
    get best() { return best; },
    now: function () { var P = window.Snes9xPlayer, c = P && P.core; return c ? levels(c.wram()) : null; },
  };

  // Hutch's broadcast view checks this before playing a pack sound itself.
  var alive = null;
  try { alive = new BroadcastChannel('rando-hub-sound-packs-hub'); } catch (e) {}
  setInterval(function () { try { alive && alive.postMessage({ type: 'alive', at: Date.now() }); } catch (e) {} }, 1000);

  // ── header controls ───────────────────────────────────────────────────────
  function addControls() {
    var di = document.getElementById('dungeonitems');
    var anchor = di && di.closest ? di.closest('label') : null;
    if (!anchor || document.getElementById('key-display')) return;

    var kl = document.createElement('label');
    kl.className = 'ctl tracker-ctl';
    kl.title = 'Small keys on the tracker: Found = collected in total, In hand = not used on a door yet, Both = found(in hand)/total. Works on every tracker except Muffins’ own.';
    kl.appendChild(document.createTextNode('Tracker keys'));
    var ks = document.createElement('select'); ks.id = 'key-display';
    Object.keys(MODES).forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = MODES[m]; ks.appendChild(o); });
    ks.value = mode();
    ks.onchange = function () { try { localStorage.setItem(KEY_MODE, ks.value); } catch (e) {} publish(true); };
    kl.appendChild(ks);

    var sl = document.createElement('label');
    sl.className = 'ctl tracker-ctl';
    sl.title = 'Item sound pack: a sound on every new item, on any tracker. A pack is a folder with one folder per item; Import folder… adds one from this computer.';
    sl.appendChild(document.createTextNode('Item sounds'));
    var ss = document.createElement('select'); ss.id = 'sound-pack-sel';
    var picker = document.createElement('input');
    picker.type = 'file'; picker.multiple = true; picker.hidden = true;
    picker.setAttribute('webkitdirectory', ''); picker.setAttribute('directory', '');
    function fill() {
      if (!SP()) return;
      var active = SP().getActive();
      ss.innerHTML = '';
      SP().choices().forEach(function (id) {
        var o = document.createElement('option'); o.value = id;
        o.textContent = id ? SP().activeName(id) : 'Off';
        ss.appendChild(o);
      });
      var imp = document.createElement('option'); imp.value = '*import*'; imp.textContent = 'Import folder…'; ss.appendChild(imp);
      ss.value = SP().choices().indexOf(active) >= 0 ? active : '';
    }
    ss.onchange = function () {
      if (ss.value === '*import*') { fill(); picker.value = ''; picker.click(); return; }
      SP().setActive(ss.value);
    };
    picker.onchange = function () {
      SP().importFiles(picker.files).then(function (r) {
        if (r.packs.length) SP().setActive(r.packs[r.packs.length - 1].id);
        var msg = 'Added ' + r.packs.map(function (p) { return p.name + ' (' + p.sounds + ' sounds)'; }).join(', ') +
          (r.skipped.length ? '. Skipped folders not named after an item: ' + r.skipped.slice(0, 5).join(', ') : '');
        if (window.Snes9xPlayer && window.Snes9xPlayer.toast) window.Snes9xPlayer.toast(msg); else alert(msg);
      }).catch(function (e) { alert(e.message || String(e)); });
    };
    sl.appendChild(ss); sl.appendChild(picker);

    anchor.parentNode.insertBefore(kl, anchor.nextSibling);
    anchor.parentNode.insertBefore(sl, kl.nextSibling);
    if (SP()) { SP().onChange(fill); SP().ready().then(fill); }
    fill();
    window.addEventListener('storage', function (e) { if (e.key === KEY_MODE) { ks.value = mode(); publish(true); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addControls);
  else addControls();
})();
