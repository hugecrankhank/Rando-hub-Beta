/*
 * mudora.js — the heart of Mudora, Rando Hub's own tracker.
 *
 * Logic: Hutch's, unchanged. Rando Hub runs his item tracker and map (in
 * tracker/) out of sight, and Mudora reads their answers: which checks are
 * in logic (window.checkColor on his map), which are cleared, each dungeon's
 * colour, and his item tracker's snapshot of items, keys and prizes (the
 * 'alttp-tracker' BroadcastChannel his own broadcast view and checklist use).
 * Clicks go back the same way: a toggle-check message, or a click on his
 * item tracker's own button. None of his pictures are shown.
 *
 * Pictures: all from the game being played.
 *   - item icons: cut from the game's own pause menu (iconworker.js)
 *   - the Light and Dark World: drawn from the ROM (../emotracker/romap.js)
 *   - dungeon maps: ../emotracker/dungeons.js
 *   - where each check is: the game's own door, hole and sprite positions,
 *     read from the ROM (CHECK_AT below, in game pixels, 4096 per world)
 *
 * window.Mudora is what ui.js draws from.
 */
(function () {
  'use strict';
  var M = window.Mudora = {
    game: null, icons: {}, iconState: 'none', romMaps: null,
    items: null, colors: {}, cleared: {}, dcolors: {}, dcleared: {}, checks: [], dungeons: {}, linked: false,
  };
  var subs = [];
  M.on = function (fn) { subs.push(fn); };
  function emit(what) { subs.forEach(function (fn) { try { fn(what); } catch (e) { console.warn('[mudora]', e); } }); }
  M.emit = emit;
  // Mudora 2.0 (../mudora2/) shares everything here but the logic: it sets
  // MUDORA_LOGIC = 'mfns' first and brings its own (mudora2.js).
  var HUTCH = window.MUDORA_LOGIC !== 'mfns';
  M.base = HUTCH ? '' : '../mudora/';

  // Where each check is in the game (doors, holes, items and people on the
  // screen, from the ROM). Checks not listed keep Hutch's own spot.
  var CHECK_AT = {"0":[2464,1220],"1":[1920,3828],"2":[2240,2820],"3":[3264,372],"5":[656,2340],"6":[400,2212],"9":[816,3380],"12":[3328,1860],"13":[2352,596],"14":[88,1736],"15":[528,1716],"17":[3536,884],"18":[1600,1204],"19":[2672,3844],"20":[3664,3156],"22":[3408,276],"65":[392,1896],"66":[3368,1836],"68":[640,2196],"71":[1720,72],"75":[1664,772],"76":[3280,1364],"77":[776,536],"78":[1224,296],"79":[2000,596],"81":[2336,1124],"82":[720,3188],"84":[640,2692],"86":[2088,360],"87":[3320,56],"89":[104,3752],"90":[2968,3384],"97":[2440,1704],"99":[1888,1092],"100":[1320,2312],"105":[3696,548],"4":[3456,372],"7":[448,2388],"8":[848,1972],"10":[160,3284],"11":[3456,596],"16":[2448,3188],"67":[1256,2808],"69":[1240,2136],"72":[888,3768],"64":[208,1908],"83":[1296,2484],"91":[1416,648],"92":[2376,1832],"101":[1248,2180],"102":[1920,1988],"88":[120,2872],"74":[3908,530],"94":[3950,556]};
  var DUNGEON_AT = {"ep":[3936,1588],"dp":[304,3268],"toh":[2304,132],"ct":[2048,1636],"pod":[3936,1604],"sp":[1920,3828],"sw":[160,212],"tt":[512,1988],"ip":[3264,3540],"mm":[304,3300],"tr":[3856,324],"gt":[2304,68]};
  // Second pins for a check that has two places to go: the purple chest is
  // found in the Dark World and opened by the man by the sign in the Light World.
  var ALSO = [{ id: 69, world: 'lw', at: [1400, 3672], name: 'Purple Chest: the man who opens it' }];
  M.CHECK_AT = CHECK_AT; M.DUNGEON_AT = DUNGEON_AT; M.ALSO = ALSO;

  // ── finding Rando Hub's pieces ────────────────────────────────────────────
  function up(fn) {
    var w = window, seen = [];
    for (var i = 0; i < 6 && w && seen.indexOf(w) < 0; i++) {
      seen.push(w);
      try { var r = fn(w); if (r) return r; } catch (e) {}
      try { w = w.parent && w.parent !== w ? w.parent : w.opener; } catch (e) { w = null; }
    }
    return null;
  }
  M.bridge = function () { var b = up(function (w) { return w.AlttpBridge; }); return b && b.ready && b.ready() ? b : null; };
  M.player = function () { return up(function (w) { return w.Snes9xPlayer; }); };
  // Hutch's two pages, running hidden in Rando Hub
  function frameWin(id) {
    return up(function (w) {
      var f = w.document && w.document.getElementById(id), c = f && f.contentWindow;
      return c && f.getAttribute('src') && f.getAttribute('src') !== 'about:blank' ? c : null;
    });
  }
  M.mapWin = function () { var w = frameWin('map-frame'); return w && w.checkColor ? w : null; };
  M.itemsWin = function () { var w = frameWin('items-frame'); return w && w.document && w.document.querySelector('[data-item-key]') ? w : null; };

  // dungeons.js (shared with the EmoTracker page) asks for these
  window.EmoWeb = { bridge: function () { return M.bridge(); }, get game() { return M.game; } };

  // ── Hutch's answers ───────────────────────────────────────────────────────
  var bc = null;
  if (HUTCH) try { bc = new BroadcastChannel('alttp-tracker'); } catch (e) {}
  if (bc) bc.onmessage = function (ev) {
    var d = ev.data;
    if (!d) return;
    if (d.type === 'items' && d.data) { M.items = d.data; emit('items'); }
    else if (d.type === 'dungeoncolors' && d.data) { M.dcolors = d.data; emit('dungeons'); }
    else if (d.type === 'checkcolors') poll();
    else if (d.type === 'newgame') { M.items = null; poll(); emit('items'); }
  };
  function ask() { try { bc && bc.postMessage({ type: 'requestSnap' }); } catch (e) {} }
  if (HUTCH) try { M.dcolors = JSON.parse(localStorage.getItem('alttp-dungeon-colors') || '{}'); } catch (e) {}

  var lastSig = '';
  function poll() {
    var mw = M.mapWin();
    var was = M.linked;
    M.linked = !!mw;
    if (was !== M.linked) emit('link');
    if (!mw) return;
    var colors = {}, cleared = {}, list = [];
    // Hutch's entrance-shuffle overlay: on when his map shows it
    var mapsEl = mw.document && mw.document.getElementById('maps');
    var entOn = !!(mapsEl && !mapsEl.classList.contains('entrances-hidden') && mw._entMarkers);
    try {
      var C = mw.CHECKS || [], st = mw.checkState || {};
      C.forEach(function (c) {
        var id = c[0];
        var col = null;
        try { col = mw.checkColor(id); } catch (e) { col = 'red'; }
        colors[id] = col;
        if (st[id]) cleared[id] = true;
        var dot = entOn && mw.dotById && mw.dotById[id];
        list.push({ id: id, x: c[1], y: c[2], name: c[3], world: c[4], hidden: !!(dot && dot.dataset.entHidden === '1') });
      });
      var D = mw.DUNGEONS || {}, dc = {}, dd = {};
      Object.keys(D).forEach(function (k) {
        try { dc[k] = mw.dungeonColor(k); } catch (e) { dc[k] = 'red'; }
        dd[k] = !!(D[k].cleared || D[k].fullyCleared);
      });
      M.dungeons = D;
      var dh = {};
      if (entOn && mw.dngEls) Object.keys(D).forEach(function (k) { var e = mw.dngEls[k]; if (e && e.dataset.entHidden === '1') dh[k] = true; });
      var ents = entOn ? hutchEntrances(mw) : [];
      var sig = JSON.stringify([colors, cleared, dc, dd, ents, dh, list.map(function (c) { return c.hidden ? 1 : 0; }).join('')]);
      if (sig === lastSig && M.checks.length === list.length) return;
      lastSig = sig;
      M.checks = list; M.colors = colors; M.cleared = cleared; M.dcolors = dc; M.dcleared = dd;
      M.entrances = ents; M.dhidden = dh;
      emit('checks');
    } catch (e) { console.warn('[mudora] reading the map', e); }
  }
  if (HUTCH) {
    setInterval(poll, 400);
    setInterval(function () { if (!M.items) ask(); }, 1500);
    ask();
  }

  // ── entrances (Hutch's entrance-shuffle overlay) ──────────────────────────
  // Each of his entrance markers, drawn at the door's real spot (entrances.json),
  // in his colour; clicks and his entrance menu's choices go back to his map.
  var CSSCOL = {};
  function hutchEntrances(mw) {
    var E = M.entranceData, out = [], labels = mw._entLabels || {}, conns = mw._entConnections || [];
    var cols = hutchCodes(mw), byText = {};
    cols.forEach(function (g) { g.codes.forEach(function (c) { byText[c.text] = c; }); });
    Object.keys(mw._entMarkers).forEach(function (name) {
      var m = mw._entMarkers[name], world = m.parentElement && m.parentElement.id === 'dw' ? 'dw' : null;
      var real = E && E.doors[(E.aliases || {})[name] || name];
      var at = real ? { x: real.x, y: real.y } : { x: parseFloat(m.style.left) * 40.96, y: parseFloat(m.style.top) * 40.96 };
      var bg = '';
      try { bg = mw.getComputedStyle(m).backgroundColor; } catch (e) {}
      var lb = labels[name] || '';
      var linked = conns.filter(function (p) { return p[0] === name || p[1] === name; }).map(function (p) { return p[0] === name ? p[1] : p[0]; });
      out.push({ id: name, name: name, world: real ? real.world : (world || 'lw'), at: at, color: bg, done: m.classList.contains('cleared'),
        label: lb, labelColor: (byText[lb] || {}).color || '', shape: 'diamond', links: linked,
        pending: mw._entConnectPending === name });
    });
    return out;
  }
  var codeCache = null;
  function hutchCodes(mw) {
    if (codeCache && codeCache.w === mw) return codeCache.v;
    var v = [];
    try {
      mw.document.querySelectorAll('#ent-popup-cols > div').forEach(function (col) {
        var t = col.querySelector('.ent-popup-section-label'), g = { title: t ? t.textContent : '', codes: [] };
        col.querySelectorAll('.ent-popup-btn').forEach(function (b) { g.codes.push({ code: b.dataset.code, text: b.textContent, color: b.dataset.markColor || '' }); });
        v.push(g);
      });
    } catch (e) {}
    codeCache = { w: mw, v: v };
    return v;
  }
  if (HUTCH) {
    M.entCodes = function () { var mw = M.mapWin(); return mw ? hutchCodes(mw) : []; };
    function marker(mw, name) { return mw && mw._entMarkers && mw._entMarkers[name]; }
    function popup(mw, name) { var mk = marker(mw, name); if (!mk || !mw._entOpenPopup) return false; mw._entOpenPopup(name, mk, 0, 0); return true; }
    function after() { setTimeout(poll, 60); }
    // click: done / not done (his marker's own click)
    M.entClick = function (name) { var mw = M.mapWin(), mk = marker(mw, name); if (mk) fire(mk, 'click'); after(); };
    // a code from his entrance menu
    M.entLabel = function (name, code) {
      var mw = M.mapWin(); if (!popup(mw, name)) return;
      var b = mw.document.querySelector('#ent-popup-cols .ent-popup-btn[data-code="' + code + '"]');
      if (b) b.click(); else { var p = mw.document.getElementById('ent-popup'); if (p) p.classList.remove('open'); }
      after();
    };
    M.entClear = function (name) { var mw = M.mapWin(); if (!popup(mw, name)) return; var b = mw.document.getElementById('ent-popup-clear'); if (b) b.click(); after(); };
    // a connector: one end, then the other
    M.entConnectStart = function (name) {
      var mw = M.mapWin(); if (!popup(mw, name)) return;
      if (mw._entConnectPending !== name) { var b = mw.document.getElementById('ent-popup-connect'); if (b) b.click(); }
      else { var p = mw.document.getElementById('ent-popup'); if (p) p.classList.remove('open'); }
      after();
    };
    M.entPending = function () { var mw = M.mapWin(); return mw ? mw._entConnectPending : null; };
    M.entConnectTo = function (name) { var mw = M.mapWin(); if (mw && mw._entConnectPending && mw._entConnectFinish) mw._entConnectFinish(name, marker(mw, name)); after(); };
    M.entCancel = function () { var mw = M.mapWin(); var mk = mw && marker(mw, mw._entConnectPending); if (mk) mk.classList.remove('connect-pending'); if (mw) mw._entConnectPending = null; after(); };
    M.entUnlink = function (name, other) {
      var mw = M.mapWin(); if (!popup(mw, name)) return;
      var rows = mw.document.querySelectorAll('#ent-popup-connections .ent-popup-conn-row');
      for (var i = 0; i < rows.length; i++) {
        var sp = rows[i].querySelector('span[style]');
        if (sp && sp.textContent.indexOf(other) === 0) { var b = rows[i].querySelector('.danger'); if (b) b.click(); break; }
      }
      var p = mw.document.getElementById('ent-popup'); if (p) p.classList.remove('open');
      after();
    };

    // automatic: where a door led (entrack.js) → his code, or a connector to
    // the other door of the same cave once both are known
    var known = {};
    function knownKey() { return 'rhb-mudora-ent-' + (M.game || 'nogame'); }
    M.on(function (w) { if (w === 'game') { try { known = JSON.parse(localStorage.getItem(knownKey()) || '{}'); } catch (e) { known = {}; } } });
    M.on(function (w) {
      if (!w || !w.entrance) return;
      var ev = w.entrance, mw = M.mapWin(), E = M.entranceData;
      if (!mw || !E || !marker(mw, hutchName(ev.door))) return;
      var mapsEl = mw.document.getElementById('maps');
      if (!mapsEl || mapsEl.classList.contains('entrances-hidden')) return;   // not an entrance seed
      var door = hutchName(ev.door), inside = ev.to[0], info = E.insides[inside] || {};
      known[door] = inside;
      try { localStorage.setItem(knownKey(), JSON.stringify(known)); } catch (e) {}
      if (info.cave) {
        Object.keys(known).forEach(function (other) {
          if (other === door || (E.insides[known[other]] || {}).cave !== info.cave) return;
          var conns = mw._entConnections || [];
          if (conns.some(function (p) { return (p[0] === door && p[1] === other) || (p[0] === other && p[1] === door); })) return;
          if (!popup(mw, door)) return;
          var b = mw.document.getElementById('ent-popup-connect'); if (b) b.click();
          if (mw._entConnectPending === door) mw._entConnectFinish(other, marker(mw, other));
        });
      } else if (info.hutch && !(mw._entLabels || {})[door]) {
        M.entLabel(door, info.hutch);
      }
      after();
    });
  }
  function hutchName(n) {
    var A = (M.entranceData && M.entranceData.aliases) || {};
    for (var k in A) if (A[k] === n) return k;
    return n;
  }

  // where a check sits, in game pixels
  M.checkAt = function (c) { var p = CHECK_AT[c.id]; return p ? { x: p[0], y: p[1] } : { x: c.x * 40.96, y: c.y * 40.96 }; };
  M.dungeonAt = function (k) {
    var p = DUNGEON_AT[k], d = M.dungeons[k];
    if (p) return { x: p[0], y: p[1] };
    return d ? { x: d.left * 40.96, y: d.top * 40.96 } : null;
  };

  // ── sending clicks back ───────────────────────────────────────────────────
  M.toggleCheck = function (id, on) {
    M.cleared[id] = !!on; emit('checks');
    try { bc && bc.postMessage({ type: 'toggle-check', id: id, cleared: !!on }); } catch (e) {}
    try { localStorage.setItem('alttp-check-toggle', JSON.stringify({ id: id, cleared: !!on, t: Date.now() })); } catch (e) {}
    setTimeout(poll, 80);
  };
  function fire(el, type) {
    if (!el) return false;
    var w = el.ownerDocument.defaultView;
    el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, view: w, button: type === 'contextmenu' ? 2 : 0 }));
    return true;
  }
  // an item: forward one step, or back one (Hutch's button only goes forward, so round the cycle)
  M.stepItem = function (key, dir) {
    var iw = M.itemsWin(); if (!iw) return false;
    var el = iw.document.querySelector('[data-item-key="' + key + '"]'); if (!el) return false;
    var n = 1;
    if (dir < 0) { try { n = iw.eval('items')[key].states.length - 1; } catch (e) { n = 1; } }
    for (var i = 0; i < n; i++) fire(el, 'click');
    setTimeout(ask, 60);
    return true;
  };
  M.itemInfo = function (key) { var iw = M.itemsWin(); try { return iw.eval('items')[key]; } catch (e) { return null; } };
  M.medallion = function (key) {   // right click: which of Misery Mire / Turtle Rock it opens
    var iw = M.itemsWin(); if (!iw) return;
    fire(iw.document.querySelector('[data-item-key="' + key + '"]'), 'contextmenu');
    setTimeout(ask, 60);
  };
  // a dungeon's own buttons on Hutch's item tracker
  M.dungeonAct = function (k, part, dir) {
    var iw = M.itemsWin(); if (!iw) return false;
    var slot = iw.document.querySelector('.dungeon-slot[data-dungeon-key="' + k + '"], .ct-group[data-dungeon-key="' + k + '"]');
    if (!slot) return false;
    if (part === 'boss') return false;   // Hutch's tracker has no boss to pick: Mudora keeps it
    // which prize it is: his right click goes forward through the five; back is four forward
    if (part === 'prizeType') {
      var pe = slot.querySelector('.prize-img'), ok2 = true;
      for (var n = dir < 0 ? 4 : 1; n > 0; n--) ok2 = fire(pe, 'contextmenu') && ok2;
      setTimeout(ask, 60);
      return ok2;
    }
    var sel = { chest: '.count-item:not(.key-count-item)', key: '.key-count-item', bigkey: '.bigkey-img', map: '.map-img', compass: '.compass-img', prize: '.prize-img' }[part];
    var el = part === 'prize' && dir > 0 ? slot : slot.querySelector(sel);
    var ok = fire(el, dir < 0 ? 'contextmenu' : 'click');
    setTimeout(ask, 60);
    return ok;
  };

  // ── which game (ROM) this is ──────────────────────────────────────────────
  function romHash(b) {
    try {
      var rom = b.read(0, 0x200000), h = 0x811c9dc5, any = 0;
      for (var i = 0; i < rom.length; i++) { h ^= rom[i]; h = Math.imul(h, 0x01000193) >>> 0; any |= rom[i]; }
      return any ? ('00000000' + h.toString(16)).slice(-8) : null;
    } catch (e) { return null; }
  }
  // Hashing reads 2 MB, so only when the game itself may have changed: a new
  // emulator core (a new ROM means a page reload or a new core), or a ROM
  // that looks different at a few spots, checked cheaply.
  var lastCore = null, lastPeek = '';
  function peek(b) { try { var a = b.read(0x7FC0, 64), c = b.read(0x7FFC0, 32); return Array.prototype.join.call(a, ',') + '|' + Array.prototype.join.call(c, ','); } catch (e) { return ''; } }
  function checkGame() {
    var b = M.bridge(), P = M.player(), core = P && P.core;
    if (!b) return;
    var pk = peek(b);
    if (core === lastCore && pk === lastPeek && M.game) return;
    lastCore = core; lastPeek = pk;
    var g = romHash(b);
    if (!g || g === M.game) return;
    M.game = g;
    emit('game');
    loadMaps(b, g);
    loadIcons(g);
  }
  setInterval(checkGame, 3000);
  setTimeout(checkGame, 300);

  // ── keeping pictures (IndexedDB) ──────────────────────────────────────────
  function db(name, store) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(name, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(store); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function get(name, store, k) {
    return db(name, store).then(function (d) { return new Promise(function (res) { var q = d.transaction(store).objectStore(store).get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; });
  }
  function put(name, store, k, v) {
    return db(name, store).then(function (d) {
      var st = d.transaction(store, 'readwrite').objectStore(store);
      st.put(v, k);
      var all = st.getAllKeys();
      all.onsuccess = function () { var ks = all.result || []; if (ks.length > 6) ks.slice(0, ks.length - 6).forEach(function (x) { if (x !== k) st.delete(x); }); };
    }).catch(function () {});
  }

  // both worlds, drawn from the ROM — the same cache as the EmoTracker page
  function useMaps(m) {
    if (M.romMaps) { try { M.romMaps.light.concat(M.romMaps.dark).forEach(function (u) { URL.revokeObjectURL(u); }); } catch (e) {} }
    M.romMaps = null;
    if (m && m.light && m.dark && m.light.length === 64 && m.dark.length === 64) {
      M.romMaps = { light: m.light.map(function (b) { return URL.createObjectURL(b); }), dark: m.dark.map(function (b) { return URL.createObjectURL(b); }) };
    }
    emit('maps');
  }
  function loadMaps(b, g) {
    get('rhb-emo-maps', 'maps', 'v4-' + g).then(function (hit) {
      if (M.game !== g) return;
      if (hit && hit.light && hit.dark) { useMaps(hit); return; }
      var rom; try { rom = b.read(0, 0x200000); } catch (e) { return; }
      setTimeout(function () {
        var job = null;
        try { job = window.RoMap && window.RoMap.render(rom); } catch (e) {}
        if (!job) { toast('This ROM isn’t one Mudora can draw maps from (it needs an ALTTP JP 1.0 based ROM).'); return; }
        job.then(function (m) {
          if (M.game !== g) return;
          if (!m.light.concat(m.dark).every(function (x) { return x && x.size > 0; })) return;
          useMaps(m); put('rhb-emo-maps', 'maps', 'v4-' + g, m);
        });
      }, 200);
    });
  }

  // item icons, cut from the game's pause menu by a hidden emulator
  // The menu's black is made see-through, which also punched holes in the
  // crystals' dark facets: see-through pixels the outside can't reach are
  // put back as black.
  function fillHoles(px) {
    var out = new Uint8Array(256), q = [], i, x, y;
    for (i = 0; i < 16; i++) q.push(i, 240 + i, i * 16, i * 16 + 15);
    while (q.length) {
      i = q.pop();
      if (out[i] || px[i * 4 + 3]) continue;
      out[i] = 1; x = i & 15; y = i >> 4;
      if (x > 0) q.push(i - 1); if (x < 15) q.push(i + 1); if (y > 0) q.push(i - 16); if (y < 15) q.push(i + 16);
    }
    for (i = 0; i < 256; i++) if (!out[i] && !px[i * 4 + 3]) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 8; px[i * 4 + 3] = 255; }
    return px;
  }
  // the dungeon prizes, cropped to the picture itself so they fill a bigger box
  var TIGHT = { crystal: 1, crystal_red: 1, pendant_red: 1, pendant_blue: 1, pendant_green: 1 };
  function tightURL(px) {
    var x0 = 16, y0 = 16, x1 = -1, y1 = -1;
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) if (px[(y * 16 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    var w = x1 - x0 + 1, h = y1 - y0 + 1, n = Math.max(w, h);
    var cv = document.createElement('canvas'); cv.width = cv.height = n;
    var src = document.createElement('canvas'); src.width = src.height = 16;
    src.getContext('2d').putImageData(new ImageData(px, 16, 16), 0, 0);
    cv.getContext('2d').drawImage(src, x0, y0, w, h, Math.floor((n - w) / 2), Math.floor((n - h) / 2), w, h);
    return cv.toDataURL('image/png');
  }
  function useIcons(raw) {
    var out = {};
    var cv = document.createElement('canvas'); cv.width = cv.height = 16;
    var cx = cv.getContext('2d');
    Object.keys(raw).forEach(function (k) {
      var px = new Uint8ClampedArray(raw[k].slice ? raw[k].slice(0) : raw[k]);
      if (k === 'crystal' || k === 'crystal_red') fillHoles(px);   // not the pendants: their chain's loop isn't a hole
      cx.clearRect(0, 0, 16, 16);
      cx.putImageData(new ImageData(px, 16, 16), 0, 0);
      out[k] = (TIGHT[k] && tightURL(px)) || cv.toDataURL('image/png');
    });
    // a red crystal: the game's own (found in its menu), or else the crystal with its blues turned red
    if (raw.crystal && !raw.crystal_red) {
      var px = new Uint8ClampedArray(raw.crystal.slice ? raw.crystal.slice(0) : raw.crystal);
      for (var i = 0; i < px.length; i += 4) { if (px[i + 3] && px[i + 2] > px[i] + 20) { var t = px[i]; px[i] = px[i + 2]; px[i + 2] = t; } }
      fillHoles(px);
      out.crystal_red = tightURL(px) || out.crystal;
    }
    // Half Magic: the game only writes a 3-tile "1/2" label over the magic meter
    // (zelda3 hud.c Hud_Update_Magic), too wide for a square, so Mudora draws its
    // own: a pixel "1/2" in the meter's green, outlined in black.
    out.halfmagic = halfMagicIcon(cv, cx);
    M.icons = out; M.iconState = 'ready';
    emit('icons');
  }
  function halfMagicIcon(cv, cx) {
    var P = [
      '................',
      '..##.......##...',
      '.###......##....',
      '..##.....##.....',
      '..##....##......',
      '..##...##.......',
      '.####.##........',
      '.....##..####...',
      '....##..##..##..',
      '...##.......##..',
      '..##.......##...',
      '.##......##.....',
      '##......##......',
      '.......######...',
      '................',
      '................'];
    var px = new Uint8ClampedArray(16 * 16 * 4), on = function (x, y) { return y >= 0 && y < 16 && x >= 0 && x < 16 && P[y][x] === '#'; };
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var o = (y * 16 + x) * 4;
      if (on(x, y)) { var slash = x + y === 12 || x + y === 13; /* the stroke between 1 and 2: white */ px[o] = slash ? 220 : 33; px[o + 1] = slash ? 220 : 181; px[o + 2] = slash ? 220 : 33; px[o + 3] = 255; }
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { px[o + 3] = 255; }   // black outline
    }
    cx.clearRect(0, 0, 16, 16); cx.putImageData(new ImageData(px, 16, 16), 0, 0);
    return cv.toDataURL('image/png');
  }
  M._useIcons = useIcons;   // for tests: pictures as the worker sends them
  var iconJob = null;
  function loadIcons(g) {
    get('rhb-mudora', 'icons', 'v8-' + g).then(function (hit) {
      if (M.game !== g) return;
      if (hit && hit.crystal) { useIcons(hit); return; }
      var P = M.player(), core = P && P.core, rom = null;
      try { rom = core && core.rom().slice(); } catch (e) {}
      if (!rom || !rom.length) { M.iconState = 'norom'; emit('icons'); return; }
      if (iconJob) { try { iconJob.terminate(); } catch (e) {} }
      M.iconState = 'drawing'; emit('icons');
      var wk;
      try { wk = iconJob = new Worker(M.base + 'iconworker.js'); } catch (e) { M.iconState = 'failed'; emit('icons'); return; }
      wk.onmessage = function (ev) {
        try { wk.terminate(); } catch (e) {}
        if (iconJob === wk) iconJob = null;
        if (M.game !== g) return;
        if (ev.data && ev.data.dims) console.log('[mudora] menu pictures', JSON.stringify(ev.data.dims));
        if (ev.data && ev.data.icons) {
          var copy = {};   // keep a copy: the canvases below don't need the originals
          Object.keys(ev.data.icons).forEach(function (k) { copy[k] = ev.data.icons[k].slice(0); });
          put('rhb-mudora', 'icons', 'v8-' + g, copy);
          useIcons(ev.data.icons);
        } else { M.iconState = 'failed'; emit('icons'); console.warn('[mudora] icons', ev.data && ev.data.error); }
      };
      wk.onerror = function () { M.iconState = 'failed'; emit('icons'); };
      wk.postMessage({ rom: rom.buffer }, [rom.buffer]);
    });
  }

  // ── marks: which item you've seen at a check (per game) ───────────────────
  M.marks = {};
  function marksKey() { return 'rhb-mudora-marks-' + (M.game || 'nogame'); }
  M.on(function (w) { if (w === 'game') { try { M.marks = JSON.parse(localStorage.getItem(marksKey()) || '{}'); } catch (e) { M.marks = {}; } } });
  M.mark = function (id, icon) {
    if (icon) M.marks[id] = icon; else delete M.marks[id];
    try { localStorage.setItem(marksKey(), JSON.stringify(M.marks)); } catch (e) {}
    emit('checks');
  };

  // dungeons hold a list of revealed items ("hammer,lamp"), shown on the dungeon's
  // square and in the dungeon list
  M.dmarks = function (dk) { var v = M.marks['dg:' + dk]; return v ? String(v).split(',').filter(Boolean) : []; };
  M.dmark = function (dk, icon) {
    var l = M.dmarks(dk); if (icon && l.indexOf(icon) < 0) l.push(icon);
    M.mark('dg:' + dk, l.join(','));
  };

  // ── Crowd Control's "Reveal a go-mode item" (crowd/effects.js) ────────────
  // The game page sends { loc, region, item, icon }: the spoiler's spot. Which
  // square holds it: Mudora 2.0 knows exactly (M.revealSquare, Muffins' data);
  // otherwise the dungeon from the spot's name or region, or Hutch's square by
  // name. Dungeons get the item in their list; other squares a mark.
  var DG_RE = [['hc', /hyrule castle|sewers|escape/i], ['ep', /eastern palace/i], ['dp', /desert palace/i],
    ['toh', /tower of hera|mountain tower/i], ['ct', /castle tower|agahnim'?s tower|^agahnim\b/i],
    ['pod', /palace of darkness|dark palace/i], ['sp', /swamp palace/i], ['sw', /skull woods/i],
    ['tt', /thieves'? ?town/i], ['ip', /ice palace/i], ['mm', /misery mire/i], ['tr', /turtle rock/i],
    ['gt', /ganon'?s ?tower/i]];
  var RV_ALIAS = { pegasusrocks: 'bonkrockcave', bumpercave: 'bumpercaveledge', graveyardledge: 'graveyardcave', hammerpegs: 'pegcave' };
  function nrm(x) { return String(x || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, ''); }
  function guessSquare(m) {
    var txt = m.loc + ' | ' + (m.region || '');
    for (var i = 0; i < DG_RE.length; i++) {
      if (DG_RE[i][1].test(m.loc) || (DG_RE[i][1].test(m.region || '') && !/^(light|dark) world$/i.test(m.region || ''))) return 'dg:' + DG_RE[i][0];
    }
    // an overworld square: same name as the spot, or as the spot's first part ("Kakariko Well - Top")
    var full = nrm(m.loc), head = nrm(String(m.loc).split(' - ')[0]);
    full = RV_ALIAS[full] || full; head = RV_ALIAS[head] || head;
    var hit = null;
    (M.checks || []).some(function (c) { var n = nrm(c.name); if (n && (n === full || n === head)) { hit = c.id; return true; } return false; });
    return hit;
  }
  var revealQ = [];
  M.reveal = function (m) {
    if (!M.checks || !M.checks.length) { revealQ.push(m); return; }      // the tracker isn't ready yet
    var sq = (M.revealSquare && M.revealSquare(m)) || guessSquare(m);
    if (sq && String(sq).indexOf('dg:') === 0) M.dmark(String(sq).slice(3), m.icon);
    else if (sq && m.icon) M.mark(sq, m.icon);
    M.toast('\ud83d\udd2e ' + m.item + ' is at ' + m.loc + (sq ? '' : ' (not on this map)'));
  };
  M.on(function () { if (revealQ.length && M.checks && M.checks.length) { var q = revealQ; revealQ = []; q.forEach(M.reveal); } });
  try { new BroadcastChannel('rando-hub-reveal').onmessage = function (ev) { if (ev.data && ev.data.type === 'reveal') M.reveal(ev.data); }; } catch (e) {}

  var toastT = null;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, 6000);
  }
  M.toast = toast;
  M.poll = poll; M.ask = ask;
})();
