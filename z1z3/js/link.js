/*
 * link.js — Z1Z3's link: A Link to the Past (this page's Snes9x) and Zelda 1
 * (../cross/nes.html's FCEUmm, in a frame over the game picture), one playing
 * at a time, the other waiting.
 *
 *   the portal  ALttP → Zelda 1: the Elder's House in Kakariko (either door),
 *               found by the door Link came in by ($7E:010E) as he's inside
 *               ($10 = 7, indoors). Back: ⇄ (or P) anywhere, or (an option)
 *               only in a "take any road" cave. Link is back in the house;
 *               the portal waits until he has left it.
 *   items       a Zelda 1 item in an ALttP chest: a look-alike there (rupees,
 *               bombs or arrows, unlike anything else in that room). When the
 *               game's item counter ($7E:F423) goes up, the room ($A0) and the
 *               item being received ($02D8) say which chest it was, and Link in
 *               Zelda 1 gets the real item (../cross/js/nes.js keeps it for
 *               him until Zelda 1 is played). Once per chest.
 *               an ALttP item on a Zelda 1 spot: a rupee there; it's written
 *               into Link's ALttP save (js/give.js). How many have been given
 *               is kept in that save too ($7E:F49E, an unused word), so a
 *               loaded state or an in-game save never gives one twice or
 *               misses one.
 *
 *   Z1Z3Link.start({ meta, z1, id, resume, frame })   after ALttP is up
 *   Z1Z3Link.where  'z3' | 'z1'    .back()   .done   .record   .nes   .onChange(fn)   .signs
 */
(function () {
  'use strict';
  const GIVEN = 0xF49E;   // $7E:F49E: ALttP items given so far (a word in the save's unused block)
  let meta = null, id = null, frame = null, nes = null, where = 'z3', rec = null, armed = false, fns = [], started = false, switching = false, lastCount = -1;
  const toast = (t, ms) => (window.Z1Z3Toast || console.log)(t, ms);
  const S = () => window.Snes9xPlayer;
  const snesRam = () => { const c = S() && S().core; try { return c ? c.wram() : null; } catch (e) { return null; } };
  const w16 = (s, o) => s[o] | s[o + 1] << 8;
  const PORTAL = () => (meta && meta.portal) || { entrances: [0x0D, 0x0E], name: 'the Elder’s House' };

  // ── keeping it ───────────────────────────────────────────────────────────
  let saveT = null;
  function save() {
    if (!id) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { rec.where = where; rec.t = Date.now(); SMZ3Store.set('z1z3-link:' + id, rec).catch(() => {}); }, 150);
  }
  function emit() { fns.forEach((f) => { try { f(); } catch (e) {} }); }

  // ALttP in a game (not the title screen or the file menus): its save block is Link's
  const inGame = (r) => r && [0x07, 0x09, 0x0B, 0x0E, 0x12, 0x13, 0x15, 0x16].indexOf(r[0x10]) >= 0 && r[0xF36C] >= 0x18;

  // ── ALttP items found in Zelda 1: into Link's save ───────────────────────
  function feed() {
    const r = snesRam(); if (!inGame(r) || !window.Z1Z3Give) return;
    let g = w16(r, GIVEN);
    if (g > rec.toZ3.length) { r[GIVEN] = rec.toZ3.length & 0xFF; r[GIVEN + 1] = rec.toZ3.length >> 8; return; }   // (a save from another run of this seed: start over from what's known)
    if (g >= rec.toZ3.length) return;
    const given = [];
    while (g < rec.toZ3.length) { const it = rec.toZ3[g]; if (Z1Z3Give.give(r, it.name)) given.push(it.nice || it.name); g++; }
    r[GIVEN] = g & 0xFF; r[GIVEN + 1] = g >> 8;
    if (given.length && where === 'z3') toast('Link (ALttP) received ' + given.join(', ') + '.', 5000);
  }

  // ── Zelda 1 items found in ALttP's chests: to Link in Zelda 1 ────────────
  function readChests() {
    const r = snesRam(); if (!inGame(r)) return;
    const n = w16(r, 0xF423);
    if (lastCount < 0 || n < lastCount) { lastCount = n; return; }
    if (n === lastCount) return;
    lastCount = n;
    if (!r[0x1B]) return;   // (chests are indoors)
    const room = r[0xA0] | r[0xA1] << 8, got = r[0x2D8];
    const c = (meta.chests || []).find((x) => x.room === room && x.id === got && rec.chestDone.indexOf(x.loc) < 0);
    if (!c) return;
    rec.chestDone.push(c.loc);
    if (nes) nes.give({ game: 'z1', type: c.type, name: c.name });
    toast('That’s Zelda 1’s ' + c.name + ': Link gets it in the other Hyrule.', 6000);
    save(); emit();
  }

  // ── the portal ───────────────────────────────────────────────────────────
  function atPortal() {
    const r = snesRam(); if (!r || r[0x10] !== 0x07 || !r[0x1B]) return false;
    return PORTAL().entrances.indexOf(r[0x10E]) >= 0;
  }
  const opt = () => Object.assign({ exits: 'anywhere' }, meta && meta.options || {}, meta && meta.zora ? { exits: 'anywhere' } : {});   // (ZORA moves the caves: ⇄ / P)
  const atSpot = () => where === 'z1' && !!nes && nes.atPortal('z1');
  function canBack() { return where === 'z1' && (opt().exits !== 'exits' || atSpot()); }
  function go() {
    if (switching || !nes) return;
    switching = true;
    const e = window.EJS_emulator;
    try { if (window.Z1Z3Snapshot) Z1Z3Snapshot(); } catch (x) {}
    if (e && e.pause) e.pause();
    where = 'z1'; document.body.classList.add('on-nes'); frame.hidden = false;
    paint();
    nes.enter('z1').then(() => { switching = false; try { frame.focus(); frame.contentWindow.focus(); } catch (x) {} save(); emit(); paint(); toast('Through the Elder’s House: Zelda 1’s Hyrule. ' + (opt().exits === 'exits' ? 'The way back: a “take any road” cave.' : '⇄ or P to come back to Kakariko.'), 4500); },
      (err) => { switching = false; console.error('[z1z3] NES', err); toast('Zelda 1 didn’t start: ' + (err && err.message || err), 8000); back(true); });
  }
  function back(force) {
    if (where === 'z3' || !nes || switching) return;
    if (!force && !canBack()) { toast('This seed’s way back to Kakariko is a “take any road” cave in Zelda 1.', 5000); return; }
    switching = true;
    nes.leave().finally(() => {
      where = 'z3'; armed = false;
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
    if (p) { p.textContent = where === 'z3' ? 'ALttP' : 'Zelda 1'; p.title = where === 'z3' ? 'Playing A Link to the Past' : 'Playing Zelda 1: ⇄ or P back to Kakariko'; }
  }

  // ── the sign: "this way to Kakariko" over Zelda 1, where the way back is ──
  let signsOn = true;
  try { signsOn = localStorage.getItem('z1z3:signs') !== '0'; } catch (e) {}
  function signFor() {
    if (where !== 'z1' || !nes || switching) return null;
    const r = nes.ram('z1'); if (!r || !nes.inPlay('z1')) return null;
    if (!meta.zora && r[ZM.RAM.LEVEL] === 0 && r[ZM.RAM.MODE] === 5 && ZM.PORTAL_SCREENS.indexOf(r[ZM.RAM.ROOM]) >= 0)
      return ['This way to Kakariko: the cave on this screen', opt().exits === 'exits' ? 'Walk in and it takes you back' : 'Walk in, or ⇄ / P anywhere'];
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
    if (r && r[0x10] === 0x19 && !rec.won.z3) { rec.won.z3 = true; save(); }   // ALttP: the Triforce room
    const g = opt().goal || 'both', w = rec.won;
    const done = g === 'z3' ? w.z3 : g === 'z1' ? w.z1 : w.z3 && w.z1;
    if (done && !rec.done) { rec.done = true; save(); emit(); toast('Goal complete: ' + (g === 'z3' ? 'Ganon (ALttP)' : g === 'z1' ? 'Zelda 1’s Ganon' : 'both Ganons') + '!', 8000); }
  }

  function poll() {
    if (!started) return;
    paintSign();
    if (switching) return;
    feed(); readChests(); checkGoal();
    if (where !== 'z3') { paint(); return; }
    if (!atPortal()) { armed = true; return; }
    if (armed) { armed = false; go(); }
  }

  function start(o) {
    meta = o.meta; id = o.id; frame = o.frame;
    return (o.resume ? SMZ3Store.get('z1z3-link:' + id) : Promise.resolve(null)).then((saved) => {
      rec = Object.assign({ where: 'z3', toZ3: [], chestDone: [], won: { z3: false, z1: false }, done: false }, saved || {});
      frame.src = '../cross/nes.html';
      return new Promise((res) => {
        const ready = () => { if (frame.contentWindow && frame.contentWindow.QuadNES) { res(); return true; } return false; };
        if (ready()) return;
        const t = setInterval(() => { if (ready()) clearInterval(t); }, 100);
      });
    }).then(() => {
      nes = frame.contentWindow.QuadNES;
      window.QuadNESLink = nes;   // the Zelda 1 tracker's reads (../cross/nes-tracker.html)
      // Zelda 1's spots: its own items, or an ALttP item ('snes': nes.js hands it back here)
      const at = meta.at.map((a) => Object.assign(a.game === 'z1' ? { game: 'z1', type: a.type, name: a.name } : { game: 'snes', name: a.name, nice: a.nice }, a.check ? { check: a.check, place: a.place } : {}));
      return nes.init({ z1: o.z1, m1: null, at, id: 'z1z3-' + id, store: SMZ3Store, resume: !!o.resume, on: onNes, options: { link: 'hub', exits: opt().exits }, zora: meta.zora || null });
    }).then(() => {
      started = true; armed = false;
      setInterval(poll, 150);
      paint();
      if (rec.where === 'z1') go();
      emit();
    });
  }
  function onNes(ev) {
    if (ev.type === 'snes') {
      const it = ev.item;
      rec.toZ3.push({ name: it.name, nice: it.nice, spot: ev.spot });
      toast('Found ' + (it.nice || it.name) + ' (A Link to the Past): Link has it back in Kakariko.', 5000);
      save(); emit(); feed();
    } else if (ev.type === 'back') back(!!ev.auto);
    else if (ev.type === 'won') { rec.won.z1 = true; save(); emit(); checkGoal(); }
    else if (ev.type === 'change') emit();
  }

  window.Z1Z3Link = {
    start, back: () => back(false),
    get where() { return where; },
    get done() { return !!(rec && rec.done); },
    get record() { return rec; },
    get nes() { return nes; },
    get signs() { return signsOn; },
    set signs(v) { signsOn = !!v; try { localStorage.setItem('z1z3:signs', signsOn ? '1' : '0'); } catch (e) {} lastSign = '-'; paintSign(); },
    onChange(f) { fns.push(f); },
  };
  // the Zelda 1 tracker (../cross/nes-tracker.html) reads the page as Rando Cross's: where Link is, as 'snes' / 'z1'
  window.QuadLink = {
    get where() { return where === 'z3' ? 'snes' : 'z1'; },
    get done() { return !!(rec && rec.done); },
    get record() { return rec ? { won: { snes: rec.won.z3, z1: rec.won.z1, m1: false } } : null; },
  };
})();
