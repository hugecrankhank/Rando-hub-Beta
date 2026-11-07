/*
 * link.js — M1SM's link: Super Metroid (this page's Snes9x) and Metroid
 * (../cross/nes.html's FCEUmm, in a frame over the game picture), one playing
 * at a time, the other waiting.
 *
 *   the portal  Super Metroid → Metroid: Crateria's Map Station (room $9994),
 *               as Samus is in it ($7E:079B, the game playing: $0998 = 8). Back:
 *               ⇄ (or P) anywhere, or (an option) only in one of Metroid's
 *               elevator rooms. Samus is back in the Map Station; the portal
 *               waits until she has left it.
 *   items       a Metroid item in Super Metroid: a missile pack at that spot.
 *               When the spot's collected bit ($7E:D870 + n / 8) is set, Samus
 *               in Metroid gets the real item (../cross/js/nes.js keeps it for
 *               her until Metroid is played). Once per spot.
 *               a Super Metroid item on a Metroid spot: a missile pack there;
 *               it's written into Samus's Super Metroid RAM (js/give.js). How
 *               many have been given is kept in her save too ($7E:D8AE, past the
 *               last item bit the game uses), so a loaded state or an in-game
 *               save never gives one twice or misses one.
 *   signs       "this way to Metroid" over Super Metroid in the rooms on the
 *               way to the Map Station, "this elevator: back to Crateria" over
 *               Metroid's elevator rooms when they're the way back.
 *
 *   M1SMLink.start({ meta, m1, id, resume, frame })   after Super Metroid is up
 *   M1SMLink.where  'sm' | 'm1'    .back()   .done   .record   .nes   .onChange(fn)   .signs
 */
(function () {
  'use strict';
  const GIVEN = 0xD8AE;   // $7E:D8AE: Super Metroid items given so far (a word past the item bits)
  const MAP_STATION = 0x9994;
  let meta = null, id = null, frame = null, nes = null, where = 'sm', rec = null, armed = false, fns = [], started = false, switching = false;
  const toast = (t, ms, kind) => (window.M1SMToast || console.log)(t, ms, kind);
  const S = () => window.Snes9xPlayer;
  const snesRam = () => { const c = S() && S().core; try { return c ? c.wram() : null; } catch (e) { return null; } };
  const w16 = (s, o) => s[o] | s[o + 1] << 8;
  const inGame = (r) => r && r[0x998] >= 7 && r[0x998] <= 0x12 && w16(r, 0x9C4) >= 99;   // (playing, paused, a door: Samus's own RAM)

  // ── keeping it ───────────────────────────────────────────────────────────
  let saveT = null;
  function save() {
    if (!id) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { rec.where = where; rec.t = Date.now(); SMRStore.set('m1sm-link:' + id, rec).catch(() => {}); }, 150);
  }
  function emit() { fns.forEach((f) => { try { f(); } catch (e) {} }); }

  // ── Super Metroid items found in Metroid: into Samus's RAM ───────────────
  function feed() {
    const r = snesRam(); if (!inGame(r) || !window.M1SMGive) return;
    let g = w16(r, GIVEN);
    if (g > rec.toSm.length) { r[GIVEN] = rec.toSm.length & 0xFF; r[GIVEN + 1] = rec.toSm.length >> 8; return; }
    if (g >= rec.toSm.length) return;
    const given = [];
    while (g < rec.toSm.length) { const it = rec.toSm[g]; if (M1SMGive.give(r, it.type)) given.push(it.name || M1SMGive.smName(it.type)); g++; }
    r[GIVEN] = g & 0xFF; r[GIVEN + 1] = g >> 8;
    if (given.length && where === 'sm') toast('Samus (Super Metroid) received ' + given.join(', ') + '.', 5000, 'item');
  }

  // ── Metroid items found in Super Metroid: to Samus in Metroid ────────────
  function readSent() {
    const r = snesRam(); if (!inGame(r)) return;
    (meta.sent || []).forEach((s) => {
      if (rec.sentDone.indexOf(s.bit) >= 0) return;
      if (!(r[0xD870 + (s.bit >> 3)] & (1 << (s.bit & 7)))) return;
      rec.sentDone.push(s.bit);
      if (nes) nes.give({ game: 'm1', type: s.type });
      toast('That’s Metroid’s ' + s.name + ': Samus gets it on the other Zebes.', 6000, 'item');
      save(); emit();
    });
  }

  // ── the portal ───────────────────────────────────────────────────────────
  function atPortal() { const r = snesRam(); return !!r && r[0x998] === 8 && w16(r, 0x79B) === MAP_STATION; }
  const opt = () => ({ exits: (meta && meta.exits) || 'anywhere', goal: (meta && meta.goal) || 'both' });
  const atSpot = () => where === 'm1' && !!nes && nes.atPortal('m1');
  function canBack() { return where === 'm1' && (opt().exits !== 'exits' || atSpot()); }
  function go() {
    if (switching || !nes) return;
    switching = true;
    const e = window.EJS_emulator;
    try { if (window.M1SMSnapshot) M1SMSnapshot(); } catch (x) {}
    if (e && e.pause) e.pause();
    where = 'm1'; document.body.classList.add('on-nes'); frame.hidden = false;
    paint();
    nes.enter('m1').then(() => { switching = false; try { frame.focus(); frame.contentWindow.focus(); } catch (x) {} save(); emit(); paint(); toast('Through the Map Station: Metroid’s Zebes. ' + (opt().exits === 'exits' ? 'The way back: one of its elevator rooms.' : '⇄ or P to come back to Crateria.'), 4500); },
      (err) => { switching = false; console.error('[m1sm] NES', err); toast('Metroid didn’t start: ' + (err && err.message || err), 8000); back(true); });
  }
  function back(force) {
    if (where === 'sm' || !nes || switching) return;
    if (!force && !canBack()) { toast('This seed’s way back to Crateria is one of Metroid’s elevator rooms.', 5000); return; }
    switching = true;
    nes.leave().finally(() => {
      where = 'sm'; armed = false;
      frame.hidden = true; document.body.classList.remove('on-nes');
      const e = window.EJS_emulator; if (e && e.play) e.play();
      try { frame.blur(); window.focus(); } catch (x) {}
      switching = false; save(); emit(); paint();
    });
  }
  let lastPaint = '';
  function paint() {
    const b = document.getElementById('swap'), p = document.getElementById('where');
    const sig = where + ':' + canBack();
    if (sig === lastPaint) return; lastPaint = sig;
    if (b) b.hidden = !canBack();
    if (p) { p.textContent = where === 'sm' ? 'Super Metroid' : 'Metroid'; p.title = where === 'sm' ? 'Playing Super Metroid' : 'Playing Metroid: ⇄ or P back to Crateria'; }
  }

  // ── the signs ────────────────────────────────────────────────────────────
  let signsOn = true;
  try { signsOn = localStorage.getItem('m1sm:signs') !== '0'; } catch (e) {}
  // Super Metroid: the rooms on the way to the Map Station (the Parlor's top right door, then the Pre-Map Flyway)
  const SM_SIGN = {
    0x9994: ['This room: the way to Metroid', 'Stay a moment: Metroid takes over'],
    0x98E2: ['➡ This way to Metroid', 'The Map Station, at the end of this flyway'],
    0x92FD: ['➡ This way to Metroid: the top right door', 'The Pre-Map Flyway, then the Map Station'],
    0x91F8: ['⬅ This way to Metroid', 'West into the Parlor, then its top right door'],
  };
  function signFor() {
    if (!meta || switching) return null;
    if (where === 'sm') { const r = snesRam(); if (!r || r[0x998] !== 8) return null; return SM_SIGN[w16(r, 0x79B)] || null; }
    if (!nes || !nes.inPlay('m1')) return null;
    if (atSpot() && opt().exits === 'exits') return ['⇄ This elevator room: back to Crateria', 'The button up top, or P'];
    return null;
  }
  let lastSign = '';
  function paintSign() {
    const el = document.getElementById('kak-sign'); if (!el) return;
    const t = signsOn ? signFor() : null, sig = t ? t.join('|') : '';
    if (sig === lastSign) return; lastSign = sig;
    if (!t) { el.hidden = true; return; }
    el.innerHTML = '<b>' + t[0] + '</b>' + (t[1] ? ' <small>· ' + t[1] + '</small>' : '');
    el.title = t[0] + (t[1] ? ' · ' + t[1] : '');
    el.hidden = false;
  }

  // ── the goal ─────────────────────────────────────────────────────────────
  function checkGoal() {
    const r = snesRam();
    if (r && inGame(r) && (r[0xD828 + 5] & 1) && !rec.won.sm) { rec.won.sm = true; save(); }   // Super Metroid: Mother Brain's bit (Tourian)
    const g = opt().goal, w = rec.won;
    const done = g === 'sm' ? w.sm : g === 'm1' ? w.m1 : w.sm && w.m1;
    if (done && !rec.done) { rec.done = true; save(); emit(); toast('Goal complete: ' + (g === 'sm' ? 'Super Metroid’s Mother Brain' : g === 'm1' ? 'Metroid’s Mother Brain' : 'both Mother Brains') + '!', 8000); }
  }

  function poll() {
    if (!started) return;
    paintSign();
    if (switching) return;
    feed(); readSent(); checkGoal();
    if (where !== 'sm') { paint(); return; }
    if (!atPortal()) { armed = true; return; }
    if (armed) { armed = false; go(); }
  }

  function start(o) {
    meta = o.meta; id = o.id; frame = o.frame;
    return (o.resume ? SMRStore.get('m1sm-link:' + id) : Promise.resolve(null)).then((saved) => {
      rec = Object.assign({ where: 'sm', toSm: [], sentDone: [], won: { sm: false, m1: false }, done: false }, saved || {});
      frame.src = '../cross/nes.html';
      return new Promise((res) => {
        const ready = () => { if (frame.contentWindow && frame.contentWindow.QuadNES) { res(); return true; } return false; };
        if (ready()) return;
        const t = setInterval(() => { if (ready()) clearInterval(t); }, 100);
      });
    }).then(() => {
      nes = frame.contentWindow.QuadNES;
      window.QuadNESLink = nes;   // the Metroid tracker's reads (../cross/nes-tracker.html)
      // Metroid's spots (ZMGen's order: Zelda 1's first, unused): its own items, or a Super Metroid item ('sm': nes.js hands it back here)
      const at = meta.at.map((a) => (!a ? { game: 'z1', type: 0x0F } : a.game === 'm1' ? { game: 'm1', type: a.type } : { game: 'sm', type: a.type, name: a.name }));
      return nes.init({ z1: null, m1: o.m1, at, id: 'm1sm-' + id, store: SMRStore, resume: !!o.resume, on: onNes, options: { link: 'hub', exits: opt().exits } });
    }).then(() => {
      started = true; armed = false;
      setInterval(poll, 150);
      paint();
      if (rec.where === 'm1') go();
      emit();
    });
  }
  function onNes(ev) {
    if (ev.type === 'snes') {
      const it = ev.item;
      rec.toSm.push({ type: it.type, name: it.name, spot: ev.spot });
      toast('Found ' + (it.name || 'a Super Metroid item') + ' (Super Metroid): Samus has it back in Crateria.', 5000, 'item');
      save(); emit(); feed();
    } else if (ev.type === 'back') back(!!ev.auto);
    else if (ev.type === 'won') { if (ev.game === 'm1') { rec.won.m1 = true; save(); emit(); checkGoal(); } }
    else if (ev.type === 'change') emit();
  }

  window.M1SMLink = {
    start, back: () => back(false),
    get where() { return where; },
    get done() { return !!(rec && rec.done); },
    get record() { return rec; },
    get nes() { return nes; },
    get signs() { return signsOn; },
    set signs(v) { signsOn = !!v; try { localStorage.setItem('m1sm:signs', signsOn ? '1' : '0'); } catch (e) {} lastSign = '-'; paintSign(); },
    onChange(f) { fns.push(f); },
  };
  // the Metroid tracker (../cross/nes-tracker.html) reads the page as Rando Cross's: where Samus is, as 'snes' / 'm1'
  window.QuadLink = {
    get where() { return where === 'sm' ? 'snes' : 'm1'; },
    get done() { return !!(rec && rec.done); },
    get record() { return rec ? { won: { snes: rec.won.sm, z1: false, m1: rec.won.m1 } } : null; },
  };
})();
