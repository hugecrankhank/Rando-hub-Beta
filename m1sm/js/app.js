/*
 * app.js — the M1SM page: the seed dialog (js/seed.js), Super Metroid in the
 * hub's Snes9x (../emu/), Metroid in a frame over it (../cross/nes.html,
 * js/link.js), and the tracker column: Super Metroid's (sm-tracker.html: the
 * Super Metroid page's tracker, map and DASH's logic) or Metroid's
 * (../cross/nes-tracker.html?only=m1), following the game being played.
 * Continue, autosave (../game-health.js), layout, controller light.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // what the trackers and the NES frame look for on this page (the Metroid one as on Rando Cross's)
  window.M1SMApp = window.QuadApp = { meta: null, id: null };
  window.M1SMToast = window.QuadToast = toast;

  // ── the tracker column ───────────────────────────────────────────────────
  let col = 'sm', colPicked = false, smTrk = null, nesTrk = null;
  function buildColumn() {
    const root = $('tracker');
    root.innerHTML = '<div class="q-col"><button type="button" data-c="sm" title="Super Metroid: the Super Metroid page’s tracker, map and DASH’s logic">Super Metroid</button><button type="button" data-c="m1" title="Metroid: its items, spots and map">Metroid</button></div>' +
      '<div class="q-portal-line" id="q-portals"></div>' +
      '<div class="q-pops"><button type="button" data-p="sm" title="Super Metroid’s tracker in a window of its own">⧉ Super Metroid tracker</button><button type="button" data-p="m1items" title="Metroid’s items in a window of its own">⧉ Metroid items</button><button type="button" data-p="m1map" title="Metroid’s map in a window of its own">⧉ Metroid map</button></div>' +
      '<iframe id="z3-trk" title="Super Metroid tracker"></iframe><iframe id="nes-trk" title="Metroid tracker"></iframe>';
    smTrk = $('z3-trk'); nesTrk = $('nes-trk');
    root.querySelector('.q-col').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { colPicked = true; setCol(b.dataset.c); } });
    root.querySelector('.q-pops').addEventListener('click', (e) => { const b = e.target.closest('button[data-p]'); if (b) popOut(b.dataset.p); });
    setCol('sm');
  }
  function setCol(c) {
    col = c;
    $('tracker').classList.toggle('c-z3', c === 'sm'); $('tracker').classList.toggle('c-z1', c === 'm1');
    document.querySelectorAll('.q-col button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === c ? 'true' : 'false'));
    if (M1SMApp.meta) {
      if (c === 'sm' && !smTrk.getAttribute('src')) smTrk.src = 'sm-tracker.html';
      if (c === 'm1' && !nesTrk.getAttribute('src')) nesTrk.src = '../cross/nes-tracker.html?only=m1';
    }
  }
  const wins = {};
  function popOut(k) {
    let w = wins[k];
    if (w && !w.closed) { w.focus(); return; }
    const url = k === 'sm' ? 'sm-tracker.html' : '../cross/nes-tracker.html?only=m1&view=' + (k === 'm1map' ? 'map' : 'items');
    w = window.open(url, 'm1sm-' + k, 'popup=yes,resizable=yes,width=' + (k === 'm1map' ? 900 : k === 'sm' ? 620 : 520) + ',height=' + (k === 'm1map' ? 560 : 760));
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    wins[k] = w;
    if (window.RHPopout && RHPopout.opened) RHPopout.opened(w);   // the game gets the page (../game-popout.js)
  }
  window.addEventListener('pagehide', () => Object.keys(wins).forEach((k) => { try { wins[k].close(); } catch (e) {} }));
  function paintPortals() {
    const el = $('q-portals'), m = M1SMApp.meta; if (!el || !m) return;
    el.innerHTML = 'The way into Metroid: <b>' + ((m.portal && m.portal.name) || 'Crateria’s Map Station') + '</b> (' + ((m.portal && m.portal.how) || '') + '). Back: ' + (m.exits === 'exits' ? 'one of Metroid’s elevator rooms.' : '⇄ / P, anywhere.') +
      ' <label class="q-sign-opt" title="The small “this way to Metroid / back to Crateria” notes over the games"><input type="checkbox" id="q-signs"' + (M1SMLink.signs ? ' checked' : '') + '>Direction signs</label>';
    const cb = $('q-signs'); if (cb) cb.addEventListener('change', () => { M1SMLink.signs = cb.checked; });
  }
  buildColumn();

  // ── seed dialog ──────────────────────────────────────────────────────────
  M1SMSeed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', M1SMSeed.open);
  $('ph-new').addEventListener('click', M1SMSeed.open);

  let stored = null;
  SMRStore.get('m1sm-current').then((c) => {
    if (!c || !c.rom) return;
    stored = { rom: new Uint8Array(c.rom), m1: new Uint8Array(c.m1), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue seed ' + (stored.meta.seed || '?');
    b.hidden = false;
    if (sessionStorage.getItem('m1sm:autoplay')) { sessionStorage.removeItem('m1sm:autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  const remember = (e) => SMRStore.set('m1sm-current', { rom: e.rom.buffer.slice(0), m1: e.m1.buffer.slice(0), name: e.name, meta: e.meta }).catch(() => {});

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to seed ' + entry.meta.seed + '? The current game closes; its saves stay in this browser.')) return;
      await remember(entry);
      sessionStorage.setItem('m1sm:autoplay', '1');
      window.RHLeaving = true; location.reload();
      return;
    }
    booted = true;
    if (!(opts && opts.resume)) await remember(entry);
    const id = SMRHash(entry.rom);
    M1SMApp.meta = entry.meta; M1SMApp.id = id;
    document.title = 'Seed ' + entry.meta.seed + ' - M1SM';
    $('placeholder').remove();
    document.body.classList.add('playing');
    M1SMSeed.release();
    setCol(col);
    const resume = !!(opts && opts.resume);
    window.EJS_onGameStart = function () {
      startAutosave(id, resume, () => {
        paintPortals();
        if (!resume) toast('The way into Metroid: Crateria’s Map Station, through the Parlor’s top right door and the Pre-Map Flyway.', 9000);
        M1SMLink.start({ meta: entry.meta, m1: entry.m1, id, resume, frame: $('nes-frame') })
          .catch((e) => { console.error('[m1sm] link', e); toast('Metroid didn’t start: ' + (e && e.message || e), 8000); });
      });
      fit();
    };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', new File([entry.rom], 'm1sm-' + id + '.sfc')).catch((e) => { console.error('[m1sm] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // ── back from Metroid ────────────────────────────────────────────────────
  $('swap').addEventListener('click', () => M1SMLink.back());
  document.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !e.repeat && M1SMLink.where !== 'sm') { e.preventDefault(); M1SMLink.back(); } });
  let lastWhere = 'sm';
  M1SMLink.onChange(() => {
    const w = M1SMLink.where;
    if (w !== lastWhere) { lastWhere = w; colPicked = false; setCol(w); fit(); }   // a column picked by hand holds until the next portal
  });

  // ── layout: the picture gets exactly its size, the tracker the rest ────────
  function aspect() {
    try { const c = JSON.parse(localStorage.getItem('s9x-player-settings') || '{}'); if (c.aspect === '4:3') return 4 / 3; } catch (e) {}
    return 8 / 7;
  }
  const MIN_ASIDE = 260, MIN_ASIDE_TALL = 220;
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
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      document.documentElement.style.setProperty('--aside-w', Math.max(MIN_ASIDE, W - gw) + 'px');
      document.documentElement.style.removeProperty('--game-h');
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (e.key === 's9x-player-settings') fit(); });
  fit(); setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));

  // ── autosave ──────────────────────────────────────────────────────────────
  // Super Metroid: a snapshot every 20 s, at the portal and when the app goes
  // to the background (never of a frozen game, the last three good ones kept:
  // ../game-health.js); Metroid keeps its own (../cross/js/nes.js), the link
  // its record (js/link.js). Continue puts all three back.
  let autosaveKey = null;
  const health = RHHealth.create({ counter: (r) => r[0x5B6] | r[0x5B7] << 8, onFrozen: () => toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000) });
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey || !health.alive()) return;
    let st;
    try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    const snap = { state: new Uint8Array(st).buffer, t: Date.now() };
    const key = autosaveKey;
    SMRStore.get(key).then((v) => SMRStore.set(key, { snaps: RHHealth.push(v, snap) })).catch(() => {});
  }
  window.M1SMSnapshot = snapshotNow;
  function startAutosave(id, resume, then) {
    autosaveKey = 'm1sm-resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden && M1SMLink.where === 'sm') snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) { snapshotNow(); if (M1SMLink.nes) M1SMLink.nes.save(); } });
      window.addEventListener('pagehide', () => { snapshotNow(); });
      then();
    };
    if (!resume) { begin(); return; }
    SMRStore.get(autosaveKey).then((saved) => {
      const list = RHHealth.norm(saved);
      if (!list.length) { begin(); return; }
      setTimeout(() => RHHealth.restore({
        list, health, toast, done: begin,
        load: (state) => { window.EJS_emulator.gameManager.loadState(new Uint8Array(state)); },
        keep: (rest) => SMRStore.set(autosaveKey, { snaps: rest }).catch(() => {}),
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
