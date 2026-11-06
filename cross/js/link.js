/*
 * link.js — the four-game combo's link: the SNES game (SMZ3: A Link to the
 * Past and Super Metroid, this page's Snes9x) and the NES games (Zelda 1 and
 * Metroid, nes.html's FCEUmm, in a frame over the game picture), one playing
 * at a time, the other waiting.
 *
 *   portals  ALttP → NES: two caves of this seed (QuadGen's pick, in the
 *            seed's data), found by Link's room ($7E:00A0 indoors, the game
 *            ALttP's: SRAM $A1:73FE = 0): one to Zelda 1, one to Metroid.
 *            NES → ALttP: a "take any road" cave in Zelda 1, or ⇄ (the P key)
 *            anywhere. Link is back in the cave he went in by; its portal
 *            waits until he has left the room.
 *   items    an SNES item on a NES spot: written to SMZ3's multiworld receive
 *            queue (SRAM $A2:6000, 4 bytes an item: the sender, 1 Zelda 1 / 2
 *            Metroid, then the item; the write pointer $A2:6602), and the ROM
 *            gives it ("You received … from ZELDA 1"). The queue is filled up
 *            to the list of what's been found, from the ROM's own write
 *            pointer, so a reload or a loaded state never gives twice.
 *            an NES item in the SNES game: the ROM's sent queue ($A2:6700, 8
 *            bytes: the owner, the look-alike, the location's table index),
 *            read and handed to the NES side once per location.
 *
 *   QuadLink.start({ meta, z1, m1, id, resume, frame })   after the SNES game is up
 *   QuadLink.where  'snes' | 'z1' | 'm1'     QuadLink.back()   QuadLink.done   QuadLink.onChange(fn)
 */
(function () {
  'use strict';
  const NES_BACK = 'Back to Hyrule';
  const SR = { RECV: 0x4000, RPTR: 0x4600, WPTR: 0x4602, SENT_W: 0x4682, SENT: 0x4700, SEED: 0x46A0, GAME: 0x33FE };
  let meta = null, id = null, frame = null, nes = null, where = 'snes', rec = null, armed = false, fns = [], started = false, switching = false;
  const toast = (t, ms) => (window.QuadToast || console.log)(t, ms);
  const S = () => window.Snes9xPlayer;
  const snesRam = () => { const c = S() && S().core; try { return c ? c.wram() : null; } catch (e) { return null; } };
  const snesSram = () => { const c = S() && S().core; try { return c ? c.sram() : null; } catch (e) { return null; } };
  const snesRom = () => { const c = S() && S().core; try { return c ? c.rom() : null; } catch (e) { return null; } };
  const w16 = (s, o) => s[o] | s[o + 1] << 8;
  const NAME = { z1: 'Zelda 1', m1: 'Metroid' };

  // ── keeping it ───────────────────────────────────────────────────────────
  let saveT = null;
  function save() {
    if (!id) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { rec.where = where; rec.t = Date.now(); SMZ3Store.set('quad-link:' + id, rec).catch(() => {}); }, 150);
  }
  function emit() { fns.forEach((f) => { try { f(); } catch (e) {} }); }

  // ── the SNES side's queues ───────────────────────────────────────────────
  // the ROM has set its multiworld up (it clears the receive queue when the SRAM's seed data isn't this ROM's)
  function mwReady(s) {
    const rom = snesRom(); if (!rom || rom.length < 0x400000) return false;
    const base = SMZ3Gen.snes(0x80FF50);
    for (let i = 0; i < 0x50; i++) if (s[SR.SEED + i] !== rom[base + i]) return false;
    return true;
  }
  function feed() {
    const s = snesSram(); if (!s || s.length < 0x5000 || !mwReady(s)) return;
    let w = w16(s, SR.WPTR);
    if (w >= rec.toSnes.length) return;
    while (w < rec.toSnes.length && w < 0x17F) {
      const [from, item] = rec.toSnes[w], o = SR.RECV + w * 4;
      s[o] = from; s[o + 1] = 0; s[o + 2] = item & 0xFF; s[o + 3] = item >> 8;
      w++;
    }
    s[SR.WPTR] = w & 0xFF; s[SR.WPTR + 1] = w >> 8;
  }
  function readSent() {
    const s = snesSram(); if (!s || s.length < 0x5000 || !mwReady(s)) return;
    const n = Math.min(w16(s, SR.SENT_W), 0x300);
    for (let k = 0; k < n; k++) {
      const o = SR.SENT + k * 8, idx = w16(s, o + 4);
      const loc = idx & 0x8000 ? 256 + ((idx & 0x7FFF) >> 3) : idx >> 3;
      const it = meta.sent && meta.sent[loc];
      if (!it || rec.sentDone.indexOf(loc) >= 0) continue;
      rec.sentDone.push(loc);
      if (nes) nes.give(it);
      toast('Sent ' + ZMGen.itemName(it) + ' to ' + (it.game === 'z1' ? 'Link in Zelda 1' : 'Samus on Zebes') + '.', 5000);
      save(); emit();
    }
  }

  // ── portals ──────────────────────────────────────────────────────────────
  function portalHere() {
    const s = snesSram(), r = snesRam(); if (!s || !r || s[SR.GAME] !== 0) return null;
    if (r[0x10] !== 0x07 || !r[0x1B]) return null;
    const room = r[0xA0] | r[0xA1] << 8;
    return (meta.portals || []).find((p) => p.room === room) || null;
  }
  function go(to) {
    if (switching || !nes) return;
    switching = true;
    const e = window.EJS_emulator;
    try { if (window.QuadSnapshot) QuadSnapshot(); } catch (x) {}
    if (e && e.pause) e.pause();
    where = to; document.body.classList.add('on-nes'); frame.hidden = false;
    paint();
    nes.enter(to).then(() => { switching = false; try { frame.focus(); frame.contentWindow.focus(); } catch (x) {} save(); emit(); paint(); toast('Through the portal: ' + NAME[to] + '. ' + (opt().exits === 'exits' ? 'The way back: a “take any road” cave or an elevator room.' : '⇄ or P to come back.'), 4000); },
      (err) => { switching = false; console.error('[quad] NES', err); toast('The NES game didn’t start: ' + (err && err.message || err), 8000); back(); });
  }
  const opt = () => Object.assign({ link: 'hub', exits: 'anywhere' }, meta && meta.nes || {});
  const atSpot = () => where !== 'snes' && !!nes && nes.atPortal(where);
  // back to Hyrule (ALttP): ⇄ anywhere, or (the seed's choice) only at a way out
  function canBack() { return where !== 'snes' && (opt().exits !== 'exits' || atSpot()); }
  function back(force) {
    if (where === 'snes' || !nes || switching) return;
    if (!force && !canBack()) { toast('This seed’s way back to Hyrule is a “take any road” cave in Zelda 1 or an elevator room on Zebes.', 5000); return; }
    switching = true;
    nes.leave().finally(() => {
      where = 'snes'; armed = false;
      frame.hidden = true; document.body.classList.remove('on-nes');
      const e = window.EJS_emulator; if (e && e.play) e.play();
      try { frame.blur(); window.focus(); } catch (x) {}
      switching = false; save(); emit(); paint();
    });
  }
  // Zelda 1 ⇄ Metroid (linked seeds): at a take-any-road cave or an elevator room, the other NES game
  function cross() {
    if (switching || !nes || where === 'snes' || opt().link !== 'linked' || !atSpot()) return;
    const to = where === 'z1' ? 'm1' : 'z1';
    switching = true; where = to; paint();
    nes.enter(to).then(() => { switching = false; try { frame.focus(); frame.contentWindow.focus(); } catch (x) {} save(); emit(); paint(); toast('Through the portal: ' + NAME[to] + '.', 3000); },
      (err) => { switching = false; console.error('[quad] NES', err); toast('That didn’t work: ' + (err && err.message || err), 6000); });
  }
  let lastPaint = '';
  function paint() {
    const b = document.getElementById('swap'), p = document.getElementById('where'), c = document.getElementById('swap-nes');
    const sig = where + ':' + canBack() + ':' + (opt().link === 'linked' && atSpot());
    if (sig === lastPaint) return; lastPaint = sig;
    if (b) { b.hidden = !canBack(); b.textContent = '⇄ ' + NES_BACK; }
    if (c) { c.hidden = !(opt().link === 'linked' && atSpot()); c.textContent = where === 'z1' ? '⇄ Zebes' : '⇄ Zelda 1'; c.title = where === 'z1' ? 'Through the cave to Zebes (Metroid)' : 'Up the elevator to Hyrule (Zelda 1)'; }
    if (p) { p.textContent = where === 'snes' ? 'SNES' : 'NES · ' + NAME[where]; p.title = where === 'snes' ? 'Playing the SNES game: A Link to the Past and Super Metroid' : 'Playing ' + NAME[where] + ' (the NES): ⇄ or P back to Hyrule'; }
  }

  // ── the goal ─────────────────────────────────────────────────────────────
  function snesWon() { const s = snesSram(); return !!(s && s[SR.GAME] !== 0 && s[SR.GAME] !== 0xFF); }
  function checkGoal() {
    if (!rec.won.snes && snesWon()) { rec.won.snes = true; save(); emit(); }
    const g = meta.goal || 'all', w = rec.won;
    const done = g === 'snes' ? w.snes : g === 'nes' ? w.z1 && w.m1 : w.snes && w.z1 && w.m1;
    if (done && !rec.done) { rec.done = true; save(); emit(); toast('Goal complete: ' + (g === 'snes' ? 'Ganon and Mother Brain' : g === 'nes' ? 'both NES final bosses' : 'all four final bosses') + '!', 8000); }
  }

  function poll() {
    if (!started || switching) return;
    feed(); readSent(); checkGoal();
    if (where !== 'snes') { paint(); return; }
    const p = portalHere();
    if (!p) { armed = true; return; }
    if (armed) { armed = false; go(p.to); }
  }

  function start(o) {
    meta = o.meta; id = o.id; frame = o.frame;
    return (o.resume ? SMZ3Store.get('quad-link:' + id) : Promise.resolve(null)).then((saved) => {
      rec = Object.assign({ where: 'snes', toSnes: [], sentDone: [], won: { snes: false, z1: false, m1: false }, done: false }, saved || {});
      return new Promise((res) => {
        const ready = () => { if (frame.contentWindow && frame.contentWindow.QuadNES) { res(); return true; } return false; };
        if (ready()) return;
        const t = setInterval(() => { if (ready()) clearInterval(t); }, 100);
      });
    }).then(() => {
      nes = frame.contentWindow.QuadNES;
      window.QuadNESLink = nes;   // the NES tracker's reads (nes-tracker.html)
      return nes.init({ z1: o.z1, m1: o.m1, at: meta.at.map((a) => ({ game: a[0], type: a[1] })), id, store: SMZ3Store, resume: !!o.resume, on: onNes, options: opt() });
    }).then(() => {
      started = true; armed = false;
      setInterval(poll, 150);
      paint();
      if (rec.where === 'z1' || rec.where === 'm1') go(rec.where);
      emit();
    });
  }
  function onNes(ev) {
    if (ev.type === 'snes') {
      const it = ev.item, from = ev.spot < ZM.SPOTS.length ? 1 : 2;
      rec.toSnes.push([from, it.id !== undefined ? it.id : it.type, ev.spot]);
      toast('Found ' + (it.name || SMZ3Gen.IT_DESC[SMZ3Gen.IT_NAME[it.type]] || 'an SNES item') + ': Link and Samus get it back in Hyrule.', 5000);
      save(); emit(); feed();
    } else if (ev.type === 'back') back(!!ev.auto);
    else if (ev.type === 'won') { rec.won[ev.game] = true; save(); emit(); checkGoal(); }
    else if (ev.type === 'change') emit();
  }

  window.QuadLink = {
    start, back: () => back(false), go, cross,
    get where() { return where; },
    get done() { return !!(rec && rec.done); },
    get record() { return rec; },
    get nes() { return nes; },
    onChange(f) { fns.push(f); },
  };
})();
