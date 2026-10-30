/*
 * Rando Hub glue for The Guardian Legend (glr/), loaded by one <script> line
 * in glr/index.html. GLR lives here now (its old repository is archived).
 *
 * GLR is a game you pick yourself: rerolls, "either game" and Crowd Control
 * never roll a seed here. This only adds the way back to the other games and
 * puts GLR seeds in the hub's seed history.
 */
(function () {
  'use strict';
  var HUB = '../';

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
    css.textContent = '#hub-back, #hub-z1, #hub-ff6, #hub-ff1, #hub-ff4, #hub-ff5, #hub-smrpg, #hub-sm, #hub-patched { text-decoration: none; white-space: nowrap; }';
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
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed).dataset.game = 'patched';
      var R = window.RandoRoll;
      if (R) R.applyShown(newSeed.parentNode);
      if (R) newSeed.parentNode.insertBefore(R.gamesMenu('glr/', ['hub-back', 'hub-z1', 'hub-ff', 'hub-smrpg', 'hub-sm', 'hub-patched']), newSeed);
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
      var tries = 0, t = setInterval(function () {
        if (++tries > 40) { clearInterval(t); return; }
        if (!window.GLRSeed || !GLRSeed.rollAndPlay) return;
        clearInterval(t);
        GLRSeed.rollAndPlay({ mode: mode, by: by }).catch(function (e) { alert('Couldn’t roll a Guardian Legend seed: ' + (e && e.message || e)); });
      }, 250);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
