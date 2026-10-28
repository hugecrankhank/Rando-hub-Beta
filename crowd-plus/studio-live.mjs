/*
 * Crowd Control+ live features, on top of studio.mjs:
 *
 *   chat votes      a poll on stream; chat types 1-4; the winner's effect runs
 *   team battle     gifts fill a Light World or Dark World bar; the winner's
 *                   effect runs
 *   mystery box     a slot machine that lands on a random effect
 *   combo meter     gifts close together build a multiplier; every N = bonus
 *   run stats       deaths, checks, place, seed and music from the game
 *   death tax       a death adds subathon time and/or moves a goal
 *   predictions     "Will he beat this dungeon without dying?" !yes / !no
 *   GT big key      chat guesses which Ganon's Tower chest has the big key
 *                   (!gt 9); the game says which it was
 *   dig game        chat guesses which dig gives the Digging Game's prize
 *                   (!dig 15); the game says which it was
 *   clip markers    big moments time-stamped for editing later (+ !clip)
 *   seed history    every seed played: when, which, its code, who rolled it
 *                   and how (seeds.json, kept across streams)
 *   hall of fame    all-time top gifters across streams
 *   welcome back    a pop-up when a regular shows up again
 *
 * Everything reaches the overlays and the panel through the same event
 * stream as the rest of the Studio ({ kind: 'live', ... } messages and the
 * `live` part of the state snapshot).
 */
import fs from 'node:fs';
import path from 'node:path';

export const LIVE_DEFAULTS = {
  votes: { seconds: 45, autoRun: true },
  battle: { names: ['LIGHT WORLD', 'DARK WORLD'], join: ['!light', '!dark'], target: 2000, minutes: 0,
    effects: ['heal_full', 'seed_chaos'] },
  mystery: { spinSeconds: 4, pool: ['heal_full', 'heal_1', 'hurt_2', 'rupees_plus', 'rupees_minus', 'bombs_plus', 'arrows_plus',
    'magic_drain', 'invert', 'no_sword', 'swap_by', 'ice', 'cucco_storm', 'enemy_spawn', 'mirror', 'upside_down', 'wobble',
    'tiny', 'crt', 'speed_up', 'slow_mo', 'freeze', 'fairy', 'pink_link', 'sprite_roll', 'music_roulette'] },
  combo: { enabled: true, windowSeconds: 8, bonusAt: 10, bonusEffect: 'mystery_box' },
  deathTax: { enabled: true, timerSeconds: 300, goalId: '', goalAmount: 0, alert: true },
  // progress changes the subathon clock: each new check and each boss beaten
  // takes time off (mode 'remove') or puts it on ('add')
  runClock: { enabled: false, mode: 'remove', checkSeconds: 60, bossSeconds: 300, alert: true },
  predict: { seconds: 60, winnersShown: 12 },
  gtGuess: { command: '!gt', lockOnFirstChest: true, winnersShown: 12, alert: true },
  digGuess: { command: '!dig', lockOnFirstDig: true, winnersShown: 12, alert: true },
  clips: { minCoins: 500, deaths: true, seeds: true, chatClip: true, chatCooldown: 30 },
  hallOfFame: { title: 'HALL OF FAME', size: 5 },
  welcome: { enabled: true, minStreams: 3, title: 'WELCOME BACK' },
  detour: { alert: true, winEffect: 'heal_full', winTimerSeconds: 300, surviveEffect: 'rupees_plus', surviveTimerSeconds: 0 },
};

const DUNGEON_ORDER = ['Hyrule Castle', 'Eastern Palace', 'Desert Palace', 'Tower of Hera', "Agahnim's Tower", 'Palace of Darkness',
  'Swamp Palace', 'Skull Woods', "Thieves' Town", 'Ice Palace', 'Misery Mire', 'Turtle Rock', "Ganon's Tower"];

export function createLive(ctx) {
  // ctx: { HERE, log, push(msg), settings(), saveSettings(), fire(effect,user,label), effectName(id),
  //        effectIds(), timerApi(op,seconds), timerView(), streamSince(), record(ev) }
  const { HERE, log } = ctx;
  const S = () => ctx.settings();
  const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
  const writeLater = (() => { const t = {}; return (f, v) => { clearTimeout(t[f]); t[f] = setTimeout(() => { try { fs.writeFileSync(f, JSON.stringify(v, null, 1) + '\n'); } catch (e) { log(`couldn't save ${path.basename(f)}: ${e.message}`); } }, 800); }; })();
  const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
  const send = (what, data = {}) => ctx.push({ kind: 'live', what, ...data });
  const name = (u, nick) => nick || u || 'someone';

  // ── persistent files ───────────────────────────────────────────────────
  const FAME_FILE = path.join(HERE, 'hall-of-fame.json');
  const VIEWERS_FILE = path.join(HERE, 'viewers.json');
  const CLIPS_FILE = path.join(HERE, 'clips.json');
  let fame = readJson(FAME_FILE, {});          // user → { coins, gifts, nickname, avatar, streams, last }
  let viewers = readJson(VIEWERS_FILE, {});    // user → { streams, lastStream, nickname }
  let clips = readJson(CLIPS_FILE, []);        // { id, at, elapsed, label, kind }
  const SEEDS_FILE = path.join(HERE, 'seeds.json');
  let seeds = readJson(SEEDS_FILE, []);        // { at, name, game, what, code, link, how, by, ... }
  if (!Array.isArray(seeds)) seeds = [];

  // ── seed history ───────────────────────────────────────────────────────
  // The game says when a new seed starts ('seed', with the hub's details:
  // code, link, who rolled it and how). Zelda 1 (and a hub without the
  // details) only shows a new seed name in its run stats: that's logged too.
  const SEED_KEYS = ['what', 'generator', 'preset', 'pick', 'code', 'race', 'link', 'kind', 'how', 'by', 'from'];
  function seedSeen(info, game) {
    const nm = clean(info.name, 120);
    if (!nm) return;
    const last = seeds[seeds.length - 1];
    let e = last && last.name === nm ? last : null;
    if (!e) { e = { at: Date.now(), name: nm, game: clean(info.game || game || 'Zelda 3', 20), elapsed: Math.max(0, Math.round((Date.now() - ctx.streamSince()) / 1000)) }; seeds.push(e); if (seeds.length > 2000) seeds.shift(); }
    let changed = e !== last;
    for (const k of SEED_KEYS) if (info[k] != null && info[k] !== '' && e[k] !== info[k]) { e[k] = k === 'race' ? !!info[k] : clean(info[k], 400); changed = true; }
    if (!changed) return;
    writeLater(SEEDS_FILE, seeds);
    send('seeds', { seeds: seeds.slice(-200) });
  }

  // ── run stats from the game ────────────────────────────────────────────
  let runStats = { deaths: 0, checks: 0, bonks: 0, place: '', seed: '', music: '', hearts: 0, bosses: [], at: 0 };
  function onGame(m) {
    if (m.type === 'run') {
      runStats = { deaths: +m.deaths || 0, checks: +m.checks || 0, bonks: +m.bonks || 0, place: clean(m.place, 40), seed: clean(m.seed, 80),
        music: clean(m.music, 80), hearts: +m.hearts || 0, bosses: Array.isArray(m.bosses) ? m.bosses.map((b) => clean(b, 20)).slice(0, 20) : [], at: Date.now() };
      onProgress(runStats);
      if (m.seed) seedSeen({ name: m.seed }, m.game === 'z1r' ? 'Zelda 1' : 'Zelda 3');
      if (m.gt && typeof m.gt === 'object') onGt(m.gt);
      if (m.dig && typeof m.dig === 'object') onDig(m.dig);
      send('run', { run: runStats });
    } else if (m.type === 'reveal') {
      addClip(`🔮 ${clean(m.user, 40) || 'Someone'} revealed ${clean(m.item, 40)} at ${clean(m.loc, 80)}`, 'reveal', m.user);
    } else if (m.type === 'seed' && m.seed && typeof m.seed === 'object') {
      seedSeen(m.seed);
    } else if (m.type === 'death') {
      runStats.deaths = +m.deaths || runStats.deaths + 1;
      onDeath();
    } else if (m.type === 'detour') {
      const D = S().detour;
      if (m.phase === 'start') {
        ctx.record({ type: 'detour', user: m.user || 'someone', text: clean(m.boss, 40), secs: +m.secs || 60,
          alert: D.alert ? { tier: 'detour', title: 'BOSS DETOUR!' } : undefined });
        addClip(`Boss detour: ${clean(m.boss, 40)}${m.user ? ' (sent by ' + clean(m.user, 40) + ')' : ''}`, 'detour', m.user);
        send('detour', { detour: { boss: clean(m.boss, 40), user: clean(m.user, 40), secs: +m.secs || 60, at: Date.now() } });
      } else {
        const r = String(m.result || '');
        let bonus = '';
        if (r === 'won' || r === 'survived') {
          const eff = r === 'won' ? D.winEffect : D.surviveEffect, secs = Math.round(+(r === 'won' ? D.winTimerSeconds : D.surviveTimerSeconds) || 0);
          if (eff) { setTimeout(() => ctx.fire(eff, r === 'won' ? 'Boss beaten' : 'Survived', 'Detour bonus'), 1500); bonus = ctx.effectName(eff); }
          const tv = ctx.timerView();
          if (secs && tv.active && !tv.ended) { ctx.timerApi('add', secs, 'boss detour bonus'); bonus += (bonus ? ' + ' : '') + `${fmtShort(secs)} on the clock`; }
        }
        const title = { won: 'BOSS DEFEATED!', survived: 'SURVIVED THE DETOUR!', ko: 'KNOCKED OUT!', escaped: 'ESCAPED!', lost: 'DETOUR OVER' }[r] || 'DETOUR OVER';
        ctx.record({ type: 'detour-end', user: 'Link', text: clean(m.boss, 40), result: r, bonus,
          alert: D.alert ? { tier: r === 'won' || r === 'survived' ? 'big' : 'death', title } : undefined });
        if (r === 'won') addClip(`Beat ${clean(m.boss, 40)} on a boss detour!`, 'detour');
        send('detour', { detour: null, result: r });
      }
    } else if (m.type === 'rescue') {
      ctx.record({ type: 'detour-rescue', user: m.user || 'someone', text: 'rescued Link from the boss!' });
    } else if (m.type === 'music') {
      runStats.music = clean(m.pack, 80);
      send('music', { pack: runStats.music });
      ctx.record({ type: 'music', user: 'game', text: runStats.music || "The game's own music" });
    }
  }
  function onDeath() {
    const T = S().deathTax;
    let taxed = '';
    if (T.enabled) {
      const secs = Math.round(+T.timerSeconds || 0);
      const tv = ctx.timerView();
      if (secs && tv.active && !tv.ended) { ctx.timerApi('add', secs, 'death tax'); taxed = `+${fmtShort(secs)} on the clock`; }
      const g = (S().goals || []).find((x) => x.id === T.goalId);
      if (g && +T.goalAmount) { g.current = Math.max(0, (+g.current || 0) + +T.goalAmount); ctx.saveSettings(); taxed += (taxed ? ', ' : '') + `${g.label} +${T.goalAmount}`; }
    }
    ctx.record({ type: 'death', user: 'Link', deaths: runStats.deaths, text: taxed, alert: T.enabled && T.alert ? { tier: 'death', title: 'DEATH TAX' } : undefined });
    if (S().clips.deaths) addClip(`Death #${runStats.deaths}`, 'death');
    send('run', { run: runStats });
  }
  // ── progress on the subathon clock ─────────────────────────────────────
  // The first numbers seen for a game (the bridge just started, or another
  // seed) are only a starting point: a game picked up halfway doesn't take
  // hours off at once. After that, each new check and each newly beaten boss
  // counts. A big jump in one go (a different save loaded) is a new starting
  // point too.
  const BOSS_NAMES = { armos: 'Armos Knights', lanmolas: 'Lanmolas', moldorm: 'Moldorm', helmasaur: 'Helmasaur King', arrghus: 'Arrghus',
    mothula: 'Mothula', blind: 'Blind', kholdstare: 'Kholdstare', vitreous: 'Vitreous', trinexx: 'Trinexx', aga1: 'Agahnim', aga2: 'Agahnim 2' };
  let base = null;   // { seed, checks, bosses: Set }
  function onProgress(r) {
    const C = S().runClock;
    if (!base || base.seed !== r.seed || r.checks < base.checks || r.checks - base.checks > 25) {
      base = { seed: r.seed, checks: r.checks, bosses: new Set(r.bosses) };
      return;
    }
    const newChecks = r.checks - base.checks;
    const newBosses = r.bosses.filter((b) => !base.bosses.has(b));
    base.checks = r.checks;
    newBosses.forEach((b) => base.bosses.add(b));
    if (newBosses.length > 3) return;                     // a different save, not a fight
    if (!C.enabled) return;
    const tv = ctx.timerView();
    if (!tv.active || tv.ended) return;
    const sign = C.mode === 'add' ? 1 : -1;
    if (newChecks > 0 && +C.checkSeconds > 0) {
      const secs = Math.round(+C.checkSeconds) * newChecks;
      ctx.timerApi('add', sign * secs, newChecks === 1 ? `check #${r.checks}` : `${newChecks} checks`);
    }
    for (const b of newBosses) {
      const secs = Math.round(+C.bossSeconds || 0), nm = BOSS_NAMES[b] || b;
      if (secs > 0) ctx.timerApi('add', sign * secs, `beat ${nm}`);
      ctx.record({ type: 'boss', user: 'Link', text: nm, bonus: secs > 0 ? `${sign < 0 ? '−' : '+'}${fmtShort(secs)} on the clock` : '',
        alert: C.alert ? { tier: 'big', title: 'BOSS DEFEATED!' } : undefined });
      if (S().clips.deaths) addClip(`Beat ${nm}`, 'boss');
    }
  }

  const fmtShort = (s) => s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '') : Math.floor(s / 3600) + 'h ' + Math.floor(s / 60) % 60 + 'm';

  // ── chat votes ─────────────────────────────────────────────────────────
  let poll = null, pollT = null;
  function pollView() { return poll && { id: poll.id, question: poll.question, options: poll.options.map((o) => ({ label: o.label, effect: o.effect, votes: o.votes })), endsAt: poll.endsAt, done: poll.done, winner: poll.winner, total: poll.voters.size }; }
  function startPoll(a) {
    const opts = (a.options || []).map((o) => ({ label: clean(o.label, 40), effect: clean(o.effect, 40), votes: 0 })).filter((o) => o.label).slice(0, 4);
    if (opts.length < 2) throw new Error('A vote needs at least 2 choices');
    const secs = Math.max(10, Math.min(600, Math.round(+a.seconds || S().votes.seconds || 45)));
    poll = { id: Date.now(), question: clean(a.question, 80) || 'VOTE!', options: opts, endsAt: Date.now() + secs * 1000, voters: new Map(), done: false, winner: -1 };
    clearTimeout(pollT); pollT = setTimeout(endPoll, secs * 1000);
    log(`vote started: ${poll.question} (${opts.map((o) => o.label).join(' / ')})`);
    send('poll', { poll: pollView() });
  }
  function votePoll(user, idx) {
    if (!poll || poll.done || idx < 0 || idx >= poll.options.length) return false;
    const prev = poll.voters.get(user);
    if (prev === idx) return false;
    if (prev !== undefined) poll.options[prev].votes--;
    poll.voters.set(user, idx); poll.options[idx].votes++;
    send('poll', { poll: pollView() });
    return true;
  }
  function endPoll() {
    if (!poll || poll.done) return;
    clearTimeout(pollT);
    poll.done = true;
    const max = Math.max(...poll.options.map((o) => o.votes));
    const top = poll.options.map((o, i) => [o, i]).filter(([o]) => o.votes === max);
    const [w, wi] = top[Math.floor(Math.random() * top.length)];   // a tie is settled by chance
    poll.winner = wi;
    log(`vote ended: "${w.label}" wins with ${w.votes} vote${w.votes === 1 ? '' : 's'}`);
    if (w.effect && S().votes.autoRun && max > 0) ctx.fire(w.effect, 'Chat vote', w.label);
    addClip(`Vote: ${w.label}`, 'vote');
    send('poll', { poll: pollView() });
    setTimeout(() => { if (poll && poll.done && Date.now() - poll.endsAt > 9000) { poll = null; send('poll', { poll: null }); } }, 12000);
  }

  // ── team battle ────────────────────────────────────────────────────────
  let battle = null, battleT = null;
  function battleView() { return battle && { id: battle.id, names: battle.names, scores: battle.scores, members: battle.members.map((m) => m.size), target: battle.target, endsAt: battle.endsAt, done: battle.done, winner: battle.winner, effects: battle.effects }; }
  function startBattle(a) {
    const B = S().battle;
    const target = Math.max(0, Math.round(+a.target ?? B.target));
    const minutes = Math.max(0, +a.minutes || 0);
    if (!target && !minutes) throw new Error('Set a coin target or a time limit');
    battle = { id: Date.now(), names: [clean(a.names?.[0] || B.names[0], 24), clean(a.names?.[1] || B.names[1], 24)], scores: [0, 0], members: [new Map(), new Map()],
      target, endsAt: minutes ? Date.now() + minutes * 60000 : 0, done: false, winner: -1, effects: [a.effects?.[0] ?? B.effects[0], a.effects?.[1] ?? B.effects[1]] };
    clearTimeout(battleT); if (minutes) battleT = setTimeout(() => endBattle(), minutes * 60000);
    log(`team battle: ${battle.names[0]} vs ${battle.names[1]}`);
    send('battle', { battle: battleView() });
  }
  function teamOf(user) { return !battle ? -1 : battle.members[0].has(user) ? 0 : battle.members[1].has(user) ? 1 : -1; }
  function joinTeam(user, t, quiet) {
    if (!battle || battle.done) return;
    battle.members[1 - t].delete(user); battle.members[t].set(user, 0);
    if (!quiet) send('battle', { battle: battleView(), joined: { user, team: t } });
  }
  function battleGift(user, coins) {
    if (!battle || battle.done || !coins) return;
    let t = teamOf(user);
    if (t < 0) { t = battle.scores[0] <= battle.scores[1] ? 0 : 1; joinTeam(user, t, true); }   // helps the team that's behind
    battle.scores[t] += coins;
    battle.members[t].set(user, (battle.members[t].get(user) || 0) + coins);
    send('battle', { battle: battleView(), gift: { user, team: t, coins } });
    if (battle.target && battle.scores[t] >= battle.target) endBattle(t);
  }
  function endBattle(force) {
    if (!battle || battle.done) return;
    clearTimeout(battleT);
    battle.done = true;
    battle.winner = force ?? (battle.scores[0] === battle.scores[1] ? Math.floor(Math.random() * 2) : battle.scores[0] > battle.scores[1] ? 0 : 1);
    const w = battle.winner, eff = battle.effects[w];
    log(`team battle won by ${battle.names[w]} (${battle.scores[0]} - ${battle.scores[1]})`);
    if (eff) ctx.fire(eff, battle.names[w], 'Team battle');
    addClip(`${battle.names[w]} won the team battle`, 'battle');
    send('battle', { battle: battleView() });
  }

  // ── mystery box ────────────────────────────────────────────────────────
  const mysteryQueue = []; let mysteryBusy = false;
  function mystery(user, label) {
    const known = new Set(ctx.effectIds());
    const pool = (S().mystery.pool || []).filter((id) => known.has(id) && id !== 'mystery_box');
    if (!pool.length) { log('mystery box: no effects in its pool that the game has'); return; }
    mysteryQueue.push({ user, label, pool });
    nextMystery();
  }
  function nextMystery() {
    if (mysteryBusy || !mysteryQueue.length) return;
    mysteryBusy = true;
    const job = mysteryQueue.shift();
    const pick = job.pool[Math.floor(Math.random() * job.pool.length)];
    const secs = Math.max(2, Math.min(10, +S().mystery.spinSeconds || 4));
    const reel = Array.from({ length: 18 }, () => ctx.effectName(job.pool[Math.floor(Math.random() * job.pool.length)]));
    send('mystery', { user: job.user, reel, result: ctx.effectName(pick), secs });
    setTimeout(() => {
      ctx.fire(pick, job.user, 'Mystery box');
      setTimeout(() => { mysteryBusy = false; nextMystery(); }, 2500);
    }, secs * 1000);
  }

  // ── combo meter ────────────────────────────────────────────────────────
  let combo = { n: 0, last: 0, best: 0, bonuses: 0 }, comboT = null;
  function comboGift(count) {
    const C = S().combo; if (!C.enabled) return;
    const now = Date.now(), win = Math.max(2, +C.windowSeconds || 8) * 1000;
    if (now - combo.last > win) { combo.n = 0; combo.bonuses = 0; }
    const before = combo.n;
    combo.n += Math.max(1, count || 1); combo.last = now; combo.best = Math.max(combo.best, combo.n);
    const at = Math.max(2, +C.bonusAt || 10);
    let bonus = false;
    if (Math.floor(combo.n / at) > Math.floor(before / at)) {
      bonus = true; combo.bonuses++;
      if (C.bonusEffect) ctx.fire(C.bonusEffect, 'Combo x' + combo.n, 'Combo bonus');
      addClip(`Combo x${combo.n}`, 'combo');
    }
    send('combo', { combo: { n: combo.n, at, endsAt: now + win, bonus } });
    clearTimeout(comboT); comboT = setTimeout(() => { combo.n = 0; send('combo', { combo: { n: 0, at, endsAt: 0 } }); }, win + 50);
  }

  // ── GT big key: which Ganon's Tower chest has it? ──────────────────────
  // Chat guesses a chest number (!gt 9, 1-22: the 22 places GT's big key can be, Bob's Torch included; not
  // Torch). The game counts the GT chests opened and reports the count at the
  // moment the big key arrived (that chest included). Exact guesses win; if
  // nobody's exact, the closest do. Guesses close when the first GT chest is
  // opened (or by hand).
  let gtg = null;           // { id, open, guesses: Map(user → { n, nick }), opened0, opened, result }
  // who guessed what (the game's Live games panel lists them): up to 300
  const guessList = (g) => [...g.guesses.entries()].slice(-300).map(([u, x]) => ({ who: x.nick || u, n: x.n }));
  let gtLive = { opened: 0, total: 22, found: false, at: null };
  function gtView() {
    if (!gtg) return null;
    const counts = {};
    for (const g of gtg.guesses.values()) counts[g.n] = (counts[g.n] || 0) + 1;
    return { id: gtg.id, open: gtg.open, total: gtLive.total || 22, opened: gtLive.opened, guesses: gtg.guesses.size, counts,
      list: guessList(gtg), command: S().gtGuess.command || '!gt', result: gtg.result };
  }
  const gtSend = () => send('gtguess', { gtguess: gtView(), gt: gtLive });
  function gtStart() {
    gtg = { id: Date.now(), open: true, guesses: new Map(), opened0: gtLive.opened, result: null };
    log(`GT big key guessing open (${S().gtGuess.command || '!gt'} 1-22)`);
    gtSend();
  }
  function gtLock() { if (gtg && gtg.open) { gtg.open = false; log(`GT big key guesses closed (${gtg.guesses.size})`); gtSend(); } }
  function gtResolve(at, how) {
    if (!gtg || gtg.result) return;
    at = Math.round(+at);
    if (!(at >= 1 && at <= 22)) return;
    gtg.open = false;
    const all = [...gtg.guesses.entries()].map(([u, g]) => ({ user: u, nick: g.nick, n: g.n, off: Math.abs(g.n - at) }));
    const best = all.length ? Math.min(...all.map((g) => g.off)) : null;
    const winners = all.filter((g) => g.off === best).map((g) => g.nick || g.user);
    gtg.result = { at, exact: best === 0, off: best, winners, how: how || 'game' };
    const W = S().gtGuess;
    const txt = winners.length ? (best === 0 ? 'called it: ' : `closest (${best} off): `) + winners.slice(0, 5).join(', ') + (winners.length > 5 ? ` +${winners.length - 5}` : '') : 'nobody guessed';
    log(`GT big key was chest #${at}: ${txt}`);
    ctx.record({ type: 'gtkey', user: 'Link', text: `GT big key: chest #${at}`, bonus: txt,
      alert: W.alert ? { tier: 'big', title: 'BIG KEY FOUND!' } : undefined });
    addClip(`GT big key in chest #${at} (${txt})`, 'gtkey');
    gtSend();
  }
  function onGt(g) {
    const prev = JSON.stringify(gtLive), prevOpened = gtLive.opened;
    gtLive = { opened: Math.max(0, Math.min(22, +g.opened || 0)), total: 22, found: !!g.found, at: g.at == null ? null : +g.at };
    if (JSON.stringify(gtLive) !== prev) send('gt', { gt: gtLive });
    if (!gtg) return;
    if (gtg.open && S().gtGuess.lockOnFirstChest && gtLive.opened > gtg.opened0) gtLock();
    if (gtLive.found && gtLive.at != null && !gtg.result) gtResolve(gtLive.at, 'game');
    else if (gtLive.opened !== prevOpened) gtSend();
  }
  function gtChat(e, t) {
    if (!gtg || !gtg.open) return;
    const cmd = String(S().gtGuess.command || '!gt').toLowerCase().trim();
    const esc = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = t.match(new RegExp('^' + esc + '\\s*#?(\\d{1,2})$'));
    if (!m) return;
    const n = +m[1];
    if (n < 1 || n > 22) return;
    gtg.guesses.set(e.user, { n, nick: e.nickname || '' });
    e.gtguess = n;
    gtSend();
  }

  // ── the Digging Game: which dig gives the prize? ───────────────────────
  // Chat guesses a dig number (!dig 15, 1-30). The randomizer sets it per seed
  // and the game counts the digs; when the prize is collected the game says
  // which dig it came on. Exact guesses win, or the closest. Guesses close at
  // the first dig (or by hand).
  const DIG_MAX = 30;
  let dgg = null;           // { id, open, guesses: Map(user → { n, nick }), result }
  let digLive = { digs: 0, total: DIG_MAX, found: false, at: null, here: false };
  function digView() {
    if (!dgg) return null;
    const counts = {};
    for (const g of dgg.guesses.values()) counts[g.n] = (counts[g.n] || 0) + 1;
    return { id: dgg.id, open: dgg.open, total: DIG_MAX, digs: digLive.digs, guesses: dgg.guesses.size, counts,
      list: guessList(dgg), command: S().digGuess.command || '!dig', result: dgg.result };
  }
  const digSend = () => send('digguess', { digguess: digView(), dig: digLive });
  function digStart() {
    dgg = { id: Date.now(), open: true, guesses: new Map(), result: null, digs0: digLive.here ? digLive.digs : 0 };
    log(`Digging Game guessing open (${S().digGuess.command || '!dig'} 1-${DIG_MAX})`);
    digSend();
  }
  function digLock() { if (dgg && dgg.open) { dgg.open = false; log(`Digging Game guesses closed (${dgg.guesses.size})`); digSend(); } }
  function digResolve(at, how) {
    if (!dgg || dgg.result) return;
    at = Math.round(+at);
    if (!(at >= 1 && at <= DIG_MAX)) return;
    dgg.open = false;
    const all = [...dgg.guesses.entries()].map(([u, g]) => ({ user: u, nick: g.nick, n: g.n, off: Math.abs(g.n - at) }));
    const best = all.length ? Math.min(...all.map((g) => g.off)) : null;
    const winners = all.filter((g) => g.off === best).map((g) => g.nick || g.user);
    dgg.result = { at, exact: best === 0, off: best, winners, how: how || 'game' };
    const txt = winners.length ? (best === 0 ? 'called it: ' : `closest (${best} off): `) + winners.slice(0, 5).join(', ') + (winners.length > 5 ? ` +${winners.length - 5}` : '') : 'nobody guessed';
    log(`Digging Game prize came on dig #${at}: ${txt}`);
    ctx.record({ type: 'digprize', user: 'Link', text: `Digging Game: dig #${at}`, bonus: txt,
      alert: S().digGuess.alert ? { tier: 'big', title: 'DIG PRIZE FOUND!' } : undefined });
    addClip(`Digging Game prize on dig #${at} (${txt})`, 'dig');
    digSend();
  }
  function onDig(g) {
    const prev = JSON.stringify(digLive);
    digLive = { digs: Math.max(0, Math.min(99, +g.digs || 0)), total: DIG_MAX, found: !!g.found, at: g.at == null ? null : +g.at, here: !!g.here };
    if (JSON.stringify(digLive) === prev) return;
    send('dig', { dig: digLive });
    if (!dgg) return;
    // the first dig of a game closes the guesses
    if (dgg.open && S().digGuess.lockOnFirstDig && digLive.here && digLive.digs > 0 && digLive.digs !== dgg.digs0) digLock();
    if (digLive.found && digLive.at != null && !dgg.result) digResolve(digLive.at, 'game');
    else digSend();
  }
  function digChat(e, t) {
    if (!dgg || !dgg.open) return;
    const cmd = String(S().digGuess.command || '!dig').toLowerCase().trim();
    const esc = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = t.match(new RegExp('^' + esc + '\\s*#?(\\d{1,2})$'));
    if (!m) return;
    const n = +m[1];
    if (n < 1 || n > DIG_MAX) return;
    dgg.guesses.set(e.user, { n, nick: e.nickname || '' });
    e.digguess = n;
    digSend();
  }

  // ── predictions ────────────────────────────────────────────────────────
  let pred = null, predT = null;
  function predView() {
    return pred && { id: pred.id, question: pred.question, labels: pred.labels, words: pred.words, counts: [0, 1].map((i) => [...pred.votes.values()].filter((v) => v === i).length),
      locksAt: pred.locksAt, locked: pred.locked, result: pred.result, winners: pred.result >= 0 ? pred.winners : [] };
  }
  function startPred(a) {
    const secs = Math.max(10, Math.min(1800, Math.round(+a.seconds || S().predict.seconds || 60)));
    pred = { id: Date.now(), question: clean(a.question, 90) || 'Will he do it?', labels: [clean(a.labels?.[0], 20) || 'YES', clean(a.labels?.[1], 20) || 'NO'],
      words: ['!yes', '!no'], votes: new Map(), locksAt: Date.now() + secs * 1000, locked: false, result: -1, winners: [] };
    clearTimeout(predT); predT = setTimeout(lockPred, secs * 1000);
    log(`prediction: ${pred.question}`);
    send('predict', { predict: predView() });
  }
  function lockPred() { if (pred && !pred.locked) { pred.locked = true; clearTimeout(predT); send('predict', { predict: predView() }); } }
  function resolvePred(i) {
    if (!pred || pred.result >= 0) return;
    pred.locked = true; pred.result = i; clearTimeout(predT);
    pred.winners = [...pred.votes.entries()].filter(([, v]) => v === i).map(([u]) => u);
    log(`prediction "${pred.question}": ${pred.labels[i]} (${pred.winners.length} got it right)`);
    addClip(`Prediction: ${pred.labels[i]}`, 'predict');
    send('predict', { predict: predView() });
    setTimeout(() => { if (pred && pred.result >= 0) { pred = null; send('predict', { predict: null }); } }, 20000);
  }

  // ── clip markers ───────────────────────────────────────────────────────
  let clipChat = new Map();
  function addClip(label, kind = 'manual', by = '') {
    const at = Date.now(), since = ctx.streamSince();
    const c = { id: at.toString(36) + Math.random().toString(36).slice(2, 5), at, elapsed: Math.max(0, Math.round((at - since) / 1000)), label: clean(label, 90), kind, by: clean(by, 40) };
    clips.push(c); if (clips.length > 500) clips.shift();
    writeLater(CLIPS_FILE, clips);
    send('clip', { clip: c });
    return c;
  }

  // ── hall of fame + welcome back ────────────────────────────────────────
  function famous(n) {
    return Object.entries(fame).map(([user, f]) => ({ user, ...f })).sort((a, b) => b.coins - a.coins || b.gifts - a.gifts).slice(0, n);
  }
  function seenViewer(user, nickname) {
    if (!user || user === 'someone') return false;
    const sid = ctx.streamSince();
    const v = viewers[user] || (viewers[user] = { streams: 0, lastStream: 0, nickname: '' });
    if (nickname) v.nickname = nickname;
    if (v.lastStream === sid) return false;
    v.lastStream = sid; v.streams++;
    writeLater(VIEWERS_FILE, viewers);
    const W = S().welcome;
    return W.enabled && v.streams >= Math.max(2, +W.minStreams || 3) ? v.streams : false;
  }

  // ── every event from studio.record() comes through here ────────────────
  // It can add to the event before it goes out: e.welcome = n streams.
  function onEvent(e) {
    if (['gift', 'chat', 'follow', 'share', 'like'].includes(e.type) && !e.test) {
      const n = seenViewer(e.user, e.nickname);
      if (n) e.welcome = { streams: n, title: S().welcome.title || 'WELCOME BACK' };
    }
    if (e.type === 'gift') {
      if (!e.test || e.countStats) {
        const f = fame[e.user] || (fame[e.user] = { coins: 0, gifts: 0, nickname: '', avatar: '', last: 0 });
        f.coins += e.coins || 0; f.gifts += e.count || 1; f.last = Date.now();
        if (e.nickname) f.nickname = e.nickname; if (e.avatar) f.avatar = e.avatar;
        writeLater(FAME_FILE, fame);
        send('fame', { fame: famous(20) });
      }
      comboGift(e.count || 1);
      battleGift(e.user, e.coins || 0);
      const Cl = S().clips;
      if ((e.coins || 0) >= (+Cl.minCoins || 500)) addClip(`${name(e.user, e.nickname)}: ${e.count > 1 ? e.count + 'x ' : ''}${e.gift} (${e.coins} coins)`, 'gift', e.user);
      if (Cl.seeds && /^seed_/.test(e.effect || '')) addClip(`${name(e.user, e.nickname)} rolled ${e.effectName || 'a new seed'}`, 'seed', e.user);
    }
    if (e.type === 'chat' && e.text) {
      const t = e.text.trim().toLowerCase();
      // votes: "1".."4" or "!vote 2"
      const v = t.match(/^(?:!vote\s*)?([1-4])$/);
      if (v && poll && !poll.done) { if (votePoll(e.user, +v[1] - 1)) e.vote = +v[1]; }
      gtChat(e, t);
      digChat(e, t);
      // predictions
      if (pred && !pred.locked) { const i = pred.words.indexOf(t); if (i >= 0) { pred.votes.set(e.user, i); e.predict = pred.labels[i]; send('predict', { predict: predView() }); } }
      // team battle
      if (battle && !battle.done) {
        const B = S().battle; const i = (B.join || []).map((w) => String(w).toLowerCase()).indexOf(t);
        if (i === 0 || i === 1) { joinTeam(e.user, i); e.team = battle.names[i]; }
      }
      // !clip
      const Cl = S().clips;
      if (Cl.chatClip && t === '!clip') {
        const last = clipChat.get(e.user) || 0;
        if (Date.now() - last > (+Cl.chatCooldown || 30) * 1000) { clipChat.set(e.user, Date.now()); addClip(`!clip from ${name(e.user, e.nickname)}`, 'chat', e.user); e.clipped = true; }
      }
    }
  }

  // ── panel actions ──────────────────────────────────────────────────────
  function action(a) {
    switch (a.action) {
      case 'poll-start': startPoll(a); return true;
      case 'poll-end': endPoll(); return true;
      case 'poll-cancel': clearTimeout(pollT); poll = null; send('poll', { poll: null }); return true;
      case 'battle-start': startBattle(a); return true;
      case 'battle-end': endBattle(); return true;
      case 'battle-cancel': clearTimeout(battleT); battle = null; send('battle', { battle: null }); return true;
      case 'battle-add': if (battle && !battle.done) { const t = a.team ? 1 : 0; battle.scores[t] += Math.round(+a.amount || 0); send('battle', { battle: battleView() }); if (battle.target && battle.scores[t] >= battle.target) endBattle(t); } return true;
      case 'mystery': mystery(a.user || 'Streamer', 'Mystery box'); return true;
      case 'gt-start': gtStart(); return true;
      case 'gt-lock': gtLock(); return true;
      case 'gt-resolve': gtResolve(a.at, 'by hand'); return true;
      case 'gt-cancel': gtg = null; gtSend(); return true;
      case 'gt-test': {
        if (!gtg) gtStart();
        ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].forEach((u, i) => { if (gtg.open) { gtg.guesses.set('test_' + u, { n: [3, 9, 9, 14, 20][i], nick: u }); } });
        gtSend();
        setTimeout(() => gtResolve(9, 'test'), 2500);
        return true;
      }
      case 'dig-start': digStart(); return true;
      case 'dig-lock': digLock(); return true;
      case 'dig-resolve': digResolve(a.at, 'by hand'); return true;
      case 'dig-cancel': dgg = null; digSend(); return true;
      case 'dig-test': {
        if (!dgg) digStart();
        ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].forEach((u, i) => { if (dgg.open) dgg.guesses.set('test_' + u, { n: [4, 12, 15, 15, 27][i], nick: u }); });
        digSend();
        setTimeout(() => digResolve(15, 'test'), 2500);
        return true;
      }
      case 'predict-start': startPred(a); return true;
      case 'predict-lock': lockPred(); return true;
      case 'predict-resolve': resolvePred(a.result ? 1 : 0); return true;
      case 'predict-cancel': clearTimeout(predT); pred = null; send('predict', { predict: null }); return true;
      case 'clip-add': return { clip: addClip(a.label || 'Marked by the streamer', 'manual') };
      case 'clip-delete': clips = clips.filter((c) => c.id !== a.id); writeLater(CLIPS_FILE, clips); send('clips'); return true;
      case 'seeds-clear': seeds = []; writeLater(SEEDS_FILE, seeds); send('seeds', { seeds: [] }); return true;
      case 'clips-clear': clips = []; writeLater(CLIPS_FILE, clips); send('clips'); return true;
      case 'fame-reset': fame = {}; writeLater(FAME_FILE, fame); send('fame', { fame: [] }); return true;
      case 'fame-remove': delete fame[a.user]; writeLater(FAME_FILE, fame); send('fame', { fame: famous(20) }); return true;
      case 'death-test': runStats.deaths++; onDeath(); return true;
      case 'run-test': {
        const seed = runStats.seed || 'ALttPR - TestSeed';
        // the first test only sets the starting point (like a real game does)
        if (!base || base.seed !== seed) onGame({ type: 'run', deaths: runStats.deaths, checks: runStats.checks, bonks: runStats.bonks, place: runStats.place, seed, music: runStats.music, hearts: Math.max(3, runStats.hearts), bosses: runStats.bosses });
        onGame({ type: 'run', deaths: runStats.deaths, checks: runStats.checks + 7, bonks: runStats.bonks, place: DUNGEON_ORDER[Math.floor(Math.random() * DUNGEON_ORDER.length)], seed, music: runStats.music, hearts: Math.max(3, runStats.hearts), bosses: runStats.bosses });
        return true;
      }
      case 'boss-test': {
        const seed = runStats.seed || 'ALttPR - TestSeed';
        if (!base || base.seed !== seed) onGame({ type: 'run', ...runStats, seed });
        const left = Object.keys(BOSS_NAMES).filter((b) => !runStats.bosses.includes(b));
        if (!left.length) return true;
        onGame({ type: 'run', ...runStats, seed, bosses: [...runStats.bosses, left[0]] });
        return true;
      }
      case 'welcome-test': ctx.record({ type: 'chat', user: a.user || 'RegularViewer', text: 'hey!', welcome: { streams: 12, title: S().welcome.title || 'WELCOME BACK' }, test: true }); return true;
      default: return false;
    }
  }

  function snapshot() {
    return { poll: pollView(), battle: battleView(), combo: { n: combo.n, at: S().combo.bonusAt, best: combo.best }, predict: predView(), gtguess: gtView(), gt: gtLive, digguess: digView(), dig: digLive, run: runStats,
      clips: clips.slice(-200), seeds: seeds.slice(-200), fame: famous(20), viewersKnown: Object.keys(viewers).length };
  }

  return { onEvent, onGame, mystery, run: action, snapshot, addClip, famous };
}
