/*
 * Rando Hub glue for FF6 Worlds Collide (ff6wc/), loaded by one <script>
 * line in ff6wc/index.html.
 *
 * Like GLR, this is a game you pick yourself: rerolls, "either game" and
 * Crowd Control never roll a seed here. This adds the way back to the other
 * games, a 🎲 Reroll (same flags, new seed) and puts seeds in the hub's seed
 * history.
 */
(function () {
  'use strict';
  var HUB = '../';

  function logSeed() {
    try {
      var last = window.FF6Seed && window.FF6Seed.last;
      if (!last || !last.meta || !last.meta.seed) return;
      var l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      if (!Array.isArray(l)) l = [];
      var pre = document.getElementById('preset');
      l.push({ at: Date.now(), game: 'FF6', what: 'Seed ' + last.meta.seed, generator: 'Worlds Collide ' + (last.meta.version || ''),
        preset: pre ? pre.options[pre.selectedIndex].textContent : '', pick: (last.meta.hash || []).join(', '), kind: 'manual' });
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
        .filter(function (x) { return x[0] !== 'ff6wc/' && (!window.RandoRoll || RandoRoll.isShown({ 'ffr/ff1/': 'ff1', 'ffr/ff4/': 'ff4', 'ffr/ff5/': 'ff5' }[x[0]])); }).map(function (x) { return '<option value="' + HUB + x[0] + '">' + x[1] + '</option>'; }).join('');
      if (fsel.options.length < 2) fsel.hidden = true;
      fsel.addEventListener('change', function () { if (fsel.value) location.href = fsel.value; });
      newSeed.parentNode.insertBefore(fsel, newSeed);
      newSeed.parentNode.insertBefore(link('hub-smrpg', HUB + 'smrpg/', 'SMRPG', 'Super Mario RPG: Open World Randomizer'), newSeed).dataset.game = 'smrpg';
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed).dataset.game = 'patched';
      var R = window.RandoRoll;
      if (R) R.applyShown(newSeed.parentNode);
      if (R) newSeed.parentNode.insertBefore(R.gamesMenu('ff6wc/', ['hub-back', 'hub-z1', 'hub-glr', 'hub-ff', 'hub-smrpg', 'hub-patched']), newSeed);
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button'; rr.innerHTML = '🎲<span class="hub-short"> Reroll</span>';
      rr.title = 'A new seed with the flags you used last' + (R && R.others('ff6').length ? ' (or a ' + R.others('ff6').join(' / ') + ' seed: ticked in the hub’s Game row)' : '');
      rr.addEventListener('click', function () {
        if (document.body.classList.contains('playing') && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its saves stay).')) return;
        var other = R ? R.pick('ff6') : null;
        if (other) { R.go(other, {}); return; }
        if (window.FF6Seed) window.FF6Seed.reroll().catch(function () {});
      });
      newSeed.parentNode.insertBefore(rr, newSeed.nextSibling);
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', logSeed, true);
    // ?roll=1: a reroll that landed here from another game. mode=preset / chaos
    // (Crowd Control) = one of the presets at random.
    var q = new URLSearchParams(location.search);
    if (q.get('roll') === '1') {
      var mode = q.get('mode') || '';
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      var tries = 0, t = setInterval(function () {
        if (++tries > 40) { clearInterval(t); return; }
        if (!window.FF6Seed || !window.FF6Seed.reroll) return;
        clearInterval(t);
        if (mode === 'preset' || mode === 'chaos') {
          var sel = document.getElementById('preset');
          var ids = (window.FF6 ? FF6.PRESETS : []).filter(function (p) { return p.id !== 'custom'; }).map(function (p) { return p.id; });
          if (sel && ids.length) { sel.value = ids[Math.floor(Math.random() * ids.length)]; sel.dispatchEvent(new Event('change')); }
        }
        window.FF6Seed.reroll().then(function (r) { if (r) logSeed(); }).catch(function (e) { alert('Couldn’t roll a Worlds Collide seed: ' + (e && e.message || e)); });
      }, 250);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
