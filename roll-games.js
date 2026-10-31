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
  // opts: { always: shown at every size (the hub), confirm(name) → false to stay,
  //         label: the closed menu's text, shortLabel: the same on phones }
  function gamesMenu(currentUrl, linkIds, extras, opts) {
    opts = opts || {};
    var sel = document.createElement('select');
    sel.className = 'btn'; sel.id = 'hub-games'; sel.setAttribute('aria-label', 'Games');
    sel.style.cssText = '-webkit-appearance: none; appearance: none; padding-right: 10px; display: ' + (opts.always ? 'inline-flex' : 'none') + '; max-width: 104px; text-overflow: ellipsis;';
    var phone = window.matchMedia(PHONE_MQ);
    function fill() {
      var s = shown();
      var others = ALL.filter(function (x) { return x[0] !== currentUrl; });
      var on = others.filter(function (x) { return s[x[2]]; }), off = others.filter(function (x) { return !s[x[2]]; });
      var label = phone.matches && opts.shortLabel ? opts.shortLabel : (opts.label || 'Games ▾');
      sel.innerHTML = '<option value="">' + label + '</option>' +
        '<optgroup label="Games">' +
        on.map(function (x) { return '<option value="' + base + x[0] + '">' + x[1] + '</option>'; }).join('') +
        '</optgroup>' + (off.length ? '<optgroup label="Add a game">' + off.map(function (x) { return '<option value="add:' + x[2] + '">+ ' + x[1] + '</option>'; }).join('') + '</optgroup>' : '') +
        '<optgroup label="──────"><option value="manage">⚙ Manage games…</option></optgroup>';
    }
    fill();
    if (phone.addEventListener) phone.addEventListener('change', fill);
    window.addEventListener('storage', function (e) { if (e.key === SHOWN_KEY) fill(); });
    document.body.addEventListener('rh-games-shown', fill); document.body.addEventListener('rh-games-changed', fill);
    sel.addEventListener('change', function () {
      var v = sel.value; sel.value = '';
      if (!v) return;
      if (v === 'manage') { manage(currentUrl); return; }
      var target = ALL.filter(function (x) { return base + x[0] === v || 'add:' + x[2] === v; })[0];
      if (opts.confirm && !opts.confirm(target ? target[1] : '')) return;
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
      '@media ' + PHONE_MQ + ' { ' + (hide.length ? hide.join(', ') + ' { display: none !important; } ' : '') + '#hub-games { display: inline-flex !important; } .hub-short { display: none; } #new-seed .ns-caret { display: inline; } }' +
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

  // ── Manage games: which are shown, and "Offload" to clear a game's stored ──
  // ROM and seed (the big things) when you're done with it. Saves stay.
  // Each game keeps its ROM in its own IndexedDB (a 'kv' store); the hub's
  // (Zelda 3) holds other things too, so only its ROM keys are cleared.
  var STORES = {
    z3: [{ db: 'rhb-beta-s9x-kara', keys: ['base-jp10', 'resume-state', 'pending-rom'] }, { db: 'alttpr-s9x-kara', keys: ['base-jp10', 'resume-state', 'pending-rom'] }],
    z1: [{ db: 'z1r-unified' }], glr: [{ db: 'glr' }], ff6: [{ db: 'ff6wc' }], smrpg: [{ db: 'smrpg' }], sm: [{ db: 'smr' }],
    ff1: [{ db: 'ffr-ff1' }], ff4: [{ db: 'ffr-ff4' }], ff5: [{ db: 'ffr-ff5' }],
    patched: [{ db: 'rhb-beta-patched', store: 'games' }, { db: 'rhb-beta-patched', store: 'bases' }],
  };
  function dbList() {
    if (indexedDB.databases) return indexedDB.databases().then(function (l) { return l.map(function (d) { return d.name; }); }).catch(function () { return null; });
    return Promise.resolve(null);
  }
  // open an existing database without creating it
  function openDb(name, names) {
    return new Promise(function (resolve) {
      if (names && names.indexOf(name) < 0) return resolve(null);
      var r;
      try { r = indexedDB.open(name); } catch (e) { return resolve(null); }
      r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} resolve(null); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = r.onblocked = function () { resolve(null); };
    });
  }
  function sizeOf(v) {
    if (v == null) return 0;
    if (v instanceof ArrayBuffer) return v.byteLength;
    if (ArrayBuffer.isView(v)) return v.byteLength;
    if (typeof Blob !== 'undefined' && v instanceof Blob) return v.size;
    if (typeof v === 'string') return v.length;
    if (typeof v === 'object') { var n = 0; for (var k in v) n += sizeOf(v[k]); return n; }
    return 8;
  }
  function measure(spec, names) {
    return openDb(spec.db, names).then(function (db) {
      if (!db) return 0;
      var store = spec.store || 'kv';
      if (!db.objectStoreNames.contains(store)) { db.close(); return 0; }
      return new Promise(function (resolve) {
        var n = 0, t = db.transaction(store), c = t.objectStore(store).openCursor();
        c.onsuccess = function () { var cur = c.result; if (!cur) return; if (!spec.keys || spec.keys.indexOf(cur.key) >= 0) n += sizeOf(cur.value); cur.continue(); };
        t.oncomplete = function () { db.close(); resolve(n); };
        t.onerror = t.onabort = function () { db.close(); resolve(n); };
      });
    });
  }
  function clearStore(spec, names) {
    return openDb(spec.db, names).then(function (db) {
      if (!db) return;
      var store = spec.store || 'kv';
      if (!db.objectStoreNames.contains(store)) { db.close(); return; }
      return new Promise(function (resolve) {
        var t = db.transaction(store, 'readwrite'), st = t.objectStore(store);
        if (spec.keys) spec.keys.forEach(function (k) { st.delete(k); }); else st.clear();
        t.oncomplete = t.onerror = t.onabort = function () { db.close(); resolve(); };
      });
    });
  }
  function gameSize(id, names) { return Promise.all((STORES[id] || []).map(function (sp) { return measure(sp, names); })).then(function (a) { return a.reduce(function (x, y) { return x + y; }, 0); }); }
  function offload(id, names) { return Promise.all((STORES[id] || []).map(function (sp) { return clearStore(sp, names); })); }
  function fmt(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB'; }
  function manage(currentUrl) {
    var old = document.getElementById('rh-manage'); if (old) old.remove();
    var cur = ALL.filter(function (x) { return x[0] === currentUrl; })[0];
    var wrap = document.createElement('div'); wrap.id = 'rh-manage';
    wrap.innerHTML = '<style>#rh-manage { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 12px; }' +
      '#rh-manage .box { background: #111; color: #e6edf3; border: 2px solid #3a6df0; border-radius: 8px; width: min(520px, 100%); max-height: 100%; overflow: auto; padding: 14px 16px 12px; font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.6); }' +
      '#rh-manage h3 { margin: 0 0 4px; font-size: 17px; color: #ffd166; } #rh-manage p { margin: 0 0 10px; color: #9aa4b2; font-size: 12.5px; }' +
      '#rh-manage table { width: 100%; border-collapse: collapse; } #rh-manage td { padding: 6px 4px; border-top: 1px solid #2a3140; vertical-align: middle; }' +
      '#rh-manage td.n { white-space: nowrap; } #rh-manage td.sz { color: #9aa4b2; font-size: 12.5px; text-align: right; white-space: nowrap; }' +
      '#rh-manage label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; } #rh-manage input { width: 16px; height: 16px; }' +
      '#rh-manage button { background: #1b2130; color: #e6edf3; border: 1px solid #3a4556; border-radius: 6px; padding: 5px 10px; font: inherit; cursor: pointer; } #rh-manage button:disabled { opacity: .4; cursor: default; }' +
      '#rh-manage button.off { color: #ff9f9f; } #rh-manage .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 12.5px; color: #9aa4b2; }</style>' +
      '<div class="box" role="dialog" aria-label="Manage games"><h3>Games</h3>' +
      '<p>Tick the games you play: they show in the Games menu, the Game row and the reroll list. <b>Offload</b> clears a game’s stored ROM and seed to free space; its saves stay, and it’s back once you add it again and pick the ROM.</p>' +
      '<table></table><div class="foot"><span class="tot"></span><button type="button" class="close">Done</button></div></div>';
    document.body.appendChild(wrap);
    var tbl = wrap.querySelector('table');
    function paint(names) {
      var s = shown();
      tbl.innerHTML = ALL.map(function (x) {
        var id = x[2], here = cur && cur[2] === id;
        return '<tr data-id="' + id + '"><td class="n"><label><input type="checkbox" data-shown="' + id + '"' + (s[id] !== false ? ' checked' : '') + (id === 'z3' ? ' disabled' : '') + '> ' + x[1] + (here ? ' <small>(this page)</small>' : '') + '</label></td>' +
          '<td class="sz">…</td><td><button type="button" class="off" data-off="' + id + '" disabled>Offload</button></td></tr>';
      }).join('');
      ALL.forEach(function (x) {
        gameSize(x[2], names).then(function (n) {
          var tr = tbl.querySelector('tr[data-id="' + x[2] + '"]'); if (!tr) return;
          tr.querySelector('.sz').textContent = n ? fmt(n) + ' stored' : 'nothing stored';
          tr.querySelector('[data-off]').disabled = !n;
        });
      });
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { wrap.querySelector('.tot').textContent = e && e.usage ? 'This site uses ' + fmt(e.usage) + (e.quota ? ' of ' + fmt(e.quota) : '') : ''; }).catch(function () {});
    }
    dbList().then(paint);
    tbl.addEventListener('change', function (e) {
      var cb = e.target; if (!cb || !cb.dataset.shown) return;
      var s = shown(); s[cb.dataset.shown] = cb.checked; setShown(s);
      document.body.dispatchEvent(new CustomEvent('rh-games-changed'));
    });
    tbl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-off]') : null; if (!b) return;
      var id = b.dataset.off, g = ALL.filter(function (x) { return x[2] === id; })[0];
      if (!confirm('Offload ' + g[1] + '?\n\nIts stored ROM and seed are cleared (saves stay).' + (cur && cur[2] === id ? '\n\nYou’re on this game now: it keeps running, but there’ll be nothing to Continue next time until you pick the ROM again.' : ''))) return;
      b.disabled = true; b.textContent = 'Clearing…';
      dbList().then(function (names) { return offload(id, names); }).then(function () {
        b.textContent = 'Offload';
        var s = shown(); if (id !== 'z3' && !(cur && cur[2] === id)) { s[id] = false; setShown(s); document.body.dispatchEvent(new CustomEvent('rh-games-changed')); }
        return dbList().then(paint);
      });
    });
    function close() { wrap.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    wrap.querySelector('.close').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', esc);
  }

  // Hide a page's own game links for games that aren't shown: el.dataset.game = id
  function applyShown(rootEl) {
    var s = shown();
    (rootEl || document).querySelectorAll('[data-game]').forEach(function (el) { if (s[el.dataset.game] === false) el.remove(); });
  }
  root.RandoRoll = { SHOWN_KEY: SHOWN_KEY, SHOWABLE: SHOWABLE, shown: shown, setShown: setShown, isShown: isShown, applyShown: applyShown, ALL: ALL, gamesMenu: gamesMenu, manage: manage, gameSize: gameSize, offload: offload, GAMES: GAMES, KEY: KEY, allowed: allowed, setAllowed: setAllowed, pool: pool, pick: pick, go: go, url: url, name: name, others: others, get base() { return base; }, set base(b) { base = b; } };
})(window);
