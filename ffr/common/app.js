/*
 * app.js — the shared page for the Final Fantasy randomizers (ffr/ff1, ff4,
 * ff5): the emulator (the hub's FCEUmm for NES, Snes9x for SNES), ROM
 * loading, Continue, the tracker hookup, the layout that gives the game
 * picture exactly its size and the tracker the rest, and the links back to
 * the hub. The game's own config is window.FFGame (its game.js).
 *
 * Seeds are rolled on each randomizer's own website (FF1R and Free Enterprise
 * generate in your browser there; Career Day on its server) and the finished
 * ROM is played here: "Play ROM file".
 */
(function () {
  'use strict';
  const G = window.FFGame;
  const $ = (id) => document.getElementById(id);
  const HUB = '../../';
  const SNES = G.system === 'snes';
  const P = () => (SNES ? window.Snes9xPlayer : window.EmuPlayer);

  // ── header links (the way back to the hub and the other games) ───────────
  (function links() {
    const bar = $('hub-links');
    const all = [['Zelda 3', HUB, 'Back to Rando Hub (A Link to the Past)', 'z3'], ['Zelda 1', HUB + 'z1r/', 'The Zelda 1 randomizer', 'z1'], ['GLR', HUB + 'glr/', 'The Guardian Legend randomizer', 'glr'],
      ['FF1', HUB + 'ffr/ff1/', 'Final Fantasy Randomizer (FF1)', 'ff1'], ['FF4', HUB + 'ffr/ff4/', 'Final Fantasy IV: Free Enterprise', 'ff4'], ['FF5', HUB + 'ffr/ff5/', 'Final Fantasy V: Career Day', 'ff5'],
      ['FF6', HUB + 'ff6wc/', 'Final Fantasy VI: Worlds Collide', 'ff6'], ['SMRPG', HUB + 'smrpg/', 'Super Mario RPG: Open World Randomizer', 'smrpg'], ['Patched', HUB + 'patched/', 'Patched games: NES and SNES ROM hacks', 'patched']];
    const R = window.RandoRoll;
    const others = all.filter((l) => l[0] !== G.short && (!R || R.isShown(l[3])));
    // wide: a row of links; narrow: one "Games" dropdown (the header must stay one line)
    bar.innerHTML = others.map((l) => '<a class="btn hub-a" href="' + l[1] + '" title="' + l[2] + '">' + l[0] + '</a>').join('') +
      '<select class="btn hub-sel" id="hub-go" aria-label="Other games"><option value="">Games ▾</option>' + others.map((l) => '<option value="' + l[1] + '">' + l[0] + '</option>').join('') + '</select>';
    $('hub-go').addEventListener('change', (e) => { if (e.target.value) location.href = e.target.value; });
  })();

  // ── tracker ───────────────────────────────────────────────────────────────
  FFTracker.mem = () => {
    const p = P(); const c = p && p.core; if (!c) return null;
    let wram = null, sram = null;
    try { wram = c.wram(); } catch (e) {}
    try { sram = c.sram(); } catch (e) {}
    return wram && wram.length ? { wram, sram: sram && sram.length ? sram : null } : null;
  };
  FFTracker.init($('tracker'));
  FFTracker.onLink((s) => {
    const el = $('link-status');
    el.className = 'pill' + (s === 'live' ? ' on' : s === 'waiting' ? ' wait' : '');
    el.querySelector('span').textContent = s === 'live' ? 'Autotracking' : s === 'waiting' ? 'Waiting for the game' : 'No game running';
  });

  // ── the "Roll a seed" dialog: instructions and the generator's link ───────
  $('roll-dlg').querySelector('.gen-name').textContent = G.generator.name;
  $('roll-dlg').querySelector('.gen-link').href = G.generator.url;
  $('roll-dlg').querySelector('.gen-link').textContent = G.generator.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  $('roll-steps').innerHTML = G.generator.steps.map((s) => '<li>' + s + '</li>').join('');
  $('new-seed').addEventListener('click', () => $('roll-dlg').showModal());
  $('ph-new').addEventListener('click', () => $('roll-dlg').showModal());

  // A stored ROM you were playing: offer to continue it.
  let stored = null;
  FFStore.get('current').then((c) => {
    if (!c || !c.bytes) return;
    stored = { rom: new Uint8Array(c.bytes), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue ' + describe(stored);
    b.hidden = false;
    if (sessionStorage.getItem('ffr:' + G.id + ':autoplay')) { sessionStorage.removeItem('ffr:' + G.id + ':autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  function describe(entry) { return entry.name.replace(/\.[^.]+$/, ''); }

  // ── playing a ROM ────────────────────────────────────────────────────────
  for (const id of ['rom-input', 'rom-input-2']) {
    const inp = $(id); if (!inp) continue;
    inp.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      let bytes = new Uint8Array(await f.arrayBuffer());
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) { alert('That is a .zip file. Unzip it and pick the ROM inside.'); return; }
      const check = G.checkRom ? G.checkRom(bytes, f.name) : null;
      if (check && check.error) { alert(check.error); return; }
      if (check && check.warn && !confirm(check.warn + '\n\nPlay it anyway?')) return;
      if (check && check.bytes) bytes = check.bytes;
      const entry = { rom: bytes, name: f.name, meta: { source: 'file' } };
      await FFStore.set('current', { bytes: bytes.buffer.slice(0), name: f.name, meta: entry.meta }).catch(() => {});
      logSeed(entry);
      play(entry);
    });
  }
  function logSeed(entry) {
    try {
      const l = JSON.parse(localStorage.getItem('rhb-seed-log') || '[]');
      l.push({ at: Date.now(), game: G.short, what: describe(entry), generator: G.generator.name, kind: 'manual' });
      localStorage.setItem('rhb-seed-log', JSON.stringify(l.slice(-500)));
    } catch (e) {}
  }

  let booted = false;
  async function play(entry, opts) {
    if (booted) {
      if (!confirm('Switch to ' + describe(entry) + '? The current game closes; its saves stay in this browser.')) return;
      await FFStore.set('current', { bytes: entry.rom.buffer.slice(0), name: entry.name, meta: entry.meta }).catch(() => {});
      sessionStorage.setItem('ffr:' + G.id + ':autoplay', '1');
      location.reload();
      return;
    }
    booted = true;
    const id = FFHash(entry.rom);
    const meta = Object.assign({}, entry.meta || {});
    if (G.readMeta) { try { Object.assign(meta, (await G.readMeta(entry.rom)) || {}); } catch (e) { console.warn('[ffr] rom metadata', e); } }
    FFTracker.setSession(id, entry.name, meta);
    document.title = describe(entry) + ' - ' + G.name;
    $('placeholder').remove();
    document.body.classList.add('playing');
    window.EJS_onGameStart = function () { startAutosave(id, !!(opts && opts.resume)); fit(); };
    const p = P();
    if (p.setTouchPlacement) p.setTouchPlacement('overlay');
    p.boot('#game', new File([entry.rom], 'ffr-' + G.id + '-' + id + (SNES ? '.sfc' : '.nes')))
      .catch((e) => { console.error('[ffr] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // ── layout ────────────────────────────────────────────────────────────────
  function aspect() {
    try { const c = JSON.parse(localStorage.getItem(SNES ? 's9x-player-settings' : 'z1r-nes-player-settings') || '{}'); if (c.aspect === '4:3') return 4 / 3; } catch (e) {}
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
      FFTracker.setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      st.setProperty('--aside-w', aside + 'px'); st.removeProperty('--game-h');
      FFTracker.setCompact(H < 560 || aside < 330);
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (/player-settings/.test(e.key || '')) fit(); });
  fit(); setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));

  // ── autosave (Continue after the app was closed) ──────────────────────────
  let autosaveKey = null;
  function snapshotNow() {
    const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    if (!gm || !autosaveKey) return;
    let st; try { st = gm.getState(); } catch (e) { return; }
    if (!st || st.length < 1024) return;
    FFStore.set(autosaveKey, { state: new Uint8Array(st).buffer, t: Date.now() }).catch(() => {});
  }
  function startAutosave(id, resume) {
    autosaveKey = 'resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden) snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotNow(); });
      window.addEventListener('pagehide', snapshotNow);
    };
    if (!resume) { begin(); return; }
    FFStore.get(autosaveKey).then((saved) => {
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
})();
