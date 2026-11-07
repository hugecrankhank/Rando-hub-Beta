/*
 * Rando Hub glue for The Guardian Legend (glr/), loaded by one <script> line
 * in glr/index.html. GLR lives here now (its old repository is archived).
 *
 * GLR is a game you pick yourself: rerolls and "either game" never land here
 * from another game (Crowd effects can roll a new GLR seed while playing GLR,
 * when allowed in its settings: js/crowd.js). This only adds the way back to the other games and
 * puts GLR seeds in the hub's seed history.
 */
(function () {
  'use strict';
  var HUB = '../';

  // Before js/crowd.js reads its settings: the connection follows the hub's.
  try {
    var hubCc = JSON.parse(localStorage.getItem('s9x-crowd-settings') || 'null');
    if (hubCc) {
      var mine = JSON.parse(localStorage.getItem('glr-crowd-settings') || 'null');
      var fresh = !mine;
      mine = mine || {};
      ['enabled', 'url'].concat(fresh ? ['feed', 'alerts', 'allowReroll', 'showTimer'] : []).forEach(function (k) {
        if (k in hubCc) mine[k] = hubCc[k];
      });
      localStorage.setItem('glr-crowd-settings', JSON.stringify(mine));
    }
  } catch (e) {}

  function logSeed() {
    try {
      var what = (document.getElementById('result-seed') || {}).textContent || '';
      if (!what) return;
      var l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      if (!Array.isArray(l)) l = [];
      l.push({ at: Date.now(), game: 'Guardian Legend', what: what, generator: 'GLR', kind: 'manual' });
      localStorage.setItem('rhb-seed-log', JSON.stringify(l.slice(-500)));
    } catch (e) {}
  }

  function link(id, href, text, title) {
    var a = document.createElement('a');
    a.className = 'btn'; a.id = id; a.href = href; a.textContent = text; a.title = title;
    return a;
  }

  function init() {
    var css = document.createElement('style');
    css.textContent = '#hub-back, #hub-z1, #hub-ff6, #hub-ff1, #hub-ff4, #hub-ff5, #hub-smrpg, #hub-sm, #hub-metroid, #hub-smw, #hub-smz3, #hub-zm, #hub-patched { text-decoration: none; white-space: nowrap; }';
    document.head.appendChild(css);
    var newSeed = document.getElementById('new-seed');
    if (newSeed) {
      newSeed.parentNode.insertBefore(link('hub-back', HUB, 'Zelda 3', 'Back to Rando Hub (A Link to the Past)'), newSeed);
      newSeed.parentNode.insertBefore(link('hub-z1', HUB + 'z1r/', 'Zelda 1', 'The Zelda 1 randomizer (Z1R)'), newSeed).dataset.game = 'z1';
      var fsel = document.createElement('select');
      fsel.className = 'btn'; fsel.id = 'hub-ff'; fsel.title = 'The Final Fantasy randomizers: FF1R, FF4 Free Enterprise, FF5 Career Day, FF6 Worlds Collide';
      fsel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px;';
      fsel.innerHTML = '<option value="">FF ▾</option>' + [['ffr/ff1/', 'FF1 Randomizer', 'ff1'], ['ffr/ff4/', 'FF4 Free Enterprise', 'ff4'], ['ffr/ff5/', 'FF5 Career Day', 'ff5'], ['ff6wc/', 'FF6 Worlds Collide', 'ff6']]
        .filter(function (x) { return x[0] !== '' && (!window.RandoRoll || RandoRoll.isShown(x[2])); }).map(function (x) { return '<option value="' + HUB + x[0] + '">' + x[1] + '</option>'; }).join('');
      if (fsel.options.length < 2) fsel.hidden = true;
      fsel.addEventListener('change', function () { if (fsel.value) location.href = fsel.value; });
      newSeed.parentNode.insertBefore(fsel, newSeed);
      newSeed.parentNode.insertBefore(link('hub-smrpg', HUB + 'smrpg/', 'SMRPG', 'Super Mario RPG: Open World Randomizer'), newSeed).dataset.game = 'smrpg';
      newSeed.parentNode.insertBefore(link('hub-sm', HUB + 'sm/', 'SM', 'Super Metroid: DASH'), newSeed).dataset.game = 'sm';
      newSeed.parentNode.insertBefore(link('hub-metroid', HUB + 'metroid/', 'Metroid', 'Metroid (NES): Rando Hub’s own randomizer'), newSeed).dataset.game = 'metroid';
      newSeed.parentNode.insertBefore(link('hub-smw', HUB + 'smw/', 'SMW', 'Super Mario World Randomizer'), newSeed).dataset.game = 'smw';
      newSeed.parentNode.insertBefore(link('hub-smz3', HUB + 'smz3/', 'SMZ3', 'SMZ3: Super Metroid + A Link to the Past'), newSeed).dataset.game = 'smz3';
      newSeed.parentNode.insertBefore(link('hub-zm', HUB + 'zm/', 'Z1+M1', 'Zelda 1 + Metroid, linked: portals between Hyrule and Zebes'), newSeed).dataset.game = 'zm';
      newSeed.parentNode.insertBefore(link('hub-quad', HUB + 'cross/', 'Rando Cross', 'Rando Cross: Zelda 1, Metroid, Super Metroid and A Link to the Past in one seed'), newSeed).dataset.game = 'quad';
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed).dataset.game = 'patched';
      var R = window.RandoRoll;
      if (R) R.applyShown(newSeed.parentNode);
      if (R) newSeed.parentNode.insertBefore(R.gamesMenu('glr/', ['hub-back', 'hub-z1', 'hub-ff', 'hub-smrpg', 'hub-sm', 'hub-patched', 'hub-metroid', 'hub-smw', 'hub-smz3', 'hub-zm', 'hub-quad'], [{ id: 'hub-reroll', label: '🎲 Reroll' }]), newSeed);
      // 🎲 Reroll: a new seed with the flags you used last, or another game if the
      // hub's "Rerolls can land on" says so
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button'; rr.innerHTML = '🎲<span class="hub-short"> Reroll</span>';
      rr.title = 'A new seed with the flags you used last' + (R && R.others('glr').length ? ' (or a ' + R.others('glr').join(' / ') + ' seed: ticked in the hub’s Game row)' : '');
      rr.style.whiteSpace = 'nowrap';
      rr.addEventListener('click', function () {
        if (document.body.classList.contains('playing') && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its save stays).')) return;
        var other = R ? R.pick('glr') : null;
        if (other) { R.go(other, {}); return; }
        if (window.GLRSeed && GLRSeed.rollAndPlay) GLRSeed.rollAndPlay({}).catch(function (e) { alert('Couldn’t roll a seed: ' + (e && e.message || e)); });
      });
      var romLabel = document.querySelector('header label[for="rom-input"]');
      (romLabel || newSeed).insertAdjacentElement('afterend', rr);
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', logSeed, true);
    // ?roll=1 (a reroll that landed here from another game): roll right away;
    // mode=preset / chaos from Crowd Control = a random preset
    var q = new URLSearchParams(location.search);
    if (q.get('roll') === '1') {
      var mode = q.get('mode') || '', by = q.get('by') || '';
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      // rolls once this game can (its ROM in this browser); until then ../roll-games.js says so
      var from = q.get('from') || '', RR = window.RandoRoll;
      var roll = function () { return GLRSeed.rollAndPlay({ mode: mode, by: by }); };
      var ready = function () { return !!(window.GLRSeed && GLRSeed.rollAndPlay && GLRSeed.hasRom) && GLRSeed.hasRom(); };
      if (RR && RR.landed) RR.landed({ name: 'Guardian Legend', from: from, ready: ready, roll: roll, pickRom: function () { GLRSeed.open(); } });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
