/*
 * app.js — wires the Super Metroid page together: the SNES player
 * (../emu/, the hub's Snes9x), ROM loading, the tracker, the layout that
 * gives the game picture exactly its size and the tracker the rest, the
 * autosave and the PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ── tracker ───────────────────────────────────────────────────────────────
  SMRTracker.ram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; return c ? c.wram() : null; };
  if (window.SMRMap) SMRMap.rom = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; try { return c && c.rom ? c.rom() : null; } catch (e) { return null; } };
  SMRTracker.init($('tracker'));
  SMRTracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── seed dialog ──────────────────────────────────────────────────────────
  SMRSeed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', SMRSeed.open);
  $('ph-new').addEventListener('click', SMRSeed.open);

  // A stored seed you were playing: offer to continue it.
  let stored = null;
  SMRStore.get('current').then((c) => {
    if (!c || !c.bytes) return;
    stored = { rom: new Uint8Array(c.bytes), name: c.name, meta: c.meta || {}, spoiler: c.spoiler || {}, placed: c.placed || [] };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('smr:autoplay')) { sessionStorage.removeItem('smr:autoplay'); play(stored); }
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
    if (bytes.length < 0x300000 && !confirm('"' + f.name + '" is smaller than Super Metroid (' + (bytes.length / 1048576).toFixed(1) + ' MB). Play it anyway?')) return;
    const entry = { rom: bytes, name: f.name, meta: { source: 'file' } };
    await SMRStore.set('current', { bytes: bytes.buffer.slice(0), name: f.name, meta: entry.meta }).catch(() => {});
    play(entry);
  });

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await SMRStore.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta, spoiler: entry.spoiler || {}, placed: entry.placed || [] }).catch(() => {});
      sessionStorage.setItem('smr:autoplay', '1');
      location.reload();
      return;
    }
    booted = true;
    if (entry.meta && entry.meta.seed && !(opts && opts.resume)) {
      await SMRStore.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta, spoiler: entry.spoiler || {}, placed: entry.placed || [] }).catch(() => {});
    }
    const id = SMRHash(entry.rom);
    const label = entry.meta && entry.meta.seed ? 'Seed ' + entry.meta.seed : entry.name;
    SMRTracker.setSession(id, label, entry.meta || {}, entry.spoiler || {}, entry.placed || []);
    if (window.SMRLogic) SMRLogic.load(entry.rom);   // DASH's logic for the tracker, from the seed's own ROM
    document.title = describe(entry) + ' - Super Metroid DASH';
    boot(new File([entry.rom], 'sm-' + id + '.sfc'), id, !!(opts && opts.resume));
  }

  function boot(file, id, resume) {
    $('placeholder').remove();
    document.body.classList.add('playing');
    SMRSeed.release();
    window.EJS_onGameStart = function () { startAutosave(id, resume); fit(); };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', file).catch((e) => { console.error('[sm] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
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
      SMRTracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      document.documentElement.style.setProperty('--aside-w', aside + 'px');
      document.documentElement.style.removeProperty('--game-h');
      SMRTracker.setCompact(H < 560 || aside < 330);
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
  //
  // A crashed game must never become the snapshot (Heffie, Nov 2026: the game
  // crashed, music still playing, the HUD garbled, and the next autosave kept
  // the crash, so every reload came back frozen). So a snapshot is only taken
  // while the game is alive: Super Metroid's main loop counts its frames at
  // $7E:05B6 and stops counting when it crashes (the music runs on the sound
  // chip and keeps going). The last three good snapshots are kept; if the one
  // restored doesn't run, the one before it is tried, then the cartridge's own
  // save (a reset: the file select, with the last save station).
  let autosaveKey = null, lastFrames = -1, frozenFor = 0, warned = false;
  const KEEP = 3;
  function frames() { const c = window.Snes9xPlayer && Snes9xPlayer.core; const r = c && c.wram ? c.wram() : null; return r && r.length > 0x5B7 ? r[0x5B6] | r[0x5B7] << 8 : -1; }
  // alive: the main loop's counter moved since the last look (checked each second)
  setInterval(() => {
    if (!autosaveKey || document.hidden || (window.Snes9xPlayer && Snes9xPlayer.paused)) return;
    const f = frames();
    if (f < 0) return;
    frozenFor = f === lastFrames ? frozenFor + 1 : 0;
    lastFrames = f;
    if (frozenFor === 8 && !warned) { warned = true; toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000); }
    if (frozenFor === 0) warned = false;
  }, 1000);
  function alive() { return frozenFor < 2 && lastFrames >= 0; }
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey || !alive()) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    const snap = { state: new Uint8Array(st).buffer, t: Date.now() };
    SMRStore.get(autosaveKey).then((list) => {
      list = Array.isArray(list && list.snaps) ? list.snaps : list && list.state ? [list] : [];
      // a new one at most every 20 s; the older ones spread out (≥ 1 min apart) so a crash can't push them all out
      if (list.length && list[0].t > snap.t - 1000 * 60 * 1 && list.length >= KEEP) list.shift();
      list.unshift(snap); list = list.slice(0, KEEP);
      return SMRStore.set(autosaveKey, { snaps: list });
    }).catch(() => {});
  }
  function startAutosave(id, resume) {
    autosaveKey = 'resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden) snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotNow(); });
      window.addEventListener('pagehide', snapshotNow);
    };
    if (!resume) { begin(); return; }
    SMRStore.get(autosaveKey).then((saved) => {
      const list = saved && Array.isArray(saved.snaps) ? saved.snaps : saved && saved.state ? [saved] : [];
      if (!list.length) { begin(); return; }
      // try the newest; if it doesn't run (the counter doesn't move in 3 s), the next, then a reset
      const tryAt = (i) => {
        if (i >= list.length) {
          try { Snes9xPlayer.core.reset(); } catch (e) {}
          toast('Every autosave was frozen, so the game restarted: load your file to carry on from your last save station.', 9000);
          SMRStore.set(autosaveKey, { snaps: [] }).catch(() => {});
          begin(); return;
        }
        try { window.EJS_emulator.gameManager.loadState(new Uint8Array(list[i].state)); }
        catch (e) { console.warn('[autosave] could not restore', e); tryAt(i + 1); return; }
        const f0 = frames();
        setTimeout(() => {
          if (frames() === f0) { console.warn('[autosave] snapshot', i, 'is frozen'); tryAt(i + 1); return; }
          if (i) SMRStore.set(autosaveKey, { snaps: list.slice(i) }).catch(() => {});   // the frozen ones go
          toast(i ? 'The last autosave was frozen; picked up from an earlier one (' + Math.round((list[0].t - list[i].t) / 1000) + ' s before)' : 'Picked up where you left off');
          begin();
        }, 3000);
      };
      setTimeout(() => tryAt(0), 600);
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
