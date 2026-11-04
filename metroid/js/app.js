/*
 * app.js — wires the Metroid page together: the NES player (../z1r/emu/, the
 * hub's FCEUmm), ROM loading, the tracker, the layout that gives the game
 * picture exactly its size and the tracker the rest, the autosave and the
 * PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ── tracker ───────────────────────────────────────────────────────────────
  M1Tracker.mem = () => {
    const c = window.EmuPlayer && EmuPlayer.core; if (!c) return null;
    let wram = null, sram = null;
    try { wram = c.wram(); } catch (e) {}
    try { sram = c.sram(); } catch (e) {}
    return wram && wram.length ? { wram, sram } : null;
  };
  M1Tracker.init($('tracker'));
  M1Tracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── seed dialog ──────────────────────────────────────────────────────────
  M1Seed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', M1Seed.open);
  $('ph-new').addEventListener('click', M1Seed.open);

  // A stored seed you were playing: offer to continue it.
  let stored = null;
  M1Store.get('current').then((c) => {
    if (!c || !c.bytes) return;
    stored = { rom: new Uint8Array(c.bytes), name: c.name, meta: c.meta || {}, placed: c.placed || [] };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('m1r:autoplay')) { sessionStorage.removeItem('m1r:autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  function describe(entry) {
    const m = entry.meta || {};
    return m.seed ? 'seed ' + m.seed : entry.name.replace(/\.[^.]+$/, '');
  }
  function remember(entry) { return M1Store.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta, placed: entry.placed || [] }).catch(() => {}); }

  // ── playing a ROM ────────────────────────────────────────────────────────
  $('rom-input').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    let bytes = new Uint8Array(await f.arrayBuffer());
    const c = M1Rando.check(bytes, f.name);
    if (c.error) { alert(c.error); return; }
    if (c.warn && !confirm(c.warn + '\n\nPlay it anyway?')) return;
    bytes = c.bytes;
    const entry = { rom: bytes, name: f.name, meta: { source: 'file' }, placed: [] };
    await remember(entry);
    logSeed(entry);
    play(entry);
  });
  function logSeed(entry) {
    try {
      const l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      l.push({ at: Date.now(), game: 'Metroid', what: describe(entry), generator: entry.meta && entry.meta.seed ? 'Rando Hub' : 'file', kind: 'manual' });
      localStorage.setItem('rhb-seed-log', JSON.stringify(l.slice(-500)));
    } catch (e) {}
  }

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await remember(entry);
      sessionStorage.setItem('m1r:autoplay', '1');
      location.reload();
      return;
    }
    booted = true;
    if (entry.meta && entry.meta.seed && !(opts && opts.resume)) await remember(entry);
    const id = M1Hash(entry.rom);
    const label = entry.meta && entry.meta.seed ? 'Seed ' + entry.meta.seed : entry.name;
    M1Tracker.setSession(id, label, entry.meta || {}, entry.placed || []);
    document.title = describe(entry) + ' - Metroid Randomizer';
    boot(new File([entry.rom], 'metroid-' + id + '.nes'), id, !!(opts && opts.resume));
  }

  function boot(file, id, resume) {
    $('placeholder').remove();
    document.body.classList.add('playing');
    M1Seed.release();
    window.EJS_onGameStart = function () { startAutosave(id, resume); fit(); };
    if (EmuPlayer.setTouchPlacement) EmuPlayer.setTouchPlacement('overlay');
    EmuPlayer.boot('#game', file).catch((e) => { console.error('[metroid] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // ── layout: the picture gets exactly its size, the tracker the rest ────────
  function aspect() {
    try { const c = JSON.parse(localStorage.getItem('z1r-nes-player-settings') || '{}'); if (c.aspect === '4:3') return 4 / 3; } catch (e) {}
    return 8 / 7;
  }
  const MIN_ASIDE = 230, MIN_ASIDE_TALL = 200;
  function fit() {
    const hdr = document.querySelector('header').getBoundingClientRect().height;
    const W = window.innerWidth, H = window.innerHeight - hdr;
    const a = aspect();
    const upright = H > W * 1.05;
    document.body.classList.toggle('upright', upright);
    document.body.classList.toggle('sideways', !upright);
    const st = document.documentElement.style;
    if (upright) {
      const gh = Math.max(160, Math.min(Math.round(W / a), Math.round(H - MIN_ASIDE_TALL)));
      st.setProperty('--game-h', gh + 'px'); st.removeProperty('--aside-w');
      M1Tracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      st.setProperty('--aside-w', aside + 'px'); st.removeProperty('--game-h');
      M1Tracker.setCompact(H < 560 || aside < 330);
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (e.key === 'z1r-nes-player-settings') fit(); });
  fit();
  setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));

  // ── autosave ──────────────────────────────────────────────────────────────
  // A snapshot of the running game every 20 s and when the app goes to the
  // background, so Continue picks up where you were (iOS closes web apps
  // that use too much memory). A crashed game is never autosaved and the
  // last three good snapshots are kept (../game-health.js). Metroid counts
  // frames at $2D (with its random numbers at $2E/$2F, which also move every
  // frame) and that stops when the game crashes.
  let autosaveKey = null;
  const health = RHHealth.create({ counter: (r) => r[0x2D] | r[0x2E] << 8 | r[0x2F] << 16, onFrozen: () => toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000) });
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey || !health.alive()) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    const snap = { state: new Uint8Array(st).buffer, t: Date.now() };
    const key = autosaveKey;
    M1Store.get(key).then((v) => M1Store.set(key, { snaps: RHHealth.push(v, snap) })).catch(() => {});
  }
  function startAutosave(id, resume) {
    autosaveKey = 'resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden) snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotNow(); });
      window.addEventListener('pagehide', snapshotNow);
    };
    if (!resume) { begin(); return; }
    M1Store.get(autosaveKey).then((saved) => {
      const list = RHHealth.norm(saved);
      if (!list.length) { begin(); return; }
      setTimeout(() => RHHealth.restore({
        list, health, toast, done: begin,
        load: (state) => { window.EJS_emulator.gameManager.loadState(new Uint8Array(state)); },
        keep: (rest) => M1Store.set(autosaveKey, { snaps: rest }).catch(() => {}),
        reset: () => { EmuPlayer.core.reset(); },
      }), 600);
    });
  }
  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text; t.setAttribute('role', 'status');
    document.body.append(t);
    setTimeout(() => t.remove(), ms || 3500);
  }

  // ── controller indicator ──────────────────────────────────────────────────
  function pads() { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; } }
  function paintPad() {
    const el = $('pad-status'), list = pads();
    el.className = 'pill' + (list.length ? ' on' : '');
    el.title = list.length ? list[0].id : 'Connect a controller, then press any button on it';
    el.querySelector('span').textContent = list.length ? 'Controller connected' : 'No controller';
  }
  setInterval(paintPad, 1000);
  window.addEventListener('gamepadconnected', paintPad);

  // ── installable app ───────────────────────────────────────────────────────
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('install-btn').hidden = false; });
  $('install-btn').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => { deferredPrompt = null; $('install-btn').hidden = true; });
  });
  window.addEventListener('appinstalled', () => { $('install-btn').hidden = true; });
})();
