/*
 * Run timer for the game pages (GLR, Super Metroid, Mario RPG, FF6, FF1, FF4,
 * FF5, Patched), the same as Zelda 1's (z1r/js/timer.js): ⏱ in the header
 * shows it; tap for Start / Pause, Reset, Auto and "Pop out" (run-timer.html,
 * a window of its own for OBS / TikTok LIVE Studio to capture).
 *
 * Each game keeps its own run (localStorage rh-timer-<game>), so a reload or
 * the pop-out window keep counting the same one. With Auto on (the default)
 * it starts by itself when a game is started from the title screen, only from
 * 0:00 (loading a save state or continuing never restarts it), and stops by
 * itself at the end where the game shows it:
 *   GLR: corridor 21 cleared · Super Metroid: Samus escapes Zebes ·
 *   FF4 Free Enterprise: the game's own "won" flag.
 * The others stop with ⏸ (or a split tool).
 *
 * Loaded with data-hub="../" (or "../../"), like game-header.js.
 */
(function () {
  'use strict';
  if (window.RunTimer || window.Z1Timer) return;
  var $ = function (id) { return document.getElementById(id); };
  var me = document.currentScript, HUB = (me && me.getAttribute('data-hub')) || '../';

  var path = location.pathname;
  var GAME = /\/glr\//.test(path) ? 'glr' : /\/smrpg\//.test(path) ? 'smrpg' : /\/sm\//.test(path) ? 'sm' : /\/metroid\//.test(path) ? 'metroid' : /\/smw\//.test(path) ? 'smw' : /\/smz3\//.test(path) ? 'smz3' : /\/zm\//.test(path) ? 'zm' : /\/cross\//.test(path) ? 'quad' :
    /\/ff6wc\//.test(path) ? 'ff6' : /\/ffr\/ff1\//.test(path) ? 'ff1' : /\/ffr\/ff4\//.test(path) ? 'ff4' :
    /\/ffr\/ff5\//.test(path) ? 'ff5' : /\/patched\//.test(path) ? 'patched' : null;
  if (!GAME) return;
  var NAMES = { glr: 'GLR', sm: 'Super Metroid', metroid: 'Metroid', smw: 'Super Mario World', smz3: 'SMZ3', zm: 'Zelda 1 + Metroid', quad: 'Rando Cross', smrpg: 'Mario RPG', ff6: 'FF6', ff1: 'FF1', ff4: 'FF4', ff5: 'FF5', patched: 'Patched' };
  var AUTO_TEXT = {
    glr: 'starts when a game is started, stops when corridor 21 is cleared',
    sm: 'starts when a game is started, stops when Samus escapes Zebes',
    metroid: 'starts when a game is started, stops at the ending (Mother Brain beaten, the escape made)',
    smw: 'starts when a game is started, stops when Bowser falls (the ending starts)',
    smz3: 'starts when a game is started, stops when the credits roll (Ganon and Mother Brain beaten)',
    zm: 'starts when a game is started, stops when both Ganon and Mother Brain have fallen',
    quad: 'starts when a game is started, stops when the seed’s goal is met (its final bosses beaten)',
    ff4: 'starts when a game is started, stops when the game is won',
  };
  var KEY = 'rh-timer-' + GAME;

  function load() {
    var s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    s = s || {};
    return { start: s.start || null, acc: +s.acc || 0, done: !!s.done, auto: s.auto !== false };
  }
  var T = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} }
  function ms() { return T.acc + (T.start ? Date.now() - T.start : 0); }
  function fmt(t, tenths) {
    t = Math.max(0, t);
    var h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + (tenths ? '.' + Math.floor(t / 100) % 10 : '');
  }
  function start() { if (!T.start) { T.start = Date.now(); T.done = false; save(); paint(); } }
  function pause() { if (T.start) { T.acc += Date.now() - T.start; T.start = null; save(); paint(); } }
  function reset() { T.start = null; T.acc = 0; T.done = false; save(); paint(); }
  function finish() { pause(); T.done = true; save(); paint(); }

  // ── the game: started from the title screen / the end ──────────────────────
  function wram() {
    var p = window.Snes9xPlayer && Snes9xPlayer.core ? Snes9xPlayer : window.EmuPlayer;
    var c = p && p.core; try { return c && c.wram ? c.wram() : null; } catch (e) { return null; }
  }
  // the trackers say 'live' once a real game is in memory, 'waiting' on the title screen
  var link = null;
  var TRACKER = { sm: 'SMRTracker', metroid: 'M1Tracker', smw: 'SMWTracker', smz3: 'SMZ3Tracker', zm: 'ZMTracker', quad: 'SMZ3Tracker', smrpg: 'SMRPGTracker', ff6: 'FF6Tracker', ff1: 'FFTracker', ff4: 'FFTracker', ff5: 'FFTracker' }[GAME];
  var hooked = false;
  function hook() {
    if (hooked || !TRACKER) return;
    var t = window[TRACKER]; if (!t || typeof t.onLink !== 'function') return;
    hooked = true; t.onLink(function (v) { link = v; });
  }
  function started() {
    if (GAME === 'glr') {
      var r = wram(); if (!r || r.length < 0x800) return null;
      return r[0x47] > 0 && r[0x52] < 24 && r[0x53] < 24;   // as glr/js/tracker.js
    }
    if (!TRACKER) return null;
    return link === 'live' ? true : link === 'waiting' ? false : null;
  }
  function won() {
    var r = wram(); if (!r) return false;
    if (GAME === 'glr') return r.length >= 0x800 && !!(r[0x4AB] & 0x10);         // corridor 21 cleared ($04A9 bit 20)
    if (GAME === 'sm') return r.length > 0x998 && (r[0x998] === 0x26 || r[0x998] === 0x27);   // escaping Zebes / ending
    if (GAME === 'metroid') return r.length >= 0x800 && r[0x1E] === 7 && link === 'live';      // MainRoutine 7: the ending
    if (GAME === 'smw') return r.length > 0x13C6 && r[0x100] >= 0x18 && r[0x100] <= 0x29 && r[0x13C6] >= 8 && link === 'live';   // the ending: a cutscene ($0100) numbered 8 ($13C6; 1–7 are the castles)
    if (GAME === 'smz3') { var t3 = window.SMZ3Tracker; return !!(t3 && t3.live && t3.live.game === 'credits') && link === 'live'; }   // the combo's credits ($A1:73FE neither game)
    if (GAME === 'zm') { var zl = window.ZMLink; return !!(zl && zl.state.won.z1 && zl.state.won.m1); }
    if (GAME === 'quad') { var ql = window.QuadLink; return !!(ql && ql.done); }   // the seed's goal (cross/js/link.js)
    if (GAME === 'ff4') return r.length > 0x151F && r[0x151F] === 1 && link === 'live';      // FE's victory flag
    return false;
  }
  var lastStarted = null, lastWon = null;
  function watch() {
    hook();
    var s = started();
    if (s !== null) {
      if (T.auto && s && lastStarted === false && !T.start && ms() === 0) start();
      lastStarted = s;
    }
    var w = s ? won() : false;
    if (T.auto && w && lastWon === false && T.start) finish();
    lastWon = w;
  }

  // ── the button and its menu ────────────────────────────────────────────────
  var btn = null, menu = null;
  function paint() {
    if (!btn) return;
    var f = fmt(ms(), false), b = btn.querySelector('b');
    // the hour in its own span: phones leave out a 0 hour, to fit the header
    b.innerHTML = '<i class="tm-h' + (f.charAt(0) === '0' ? ' z' : '') + '">' + f.slice(0, f.indexOf(':') + 1) + '</i>' + f.slice(f.indexOf(':') + 1);
    btn.classList.toggle('run', !!T.start);
    btn.classList.toggle('done', T.done);
    if (menu) { var go = menu.querySelector('[data-t=go]'); if (go) go.textContent = T.start ? '⏸ Pause' : (ms() ? '▶ Resume' : '▶ Start'); }
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); } }
  function outside(e) { if (menu && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); }
  function popout() {
    var w = window.open(HUB + 'run-timer.html?game=' + GAME, 'rh-timer-' + GAME, 'width=420,height=140');
    if (!w) alert('The pop-out was blocked: allow pop-ups for this site.');
  }
  function openMenu() {
    if (menu) { closeMenu(); return; }
    menu = document.createElement('div'); menu.id = 'rht-menu';
    menu.innerHTML = '<div class="nm">' + NAMES[GAME] + ' run</div><div class="big"></div>' +
      '<button type="button" data-t="go"></button><button type="button" data-t="reset">↺ Reset</button>' +
      '<button type="button" data-t="pop">⧉ Pop out for stream</button>' +
      '<label><input type="checkbox" data-t="auto"> Auto: ' + (AUTO_TEXT[GAME] || (GAME === 'patched' ? 'off for patched games: use Start' : 'starts when a game is started (stop it with ⏸)')) + '</label>';
    document.body.appendChild(menu);
    if (GAME === 'patched') menu.querySelector('label').hidden = true;
    var r = btn.getBoundingClientRect();
    if (!r.width) { var h = document.querySelector('header'); r = h ? h.getBoundingClientRect() : r; }
    menu.style.top = Math.round((r.bottom || 50) + 6) + 'px';
    menu.style.left = Math.round(Math.max(6, Math.min(r.left || 6, window.innerWidth - menu.offsetWidth - 6))) + 'px';
    menu.querySelector('[data-t=auto]').checked = T.auto;
    menu.addEventListener('click', function (e) {
      var t = e.target.dataset && e.target.dataset.t;
      if (t === 'go') { if (T.start) pause(); else { T.done = false; start(); } }
      else if (t === 'reset') { if (!ms() || confirm('Reset the timer to 0:00:00?')) reset(); }
      else if (t === 'pop') { popout(); closeMenu(); }
    });
    menu.querySelector('[data-t=auto]').addEventListener('change', function (e) { T.auto = e.target.checked; save(); });
    paint(); tickMenu();
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
  }
  function tickMenu() { if (menu) { var b = menu.querySelector('.big'); if (b) b.textContent = fmt(ms(), true); } }
  function build() {
    var header = document.querySelector('header'); if (!header || $('rh-timer')) return;
    var st = document.createElement('style');
    st.textContent =
      '#rh-timer { font-variant-numeric: tabular-nums; white-space: nowrap; }' +
      '#rh-timer b { font-weight: inherit; margin-left: 4px; }' +
      '#rh-timer.run b { color: #7bff8e; } #rh-timer.done b { color: #ffd166; }' +
      '#rht-menu { position: fixed; z-index: 1000; min-width: 230px; max-width: calc(100vw - 12px); background: #111; border: 2px solid #3a6df0; border-radius: 6px; padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 6px; color: #fff; font: 14px system-ui, sans-serif; }' +
      '#rht-menu .nm { font-size: 12px; color: #8b95a3; text-align: center; text-transform: uppercase; letter-spacing: .04em; }' +
      '#rht-menu .big { font: 700 30px/1 ui-monospace, monospace; text-align: center; padding: 2px 0 6px; font-variant-numeric: tabular-nums; }' +
      '#rht-menu button { all: unset; display: block; padding: 9px 12px; border-radius: 4px; background: #1d2433; cursor: pointer; font-size: 15px; }' +
      '#rht-menu button:hover { background: #24304f; }' +
      '#rht-menu label { font-size: 12px; color: #aab; display: flex; gap: 6px; align-items: flex-start; }' +
      // phones: the pages with a Games menu move it under New seed (roll-games.js); the rest show just the time
      '@media (max-width: 760px), (max-height: 560px) { #rh-timer .rht-i { display: none; } #rh-timer b { margin-left: 0; } #rh-timer .tm-h.z { display: none; } #rh-timer { padding-left: 5px !important; padding-right: 5px !important; font-size: .85em; } }' +
      '#rh-timer i { font-style: normal; }';
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'rh-timer'; btn.className = 'btn';
    btn.innerHTML = '<span class="rht-i">⏱</span><b>0:00:00</b>';
    btn.title = 'Run timer: tap for start / pause, reset and a pop-out window for the stream';
    btn.addEventListener('click', openMenu);
    // the FF pages on phones: no room in the header, so ⏱ Timer goes in their Games list
    var go = $('hub-go');
    if (go && go.tagName === 'SELECT') {
      var o = document.createElement('option'); o.value = 'rh-timer'; o.textContent = '⏱ Timer';
      go.insertBefore(o, go.options[1] || null);
      document.addEventListener('change', function (e) { if (e.target === go && go.value === 'rh-timer') { e.stopImmediatePropagation(); go.value = ''; openMenu(); } }, true);
      st.textContent += '@media (max-width: 760px), (max-height: 560px) { #rh-timer { display: none !important; } }';
    }
    var anchor = $('game-settings') || $('install-btn') || $('pad-status') || $('link-status') || $('lib-btn');
    if (anchor && anchor.parentNode === header) header.insertBefore(btn, anchor); else header.appendChild(btn);
    paint();
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) { T = load(); paint(); } });
  setInterval(function () { if (!btn) build(); watch(); paint(); tickMenu(); }, 100);
  window.RunTimer = { game: GAME, start: start, pause: pause, reset: reset, ms: ms, fmt: fmt, open: function () { if (!btn) build(); openMenu(); } };
})();
