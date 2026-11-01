/*
 * Crowd effects for The Guardian Legend (GLR, and hacks such as TGL Secret
 * Edition): TikTok LIVE viewers change the game, the same way Rando Hub's
 * crowd/effects.js does for Zelda 3 and z1r/js/crowd.js for Zelda 1. Gifts,
 * likes, follows and shares arrive from Crowd Control+ or JinxCast (the
 * bridge on the streaming PC) over a WebSocket; each names an effect below,
 * queued and applied while the Guardian is in play.
 *
 * Effect ids are the Zelda 3 ones wherever the effect means the same thing,
 * so one mapping.json drives every game: hearts are health (one heart = 8,
 * an Energy Tank's worth), rupees and magic are power chips, the sword is
 * Attack, the shield is Defense, an item is a sub-weapon. Effects only Zelda
 * can do (bottles, arrows, warps, bosses, sprites…) aren't offered: the hello
 * message lists what this game has, and the bridge skips the rest.
 *
 * The ROM is never changed. Effects write the NES's RAM, change the buttons
 * the game sees, or use the player's picture and speed tricks (emu/player.js fx).
 * RAM: glr/docs/ROM-NOTES.md, and the game's own code (energy tank bank 7
 * $DFA1, damage and death bank 7 $D2E6, new game bank 0 $8125).
 *
 *   GLRCrowd.trigger('heal_full', 'someone')   // test from the console
 *   GLRCrowd.list()                            // ids and names
 *
 * Settings are in the emulator menu (⚙) under "Crowd effects".
 */
(function (root) {
  'use strict';

  var SETTINGS_KEY = 'glr-crowd-settings';
  var BRIDGES = { ccplus: 'ws://localhost:21214', jinx: 'ws://localhost:43386' };   // Crowd Control+ / JinxCast (Snack OS)
  var cfg = { enabled: false, url: 'ws://localhost:21214', feed: true, alerts: true, allowReroll: false, showTimer: true };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
  function saveCfg() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch (e) {} }

  // ── The Guardian Legend RAM ($0000-$07FF) ─────────────────────────────────
  var A = {
    HPMAX: 0x47, HP: 0x48,
    ATTACK: 0x4A, DEFENSE: 0x4B,
    CHIPS: 0x4C, CHIPMAX: 0x4E,          // 16-bit
    AREA: 0x50, CORRIDOR: 0x51, ROOMX: 0x52, ROOMY: 0x53,
    WEAPONS: 0x4AC,                      // 3 bytes, 2 bits per sub-weapon (its level, 0 = not found)
    PLAYER: 0x500,                       // object 0's type (+$80 once running): 4 = blowing up (the game's death, $D442)
    PY: 0x518, PX: 0x530,                // object 0 (the Guardian) on screen
  };
  var DYING = 0x04;
  var WEAPONS = ['Multi-Bullet', 'Back Fire', 'Wave Attack', 'Bullet Shield', 'Grenade', 'Fireball',
    'Area Blaster', 'Repeller', 'Hyper Laser', 'Saber Laser', 'Cutter Laser'];

  function inGame(r) { return r.length >= 0x800 && r[A.HPMAX] > 0 && r[A.ROOMX] < 24 && r[A.ROOMY] < 24; }   // as js/tracker.js
  function inPlay(r) { return inGame(r) && r[A.HP] > 0 && (r[A.PLAYER] & 0x7F) !== DYING; }
  function P() { return root.EmuPlayer; }
  function fx() { var p = P(); return p && p.fx; }
  function core() { var p = P(); return p && p.core; }
  function setHp(r, v) { r[A.HP] = Math.max(1, Math.min(r[A.HPMAX], v | 0)); }
  function chips(r) { return r[A.CHIPS] | r[A.CHIPS + 1] << 8; }
  function chipMax(r) { return r[A.CHIPMAX] | r[A.CHIPMAX + 1] << 8; }
  function setChips(r, v) { v = Math.max(0, Math.min(chipMax(r), v | 0)); r[A.CHIPS] = v & 255; r[A.CHIPS + 1] = v >> 8; }
  function weaponLevel(r, i) { return (r[A.WEAPONS + (i >> 2)] >> ((i & 3) * 2)) & 3; }

  // NES pad bits, same order as EmuCore.BTN. B: the main gun, A: the sub-weapon.
  var B = { B: 1 << 0, UP: 1 << 4, DOWN: 1 << 5, LEFT: 1 << 6, RIGHT: 1 << 7, A: 1 << 8 };
  function swapBits(pad, a, b) {
    var ha = pad & a, hb = pad & b;
    pad &= ~(a | b);
    if (ha) pad |= b;
    if (hb) pad |= a;
    return pad;
  }

  // ── stats on loan: Attack / Defense / chips held lower for a while ────────
  // Each frame the value is held; at the end the real one comes back, unless
  // the game raised it meanwhile (a power-up found: that stays).
  var loans = {};   // id → { addr, was, hold }
  function lend(id, addr, hold, r) { loans[id] = { addr: addr, was: r[addr], hold: hold }; r[addr] = hold; }
  function holdLoan(id, r) { var l = loans[id]; if (l && r[l.addr] !== l.hold && r[l.addr] <= l.was) r[l.addr] = l.hold; }
  function giveBack(id) {
    var l = loans[id], c = core(), r = c && c.wram(); delete loans[id];
    if (!l || !r) return;
    if (r[l.addr] === l.hold) r[l.addr] = l.was;
  }
  function statLoan(id, addr, what, to, secs) {
    return { name: what, good: false, secs: secs || 30,
      check: function (r) { return to(r[addr]) < r[addr] ? '' : 'already as low as it goes'; },
      start: function (r) { lend(id, addr, to(r[addr]), r); }, frame: function (r) { holdLoan(id, r); }, end: function () { giveBack(id); } };
  }
  // a sub-weapon gone for a while: its two bits held at 0
  var gone = null;   // { i, bits }
  function weaponOff(r) {
    var have = []; for (var i = 0; i < WEAPONS.length; i++) if (weaponLevel(r, i)) have.push(i);
    var i2 = have[Math.floor(Math.random() * have.length)];
    gone = { i: i2, lvl: weaponLevel(r, i2) };
    feed('Took the ' + WEAPONS[i2] + ' for a while', 'bad');
  }
  function weaponHold(r) {
    if (!gone) return;
    var o = A.WEAPONS + (gone.i >> 2), sh = (gone.i & 3) * 2, lv = (r[o] >> sh) & 3;
    if (lv && lv <= gone.lvl) r[o] &= ~(3 << sh);
    else if (lv > gone.lvl) gone.lvl = lv, r[o] &= ~(3 << sh);   // found a better one: it comes back with the rest
  }
  function weaponBack() {
    var c = core(), r = c && c.wram(); if (!gone || !r) { gone = null; return; }
    var o = A.WEAPONS + (gone.i >> 2), sh = (gone.i & 3) * 2;
    if (!((r[o] >> sh) & 3)) r[o] |= gone.lvl << sh;
    gone = null;
  }
  var chipLoan = null;
  function screen(name) {
    return { start: function () { fx() && fx().setScreen(name, true); }, end: function () { fx() && fx().setScreen(name, false); } };
  }

  // ── the effects ─────────────────────────────────────────────────────────
  // Instant effects run once (apply; a string back means "couldn't", shown
  // in the feed). Timed ones last `secs` seconds of play and only filter
  // input or hold a value each frame, so a save state can't leave the game
  // stuck changed.
  var EFFECTS = {
    heal_full:   { name: 'Full health', good: true,
      apply: function (r) { if (r[A.HP] >= r[A.HPMAX]) return 'Health is already full'; setHp(r, r[A.HPMAX]); } },
    heal_1:      { name: '+8 health', good: true,
      apply: function (r) { if (r[A.HP] >= r[A.HPMAX]) return 'Health is already full'; setHp(r, r[A.HP] + 8); } },
    hurt_2:      { name: '-16 health', good: false,             // never kills
      apply: function (r) { var h = r[A.HP]; setHp(r, Math.max(Math.min(8, h), h - 16)); } },
    hp_1:        { name: 'Down to 8 health', good: false,
      apply: function (r) { if (r[A.HP] <= 8) return 'Health is already that low'; setHp(r, 8); } },
    insta_kill:  { name: 'Instant death', good: false,
      apply: function (r) { r[A.HP] = 0; r[A.PLAYER] = DYING; } },   // as the game's own damage does when health runs out
    heart_add:   { name: '+1 Energy Tank (max health +8)', good: true,
      apply: function (r) { if (r[A.HPMAX] >= 0xF8) return 'Max health is already full'; r[A.HPMAX] += 8; setHp(r, r[A.HP] + 8); } },
    heart_remove:{ name: '-1 Energy Tank (max health -8)', good: false,
      apply: function (r) { if (r[A.HPMAX] <= 16) return 'Max health is as low as it goes'; r[A.HPMAX] -= 8; if (r[A.HP] > r[A.HPMAX]) r[A.HP] = r[A.HPMAX]; } },
    one_hit:     { name: 'One-hit KO', good: false, secs: 30,
      frame: function (r) { if (r[A.HP] > 1) r[A.HP] = 1; } },

    rupees_plus: { name: '+50 chips', good: true,
      apply: function (r) { if (chips(r) >= chipMax(r)) return 'Chips are full'; setChips(r, chips(r) + 50); } },
    rupees_minus:{ name: '-50 chips', good: false,
      apply: function (r) { if (!chips(r)) return 'No chips to take'; setChips(r, chips(r) - 50); } },
    magic_full:  { name: 'Chips to max', good: true,
      apply: function (r) { if (chips(r) >= chipMax(r)) return 'Chips are full'; setChips(r, chipMax(r)); } },
    magic_small: { name: 'Small chip refill', good: true,
      apply: function (r) { if (chips(r) >= chipMax(r)) return 'Chips are full'; setChips(r, chips(r) + Math.max(10, chipMax(r) >> 2)); } },
    magic_drain: { name: 'Lose all chips', good: false,
      apply: function (r) { if (!chips(r)) return 'No chips to take'; setChips(r, 0); } },
    no_magic:    { name: 'Chips locked (no sub-weapons)', good: false, secs: 20,
      start: function (r) { chipLoan = chips(r); setChips(r, 0); },
      frame: function (r) { var c = chips(r); if (c && chipLoan != null) { chipLoan = Math.min(chipMax(r), chipLoan + c); setChips(r, 0); } },   // chips picked up meanwhile are kept for later
      end: function () { var c = core(), r = c && c.wram(); if (r && chipLoan != null) setChips(r, chips(r) + chipLoan); chipLoan = null; } },

    invert:      { name: 'Inverted D-pad', good: false, secs: 20,
      input: function (p) { return swapBits(swapBits(p, B.UP, B.DOWN), B.LEFT, B.RIGHT); } },
    no_sword:    { name: 'No main gun', good: false, secs: 20,
      input: function (p) { return p & ~B.B; } },
    no_item:     { name: 'No sub-weapon', good: false, secs: 20,
      input: function (p) { return p & ~B.A; } },
    swap_by:     { name: 'A and B swapped', good: false, secs: 20,
      input: function (p) { return swapBits(p, B.A, B.B); } },
    freeze:      { name: 'Freeze!', good: false, secs: 3,
      input: function () { return 0; } },
    // Jail (jail.js draws the bars): no moving; both guns still work
    jail:        { name: 'Jail', good: false, secs: 20,
      input: function (p) { return p & ~(B.UP | B.DOWN | B.LEFT | B.RIGHT); },
      frame: function () { if (root.RandoJail) root.RandoJail.show(true, 3); },
      end: function () { if (root.RandoJail) root.RandoJail.show(false); } },

    mirror:      Object.assign({ name: 'Mirror mode', good: false, secs: 20 }, screen('mirror')),
    upside_down: Object.assign({ name: 'Upside down', good: false, secs: 15 }, screen('flip')),
    wobble:      Object.assign({ name: 'Drunk wobble', good: false, secs: 20 }, screen('wobble')),
    tiny:        Object.assign({ name: 'Tiny screen', good: false, secs: 20 }, screen('tiny')),
    crt:         { name: 'Retro CRT', good: true, secs: 30, start: function () { fx() && fx().setTempFilter('crt'); }, end: function () { fx() && fx().setTempFilter(null); } },
    speed_up:    { name: 'Speed up (1.5x)', good: false, secs: 20, start: function () { fx() && fx().setSpeed(1.5); }, end: function () { fx() && fx().setSpeed(1); } },
    slow_mo:     { name: 'Slow motion', good: true, secs: 15, start: function () { fx() && fx().setSpeed(0.5); }, end: function () { fx() && fx().setSpeed(1); } },

    // ── the sword is Attack, the shield is Defense (a new game starts at 2 each) ──
    sword_up:    { name: 'Attack up', good: true,
      apply: function (r) { if (r[A.ATTACK] >= 9) return 'Attack is as high as it goes'; r[A.ATTACK]++; } },
    sword_down:  statLoan('sword_down', A.ATTACK, 'Attack down', function (v) { return Math.max(1, v - 1); }),
    sword_off:   statLoan('sword_off', A.ATTACK, 'Attack to minimum', function () { return 1; }),
    sword_steal: { name: 'Attack stolen (-1, stays)', good: false,
      apply: function (r) { if (r[A.ATTACK] <= 1) return 'Attack is as low as it goes'; r[A.ATTACK]--; } },
    shield_up:   { name: 'Defense up', good: true,
      apply: function (r) { if (r[A.DEFENSE] >= 9) return 'Defense is as high as it goes'; r[A.DEFENSE]++; } },
    shield_down: statLoan('shield_down', A.DEFENSE, 'Defense down', function (v) { return Math.max(1, v - 1); }),
    shield_off:  statLoan('shield_off', A.DEFENSE, 'Defense to minimum', function () { return 1; }),
    shield_steal:{ name: 'Defense stolen (-1, stays)', good: false,
      apply: function (r) { if (r[A.DEFENSE] <= 1) return 'Defense is as low as it goes'; r[A.DEFENSE]--; } },

    item_off:    { name: 'Sub-weapon gone', good: false, secs: 30,
      check: function (r) { for (var i = 0; i < WEAPONS.length; i++) if (weaponLevel(r, i)) return ''; return 'No sub-weapons to take'; },
      start: weaponOff, frame: weaponHold, end: weaponBack },

    seed_roll:   { name: 'New seed (same flags)', good: false,
      app: function (job) { return startReroll(job, 'same'); } },
    seed_preset: { name: 'Random preset seed', good: false,
      app: function (job) { return startReroll(job, 'preset'); } },
    seed_chaos:  { name: 'CHAOS seed', good: false,
      app: function (job) { return startReroll(job, 'chaos'); } },
  };

  // ── new seed (off unless allowed; 10 s countdown, cancel in the menu) ────
  // same: the flags last used; preset: a random GLR preset; chaos: a random
  // preset too (GLR has no chaos generator).
  var ROLL_KIND = {
    same:   { count: 'NEW SEED IN ', feed: 'New seed in ', roll: 'Rolling a new seed…', sub: 'Same flags as last time', done: 'New seed ready!' },
    preset: { count: 'RANDOM PRESET IN ', feed: 'Random preset in ', roll: 'Rolling a random preset…', sub: 'A random preset', done: 'Random preset ready!' },
    chaos:  { count: 'CHAOS SEED IN ', feed: 'CHAOS seed in ', roll: 'Rolling a CHAOS seed…', sub: 'A random preset', done: 'CHAOS seed ready!' },
  };
  var REROLL_SECS = 10, rerollT = null, rerollLeft = 0, rerollBy = '', rerollBusy = false, rerollMode = 'same';
  function startReroll(job, mode) {
    if (!rerollT && !rerollBusy) rerollMode = ROLL_KIND[mode] ? mode : 'same';
    var K = ROLL_KIND[rerollMode];
    if (!cfg.allowReroll) { feed('Seed reroll is turned off in Crowd effects', 'info'); return false; }
    if (rerollT || rerollBusy) { feed('A new seed is already coming', 'info'); return false; }
    if (!root.GLRSeed || !root.GLRSeed.rollAndPlay) { feed('Not available: new seed', 'info'); return false; }
    rerollBy = (job && job.user && job.user !== 'test') ? job.user : '';
    rerollLeft = REROLL_SECS;
    banner('count', K.count + rerollLeft, (rerollBy ? 'from ' + rerollBy + ' · ' : '') + 'this game ends', 0, 1);
    rerollT = setInterval(function () {
      rerollLeft--;
      if (rerollLeft > 0) {
        banner('count', K.count + rerollLeft, (rerollBy ? 'from ' + rerollBy + ' · ' : '') + 'this game ends', 0, rerollLeft / REROLL_SECS);
        if (rerollLeft <= 3) feed(K.feed + rerollLeft + '…', 'bad');
        render(); return;
      }
      clearInterval(rerollT); rerollT = null;
      rerollBusy = true;
      banner('roll', K.roll, K.sub, 0);
      root.GLRSeed.rollAndPlay({ mode: rerollMode, by: rerollBy, auto: true }).then(function (res) {
        var seed = res && res.meta ? res.meta.seed : res;
        banner('done-ok', K.done, (rerollBy ? 'Courtesy of ' + rerollBy : 'Good luck') + ' · seed ' + seed, 6000);
      }, function (e) {
        rerollBusy = false;
        banner('done-bad', 'Seed reroll failed', String((e && e.message) || e), 6000);
        render();
      });
      render();
    }, 1000);
    render();
    return true;
  }
  function cancelReroll() {
    if (!rerollT) return;
    clearInterval(rerollT); rerollT = null;
    feed('New seed cancelled', 'info');
    banner('done-bad', 'New seed cancelled', 'The streamer kept this seed', 4000);
  }

  var steady = 0, STEADY = 30;

  // ── queue and timers ────────────────────────────────────────────────────
  var queue = [], active = {}, gap = 0, GAP_FRAMES = 45, MAX_QUEUE = 60, waitT = 0;
  var durations = {};
  function secsOf(id) {
    var f = EFFECTS[id]; if (!f || !f.secs) return 0;
    var d = +durations[id];
    return d > 0 && d <= 600 ? d : f.secs;
  }
  var hist = [];
  function note(t) {
    var d = new Date(); hist.push(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + ' ' + t);
    if (hist.length > 14) hist.shift();
  }
  function trigger(id, user, label, jid) {
    if (!EFFECTS[id]) { note('unknown effect ' + id); return false; }
    if (queue.length >= MAX_QUEUE) { note('queue full, dropped ' + id); return false; }
    queue.push({ id: id, user: user || '', label: label || '', jid: jid || 0 });
    note('queued ' + id + (user ? ' (' + user + ')' : '') + ', ' + queue.length + ' waiting');
    render();
    return true;
  }

  // One answer per JinxCast request (see crowd/effects.js; Crowd Control+ jobs have no id).
  function report(job, status, reason) {
    if (job && job.jid) send({ type: 'result', id: job.jid, effect: job.id, user: job.user, status: status, reason: reason || undefined });
  }

  function onFrame(c) {
    try { onFrameInner(c); } catch (e) { console.warn('[crowd]', e); note('error: ' + (e && e.message || e)); }
  }
  function onFrameInner(c) {
    var ram = c.wram();
    steady = inPlay(ram) ? steady + 1 : 0;
    sendRun(ram);
    var playing = inPlay(ram);
    if (queue.length && !playing) {
      if (++waitT === 240) feed(queue.length + ' waiting: the Guardian isn\'t in play', 'info');
    } else waitT = 0;
    if (!playing) return;
    for (var id in active) {
      var f = EFFECTS[id];
      if (f.frame) f.frame(ram);
      if (--active[id] <= 0) { delete active[id]; if (f.end) { try { f.end(); } catch (e) {} } feed(f.name + ' ended', 'end'); render(); }
    }
    if (gap > 0) { gap--; return; }
    if (steady < STEADY) return;
    var job = queue.shift();
    if (!job) return;
    note('running ' + job.id);
    var fe = EFFECTS[job.id];
    var secs = secsOf(job.id);
    if (fe.check) {
      var why = fe.check(ram);
      if (why) { feed(fe.name + ': ' + why, 'info'); report(job, 'refused', why); render(); return; }
    }
    if (secs) {
      if (active[job.id]) { /* already on: the time just adds up */ }
      else if (fe.start) { try { fe.start(ram); } catch (e) { console.warn('[crowd]', job.id, e); } }
      active[job.id] = (active[job.id] || 0) + Math.round(secs * (c.fps || 60.1));
    } else if (fe.app) {
      try { if (fe.app(job) === false) { report(job, 'refused', 'seed reroll is off in Rando Hub, or a new seed is already coming'); render(); return; } } catch (e) { console.warn('[crowd]', job.id, e); }
    } else {
      var res = fe.apply(ram);
      if (typeof res === 'string') { feed(fe.name + ': ' + res, 'info'); report(job, 'refused', res); render(); return; }
    }
    gap = GAP_FRAMES;
    var who = job.user && job.user !== 'test' ? job.user : '';
    feed((who ? who + ': ' : '') + fe.name + (secs ? ' (' + secs + 's)' : ''), fe.good ? 'good' : 'bad');
    if (who) giftCard(who, job.label, fe.name, fe.good);
    send({ type: 'applied', effect: job.id, user: job.user });
    report(job, 'applied');
    render();
  }
  function onInput(pad) {
    var c = core();
    if (!c) return pad;
    var any = false;
    for (var id in active) if (EFFECTS[id].input) { any = true; break; }
    if (!any || !inPlay(c.wram())) return pad;
    for (var k in active) if (EFFECTS[k].input) pad = EFFECTS[k].input(pad);
    return pad;
  }
  function endAll() {
    for (var id in active) { var f = EFFECTS[id]; if (f && f.end) { try { f.end(); } catch (e) {} } }
    active = {};
  }

  // ── run info for the control panel (once a second while connected) ──────
  var run = { game: 'glr', deaths: 0, checks: 0, bonks: 0, place: '', seed: '', music: '', bosses: [], hearts: 0 };
  var runSent = '', runT = 0;
  function sendRun(ram) {
    if (status !== 'connected' || ++runT % 60) return;
    var p = P();
    run.seed = (p && p.gameName) || '';
    if (inGame(ram)) {
      run.hearts = Math.round(ram[A.HPMAX] / 8);
      run.place = ram[A.CORRIDOR] ? 'Corridor ' + ram[A.CORRIDOR] : 'Area ' + (ram[A.AREA] & 0x0F);
    }
    var j = JSON.stringify(run);
    if (j !== runSent) { runSent = j; send(Object.assign({ type: 'run' }, run)); }
  }

  // ── on-screen feed, gift card, banner, subathon clock ───────────────────
  function host() { return document.querySelector('.s9x'); }
  function style(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);
  }
  var CSS =
    '.cc-feed { position: absolute; right: 8px; top: 8px; z-index: 25; display: flex; flex-direction: column; align-items: flex-end;' +
    ' gap: 4px; pointer-events: none; max-width: 70%; font: 600 12px/1.25 system-ui, sans-serif; }' +
    '.cc-feed div { background: rgba(10,12,16,.82); color: #fff; padding: 4px 9px; border-radius: 6px; border-left: 3px solid #8b95a3;' +
    ' transition: opacity .4s; text-shadow: 0 1px 1px #000; }' +
    '.cc-feed .good { border-left-color: #3fb950; } .cc-feed .bad { border-left-color: #e5534b; } .cc-feed .end { opacity: .7; }' +
    '.cc-feed .info { border-left-color: #e3b341; }' +
    '.cc-gift { position: absolute; left: 50%; top: 40px; transform: translate(-50%, -8px); z-index: 26; pointer-events: none;' +
    ' display: flex; align-items: center; gap: 8px; max-width: 70%; padding: 5px 12px 5px 9px; border-radius: 8px;' +
    ' background: rgba(18,12,34,.92); border: 2px solid #e63946; box-shadow: 0 4px 14px rgba(0,0,0,.5); color: #fff;' +
    ' opacity: 0; transition: opacity .3s ease, transform .3s ease; font: 600 12px/1.25 system-ui, sans-serif; }' +
    '.cc-gift.show { opacity: 1; transform: translate(-50%, 0); } .cc-gift.good { border-color: #3fb950; }' +
    '.cc-gift .ic { font-size: 18px; } .cc-gift .nm { display: block; font-weight: 700; font-size: 13px; }' +
    '.cc-gift .fx { display: block; color: #ffd166; font-size: 11px; }' +
    '.cc-reroll { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); z-index: 26; pointer-events: none;' +
    ' min-width: 58%; max-width: 92%; box-sizing: border-box; padding: 10px 16px 12px; border-radius: 10px; text-align: center;' +
    ' background: rgba(10,12,16,.86); color: #fff; font: 700 13px/1.3 system-ui, sans-serif; text-shadow: 0 1px 2px #000;' +
    ' border: 2px solid #e5534b; transition: opacity .5s; }' +
    '.cc-reroll .t { font-size: clamp(15px, 3.6vw, 28px); } .cc-reroll .s { margin-top: 3px; font-weight: 600; opacity: .9; }' +
    '.cc-reroll .bar { margin-top: 8px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.18); overflow: hidden; }' +
    '.cc-reroll .bar i { display: block; height: 100%; background: #e5534b; transition: width 1s linear; }' +
    '.cc-reroll.roll { border-color: #e3b341; } .cc-reroll.done-ok { border-color: #3fb950; } .cc-reroll.done-bad { border-color: #8b95a3; }' +
    '.cc-clock { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 24; pointer-events: none;' +
    ' padding: 4px 12px; border-radius: 8px; background: rgba(10,12,16,.8); color: #fff;' +
    ' font: 800 18px/1.1 ui-monospace, Consolas, monospace; border: 1px solid rgba(227,179,65,.6); }' +
    '.cc-clock.paused { opacity: .6; } .cc-clock.ended { border-color: #e5534b; }';

  var feedEl = null;
  function feed(text, kind) {
    if (!cfg.feed || typeof document === 'undefined') return;
    if (!feedEl || !feedEl.isConnected) {
      var h = host(); if (!h) return;
      style('cc-css', CSS);
      feedEl = document.createElement('div'); feedEl.className = 'cc-feed'; h.appendChild(feedEl);
    }
    var d = document.createElement('div');
    d.className = kind || ''; d.textContent = text;
    feedEl.appendChild(d);
    while (feedEl.children.length > 4) feedEl.firstChild.remove();
    setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); }, 4000);
  }

  var giftQ = [], giftEl = null, giftBusy = false;
  function giftCard(user, label, what, good) {
    if (!cfg.alerts || typeof document === 'undefined') return;
    giftQ.push({ user: user, label: label, what: what, good: good });
    if (giftQ.length > 6) giftQ.splice(0, giftQ.length - 6);
    if (!giftBusy) giftNext();
  }
  function giftNext() {
    var g = giftQ.shift(); if (!g) { giftBusy = false; return; }
    var h = host(); if (!h) { giftBusy = false; giftQ = []; return; }
    giftBusy = true;
    style('cc-css', CSS);
    if (!giftEl || !giftEl.isConnected) {
      giftEl = document.createElement('div'); giftEl.className = 'cc-gift';
      giftEl.innerHTML = '<span class="ic">🎁</span><span><span class="nm"></span><span class="fx"></span></span>';
      h.appendChild(giftEl);
    }
    var lab = String(g.label || '');
    giftEl.querySelector('.ic').textContent = /follow/i.test(lab) ? '⭐' : /share/i.test(lab) ? '📣' : /like/i.test(lab) ? '❤️' : '🎁';
    giftEl.querySelector('.nm').textContent = g.user + (lab && lab !== 'test' ? ' · ' + lab : '');
    giftEl.querySelector('.fx').textContent = '→ ' + g.what;
    giftEl.classList.toggle('good', !!g.good);
    giftEl.classList.remove('show'); void giftEl.offsetWidth; giftEl.classList.add('show');
    setTimeout(function () { if (giftEl) giftEl.classList.remove('show'); setTimeout(giftNext, 350); }, giftQ.length ? 2200 : 3000);
  }

  var bannerEl = null, bannerHideT = null;
  function banner(kind, title, sub, hideAfter, frac) {
    if (typeof document === 'undefined') return;
    clearTimeout(bannerHideT);
    var h = host(); if (!h) return;
    style('cc-css', CSS);
    if (!bannerEl) { bannerEl = document.createElement('div'); bannerEl.innerHTML = '<div class="t"></div><div class="s"></div><div class="bar"><i></i></div>'; }
    if (bannerEl.parentNode !== h) h.appendChild(bannerEl);
    bannerEl.className = 'cc-reroll ' + kind;
    bannerEl.style.opacity = '1';
    bannerEl.querySelector('.t').textContent = title;
    bannerEl.querySelector('.s').textContent = sub || '';
    var bar = bannerEl.querySelector('.bar');
    bar.hidden = kind !== 'count';
    if (kind === 'count') bar.firstChild.style.width = Math.max(0, Math.min(1, frac || 0)) * 100 + '%';
    if (hideAfter) bannerHideT = setTimeout(function () {
      if (!bannerEl) return;
      bannerEl.style.opacity = '0';
      bannerHideT = setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 550);
    }, hideAfter);
  }

  var clockEl = null;
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function showClock(t) {
    if (typeof document === 'undefined') return;
    if (!(cfg.showTimer && t && t.active)) { if (clockEl) { clockEl.remove(); clockEl = null; } return; }
    var h = host(); if (!h) return;
    style('cc-css', CSS);
    if (!clockEl) clockEl = document.createElement('div');
    if (clockEl.parentNode !== h) h.appendChild(clockEl);
    clockEl.className = 'cc-clock' + (t.ended ? ' ended' : !t.running ? ' paused' : '');
    clockEl.textContent = t.ended ? 'TIME!' : fmtClock(t.remaining);
  }

  // ── connection to Crowd Control+ ────────────────────────────────────────
  var ws = null, status = 'off', retryT = null, retryMs = 2000, bridgeInfo = '';
  function send(msg) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } }
  function connect() {
    clearTimeout(retryT);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    if (!cfg.enabled) { status = 'off'; render(); return; }
    status = 'connecting'; render();
    try { ws = new WebSocket(cfg.url); } catch (e) { status = 'bad address'; render(); return; }
    ws.onopen = function () {
      status = 'connected'; retryMs = 2000; runSent = ''; render();
      send({ type: 'hello', app: 'glr', proto: 2, effects: list() });
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'effect') {
        var n = Math.max(1, Math.min(10, m.count | 0 || 1)), took = 0;
        // a combo answers once, for its first effect
        for (var i = 0; i < n; i++) if (trigger(m.effect, m.user, m.label, took ? 0 : m.id)) took++;
        if (m.id) send(took ? { type: 'result', id: m.id, effect: m.effect, status: 'queued', queued: took }
                            : { type: 'result', id: m.id, effect: m.effect, user: m.user, status: 'refused', reason: EFFECTS[m.effect] ? 'queue full' : 'unknown effect' });
      } else if (m.type === 'timer') showClock(m);
      else if (m.type === 'durations') { durations = m.secs && typeof m.secs === 'object' ? m.secs : {}; render(); }
      else if (m.type === 'status') { bridgeInfo = m.text || ''; render(); if (m.text) feed(m.text, 'info'); }
      else if (m.event && !m.type) { bridgeInfo = 'TikFinity, not the bridge: use ws://localhost:21214'; render(); }
    };
    ws.onclose = function () {
      ws = null;
      if (!cfg.enabled) return;
      status = 'waiting for bridge'; render();
      retryT = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };
    ws.onerror = function () {};
  }

  // ── menu section (in the emulator's ⋯ menu) ─────────────────────────────
  var rerender = null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function menuHtml(rr) {
    if (rr) rerender = rr;
    var timed = Object.keys(active).map(function (id) { return EFFECTS[id].name + ' ' + Math.ceil(active[id] / 60) + 's'; });
    var tests = Object.keys(EFFECTS).map(function (id) {
      return '<button type="button" data-ext="cc-test" data-id="' + id + '">' + esc(EFFECTS[id].name) + '</button>';
    }).join('');
    var recent = hist.length ? '<p class="hint" style="font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;margin-top:6px">' + esc(hist.slice().reverse().join('\n')) + '</p>' : '';
    return '<h4>Crowd effects</h4>' + recent +
      '<div class="row"><span>TikTok effects on</span><input type="checkbox" data-ext="cc-enabled"' + (cfg.enabled ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Bridge address</span><input type="text" data-ext="cc-url" value="' + esc(cfg.url) + '" style="width:55%;max-width:240px"></div>' +
      '<div class="row"><span>Connect to</span><span>' +
        '<button type="button" data-ext="cc-bridge" data-to="ccplus"' + (cfg.url === BRIDGES.ccplus ? ' class="primary"' : '') + '>Crowd Control+</button> ' +
        '<button type="button" data-ext="cc-bridge" data-to="jinx"' + (cfg.url === BRIDGES.jinx ? ' class="primary"' : '') + '>JinxCast</button></span></div>' +
      '<div class="row"><span>Gift alerts on the game</span><input type="checkbox" data-ext="cc-alerts"' + (cfg.alerts ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show feed on game</span><input type="checkbox" data-ext="cc-feed"' + (cfg.feed ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Allow seed reroll (ends this game)</span><input type="checkbox" data-ext="cc-reroll"' + (cfg.allowReroll ? ' checked' : '') + '></div>' +
      '<div class="row"><span>Show subathon clock on game</span><input type="checkbox" data-ext="cc-show-timer"' + (cfg.showTimer ? ' checked' : '') + '></div>' +
      (rerollT ? '<div class="acts"><button type="button" class="primary" data-ext="cc-cancel-reroll">Cancel new seed (' + rerollLeft + 's)</button></div>' : '') +
      '<p class="hint">Status: ' + esc(status) + (bridgeInfo ? ' · ' + esc(bridgeInfo) : '') +
        ' · ' + queue.length + ' queued' + (timed.length ? ' · active: ' + esc(timed.join(', ')) : '') + '</p>' +
      '<p class="hint">Test an effect (it runs when you return to the game):</p>' +
      '<div class="acts">' + tests + '</div>' +
      (status === 'connected' && cfg.url !== BRIDGES.jinx
        ? '<div class="acts" style="margin-top:6px"><button type="button" data-ext="cc-plus" data-what="gift">Fake gift (alert + effect)</button>' +
          '<button type="button" data-ext="cc-plus" data-what="mystery_box">Mystery box</button></div>'
        : '<p class="hint">Connect to Crowd Control+ for the mystery box and fake-gift tests.</p>') +
      '<div class="acts" style="margin-top:6px"><button type="button" data-ext="cc-clear">Clear queue and timers</button></div>';
  }
  function menuClick(b, rr) {
    rerender = rr;
    var a = b.dataset.ext;
    if (a === 'cc-test') { note('test button: ' + b.dataset.id); trigger(b.dataset.id, 'test'); }
    else if (a === 'cc-clear') { endAll(); queue.length = 0; cancelReroll(); }
    else if (a === 'cc-cancel-reroll') cancelReroll();
    else if (a === 'cc-bridge') { cfg.url = BRIDGES[b.dataset.to] || cfg.url; bridgeInfo = ''; saveCfg(); note('bridge: ' + cfg.url); connect(); }
    else if (a === 'cc-plus') { send({ type: 'test', what: b.dataset.what }); feed('Sent to Crowd Control+: ' + (b.dataset.what === 'gift' ? 'fake gift' : 'mystery box'), 'info'); }
    rr();
  }
  function menuInput(el) {
    var a = el.dataset.ext;
    if (a === 'cc-enabled') { cfg.enabled = el.checked; saveCfg(); connect(); }
    else if (a === 'cc-feed') { cfg.feed = el.checked; saveCfg(); }
    else if (a === 'cc-alerts') { cfg.alerts = el.checked; saveCfg(); }
    else if (a === 'cc-show-timer') { cfg.showTimer = el.checked; saveCfg(); if (!el.checked && clockEl) { clockEl.remove(); clockEl = null; } }
    else if (a === 'cc-reroll') { cfg.allowReroll = el.checked; saveCfg(); if (!el.checked) cancelReroll(); rerender && rerender(); }
    else if (a === 'cc-url') { cfg.url = el.value.trim(); saveCfg(); clearTimeout(menuInput.t); menuInput.t = setTimeout(connect, 800); }
  }
  function render() {
    if (!rerender || typeof document === 'undefined') return;
    var m = document.querySelector('.s9x-menu');
    if (!m || m.hidden) return;
    var ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.ext === 'cc-url') return;
    clearTimeout(render.t); render.t = setTimeout(function () { try { rerender(); } catch (e) {} }, 50);
  }
  function list() {
    return Object.keys(EFFECTS).map(function (id) {
      return { id: id, name: EFFECTS[id].name, secs: secsOf(id), good: !!EFFECTS[id].good };
    });
  }

  // ── wire into the player ────────────────────────────────────────────────
  function install() {
    var p = P();
    if (!p || !p.hooks) return false;
    p.hooks.frame = onFrame;
    p.hooks.input = onInput;
    p.hooks.menu = { html: menuHtml, click: menuClick, input: menuInput };
    connect();
    return true;
  }
  root.GLRCrowd = {
    trigger: trigger, list: list, cancelReroll: cancelReroll, EFFECTS: EFFECTS, ADDR: A, inPlay: inPlay,
    get queue() { return queue.slice(); }, get active() { return Object.assign({}, active); },
    get status() { return status; },
    get recent() { return hist.slice(); },
    get steady() { return steady; },
    _onFrame: onFrame, _onInput: onInput,
  };
  if (!install()) {
    var tries = 0, t = setInterval(function () { if (install() || ++tries > 50) clearInterval(t); }, 200);
  }
})(window);
