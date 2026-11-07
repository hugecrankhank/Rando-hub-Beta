/*
 * nes.js — the NES side of the four-game combo, in its own frame (nes.html):
 * Zelda 1 and Metroid in the hub's NES player (../z1r/emu/), one at a time,
 * the other waiting as a saved state (the Zelda 1 + Metroid page's way,
 * ../zm/js/link.js). The page around it (js/link.js) says which one to play
 * and when to stop; this side tells it what was picked up and when Link walks
 * into a "take any road" cave (the way back to Hyrule, ALttP's).
 *
 *   QuadNES.init({ z1, m1, at, id, store, on(event) })   (either may be null: Z1Z3 plays Zelda 1 alone, M1SM Metroid alone)   events:
 *     { type: 'snes', spot, item }    an SNES item picked up on a NES spot (js/link.js hands it over)
 *     { type: 'back' }                Link in a take-any-road cave: back to Hyrule
 *     { type: 'won', game }           Zelda 1's Ganon / Metroid's Mother Brain beaten
 *     { type: 'change' }
 *   QuadNES.enter(game)  → Promise   play 'z1' or 'm1' (boots the player the first time)
 *   QuadNES.leave()                  stop (the state kept)
 *   QuadNES.give(item)               an NES item found in the SNES game: handed over when that game is played
 *   QuadNES.ram(g) / sram(g) / inPlay(g) / atPortal(g) / state / roms / cores / game / onChange(fn)   (the tracker's reads)
 *   QuadNES.save() → Promise         keep everything now
 */
(function () {
  'use strict';
  const Z = window.ZM, M = window.M1, G = window.ZMGen;
  const ZN = Z.SPOTS.length;
  let cores = { z1: null, m1: null }, game = null, at = null, id = null, roms = { z1: null, m1: null }, store = null, on = () => {};
  let states = { z1: null, m1: null }, pending = { z1: [], m1: [] }, taken = new Set(), won = { z1: false, m1: false };
  let armed = false, active = false, booting = null, fns = [], lastSig = '';

  function ram(g) { const c = cores[g || game]; try { return c ? c.wram() : null; } catch (e) { return null; } }
  function sram(g) { const c = cores[g || game]; try { return c ? c.sram() : null; } catch (e) { return null; } }
  function inPlay(g) {
    g = g || game; const r = ram(g); if (!r) return false;
    if (g === 'z1') { const m = r[Z.RAM.MODE]; return m === 5 || m === 0x0B || m === 0x0C || m === 0x13; }
    return r[M.MEM.MODE] === 0 && r[M.MEM.MAP_X] < 32 && r[M.MEM.MAP_Y] < 32 && (r[M.MEM.HP_HI] | r[M.MEM.HP_LO]) !== 0;
  }
  // the NES games' portal spots: Zelda 1's four "take any road" caves, Metroid's elevator rooms
  let opts = { link: 'hub', exits: 'anywhere' };
  function atPortal(g) {
    g = g || game; const r = ram(g); if (!r || !inPlay(g)) return false;
    if (g === 'z1') return !zora && r[Z.RAM.MODE] === 0x0B && Z.PORTAL_SCREENS.indexOf(r[Z.RAM.ROOM]) >= 0;   // (ZORA moves the caves: ⇄ / P only)
    const area = M.AREA_CODE[r[M.MEM.AREA] & 15];
    return M.ELEVATORS.some((e) => e[0] === area && e[1] === r[M.MEM.MAP_X] && e[2] === r[M.MEM.MAP_Y]);
  }

  // ── pickups ──────────────────────────────────────────────────────────────
  function takenNow(g) {
    const out = new Set(), r = ram(g), s = sram(g); if (!r) return out;
    if (g === 'z1' && zora) {   // ZORA's places: each one's pickup flag, once the flags hold the loaded file
      if (checksReadable(r)) at.forEach((it, i) => { if (it && it.check && (r[it.check[0]] & it.check[1])) out.add(i); });
    } else if (g === 'z1') {
      Z.SPOTS.forEach((sp, i) => {
        let f = 0;
        if (sp[2] === 'room') f = r[Z.RAM.WORLD + 0x80 * (sp[3][0] + 1) + sp[3][1]];
        else if (sp[2] === 'cave') f = r[Z.RAM.WORLD + Z.CAVE_SCREEN[sp[3]]];
        else if (sp[2] === 'armos') f = r[Z.RAM.WORLD + Z.ARMOS_SCREEN];
        else if (sp[2] === 'coast') f = r[Z.RAM.WORLD + Z.COAST_SCREEN];
        if (f & 0x10) out.add(i);
      });
    } else if (s && s.length > 0x900) {
      const n = Math.min(s[M.MEM.TAKEN_N], 0x74) & ~1, ids = new Set();
      for (let k = 0; k < n; k += 2) ids.add((s[M.MEM.TAKEN + k] | s[M.MEM.TAKEN + k + 1] << 8) & 0x3FF);
      M.SPOTS.forEach((sp, k) => { const [lo, hi] = M.itemId(sp, 0); if (ids.has((lo | hi << 8) & 0x3FF)) out.add(ZN + k); });
    }
    return out;
  }
  function checkPickups() {
    if (!inPlay(game)) return;
    takenNow(game).forEach((i) => {
      if (taken.has(i)) return;
      taken.add(i);
      const it = at && at[i]; if (!it) return;
      if (it.game === 'snes' || it.game === 'sm') on({ type: 'snes', spot: i, item: it });
      else if (it.game !== game) { pending[it.game].push(it); toast('Found ' + G.itemName(it) + ': it’s waiting for ' + (it.game === 'z1' ? 'Link in Zelda 1' : 'Samus on Zebes') + '.'); }
      save();
    });
  }
  // ── ZORA mode (Z1Z3 with Zelda 1 by ZORA) ─────────────────────────────────
  // Its places are told by ZORA's own pickup checks; Link gets the other game's finds as ZORA's
  // Archipelago client gives them: one at a time, only in normal play (mayReceive), each the way
  // the game's TakeItem gives it (zoraGive, a port of zora/rom/inventory.py's give), counted in the
  // save file ($067B), so a loaded state or an older save never misses one or gets one twice.
  let zora = null, got = [];
  const LOADED = (m) => (m >= 2 && m <= 0x0C) || (m >= 0x10 && m <= 0x13);
  function checksReadable(r) { return LOADED(r[0x12]) && r[0x11] <= 1 && r[0x16] < 3 && r[0xF5] === 0x5A && r[0x528] === 0x5A; }
  function mayReceive(r) { return r[0x12] === 5 && r[0x13] === 0 && r[0x11] === 1 && r[0xE0] === 0 && r[0xE1] === 0 && r[0x506] === 0 && (r[0xAC] & 0xC0) !== 0x40; }
  function zoraGive(code, r) {
    const T = zora, slots = T.slots, desc = T.descriptors, rules = T.give || {}, ITEMS = 0x657;
    if (slots[code] === 0 && r[ITEMS] > 3) return true;   // (a fourth sword: the line's top)
    if (rules.progressive && code < 0x1F) {
      if (code === 0x1D || code === 0x1E) code = 0x1D + r[ITEMS + 0x1D];
      else if ((desc[code] & 0xF0) === 0x20) { const sl = slots[code], f = code - (desc[code] & 0x0F) + r[ITEMS + sl] + 1; code = slots[f] === sl ? f : f - 1; }
    }
    const slot = slots[code], d = desc[code];
    if ([0x10, 0x11, 0x1A, 0x1B, 0x16, 0x1C, 0x14, 0x19].indexOf(slot) >= 0) return false;
    const a = ITEMS + slot, v = d & 0x0F, cur = r[a], kind = d & 0xF0;
    let nv;
    if (kind === 0x00) nv = v;
    else if (kind === 0x20) { nv = Math.max(cur, v); if (rules.l4 && slot === 0 && cur === v && v === 3) nv = 4; }
    else if (kind === 0x10 && slot === 0x18) nv = cur >= 0xF0 ? cur : cur + 0x11;
    else if (kind === 0x10) { nv = Math.min(cur + v, 0xFF); if (slot === 7) nv = Math.min(nv, rules.fourPotions ? 4 : 2); if (slot === 1) nv = Math.min(nv, r[0x67C]); }
    else nv = 0xFF;
    r[a] = nv;
    if (a === 0x662 && Z.tunic) Z.tunic(r, sram('z1'));   // a ring: the tunic's colour too
    return true;
  }
  function deliverZora() {
    const r = ram('z1'); if (!r || !mayReceive(r)) return;
    const c = r[0x67B]; if (c >= got.length) return;
    const it = got[c];
    zoraGive(it.type, r); r[0x67B] = c + 1;
    toast('Link received ' + (it.name || G.itemName(it)) + '.');
    emit();
  }
  function giveZelda(it) {
    const r = ram('z1'), g = Z.GIVE[it.type]; if (!r || !g) return;
    if (g[0] === 'hc') { const h = r[Z.RAM.HEARTS]; const c = Math.min(15, (h >> 4) + 1); r[Z.RAM.HEARTS] = (c << 4) | 0x0F; r[0x670] = 0xFF; return; }
    if (g[1] === 'max') r[g[0]] = Math.max(r[g[0]], g[2]); else r[g[0]] = g[1];
    if (g[0] === 0x662 && Z.tunic) Z.tunic(r, sram('z1'));   // a ring: the tunic's colour too
  }
  // a ring handed over before Link's tunic followed it (or a save from then): put the colour right
  let tunicT = 0;
  function fixTunic() {
    const now = Date.now(); if (now - tunicT < 1000) return; tunicT = now;
    const r = ram('z1'), s = sram('z1'); if (!r || !s || !Z.tunic || !r[0x662]) return;
    const want = [0x29, 0x32, 0x16][Math.min(2, r[0x662])];
    if (s[0x804 + Math.min(2, r[0x16]) * 4] !== want) Z.tunic(r, s);
  }
  function giveMetroid(it) {
    const s = sram('m1'), r = ram('m1'); if (!s || !r) return;
    const t = it.type;
    if (t <= 7) s[M.MEM.GEAR] |= 1 << t;
    else if (t === 8) { s[M.MEM.TANKS] = Math.min(6, s[M.MEM.TANKS] + 1); const n = s[M.MEM.TANKS]; r[M.MEM.HP_HI] = ((n / 10 | 0) << 4) | (n % 10); r[M.MEM.HP_LO] = 0x99; }
    else { s[M.MEM.MAX_MISSILES] = Math.min(255, s[M.MEM.MAX_MISSILES] + 5); s[M.MEM.MISSILES] = Math.min(255, s[M.MEM.MISSILES] + 5); }
  }
  function deliver() {
    if (zora && game === 'z1') deliverZora();
    if (!game || !pending[game].length || !inPlay(game)) return;
    const list = pending[game]; pending[game] = [];
    list.forEach((it) => { if (game === 'z1') giveZelda(it); else giveMetroid(it); });
    toast((game === 'z1' ? 'Link' : 'Samus') + ' received ' + list.map(G.itemName).join(', ') + '.');
    save();
  }
  function toast(t) { try { parent.QuadToast && parent.QuadToast(t, 5000); } catch (e) {} }

  // ── keeping it ───────────────────────────────────────────────────────────
  const P = () => window.EmuPlayer;
  function grabState() {
    const p = P();
    try { if (active && p && p.core && cores[game] === p.core && (!window.QuadNESHealth || QuadNESHealth.alive())) states[game] = p.core.saveState(); } catch (e) {}
  }
  function record() { return { states: { z1: states.z1 ? states.z1.buffer.slice(0) : null, m1: states.m1 ? states.m1.buffer.slice(0) : null }, pending, got, taken: Array.from(taken), won, game, t: Date.now() }; }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    return new Promise((res) => { saveT = setTimeout(() => { grabState(); if (!id || !store) { res(); return; } store.set('quad-nes:' + id, record()).then(res, res); }, 150); });
  }
  function emit() { fns.forEach((f) => { try { f(); } catch (e) {} }); on({ type: 'change' }); }

  // ── the loop ─────────────────────────────────────────────────────────────
  function poll() {
    if (!active || !cores[game]) return;
    checkPickups(); deliver();
    if (game === 'z1' && inPlay('z1')) fixTunic();
    const here = atPortal(game);
    if (!here) armed = true;
    else if (armed) { armed = false; if (game === 'z1' && opts.link !== 'linked') on({ type: 'back', auto: true }); }   // (linked: the caves ask, ⇄ Zebes or ⇄ Hyrule)
    const z = ram('z1'), m = ram('m1');
    if (game === 'z1' && z && z[Z.RAM.MODE] === 0x13 && !won.z1) { won.z1 = true; on({ type: 'won', game: 'z1' }); save(); }
    if (game === 'm1' && m && m[0x1E] === 7 && inPlay('m1') && !won.m1) { won.m1 = true; on({ type: 'won', game: 'm1' }); save(); }
    const r = ram(game);
    const sig = game + ':' + (r ? (inPlay(game) ? 1 : 0) : 'x') + ':' + taken.size + ':' + pending.z1.length + ':' + pending.m1.length + ':' + got.length + ':' + (here ? 1 : 0);
    if (sig !== lastSig) { lastSig = sig; emit(); }
  }

  // ── playing ──────────────────────────────────────────────────────────────
  function boot(first) {
    if (booting) return booting;
    const p = P();
    // the player boots Zelda 1, Metroid comes in as a second core; Z1Z3 has no Metroid, M1SM no Zelda 1 (then Metroid is the one booted)
    const main = roms.z1 ? 'z1' : 'm1';
    booting = (roms.m1 && main === 'z1' ? p.newCore(roms.m1, 'quad-' + id + '-metroid') : Promise.resolve(null)).then((m1core) => {
      cores.m1 = m1core;
      return new Promise((resolve, reject) => {
        window.EJS_onGameStart = function () {
          cores[main] = p.core;
          setInterval(poll, 150);
          setInterval(() => { if (active && !document.hidden) save(); }, 20000);
          document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
          window.addEventListener('pagehide', () => { grabState(); });
          document.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !e.repeat && active) { e.preventDefault(); on({ type: 'back' }); } });   // P: back to Hyrule
          if (window.RHHealth) window.QuadNESHealth = RHHealth.create(main === 'z1' ? { counter: (r) => (r[0x15] ^ r[0x2D]) | r[0x2E] << 8 | r[0x2F] << 16 } : {});
          resolve();
        };
        if (p.setTouchPlacement) p.setTouchPlacement('overlay');
        p.boot('#game', new File([roms[main]], 'quad-' + id + (main === 'z1' ? '-zelda.nes' : '-metroid.nes'))).catch(reject);
      });
    });
    return booting;
  }
  function enter(g) {
    return boot().then(() => {
      const p = P();
      if (game && game !== g && active) { grabState(); }
      if (p.core !== cores[g]) { const old = p.attach(cores[g]); const other = g === 'z1' ? 'm1' : 'z1'; if (old && old !== cores[g]) cores[other] = old; }
      game = g;
      if (states[g]) { try { p.core.loadState(states[g]); } catch (e) { console.warn('[quad] NES state', e); } }
      armed = false; active = true; lastSig = '';
      const e = window.EJS_emulator; if (e && e.play) e.play();
      try { window.focus(); const c = document.querySelector('#game canvas'); if (c) c.focus(); } catch (e2) {}
      emit();
    });
  }
  function leave() {
    if (!active) return Promise.resolve();
    grabState();
    active = false;
    const e = window.EJS_emulator; if (e && e.pause) e.pause();
    emit();
    return save();
  }

  function init(o) {
    at = o.at; id = o.id; roms = { z1: o.z1, m1: o.m1 }; store = o.store; on = o.on || on; opts = Object.assign(opts, o.options || {}); zora = o.zora || null;
    return (o.resume && store ? store.get('quad-nes:' + id) : Promise.resolve(null)).then((saved) => {
      if (!saved) return;
      states = { z1: saved.states && saved.states.z1 ? new Uint8Array(saved.states.z1) : null, m1: saved.states && saved.states.m1 ? new Uint8Array(saved.states.m1) : null };
      pending = saved.pending || { z1: [], m1: [] }; got = saved.got || []; taken = new Set(saved.taken || []); won = saved.won || { z1: false, m1: false };
      game = saved.game || null;
    });
  }

  window.QuadNES = {
    init, enter, leave, ram, sram, inPlay, atPortal, save,
    give(it) { if (!it || (it.game !== 'z1' && it.game !== 'm1')) return; if (zora && it.game === 'z1') got.push(it); else pending[it.game].push(it); save(); emit(); },
    get game() { return game || (roms.z1 ? 'z1' : 'm1'); },
    get active() { return active; },
    get booted() { return !!(cores.z1 || (!roms.z1 && cores.m1)); },
    get state() { return { game: game || (roms.z1 ? 'z1' : 'm1'), taken, pending, won, got, given: { z1: 0, m1: 0 } }; },
    get zora() { return zora; },
    get cores() { return cores; },
    get roms() { return roms; },
    onChange(f) { fns.push(f); },
  };
})();
