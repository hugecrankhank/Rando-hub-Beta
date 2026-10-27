/*
 * roll-games.js — which games a reroll may land on. Shared by the hub
 * (Zelda 3), Zelda 1, GLR and FF6 Worlds Collide: the games with a seed
 * generator in the page. (FF1, FF4 and FF5 are rolled on their own sites, so
 * a reroll can't go there.)
 *
 * The player ticks the games in the hub's Randomizer bar ("Rerolls can land
 * on: Zelda 3, Zelda 1, Guardian Legend, FF6"). The 🎲 Reroll button and
 * Crowd Control's random preset / CHAOS seed then pick one of the ticked games
 * at random (the game being played counts too, so with two ticked it's a coin
 * toss); "New seed (same settings)" always stays. Nothing ticked but the
 * current game = rerolls stay put, the old behaviour.
 *
 *   RandoRoll.allowed()             → { z3, z1, glr, ff6 } booleans
 *   RandoRoll.setAllowed(obj)
 *   RandoRoll.pick(currentId, mode) → the id to go to, or null to stay here
 *   RandoRoll.go(id, {mode, by})    → leaves for that game's page with ?roll=1
 *   RandoRoll.GAMES, RandoRoll.base (the hub's folder, relative to this page)
 */
(function (root) {
  'use strict';
  var KEY = 'rando-hub-roll-games';
  var LEGACY = 'rando-hub-either-game';
  var GAMES = [
    { id: 'z3', name: 'Zelda 3', url: '' },
    { id: 'z1', name: 'Zelda 1', url: 'z1r/' },
    { id: 'glr', name: 'Guardian Legend', url: 'glr/' },
    { id: 'ff6', name: 'FF6 Worlds Collide', url: 'ff6wc/' },
  ];
  // where the hub is from this page (set by the page: '' on the hub, '../' in a game's folder)
  var base = (document.currentScript && document.currentScript.dataset.hub) || '';

  function allowed() {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!a || typeof a !== 'object') {
      var either = false;
      try { either = localStorage.getItem(LEGACY) === '1'; } catch (e) {}
      a = { z3: true, z1: either, glr: false, ff6: false };
    }
    return a;
  }
  function setAllowed(a) {
    try {
      localStorage.setItem(KEY, JSON.stringify(a));
      localStorage.setItem(LEGACY, a.z3 && a.z1 ? '1' : '0');   // older copies read this
    } catch (e) {}
  }
  // The games a reroll from `current` may land on (always including current)
  function pool(current) {
    var a = allowed();
    return GAMES.filter(function (g) { return g.id === current || a[g.id]; });
  }
  function pick(current, mode) {
    if (mode === 'same') return null;
    var p = pool(current);
    if (p.length < 2) return null;
    var g = p[Math.floor(Math.random() * p.length)];
    return g.id === current ? null : g.id;
  }
  function url(id) { var g = GAMES.filter(function (x) { return x.id === id; })[0]; return g ? base + g.url : null; }
  function go(id, opts) {
    var u = url(id); if (u == null) return;
    var mode = opts && opts.mode, by = opts && opts.by;
    location.href = u + '?roll=1' + (mode && mode !== 'same' ? '&mode=' + mode : '') + (by ? '&by=' + encodeURIComponent(by) : '');
  }
  function name(id) { var g = GAMES.filter(function (x) { return x.id === id; })[0]; return g ? g.name : id; }
  function others(current) { return pool(current).filter(function (g) { return g.id !== current; }).map(function (g) { return g.name; }); }

  // All the hub's games, for the header's compact "Games ▾" menu on narrow screens
  var ALL = [['', 'Zelda 3'], ['z1r/', 'Zelda 1'], ['glr/', 'Guardian Legend'], ['ffr/ff1/', 'FF1 Randomizer'], ['ffr/ff4/', 'FF4 Free Enterprise'],
    ['ffr/ff5/', 'FF5 Career Day'], ['ff6wc/', 'FF6 Worlds Collide'], ['patched/', 'Patched games']];
  // Returns a <select> that goes to any other game; the page shows it instead of
  // its row of link buttons when the header is too narrow for them (the ids
  // given are hidden then).
  function gamesMenu(currentUrl, linkIds) {
    var sel = document.createElement('select');
    sel.className = 'btn'; sel.id = 'hub-games'; sel.setAttribute('aria-label', 'Other games');
    sel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px; display: none; max-width: 104px; text-overflow: ellipsis;';
    sel.innerHTML = '<option value="">Games ▾</option>' + ALL.filter(function (x) { return x[0] !== currentUrl; })
      .map(function (x) { return '<option value="' + base + x[0] + '">' + x[1] + '</option>'; }).join('');
    sel.addEventListener('change', function () { if (sel.value) location.href = sel.value; });
    var css = document.createElement('style');
    css.textContent = '@media (max-width: 760px), (max-height: 560px) { ' + linkIds.map(function (i) { return '#' + i; }).join(', ') + ' { display: none !important; } #hub-games { display: inline-flex !important; } }';
    document.head.appendChild(css);
    return sel;
  }

  root.RandoRoll = { gamesMenu: gamesMenu, GAMES: GAMES, KEY: KEY, allowed: allowed, setAllowed: setAllowed, pool: pool, pick: pick, go: go, url: url, name: name, others: others, get base() { return base; }, set base(b) { base = b; } };
})(window);
