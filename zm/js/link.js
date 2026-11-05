/*
 * link.js — the link between Hyrule and Zebes: two games in one player, the
 * portals between them, and the items each one finds for the other.
 *
 * Both games run in the hub's NES emulator, one at a time: the one being
 * played is live, the other waits as a saved state. A portal swaps them in a
 * moment (the player's attach()), each game going on where it was left.
 *
 *   portals  Hyrule → Zebes: enter one of the four "take any road" caves
 *            (screens $1D, $23, $49, $79) and Link steps into Zebes, where
 *            Samus is (her ship, the first time).
 *            Zebes → Hyrule: in an elevator room, the ⇄ button (or the P key)
 *            takes Samus to Hyrule, where Link is.
 *   items    a Metroid item found in Hyrule (it looks like five rupees) or a
 *            Hyrule item found on Zebes (a missile pack) is handed to the
 *            other game the next time it's played: Link's inventory ($0657..)
 *            or Samus's gear ($6878, tanks $6877, missiles $6879/$687A).
 *   pickups  Hyrule: the world flags ($067F.., bit $10 = that room's / cave's
 *            item taken); Zebes: the taken-item list in cartridge RAM
 *            ($6886.., the hub's Metroid tracker's reading).
 *
 *   ZMLink.start({ z1, m1, at, id, resume })   boots (Zelda first), restores a saved link
 *   ZMLink.state → { game, taken: Set, pending, inv }  ZMLink.onChange(fn)  ZMLink.portal()  ZMLink.ram(game)
 */
(function () {
  'use strict';
  const Z = window.ZM, M = window.M1, G = window.ZMGen;
  const $ = (id) => document.getElementById(id);
  const ZN = Z.SPOTS.length;
  let cores = { z1: null, m1: null }, game = 'z1', at = null, id = null;
  let states = { z1: null, m1: null }, pending = { z1: [], m1: [] }, taken = new Set(), given = { z1: 0, m1: 0 };
  let armed = { z1: true, m1: true }, fns = [], switching = false, lastSig = '', won = { z1: false, m1: false };
  const toastFn = (t, ms) => (window.ZMToast || ((x) => console.log('[zm]', x)))(t, ms);

  function ram(g) { const c = cores[g || game]; try { return c ? c.wram() : null; } catch (e) { return null; } }
  function sram(g) { const c = cores[g || game]; try { return c ? c.sram() : null; } catch (e) { return null; } }
  // the game being played is in play (not its title screen): Zelda's mode 5 / $B / $C, Metroid's mode 0 with a map square
  function inPlay(g) {
    const r = ram(g); if (!r) return false;
    if (g === 'z1') { const m = r[Z.RAM.MODE]; return m === 5 || m === 0x0B || m === 0x0C || m === 0x13; }
    return r[M.MEM.MODE] === 0 && r[M.MEM.MAP_X] < 32 && r[M.MEM.MAP_Y] < 32 && (r[M.MEM.HP_HI] | r[M.MEM.HP_LO]) !== 0;
  }

  // ── pickups ──────────────────────────────────────────────────────────────
  function takenNow(g) {
    const out = new Set(), r = ram(g), s = sram(g); if (!r) return out;
    if (g === 'z1') {
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
      for (let k = 0; k < n; k += 2) ids.add((s[M.MEM.TAKEN + k] | s[M.MEM.TAKEN + k + 1] << 8) & 0x3FF);   // square only (type bits off)
      M.SPOTS.forEach((sp, k) => { const [lo, hi] = M.itemId(sp, 0); if (ids.has((lo | hi << 8) & 0x3FF)) out.add(ZN + k); });
    }
    return out;
  }
  function checkPickups() {
    if (!inPlay(game)) return;
    const now = takenNow(game);
    now.forEach((i) => {
      if (taken.has(i)) return;
      taken.add(i);
      const it = at && at[i]; if (!it) return;
      if (it.game !== game) {
        pending[it.game].push(it);
        toastFn('Found ' + G.itemName(it) + ' — it’s waiting for ' + (it.game === 'z1' ? 'Link in Hyrule' : 'Samus on Zebes') + '.', 5000);
      }
      save();
    });
  }
  // hand over what the other world found
  function giveZelda(it) {
    const r = ram('z1'), g = Z.GIVE[it.type]; if (!r || !g) return;
    if (g[0] === 'hc') { const h = r[Z.RAM.HEARTS]; const c = Math.min(15, (h >> 4) + 1); r[Z.RAM.HEARTS] = (c << 4) | 0x0F; r[0x670] = 0xFF; return; }   // one more container, hearts full
    if (g[1] === 'max') r[g[0]] = Math.max(r[g[0]], g[2]);
    else r[g[0]] = g[1];
  }
  function giveMetroid(it) {
    const s = sram('m1'), r = ram('m1'); if (!s || !r) return;
    const t = it.type;
    if (t <= 7) s[M.MEM.GEAR] |= 1 << t;
    else if (t === 8) { s[M.MEM.TANKS] = Math.min(6, s[M.MEM.TANKS] + 1); const n = s[M.MEM.TANKS]; r[M.MEM.HP_HI] = ((n / 10 | 0) << 4) | (n % 10); r[M.MEM.HP_LO] = 0x99; }
    else { s[M.MEM.MAX_MISSILES] = Math.min(255, s[M.MEM.MAX_MISSILES] + 5); s[M.MEM.MISSILES] = Math.min(255, s[M.MEM.MISSILES] + 5); }
  }
  function deliver() {
    if (!pending[game].length || !inPlay(game)) return;
    const list = pending[game]; pending[game] = [];
    list.forEach((it) => { if (game === 'z1') giveZelda(it); else giveMetroid(it); given[game]++; });
    toastFn((game === 'z1' ? 'Link' : 'Samus') + ' received ' + list.map(G.itemName).join(', ') + ' from ' + (game === 'z1' ? 'Zebes' : 'Hyrule') + '.', 5000);
    save();
  }

  // ── portals ──────────────────────────────────────────────────────────────
  function atPortal(g) {
    const r = ram(g); if (!r || !inPlay(g)) return false;
    if (g === 'z1') return r[Z.RAM.MODE] === 0x0B && Z.PORTAL_SCREENS.indexOf(r[Z.RAM.ROOM]) >= 0;
    const area = M.AREA_CODE[r[M.MEM.AREA] & 15];
    return M.ELEVATORS.some((e) => e[0] === area && e[1] === r[M.MEM.MAP_X] && e[2] === r[M.MEM.MAP_Y]);
  }
  function portal() {
    if (switching || !cores.z1 || !cores.m1) return false;
    const to = game === 'z1' ? 'm1' : 'z1';
    switching = true;
    try {
      const p = window.EmuPlayer, T = window.ZMTitle;
      const fromPic = T ? T.grab(p.core) : null;
      states[game] = p.core.saveState();
      armed[game] = false;   // not again until the player leaves the portal spot
      const old = p.attach(cores[to]);
      if (old !== cores[game]) cores[game] = old;
      game = to;
      if (states[to]) { try { p.core.loadState(states[to]); } catch (e) { console.warn('[zm] state', e); } }
      lastSig = '';
      if (T && fromPic) { try { T.transition(fromPic, () => T.grab(p.core), to === 'm1' ? 'Zebes' : 'Hyrule'); } catch (e) {} }
      save();
      emit();
    } finally { switching = false; }
    return true;
  }
  function checkPortal() {
    const here = atPortal(game);
    if (!here) { armed[game] = true; return; }
    if (game === 'z1' && armed.z1) portal();   // Hyrule's portal caves open by themselves; Zebes' elevators ask (the ⇄ button)
  }

  // ── keeping it ───────────────────────────────────────────────────────────
  let saveT = null;
  function save() {
    if (!id) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const p = window.EmuPlayer;
      try { if (p && p.core && cores[game] === p.core && (!window.ZMHealth || window.ZMHealth.alive())) states[game] = p.core.saveState(); } catch (e) {}
      ZMStore.set('link:' + id, { game, states: { z1: states.z1 ? states.z1.buffer.slice(0) : null, m1: states.m1 ? states.m1.buffer.slice(0) : null }, pending, taken: Array.from(taken), given, won, t: Date.now() }).catch(() => {});
    }, 200);
  }
  function emit() { fns.forEach((f) => { try { f(); } catch (e) {} }); }

  // ── the loop ─────────────────────────────────────────────────────────────
  function poll() {
    if (!cores[game] || switching) return;
    checkPickups(); deliver(); checkPortal();
    // the ends: Zelda's mode $13 (Zelda saved), Metroid's main routine 7 (the ending)
    { const z = ram('z1'), m = ram('m1'); if (z && z[Z.RAM.MODE] === 0x13 && !won.z1) { won.z1 = true; save(); } if (m && m[0x1E] === 7 && inPlay('m1') && !won.m1) { won.m1 = true; save(); } }
    const r = ram(game);
    const sig = game + ':' + (r ? (inPlay(game) ? 1 : 0) : 'x') + ':' + taken.size + ':' + pending.z1.length + ':' + pending.m1.length + ':' + (atPortal(game) ? 1 : 0);
    if (sig !== lastSig) { lastSig = sig; emit(); }
  }

  // ── start ────────────────────────────────────────────────────────────────
  function start(o) {
    at = o.at; id = o.id; game = 'z1';
    const p = window.EmuPlayer;
    return (o.resume ? ZMStore.get('link:' + id) : Promise.resolve(null)).then((saved) => {
      if (saved) {
        game = saved.game || 'z1';
        states = { z1: saved.states && saved.states.z1 ? new Uint8Array(saved.states.z1) : null, m1: saved.states && saved.states.m1 ? new Uint8Array(saved.states.m1) : null };
        pending = saved.pending || { z1: [], m1: [] }; taken = new Set(saved.taken || []); given = saved.given || { z1: 0, m1: 0 }; won = saved.won || { z1: false, m1: false };
      }
      return p.newCore(o.m1, 'zm-' + id + '-metroid');
    }).then((m1core) => {
      cores.m1 = m1core;
      return new Promise((resolve, reject) => {
        window.EJS_onGameStart = function () {
          cores.z1 = p.core;
          if (game === 'm1') { const old = p.attach(cores.m1); cores.z1 = old; }
          if (states[game]) { try { p.core.loadState(states[game]); } catch (e) { console.warn('[zm] state', e); } }
          armed = { z1: false, m1: false };
          setInterval(poll, 150);
          setInterval(save, 20000);
          document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
          window.addEventListener('pagehide', save);
          if (o.onStart) try { o.onStart(); } catch (e) {}
          resolve();
        };
        if (p.setTouchPlacement) p.setTouchPlacement('overlay');
        p.boot('#game', new File([o.z1], 'zm-' + id + '-zelda.nes')).catch(reject);
      });
    });
  }

  window.ZMLink = {
    start, portal, ram, sram, inPlay, atPortal,
    get game() { return game; },
    get state() { return { game, taken, pending, given, won }; },
    onChange(f) { fns.push(f); },
    get cores() { return cores; },
  };
})();
