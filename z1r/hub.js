/*
 * Rando Hub glue for Zelda 1 (z1r/), loaded by one <script> line in
 * z1r/index.html. Zelda 1 lives here now (its old repository, Zelda-1-Rando,
 * is archived).
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
  var HUB = '../';
  var R = window.RandoRoll;      // roll-games.js: which games a reroll may land on
  function either() { return R ? R.others('z1').length > 0 : false; }

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
      var other = R ? R.pick('z1', mode) : null;
      if (other) {
        R.go(other, { mode: mode, by: opts && opts.by });
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
      back.textContent = 'Zelda 3';
      back.title = 'Back to Rando Hub (A Link to the Past)';
      newSeed.parentNode.insertBefore(back, newSeed);
      var glr = document.createElement('a');
      glr.className = 'btn'; glr.id = 'hub-glr'; glr.href = HUB + 'glr/'; glr.dataset.game = 'glr';
      glr.textContent = 'GLR'; glr.title = 'The Guardian Legend randomizer (picked by hand only: rerolls never go there)';
      glr.style.textDecoration = 'none';
      newSeed.parentNode.insertBefore(glr, newSeed);
      var fsel = document.createElement('select');
      fsel.className = 'btn'; fsel.id = 'hub-ff'; fsel.title = 'The Final Fantasy randomizers: FF1R, FF4 Free Enterprise, FF5 Career Day, FF6 Worlds Collide';
      fsel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px;';
      fsel.innerHTML = '<option value="">FF ▾</option>' + [['ffr/ff1/', 'FF1 Randomizer', 'ff1'], ['ffr/ff4/', 'FF4 Free Enterprise', 'ff4'], ['ffr/ff5/', 'FF5 Career Day', 'ff5'], ['ff6wc/', 'FF6 Worlds Collide', 'ff6']]
        .filter(function (x) { return x[0] !== '' && (!R || R.isShown(x[2])); }).map(function (x) { return '<option value="' + HUB + x[0] + '">' + x[1] + '</option>'; }).join('');
      if (fsel.options.length < 2) fsel.hidden = true;
      fsel.addEventListener('change', function () { if (fsel.value) location.href = fsel.value; });
      newSeed.parentNode.insertBefore(fsel, newSeed);
      var pt = document.createElement('a');
      pt.className = 'btn'; pt.id = 'hub-patched'; pt.href = HUB + 'patched/';
      pt.textContent = 'Patched'; pt.title = 'Patched games: NES and SNES ROM hacks on these emulators';
      pt.style.textDecoration = 'none'; pt.dataset.game = 'patched';
      newSeed.parentNode.insertBefore(pt, newSeed);
      if (R) R.applyShown(newSeed.parentNode);
      // phones: one "Games ▾" menu instead of the row of links, so New seed stays on screen
      if (R) newSeed.parentNode.insertBefore(R.gamesMenu('z1r/', ['hub-back', 'hub-glr', 'hub-ff', 'hub-patched'], [{ id: 'hub-reroll', label: '🎲 Reroll' }, { id: 'z1-timer', label: '⏱ Timer' }, { id: 'z1t-btn', label: '🎯 Training' }]), newSeed);
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button';
      rr.innerHTML = '🎲<span class="hub-short"> Reroll</span>';
      rr.title = 'A new seed with the flags you used last' + (either() ? ' (or a ' + R.others('z1').join(' / ') + ' seed: ticked in the hub’s Game row)' : '');
      rr.addEventListener('click', function () {
        var playing = document.body.classList.contains('playing');
        if (playing && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its save stays).')) return;
        var other = R ? R.pick('z1') : null;
        if (other) { R.go(other, {}); return; }
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
