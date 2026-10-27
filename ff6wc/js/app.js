/*
 * app.js — wires the FF6 Worlds Collide page together: the SNES player
 * (../emu/, the hub's Snes9x), ROM loading, the tracker, the layout that
 * gives the game picture exactly its size and the tracker the rest, the
 * autosave and the PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ── tracker ───────────────────────────────────────────────────────────────
  FF6Tracker.ram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; return c ? c.wram() : null; };
  FF6Tracker.init($('tracker'));
  FF6Tracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── seed dialog ──────────────────────────────────────────────────────────
  FF6Seed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', FF6Seed.open);
  $('ph-new').addEventListener('click', FF6Seed.open);

  // A stored seed you were playing: offer to continue it.
  let stored = null;
  FF6Store.get('current').then((c) => {
    if (!c || !c.bytes) return;
    stored = { rom: new Uint8Array(c.bytes), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('ff6wc:autoplay')) { sessionStorage.removeItem('ff6wc:autoplay'); play(stored); }
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
    if (bytes.length < 0x300000 && !confirm('"' + f.name + '" is smaller than Final Fantasy VI (' + (bytes.length / 1048576).toFixed(1) + ' MB). Play it anyway?')) return;
    const entry = { rom: bytes, name: f.name, meta: { source: 'file' } };
    await FF6Store.set('current', { bytes: bytes.buffer.slice(0), name: f.name, meta: entry.meta }).catch(() => {});
    play(entry);
  });

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await FF6Store.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta }).catch(() => {});
      sessionStorage.setItem('ff6wc:autoplay', '1');
      location.reload();
      return;
    }
    booted = true;
    if (entry.meta && entry.meta.seed && !(opts && opts.resume)) {
      await FF6Store.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta }).catch(() => {});
    }
    const id = FF6Hash(entry.rom);
    const label = entry.meta && entry.meta.seed ? 'Seed ' + entry.meta.seed : entry.name;
    FF6Tracker.setSession(id, label, entry.meta || {});
    document.title = describe(entry) + ' - FF6 Worlds Collide';
    boot(new File([entry.rom], 'ff6wc-' + id + '.sfc'), id, !!(opts && opts.resume));
  }

  function boot(file, id, resume) {
    $('placeholder').remove();
    document.body.classList.add('playing');
    FF6Seed.release();
    window.EJS_onGameStart = function () { startAutosave(id, resume); fit(); };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', file).catch((e) => { console.error('[ff6wc] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
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
      FF6Tracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      document.documentElement.style.setProperty('--aside-w', aside + 'px');
      document.documentElement.style.removeProperty('--game-h');
      FF6Tracker.setCompact(H < 560 || aside < 330);
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
  let autosaveKey = null;
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    FF6Store.set(autosaveKey, { state: new Uint8Array(st).buffer, t: Date.now() }).catch(() => {});
  }
  function startAutosave(id, resume) {
    autosaveKey = 'resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden) snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotNow(); });
      window.addEventListener('pagehide', snapshotNow);
    };
    if (!resume) { begin(); return; }
    FF6Store.get(autosaveKey).then((saved) => {
      if (saved && saved.state) {
        setTimeout(() => {
          try { window.EJS_emulator.gameManager.loadState(new Uint8Array(saved.state)); toast('Picked up where you left off'); }
          catch (e) { console.warn('[autosave] could not restore', e); }
          begin();
        }, 600);
      } else begin();
    });
  }
  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text; t.setAttribute('role', 'status');
    document.body.append(t);
    setTimeout(() => t.remove(), 3500);
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
