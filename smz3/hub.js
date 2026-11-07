/*
 * Rando Hub glue for SMZ3 (smz3/), loaded by one <script>
 * line in smz3/index.html.
 *
 * The way back to the other games, a 🎲 Reroll (same settings, new seed),
 * ?roll=1 from another game's reroll, and the hub's seed history.
 */
(function () {
  'use strict';
  var HUB = '../';

  function logSeed() {
    try {
      var last = window.SMZ3Seed && window.SMZ3Seed.last;
      if (!last || !last.meta || !last.meta.seed) return;
      var l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      if (!Array.isArray(l)) l = [];
      l.push({ at: Date.now(), game: 'SMZ3', what: 'Seed ' + last.meta.seed, generator: last.meta.generator || 'SMZ3 Randomizer',
        preset: last.meta.summary || '', pick: String(last.meta.seed + '/' + last.meta.code), kind: 'manual' });
      localStorage.setItem('rhb-seed-log', JSON.stringify(l.slice(-500)));
    } catch (e) {}
  }

  function link(id, href, text, title) {
    var a = document.createElement('a');
    a.className = 'btn'; a.id = id; a.href = href; a.textContent = text; a.title = title;
    return a;
  }

  function init() {
    var newSeed = document.getElementById('new-seed');
    if (newSeed) {
      newSeed.parentNode.insertBefore(link('hub-back', HUB, 'Zelda 3', 'Back to Rando Hub (A Link to the Past)'), newSeed);
      newSeed.parentNode.insertBefore(link('hub-z1', HUB + 'z1r/', 'Zelda 1', 'The Zelda 1 randomizer (Z1R)'), newSeed).dataset.game = 'z1';
      newSeed.parentNode.insertBefore(link('hub-glr', HUB + 'glr/', 'GLR', 'The Guardian Legend randomizer'), newSeed).dataset.game = 'glr';
      var fsel = document.createElement('select');
      fsel.className = 'btn'; fsel.id = 'hub-ff'; fsel.title = 'The Final Fantasy randomizers: FF1R, FF4 Free Enterprise, FF5 Career Day, FF6 Worlds Collide';
      fsel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px;';
      fsel.innerHTML = '<option value="">FF ▾</option>' + [['ffr/ff1/', 'FF1 Randomizer'], ['ffr/ff4/', 'FF4 Free Enterprise'], ['ffr/ff5/', 'FF5 Career Day'], ['ff6wc/', 'FF6 Worlds Collide']]
        .filter(function (x) { return !window.RandoRoll || RandoRoll.isShown({ 'ffr/ff1/': 'ff1', 'ffr/ff4/': 'ff4', 'ffr/ff5/': 'ff5', 'ff6wc/': 'ff6' }[x[0]]); }).map(function (x) { return '<option value="' + HUB + x[0] + '">' + x[1] + '</option>'; }).join('');
      if (fsel.options.length < 2) fsel.hidden = true;
      fsel.addEventListener('change', function () { if (fsel.value) location.href = fsel.value; });
      newSeed.parentNode.insertBefore(fsel, newSeed);
      newSeed.parentNode.insertBefore(link('hub-smrpg', HUB + 'smrpg/', 'SMRPG', 'Super Mario RPG: Open World Randomizer'), newSeed).dataset.game = 'smrpg';
      newSeed.parentNode.insertBefore(link('hub-sm', HUB + 'sm/', 'SM', 'Super Metroid: DASH'), newSeed).dataset.game = 'sm';
      newSeed.parentNode.insertBefore(link('hub-metroid', HUB + 'metroid/', 'Metroid', 'Metroid (NES): Rando Hub’s own randomizer'), newSeed).dataset.game = 'metroid';
      newSeed.parentNode.insertBefore(link('hub-smw', HUB + 'smw/', 'SMW', 'Super Mario World Randomizer'), newSeed).dataset.game = 'smw';
      newSeed.parentNode.insertBefore(link('hub-zm', HUB + 'zm/', 'Z1+M1', 'Zelda 1 + Metroid, linked: portals between Hyrule and Zebes'), newSeed).dataset.game = 'zm';
      newSeed.parentNode.insertBefore(link('hub-quad', HUB + 'cross/', 'Rando Cross', 'Rando Cross: Zelda 1, Metroid, Super Metroid and A Link to the Past in one seed'), newSeed).dataset.game = 'quad';
      newSeed.parentNode.insertBefore(link('hub-z1z3', HUB + 'z1z3/', 'Z1Z3', 'Z1Z3: A Link to the Past + Zelda 1, one item pool across both Hyrules'), newSeed).dataset.game = 'z1z3';
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed).dataset.game = 'patched';
      var R = window.RandoRoll;
      if (R) R.applyShown(newSeed.parentNode);
      if (R) newSeed.parentNode.insertBefore(R.gamesMenu('smz3/', ['hub-back', 'hub-z1', 'hub-glr', 'hub-ff', 'hub-smrpg', 'hub-sm', 'hub-metroid', 'hub-smw', 'hub-zm', 'hub-quad', 'hub-z1z3', 'hub-patched']), newSeed);
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button'; rr.innerHTML = '🎲<span class="hub-short"> Reroll</span>';
      rr.title = 'A new seed with the flags you used last' + (R && R.others('smz3').length ? ' (or a ' + R.others('smz3').join(' / ') + ' seed: ticked in the hub’s Game row)' : '');
      rr.addEventListener('click', function () {
        if (document.body.classList.contains('playing') && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its saves stay).')) return;
        var other = R ? R.pick('smz3') : null;
        if (other) { R.go(other, {}); return; }
        if (window.SMZ3Seed) window.SMZ3Seed.reroll().catch(function () {});
      });
      newSeed.parentNode.insertBefore(rr, newSeed.nextSibling);
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', logSeed, true);
    // ?roll=1: a reroll that landed here from another game (any mode: there is
    // one way to roll here).
    var q = new URLSearchParams(location.search);
    if (q.get('roll') === '1') {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      // rolls once this game can (its ROM in this browser); until then ../roll-games.js says so
      var from = q.get('from') || '', RR = window.RandoRoll;
      var roll = function () {
        window.SMZ3Seed.reroll().then(function (r) { if (r) logSeed(); }).catch(function (e) { alert('Couldn’t roll a seed: ' + (e && e.message || e)); });
      };
      var ready = function () { return !!(window.SMZ3Seed && window.SMZ3Seed.reroll && window.SMZ3Seed.hasRom && window.SMZ3Seed.hasRom()); };
      if (RR && RR.landed) RR.landed({ name: 'SMZ3', from: from, ready: ready, roll: roll, pickRom: function () { window.SMZ3Seed.open(); }, roms: 'its ROMs (Super Metroid and Zelda 3)' });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
