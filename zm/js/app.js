/*
 * app.js — wires the Zelda 1 + Metroid page together: the two games in the
 * NES player (../z1r/emu/, the hub's FCEUmm) through the link (js/link.js),
 * the tracker, the layout, the autosave and the PWA bits.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  window.ZMToast = toast;

  // ── tracker ───────────────────────────────────────────────────────────────
  if (window.ZMTitle) ZMTitle.init($('game-wrap'));
  ZMTracker.init($('tracker'));
  ZMTracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });
  // the portal button: Zebes' elevator rooms (Hyrule's caves open by themselves)
  function paintPortal() {
    const b = $('portal'), st = ZMLink.state;
    const show = booted && st.game === 'm1' && ZMLink.atPortal('m1');
    b.hidden = !show;
    b.textContent = '⇄ To Hyrule';
  }
  ZMLink.onChange(paintPortal);
  $('portal').addEventListener('click', () => { if (ZMLink.atPortal(ZMLink.game)) ZMLink.portal(); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !e.repeat && booted && ZMLink.atPortal(ZMLink.game)) { e.preventDefault(); ZMLink.portal(); } });

  // ── seed dialog ──────────────────────────────────────────────────────────
  ZMSeed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', ZMSeed.open);
  $('ph-new').addEventListener('click', ZMSeed.open);

  let stored = null;
  ZMStore.get('current').then((c) => {
    if (!c || !c.z1) return;
    stored = { z1: new Uint8Array(c.z1), m1: new Uint8Array(c.m1), at: c.at, meta: c.meta || {}, name: c.name };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('zmr:autoplay')) { sessionStorage.removeItem('zmr:autoplay'); play(stored, { resume: true }); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  function describe(entry) { return 'seed ' + (entry.meta && entry.meta.seed || '?'); }
  function remember(entry) { return ZMStore.set('current', { z1: entry.z1.buffer.slice(0), m1: entry.m1.buffer.slice(0), at: entry.at, meta: entry.meta, name: entry.name }).catch(() => {}); }

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await remember(entry);
      sessionStorage.setItem('zmr:autoplay', '1');
      window.RHLeaving = true; location.reload();
      return;
    }
    booted = true;
    if (!(opts && opts.resume)) await remember(entry);
    const id = ZMHash(entry.z1) + ZMHash(entry.m1);
    ZMTracker.setSession(id, describe(entry), entry.meta || {});
    document.title = describe(entry) + ' - Zelda 1 + Metroid';
    $('placeholder').remove();
    document.body.classList.add('playing');
    ZMSeed.release();
    ZMLink.start({ z1: entry.z1, m1: entry.m1, at: entry.at, id, resume: !!(opts && opts.resume), onStart: () => { startHealth(); fit(); paintPortal(); } })
      .catch((e) => { console.error('[zm] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
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
      ZMTracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      st.setProperty('--aside-w', aside + 'px'); st.removeProperty('--game-h');
      ZMTracker.setCompact(H < 560 || aside < 330);
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (e.key === 'z1r-nes-player-settings') fit(); });
  fit(); setTimeout(fit, 50); window.addEventListener('load', () => setTimeout(fit, 100));

  // ── the crash guard ───────────────────────────────────────────────────────
  // The link keeps both games' states (every 20 s, at every portal, and when
  // the app goes to the background); a frozen game isn't saved (../game-health.js:
  // Zelda's frame counter $15, Metroid's $2D..$2F, whichever is playing).
  function startHealth() {
    const health = RHHealth.create({ counter: (r) => (r[0x15] ^ r[0x2D]) | r[0x2E] << 8 | r[0x2F] << 16,
      onFrozen: () => toast('The game seems to have frozen: the last save keeps the point it was running. Reload to go back there.', 8000) });
    window.ZMHealth = health;
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
