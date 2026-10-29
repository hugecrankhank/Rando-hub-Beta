/*
 * Zelda 1 run timer (HydeOut, Oct 2026). ⏱ in the header shows it; tap for
 * Start / Pause, Reset, Auto and "Pop out" (timer.html, a window of its own
 * for OBS / TikTok LIVE Studio to capture).
 *
 * Real time from the moment a file is started (the game loads a save slot:
 * mode 2) to the moment Zelda is saved (mode $13, the ending), when Auto is on
 * (the default). It only starts on its own from 0:00, so loading a save state
 * or continuing never restarts it. The state is kept in localStorage
 * (z1r-timer), so a reload or the pop-out window keep counting the same run.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'z1r-timer';
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

  // the game: a file started (load a save slot) / Zelda saved (the ending)
  var lastMode = -1;
  function watch() {
    var p = window.EmuPlayer, c = p && p.core, r = c && c.wram ? c.wram() : null;
    if (!r || r.length < 0x800) return;
    var m = r[0x12];
    if (m !== lastMode) {
      if (T.auto && m === 0x02 && !T.start && ms() === 0) start();
      if (T.auto && m === 0x13 && T.start) finish();
      lastMode = m;
    }
  }

  var btn = null, menu = null;
  function paint() {
    if (!btn) return;
    btn.querySelector('b').textContent = fmt(ms(), false);
    btn.classList.toggle('run', !!T.start);
    btn.classList.toggle('done', T.done);
    if (menu) { var go = menu.querySelector('[data-t=go]'); if (go) go.textContent = T.start ? '⏸ Pause' : (ms() ? '▶ Resume' : '▶ Start'); }
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); } }
  function outside(e) { if (menu && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); }
  function popout() {
    var w = window.open('timer.html', 'z1r-timer', 'width=420,height=140');
    if (!w) alert('The pop-out was blocked: allow pop-ups for this site.');
  }
  function openMenu() {
    if (menu) { closeMenu(); return; }
    menu = document.createElement('div'); menu.id = 'z1t-menu';
    menu.innerHTML = '<div class="big"></div>' +
      '<button type="button" data-t="go"></button><button type="button" data-t="reset">↺ Reset</button>' +
      '<button type="button" data-t="pop">⧉ Pop out for stream</button>' +
      '<label><input type="checkbox" data-t="auto"> Auto: starts when a file is started, stops when Zelda is saved</label>';
    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect();
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
    var header = document.querySelector('header'); if (!header || $('z1-timer')) return;
    var st = document.createElement('style');
    st.textContent =
      '#z1-timer { font-variant-numeric: tabular-nums; white-space: nowrap; }' +
      '#z1-timer b { font-weight: inherit; margin-left: 4px; }' +
      '#z1-timer.run b { color: #7bff8e; } #z1-timer.done b { color: #ffd166; }' +
      '#z1t-menu { position: fixed; z-index: 1000; min-width: 230px; background: #111; border: 2px solid #3a6df0; border-radius: 6px; padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 6px; color: #fff; }' +
      '#z1t-menu .big { font: 700 30px/1 ui-monospace, monospace; text-align: center; padding: 4px 0 6px; font-variant-numeric: tabular-nums; }' +
      '#z1t-menu button { all: unset; display: block; padding: 9px 12px; border-radius: 4px; background: #1d2433; cursor: pointer; font-size: 15px; }' +
      '#z1t-menu button:hover { background: #24304f; }' +
      '#z1t-menu label { font-size: 12px; color: #aab; display: flex; gap: 6px; align-items: flex-start; }' +
      '@media (max-width: 760px), (max-height: 560px) { #z1-timer { display: none !important; } }';
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'z1-timer'; btn.className = 'btn';
    btn.innerHTML = '⏱<b>0:00:00</b>';
    btn.title = 'Run timer: tap for start / pause, reset and a pop-out window for the stream';
    btn.addEventListener('click', openMenu);
    var anchor = $('z1-die') || $('game-settings') || $('pad-status') || $('link-status');
    if (anchor && anchor.parentNode === header) header.insertBefore(btn, anchor); else header.appendChild(btn);
    paint();
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) { T = load(); paint(); } });
  setInterval(function () { if (!btn) build(); watch(); paint(); tickMenu(); }, 100);
  window.Z1Timer = { start: start, pause: pause, reset: reset, ms: ms, fmt: fmt, open: function () { if (!btn) build(); openMenu(); } };
})();
