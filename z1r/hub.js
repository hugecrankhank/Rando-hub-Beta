/*
 * Rando Hub glue for Zelda 1 (z1r/). tools/update-z1r.py copies this file
 * into z1r/ and adds one <script> line to z1r/index.html; the Z1R app itself
 * (hugecrankhank/Zelda-1-Rando) stays a standalone app.
 *
 *  - "◂ Zelda 3" back to the hub, and a 🎲 Reroll button in the header
 *  - "Rerolls can land on either game" (set in the hub's Randomizer bar):
 *    the 🎲 Reroll button and Crowd Control's Random preset / CHAOS seed may
 *    go to the hub instead, which rolls an ALTTP seed of that kind
 *    (../?roll=1&mode=…). Crowd Control's "New seed (same flags)" stays here.
 *  - ?roll=1 (from the hub): roll a Zelda 1 seed right away
 *  - Crowd effects on/off and the bridge address follow the hub's
 */
(function () {
  'use strict';
  var EITHER_KEY = 'rando-hub-either-game';
  var HUB = '../';

  function either() { try { return localStorage.getItem(EITHER_KEY) === '1'; } catch (e) { return false; } }

  // Before js/crowd.js reads its settings: the connection follows the hub's.
  try {
    var hub = JSON.parse(localStorage.getItem('s9x-crowd-settings') || 'null');
    if (hub) {
      var mine = JSON.parse(localStorage.getItem('z1r-crowd-settings') || 'null');
      var fresh = !mine;
      mine = mine || {};
      ['enabled', 'url'].concat(fresh ? ['feed', 'alerts', 'allowReroll', 'showTimer'] : []).forEach(function (k) {
        if (k in hub) mine[k] = hub[k];
      });
      localStorage.setItem('z1r-crowd-settings', JSON.stringify(mine));
    }
  } catch (e) {}

  var roll = null;     // Z1R's own rollAndPlay, kept for ?roll=1

  // The hub's seed history (seed-log.js keeps it in the same storage): one
  // entry per Zelda 1 seed rolled from here, with who and how.
  function logSeed(seed, ctx) {
    try {
      var l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      if (!Array.isArray(l)) l = [];
      var f = {}; try { f = JSON.parse(localStorage.getItem('z1ru:flags') || '{}'); } catch (e) {}
      var pre = document.getElementById('preset');
      ctx = ctx || {};
      l.push({ at: Date.now(), game: 'Zelda 1', what: 'Seed ' + seed, generator: 'Z1R (ZORA)',
        preset: (pre && pre.value) || '', pick: f.flags ? 'Flags ' + f.flags + (f.zoraFlags ? ' · ZORA ' + f.zoraFlags : '') : '',
        kind: ctx.kind || 'manual', by: ctx.by ? String(ctx.by).slice(0, 60) : undefined, from: ctx.from });
      localStorage.setItem('rhb-seed-log', JSON.stringify(l.slice(-500)));
    } catch (e) {}
  }

  function rollHere(mode, ctx) {
    var dlg = document.getElementById('seed-dlg');
    try { window.Z1Seed.open(); } catch (e) {}       // shows the progress
    return roll(mode ? { mode: mode } : undefined).then(function (seed) {
      if (dlg && dlg.open) dlg.close();
      logSeed(seed, ctx);
      return seed;
    }, function (e) {
      alert('Couldn’t roll a Zelda 1 seed: ' + ((e && e.message) || e));
      throw e;
    });
  }

  function init() {
    if (!window.Z1Seed || !window.Z1Seed.rollAndPlay) return;
    roll = window.Z1Seed.rollAndPlay;
    // Every reroll goes through here: maybe it's ALTTP's turn.
    // Crowd Control passes { mode }: "same" flags never leaves Zelda 1; a random
    // preset or CHAOS seed may, and stays that kind in Zelda 3.
    window.Z1Seed.rollAndPlay = function (opts) {
      var mode = opts && opts.mode;
      if (mode !== 'same' && either() && Math.random() < 0.5) {
        location.href = HUB + '?roll=1' + (mode ? '&mode=' + mode : '') + (opts && opts.by ? '&by=' + encodeURIComponent(opts.by) : '');
        return new Promise(function () {});           // the page is leaving
      }
      return roll.apply(this, arguments).then(function (seed) {
        logSeed(seed, { kind: mode || 'reroll', by: opts && opts.by });
        return seed;
      });
    };

    var css = document.createElement('style');
    css.textContent = '#hub-back { text-decoration: none; } #hub-reroll { white-space: nowrap; }';
    document.head.appendChild(css);
    var newSeed = document.getElementById('new-seed');
    if (newSeed) {
      var back = document.createElement('a');
      back.className = 'btn'; back.id = 'hub-back'; back.href = HUB;
      back.textContent = '◂ Zelda 3';
      back.title = 'Back to Rando Hub (A Link to the Past)';
      newSeed.parentNode.insertBefore(back, newSeed);
      var glr = document.createElement('a');
      glr.className = 'btn'; glr.id = 'hub-glr'; glr.href = HUB + 'glr/';
      glr.textContent = 'GLR'; glr.title = 'The Guardian Legend randomizer (picked by hand only: rerolls never go there)';
      glr.style.textDecoration = 'none';
      newSeed.parentNode.insertBefore(glr, newSeed);
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button';
      rr.textContent = '🎲 Reroll';
      rr.title = 'A new seed with the flags you used last' + (either() ? ' (or a Zelda 3 seed: either game is on)' : '');
      rr.addEventListener('click', function () {
        var playing = document.body.classList.contains('playing');
        if (playing && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its save stays).')) return;
        if (either() && Math.random() < 0.5) { location.href = HUB + '?roll=1'; return; }
        rollHere(undefined, { kind: 'reroll' }).catch(function () {});
      });
      var romLabel = document.querySelector('header label[for="rom-input"]');
      (romLabel || newSeed).insertAdjacentElement('afterend', rr);
    }

    var q = new URLSearchParams(location.search);
    if (q.get('roll') === '1') {
      var mode = /^(preset|chaos)$/.test(q.get('mode') || '') ? q.get('mode') : '', by = q.get('by') || '';
      q.delete('roll'); q.delete('by'); q.delete('mode');
      try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
      setTimeout(function () { rollHere(mode, { kind: mode || 'reroll', by: by, from: 'Zelda 3' }).catch(function () {}); }, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
