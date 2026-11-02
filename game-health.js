/*
 * game-health.js — is the game still running? For the autosave, on every game
 * page (Nov 2026, after Heffie's Super Metroid crash: the music kept playing,
 * the picture froze, and the 20-second autosave kept the crash, so every
 * reload came back frozen).
 *
 * A crashed game must never become the autosave. Each second this looks at
 * the game's memory: a game's own main-loop frame counter where one is known
 * (Super Metroid $7E:05B6, Zelda 3 $7E:001A: they stop when the game crashes
 * even if the sound keeps going), otherwise the whole work RAM (a running game
 * always changes some of it every frame; a jammed one changes none). Paused
 * (by the player or the menu) or hidden doesn't count as frozen.
 *
 *   const h = RHHealth.create({ counter: (ram) => number, onFrozen() {} })
 *   h.alive()                 safe to snapshot now
 *   h.runs(ms) → Promise<bool> does the game move in the next ms (after loading a snapshot)
 *   RHHealth.push(stored, snap)  → the last three good snapshots, newest first, spread out
 *   RHHealth.norm(stored)        → that list (also from the old one-snapshot format)
 *   RHHealth.restore({ list, health, load(state), keep(rest), reset(), toast(text, ms), done() })
 *       tries the newest snapshot; if it doesn't run, the one before; if none
 *       runs, resets the game (in-game saves are kept) and says so.
 *
 * EVERY GAME PAGE, NOW AND FUTURE: autosave through this (see sm/js/app.js),
 * and give it the game's main-loop counter when one is known.
 */
(function () {
  'use strict';
  if (window.RHHealth) return;
  function player() {
    var p = window.Snes9xPlayer && window.Snes9xPlayer.core ? window.Snes9xPlayer : window.EmuPlayer;
    return p && p.core ? p : null;
  }
  function ram() { var p = player(); try { return p && p.core.wram ? p.core.wram() : null; } catch (e) { return null; } }
  function hash(r) { var h = 0x811c9dc5; for (var i = 0; i < r.length; i++) { h ^= r[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
  function paused() {
    var p = player(), e = window.EJS_emulator;
    if (p && p.paused) return true;
    if (e && e.paused) return true;
    var m = document.querySelector('.s9x-menu');
    return !!(m && !m.hidden);
  }

  function create(o) {
    o = o || {};
    var last = null, frozen = 0, seen = false, warned = false;
    function sig() {
      var r = (o.ram || ram)(); if (!r || !r.length) return null;
      try { return o.counter ? o.counter(r) : hash(r); } catch (e) { return null; }
    }
    setInterval(function () {
      if (document.hidden || paused()) return;
      var s = sig(); if (s == null) return;
      if (last !== null) { if (s === last) frozen++; else { frozen = 0; seen = true; } }
      last = s;
      if (frozen === 8 && !warned) { warned = true; if (o.onFrozen) try { o.onFrozen(); } catch (e) {} }
      if (!frozen) warned = false;
    }, 1000);
    return {
      alive: function () { return seen && frozen < 2; },
      get frozenFor() { return frozen; },
      runs: function (ms) {
        var a = sig();
        return new Promise(function (res) { setTimeout(function () { var b = sig(); res(a != null && b != null && a !== b); }, ms || 3000); });
      },
    };
  }

  var KEEP = 3, SPREAD = 60000;
  function norm(v) {
    if (v && Array.isArray(v.snaps)) return v.snaps.slice();
    if (v && v.state) return [{ state: v.state, t: v.t || v.at || 0 }];
    return [];
  }
  // newest first; while the newest is under a minute old it's replaced, so the
  // older two stay at least a minute back (a crash can't push them all out)
  function push(stored, snap) {
    var list = norm(stored);
    if (list.length >= KEEP && list[0].t > snap.t - SPREAD) list.shift();
    list.unshift(snap);
    return list.slice(0, KEEP);
  }
  function restore(o) {
    var list = o.list || [], toast = o.toast || function () {};
    function at(i) {
      if (i >= list.length) {
        try { o.reset(); } catch (e) {}
        toast('Every autosave was frozen, so the game restarted: load your save to carry on from where you last saved in the game.', 9000);
        try { o.keep([]); } catch (e) {}
        if (o.done) o.done();
        return;
      }
      try { o.load(list[i].state); } catch (e) { console.warn('[autosave] could not restore', e); at(i + 1); return; }
      o.health.runs(3000).then(function (ok) {
        if (!ok) { console.warn('[autosave] snapshot', i, 'is frozen'); at(i + 1); return; }
        if (i) try { o.keep(list.slice(i)); } catch (e) {}   // the frozen ones go
        toast(i ? 'The last autosave was frozen; picked up from an earlier one (' + Math.round((list[0].t - list[i].t) / 1000) + ' s before)' : 'Picked up where you left off');
        if (o.done) o.done();
      });
    }
    at(0);
  }
  window.RHHealth = { create: create, push: push, norm: norm, restore: restore, ram: ram, paused: paused };
})();
