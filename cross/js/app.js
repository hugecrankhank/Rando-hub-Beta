/*
 * app.js — wires the four-game combo's page together: the SNES game (the
 * hub's Snes9x, ../emu/) with SMZ3's tracker, the NES games in their frame
 * (nes.html) with the Zelda 1 + Metroid tracker (nes-tracker.html), the link
 * between them (js/link.js), the layout, the autosave and the PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  window.QuadToast = toast;
  window.QuadApp = { meta: null, id: null };

  // ── the SNES tracker (SMZ3's) ────────────────────────────────────────────
  SMZ3Tracker.ram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; return c ? c.wram() : null; };
  SMZ3Tracker.sram = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; try { return c && c.sram ? c.sram() : null; } catch (e) { return null; } };
  SMZ3Tracker.rom = () => { const c = window.Snes9xPlayer && Snes9xPlayer.core; try { return c && c.rom ? c.rom() : null; } catch (e) { return null; } };
  SMZ3Tracker.init($('tracker'));
  SMZ3Tracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── the tracker column: SNES or NES (follows the game being played until you pick) ──
  let col = 'snes', colPicked = false, nesTrk = null;
  function colBar() {
    const root = $('tracker');
    if (root.querySelector('.q-col')) return;
    const bar = document.createElement('div'); bar.className = 'q-col';
    bar.innerHTML = '<button type="button" data-c="snes" title="ALttP and Super Metroid: SMZ3’s tracker">SNES · ALttP + SM</button><button type="button" data-c="nes" title="Zelda 1 and Metroid">NES · Zelda 1 + Metroid</button>';
    bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { colPicked = true; setCol(b.dataset.c); } });
    root.insertBefore(bar, root.firstChild);
    // the way to the NES games, always in sight: this seed's portal caves in Hyrule (ALttP)
    const line = document.createElement('div'); line.className = 'q-portal-line'; line.id = 'q-portals';
    root.insertBefore(line, bar.nextSibling); paintPortals();
    nesTrk = document.createElement('iframe'); nesTrk.id = 'nes-trk'; nesTrk.title = 'Zelda 1 and Metroid tracker';
    root.appendChild(nesTrk);
    setCol(col);
  }
  const NES_NAME = { z1: 'Zelda 1', m1: 'Metroid' };
  // (Kakariko's houses: one line per house, "either door")
  const portalList = (m) => { const seen = new Set(); return (m && m.portals || []).filter((p) => { const k = p.group || p.name; if (seen.has(k)) return false; seen.add(k); return true; }); };
  const portalText = (m) => portalList(m).map((p) => '<b>' + esc(p.group || p.name) + '</b> (' + esc(p.region.replace(/^(Light|Dark) World /, '$1 World: ')) + ') → ' + NES_NAME[p.to])
    .concat(m && m.smPortal ? ['<b>' + esc(m.smPortal.name) + '</b> (Kakariko) → Super Metroid'] : []).join(' · ');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function paintPortals() {
    const el = $('q-portals'); if (!el) return;
    const t = portalText(QuadApp.meta);
    el.innerHTML = t ? (QuadApp.meta.smPortal ? 'Kakariko is the hub: walk into ' : 'To the NES games, walk into: ') + t +   // (Kakariko's: the houses' names say which)
      ' <label class="q-sign-opt" title="The small “this way to Kakariko” note over the game, where the way back is"><input type="checkbox" id="q-signs"' + (QuadLink.signs ? ' checked' : '') + '>Direction signs</label>' : '';
    const cb = $('q-signs'); if (cb) cb.addEventListener('change', () => { QuadLink.signs = cb.checked; });
    el.title = 'In Hyrule (A Link to the Past), go into one of these caves and the NES game takes over. Back: ⇄ (or P), or a “take any road” cave in Zelda 1.';
  }
  function setCol(c) {
    col = c;
    document.body.classList.toggle('q-nes-col', c === 'nes');
    document.querySelectorAll('.q-col button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === c ? 'true' : 'false'));
    if (c === 'nes' && nesTrk && !nesTrk.getAttribute('src') && QuadApp.meta) nesTrk.src = 'nes-tracker.html';
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  // the pop-outs: the NES tracker's items and map in windows of their own
  const nesWins = {};
  function nesPop(view) {
    let w = nesWins[view];
    if (w && !w.closed) { w.focus(); return; }
    w = window.open('nes-tracker.html?view=' + view, 'quad-nes-' + view, 'popup=yes,resizable=yes,width=' + (view === 'map' ? 900 : 520) + ',height=' + (view === 'map' ? 560 : 720));
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    nesWins[view] = w;
    if (window.RHPopout && RHPopout.opened) RHPopout.opened(w);   // the game gets the page (game-popout.js)
  }
  function popButtons() {
    const bar = window.RHPopout && RHPopout.bar && RHPopout.bar(); if (!bar || bar.querySelector('.q-pop')) return;
    bar.insertAdjacentHTML('beforeend', '<button type="button" class="q-pop" data-q="items" title="Zelda 1 and Metroid items in a window of their own">⧉ NES items</button><button type="button" class="q-pop" data-q="map" title="Zelda 1’s Hyrule and Zebes in a window of their own">⧉ NES map</button>');
    bar.addEventListener('click', (e) => { const b = e.target.closest('.q-pop'); if (!b) return; e.stopPropagation(); nesPop(b.dataset.q); });
  }
  window.addEventListener('pagehide', () => Object.keys(nesWins).forEach((k) => { try { nesWins[k].close(); } catch (e) {} }));
  setTimeout(() => { colBar(); popButtons(); }, 400); setTimeout(popButtons, 2500);

  // ── seed dialog ──────────────────────────────────────────────────────────
  QuadSeed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', QuadSeed.open);
  $('ph-new').addEventListener('click', QuadSeed.open);

  let stored = null;
  SMZ3Store.get('quad-current').then((c) => {
    if (!c || !c.rom) return;
    stored = { rom: new Uint8Array(c.rom), z1: new Uint8Array(c.z1), m1: new Uint8Array(c.m1), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue seed ' + (stored.meta.seed || '?');
    b.hidden = false;
    if (sessionStorage.getItem('quad:autoplay')) { sessionStorage.removeItem('quad:autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  const remember = (e) => SMZ3Store.set('quad-current', { rom: e.rom.buffer.slice(0), z1: e.z1.buffer.slice(0), m1: e.m1.buffer.slice(0), name: e.name, meta: e.meta }).catch(() => {});

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to seed ' + entry.meta.seed + '? The current game closes; its saves stay in this browser.')) return;
      await remember(entry);
      sessionStorage.setItem('quad:autoplay', '1');
      window.RHLeaving = true; location.reload();
      return;
    }
    booted = true;
    if (!(opts && opts.resume)) await remember(entry);
    const id = SMZ3Hash(entry.rom);
    QuadApp.meta = entry.meta; QuadApp.id = id;
    SMZ3Tracker.setSession('quad-' + id, 'Seed ' + entry.meta.seed, entry.meta);
    document.title = 'Seed ' + entry.meta.seed + ' - Rando Cross';
    $('placeholder').remove();
    document.body.classList.add('playing');
    QuadSeed.release();
    const frame = $('nes-frame');
    frame.src = 'nes.html';
    const resume = !!(opts && opts.resume);
    window.EJS_onGameStart = function () {
      startAutosave(id, resume, () => {
        paintPortals();
        if (!resume && entry.meta.portals) toast((entry.meta.smPortal ? 'Kakariko is this seed’s hub: ' : 'This seed’s portals to the NES games: ') + portalList(entry.meta).map((p) => (p.group || p.name) + ' → ' + NES_NAME[p.to])
          .concat(entry.meta.smPortal ? [entry.meta.smPortal.name + ' → Super Metroid'] : []).join(', ') + '. Walk into one of those ' + (entry.meta.smPortal ? 'houses' : 'caves') + ' in Hyrule (ALttP).', 12000);
        QuadLink.start({ meta: entry.meta, z1: entry.z1, m1: entry.m1, id, resume, frame })
          .catch((e) => { console.error('[quad] link', e); toast('The NES side didn’t start: ' + (e && e.message || e), 8000); });
      });
      fit();
    };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', new File([await withMedia(entry.rom)], 'quad-' + id + '.sfc')).catch((e) => { console.error('[quad] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // Link's sprite and the MSU-1 pack (../z3-media.js) go into the ROM that boots
  async function withMedia(rom) {
    for (let i = 0; i < 60 && !window.RHZ3Media; i++) await new Promise((r) => setTimeout(r, 50));
    try { return window.RHZ3Media ? await RHZ3Media.prepare(rom) : rom; } catch (e) { console.warn('[combo] media', e); return rom; }
  }

  // ── going back from the NES games ────────────────────────────────────────
  $('swap').addEventListener('click', () => QuadLink.back());
  $('swap-nes').addEventListener('click', () => QuadLink.cross());
  document.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !e.repeat && QuadLink.where !== 'snes') { e.preventDefault(); QuadLink.back(); } });
  let lastWhere = 'snes';
  QuadLink.onChange(() => {
    const w = QuadLink.where;
    if (w !== lastWhere) { lastWhere = w; colPicked = false; setCol(w === 'snes' ? 'snes' : 'nes'); fit(); }   // a column picked by hand holds until the next portal
  });

  // ── layout: the picture gets exactly its size, the tracker the rest ────────
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
  fit(); setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));

  // ── autosave ──────────────────────────────────────────────────────────────
  // The SNES game: a snapshot every 20 s, at every portal and when the app goes
  // to the background (never of a frozen game, the last three good ones kept:
  // ../game-health.js); the NES games keep theirs (js/nes.js), the link its
  // record (js/link.js). Continue puts all three back.
  let autosaveKey = null;
  const health = RHHealth.create({ counter: (r) => r[0x1A] | r[0x5B6] << 8 | r[0x5B7] << 16, onFrozen: () => toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000) });
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey || !health.alive()) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    const snap = { state: new Uint8Array(st).buffer, t: Date.now() };
    const key = autosaveKey;
    SMZ3Store.get(key).then((v) => SMZ3Store.set(key, { snaps: RHHealth.push(v, snap) })).catch(() => {});
  }
  window.QuadSnapshot = snapshotNow;
  function startAutosave(id, resume, then) {
    autosaveKey = 'quad-resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden && QuadLink.where === 'snes') snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) { snapshotNow(); if (QuadLink.nes) QuadLink.nes.save(); } });
      window.addEventListener('pagehide', () => { snapshotNow(); });
      then();
    };
    if (!resume) { begin(); return; }
    SMZ3Store.get(autosaveKey).then((saved) => {
      const list = RHHealth.norm(saved);
      if (!list.length) { begin(); return; }
      setTimeout(() => RHHealth.restore({
        list, health, toast, done: begin,
        load: (state) => { window.EJS_emulator.gameManager.loadState(new Uint8Array(state)); },
        keep: (rest) => SMZ3Store.set(autosaveKey, { snaps: rest }).catch(() => {}),
        reset: () => { Snes9xPlayer.core.reset(); },
      }), 600);
    });
  }
  function toast(text, ms, kind) {
    if (kind === 'item' && window.RHItemToast) { RHItemToast(text, ms); return; }   // an item crossing games: over the picture's top (../combo-toast.js)
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
