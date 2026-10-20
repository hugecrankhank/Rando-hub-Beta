/*
 * entrack.js — automatic entrance tracking, from Rando Hub's emulator.
 *
 * Entrance randomizers rewrite the game's own entrance tables: which entrance
 * each overworld door (or hole) leads to, and where each exit puts Link back
 * on the overworld. So when Link goes through a door, this looks up only that
 * door's row (nothing else is read, so nothing is given away early):
 *
 *   - in: overworld → inside. The game has just loaded entrance number $010E;
 *     the door is the one in this area whose row now holds that number. Its
 *     inside is the door that number belongs to in the unshuffled game.
 *   - out: inside → overworld, through a real exit. The exit is the one for
 *     the room Link left; where it put him is the door it's tied to. (Not
 *     used in insanity, where in and out are decoupled.)
 *
 * Names are the entrance randomizer's (Kara's generator, the same as Hutch's
 * and Muffins' trackers). Both Mudoras listen: Mudora.on('entrance', fn) gets
 * { kind: 'in' | 'out', door, to: [names], hole }.
 *
 * Data: entrances.json (tools/entrances.py).
 */
(function () {
  'use strict';
  var M = window.Mudora; if (!M) return;
  var E = null;
  var here = (function () { try { return new URL('.', document.currentScript.src).href; } catch (e) { return ''; } })();
  fetch(here + 'entrances.json').then(function (r) { return r.json(); }).then(function (d) {
    E = d;
    E.slotName = {}; E.holeSlotName = {};
    Object.keys(d.doors).forEach(function (n) {
      var x = d.doors[n];
      if (x.kind === 'door') E.slotName[x.slot] = n;
      else x.slots.forEach(function (s) { E.holeSlotName[s] = n; });
    });
    M.entranceData = E;
    M.emit('entrancedata');
  }).catch(function () {});

  var WR = 0xF50000;
  function rd(b, a, n) { return b.read(a, n); }
  function w16(u, i) { return u[i] | (u[i + 1] << 8); }
  function romB(b, off) { return rd(b, off, 1)[0]; }
  function romW(b, off) { var u = rd(b, off, 2); return u[0] | (u[1] << 8); }

  // where Link was last, standing still on the overworld / inside
  var ow = null, uw = null, path = [], last = -1;
  var BAD = { 0x05: 1, 0x12: 1, 0x14: 1, 0x17: 1, 0x1B: 1, 0x00: 1, 0x01: 1, 0x02: 1, 0x03: 1, 0x04: 1 };

  function poll() {
    var b = M.bridge && M.bridge(); if (!b || !E) return;
    var m;
    try { m = rd(b, WR, 0x110); } catch (e) { return; }
    var mod = m[0x10], sub = m[0x11];
    if (mod !== last) { path.push(mod); last = mod; if (path.length > 12) path.shift(); }
    if (mod === 0x09 && sub === 0) {
      var area = w16(m, 0x8A), y = w16(m, 0x20), x = w16(m, 0x22);
      if (uw && clean()) out(b, uw, area, x, y);
      uw = null; ow = { area: area, x: x, y: y }; path = [mod];
    } else if (mod === 0x07 && sub === 0) {
      var room = w16(m, 0xA0), ent = m[0x10E];
      if (ow && clean()) into(b, ow, ent);
      ow = null; uw = { room: room }; path = [mod];
    }
  }
  function clean() { for (var i = 0; i < path.length; i++) if (BAD[path[i]]) return false; return true; }

  function nearest(list, x, y) {
    var best = null, bd = 1e9;
    list.forEach(function (c) { var d = Math.abs(c.x - x) + Math.abs(c.y - y); if (d < bd) { bd = d; best = c; } });
    return best;
  }
  // overworld → inside: which door (or hole) in this area now leads to entrance `ent`
  function into(b, from, ent) {
    var T = E.tables, cands = [];
    try {
      for (var s = 0; s < T.doorN; s++) {
        if (romB(b, T.doorId + s) !== ent || romW(b, T.doorArea + s * 2) !== from.area) continue;
        var nm = E.slotName[s]; if (nm) cands.push({ name: nm, hole: false, x: E.doors[nm].x, y: E.doors[nm].y });
      }
      for (var h = 0; h < T.holeN; h++) {
        if (romB(b, T.holeId + h) !== ent || romW(b, T.holeArea + h * 2) !== from.area) continue;
        var hn = E.holeSlotName[h]; if (hn) cands.push({ name: hn, hole: true, x: E.doors[hn].x, y: E.doors[hn].y });
      }
    } catch (e) { return; }
    if (!cands.length) return;
    var c = cands.length === 1 ? cands[0] : nearest(cands, from.x + 8, from.y + 8);
    var to = (E.byId[c.hole ? 'hole' : 'door'][String(ent)] || []).slice();
    if (!to.length) return;
    send({ kind: 'in', door: c.name, to: to, hole: c.hole });
  }
  // inside → overworld through an exit: the exit for the room Link left
  function out(b, from, area, x, y) {
    var T = E.tables, best = null;
    try {
      for (var o = 0; o < T.exitN; o++) {
        if (romW(b, T.exitRoom + o * 2) !== from.room) continue;
        if (romB(b, T.exitArea + o) !== (area & 0xFF)) continue;
        var ex = E.exits[String(o)]; if (!ex) continue;
        var lx = romW(b, T.exitX + o * 2), ly = romW(b, T.exitY + o * 2);
        if (Math.abs(lx - x) > 48 || Math.abs(ly - y) > 64) continue;
        best = { o: o, ex: ex, lx: lx, ly: ly };
      }
    } catch (e) { return; }
    if (!best || !best.ex.door) return;
    // the door this exit is tied to: the door whose landing spot it now uses
    var door = null, bd = 1e9;
    Object.keys(E.doors).forEach(function (n) {
      var d = E.doors[n]; if (!d.land || d.land[0] !== (area & 0xFF)) return;
      var dd = Math.abs(d.land[1] - best.lx) + Math.abs(d.land[2] - best.ly);
      if (dd < bd) { bd = dd; door = n; }
    });
    if (!door || bd > 96) return;
    send({ kind: 'out', door: door, to: [best.ex.door], hole: false });
  }

  var seen = {};
  function send(ev) {
    var k = ev.kind + ev.door + '>' + ev.to[0];
    if (seen[k] && Date.now() - seen[k] < 4000) return;
    seen[k] = Date.now();
    try { console.log('[mudora] entrance', ev.kind, ev.door, '→', ev.to.join(' / ')); } catch (e) {}
    M.lastEntrance = ev;
    M.emit({ entrance: ev });
  }
  M.on(function (w) { if (w === 'game') { ow = uw = null; path = []; } });
  setInterval(poll, 40);
})();
