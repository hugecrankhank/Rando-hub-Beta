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

  // "Games shown": which games appear in the Game row, the headers and the
  // reroll list at all (Zelda 3 always). Hidden games still work by address.
  var SHOWN_KEY = 'rando-hub-games-shown';
  var SHOWABLE = [['z1', 'Zelda 1'], ['glr', 'Guardian Legend'], ['ff1', 'FF1 Randomizer'], ['ff4', 'FF4 Free Enterprise'], ['ff5', 'FF5 Career Day'], ['ff6', 'FF6 Worlds Collide'], ['patched', 'Patched games']];
  // Default: Zelda 3 and Zelda 1 only; the rest are ticked on by the player.
  function shown() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SHOWN_KEY) || 'null'); } catch (e) {}
    var fresh = !s || typeof s !== 'object';
    var out = { z3: true };
    SHOWABLE.forEach(function (x) { out[x[0]] = fresh ? x[0] === 'z1' : s[x[0]] === true; });
    return out;
  }
  function setShown(s) { s.z3 = true; try { localStorage.setItem(SHOWN_KEY, JSON.stringify(s)); } catch (e) {} }
  function isShown(id) { return id === 'z3' || shown()[id] !== false; }

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
    var a = allowed(), s = shown();
    return GAMES.filter(function (g) { return g.id === current || (a[g.id] && s[g.id]); });
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
  var ALL = [['', 'Zelda 3', 'z3'], ['z1r/', 'Zelda 1', 'z1'], ['glr/', 'Guardian Legend', 'glr'], ['ffr/ff1/', 'FF1 Randomizer', 'ff1'], ['ffr/ff4/', 'FF4 Free Enterprise', 'ff4'],
    ['ffr/ff5/', 'FF5 Career Day', 'ff5'], ['ff6wc/', 'FF6 Worlds Collide', 'ff6'], ['patched/', 'Patched games', 'patched']];
  // Returns a <select> that goes to any other game; the page shows it instead of
  // its row of link buttons when the header is too narrow for them (the ids
  // given are hidden then).
  // Phones (and short landscape screens): one "Games ▾" menu in place of the
  // row of game links, so New seed stays on screen. It also holds the page's
  // own header extras that don't fit there: "Play ROM file" (any page with a
  // #rom-input) and `extras` ([{id, label}]: a header button clicked from the
  // menu, hidden from the header on phones).
  function gamesMenu(currentUrl, linkIds, extras) {
    var sel = document.createElement('select');
    sel.className = 'btn'; sel.id = 'hub-games'; sel.setAttribute('aria-label', 'Other games and more');
    sel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px; display: none; max-width: 104px; text-overflow: ellipsis;';
    var s = shown();
    var acts = [];
    if (document.getElementById('rom-input')) acts.push({ id: 'rom-input', label: 'Play ROM file…', hide: 'header label[for="rom-input"]' });
    (extras || []).forEach(function (x) { acts.push({ id: x.id, label: x.label, hide: '#' + x.id }); });
    sel.innerHTML = '<option value="">Games ▾</option>' +
      (acts.length ? '<optgroup label="This game">' + acts.map(function (a, i) { return '<option value="act:' + i + '">' + a.label + '</option>'; }).join('') + '</optgroup><optgroup label="Other games">' : '') +
      ALL.filter(function (x) { return x[0] !== currentUrl && s[x[2]]; })
        .map(function (x) { return '<option value="' + base + x[0] + '">' + x[1] + '</option>'; }).join('') +
      (acts.length ? '</optgroup>' : '');
    sel.addEventListener('change', function () {
      var v = sel.value; sel.value = '';
      if (!v) return;
      if (v.indexOf('act:') === 0) { var a = acts[+v.slice(4)], el = a && document.getElementById(a.id); if (el) el.click(); return; }
      location.href = v;
    });
    var css = document.createElement('style');
    var hide = linkIds.map(function (i) { return '#' + i; }).concat(acts.map(function (a) { return a.hide; }));
    css.textContent = '@media (max-width: 760px), (max-height: 560px) { ' + hide.join(', ') + ' { display: none !important; } #hub-games { display: inline-flex !important; } .hub-short { display: none; } }';
    document.head.appendChild(css);
    return sel;
  }

  // Hide a page's own game links for games that aren't shown: el.dataset.game = id
  function applyShown(rootEl) {
    var s = shown();
    (rootEl || document).querySelectorAll('[data-game]').forEach(function (el) { if (s[el.dataset.game] === false) el.remove(); });
  }
  root.RandoRoll = { SHOWN_KEY: SHOWN_KEY, SHOWABLE: SHOWABLE, shown: shown, setShown: setShown, isShown: isShown, applyShown: applyShown, ALL: ALL, gamesMenu: gamesMenu, GAMES: GAMES, KEY: KEY, allowed: allowed, setAllowed: setAllowed, pool: pool, pick: pick, go: go, url: url, name: name, others: others, get base() { return base; }, set base(b) { base = b; } };
})(window);
