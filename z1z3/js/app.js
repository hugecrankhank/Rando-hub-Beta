/*
 * app.js — the Z1Z3 page: the seed dialog (js/seed.js), A Link to the Past in
 * the hub's Snes9x (../emu/), Zelda 1 in a frame over it (../cross/nes.html,
 * js/link.js), and the tracker column: A Link to the Past's trackers (Mudora
 * 2.0, Mudora, Hutch: ../smz3/z3host.html?plain=1) or Zelda 1's
 * (../cross/nes-tracker.html?only=z1), following the game being played.
 * Continue, autosave (../game-health.js), layout, controller light.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // what the Zelda 1 tracker and the NES frame look for on this page (as on Rando Cross's)
  window.QuadApp = { meta: null, id: null };
  window.Z1Z3Toast = window.QuadToast = toast;

  // ── the tracker column ───────────────────────────────────────────────────
  let col = 'z3', colPicked = false, z3Trk = null, nesTrk = null;
  const Z3_KIND = () => { try { const v = localStorage.getItem('z1z3:z3trk'); return ['mudora2', 'mudora', 'hutch'].indexOf(v) >= 0 ? v : 'mudora2'; } catch (e) { return 'mudora2'; } };
  function buildColumn() {
    const root = $('tracker');
    root.innerHTML = '<div class="q-col"><button type="button" data-c="z3" title="A Link to the Past: the Zelda 3 page’s trackers">A Link to the Past</button><button type="button" data-c="z1" title="Zelda 1: its items, spots and map">Zelda 1</button></div>' +
      '<div class="q-portal-line" id="q-portals"></div>' +
      '<div class="q-pops"><select id="z3-kind" title="Which Zelda 3 tracker"><option value="mudora2">Mudora 2.0</option><option value="mudora">Mudora</option><option value="hutch">Hutch</option></select>' +
      '<button type="button" data-p="z3" title="A Link to the Past’s tracker in a window of its own">⧉ ALttP tracker</button><button type="button" data-p="z1items" title="Zelda 1’s items in a window of its own">⧉ Zelda 1 items</button><button type="button" data-p="z1map" title="Zelda 1’s map in a window of its own">⧉ Zelda 1 map</button></div>' +
      '<div class="z3-tabs" id="z3-tabs"><button type="button" data-t="items">Items</button><button type="button" data-t="lw">Light</button><button type="button" data-t="dw">Dark</button><button type="button" data-t="keys">Keys</button></div>' +
      '<iframe id="z3-trk" title="A Link to the Past tracker"></iframe><iframe id="nes-trk" title="Zelda 1 tracker"></iframe>';
    z3Trk = $('z3-trk'); nesTrk = $('nes-trk');
    $('z3-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPhone(b.dataset.t); });
    z3Trk.addEventListener('load', () => setTimeout(() => setPhone(compact ? phoneTab : null), 800));
    const kind = $('z3-kind'); kind.value = Z3_KIND();
    kind.addEventListener('change', () => { try { localStorage.setItem('z1z3:z3trk', kind.value); } catch (e) {} if (QuadApp.meta) z3Trk.src = z3Src(); });
    kind.style.cssText = 'background:none;border:1px solid var(--cell-line);border-radius:4px;color:var(--dim);font:400 12px/1 var(--px);padding:5px 6px;';
    root.querySelector('.q-col').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { colPicked = true; setCol(b.dataset.c); } });
    root.querySelector('.q-pops').addEventListener('click', (e) => { const b = e.target.closest('button[data-p]'); if (b) popOut(b.dataset.p); });
    setCol('z3');
  }
  const z3Src = () => '../smz3/z3host.html?plain=1&t=' + Z3_KIND();
  // Zelda 1's tracker: with Zelda 1 by ZORA, the Z1R page's own (its real overworld and levels); else the Zelda 1 + Metroid one
  const z1Src = (view) => (QuadApp.meta && QuadApp.meta.zora ? 'z1r-tracker.html' : '../cross/nes-tracker.html?only=z1' + (view ? '&view=' + view : ''));
  // phones (as on Rando Cross and SMZ3): the Zelda 3 tracker one panel at a time, picked by a row
  // of tabs (items, Light World, Dark World, keys); bigger screens: the whole tracker
  let compact = false, phoneTab = 'items';
  function setPhone(t) {
    if (t) phoneTab = t;
    document.querySelectorAll('#z3-tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === phoneTab ? 'true' : 'false'));
    try { z3Trk.contentWindow.postMessage({ type: 'smz3-phone', tab: compact ? phoneTab : null }, '*'); } catch (e) {}
  }
  function setCompact(on) {
    on = !!on; if (on === compact) return;
    compact = on; $('tracker').classList.toggle('compact', on); setPhone(null);
  }
  function setCol(c) {
    col = c;
    $('tracker').classList.toggle('c-z3', c === 'z3'); $('tracker').classList.toggle('c-z1', c === 'z1');
    document.querySelectorAll('.q-col button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === c ? 'true' : 'false'));
    if (QuadApp.meta) {
      if (c === 'z3' && !z3Trk.getAttribute('src')) z3Trk.src = z3Src();
      const z1src = z1Src(), zm = !!QuadApp.meta.zora, pm = document.querySelector('.q-pops [data-p=z1map]'), pi = document.querySelector('.q-pops [data-p=z1items]');
      if (pm) pm.hidden = zm;   // (the Z1R tracker is one page: items, levels and the map)
      if (pi) pi.textContent = zm ? '⧉ Zelda 1 tracker' : '⧉ Zelda 1 items';
      if (c === 'z1' && nesTrk.getAttribute('src') !== z1src) nesTrk.src = z1src;
    }
  }
  const wins = {};
  function popOut(k) {
    let w = wins[k];
    if (w && !w.closed) { w.focus(); return; }
    const url = k === 'z3' ? z3Src() : z1Src(k === 'z1map' ? 'map' : 'items');
    w = window.open(url, 'z1z3-' + k, 'popup=yes,resizable=yes,width=' + (k === 'z1map' ? 900 : k === 'z3' ? 760 : 520) + ',height=' + (k === 'z1map' ? 560 : 720));
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    wins[k] = w;
    if (window.RHPopout && RHPopout.opened) RHPopout.opened(w);   // the game gets the page (../game-popout.js)
  }
  window.addEventListener('pagehide', () => Object.keys(wins).forEach((k) => { try { wins[k].close(); } catch (e) {} }));
  function paintPortals() {
    const el = $('q-portals'), m = QuadApp.meta; if (!el || !m) return;
    el.innerHTML = (m.portal && m.portal.hub ? m.portal.hub.replace(/^t/, 'T') : 'Kakariko') + ' is the hub: walk into <b>' + ((m.portal && m.portal.name) || 'the Elder’s House') + '</b> for Zelda 1’s Hyrule' + (m.zora ? ' (by ZORA)' : '') + '. Back: ' + (m.zora ? '⇄ / P.' : (m.options || {}).exits === 'exits' ? 'a “take any road” cave.' : '⇄ / P, or a “take any road” cave.') +
      ' <label class="q-sign-opt" title="The small “this way back” note over Zelda 1, at a way back"><input type="checkbox" id="q-signs"' + (Z1Z3Link.signs ? ' checked' : '') + '>Direction signs</label>';
    const sw = $('swap'); if (sw) { const k = !m.portal || !m.portal.hub || m.portal.hub === 'Kakariko'; sw.innerHTML = '⇄<span class="sw-l"> Back to ' + (k ? 'Kakariko' : 'ALttP') + '</span>'; sw.title = 'Back to ' + ((m.portal && m.portal.hub) || 'Kakariko') + ' (A Link to the Past): the P key does it too'; }
    const cb = $('q-signs'); if (cb) cb.addEventListener('change', () => { Z1Z3Link.signs = cb.checked; });
  }
  buildColumn();

  // ── seed dialog ──────────────────────────────────────────────────────────
  Z1Z3Seed.init({ onPlay: (entry, opts) => play(entry, opts) });
  $('new-seed').addEventListener('click', Z1Z3Seed.open);
  $('ph-new').addEventListener('click', Z1Z3Seed.open);

  let stored = null;
  SMZ3Store.get('z1z3-current').then((c) => {
    if (!c || !c.rom) return;
    stored = { rom: new Uint8Array(c.rom), z1: new Uint8Array(c.z1), name: c.name, meta: c.meta || {} };
    const b = $('ph-continue');
    b.textContent = 'Continue seed ' + (stored.meta.seed || '?');
    b.hidden = false;
    if (sessionStorage.getItem('z1z3:autoplay')) { sessionStorage.removeItem('z1z3:autoplay'); play(stored); }
  });
  $('ph-continue').addEventListener('click', () => stored && play(stored, { resume: true }));
  const remember = (e) => SMZ3Store.set('z1z3-current', { rom: e.rom.buffer.slice(0), z1: e.z1.buffer.slice(0), name: e.name, meta: e.meta }).catch(() => {});

  let booted = false;
  // a new seed: Mudora 2.0 starts a new game set to match it, as on the Zelda 3 page (../mudora2/mudora2.js
  // reads this when it opens, or as it changes); without it, it reopened the last seed's game and checks
  function newTrackerGame(name, flags) { try { localStorage.setItem('rhb-seed-tracker', JSON.stringify({ at: Date.now(), name, flags })); } catch (e) {} }
  async function play(entry, opts) {
    if (booted) {
      if (!(opts && opts.confirmed) && !confirm('Switch to seed ' + entry.meta.seed + '? The current game closes; its saves stay in this browser.')) return;
      await remember(entry);
      sessionStorage.setItem('z1z3:autoplay', '1');
      window.RHLeaving = true; location.reload();
      return;
    }
    booted = true;
    if (!(opts && opts.resume)) {
      await remember(entry);
      const o = entry.meta.options || {};
      newTrackerGame('z1z3-' + entry.meta.seed, { gamemode: o.mode || 'open',
        seed: { goal: o.z3goal === 'fast_ganon' ? 'fastganon' : o.z3goal || 'ganon', ganon: o.ganon || o.crystals || '7', gt: o.tower || o.crystals || '7', logic: 'noglitches', swords: o.weapons || 'randomized', inverted: 1 },
        dungeonitems: { mc: 'mapcompass', mcs: 'mapcompasskeys', full: 'keysanity' }[o.dungeon_items] || 'standard', more: { pseudoboots: o.boots === 'pseudo' ? 'yes' : 'no' } });
    }
    const id = SMZ3Hash(entry.rom);
    QuadApp.meta = entry.meta; QuadApp.id = id;
    document.title = 'Seed ' + entry.meta.seed + ' - Z1Z3';
    $('placeholder').remove();
    document.body.classList.add('playing');
    Z1Z3Seed.release();
    setCol(col);
    const resume = !!(opts && opts.resume);
    window.EJS_onGameStart = function () {
      startAutosave(id, resume, () => {
        paintPortals();
        if (!resume) { const P = entry.meta.portal || {}; toast((P.hub || 'Kakariko').replace(/^t/, 'T') + ' is the hub: walk into ' + (P.name || 'the Elder’s House (either door)') + ' for Zelda 1’s Hyrule.', 9000); }
        Z1Z3Link.start({ meta: entry.meta, z1: entry.z1, id, resume, frame: $('nes-frame') })
          .catch((e) => { console.error('[z1z3] link', e); toast('Zelda 1 didn’t start: ' + (e && e.message || e), 8000); });
      });
      fit();
    };
    if (Snes9xPlayer.setTouchPlacement) Snes9xPlayer.setTouchPlacement('overlay');
    Snes9xPlayer.boot('#game', new File([await withMedia(entry.rom)], 'z1z3-' + id + '.sfc')).catch((e) => { console.error('[z1z3] emulator failed', e); toast('The game didn’t start: ' + (e && e.message || e)); });
    fit();
  }

  // Link's sprite and the MSU-1 pack (../z3-media.js) go into the ROM that boots
  async function withMedia(rom) {
    for (let i = 0; i < 60 && !window.RHZ3Media; i++) await new Promise((r) => setTimeout(r, 50));
    try { return window.RHZ3Media ? await RHZ3Media.prepare(rom) : rom; } catch (e) { console.warn('[z1z3] media', e); return rom; }
  }

  // ── back from Zelda 1 ────────────────────────────────────────────────────
  $('swap').addEventListener('click', () => Z1Z3Link.back());
  document.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !e.repeat && Z1Z3Link.where !== 'z3') { e.preventDefault(); Z1Z3Link.back(); } });
  let lastWhere = 'z3';
  Z1Z3Link.onChange(() => {
    const w = Z1Z3Link.where;
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
      setCompact(W < 700 || H - gh < 420);
    } else {
      let gw = Math.round(H * a);
      if (W - gw < MIN_ASIDE) gw = W - MIN_ASIDE;
      const aside = Math.max(MIN_ASIDE, W - gw);
      document.documentElement.style.setProperty('--aside-w', aside + 'px');
      document.documentElement.style.removeProperty('--game-h');
      setCompact(H < 560 || aside < 330);
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('storage', (e) => { if (e.key === 's9x-player-settings') fit(); });
  fit(); setTimeout(fit, 50);
  window.addEventListener('load', () => setTimeout(fit, 100));

  // ── autosave ──────────────────────────────────────────────────────────────
  // A Link to the Past: a snapshot every 20 s, at the portal and when the app
  // goes to the background (never of a frozen game, the last three good ones
  // kept: ../game-health.js); Zelda 1 keeps its own (../cross/js/nes.js), the
  // link its record (js/link.js). Continue puts all three back.
  let autosaveKey = null;
  const health = RHHealth.create({ counter: (r) => r[0x1A] | r[0x5B6] << 8, onFrozen: () => toast('The game seems to have frozen: the autosave keeps the last point it was running. Reload to go back there.', 8000) });
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
  window.Z1Z3Snapshot = snapshotNow;
  function startAutosave(id, resume, then) {
    autosaveKey = 'z1z3-resume:' + id;
    const begin = () => {
      setInterval(() => { if (!document.hidden && Z1Z3Link.where === 'z3') snapshotNow(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) { snapshotNow(); if (Z1Z3Link.nes) Z1Z3Link.nes.save(); } });
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
