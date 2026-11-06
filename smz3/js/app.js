/*
 * app.js — wires the SMZ3 page together: the SNES player
 * (../emu/, the hub's Snes9x), ROM loading, the tracker, the layout that
 * gives the game picture exactly its size and the tracker the rest, the
 * autosave and the PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ── tracker ───────────────────────────────────────────────────────────────
  SMZ3Tracker.ram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; return c ? c.wram() : null; };
  SMZ3Tracker.sram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; try { return c && c.sram ? c.sram() : null; } catch (e) { return null; } };
  SMZ3Tracker.rom = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; try { return c && c.rom ? c.rom() : null; } catch (e) { return null; } };
  SMZ3Tracker.init($('tracker'));
  SMZ3Tracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── seed dialog ──────────────────────────────────────────────────────────
  SMZ3Seed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', SMZ3Seed.open);
  $('ph-new').addEventListener('click', SMZ3Seed.open);

  // A stored seed you were playing: offer to continue it.
  let stored = null;
  SMZ3Store.get('current').then((c) => {
    if (!c || !c.bytes) return;
    stored = { rom: new Uint8Array(c.bytes), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('smz3r:autoplay')) { sessionStorage.removeItem('smz3r:autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  function describe(entry) {
    const m = entry.meta || {};
    return m.seed ? 'seed ' + m.seed : entry.name.replace(/\.[^.]+$/, '');
  }

  // ── playing a ROM ────────────────────────────────────────────────────────
  $('rom-input').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    let bytes = new Uint8Array(await f.arrayBuffer());
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) { alert('That is a .zip file. Unzip it and pick the .sfc / .smc inside.'); return; }
    if (bytes.length % 1024 === 512) bytes = bytes.slice(512);
    if (bytes.length < 0x600000 && !confirm('"' + f.name + '" is smaller than an SMZ3 ROM (6 MB; this is ' + (bytes.length / 1024).toFixed(0) + ' KB). Play it anyway?')) return;
    const entry = { rom: bytes, name: f.name, meta: { source: 'file' } };
    await SMZ3Store.set('current', { bytes: bytes.buffer.slice(0), name: f.name, meta: entry.meta }).catch(() => {});
    play(entry);
  });

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await SMZ3Store.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta }).catch(() => {});
      sessionStorage.setItem('smz3r:autoplay', '1');
      location.reload();
      return;
    }
    booted = true;
    if (entry.meta && entry.meta.seed && !(opts && opts.resume)) {
      await SMZ3Store.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta }).catch(() => {});
    }
    const id = SMZ3Hash(entry.rom);
    const label = entry.meta && entry.meta.seed ? 'Seed ' + entry.meta.seed : entry.name;
    SMZ3Tracker.setSession(id, label, entry.meta || {});
    document.title = describe(entry) + ' - SMZ3 Randomizer';
    boot(new File([await withMedia(entry.rom)], 'smz3-' + id + '.sfc'), id, !!(opts && opts.resume));
  }

  // Link's sprite and the MSU-1 pack (../combo-media.js) go into the ROM that boots
  async function withMedia(rom) {
    for (let i = 0; i < 60 && !window.RHComboMedia; i++) await new Promise((r) => setTimeout(r, 50));
    try { return window.RHComboMedia ? await RHComboMedia.prepare(rom) : rom; } catch (e) { console.warn('[combo] media', e); return rom; }
  }
  function boot(file, id, resume) {
    $('placeholder').remove();
    document.body.classList.add('playing');
    SMZ3Seed.release();
    window.EJS_onGameStart = function () { startAutosave(id, resume); fit(); };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', file).catch((e) => { console.error('[smz3] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // ── layout: the picture gets exactly its size, the tracker the rest ────────
  // The SNES picture is 8:7 (256x224) unless the player is set to 4:3. In a
  // sideways window the game box is as tall as the page and just wide enough
  // for the picture; upright, as wide as the page and just tall enough. The
  // tracker takes whatever is left (with a floor so it stays usable).
  function aspect() {
    try { const c = JSON.parse(localStorage.getItem('s9x-player-settings') || '{}'); if (c.aspect === '4:3') return 4 / 3; } catch (e) {}
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
    if (upright) {
      // game: full width, capped so the tracker keeps room
      const gh = Math.min(Math.round(W / a), Math.round(H - MIN_ASIDE_TALL));
      document.documentElement.style.setProperty('--game-h', Math.max(160, gh) + 'px');
      document.documentElement.style.removeProperty('--aside-w');
      SMZ3Tracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      document.documentElement.style.setProperty('--aside-w', aside + 'px');
      document.documentElement.style.removeProperty('--game-h');
      SMZ3Tracker.setCompact(H < 560 || aside < 330);
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (e.key === 's9x-player-settings') fit(); });
  fit();
  setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));   // after the web font

  // ── autosave ──────────────────────────────────────────────────────────────
  // iOS closes web apps that use too much memory and the app reopens at the
  // start screen; a snapshot of the running game (every 20 s and when the app
  // goes to the background) lets Continue pick up where you were. In-game
  // saves are kept too (the player keeps the cartridge's save RAM).
  // A crashed game is never autosaved, and the last three good snapshots are
  // kept (../game-health.js, Nov 2026: a crash that got autosaved came back on
  // every reload).
  // Both games' main-loop frame counters (Zelda $7E:001A, Super Metroid $7E:05B6): the one running stops when its game crashes (the music, on the sound chip, keeps going).
  let autosaveKey = null;
  const health = RHHealth.create({ counter: (r) => r[0x1A] | r[0x5B6] << 8 | r[0x5B7] << 16, onFrozen: () => toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000) });
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey || !health.alive()) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    const snap = { state: new Uint8Array(st).buffer, t: Date.now() };   // own buffer, not a view into the emulator
    const key = autosaveKey;
    SMZ3Store.get(key).then((v) => SMZ3Store.set(key, { snaps: RHHealth.push(v, snap) })).catch(() => {});
  }
  function startAutosave(id, resume) {
    autosaveKey = 'resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden) snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotNow(); });
      window.addEventListener('pagehide', snapshotNow);
    };
    if (!resume) { begin(); return; }
    SMZ3Store.get(autosaveKey).then((saved) => {
      const list = RHHealth.norm(saved);
      if (!list.length) { begin(); return; }
      setTimeout(() => RHHealth.restore({
        list, health, toast, done: begin,
        load: (state) => { window.EJS_emulator.gameManager.loadState(new Uint8Array(state)); },
        keep: (rest) => SMZ3Store.set(autosaveKey, { snaps: rest }).catch(() => {}),
        reset: () => { const p = window.Snes9xPlayer && Snes9xPlayer.core ? Snes9xPlayer : window.EmuPlayer; p.core.reset(); },
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
