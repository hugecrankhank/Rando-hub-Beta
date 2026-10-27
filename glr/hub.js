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
    css.textContent = '#hub-back, #hub-z1, #hub-ff6, #hub-ff1, #hub-ff4, #hub-ff5, #hub-patched { text-decoration: none; white-space: nowrap; }';
    document.head.appendChild(css);
    var newSeed = document.getElementById('new-seed');
    if (newSeed) {
      newSeed.parentNode.insertBefore(link('hub-back', HUB, 'Zelda 3', 'Back to Rando Hub (A Link to the Past)'), newSeed);
      newSeed.parentNode.insertBefore(link('hub-z1', HUB + 'z1r/', 'Zelda 1', 'The Zelda 1 randomizer (Z1R)'), newSeed);
      var fsel = document.createElement('select');
      fsel.className = 'btn'; fsel.id = 'hub-ff'; fsel.title = 'The Final Fantasy randomizers: FF1R, FF4 Free Enterprise, FF5 Career Day, FF6 Worlds Collide';
      fsel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px;';
      fsel.innerHTML = '<option value="">FF ▾</option>' + [['ffr/ff1/', 'FF1 Randomizer'], ['ffr/ff4/', 'FF4 Free Enterprise'], ['ffr/ff5/', 'FF5 Career Day'], ['ff6wc/', 'FF6 Worlds Collide']]
        .filter(function (x) { return x[0] !== ''; }).map(function (x) { return '<option value="' + HUB + x[0] + '">' + x[1] + '</option>'; }).join('');
      fsel.addEventListener('change', function () { if (fsel.value) location.href = fsel.value; });
      newSeed.parentNode.insertBefore(fsel, newSeed);
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed);
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', logSeed, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
