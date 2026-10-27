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
      newSeed.parentNode.insertBefore(link('hub-z1', HUB + 'z1r/', 'Zelda 1', 'The Zelda 1 randomizer (Z1R)'), newSeed);
      newSeed.parentNode.insertBefore(link('hub-glr', HUB + 'glr/', 'GLR', 'The Guardian Legend randomizer'), newSeed);
      newSeed.parentNode.insertBefore(link('hub-patched', HUB + 'patched/', 'Patched', 'Patched games: NES and SNES ROM hacks on these emulators'), newSeed);
      var rr = document.createElement('button');
      rr.className = 'btn'; rr.id = 'hub-reroll'; rr.type = 'button'; rr.textContent = '🎲 Reroll';
      rr.title = 'A new seed with the flags you used last';
      rr.addEventListener('click', function () {
        if (document.body.classList.contains('playing') && !confirm('Reroll: start a new seed?\n\nThe current game will be closed (its saves stay).')) return;
        if (window.FF6Seed) window.FF6Seed.reroll().catch(function () {});
      });
      newSeed.parentNode.insertBefore(rr, newSeed.nextSibling);
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', logSeed, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
