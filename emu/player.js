/*
 * Snes9x player: runs the Snes9x core (emu/snes9x.wasm) inside the page's
 * game box, with the on-screen controller and an in-game menu overlaid on
 * the picture, the way EmulatorJS's were.
 *
 * The rest of the app was written against EmulatorJS, so once a game is
 * running this publishes window.EJS_emulator with the parts of that API the
 * app uses: gameManager.getState/loadState (Resume), pause/play/paused
 * (leaving and coming back), volume/muted/setVolume and
 * Module.AL.currentCtx.gain (the app's volume fix and the MSU-1 player).
 * window.EJS_onGameStart is called the same way EmulatorJS called it.
 *
 *   Snes9xPlayer.boot('#game', file)   // a File (or { bytes, name })
 */
(function () {
  'use strict';
  var BASE = window.EMU_BASE || 'emu/';   // EMU_BASE: a page in another folder (patched/)
  var SETTINGS_KEY = 's9x-player-settings';
  var DEFAULTS = {
    filter: 'auto', aspect: '8:7', volume: 0.5, muted: false,
    touch: 'auto', opacity: 0.45, size: 1, haptics: true, slot: 1,
    keymap: null, padmap: null,
    runAhead: null,        // one frame of run-ahead: null = on with a keyboard / controller, off on touch screens (about twice the CPU)
    v: 3,
  };
  var LABELS = { UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', A: 'A', B: 'B', X: 'X', Y: 'Y',
    L: 'L', R: 'R', START: 'Start', SELECT: 'Select' };
  var ORDER = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B', 'A', 'Y', 'X', 'L', 'R', 'START', 'SELECT'];

  var cfg = Object.assign({}, DEFAULTS), savedCfg = {};
  try { savedCfg = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; Object.assign(cfg, savedCfg); } catch (e) {}
  function saveCfg() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch (e) {} }
  // Settings saved before the Auto filter existed hold the old default (6xBRZ)
  // whether or not the player ever chose it: those move to Auto.
  if ((savedCfg.v | 0) < 2) { if (cfg.filter === 'xbrz6') cfg.filter = 'auto'; cfg.v = 2; saveCfg(); }
  // v3: run-ahead became automatic; a saved "off" from when off was the default isn't a choice
  if ((savedCfg.v | 0) < 3) { if (cfg.runAhead === false) cfg.runAhead = null; cfg.v = 3; saveCfg(); }

  // ── storage: in-game saves (SRAM) and save-state slots, per game ────────
  var dbp = null;
  cfg.slot = Math.min(4, Math.max(1, cfg.slot | 0 || 1));
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('rhb-beta-s9x-emu', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { dbp = null; rej(r.error); };
    });
    return dbp;
  }
  function kv(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', mode), r = fn(t.objectStore('kv')), out;
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function kvGet(k) { return kv('readonly', function (s) { return s.get(k); }).catch(function () { return null; }); }
  function kvPut(k, v) { return kv('readwrite', function (s) { return s.put(v, k); }); }

  // ── styles ──────────────────────────────────────────────────────────────
  var CSS = [
    '.s9x { position: absolute; inset: 0; background: #000; overflow: hidden; user-select: none; -webkit-user-select: none; }',
    '.s9x canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; transform: var(--s9x-tf, scale(1)); transition: transform .35s ease; }',
    /* screen effects (crowd control): the picture only, never the controls or menus */
    '.s9x canvas.s9x-wobble { animation: s9x-wobble 1.6s ease-in-out infinite; transition: none; }',
    '@keyframes s9x-wobble { 0%, 100% { transform: var(--s9x-tf, scale(1)) rotate(-3deg) skewX(2deg); } 50% { transform: var(--s9x-tf, scale(1)) rotate(3deg) skewX(-2deg) scale(1.03); } }',
    '.s9x-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #8b95a3; font: 14px system-ui, sans-serif; pointer-events: none; }',
    '.s9x-toast { position: absolute; left: 50%; top: 44px; transform: translate(-50%, -6px); opacity: 0; z-index: 30;',
    '  background: rgba(22,27,34,.92); color: #e6e9ee; border: 1px solid #2a313c; padding: 5px 11px; border-radius: 8px;',
    '  font: 13px system-ui, sans-serif; pointer-events: none; transition: opacity .15s, transform .15s; white-space: nowrap; }',
    '.s9x-toast.show { opacity: 1; transform: translate(-50%, 0); }',
    /* top pill: pause / fast-forward / save state / load state / slot / settings */
    '.s9x-pill { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); z-index: 20; display: flex; gap: 4px;',
    '  background: rgba(13,17,23,.6); border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 3px; transition: opacity .3s; }',
    '.s9x-pill button { all: unset; cursor: pointer; width: 34px; height: 28px; border-radius: 14px; display: flex; align-items: center;',
    '  justify-content: center; color: #e6e9ee; font: 600 14px system-ui, sans-serif; }',
    '.s9x-pill button:hover { background: rgba(255,255,255,.12); }',
    '.s9x-pill button.on { background: #1f6f3a; }',
    '.s9x-pill .sep { width: 1px; margin: 4px 1px; background: rgba(255,255,255,.18); }',
    '.s9x-pill [data-a=slot] { width: 30px; font-size: 12px; color: #aab3bf; }',
    '.s9x.idle .s9x-pill { opacity: 0; pointer-events: none; }',
    '.s9x.touch:not(.idle) .s9x-pill { opacity: .85; }',
    /* on-screen controller */
    '.s9x-touch { display: none; position: absolute; inset: 0; z-index: 10; pointer-events: none; --pad: 140px; touch-action: none; -webkit-touch-callout: none; }',
    '.s9x.touch .s9x-touch { display: block; }',
    '.s9x-touch .btn, .s9x-touch .dpad { position: absolute; pointer-events: auto; opacity: var(--op, .45); }',
    '.s9x-touch .btn { display: flex; align-items: center; justify-content: center; font: 700 14px system-ui, sans-serif; color: #fff;',
    '  border-radius: 50%; border: 2px solid rgba(255,255,255,.3); text-shadow: 0 1px 2px #000; box-sizing: border-box; }',
    '.s9x-touch .btn.down { opacity: .95; filter: brightness(1.35); transform: scale(.94); }',
    '.s9x-touch .dpad { left: max(8px, env(safe-area-inset-left)); bottom: 8px; width: var(--pad); height: var(--pad); border-radius: 50%; background: rgba(255,255,255,.07); }',
    '.s9x-touch .dpad::before, .s9x-touch .dpad::after { content: ""; position: absolute; background: #3a414c; border-radius: 7px; }',
    '.s9x-touch .dpad::before { left: 33.3%; top: 5%; width: 33.4%; height: 90%; }',
    '.s9x-touch .dpad::after { top: 33.3%; left: 5%; height: 33.4%; width: 90%; }',
    '.s9x-touch .dpad i { position: absolute; z-index: 1; width: 0; height: 0; border: 8px solid transparent; }',
    '.s9x-touch .dpad .u { left: calc(50% - 8px); top: 10%; border-bottom-color: #aab3bf; }',
    '.s9x-touch .dpad .d { left: calc(50% - 8px); bottom: 10%; border-top-color: #aab3bf; }',
    '.s9x-touch .dpad .l { top: calc(50% - 8px); left: 10%; border-right-color: #aab3bf; }',
    '.s9x-touch .dpad .r { top: calc(50% - 8px); right: 10%; border-left-color: #aab3bf; }',
    '.s9x-touch .dpad.d-up, .s9x-touch .dpad.d-down, .s9x-touch .dpad.d-left, .s9x-touch .dpad.d-right { opacity: .9; }',
    '.s9x-touch .dpad.d-up .u { border-bottom-color: #fff; } .s9x-touch .dpad.d-down .d { border-top-color: #fff; }',
    '.s9x-touch .dpad.d-left .l { border-right-color: #fff; } .s9x-touch .dpad.d-right .r { border-left-color: #fff; }',
    '.s9x-touch .face { position: absolute; right: max(8px, env(safe-area-inset-right)); bottom: 8px; width: var(--pad); height: var(--pad); pointer-events: none; }',
    '.s9x-touch .face .btn { width: 36%; height: 36%; font-size: calc(var(--pad) * .11); }',
    '.s9x-touch .face [data-btn=X] { left: 32%; top: 0; background: #2f5fbf; }',
    '.s9x-touch .face [data-btn=A] { right: 0; top: 32%; background: #c0392b; }',
    '.s9x-touch .face [data-btn=B] { left: 32%; bottom: 0; background: #d4a017; }',
    '.s9x-touch .face [data-btn=Y] { left: 0; top: 32%; background: #2e8b57; }',
    '.s9x-touch .face .combo { width: 20%; height: 20%; border: 0; background: transparent; opacity: 0; }',
    '.s9x-touch .face [data-btn="B,A"] { right: 12%; bottom: 12%; } .s9x-touch .face [data-btn="B,Y"] { left: 12%; bottom: 12%; }',
    '.s9x-touch .face [data-btn="X,A"] { right: 12%; top: 12%; } .s9x-touch .face [data-btn="X,Y"] { left: 12%; top: 12%; }',
    '.s9x-touch .sh { top: 6px; width: calc(var(--pad) * .5); height: calc(var(--pad) * .23); border-radius: 9px; background: #3a414c; }',
    '.s9x-touch .sh.l { left: max(8px, env(safe-area-inset-left)); } .s9x-touch .sh.r { right: max(8px, env(safe-area-inset-right)); }',
    '.s9x-touch .sm { bottom: 6px; width: calc(var(--pad) * .42); height: calc(var(--pad) * .17); border-radius: 99px; background: #3a414c;',
    '  font-size: calc(var(--pad) * .07); letter-spacing: .05em; }',
    '.s9x-touch .sm.sel { right: calc(50% + 4px); } .s9x-touch .sm.sta { left: calc(50% + 4px); }',
    /* controller beside the picture instead of over it (setTouchPlacement('outside')):
       upright, the picture on top and the controller under it, shoulder buttons and
       Select/Start in a row just below the picture; sideways, the picture in the
       middle with the D-pad on the left and the buttons on the right */
    '.s9x.out-port .s9x-touch .sh, .s9x.out-port .s9x-touch .sm { top: var(--sh-top); bottom: auto; }',
    '.s9x.out-port .s9x-touch .dpad, .s9x.out-port .s9x-touch .face { bottom: var(--ctl-b); }',
    '.s9x.out-land .s9x-touch .sm { bottom: auto; top: calc(14px + var(--pad) * .23); }',
    '.s9x.out-land .s9x-touch .sm.sel { left: max(8px, env(safe-area-inset-left)); right: auto; }',
    '.s9x.out-land .s9x-touch .sm.sta { right: max(8px, env(safe-area-inset-right)); left: auto; }',
    '.s9x.out-land .s9x-touch .dpad, .s9x.out-land .s9x-touch .face { bottom: 12px; }',
    /* menu */
    '.s9x-menu { position: absolute; inset: 0; z-index: 40; background: rgba(10,13,18,.94); color: #e6e9ee; overflow-y: auto;',
    '  font: 14px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; user-select: none; }',
    '.s9x-menu[hidden] { display: none; }',
    '.s9x-menu .hd { position: sticky; top: 0; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #161b22; border-bottom: 1px solid #2a313c; }',
    '.s9x-menu .hd b { flex: 1; font-size: 15px; } .s9x-menu .hd b span { color: #5fbf6f; }',
    '.s9x-menu .bd { padding: 4px 12px 14px; max-width: 520px; margin: 0 auto; }',
    '.s9x-menu h4 { margin: 12px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8b95a3; }',
    '.s9x-menu .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; }',
    '.s9x-menu .acts { display: flex; flex-wrap: wrap; gap: 6px; }',
    '.s9x-menu button, .s9x-menu select { background: #0d1117; color: #e6e9ee; border: 1px solid #2a313c; border-radius: 6px; padding: 6px 10px; font: inherit; font-size: 13px; cursor: pointer; }',
    '.s9x-menu button.primary { background: #1f6f3a; border-color: #2a8a4a; }',
    '.s9x-menu select, .s9x-menu input[type=range] { width: 55%; max-width: 240px; }',
    '.s9x-menu .hint { color: #8b95a3; font-size: 12px; margin: 4px 0; }',
    '.s9x-menu table { width: 100%; border-collapse: collapse; font-size: 13px; }',
    '.s9x-menu td { padding: 3px 0; } .s9x-menu td button { width: 100%; padding: 4px 6px; }',
    '.s9x-menu td:first-child { width: 22%; color: #8b95a3; } .s9x-menu td + td { padding-left: 6px; }',
    '.s9x-menu td button.wait { border-color: #e3b341; color: #e3b341; }',
  ].join('\n');

  var started = false, core = null, video = null, audio = null, input = null;
  var root, canvas, touchEl, menuEl, pill, toastEl, msgEl;
  var running = false, paused = false, ff = false, gameName = '', lastSram = null;
  var speedMul = 1, audioAcc = 0;   // crowd speed effects: 1.5 = faster, 0.5 = slow motion
  var screenFx = {}, tempFilter = null;
  // Add-ons (crowd/effects.js) plug in here without touching the loop:
  //   input(pad) -> pad   change the buttons the game sees this frame
  //   frame(core)         runs after every emulated frame
  //   menu {html(rerender), click(button, rerender), input(el)}  a section in the menu
  var hooks = { input: null, frame: null, menu: null };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  // ── building the player ────────────────────────────────────────────────
  function build(container) {
    if (!document.getElementById('s9x-css')) { var st = el('style'); st.id = 's9x-css'; st.textContent = CSS; document.head.appendChild(st); }
    root = el('div', 's9x');
    canvas = el('canvas');
    msgEl = el('div', 's9x-msg', 'Starting Snes9x…');
    toastEl = el('div', 's9x-toast');
    pill = el('div', 's9x-pill',
      '<button type="button" data-a="pause" title="Pause">❚❚</button>' +
      '<button type="button" data-a="ff" title="Fast-forward (hold `)">⏩</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-a="save" title="Save state (F5)">💾</button>' +
      '<button type="button" data-a="load" title="Load state (F8)">📂</button>' +
      '<button type="button" data-a="slot" title="Save-state slot (tap to change)"></button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-a="menu" title="Emulator settings">⋯</button>');
    syncSlot();
    touchEl = el('div', 's9x-touch',
      '<div class="btn sh l" data-btn="L">L</div><div class="btn sh r" data-btn="R">R</div>' +
      '<div class="dpad" data-dpad><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i></div>' +
      '<div class="btn sm sel" data-btn="SELECT">SELECT</div><div class="btn sm sta" data-btn="START">START</div>' +
      '<div class="face"><div class="btn" data-btn="X">X</div><div class="btn" data-btn="A">A</div>' +
      '<div class="btn" data-btn="B">B</div><div class="btn" data-btn="Y">Y</div>' +
      '<div class="btn combo" data-btn="B,A"></div><div class="btn combo" data-btn="B,Y"></div>' +
      '<div class="btn combo" data-btn="X,A"></div><div class="btn combo" data-btn="X,Y"></div></div>');
    menuEl = el('div', 's9x-menu');
    menuEl.hidden = true;
    [canvas, msgEl, touchEl, pill, toastEl, menuEl].forEach(function (c) { root.appendChild(c); });
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(root);

    pill.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'pause') setPaused(!paused);
      else if (a === 'ff') setFF(!ff);
      else if (a === 'save') saveState();
      else if (a === 'load') loadState();
      else if (a === 'menu') openMenu();
      else if (a === 'slot') { cfg.slot = cfg.slot % 4 + 1; saveCfg(); syncSlot(); toast('Slot ' + cfg.slot); }
    });
    // The pill stays out of the way: it shows when the picture is tapped (or the
    // mouse moves over it) and fades out again after a few seconds. Presses on
    // the on-screen controller don't bring it up. While paused it stays, so
    // there's always a way to resume.
    var idleT = null;
    function hideSoon(ms) {
      clearTimeout(idleT);
      idleT = setTimeout(function () { if (!paused) root.classList.add('idle'); else hideSoon(1000); }, ms);
    }
    function wakeUi(ms) { root.classList.remove('idle'); hideSoon(ms || 3000); }
    root.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') wakeUi(2500); });
    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.s9x-touch .btn, .s9x-touch .dpad')) return;
      wakeUi(e.target.closest && e.target.closest('.s9x-pill') ? 4000 : 3000);
    });
    root.classList.add('idle');
    // keep the mouse free (no pointer lock, no context menu on the picture)
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    new ResizeObserver(layoutTouch).observe(root);
  }

  // Controller size follows the game box (bigger box, bigger buttons).
  // 'overlay' (default): the controller sits over the picture.
  // 'outside': with the controller showing, the picture shrinks to leave it
  // room, below the picture when upright and on both sides when sideways.
  var placement = 'overlay';
  function setCanvasBox(x, y, w, h) {
    var st = canvas.style;
    if (x == null) { st.left = st.top = st.width = st.height = ''; return; }
    st.left = Math.round(x) + 'px'; st.top = Math.round(y) + 'px';
    st.width = Math.round(w) + 'px'; st.height = Math.round(h) + 'px';
  }
  function layoutTouch() {
    var w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    var size = cfg.size || 1, pad, op = cfg.opacity;
    var out = placement === 'outside' && root.classList.contains('touch');
    var port = out && h >= w * 0.9;
    root.classList.toggle('out-port', port);
    root.classList.toggle('out-land', out && !port);
    var ar = cfg.aspect === '4:3' ? 4 / 3 : 8 / 7;
    if (!out) {
      setCanvasBox(null);
      pad = Math.max(84, Math.min(w * 0.31, h * 0.42, 180)) * size;
    } else if (port) {
      // picture across the full width on top; the rest is the controller
      var want = Math.min(w * 0.40, 210) * size;      // the controller at full size
      var picH = Math.max(Math.min(w / ar, h - (want * 1.23 + 30)), h * 0.35);
      var zone = h - picH, row = 0;
      pad = Math.max(72, Math.min(w * 0.40, 210, (zone - 30) / 1.23)) * size;
      row = pad * 0.23;
      setCanvasBox(0, 0, w, picH);
      touchEl.style.setProperty('--sh-top', Math.round(picH + 8) + 'px');
      var rest = zone - row - 16;   // under the shoulder row
      touchEl.style.setProperty('--ctl-b', Math.max(8, Math.round((rest - pad) / 2)) + 'px');
      op = Math.max(op, 0.85);      // nothing to see through now
    } else {
      // picture in the middle at full height; controls in the side columns
      pad = Math.max(84, Math.min(h * 0.42, w * 0.22, 190)) * size;
      var picW = Math.max(Math.min(h * ar, w - 2 * (pad + 20)), w * 0.4);
      setCanvasBox((w - picW) / 2, 0, picW, h);
      op = Math.max(op, 0.85);
    }
    touchEl.style.setProperty('--pad', Math.round(pad) + 'px');
    touchEl.style.setProperty('--op', op);
    if (video) { video.dirty = true; try { video.fit(); } catch (e) {} }
  }
  function setTouchPlacement(m) {
    placement = m === 'outside' ? 'outside' : 'overlay';
    if (root) layoutTouch();
  }

  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  function runAheadOn() { return cfg.runAhead == null ? !coarse.matches : !!cfg.runAhead; }
  var padUsed = false;    // a physical controller is in use: hide the on-screen one (auto mode)
  function applyTouch() {
    var touchy = coarse.matches || (navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches);
    var show = cfg.touch === 'on' || (cfg.touch === 'auto' && touchy && !padUsed);
    root.classList.toggle('touch', !!show);
    input.haptics = !!cfg.haptics;
    layoutTouch();
  }

  function syncSlot() { var b = pill && pill.querySelector('[data-a=slot]'); if (b) b.textContent = 'S' + cfg.slot; }

  // ── menu (opened from the app's ⚙ → Emulator button) ────────────────────
  function keyName(code) {
    if (!code) return '—';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/Left$|Right$/, function (s) { return /^(Shift|Control|Alt|Meta)/.test(code) ? ' ' + s : s; });
  }
  function keyFor(btn) { return Object.keys(input.keymap).filter(function (k) { return input.keymap[k] === btn; }); }
  function padFor(btn) { return Object.keys(input.padmap).filter(function (k) { return input.padmap[k] === btn; }); }

  function openMenu() {
    var wasPaused = paused;
    if (!paused) setPaused(true);
    menuEl._resume = !wasPaused;
    renderMenu();
    menuEl.hidden = false;
  }
  function closeMenu() {
    input.capture = null;
    menuEl.hidden = true;
    if (menuEl._resume) setPaused(false);
  }
  // Test: warp to a dungeon. Entrance ids (zelda3); module $11 drops Link in
  // through that entrance, like the crowd effects' boss detour.
  var DG_WARPS = [['Hyrule Castle', 0x04], ['Sanctuary / Sewers', 0x02], ['Eastern Palace', 0x08], ['Desert Palace', 0x09],
    ['Tower of Hera', 0x33], ["Agahnim's Tower", 0x24], ['Palace of Darkness', 0x26], ['Swamp Palace', 0x25],
    ['Skull Woods', 0x2B], ["Thieves' Town", 0x34], ['Ice Palace', 0x2D], ['Misery Mire', 0x27],
    ['Turtle Rock', 0x35], ["Ganon's Tower", 0x37]];
  var warpBack = null, lastWarp = 0;
  function dgWarp(i) {
    var d = DG_WARPS[i], w = core && core.wram();
    if (!d || !w) return;
    // only while playing (overworld or a dungeon, no menu/transition running)
    if (!((w[0x10] === 0x07 || w[0x10] === 0x09) && w[0x11] === 0)) { toast('Start playing first (walk around in the game), then warp.'); return; }
    var st = core.saveState();
    if (st) warpBack = st;
    w[0x10E] = d[1]; w[0x10F] = 0; w[0x10] = 0x11; w[0x11] = 0; w[0xB0] = 0;
    toast('Warping to ' + d[0]);
  }
  function renderMenu() {
    var P = window.Video ? Video.PRESETS : {};
    var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
    var rows = ORDER.map(function (b) {
      return '<tr><td>' + LABELS[b] + '</td><td><button type="button" data-map="key" data-b="' + b + '">' +
        (keyFor(b).map(keyName).join(' / ') || '—') + '</button></td><td><button type="button" data-map="pad" data-b="' + b + '">' +
        (padFor(b).map(function (i) { return 'Button ' + i; }).join(' / ') || '—') + '</button></td></tr>';
    }).join('');
    menuEl.innerHTML =
      '<div class="hd"><b>Snes<span>9x</span></b><button type="button" class="primary" data-a="close">Back to game</button></div>' +
      '<div class="bd">' +
      '<h4>Game</h4><div class="acts">' +
        '<button type="button" data-a="restart">Restart</button>' +
        (root.requestFullscreen ? '<button type="button" data-a="fs">Full screen</button>' : '') +
      '</div>' +
      '<p class="hint">Save and load states from the bar on the game screen (💾 / 📂, S1–S4 picks the slot). In-game saves are kept automatically for each seed. Keys: F5 save state, F8 load state, hold ` to fast-forward.</p>' +
      '<h4>Sound</h4><div class="row"><span>Volume</span><input type="range" min="0" max="1" step="0.05" data-s="volume" value="' + cfg.volume + '"></div>' +
      '<div class="row"><span>Mute</span><input type="checkbox" data-s="muted"' + (cfg.muted ? ' checked' : '') + '></div>' +
      '<h4>Graphics</h4>' +
      '<div class="row"><span>Filter</span><select data-s="filter">' + opts([['auto', 'Auto (now: ' + ((P[autoFilter()] || {}).name || autoFilter()) + ')']].concat(Object.keys(P).map(function (k) { return [k, P[k].name]; })), cfg.filter) + '</select></div>' +
      '<div class="row"><span>Aspect ratio</span><select data-s="aspect">' + opts([['8:7', 'Pixel-perfect (8:7)'], ['4:3', 'TV (4:3)'], ['fill', 'Fill the box']], cfg.aspect) + '</select></div>' +
      '<p class="hint">Auto starts at xBRZ 6x (Zenju\u2019s xBRZ itself, the filter Mesen uses, on the processor) on computers and at the graphics-chip 6xBRZ on phones and tablets, and steps down to lighter filters if this device can\u2019t keep up.</p>' +
      '<div class="row"><span>Run-ahead (less input lag)</span><input type="checkbox" data-s="runAhead"' + (runAheadOn() ? ' checked' : '') + '></div>' +
      '<p class="hint">Shows each frame one frame early, like RetroArch\u2019s run-ahead: a press shows up about 16 ms sooner. It runs the game twice per frame, so it\u2019s on by default with a keyboard or controller and off on touch screens.</p>' +
      '<h4>On-screen controller</h4>' +
      '<div class="row"><span>Show</span><select data-s="touch">' + opts([['auto', 'Auto (touch screens)'], ['on', 'Always'], ['off', 'Never']], cfg.touch) + '</select></div>' +
      '<div class="row"><span>Opacity</span><input type="range" min="0.1" max="1" step="0.05" data-s="opacity" value="' + cfg.opacity + '"></div>' +
      '<div class="row"><span>Size</span><input type="range" min="0.7" max="1.4" step="0.05" data-s="size" value="' + cfg.size + '"></div>' +
      '<div class="row"><span>Vibrate on press (Android)</span><input type="checkbox" data-s="haptics"' + (cfg.haptics ? ' checked' : '') + '></div>' +
      '<h4>Controls</h4><p class="hint">Tap a box, then press the key or controller button for it (Esc cancels).</p>' +
      '<table><tr><td></td><td class="hint">Keyboard</td><td class="hint">Controller</td></tr>' + rows + '</table>' +
      '<div class="acts" style="margin-top:8px"><button type="button" data-a="resetmap">Reset controls</button></div>' +
      (input.padName ? '<p class="hint">Controller: ' + input.padName.replace(/</g, '&lt;') + '</p>' : '') +
      (hooks.menu ? hooks.menu.html(renderMenu) : '') +
      '<div class="row" style="margin-top:6px"><span>Test: warp to a dungeon</span><span><select data-x="dgwarp">' + opts(DG_WARPS.map(function (d, i) { return [i, d[0]]; }), lastWarp) + '</select> <button type="button" data-a="dgwarp">Warp</button></span></div>' +
      (warpBack ? '<div class="acts"><button type="button" data-a="dgback">Back to before the warp</button></div>' : '') +
      '<p class="hint">Drops Link in at the dungeon’s entrance (for testing dungeon maps and the tracker). The game is saved in memory first, so “Back to before the warp” undoes it.</p>' +
      '<h4>Diagnostics</h4>' + diagnostics() +
      '</div>';
  }
  function bindMenu() {
    menuEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'close') closeMenu();
      else if (a === 'restart') { if (confirm('Restart the game?')) { core.reset(); audio.clear(); menuEl._resume = true; closeMenu(); } }
      else if (a === 'fs') { closeMenu(); fullscreen(); }
      else if (a === 'dgwarp') { var sel = menuEl.querySelector('[data-x=dgwarp]'); lastWarp = +sel.value; menuEl._resume = true; closeMenu(); dgWarp(lastWarp); }
      else if (a === 'dgback') { if (warpBack && core.loadState(warpBack)) { audio.clear(); toast('Back to before the warp'); } warpBack = null; menuEl._resume = true; closeMenu(); }
      else if (a === 'resetmap') { input.keymap = Object.assign({}, EmuInput.DEFAULT_KEYS); input.padmap = Object.assign({}, EmuInput.DEFAULT_PAD); cfg.keymap = cfg.padmap = null; saveCfg(); renderMenu(); }
      else if (b.dataset.map) remap(b);
      else if (b.dataset.ext && hooks.menu) hooks.menu.click(b, renderMenu);
    });
    menuEl.addEventListener('input', function (e) {
      if (e.target.dataset.ext && hooks.menu && hooks.menu.input) { hooks.menu.input(e.target); return; }
      var s = e.target.dataset.s; if (!s) return;
      var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (s === 'volume' || s === 'opacity' || s === 'size') v = +v;
      cfg[s] = v; saveCfg();
      if (s === 'volume' || s === 'muted') { ejs.volume = cfg.volume; ejs.muted = cfg.muted; ejs.setVolume(cfg.volume); }
      else if (s === 'filter') { if (v === 'auto') { autoLevel = 0; try { localStorage.removeItem(AUTO_KEY); } catch (x) {} autoWatch = { since: 0, slow: 0, total: 0 }; } applyFilter(); renderMenu(); }
      else if (s === 'aspect') applyAspect();
      else if (s === 'runAhead') { /* takes effect next frame */ }
      else applyTouch();
    });
  }
  function remap(btn) {
    var kind = btn.dataset.map, target = btn.dataset.b;
    menuEl.querySelectorAll('button.wait').forEach(function (x) { x.classList.remove('wait'); });
    btn.classList.add('wait'); btn.textContent = kind === 'key' ? 'Press a key…' : 'Press a button…';
    input.capture = function (r) {
      input.capture = null;
      if (!r.cancel) {
        if (kind === 'key' && r.key) {
          Object.keys(input.keymap).forEach(function (k) { if (input.keymap[k] === target) delete input.keymap[k]; });
          input.keymap[r.key] = target; cfg.keymap = input.keymap;
        } else if (kind === 'pad' && r.pad != null) {
          Object.keys(input.padmap).forEach(function (k) { if (input.padmap[k] === target) delete input.padmap[k]; });
          input.padmap[r.pad] = target; cfg.padmap = input.padmap;
        }
        saveCfg();
      }
      renderMenu();
    };
    // after capture is set: the poll stops as soon as nothing is waiting for a press
    if (kind === 'pad') padPoll();
  }
  // While paused the frame loop doesn't read controllers; poll for a remap.
  // One loop at a time: picking box after box must not start a second one.
  var polling = false;
  function padPoll() {
    if (polling) return;
    polling = true;
    (function step() {
      if (!input.capture) { polling = false; return; }
      input.gamepadMask();
      requestAnimationFrame(step);
    })();
  }

  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.catch) p.catch(function () {});
  }

  // ── graphics ────────────────────────────────────────────────────────────
  function applyAspect() {
    if (!video) return;
    video.aspect = cfg.aspect === '4:3' ? 4 / 3 : cfg.aspect === 'fill' ? 0 : 8 / 7;
    video.dirty = true;
    if (placement === 'outside') layoutTouch();   // the picture's box follows the shape
  }
  function applyScreenFx() {
    if (!canvas) return;
    var t = [];
    if (screenFx.mirror) t.push('scaleX(-1)');
    if (screenFx.flip) t.push('rotate(180deg)');
    if (screenFx.tiny) t.push('scale(.5)');
    canvas.style.setProperty('--s9x-tf', t.length ? t.join(' ') : 'scale(1)');   // never 'none': 'none rotate(..)' is invalid and kills the wobble
    canvas.classList.toggle('s9x-wobble', !!screenFx.wobble);
  }
  // ── Auto filter: the best filter this device keeps smooth ─────────────────
  // Starts at 6xBRZ (or Sharp on software rendering), and steps down to 4xBRZ,
  // then Sharp, when frames keep running long. The level it settles on is
  // remembered, so the next game starts there instead of stuttering first.
  // Auto: xBRZ itself (xbrz.js, on the processor) on computers, stepping down to the GPU
  // shaders and then Sharp if the device can't keep up; phones and tablets start at the GPU 6xBRZ.
  var AUTO_KEY = 's9x-auto-filter';
  var AUTO_LEVELS = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? ['xbrz6', 'xbrz4', 'sharpbl'] : ['xbrz6x', 'xbrz6', 'xbrz4', 'sharpbl'];
  var autoLevel = 0, autoWatch = { since: 0, slow: 0, total: 0 };
  try { var al = parseInt(localStorage.getItem(AUTO_KEY), 10); if (al >= 0 && al < AUTO_LEVELS.length) autoLevel = al; } catch (e) {}
  function autoFilter() {
    if (video && video.software) return 'sharpbl';
    return AUTO_LEVELS[autoLevel];
  }
  function filterNow() { return cfg.filter === 'auto' ? autoFilter() : cfg.filter; }
  // The frame on its way to the screen: through xBRZ itself when that's the filter.
  function paintFrame(f) {
    var P = window.Video && Video.PRESETS[filterNow()];
    if (P && P.cpu && window.Xbrz) {
      if (Xbrz.ready) { var r = Xbrz.scale(f, P.cpu); if (r) return r; }
      else Xbrz.load(BASE).catch(function (e) { console.warn('[snes9x] xbrz', e); });
    }
    return f;
  }
  // called every tick: dt is the time since the last screen refresh
  function autoTune(dt, frameMs) {
    if (cfg.filter !== 'auto' || !running || paused || ff || autoLevel >= AUTO_LEVELS.length - 1) return;
    if (video && video.software) return;          // already on Sharp
    if (document.visibilityState !== 'visible') return;
    var now = performance.now();
    if (!autoWatch.since) { autoWatch.since = now + 3000; return; }   // settle first
    if (now < autoWatch.since) return;
    autoWatch.total++;
    if (dt > frameMs * 1.6) autoWatch.slow++;
    if (autoWatch.total < 300) return;                               // about 5 s at 60 Hz
    var share = autoWatch.slow / autoWatch.total;
    autoWatch.total = 0; autoWatch.slow = 0;
    if (share < 0.08) return;
    autoLevel++;
    try { localStorage.setItem(AUTO_KEY, String(autoLevel)); } catch (e) {}
    applyFilter();
    var P = window.Video ? Video.PRESETS : {};
    toast('Graphics set to ' + ((P[autoFilter()] || {}).name || autoFilter()) + ' to keep the game smooth (⋯ → Filter to change)');
    autoWatch.since = now + 3000;
  }
  function applyFilter() {
    if (tempFilter && video) { video.setPreset(tempFilter).catch(function () {}); return; }
    if (!video) return;
    video.setPreset(filterNow()).catch(function (e) {
      console.warn('[snes9x] filter', e);
      toast('That filter isn’t supported here; using sharp pixels.');
      cfg.filter = 'nearest'; saveCfg(); video.setPreset('nearest');
    });
  }

  // ── saves ───────────────────────────────────────────────────────────────
  function sramKey() { return 'sram:' + gameName; }
  function flushSram() {
    if (!running || !core) return Promise.resolve();
    var s = core.sram();
    if (!s.length || !lastSram) return Promise.resolve();
    var changed = false;
    for (var i = 0; i < s.length; i++) if (s[i] !== lastSram[i]) { changed = true; break; }
    if (!changed) return Promise.resolve();
    lastSram = s.slice();
    return kvPut(sramKey(), lastSram).catch(function (e) { console.warn('[snes9x] sram', e); });
  }
  function saveState() {
    if (!running) return;
    var st = core.saveState();
    if (!st) { toast('Couldn’t save state'); return; }
    kvPut('state:' + gameName + ':' + cfg.slot, { at: Date.now(), data: st })
      .then(function () { toast('Saved to slot ' + cfg.slot); }, function () { toast('Couldn’t save state'); });
  }
  function loadState(done) {
    if (!running) return;
    kvGet('state:' + gameName + ':' + cfg.slot).then(function (r) {
      if (!r) { toast('Slot ' + cfg.slot + ' is empty'); if (done) done(false); return; }
      var ok = core.loadState(r.data);
      if (ok) { audio.clear(); toast('Loaded slot ' + cfg.slot); } else toast('That state didn’t load');
      if (done) done(ok);
    });
  }

  // ── pause / fast-forward ────────────────────────────────────────────────
  function setPaused(p) {
    if (!running) return;
    paused = !!p;
    var b = pill.querySelector('[data-a=pause]');
    b.textContent = paused ? '▶' : '❚❚'; b.classList.toggle('on', paused); b.title = paused ? 'Resume' : 'Pause';
    if (paused) { flushSram(); audio.clear(); }
    wake(!paused);
  }
  function setFF(on) { ff = !!on; pill.querySelector('[data-a=ff]').classList.toggle('on', ff); if (!ff) audio.clear(); }

  // keep the screen on while playing
  var lock = null;
  function wake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !lock && !document.hidden) navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {});
    else if (!on && lock) { lock.release().catch(function () {}); lock = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flushSram(); else if (running && !paused) wake(true);
  });
  window.addEventListener('pagehide', function () { flushSram(); });

  // ── frame loop ──────────────────────────────────────────────────────────
  // If the display refresh is within 1% of the SNES rate (~60.1 Hz), run
  // exactly one frame per refresh for perfectly smooth scrolling; the audio
  // absorbs the tiny speed difference. Otherwise (120 Hz screens, throttled
  // windows) pace frames with a time accumulator.
  var acc = 0, last = 0, ema = 0;
  // What happened, for the Diagnostics section of the menu.
  var stats = { frames: 0, draws: 0, glLost: 0, glRestored: 0, error: null, started: 0, missed: 0, ticks: 0 };
  function stopWithError(where, e) {
    stats.error = where + ': ' + (e && (e.message || e.name) || e);
    console.error('[snes9x]', where, e);
    running = false;
    var m = el('div', 's9x-msg', '');
    m.style.pointerEvents = 'auto'; m.style.flexDirection = 'column'; m.style.gap = '10px'; m.style.padding = '16px'; m.style.textAlign = 'center';
    m.innerHTML = '<b style="color:#e5534b">Snes9x stopped</b><span></span>' +
      '<button type="button" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:6px;background:#1f6f3a;color:#fff">Reload</button>';
    m.querySelector('span').textContent = stats.error;
    m.querySelector('button').onclick = function () { location.reload(); };
    root.appendChild(m);
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (!video) return;
    try { video.fit(); } catch (e) {}
    var dt = last ? Math.min(now - last, 100) : 16.7; last = now;
    ema = ema ? ema * 0.95 + dt * 0.05 : dt;
    if (!running || paused) { try { video.draw(); } catch (e) {} return; }
    var frameMs = 1000 / core.fps, pad = input.read(), n = 0;
    if (hooks.input) { try { pad = hooks.input(pad) | 0; } catch (e) { console.warn('[snes9x] input hook', e); } }
    autoTune(dt, frameMs);
    if (dt > frameMs * 1.5) stats.missed++;
    stats.ticks++;
    var vsync = !ff && speedMul === 1 && Math.abs(ema - frameMs) / frameMs < 0.01;
    if (vsync) { n = 1; acc = 0; }
    else {
      acc += dt * (ff ? 4 : speedMul);
      n = Math.floor(acc / frameMs); acc -= n * frameMs;
      var max = ff ? 8 : 3;
      if (n > max) { n = max; acc = 0; }
    }
    var ahead = runAheadOn() && !ff && speedMul === 1 && n > 0;
    try {
      for (var i = 0; i < n; i++) {
        core.runFrame(pad, 0);
        stats.frames++;
        if (hooks.frame) { try { hooks.frame(core); } catch (e) { console.warn('[snes9x] frame hook', e); } }
        var a = core.audio();
        // Run-ahead: the real frames' sound plays, except the last one's, whose
        // place the frame run ahead takes (below), so the sound keeps pace with
        // the picture and no frame's sound is played twice.
        if (ahead && i === n - 1) continue;
        if (!ff) {
          // faster than normal: drop some frames' sound so it doesn't pile up
          audioAcc += speedMul > 1 ? 1 / speedMul : 1;
          if (audioAcc >= 1) { audioAcc -= 1; try { audio.push(a); } catch (e) {} }
        }
      }
      // Run-ahead (one frame, as RetroArch's single-instance run-ahead): keep
      // the real state, run one more frame with the same input and show that,
      // then go back. What's on screen is a frame ahead of the game, so a
      // press shows up a frame sooner. The tracker and crowd effects only see
      // the real state (the frame hook isn't called for the frame ahead).
      if (ahead) {
        if (core.snapshot()) {
          core.runFrame(pad, 0);
          var a2 = core.audio();
          try { audio.push(a2); } catch (e) {}
          video.upload(paintFrame(core.frame()));
          if (!core.restore()) { cfg.runAhead = false; saveCfg(); toast('Run-ahead stopped: the game state couldn\u2019t be restored.'); }
        } else { cfg.runAhead = false; saveCfg(); toast('Run-ahead isn\u2019t possible with this game.'); }
      }
    } catch (e) { stopWithError('Emulator', e); return; }
    try {
      if (n && !ahead) video.upload(paintFrame(core.frame()));
      video.draw();
      stats.draws++;
    } catch (e) {
      // A graphics error shouldn't stop the game: drop to the plainest filter.
      if (!stats.gfxErr) { stats.gfxErr = String(e && e.message || e); console.warn('[snes9x] video', e); }
      if (cfg.filter !== 'nearest') { cfg.filter = 'nearest'; applyFilter(); }
    }
  }
  // iOS can take the graphics context away under memory pressure (e.g. right
  // after Kara's generator ran in the browser); the picture then goes black.
  // Ask for it back and rebuild the renderer when it returns.
  function watchGl() {
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stats.glLost++; });
    canvas.addEventListener('webglcontextrestored', function () {
      stats.glRestored++;
      try { video = new Video(canvas); applyAspect(); applyFilter(); if (running) video.upload(paintFrame(core.frame())); }
      catch (e) { stats.gfxErr = String(e && e.message || e); }
    });
  }
  function diagnostics() {
    var gl = video && video.gl, f = core && core.loaded ? core.frame() : null, lit = 0;
    if (f) { for (var i = 0; i < f.data.length; i += 37) if (f.data[i]) lit++; lit = Math.round(lit * 3700 / f.data.length); }
    var info = [
      ['Game', gameName],
      ['ROM', core && core.loaded ? (core.rom().length / 1048576).toFixed(2) + ' MB' : 'not loaded'],
      ['Running', running ? (paused ? 'paused' : 'yes') : 'no'],
      ['Frames run', stats.frames + ' (' + Math.round(stats.frames / Math.max(1, (performance.now() - stats.started) / 1000)) + '/s)'],
      ['Picture', f ? f.w + '×' + f.h + ', ' + lit + '% lit' : '—'],
      ['Filter', ((video && video.presetId) || cfg.filter) + (window.Xbrz && Xbrz.ready && Video.PRESETS[filterNow()] && Video.PRESETS[filterNow()].cpu ? ', xBRZ ' + Xbrz.ms().toFixed(2) + ' ms per frame' : '')],
      ['Graphics', gl ? (gl.isContextLost() ? 'LOST' : 'ok') + ', lost ' + stats.glLost + '×, restored ' + stats.glRestored + '×' : 'none'],
      ['Audio', audio && audio.ctx ? audio.ctx.state + ' @ ' + audio.ctx.sampleRate : 'not started'],
      ['Screen', ema ? (1000 / ema).toFixed(1) + ' Hz, ' + (Math.abs(ema - 1000 / (core && core.loaded ? core.fps : 60.1)) / ema < 0.01 ? 'one game frame per refresh' : 'paced by the clock') : '\u2014'],
      ['Refreshes missed', stats.missed + ' of ' + stats.ticks + (stats.ticks ? ' (' + (100 * stats.missed / stats.ticks).toFixed(1) + '%)' : '')],
      ['Run-ahead', runAheadOn() ? 'on' : 'off'],
    ];
    if (stats.error) info.push(['Error', stats.error]);
    if (stats.gfxErr) info.push(['Video error', stats.gfxErr]);
    return info.map(function (r) { return '<div class="row"><span class="hint">' + r[0] + '</span><span style="text-align:right;word-break:break-word">' +
      String(r[1]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></div>'; }).join('');
  }
  // A hidden page gets no animation frames, but the app expects the game to
  // keep running when a desktop window is merely covered by tracker windows;
  // browsers still give hidden pages ~1 timer a second, so nothing to do there.

  // ── the EmulatorJS-shaped object the rest of the app uses ───────────────
  var ejs = {
    gameManager: {
      getState: function () { return core.saveState(); },
      loadState: function (bytes) { if (!core.loadState(bytes)) throw new Error('state did not load'); audio.clear(); },
      restart: function () { core.reset(); audio.clear(); },
    },
    get paused() { return paused; },
    pause: function () { setPaused(true); },
    play: function () { setPaused(false); },
    volume: cfg.volume,
    muted: cfg.muted,
    setVolume: function (v) { this.volume = v; cfg.volume = v; cfg.muted = this.muted; saveCfg(); audio.setMuted(this.muted); audio.setVolume(v); },
    Module: {
      AL: {
        get currentCtx() { return audio && audio.ctx ? { gain: audio.gain, sources: [], audioCtx: audio.ctx } : null; },
      },
    },
    enableMouseLock: false,
    snes9x: true,
    get core() { return core; },
    saveState: saveState, loadState: loadState, openMenu: openMenu,
  };

  // ── boot ────────────────────────────────────────────────────────────────
  function boot(container, file) {
    if (started) return Promise.reject(new Error('already started'));
    started = true;
    if (typeof container === 'string') container = document.querySelector(container);
    build(container);
    var name = file.name || 'game.sfc';
    gameName = name.replace(/\.[^.]+$/, '');
    // A File/Blob is read with arrayBuffer(). (Not by testing for .bytes:
    // Safari 18+ and new Chrome give every Blob a bytes() method.)
    var bytesP = (typeof Blob !== 'undefined' && file instanceof Blob) || typeof file.arrayBuffer === 'function'
      ? file.arrayBuffer().then(function (b) { return new Uint8Array(b); })
      : Promise.resolve(new Uint8Array(file.bytes));

    watchGl();
    try { video = new Video(canvas); } catch (e) {
      msgEl.textContent = 'This browser has no WebGL2, which the emulator needs. Try an up-to-date Safari, Chrome or Firefox.';
      return Promise.reject(e);
    }
    audio = new EmuAudio();
    input = new EmuInput();
    if (cfg.keymap) input.keymap = Object.assign({}, cfg.keymap);
    if (cfg.padmap) input.padmap = Object.assign({}, cfg.padmap);
    input.bindTouch(touchEl);
    input.enabled = function () { return menuEl.hidden; };
    input.onActivity = function () { audio.unlock(); };
    input.onPadPress = function () { if (!padUsed) { padUsed = true; applyTouch(); } };
    input.hotkeys = {
      F5: function (d) { if (d) saveState(); },
      F8: function (d) { if (d) loadState(); },
      Backquote: function (d) { setFF(d); },
    };
    // Touching the screen again brings the on-screen controller back.
    root.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' && padUsed) { padUsed = false; applyTouch(); } }, true);
    ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.addEventListener(t, function () { audio.unlock(); }, true); });
    if (coarse.addEventListener) coarse.addEventListener('change', applyTouch);
    bindMenu();
    applyTouch(); applyAspect(); applyFilter();
    audio.volume = cfg.volume; audio.muted = cfg.muted;
    requestAnimationFrame(tick);

    return Promise.all([Snes9xCore.create(BASE + 'snes9x.wasm'), bytesP]).then(function (r) {
      core = r[0];
      if (!r[1] || r[1].length < 0x8000) throw new Error('the ROM for "' + name + '" was empty (' + (r[1] ? r[1].length : 0) + ' bytes).');
      if (!core.load(r[1])) throw new Error('Snes9x could not load "' + name + '".');
      audio.setRate(core.sampleRate);
      return kvGet(sramKey());
    }).then(function (saved) {
      var s = core.sram();
      if (saved && saved.length === s.length) s.set(saved);
      lastSram = core.sram().slice();
      setInterval(flushSram, 3000);
      msgEl.remove();
      running = true;
      stats.started = performance.now();
      window.EJS_emulator = ejs;
      setPaused(false);
      try { document.dispatchEvent(new Event('s9x-ready')); } catch (e) {}
      if (typeof window.EJS_onGameStart === 'function') { try { window.EJS_onGameStart(); } catch (e) { console.error(e); } }
      return ejs;
    }).catch(function (e) {
      msgEl.textContent = 'The emulator failed to start: ' + (e && e.message || e);
      throw e;
    });
  }

  window.Snes9xPlayer = {
    boot: boot, hooks: hooks, setTouchPlacement: setTouchPlacement,
    get emulator() { return running ? ejs : null; },
    get core() { return running ? core : null; },
    get paused() { return paused; },
    toast: function (msg) { if (toastEl) toast(msg); },
    // crowd effects: speed (1 = normal), picture tricks, a filter for a while
    fx: {
      setSpeed: function (m) { m = +m || 1; if (m !== speedMul) { speedMul = Math.max(0.25, Math.min(3, m)); acc = 0; audioAcc = 0; if (audio) audio.clear(); } },
      get speed() { return speedMul; },
      setScreen: function (name, on) { if (!!screenFx[name] === !!on) return; if (on) screenFx[name] = true; else delete screenFx[name]; applyScreenFx(); },
      setTempFilter: function (id) { if (tempFilter === (id || null)) return; tempFilter = id || null; if (video) applyFilter(); },
      get container() { return root || null; },
      // where the game picture is inside the player (CSS pixels), for things
      // drawn over a particular part of it (the MSU card over the HUD)
      pictureRect: function () {
        if (!video || !canvas) return null;
        var v = video.viewport(), d = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
        return { x: v.x / d, y: v.y / d, w: v.w / d, h: v.h / d };
      },
    },
    openMenu: function () { if (running) openMenu(); },
    get ready() { return running; },
    get gameName() { return gameName; },
  };
})();
