#!/usr/bin/env node
/*
 * Crowd Control+ : TikTok LIVE → Rando Hub bridge, with the Studio.
 *
 * Studio (studio.mjs): control panel at http://localhost:21214/studio and
 * stream overlays (alerts, goal bar, top gifters, event feed, chat commands)
 * at http://localhost:21214/overlay/<name>.
 *
 * Listens to your TikTok LIVE (gifts, likes, follows, shares) and sends the
 * matching effect to the game page over a WebSocket on this computer.
 *
 * Ways to hear the LIVE ("source" in mapping.json, or the control panel):
 *   "local" (default, recommended, free): the local signer (localsigner.mjs)
 *       opens your own LIVE page in a Chrome/Edge window and reads what TikTok
 *       sends it. No other apps, no keys. Set "username" (or use the panel).
 *   "tikfinity" (backup, free): the TikFinity desktop app connects to TikTok
 *       and the bridge reads its Events API on port 21213.
 *   "direct" (advanced, file only): tiktok-live-connector with a sign-server key
 *       ("signServer" + "signApiKey"; Euler Stream's free Community plan works).
 *       Needs `npm install`.
 * The bridge itself listens on 21214 (the game's default address).
 *
 *   node bridge.mjs                 # uses mapping.json
 *   node bridge.mjs --test          # no TikTok: type commands to fake events
 *
 * Then in the game: ⋯ menu → Crowd effects → turn on (address
 * ws://localhost:21214). Every gift that arrives is printed with its name, so
 * you can add it to mapping.json.
 *
 * Needs Node 20+. The WebSocket server is built in (no extra packages); the
 * only dependency is tiktok-live-connector, which is loaded only when not in
 * --test mode.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { createStudio } from './studio.mjs';
import { startLocalSigner, findBrowser } from './localsigner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const TEST = args.includes('--test');
const cfgPath = (() => { const i = args.indexOf('--config'); return i >= 0 ? args[i + 1] : path.join(HERE, 'mapping.json'); })();

let cfg = loadConfig();
function loadConfig() {
  const c = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  c.source = String(c.source || 'local').toLowerCase();   // local signer unless set (old mapping.json files say "tikfinity")
  c.tikfinityPort ??= 21213;
  // TikFinity's Events API already uses 21213, so the bridge uses 21214.
  c.port ??= 21214;
  if (c.source === 'tikfinity' && c.port === c.tikfinityPort) c.port = c.tikfinityPort + 1;
  c.gifts ??= {};
  // "likes": one trigger {every, effect} or several [{every, effect}, …]
  c.likeTiers = (Array.isArray(c.likes) ? c.likes : c.likes ? [c.likes] : [])
    .filter((t) => t && +t.every > 0 && t.effect).map((t) => ({ every: Math.round(+t.every), effect: String(t.effect) }))
    .sort((a, b) => a.every - b.every);
  c.giftsLower = Object.fromEntries(Object.entries(c.gifts).map(([k, v]) => [String(k).toLowerCase(), v]));
  return c;
}
// Edit mapping.json while it runs: changes apply right away.
fs.watchFile(cfgPath, { interval: 1000 }, () => {
  try { cfg = loadConfig(); log('mapping.json reloaded'); sendDurations(); } catch (e) { log('mapping.json has an error, kept the old one: ' + e.message); }
});

function log(...m) { console.log(new Date().toLocaleTimeString(), ...m); }

// ── tiny WebSocket server (text frames only, which is all we need) ─────────
const clients = new Set();
let knownEffects = null;   // ids the game reported in its hello
let gameName = '';         // 'Zelda 3' or 'Zelda 1', from that hello

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (studio.handle(req, res, url)) return;
  if (url.pathname === '/timer') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(TIMER_HTML); return; }
  if (url.pathname === '/timer/control') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(CONTROL_HTML); return; }
  if (url.pathname === '/timer.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(timerView(true))); return; }
  if (url.pathname === '/timer/api' && req.method === 'POST') { timerApi(req, res); return; }
  if (url.pathname === '/ticker') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(TICKER_HTML); return; }
  if (url.pathname === '/ticker.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(tickerData())); return; }
  if (url.pathname.startsWith('/icons/')) {
    const name = path.basename(decodeURIComponent(url.pathname.slice(7)));
    const file = path.join(HERE, 'icons', name);
    if (/\.(png|gif|webp|jpe?g)$/i.test(name) && fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': 'image/' + name.split('.').pop().toLowerCase().replace('jpg', 'jpeg'), 'cache-control': 'max-age=60' });
      fs.createReadStream(file).pipe(res); return;
    }
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`Crowd Control+ bridge. Game pages connected: ${clients.size}\nScrolling gift list for OBS: http://localhost:${cfg.port}/ticker\n` +
    `Subathon timer: http://localhost:${cfg.port}/timer (control: /timer/control)\n`);
});

server.on('upgrade', (req, socket) => {
  const origin = req.headers.origin || '';
  const allowed = cfg.allowedOrigins ?? ['https://hugecrankhank.github.io', 'http://localhost', 'http://127.0.0.1'];
  if (origin && !allowed.some((o) => origin === o || origin.startsWith(o + ':') || origin.startsWith(o + '/'))) {
    log(`refused a connection from ${origin} (add it to "allowedOrigins" in mapping.json if it's yours)`);
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const client = { socket, buf: Buffer.alloc(0) };
  clients.add(client);
  log(`game connected (${clients.size} open)`);
  setTimeout(() => studio.pushState(), 50);
  sendTo(client, { type: 'status', text: TEST ? 'Bridge in test mode' : (liveText || 'Bridge connected') });
  socket.on('data', (d) => { client.buf = Buffer.concat([client.buf, d]); readFrames(client); });
  const bye = () => { if (clients.delete(client)) { log(`game disconnected (${clients.size} open)`); studio.pushState(); } };
  socket.on('close', bye); socket.on('error', bye);
});

function readFrames(c) {
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const need = off + (masked ? 4 : 0) + len;
    if (b.length < need) return;
    let data = b.subarray(off + (masked ? 4 : 0), need);
    if (masked) { const m = b.subarray(off, off + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
    c.buf = b.subarray(need);
    if (op === 0x8) { c.socket.end(); return; }                       // close
    if (op === 0x9) { writeFrame(c.socket, data, 0xA); continue; }    // ping → pong
    if (op === 0x1) onGameMessage(data.toString('utf8'));
  }
}
function writeFrame(socket, payload, op = 0x1) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n])
    : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255])
    : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  socket.write(Buffer.concat([head, payload]));
}
function sendTo(c, msg) { try { writeFrame(c.socket, Buffer.from(JSON.stringify(msg))); } catch {} }
function broadcast(msg) { for (const c of clients) sendTo(c, msg); }

// One bad message or setting must never close the bridge mid-stream: log it and carry on.
process.on('uncaughtException', (e) => { try { log(`! error, still running: ${e && e.stack || e}`); } catch {} });
process.on('unhandledRejection', (e) => { try { log(`! error, still running: ${e && e.stack || e}`); } catch {} });

function onGameMessage(text) {
  let m; try { m = JSON.parse(text); } catch { return; }
  if (m.type === 'hello') {
    const app = m.app === 'z1r' ? 'Zelda 1' : 'Zelda 3';
    if (gameName && gameName !== app) log(`🎮 game switched to ${app}: the ticker now lists ${app}'s effects`);
    gameName = app;
    knownEffects = new Set((m.effects || []).map((e) => e.id));
    for (const e of m.effects || []) if (e.name) effectNames[e.id] = e.name;
    sendDurations();
    broadcast({ type: 'timer', ...timerView() });
    studio.pushState();
    const named = [...new Set(Object.values(cfg.gifts).concat(cfg.follow, cfg.share, cfg.superfan, cfg.community, ...cfg.likeTiers.map((t) => t.effect)).filter(Boolean))];
    for (const id of named) {
      if (knownEffects.has(id) || id === 'mystery_box' || id === 'detour_rescue') continue;
      const fix = resolveEffect(id);
      log(fix ? `mapping.json: "${id}" isn't an effect name, using "${fix}" (fix the spelling to silence this)`
              : `mapping.json: "${id}" isn't an effect the game has. Type "list" in --test mode to see them all.`);
    }
  } else if (m.type === 'run' || m.type === 'death' || m.type === 'music' || m.type === 'detour' || m.type === 'seed' || m.type === 'reveal') {
    if (m.type === 'reveal') log(`🔮 revealed: ${m.item} at ${m.loc}${m.user ? ' (' + m.user + ')' : ''}`);
    if (m.type === 'seed' && m.seed) log(`🎲 seed: ${m.seed.what || m.seed.name}${m.seed.how ? ' (' + m.seed.how + (m.seed.by ? ', ' + m.seed.by : '') + ')' : ''}`);
    if (m.type === 'detour') log(m.phase === 'start' ? `⚔ boss detour: ${m.boss}${m.user ? ' (sent by ' + m.user + ')' : ''}` : `⚔ boss detour over: ${m.result}`);
    if (m.type === 'death') log(`☠ Link died (death #${m.deaths})`);
    if (m.type === 'music') log(`♪ music: ${m.pack || "the game's own"}`);
    try { studio.onGame(m); } catch (e) { log(`! control panel error (${m.type}): ${e && e.message}`); }
  } else if (m.type === 'test') {
    // test buttons in the game's menu that need Crowd Control+ (alerts, mystery box)
    if (m.what === 'mystery_box') { log('  test from the game: mystery box'); fire('mystery_box', 'TestViewer', 'test'); }
    else if (m.what === 'gift') {
      const names = Object.keys(cfg.gifts || {}); const g = names[Math.floor(Math.random() * names.length)] || 'Rose';
      log(`  test from the game: fake gift (${g})`); onGift('TestViewer', g, 0, 1, 0, { test: true, runEffect: true });
    }
  } else if (m.type === 'applied') {
    log(`  ✓ applied ${m.effect}${m.user ? ' for ' + m.user : ''}`);
  }
}

// ── turning TikTok events into effects ─────────────────────────────────────
const cooldown = new Map();   // user → last time, for follows/shares (spam guard)

// Forgive capital letters and small typos in mapping.json ("bombs_None",
// "cucoo_storm"): pick the one effect within 2 letters of what was written.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function resolveEffect(id) {
  if (id === 'mystery_box' || id === 'detour_rescue' || !knownEffects || knownEffects.has(id)) return id;
  const want = String(id).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (knownEffects.has(want)) return want;
  let best = null, bestD = 3, tie = false;
  for (const k of knownEffects) {
    const dist = editDistance(want, k);
    if (dist < bestD) { best = k; bestD = dist; tie = false; } else if (dist === bestD) tie = true;
  }
  return best && !tie ? best : null;
}

function fire(effect, user, label, count = 1) {
  if (!effect) return null;
  // Studio-only effects (not in the game): the mystery box spins on stream,
  // then runs a random effect itself.
  if (effect === 'detour_rescue') { broadcast({ type: 'detour-end' }); log(`  → rescue from the boss detour ${user ? 'by ' + user : ''}`); studio.onGame({ type: 'rescue', user }); return effect; }
  if (effect === 'mystery_box') { for (let i = 0; i < Math.min(count, cfg.maxPerGift ?? 5); i++) studio.mystery(user, label); log(`  → mystery box x${count} ${user ? 'from ' + user : ''}`); return effect; }
  const resolved = resolveEffect(effect);
  if (!resolved) { log(`  ! unknown effect "${effect}" (check mapping.json)`); return null; }
  effect = resolved;
  if (!clients.size) { log(`  (no game connected, dropped ${effect})`); return effect; }
  broadcast({ type: 'effect', effect, user, label, count: Math.min(count, cfg.maxPerGift ?? 5) });
  log(`  → ${effect} x${count} ${user ? 'from ' + user : ''} ${label ? '(' + label + ')' : ''}`);
  return effect;
}

// coinTiers in mapping.json: a donation worth at least that many coins does
// that effect instead of its gift's own (highest tier reached wins).
function tierFor(coins) {
  const tiers = (Array.isArray(cfg.coinTiers) ? cfg.coinTiers : [])
    .filter((t) => t && +t.coins > 0 && t.effect).sort((a, b) => b.coins - a.coins);
  return coins > 0 ? tiers.find((t) => coins >= +t.coins) || null : null;
}

function onGift(user, giftName, giftId, count, coinsEach, extra = {}) {
  // coins: TikTok's own value per gift; mapping.json "giftCoins" can fill in or override one
  const own = (cfg.giftCoins || {})[giftName] ?? Object.entries(cfg.giftCoins || {}).find(([k]) => k.toLowerCase() === String(giftName).toLowerCase())?.[1];
  const coins = Math.max(0, Math.round((+(own ?? coinsEach) || 0) * count));
  const tier = tierFor(coins);
  const e = tier ? tier.effect : cfg.giftsLower[String(giftName || '').toLowerCase()] ?? cfg.gifts[String(giftId)];
  log(`gift: ${user} sent "${giftName}" (id ${giftId}) x${count}${coins ? ` = ${coins} coins` : ''}` +
    (tier ? ` — ${tier.coins}+ coin tier` : e ? '' : ' — not mapped'));
  if (!extra.test || extra.runEffect) timerAddCoins(user, coins);
  let done = null;
  if (!extra.test || extra.runEffect) {
    if (tier) done = fire(tier.effect, user, `${coins} coins`, 1);
    else done = fire(e, user, `${giftName}${count > 1 ? ' x' + count : ''}`, count);
  } else done = tier ? tier.effect : e || null;
  studio.record({ type: 'gift', user, nickname: extra.nickname, avatar: extra.avatar, gift: giftName, giftId, count, coins,
    effect: done, effectName: done ? (effectNames[done] || done) : '', tier: tier ? (tier.label || tier.coins + '+ coins') : '',
    icon: giftIcon(giftName), test: !!extra.test, countStats: !!extra.runEffect });
}
function giftIcon(name) {
  try {
    const f = fs.readdirSync(path.join(HERE, 'icons')).find((x) => x.replace(/\.[^.]+$/, '').toLowerCase() === String(name || '').toLowerCase());
    return f ? '/icons/' + encodeURIComponent(f) : (extraIcons.get(String(name || '').toLowerCase()) || null);
  } catch { return null; }
}
const extraIcons = new Map();   // gift pictures TikTok sends with the gift (when there's no file in icons/)

let likeTotal = 0;   // likes this session (each like trigger fires when it passes a multiple)
function onLike(user, n, extra = {}) {
  studio.record({ type: 'like', user, nickname: extra.nickname, count: n, test: !!extra.test });
  if (!extra.test || extra.runEffect) timerAddLikes(user, n);
  // every trigger counts on its own: 300 → +1 heart, 500 → magic, 2000 → full heal…
  const before = likeTotal; likeTotal += n;
  for (const t of cfg.likeTiers) {
    const times = Math.min(5, Math.floor(likeTotal / t.every) - Math.floor(before / t.every));
    for (let i = 0; i < times; i++) fire(t.effect, user, `${t.every} likes`);
  }
}
// follow, share, superfan (a new Super Fan), community (a new community / fan club member)
const SOCIAL_LABEL = { follow: 'Followed', share: 'Shared', superfan: 'Super Fan', community: 'Joined the community' };
function onSocial(kind, user, extra = {}) {
  const key = kind + ':' + user, now = Date.now();
  if (now - (cooldown.get(key) || 0) < 10 * 60 * 1000) return;   // once per viewer per 10 min
  cooldown.set(key, now);
  log(`${kind}: ${user}`);
  if (!extra.test || extra.runEffect) timerAddFor(kind, user);
  const effect = cfg[kind];
  const done = effect && (!extra.test || extra.runEffect) ? fire(effect, user, SOCIAL_LABEL[kind] || kind) : effect || null;
  studio.record({ type: kind, user, nickname: extra.nickname, avatar: extra.avatar, effect: done, effectName: done ? (effectNames[done] || done) : '', test: !!extra.test });
}
function onChat(user, text, extra = {}) {
  const e = studio.record({ type: 'chat', user, nickname: extra.nickname, avatar: extra.avatar, text, test: !!extra.test });
  if (e.command) log(`chat command ${e.command.cmd} from ${user}`);
  if (!extra.test || extra.runEffect) timerAddChat(user);
}

// ── durations and the scrolling gift list ──────────────────────────────────
// "durations" in mapping.json changes how long timed effects last; the game
// is told whenever it connects or the file is saved.
function sendDurations() { broadcast({ type: 'durations', secs: cfg.durations || {} }); }

// Effect names for the gift list (the game sends its own names when it connects).
const effectNames = {
  heal_full: 'Full heal', heal_1: '+1 heart', hurt_2: '-2 hearts', hp_1: 'Down to 1 heart',
  magic_full: 'Refill magic', magic_drain: 'Drain magic', rupees_plus: '+50 rupees', rupees_minus: '-50 rupees',
  bombs_plus: '+10 bombs', bombs_none: 'Lose all bombs', arrows_plus: '+10 arrows', arrows_none: 'Lose all arrows',
  enemy_spawn: 'Extra enemy', enemy_random: 'Random enemy', magic_small: 'Small magic refill',
  warp_dungeon: 'Warp to a random dungeon', warp_flute: 'Flute warp (random spot)', warp_random: 'Random warp (flute spot or dungeon)',
  insta_kill: 'Instant death', ice: 'Ice physics', cucco_storm: 'Cucco attack', invert: 'Inverted D-pad',
  no_sword: 'No sword', no_item: 'No Y item', swap_by: 'B and Y swapped', one_hit: 'One-hit KO',
  no_magic: 'Magic locked', shield_off: 'Shield gone', shield_steal: 'Shield stolen', shield_down: 'Shield downgrade', shield_up: 'Shield upgrade',
  sword_off: 'Sword gone', sword_down: 'Sword downgrade', sword_up: 'Sword upgrade', sword_steal: 'Sword stolen', item_off: 'Item gone (random item)', tunic_up: 'Tunic upgrade', tunic_down: 'Tunic downgrade',
  sprite_roll: 'Random sprite', sprite_fav: 'Random favourite sprite',
  msu_roll: 'Random MSU pack', seed_roll: 'New seed (same settings)', seed_preset: 'Random preset seed', seed_chaos: 'CHAOS seed',
  mirror: 'Mirror mode', upside_down: 'Upside down', wobble: 'Drunk wobble', tiny: 'Tiny screen', crt: 'Retro CRT',
  speed_up: 'Speed up (1.5x)', slow_mo: 'Slow motion', freeze: 'Freeze!', fairy: 'Fairy in a bottle', bee_bottle: 'Bee in a bottle',
  pink_link: 'Pink Link', music_roulette: 'Music roulette', mystery_box: 'Mystery box (random effect)',
  spooky_night: 'Spooky night', ghost_link: 'Ghost Link', pumpkin_link: 'Pumpkin Link', haunted_lights: 'Haunted lights',
  blood_drip: 'Blood drip', spider_web: 'Spiderwebs', monster_mash: 'Monster mash (enemies → bats / mummies)',
  reveal_item: 'Reveal a go-mode item', lights_on: 'Lights on!', lights_out: 'Lights out!', spooky_monster: 'Spooky monster', haunting: 'Haunting! (3 spooky monsters)', trick_or_treat: 'Trick or treat!', spooky_sprite: 'Spooky sprite',
  boss_ganon: 'Boss detour: Ganon', boss_aga: 'Boss detour: Agahnim', boss_random: 'Boss detour: random boss', detour_rescue: 'Rescue Link from a boss detour',
};
// Effects that can hurt a run for good: the panel asks before one goes on a gift.
const effectWarnings = {
  sword_steal: 'Sword stolen can make the seed unbeatable. If every sword has already been found, there is none left to get it back, and Agahnim\'s barrier and Ganon both need a sword. The next sword found also only gives the Fighter\'s Sword.',
};
const defaultSecs = { ice: 20, cucco_storm: 30, invert: 20, no_sword: 20, no_item: 20, swap_by: 20, one_hit: 30, no_magic: 30, shield_off: 30, sword_off: 30, sword_down: 30, item_off: 30,
  mirror: 20, upside_down: 15, wobble: 20, tiny: 20, crt: 30, speed_up: 20, slow_mo: 15, freeze: 3, pink_link: 60,
  boss_ganon: 60, boss_aga: 60, boss_random: 60, spooky_night: 45, ghost_link: 60, pumpkin_link: 60, haunted_lights: 20, lights_on: 60, lights_out: 30, blood_drip: 20, spider_web: 30 };

function tickerData() {
  const t = cfg.ticker || {};
  const labels = t.labels || {};
  const icons = (() => { try { return fs.readdirSync(path.join(HERE, 'icons')); } catch { return []; } })();
  const iconFor = (gift) => {
    const want = gift.toLowerCase();
    return icons.find((f) => f.replace(/\.[^.]+$/, '').toLowerCase() === want) || null;
  };
  // Only what the game that's connected now can do (Zelda 3 and Zelda 1 have
  // different effects), named the way that game names them: when a reroll
  // switches games, the new game's hello changes the list within a few seconds.
  const can = (id) => {
    if (!knownEffects || id === 'mystery_box') return true;
    if (id === 'detour_rescue') return knownEffects.has('boss_random') || knownEffects.has('boss_ganon');
    return knownEffects.has(id);
  };
  const items = [];
  // gifts the streamer unticked "On ticker" for (Gifts & effects tab) still work, they just don't scroll by
  const hidden = new Set((Array.isArray(t.hidden) ? t.hidden : []).map((n) => String(n).toLowerCase()));
  for (const [gift, raw] of Object.entries(cfg.gifts || {})) {
    const id = resolveEffect(raw) || raw;
    if (!can(id) || hidden.has(gift.toLowerCase())) continue;
    const secs = id in defaultSecs ? (+(cfg.durations || {})[id] > 0 ? +cfg.durations[id] : defaultSecs[id]) : 0;
    items.push({ gift, label: labels[id] || effectNames[id] || id, secs, icon: iconFor(gift) ? '/icons/' + encodeURIComponent(iconFor(gift)) : null });
  }
  if (t.showLikes !== false) for (const l of cfg.likeTiers) if (can(resolveEffect(l.effect) || l.effect))
    items.push({ gift: `${l.every} likes`, label: labels[l.effect] || effectNames[l.effect] || l.effect, secs: 0, icon: null, emoji: '❤' });
  const SOCIAL_TICK = { follow: ['Follow', '➕'], share: ['Share', '↗'], superfan: ['Super Fan', '⭐'], community: ['New community member', '🤝'] };
  for (const kind of Object.keys(SOCIAL_TICK)) if (t.showSocial !== false && cfg[kind] && can(resolveEffect(cfg[kind]) || cfg[kind]))
    items.push({ gift: SOCIAL_TICK[kind][0], label: labels[cfg[kind]] || effectNames[cfg[kind]] || cfg[kind], secs: 0, icon: null, emoji: SOCIAL_TICK[kind][1] });
  const tiers = (Array.isArray(cfg.coinTiers) ? cfg.coinTiers : []).filter((x) => x && +x.coins > 0 && x.effect).sort((a, b) => a.coins - b.coins);
  if (t.showTiers !== false) for (const x of tiers) {
    const id = resolveEffect(x.effect) || x.effect;
    if (!can(id)) continue;
    items.push({ gift: `${Number(x.coins).toLocaleString('en-US')}+ coins`, label: x.label || labels[id] || effectNames[id] || id, secs: 0, icon: null, emoji: '🪙' });
  }
  const tm = cfg.timer || {};
  if (tm.enabled !== false && t.showTimer !== false && timer.active) {
    const [g, l] = rateText().split(' = ');
    items.push({ gift: g, label: l + ' on the clock', secs: 0, icon: null, emoji: '⏱' });
  }
  return { title: t.title ?? 'GIFT EFFECTS', speed: t.speed || 70, rows: Math.max(1, Math.min(4, +t.rows || 1)), items };
}

const TICKER_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Gift effects</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* For OBS / TikTok LIVE Studio browser sources. ?height=80 sets each row's
     height, ?bg=0 makes the bar background transparent, ?speed=90 overrides
     the scroll speed (pixels per second), ?rows=2 overrides the rows set on
     the Gifts tab. Each row is 72 px high by default: make the source as tall. */
  html, body { margin: 0; background: transparent; overflow: hidden; }
  body { font: 700 calc(var(--h) * .36)/1 system-ui, "Segoe UI", sans-serif; color: #fff; --h: 72px; --rows: 1; }
  .bar { display: flex; align-items: stretch; height: calc(var(--h) * var(--rows)); background: rgba(8,10,14,.88); border-top: 2px solid #e63946; border-bottom: 2px solid #e63946; box-sizing: border-box; }
  .bar.clear { background: transparent; border-color: transparent; }
  .title { flex: none; display: flex; align-items: center; padding: 0 .7em; background: #e63946; color: #fff; letter-spacing: .06em; font-size: .8em; z-index: 1; }
  .view { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .lane { flex: 1; overflow: hidden; position: relative; }
  .lane + .lane { border-top: 1px solid rgba(230,57,70,.35); }
  .track { display: flex; width: max-content; height: 100%; align-items: center; will-change: transform; }
  .item { display: flex; align-items: center; gap: .35em; padding: 0 1.1em; white-space: nowrap; text-shadow: 0 2px 3px #000; }
  .item img { height: calc(var(--h) * .74); width: auto; }
  .item .em { font-size: 1.3em; }
  .item .eq { color: #e63946; }
  .item .secs { color: #9fb3c8; font-size: .75em; font-weight: 600; }
  .dot { color: #e63946; opacity: .6; }
  .off { color: #9fb3c8; padding: 0 1em; font-size: .7em; }
</style></head><body>
<div class="bar" id="bar"><div class="title" id="title"></div><div class="view" id="view"></div></div>
<script>
const q = new URLSearchParams(location.search);
const rowH = +q.get('height') || 72;
document.body.style.setProperty('--h', rowH + 'px');
if (q.get('bg') === '0') document.getElementById('bar').classList.add('clear');
const view = document.getElementById('view'), titleEl = document.getElementById('title');
let last = '', speed = 70, lanes = [], prev = performance.now();
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function itemHtml(i) {
  return '<span class="item">' + (i.icon ? '<img src="' + i.icon + '" alt="">' : '<span class="em">' + esc(i.emoji || '🎁') + '</span>') +
    esc(i.gift) + ' <span class="eq">=</span> ' + esc(i.label) + (i.secs ? ' <span class="secs">' + i.secs + 's</span>' : '') +
    '</span><span class="dot">◆</span>';
}
function build(d) {
  speed = +q.get('speed') || d.speed || 70;
  const rows = Math.max(1, Math.min(4, +q.get('rows') || d.rows || 1));
  document.body.style.setProperty('--rows', rows);
  titleEl.textContent = d.title || ''; titleEl.style.display = d.title ? '' : 'none';
  // the gifts dealt out across the rows in order: 1st row gets 1, 1+rows, ...
  const per = Array.from({ length: rows }, () => []);
  d.items.forEach((it, n) => per[n % rows].push(it));
  view.innerHTML = '';
  lanes = per.filter((l) => l.length).map((list, r) => {
    const lane = document.createElement('div'); lane.className = 'lane';
    const track = document.createElement('div'); track.className = 'track';
    lane.appendChild(track); view.appendChild(lane);
    const one = list.map(itemHtml).join('');
    track.innerHTML = one;
    const L = { track, one, x: 0, half: 0 };
    requestAnimationFrame(() => {
      // enough copies that the row is never empty, doubled so the loop is seamless
      const w = track.scrollWidth || 1, n = Math.max(1, Math.ceil(view.clientWidth / w));
      track.innerHTML = one.repeat(n * 2);
      L.half = w * n;
      L.x = -(L.half * r / Math.max(1, rows)) % L.half;   // rows don't all start at the same place
    });
    return L;
  });
}
async function poll() {
  try {
    const r = await fetch('/ticker.json', { cache: 'no-store' });
    const t = await r.text();
    if (t !== last) { last = t; build(JSON.parse(t)); }
  } catch (e) { if (!last) view.innerHTML = '<span class="off">Waiting for the bridge…</span>'; }
  setTimeout(poll, 4000);
}
function step(now) {
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  for (const L of lanes) {
    if (L.half > 0) { L.x -= speed * dt; if (-L.x >= L.half) L.x += L.half; L.track.style.transform = 'translateX(' + L.x.toFixed(1) + 'px)'; }
  }
  requestAnimationFrame(step);
}
poll(); requestAnimationFrame(step);
</script></body></html>`;

// ── subathon timer ─────────────────────────────────────────────────────────
// The streamer sets a starting time on http://localhost:PORT/timer/control and
// starts it; donations add time at "coinsPerSecond" (mapping.json "timer").
// When it reaches 0 it stops and says TIME!. The time is saved to
// timer-state.json, so closing the bridge doesn't lose it (it comes back
// paused).
const TIMER_FILE = path.join(HERE, 'timer-state.json');
const timer = { active: false, running: false, ended: false, remaining: 0, endsAt: 0, added: 0, coins: 0, log: [], nextId: 1 };
(function loadTimer() {
  try {
    const t = JSON.parse(fs.readFileSync(TIMER_FILE, 'utf8'));
    Object.assign(timer, { active: !!t.active, ended: !!t.ended, remaining: Math.max(0, +t.remaining || 0), added: +t.added || 0, coins: +t.coins || 0,
      log: Array.isArray(t.log) ? t.log.slice(-30) : [], nextId: +t.nextId || 1, running: false });
  } catch {}
})();
function timerLeft() { return timer.running ? Math.max(0, (timer.endsAt - Date.now()) / 1000) : timer.remaining; }
function timerView(full) {
  const v = { active: timer.active, running: timer.running, ended: timer.ended, remaining: Math.ceil(timerLeft()),
    lastAdd: timer.log.length ? timer.log[timer.log.length - 1] : null };
  if (full) Object.assign(v, { added: timer.added, coins: timer.coins, log: timer.log.slice(-12).reverse(), rate: rateText(), coinsPerSecond: coinsPerSecond() });
  return v;
}
let timerSaveT = null;
function timerChanged() {
  broadcast({ type: 'timer', ...timerView() });
  clearTimeout(timerSaveT);
  timerSaveT = setTimeout(() => {
    try { fs.writeFileSync(TIMER_FILE, JSON.stringify({ ...timer, remaining: timerLeft(), running: false })); } catch (e) { log('couldn\'t save the timer: ' + e.message); }
  }, 300);
}
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
function timerAdd(seconds, user, why) {
  seconds = Math.round(seconds);
  if (!seconds) return;
  if (timer.running) timer.endsAt = Math.max(Date.now(), timer.endsAt + seconds * 1000);
  else {
    timer.remaining = Math.max(0, timer.remaining + seconds);
    if (timer.remaining <= 0 && timer.active && seconds < 0) { timer.ended = true; log('⏱ TIME! The subathon clock hit 0:00:00.'); }
  }
  if (seconds > 0) timer.added += seconds;
  timer.log.push({ id: timer.nextId++, seconds, user: user || '', why: why || '', at: Date.now() });
  if (timer.log.length > 30) timer.log.shift();
  timerChanged();
}
// How much time a coin buys. mapping.json "timer": "coinsPerSecond": 4 means
// it takes 4 coins to add 1 second (the older "secondsPerCoin": 2 means each
// coin adds 2 seconds). Fractions add up across donations, so with 4 coins
// per second four 1-coin Roses still add a second between them.
function coinsPerSecond() {
  const tm = cfg.timer || {};
  if (+tm.coinsPerSecond > 0) return +tm.coinsPerSecond;
  if (+tm.secondsPerCoin > 0) return 1 / +tm.secondsPerCoin;
  return 1;
}
function rateText() {
  const c = coinsPerSecond();
  if (c === 1) return 'Every coin = +1 second';
  if (c < 1) { const s = Math.round(1 / c * 100) / 100; return `Every coin = +${s} seconds`; }
  return `Every ${Math.round(c * 100) / 100} coins = +1 second`;
}
// mapping.json "timer": time for likes, follows, shares, Super Fans and new
// community members, in seconds ("likeSeconds" is per like and can be as
// small as 0.01; likes add up until they make a whole second).
const SOCIAL_SECS = { follow: 'followSeconds', share: 'shareSeconds', superfan: 'superfanSeconds', community: 'communitySeconds' };
function timerOpen() { const tm = cfg.timer || {}; return tm.enabled !== false && timer.active && !timer.ended; }
function timerAddFor(kind, user) {
  const secs = Math.round((+(cfg.timer || {})[SOCIAL_SECS[kind]] || 0) * 100) / 100;
  if (!secs || secs < 0 || !timerOpen()) return;
  timerAdd(secs, user, SOCIAL_LABEL[kind] || kind);
  log(`  ⏱ +${fmtTime(secs)} from ${user} (${SOCIAL_LABEL[kind] || kind}), clock: ${fmtTime(timerLeft())}`);
}
// Comments: "chatSeconds" each, and "chatCooldown" seconds before the same
// viewer's next comment counts again (0 = every comment), so a spammer can't
// run the clock up on their own. Small amounts add up like likes do.
const chatLast = new Map();
let chatFrac = 0;
function timerAddChat(user) {
  const tm = cfg.timer || {}, per = +tm.chatSeconds || 0;
  if (per <= 0 || !timerOpen()) return;
  const wait = Math.max(0, +tm.chatCooldown || 0) * 1000, now = Date.now();
  if (wait && now - (chatLast.get(user) || 0) < wait) return;
  chatLast.set(user, now);
  if (chatLast.size > 5000) chatLast.clear();
  chatFrac += per;
  const whole = Math.floor(chatFrac + 1e-9);
  if (whole >= 1) { chatFrac -= whole; timerAdd(whole, user, 'comment'); }
}
let likeFrac = 0, likeBy = '';
function timerAddLikes(user, n) {
  const per = +(cfg.timer || {}).likeSeconds || 0;
  if (per <= 0 || !n || !timerOpen()) return;
  likeFrac += n * per; likeBy = user;
  const whole = Math.floor(likeFrac + 1e-9);
  if (whole >= 1) {
    likeFrac -= whole;
    timerAdd(whole, likeBy, 'likes');
    log(`  ⏱ +${fmtTime(whole)} from likes (clock: ${fmtTime(timerLeft())})`);
  }
}

let timerFrac = 0;
function timerAddCoins(user, coins) {
  const tm = cfg.timer || {};
  if (tm.enabled === false || !coins || !timer.active || timer.ended) return;
  const exact = coins / coinsPerSecond() + timerFrac;
  const secs = Math.floor(exact);
  timerFrac = exact - secs;
  timer.coins += coins;
  if (secs > 0) {
    timerAdd(secs, user, `${coins} coins`);
    log(`  ⏱ +${fmtTime(secs)} from ${user} (clock: ${fmtTime(timerLeft())})`);
  } else log(`  ⏱ ${coins} coins saved toward the next second`);
}
setInterval(() => {
  if (!timer.running) return;
  if (timerLeft() <= 0) {
    timer.running = false; timer.ended = true; timer.remaining = 0;
    log('⏱ TIME! The subathon clock hit 0:00:00.');
  }
  broadcast({ type: 'timer', ...timerView() });
}, 1000);
setInterval(() => { if (timer.running) timerChanged(); }, 15000);   // keep the saved time fresh

function timerApi(req, res) {
  // only this computer's own control page: it sends a custom header, which a
  // web page from somewhere else can't send here
  const origin = req.headers.origin;
  const okOrigin = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (req.headers['x-ccbridge'] !== '1' || !okOrigin) { res.writeHead(403); res.end(); return; }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
  req.on('end', () => {
    let a = {}; try { a = JSON.parse(body || '{}'); } catch {}
    const view = timerAction(a.action, a.seconds);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(view));
  });
}
function timerAction(action, seconds, why) {
    const n = Math.round(+seconds || 0);
    switch (action) {
      case 'set':
        if (n <= 0) break;
        Object.assign(timer, { active: true, running: false, ended: false, remaining: n, endsAt: 0, added: 0, coins: 0, log: [] });
        log(`⏱ timer set to ${fmtTime(n)} (press Start on the control page)`);
        break;
      case 'start':
        if (!timer.active || timer.ended || timer.running || timer.remaining <= 0) break;
        timer.running = true; timer.endsAt = Date.now() + timer.remaining * 1000;
        log(`⏱ timer started at ${fmtTime(timer.remaining)}`);
        break;
      case 'pause':
        if (!timer.running) break;
        timer.remaining = timerLeft(); timer.running = false;
        log(`⏱ timer paused at ${fmtTime(timer.remaining)}`);
        break;
      case 'add':
        if (!timer.active || !n) break;
        if (timer.ended && n > 0) { timer.ended = false; timer.remaining = 0; }
        timerAdd(n, why ? 'game' : 'streamer', why ? String(why).slice(0, 60) : 'by hand');
        if (why) log(`  ⏱ ${n > 0 ? '+' : '−'}${fmtTime(Math.abs(n))} (${why}), clock: ${fmtTime(timerLeft())}`);
        break;
      case 'off':
        Object.assign(timer, { active: false, running: false, ended: false, remaining: 0, endsAt: 0 });
        log('⏱ timer turned off');
        break;
    }
    timerChanged();
    studio.pushState();
    return timerView(true);
}

const TIMER_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Subathon timer</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* OBS / TikTok LIVE Studio browser source. ?size=96 sets the digit size,
     ?bg=0 makes the background see-through, ?label=0 hides the label. */
  html, body { margin: 0; background: transparent; overflow: hidden; }
  body { --s: 72px; font-family: system-ui, "Segoe UI", sans-serif; color: #fff; display: flex; justify-content: center; }
  .box { display: inline-flex; flex-direction: column; align-items: center; padding: calc(var(--s) * .12) calc(var(--s) * .35);
    background: rgba(8,10,14,.88); border: 3px solid #e63946; border-radius: calc(var(--s) * .2); margin: calc(var(--s) * .42) 6px 6px; position: relative; }
  .box.clear { background: transparent; border-color: transparent; }
  .lab { font-weight: 800; letter-spacing: .14em; font-size: calc(var(--s) * .22); color: #e63946; }
  .t { font: 800 var(--s)/1 ui-monospace, "Cascadia Mono", Consolas, monospace; font-variant-numeric: tabular-nums; text-shadow: 0 3px 4px #000; }
  .paused .t { opacity: .55; } .ended { border-color: #e5534b; } .ended .t { color: #ff6b61; }
  .pop { position: absolute; right: -0.2em; top: 0; transform: translateY(-40%); background: #3fb950; color: #04130a; font-weight: 800;
    font-size: calc(var(--s) * .26); padding: .15em .5em; border-radius: 999px; white-space: nowrap; opacity: 0; transition: opacity .4s, transform .4s; }
  .pop.on { opacity: 1; transform: translateY(-62%); }
  .pop.minus { background: #e5534b; color: #fff; }
  .off { font-size: 16px; color: #9fb3c8; padding: 8px; }
</style></head><body>
<div class="box" id="box"><div class="lab" id="lab">TIME LEFT</div><div class="t" id="t">–:––:––</div><div class="pop" id="pop"></div></div>
<script>
const q = new URLSearchParams(location.search);
if (q.get('size')) document.body.style.setProperty('--s', (+q.get('size') || 72) + 'px');
if (q.get('bg') === '0') document.getElementById('box').classList.add('clear');
if (q.get('label') === '0') document.getElementById('lab').hidden = true;
const box = document.getElementById('box'), t = document.getElementById('t'), pop = document.getElementById('pop');
let lastId = null, popT = null, base = null, baseAt = 0;
const fmt = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const short = (s) => s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + s % 60 + 's' : '') : fmt(s);
function draw() {
  if (!base) return;
  const left = base.running ? base.remaining - (Date.now() - baseAt) / 1000 : base.remaining;
  t.textContent = base.ended ? 'TIME!' : fmt(Math.ceil(left));
}
async function poll() {
  try {
    const d = await (await fetch('/timer.json', { cache: 'no-store' })).json();
    base = d; baseAt = Date.now();
    box.hidden = !d.active;
    box.className = 'box' + (q.get('bg') === '0' ? ' clear' : '') + (d.ended ? ' ended' : !d.running ? ' paused' : '');
    const a = d.lastAdd;
    if (a && a.id !== lastId) {
      if (lastId !== null && a.seconds) {
        // time on is green; time off (checks and bosses, when set to take time off) is red
        const who = a.user === 'game' ? a.why : a.user && a.user !== 'streamer' ? a.user : '';
        pop.textContent = (a.seconds > 0 ? '+' : '−') + short(Math.abs(a.seconds)) + (who ? ' · ' + who : '');
        pop.classList.toggle('minus', a.seconds < 0);
        pop.classList.add('on'); clearTimeout(popT); popT = setTimeout(() => pop.classList.remove('on'), 4000);
      }
      lastId = a.id;
    } else if (!a && lastId === null) lastId = 0;
    draw();
  } catch (e) { t.textContent = '–:––:––'; }
  setTimeout(poll, 1000);
}
setInterval(draw, 250); poll();
</script></body></html>`;

const CONTROL_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Subathon timer control</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #12151b; color: #e8edf3; font: 15px/1.45 system-ui, "Segoe UI", sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 18px 16px 40px; }
  h1 { font-size: 18px; margin: 0 0 4px; } p.hint { color: #9fb3c8; margin: 4px 0 14px; font-size: 13px; }
  .clock { font: 800 56px/1 ui-monospace, Consolas, monospace; text-align: center; padding: 14px; border-radius: 12px; background: #0b0d11;
    border: 2px solid #e63946; font-variant-numeric: tabular-nums; }
  .state { text-align: center; color: #9fb3c8; margin: 6px 0 16px; font-size: 13px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0; }
  input { width: 64px; padding: 8px; border-radius: 8px; border: 1px solid #2c3440; background: #0b0d11; color: inherit; font-size: 15px; }
  button { padding: 9px 14px; border-radius: 8px; border: 1px solid #2c3440; background: #1d232c; color: inherit; font: inherit; cursor: pointer; }
  button:hover { background: #262e39; } button.go { background: #23863633; border-color: #2ea043; } button.stop { background: #da363322; border-color: #da3633; }
  button.set { background: #e6394622; border-color: #e63946; }
  h2 { font-size: 14px; margin: 22px 0 6px; color: #e63946; letter-spacing: .04em; }
  ul { list-style: none; padding: 0; margin: 0; font-size: 13px; } li { padding: 5px 0; border-bottom: 1px solid #1f252e; display: flex; justify-content: space-between; gap: 10px; }
  li .s { color: #3fb950; font-variant-numeric: tabular-nums; } li .s.neg { color: #ff6b61; }
  .links { font-size: 13px; color: #9fb3c8; } code { color: #e8edf3; }
</style></head><body><main>
<h1>Subathon timer</h1>
<p class="hint"><b id="per">Every coin = +1 second</b> while the timer is set (change it with "coinsPerSecond" in mapping.json). When it reaches 0:00:00 it stops.</p>
<div class="clock" id="clock">–:––:––</div>
<div class="state" id="state">Not set</div>

<div class="row"><b style="min-width:92px">Start at</b>
  <input id="h" type="number" min="0" value="1"> h <input id="m" type="number" min="0" max="59" value="0"> m
  <button class="set" id="set">Set timer</button></div>
<div class="row"><button class="go" id="start">▶ Start</button><button class="stop" id="pause">⏸ Pause</button></div>
<div class="row"><b style="min-width:92px">Adjust</b>
  <button data-add="60">+1 min</button><button data-add="600">+10 min</button><button data-add="3600">+1 hour</button>
  <button data-add="-60">−1 min</button><button data-add="-600">−10 min</button></div>

<h2>RECENT</h2>
<ul id="log"><li>Nothing yet</li></ul>
<div class="row" style="margin-top:24px"><button id="off">Turn the timer off</button></div>
<p class="links">On stream: add a browser source with <code>http://localhost:${'${location.port}'}/timer</code>
(width 600, height 190). <code>?size=96</code> makes it bigger, <code>?bg=0</code> removes the box.</p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const fmt = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const short = (s) => { const a = Math.abs(s); return (s < 0 ? '−' : '+') + (a < 60 ? a + 's' : a < 3600 ? Math.floor(a / 60) + 'm' + (a % 60 ? ' ' + a % 60 + 's' : '') : fmt(a)); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
document.querySelector('.links code').textContent = 'http://localhost:' + location.port + '/timer';
let d = null, at = 0;
function paint() {
  if (!d) return;
  const left = d.running ? d.remaining - (Date.now() - at) / 1000 : d.remaining;
  $('clock').textContent = !d.active ? '–:––:––' : d.ended ? 'TIME!' : fmt(Math.ceil(left));
  $('state').textContent = !d.active ? 'Not set: choose a starting time and press Set timer'
    : d.ended ? 'Finished. Use Adjust to add time and keep going.'
    : (d.running ? 'Running' : 'Paused') + ' · ' + d.coins.toLocaleString() + ' coins so far · ' + fmt(d.added) + ' added';
  $('per').textContent = d.rate + ' (' + Math.round(3600 * d.coinsPerSecond).toLocaleString() + ' coins per hour)';
  $('log').innerHTML = d.log.length ? d.log.map((l) => '<li><span>' + esc(l.user || '') + (l.why ? ' <small style="color:#9fb3c8">' + esc(l.why) + '</small>' : '') +
    '</span><span class="s' + (l.seconds < 0 ? ' neg' : '') + '">' + short(l.seconds) + '</span></li>').join('') : '<li>Nothing yet</li>';
}
async function call(action, seconds) {
  try {
    const r = await fetch('/timer/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ccbridge': '1' }, body: JSON.stringify({ action, seconds }) });
    d = await r.json(); at = Date.now(); paint();
  } catch (e) { $('state').textContent = 'Can\\'t reach the bridge. Is its window open?'; }
}
async function poll() {
  try { d = await (await fetch('/timer.json', { cache: 'no-store' })).json(); at = Date.now(); paint(); }
  catch (e) { $('state').textContent = 'Can\\'t reach the bridge. Is its window open?'; }
  setTimeout(poll, 1000);
}
$('set').onclick = () => {
  const s = (+$('h').value || 0) * 3600 + (+$('m').value || 0) * 60;
  if (s <= 0) { $('state').textContent = 'Choose a starting time first.'; return; }
  if (d && d.active && !d.ended && !confirm('Replace the current timer (' + fmt(d.remaining) + ' left) with ' + fmt(s) + '?')) return;
  call('set', s);
};
$('start').onclick = () => call('start');
$('pause').onclick = () => call('pause');
$('off').onclick = () => { if (confirm('Turn the timer off? It disappears from the stream.')) call('off'); };
document.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => call('add', +b.dataset.add); });
setInterval(paint, 250); poll();
</script></body></html>`;

// ── TikFinity source ───────────────────────────────────────────────────────
// TikFinity (free desktop app) connects to your LIVE itself and re-sends every
// event on ws://localhost:21213 as {"event": "gift", "data": {...}}. The bridge
// listens to that, so no sign server or API key is needed. Node 20 has no
// built-in WebSocket client, so this is a small one on top of node:net.
function startTikFinity() {
  const port = cfg.tikfinityPort;
  let warned = false, stopped = false, live = null, retryT = null;
  const later = (ms) => { clearTimeout(retryT); if (!stopped) retryT = setTimeout(connect, ms); };
  function connect() {
    if (stopped) return;
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({ host: '127.0.0.1', port, path: '/', headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
    req.on('upgrade', (res, socket) => {
      warned = false;
      liveText = 'Connected to TikFinity';
      log(`connected to TikFinity on port ${port}. Gifts, likes, follows and shares will come through while you're live.`);
      broadcast({ type: 'status', text: liveText });
      if (stopped) { socket.destroy(); return; }
      const conn = live = { socket, buf: Buffer.alloc(0) };
      socket.on('data', (d) => { conn.buf = Buffer.concat([conn.buf, d]); readClientFrames(conn); });
      const lost = () => {
        if (conn.gone) return; conn.gone = true;
        if (stopped) return;
        liveText = 'TikFinity disconnected';
        broadcast({ type: 'status', text: liveText });
        log('lost TikFinity, retrying in 5s'); later(5000);
      };
      socket.on('close', lost); socket.on('error', lost);
    });
    req.on('response', (res) => { log(`TikFinity answered with HTTP ${res.statusCode} instead of a WebSocket. Retrying in 10s.`); res.resume(); later(10000); });
    req.on('error', () => {
      if (!warned) {
        log(`can't reach TikFinity on port ${port}. Open TikFinity, connect it to your TikTok, and check`);
        log('its Events API / WebSocket port is ' + port + '. Retrying every 5s quietly.');
        warned = true;
      }
      liveText = 'Waiting for TikFinity'; later(5000);
    });
    req.end();
  }
  connect();
  return { stop() { stopped = true; clearTimeout(retryT); if (live) { live.gone = true; try { live.socket.destroy(); } catch {} } } };
}

// ── Local signer source (recommended): TikTok's own LIVE page in a browser window ──
// See localsigner.mjs. No TikFinity, no keys, no accounts.
function startLocal() {
  const src = startLocalSigner({
    username: cfg.username && cfg.username !== 'your_tiktok_username' ? cfg.username : '',
    browserPath: findBrowser(cfg.browserPath),
    port: +cfg.localSignerPort || 21215,
    profileDir: path.join(HERE, 'tiktok-window'),
    liveUrl: cfg.localLiveUrl || '',
    log,
    onStatus: (text) => { if (text !== liveText) { liveText = text; broadcast({ type: 'status', text }); log('TikTok: ' + text); } },
    onEvent: (ev) => {
      const who = { nickname: ev.nickname || '', avatar: ev.avatar || '' };
      if (ev.kind === 'gift') {
        if (ev.gift && ev.picture) extraIcons.set(ev.gift.toLowerCase(), ev.picture);
        onGift(ev.user, ev.gift, ev.giftId, ev.count, ev.diamonds, who);
      } else if (ev.kind === 'like') onLike(ev.user, ev.count, who);
      else if (ev.kind === 'follow' || ev.kind === 'share' || ev.kind === 'superfan' || ev.kind === 'community') onSocial(ev.kind, ev.user, who);
      else if (ev.kind === 'chat') onChat(ev.user, ev.text || '', who);
      else if (ev.kind === 'other') noteUnknown(ev.method, ev.key);
      else if (ev.kind === 'end') { liveText = 'TikTok LIVE ended'; broadcast({ type: 'status', text: liveText }); log(liveText); }
    },
  });
  return src;
}

// TikTok messages with a label we don't use yet, logged once each: if TikTok
// names Super Fans or community joins differently, the log shows what to match.
const unknownSeen = new Set();
function noteUnknown(method, key) {
  const k = method + '|' + key;
  if (unknownSeen.has(k) || unknownSeen.size > 200) return;
  unknownSeen.add(k);
  log(`  (TikTok event not used: ${method}${key ? ' / ' + key : ''})`);
}

// Start (or switch to) the source in mapping.json; the control panel calls this too.
let activeSource = null;
function startSource() {
  if (TEST) return;
  try { activeSource && activeSource.stop && activeSource.stop(); } catch {}
  activeSource = null; liveText = '';
  if (cfg.source === 'local') activeSource = startLocal();
  else if (cfg.source === 'tikfinity') activeSource = startTikFinity();
  else if (cfg.source === 'direct') startTikTok();
  else log(`"source" in mapping.json should be "local", "tikfinity" or "direct" (got "${cfg.source}").`);
}

function readClientFrames(c) {
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (b.length < off + len) return;
    const data = b.subarray(off, off + len);
    c.buf = b.subarray(off + len);
    if (op === 0x0 || op === 0x1) {
      // TikFinity sends whole messages; continuation frames are joined just in case
      c.text = (c.text || '') + data.toString('utf8');
      if (b[0] & 0x80) { const t = c.text; c.text = ''; onTikFinity(t); }
    } else if (op === 0x9) writeClientFrame(c.socket, data, 0xA);   // ping → pong
    else if (op === 0x8) { c.socket.end(); return; }
  }
}
function writeClientFrame(socket, payload, op) {   // client frames must be masked
  const mask = crypto.randomBytes(4), n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, 0x80 | n]) : Buffer.from([0x80 | op, 0x80 | 126, n >> 8, n & 255]);
  const body = Buffer.from(payload); for (let i = 0; i < n; i++) body[i] ^= mask[i & 3];
  try { socket.write(Buffer.concat([head, mask, body])); } catch {}
}

function onTikFinity(text) {
  let m; try { m = JSON.parse(text); } catch { return; }
  const ev = String(m.event || m.type || '').toLowerCase();
  const d = m.data || {};
  const user = d.uniqueId || d.user?.uniqueId || d.nickname || d.user?.nickname || 'someone';
  const who = { nickname: d.nickname || d.user?.nickname || '', avatar: d.profilePictureUrl || d.user?.profilePictureUrl || '' };
  if (ev === 'gift') {
    const giftType = d.giftType ?? d.giftDetails?.giftType;
    if (giftType === 1 && d.repeatEnd === false) return;   // streak still going: wait for the final count
    const name = d.giftName || d.giftDetails?.giftName || d.extendedGiftInfo?.name || '';
    const pic = d.giftPictureUrl || d.giftDetails?.giftImage?.giftPictureUrl;
    if (name && pic && /^https:\/\//.test(pic)) extraIcons.set(name.toLowerCase(), pic);
    onGift(user, name, d.giftId, d.repeatCount || 1, d.diamondCount ?? d.giftDetails?.diamondCount, who);
  } else if (ev === 'like') onLike(user, d.likeCount || 1, who);
  else if (ev === 'follow') onSocial('follow', user, who);
  else if (ev === 'share') onSocial('share', user, who);
  else if (/subscri|super_?fan/.test(ev)) onSocial('superfan', user, who);
  else if (/fan_?club|fanteam|team_?join|join_?team|community/.test(ev)) onSocial('community', user, who);
  else if (ev === 'chat') onChat(user, d.comment || '', who);
  else if (ev === 'social') {
    const kind = String(d.displayType || d.label || '').toLowerCase();
    if (kind.includes('follow')) onSocial('follow', user, who);
    else if (kind.includes('share')) onSocial('share', user, who);
  } else if (ev === 'streamend') {
    liveText = 'TikTok LIVE ended'; broadcast({ type: 'status', text: liveText }); log(liveText);
  }
}

// ── TikTok connection ──────────────────────────────────────────────────────
let liveText = '';
async function startTikTok() {
  if (!cfg.username || cfg.username === 'your_tiktok_username') {
    log('Set "username" in mapping.json to your TikTok name (without @). Or run with --test.'); process.exit(1);
  }
  // Direct connections must be signed by an outside "sign server". Euler Stream
  // (the library default) has a free Community plan with a key; tik.tools only a
  // 7-day trial. "signServer" can be "euler", "tiktools", or an https:// URL.
  const SIGN_SERVERS = { tiktools: 'https://api.tik.tools', euler: 'https://api.eulerstream.com' };
  const signChoice = String(cfg.signServer || 'euler');
  const signUrl = SIGN_SERVERS[signChoice.toLowerCase()] || signChoice;
  const key = String(cfg.signApiKey || '').trim();
  if (!/^https:\/\//.test(signUrl)) {
    log(`"signServer" in mapping.json should be "tiktools", "euler", or an https:// address (got "${signChoice}").`); process.exit(1);
  }
  if (!key || key === 'paste_your_key_here') {
    log('No "signApiKey" in mapping.json. Get a free key (Community plan) at https://www.eulerstream.com,');
    log('paste it into mapping.json as "signApiKey", then start the bridge again.'); process.exit(1);
  }
  // The library reads these when it loads, so set them before importing it.
  process.env.SIGN_API_URL = signUrl;
  process.env.SIGN_API_KEY = key;

  let TikTokLiveConnection, SignConfig;
  try { ({ TikTokLiveConnection, SignConfig } = await import('tiktok-live-connector')); }
  catch { log('tiktok-live-connector is not installed. Run "npm install" in this folder first.'); process.exit(1); }
  if (SignConfig) { SignConfig.basePath = signUrl; SignConfig.apiKey = key; }
  log(`signing TikTok connections through ${new URL(signUrl).host}`);

  // Extended gift info is a separate TikTok lookup that often fails; gift names
  // already arrive with each gift, so it's not needed.
  const conn = new TikTokLiveConnection(cfg.username, { enableExtendedGiftInfo: false, signApiKey: key });

  const who = (d) => ({ nickname: d.user?.nickname || '', avatar: d.user?.profilePicture?.url?.[0] || d.user?.profilePictureUrl || '' });
  conn.on('gift', (d) => {
    const type = d.giftDetails?.giftType;
    if (type === 1 && !d.repeatEnd) return;         // streak still going: wait for the final count
    const name = d.giftDetails?.giftName || d.extendedGiftInfo?.name || '';
    onGift(d.user?.uniqueId || d.user?.nickname || 'someone', name, d.giftId, d.repeatCount || 1, d.giftDetails?.diamondCount ?? d.diamondCount, who(d));
  });
  conn.on('like', (d) => onLike(d.user?.uniqueId || 'someone', d.likeCount || 1, who(d)));
  conn.on('follow', (d) => onSocial('follow', d.user?.uniqueId || 'someone', who(d)));
  conn.on('share', (d) => onSocial('share', d.user?.uniqueId || 'someone', who(d)));
  conn.on('subscribe', (d) => onSocial('superfan', d.user?.uniqueId || 'someone', who(d)));
  conn.on('superFan', (d) => onSocial('superfan', d.user?.uniqueId || 'someone', who(d)));
  conn.on('chat', (d) => onChat(d.user?.uniqueId || 'someone', d.comment || '', who(d)));
  conn.on('disconnected', () => { liveText = 'TikTok disconnected'; broadcast({ type: 'status', text: liveText }); log(liveText + ', retrying in 30s'); setTimeout(go, 30000); });
  conn.on('streamEnd', () => { liveText = 'TikTok LIVE ended'; broadcast({ type: 'status', text: liveText }); log(liveText); });
  conn.on('error', (e) => log('TikTok error:', e?.info || e?.exception?.message || e));

  async function go() {
    try {
      const state = await conn.connect();
      liveText = `Live as @${cfg.username}`;
      log(`connected to @${cfg.username}'s LIVE (room ${state.roomId})`);
      broadcast({ type: 'status', text: liveText });
    } catch (e) {
      const msg = e?.message || String(e);
      liveText = 'Waiting for TikTok LIVE';
      if (/plan|api key|apikey|unauthori[sz]ed|forbidden|\b40[123]\b/i.test(msg)) {
        log(`the sign server refused the connection (${msg}). Check "signApiKey" in mapping.json. Retrying in 30s.`);
      } else {
        log(`couldn't join @${cfg.username}'s LIVE (${msg}). Are you live? Retrying in 30s.`);
      }
      setTimeout(go, 30000);
    }
  }
  go();
}

// ── test mode: fake events from the keyboard ───────────────────────────────
function startTest() {
  log('TEST MODE. Commands:');
  log('  <effect_id>            e.g. heal_full, invert, rupees_minus');
  log('  gift <name> [count]    e.g. gift Rose 3   (uses mapping.json)');
  log('  coins <n>              a donation worth n coins (tiers + timer)');
  log('  like <n> | follow | share | list');
  log('  chat <message>         a chat message (TTS and !commands)');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    if (!cmd) return;
    if (cmd === 'gift') {
      const count = /^\d+$/.test(rest.at(-1) || '') ? +rest.pop() : 1;
      onGift('tester', rest.join(' '), 0, count);
    } else if (cmd === 'coins') onGift('tester', '(test donation)', 0, 1, +(rest[0] || 0));
    else if (cmd === 'like') onLike('tester', +(rest[0] || 1));
    else if (cmd === 'follow' || cmd === 'share' || cmd === 'superfan' || cmd === 'community') { cooldown.clear(); onSocial(cmd, 'tester'); }
    else if (cmd === 'chat') onChat('tester', rest.join(' '));
    else if (cmd === 'list') log(knownEffects ? [...knownEffects].join(', ') : 'connect the game first to see its effects');
    else fire(cmd, 'tester', '');
  });
}

// ── Studio (control panel + overlays) ──────────────────────────────────────
function saveCfg(patch) {
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  Object.assign(raw, patch);
  fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n');
  cfg = loadConfig(); sendDurations();
}
const studio = createStudio({
  HERE, log,
  getCfg: () => cfg,
  saveCfg,
  fire: (effect, user, label) => fire(effect, user, label),
  testBoss: (boss, user) => {
    if (!clients.size) { log('  (no game connected, boss test dropped)'); return; }
    broadcast({ type: 'detour-test', boss: String(boss), user }); log(`  → boss detour test: ${boss}`);
  },
  simulateGift: (user, name, count, coins, runEffect) => onGift(user, name, 0, count, coins / Math.max(1, count), { test: true, runEffect }),
  simulate: (kind, user, a) => {
    if (kind === 'like') onLike(user, Math.max(1, +a.count || 50), { test: true, runEffect: !!a.runEffect });
    else if (kind === 'follow' || kind === 'share' || kind === 'superfan' || kind === 'community') { cooldown.delete(kind + ':' + user); onSocial(kind, user, { test: true, runEffect: !!a.runEffect }); }
    else if (kind === 'chat') onChat(user, String(a.text || 'hello!'), { test: true, runEffect: !!a.runEffect });
  },
  effectList: () => {
    const virtual = ['mystery_box', 'detour_rescue'];
    const ids = (knownEffects ? [...knownEffects] : Object.keys(effectNames).filter((x) => !virtual.includes(x))).concat(virtual);
    return ids.map((id) => ({ id, name: effectNames[id] || id, warn: effectWarnings[id], secs: id in defaultSecs ? (+(cfg.durations || {})[id] > 0 ? +cfg.durations[id] : defaultSecs[id]) : 0 }));
  },
  timerView,
  timerApi: (op, seconds, why) => timerAction(op, seconds, why),
  connectSource: (source, username) => {
    const patch = {};
    if (['local', 'tikfinity'].includes(source)) patch.source = source;
    if (typeof username === 'string') patch.username = username.replace(/^@/, '').trim();
    saveCfg(patch); log(`source: ${cfg.source}${cfg.username ? ' as @' + cfg.username : ''}`); startSource();
  },
  openLive: () => { if (activeSource && activeSource.open) activeSource.open(); else if (!TEST && cfg.source === 'local') startSource(); },
  status: () => ({ source: TEST ? 'test' : cfg.source, username: cfg.username || '', browser: cfg.source === 'local' ? !!findBrowser(cfg.browserPath) : undefined, live: liveText || (TEST ? 'Test mode' : 'Starting…'), games: clients.size, port: cfg.port, gameKnowsEffects: !!knownEffects }),
});

server.listen(cfg.port, '127.0.0.1', () => {
  log(`bridge listening on ws://localhost:${cfg.port}`);
  log(`CONTROL PANEL: http://localhost:${cfg.port}/studio   (open it in your browser)`);
  log(`scrolling gift list for OBS: http://localhost:${cfg.port}/ticker`);
  log(`subathon timer: http://localhost:${cfg.port}/timer   (controls: http://localhost:${cfg.port}/timer/control)`);
  if (timer.active) log(`⏱ timer restored: ${fmtTime(timer.remaining)} left${timer.ended ? ' (finished)' : ', paused. Press Start on the control page'}`);
  if (!args.includes('--no-open')) setTimeout(() => {
    // a Studio tab left open from last time reconnects by itself: don't open another
    if (studio.pageCount && studio.pageCount('/studio') > 0) { log('control panel already open in your browser'); return; }
    const url = `http://localhost:${cfg.port}/studio`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    try { exec(cmd, () => {}); } catch {}
  }, 4000);
  if (TEST) startTest();
  else startSource();
});
server.on('error', (e) => { log(e.code === 'EADDRINUSE' ? `port ${cfg.port} is in use (bridge already running?)` : e.message); process.exit(1); });
