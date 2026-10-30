/*
 * roll-games.js — which games a reroll may land on. Shared by the hub
 * (Zelda 3), Zelda 1, GLR, FF6 Worlds Collide, Super Mario RPG and Super Metroid: the games with a seed
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
    { id: 'smrpg', name: 'Super Mario RPG', url: 'smrpg/' },
    { id: 'sm', name: 'Super Metroid', url: 'sm/' },
  ];
  // where the hub is from this page (set by the page: '' on the hub, '../' in a game's folder)
  var base = (document.currentScript && document.currentScript.dataset.hub) || '';

  // "Games shown": which games appear in the Game row, the headers and the
  // reroll list at all (Zelda 3 always). Hidden games still work by address.
  var SHOWN_KEY = 'rando-hub-games-shown';
  var SHOWABLE = [['z1', 'Zelda 1'], ['glr', 'Guardian Legend'], ['ff1', 'FF1 Randomizer'], ['ff4', 'FF4 Free Enterprise'], ['ff5', 'FF5 Career Day'], ['ff6', 'FF6 Worlds Collide'], ['smrpg', 'Super Mario RPG'], ['sm', 'Super Metroid'], ['patched', 'Patched games']];
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
      a = { z3: true, z1: either, glr: false, ff6: false, smrpg: false, sm: false };
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
    ['ffr/ff5/', 'FF5 Career Day', 'ff5'], ['ff6wc/', 'FF6 Worlds Collide', 'ff6'], ['smrpg/', 'Super Mario RPG', 'smrpg'], ['sm/', 'Super Metroid', 'sm'], ['patched/', 'Patched games', 'patched']];
  // Returns a <select> that goes to any other game; the page shows it instead of
  // its row of link buttons when the header is too narrow for them (the ids
  // given are hidden then).
  // Phones (and short landscape screens): one "Games ▾" menu in place of the
  // row of game links, so New seed stays on screen. Games not ticked in the
  // hub's "Games shown" are listed under "Add a game": picking one adds it to
  // the shown games and goes there. The page's own header extras that don't fit
  // ("Play ROM file" on any page with a #rom-input, and `extras` [{id, label}]:
  // header buttons) move under the New seed button, which opens a small menu.
  var PHONE_MQ = '(max-width: 760px), (max-height: 560px)';
  function gamesMenu(currentUrl, linkIds, extras) {
    var sel = document.createElement('select');
    sel.className = 'btn'; sel.id = 'hub-games'; sel.setAttribute('aria-label', 'Other games');
    sel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px; display: none; max-width: 104px; text-overflow: ellipsis;';
    function fill() {
      var s = shown();
      var others = ALL.filter(function (x) { return x[0] !== currentUrl; });
      var on = others.filter(function (x) { return s[x[2]]; }), off = others.filter(function (x) { return !s[x[2]]; });
      sel.innerHTML = '<option value="">Games ▾</option>' +
        (off.length ? '<optgroup label="Games">' : '') +
        on.map(function (x) { return '<option value="' + base + x[0] + '">' + x[1] + '</option>'; }).join('') +
        (off.length ? '</optgroup><optgroup label="Add a game">' + off.map(function (x) { return '<option value="add:' + x[2] + '">+ ' + x[1] + '</option>'; }).join('') + '</optgroup>' : '');
    }
    fill();
    sel.addEventListener('change', function () {
      var v = sel.value; sel.value = '';
      if (!v) return;
      if (v.indexOf('add:') === 0) {
        var id = v.slice(4), g = ALL.filter(function (x) { return x[2] === id; })[0], s = shown();
        s[id] = true; setShown(s);
        if (g) location.href = base + g[0]; else fill();
        return;
      }
      location.href = v;
    });
    var acts = [];
    if (document.getElementById('rom-input')) acts.push({ id: 'rom-input', label: '📂 Play ROM file…', hide: 'header label[for="rom-input"]' });
    (extras || []).forEach(function (x) { acts.push({ id: x.id, label: x.label, hide: '#' + x.id }); });
    var css = document.createElement('style');
    var hide = linkIds.map(function (i) { return '#' + i; }).concat(acts.map(function (a) { return a.hide; }));
    css.textContent = '#new-seed .ns-caret { display: none; font-size: .8em; margin-left: 4px; }' +
      '@media ' + PHONE_MQ + ' { ' + hide.join(', ') + ' { display: none !important; } #hub-games { display: inline-flex !important; } .hub-short { display: none; } #new-seed .ns-caret { display: inline; } }' +
      '#ns-menu { position: fixed; z-index: 1000; min-width: 190px; background: #111; border: 2px solid #3a6df0; border-radius: 6px; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.6); display: flex; flex-direction: column; }' +
      '#ns-menu button { all: unset; display: block; padding: 11px 14px; font: inherit; font-size: 16px; color: #fff; cursor: pointer; border-radius: 4px; white-space: nowrap; }' +
      '#ns-menu button:active, #ns-menu button:hover { background: #24304f; }';
    document.head.appendChild(css);
    if (acts.length) setTimeout(function () { underNewSeed(acts); }, 0);
    return sel;
  }
  // On phones New seed opens a small menu: New seed, then the moved extras.
  function underNewSeed(acts) {
    var ns = document.getElementById('new-seed'); if (!ns || ns.dataset.nsMenu) return;
    ns.dataset.nsMenu = '1';
    var caret = document.createElement('span'); caret.className = 'ns-caret'; caret.textContent = '▾'; ns.appendChild(caret);
    var menu = null, pass = false;
    function close() { if (menu) { menu.remove(); menu = null; } document.removeEventListener('pointerdown', outside, true); }
    function outside(e) { if (menu && !menu.contains(e.target) && e.target !== ns && !ns.contains(e.target)) close(); }
    function item(label, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', function () { close(); fn(); }); return b; }
    ns.addEventListener('click', function (e) {
      if (pass || !window.matchMedia(PHONE_MQ).matches) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (menu) { close(); return; }
      menu = document.createElement('div'); menu.id = 'ns-menu'; menu.setAttribute('role', 'menu');
      menu.appendChild(item('✨ ' + (ns.firstChild && ns.firstChild.nodeType === 3 ? ns.firstChild.textContent.trim() : 'New seed'), function () { pass = true; try { ns.click(); } finally { pass = false; } }));
      acts.forEach(function (a) { menu.appendChild(item(a.label, function () { var el = document.getElementById(a.id); if (el) el.click(); })); });
      document.body.appendChild(menu);
      var r = ns.getBoundingClientRect();
      menu.style.top = Math.round(r.bottom + 6) + 'px';
      menu.style.left = Math.round(Math.max(6, Math.min(r.left, window.innerWidth - menu.offsetWidth - 6))) + 'px';
      setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    }, true);
  }

  // Hide a page's own game links for games that aren't shown: el.dataset.game = id
  function applyShown(rootEl) {
    var s = shown();
    (rootEl || document).querySelectorAll('[data-game]').forEach(function (el) { if (s[el.dataset.game] === false) el.remove(); });
  }
  root.RandoRoll = { SHOWN_KEY: SHOWN_KEY, SHOWABLE: SHOWABLE, shown: shown, setShown: setShown, isShown: isShown, applyShown: applyShown, ALL: ALL, gamesMenu: gamesMenu, GAMES: GAMES, KEY: KEY, allowed: allowed, setAllowed: setAllowed, pool: pool, pick: pick, go: go, url: url, name: name, others: others, get base() { return base; }, set base(b) { base = b; } };
})(window);
