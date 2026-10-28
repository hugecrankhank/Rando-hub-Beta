/*
 * Crowd Control+ Studio: the part of the bridge that runs the control panel
 * (http://localhost:21214/studio) and the stream overlays (/overlay/...).
 *
 * bridge.mjs hears TikTok (through TikFinity or a sign key) and turns gifts
 * into game effects, as before. Every event it hears is also handed to
 * record() here, which:
 *   - keeps the live log, totals and the top-gifters board (stats.json),
 *   - moves the goal bars (studio.json "goals"),
 *   - decides which events pop up as alerts, are read aloud, or answer a
 *     chat command,
 * and pushes all of it to the panel and overlays over Server-Sent Events
 * (GET /studio/events). The panel changes settings through POST /studio/api,
 * which only this computer's own pages can call (same guard as the timer).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLive, LIVE_DEFAULTS } from './studio-live.mjs';

const MAX_LOG = 200;

export function createStudio(ctx) {
  // ctx: { HERE, log, getCfg, saveCfg(patch), fire(effect,user,label,count), simulateGift(user,name,count,coins),
  //        simulate(kind,user,extra), effectList(), timerView(full), timerApi(action,seconds), status() }
  const { HERE, log } = ctx;
  const STUDIO_FILE = path.join(HERE, 'studio.json');
  const STATS_FILE = path.join(HERE, 'stats.json');
  const SEEN_FILE = path.join(HERE, 'seen-gifts.json');
  const PROFILES = path.join(HERE, 'profiles');
  const STATIC = path.join(HERE, 'studio');

  // ── settings ─────────────────────────────────────────────────────────────
  const DEFAULTS = {
    alerts: {
      enabled: true, minCoins: 1, seconds: 6, sound: true, volume: 0.7, showEffect: true,
      follows: true, shares: false, superfans: true, community: true,
      // bigger donations get bigger alerts: the highest tier reached is used
      tiers: [
        { coins: 1, name: 'small', title: 'THANK YOU!' },
        { coins: 100, name: 'big', title: 'BIG GIFT!' },
        { coins: 1000, name: 'huge', title: 'HUGE GIFT!!' },
      ],
    },
    goals: [
      { id: 'g1', type: 'coins', label: 'CHAOS SEED', target: 5000, current: 0, show: true },
      { id: 'g2', type: 'likes', label: 'LIKE GOAL', target: 10000, current: 0, show: false },
    ],
    leaderboard: { title: 'TOP GIFTERS', size: 5 },
    feed: { size: 6, gifts: true, follows: true, shares: true, likes: false },
    tts: {
      enabled: false, who: 'gifters', minCoins: 1, maxLength: 120, readNames: true,
      voice: '', rate: 1, volume: 1, bannedWords: [],
    },
    commands: {
      enabled: true, cooldown: 20, seconds: 8,
      list: [
        { cmd: '!effects', text: '{effects}' },
        { cmd: '!rules', text: 'Gifts change my game live! Big donations roll a brand-new seed.' },
        { cmd: '!timer', text: 'Subathon clock: {timer} left' },
      ],
    },
    theme: { accent: '#e63946', panel: 'rgba(17,12,34,.9)', pixelFont: true },
    ...LIVE_DEFAULTS,
  };
  const merge = (base, over) => {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (!base || typeof base !== 'object') return over === undefined ? base : over;
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  };
  const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
  const writeJson = (f, v) => { try { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); } catch (e) { log(`couldn't save ${path.basename(f)}: ${e.message}`); } };

  let settings = merge(DEFAULTS, readJson(STUDIO_FILE, {}));
  let ownWrite = 0;   // edits made by the panel itself don't count as "the file changed"
  if (!fs.existsSync(STUDIO_FILE)) writeJson(STUDIO_FILE, settings);
  fs.watchFile(STUDIO_FILE, { interval: 1000 }, () => {
    if (Date.now() - ownWrite < 2500) return;
    const next = readJson(STUDIO_FILE, null);
    if (!next) { log('studio.json has an error, kept the old settings'); return; }
    settings = merge(DEFAULTS, next); log('studio.json reloaded'); pushState();
  });
  function saveSettings() { ownWrite = Date.now(); writeJson(STUDIO_FILE, settings); }

  // ── stats (survive a restart; "Reset stream stats" clears them) ──────────
  let stats = Object.assign({ since: Date.now(), coins: 0, gifts: 0, likes: 0, follows: 0, shares: 0, chats: 0, gifters: {} }, readJson(STATS_FILE, {}));
  let statsT = null;
  const saveStats = () => { clearTimeout(statsT); statsT = setTimeout(() => writeJson(STATS_FILE, stats), 500); };
  const seen = readJson(SEEN_FILE, {});   // gift name → { coins, id, last }
  let seenT = null;

  const events = [];   // newest last
  let nextId = 1;
  const lastCmd = new Map();

  // ── Server-Sent Events to the panel and overlays ─────────────────────────
  const streams = new Set();
  function sse(res, msg) { try { res.write(`data: ${JSON.stringify(msg)}\n\n`); } catch {} }
  function push(msg) {
    for (const s of streams) sse(s.res, msg);
    // the game's own Live games panel follows the GT big key and Digging Game rounds
    if (msg.kind === 'live' && ctx.toGame && ['gtguess', 'gt', 'digguess', 'dig'].includes(msg.what)) {
      const m = { type: 'livegame', what: msg.what };
      for (const k of ['gtguess', 'gt', 'digguess', 'dig']) if (k in msg) m[k] = msg[k];
      ctx.toGame(m);
    }
  }
  function topGifters(n) {
    return Object.entries(stats.gifters).map(([user, g]) => ({ user, ...g }))
      .sort((a, b) => b.coins - a.coins || b.gifts - a.gifts).slice(0, n);
  }
  const live = createLive({
    HERE, log, push: (m) => push(m), settings: () => settings, saveSettings: () => { saveSettings(); pushState(); },
    fire: (effect, user, label) => ctx.fire(effect, user, label),
    effectName: (id) => (ctx.effectList().find((x) => x.id === id) || {}).name || id,
    effectIds: () => ctx.effectList().map((x) => x.id),
    timerApi: (op, secs, why) => ctx.timerApi(op, secs, why), timerView: () => ctx.timerView(false),
    streamSince: () => stats.since, record: (ev) => record(ev),
  });

  function snapshot() {
    const cfg = ctx.getCfg();
    return {
      kind: 'state',
      settings, stats: { ...stats, gifters: undefined, top: topGifters(Math.max(10, settings.leaderboard.size)) },
      status: ctx.status(), timer: ctx.timerView(true),
      mapping: {
        gifts: cfg.gifts || {}, coinTiers: cfg.coinTiers || [], likes: cfg.likes || {}, follow: cfg.follow || '', share: cfg.share || '', superfan: cfg.superfan || '', community: cfg.community || '',
        durations: cfg.durations || {}, maxPerGift: cfg.maxPerGift ?? 5, giftCoins: cfg.giftCoins || {}, timer: cfg.timer || {}, ticker: cfg.ticker || {}, source: cfg.source,
      },
      effects: ctx.effectList(), catalog: giftCatalog(), profiles: listProfiles(),
      recent: events.slice(-40),
      live: live.snapshot(),
    };
  }
  let stateT = null;
  function pushState() { clearTimeout(stateT); stateT = setTimeout(() => push(snapshot()), 80); }
  const overlayCount = () => [...streams].filter((x) => x.page.startsWith('/overlay/') && !x.page.endsWith('#preview')).length;
  setInterval(() => push({ kind: 'tick', status: ctx.status(), timer: ctx.timerView(false), overlays: overlayCount(), studioTabs: pageCount('/studio') }), 2000);

  // ── the gift list for the panel: icons + mapped + seen live ──────────────
  function giftCatalog() {
    const cfg = ctx.getCfg();
    const out = new Map();
    const add = (name, extra = {}) => {
      if (!name) return;
      const k = name.toLowerCase();
      const cur = out.get(k) || { name, coins: null, icon: null, mapped: null, seen: false };
      out.set(k, Object.assign(cur, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null))));
    };
    let icons = [];
    try { icons = fs.readdirSync(path.join(HERE, 'icons')).filter((f) => /\.(png|gif|webp|jpe?g)$/i.test(f)); } catch {}
    for (const f of icons) add(f.replace(/\.[^.]+$/, ''), { icon: '/icons/' + encodeURIComponent(f) });
    for (const [name, eff] of Object.entries(cfg.gifts || {})) add(name, { mapped: eff });
    for (const [name, s] of Object.entries(seen)) add(name, { coins: s.coins, seen: true });
    for (const [name, c] of Object.entries(cfg.giftCoins || {})) add(name, { coins: c });
    // attach icons/mapping case-insensitively
    const iconFor = (n) => icons.find((f) => f.replace(/\.[^.]+$/, '').toLowerCase() === n.toLowerCase());
    for (const g of out.values()) {
      if (!g.icon && iconFor(g.name)) g.icon = '/icons/' + encodeURIComponent(iconFor(g.name));
      if (!g.mapped) { const m = Object.entries(cfg.gifts || {}).find(([k]) => k.toLowerCase() === g.name.toLowerCase()); if (m) g.mapped = m[1]; }
    }
    return [...out.values()].sort((a, b) => (a.coins ?? 9e9) - (b.coins ?? 9e9) || a.name.localeCompare(b.name));
  }

  // ── recording events ─────────────────────────────────────────────────────
  function alertTier(coins) {
    const tiers = [...(settings.alerts.tiers || [])].filter((t) => +t.coins > 0).sort((a, b) => b.coins - a.coins);
    return tiers.find((t) => coins >= +t.coins) || null;
  }
  // a "gifts" goal can be for one gift only (g.gift, e.g. "Rose"): only that gift moves it
  function moveGoals(type, amount, gift) {
    let moved = false;
    for (const g of settings.goals) {
      if (g.type !== type || !(amount > 0)) continue;
      if (type === 'gifts' && g.gift && String(gift || '').toLowerCase() !== g.gift.toLowerCase()) continue;
      g.current = (+g.current || 0) + amount; moved = true;
    }
    if (moved) saveSettings();
  }
  const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);

  // ev: { type: gift|like|follow|share|chat|effect, user, nickname?, avatar?, gift?, count?, coins?, effect?, label?, text?, test? }
  function record(ev) {
    const e = { id: nextId++, at: Date.now(), ...ev, user: clean(ev.user || 'someone', 40) };
    if (e.nickname) e.nickname = clean(e.nickname, 40);
    if (e.text) e.text = clean(e.text, 300);
    const A = settings.alerts;
    if (!e.test || e.countStats) {
      if (e.type === 'gift') {
        stats.gifts += e.count || 1; stats.coins += e.coins || 0;
        const g = stats.gifters[e.user] || (stats.gifters[e.user] = { coins: 0, gifts: 0, nickname: e.nickname || '', avatar: '' });
        g.coins += e.coins || 0; g.gifts += e.count || 1; if (e.avatar) g.avatar = e.avatar; if (e.nickname) g.nickname = e.nickname;
        moveGoals('coins', e.coins || 0); moveGoals('gifts', e.count || 1, e.gift);
        if (e.gift && !e.test) {
          const each = e.count ? Math.round((e.coins || 0) / e.count) : 0;
          seen[e.gift] = { coins: each || seen[e.gift]?.coins || null, id: e.giftId ?? null, last: Date.now() };
          clearTimeout(seenT); seenT = setTimeout(() => writeJson(SEEN_FILE, seen), 1000);
        }
      } else if (e.type === 'like') { stats.likes += e.count || 1; moveGoals('likes', e.count || 1); }
      else if (e.type === 'follow') { stats.follows++; moveGoals('follows', 1); }
      else if (e.type === 'share') { stats.shares++; moveGoals('shares', 1); }
      else if (e.type === 'chat') stats.chats++;
      saveStats();
    }
    // alerts
    if (A.enabled) {
      if (e.type === 'gift' && (e.coins || 0) >= (+A.minCoins || 0)) { const t = alertTier(e.coins || 0) || { name: 'small', title: 'THANK YOU!' }; e.alert = { tier: t.name, title: t.title }; }
      else if (e.type === 'follow' && A.follows) e.alert = { tier: 'follow', title: 'NEW FOLLOWER' };
      else if (e.type === 'share' && A.shares) e.alert = { tier: 'share', title: 'SHARED THE LIVE' };
      else if (e.type === 'superfan' && A.superfans !== false) e.alert = { tier: 'follow', title: 'NEW SUPER FAN' };
      else if (e.type === 'community' && A.community !== false) e.alert = { tier: 'follow', title: 'NEW COMMUNITY MEMBER' };
    }
    // text-to-speech (spoken by the panel page, so it uses this PC's voices)
    if (e.type === 'chat' && e.text) {
      const T = settings.tts, gifter = stats.gifters[e.user];
      const okWho = T.who === 'everyone' || (T.who === 'gifters' && gifter && gifter.coins >= (+T.minCoins || 1));
      const banned = (T.bannedWords || []).map((w) => String(w).trim().toLowerCase()).filter(Boolean);
      const lower = e.text.toLowerCase();
      if (T.enabled && okWho && !e.text.startsWith('!') && !banned.some((w) => lower.includes(w)) && !/https?:\/\//i.test(e.text)) {
        e.speak = (T.readNames ? `${e.nickname || e.user} says: ` : '') + e.text.slice(0, +T.maxLength || 120);
      }
      // chat commands
      const C = settings.commands;
      const word = e.text.trim().split(/\s+/)[0].toLowerCase();
      const c = C.enabled && (C.list || []).find((x) => String(x.cmd || '').toLowerCase() === word);
      if (c) {
        const now = Date.now();
        if (now - (lastCmd.get(word) || 0) >= (+C.cooldown || 0) * 1000) {
          lastCmd.set(word, now);
          e.command = { cmd: c.cmd, reply: fillCommand(c.text || '') };
        }
      }
    }
    try { live.onEvent(e); } catch (err) { log('live: ' + err.message); }
    events.push(e); if (events.length > MAX_LOG) events.shift();
    push({ kind: 'event', ev: e, stats: { coins: stats.coins, gifts: stats.gifts, likes: stats.likes, follows: stats.follows, shares: stats.shares, chats: stats.chats, top: topGifters(Math.max(10, settings.leaderboard.size)) }, goals: settings.goals });
    return e;
  }

  function fillCommand(text) {
    const cfg = ctx.getCfg();
    const names = Object.fromEntries(ctx.effectList().map((x) => [x.id, x.name]));
    const effects = Object.entries(cfg.gifts || {}).slice(0, 12).map(([g, id]) => `${g} = ${names[id] || id}`).join(' · ');
    const t = ctx.timerView(false);
    const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    const top = topGifters(3).map((g, i) => `${i + 1}. ${g.nickname || g.user} (${g.coins})`).join('  ') || 'nobody yet';
    const goal = settings.goals.find((g) => g.show);
    return text.replace(/\{effects\}/g, effects || 'no gifts set up')
      .replace(/\{timer\}/g, t.active ? (t.ended ? 'TIME!' : fmt(t.remaining)) : 'not running')
      .replace(/\{top\}/g, top)
      .replace(/\{goal\}/g, goal ? `${goal.label} ${Math.min(goal.current, goal.target)}/${goal.target}` : 'no goal set')
      .replace(/\{coins\}/g, String(stats.coins));
  }

  // ── profiles: named copies of the gift setup + studio settings ───────────
  const safeName = (n) => String(n || '').trim().replace(/[^\w \-]+/g, '').slice(0, 40);
  function listProfiles() {
    try { return fs.readdirSync(PROFILES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort(); } catch { return []; }
  }
  const MAPPING_KEYS = ['gifts', 'coinTiers', 'likes', 'follow', 'share', 'superfan', 'community', 'durations', 'maxPerGift', 'giftCoins', 'timer', 'ticker'];

  // ── HTTP ─────────────────────────────────────────────────────────────────
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8' };
  function sendFile(res, file) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }
  const OVERLAYS = ['alerts', 'goal', 'leaderboard', 'feed', 'commands', 'vote', 'battle', 'mystery', 'combo', 'run', 'predict', 'gtkey', 'dig', 'halloffame', 'welcome'];

  function handle(req, res, url) {
    const p = url.pathname;
    if (p === '/' || p === '/studio' || p === '/studio/') { sendFile(res, path.join(STATIC, 'panel.html')); return true; }
    if (p === '/studio/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const s = { res, page: url.searchParams.get('page') || '' };
      streams.add(s); sse(res, snapshot());
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
      req.on('close', () => { clearInterval(ping); streams.delete(s); });
      return true;
    }
    if (p === '/studio/api' && req.method === 'POST') { api(req, res); return true; }
    const ov = p.match(/^\/overlay\/([a-z]+)\/?$/);
    if (ov && OVERLAYS.includes(ov[1])) { sendFile(res, path.join(STATIC, 'overlays', ov[1] + '.html')); return true; }
    if (p.startsWith('/studio/')) {
      const name = path.basename(decodeURIComponent(p.slice(8)));
      sendFile(res, path.join(STATIC, name)); return true;
    }
    if (p.startsWith('/sounds/')) {
      const name = path.basename(decodeURIComponent(p.slice(8)));
      if (/\.(mp3|wav|ogg)$/i.test(name)) { sendFile(res, path.join(HERE, 'sounds', name)); return true; }
      res.writeHead(404); res.end(); return true;
    }
    if (p === '/sounds.json') {
      let files = []; try { files = fs.readdirSync(path.join(HERE, 'sounds')).filter((f) => /\.(mp3|wav|ogg)$/i.test(f)); } catch {}
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(files)); return true;
    }
    return false;
  }

  function api(req, res) {
    const origin = req.headers.origin;
    const okOrigin = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (req.headers['x-ccbridge'] !== '1' || !okOrigin) { res.writeHead(403); res.end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 256 * 1024) req.destroy(); });
    req.on('end', () => {
      let a = {}; try { a = JSON.parse(body || '{}'); } catch {}
      let out = { ok: true };
      try { out = run(a) || out; } catch (e) { out = { ok: false, error: e.message }; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
      pushState();
    });
  }

  function run(a) {
    switch (a.action) {
      case 'settings': settings = merge(DEFAULTS, merge(settings, a.settings || {})); saveSettings(); log('studio settings saved'); return;
      case 'mapping': {
        const patch = {};
        for (const k of MAPPING_KEYS) if (k in (a.mapping || {})) patch[k] = a.mapping[k];
        ctx.saveCfg(patch); log('gift setup saved from the panel'); return;
      }
      case 'test-effect': ctx.fire(String(a.effect || ''), a.user || 'test', 'test'); return;
      case 'connect': ctx.connectSource && ctx.connectSource(String(a.source || ''), typeof a.username === 'string' ? a.username.slice(0, 40) : undefined, typeof a.signApiKey === 'string' ? a.signApiKey.slice(0, 200) : undefined); return;
      case 'open-live': ctx.openLive && ctx.openLive(); return;
      case 'test-boss': if (ctx.testBoss) ctx.testBoss(String(a.boss || ''), a.user || 'test'); return;
      case 'simulate': {
        const u = a.user || 'TestViewer';
        if (a.kind === 'gift') ctx.simulateGift(u, a.gift || 'Rose', Math.max(1, +a.count || 1), Math.max(0, +a.coins || 0), !!a.runEffect);
        else ctx.simulate(a.kind, u, a);
        return;
      }
      case 'goal': {
        const g = settings.goals.find((x) => x.id === a.id);
        if (a.op === 'add') settings.goals.push({ id: 'g' + Date.now().toString(36), type: 'coins', label: 'NEW GOAL', target: 1000, current: 0, show: false });
        else if (g && a.op === 'remove') settings.goals = settings.goals.filter((x) => x !== g);
        else if (g && a.op === 'adjust') g.current = Math.max(0, (+g.current || 0) + (+a.amount || 0));
        else if (g && a.op === 'reset') g.current = 0;
        else if (g && a.op === 'update') Object.assign(g, {
          label: clean(a.goal.label ?? g.label, 40), type: ['coins', 'likes', 'follows', 'shares', 'gifts'].includes(a.goal.type) ? a.goal.type : g.type,
          target: Math.max(1, Math.round(+a.goal.target || g.target)), current: Math.max(0, Math.round(+(a.goal.current ?? g.current) || 0)), show: !!a.goal.show,
          gift: clean(a.goal.gift ?? g.gift ?? '', 60),
        });
        saveSettings(); return;
      }
      case 'reset-stats':
        stats = { since: Date.now(), coins: 0, gifts: 0, likes: 0, follows: 0, shares: 0, chats: 0, gifters: {} };
        events.length = 0; writeJson(STATS_FILE, stats); log('stream stats reset'); return;
      case 'clear-alerts': push({ kind: 'clear' }); return;
      case 'profile-save': {
        const n = safeName(a.name); if (!n) throw new Error('Give the profile a name');
        fs.mkdirSync(PROFILES, { recursive: true });
        const cfg = ctx.getCfg(); const mapping = {};
        for (const k of MAPPING_KEYS) if (k in cfg) mapping[k] = cfg[k];
        writeJson(path.join(PROFILES, n + '.json'), { saved: new Date().toISOString(), mapping, studio: settings });
        log(`profile "${n}" saved`); return;
      }
      case 'profile-load': {
        const n = safeName(a.name); const p = readJson(path.join(PROFILES, n + '.json'), null);
        if (!p) throw new Error('That profile is missing');
        if (p.mapping) ctx.saveCfg(p.mapping);
        if (p.studio) { const keepGoals = settings.goals; settings = merge(DEFAULTS, p.studio); if (a.keepGoals) settings.goals = keepGoals; saveSettings(); }
        log(`profile "${n}" loaded`); return;
      }
      case 'profile-delete': { const n = safeName(a.name); try { fs.unlinkSync(path.join(PROFILES, n + '.json')); } catch {} return; }
      case 'timer': return { timer: ctx.timerApi(a.op, a.seconds) };
      default: {
        const r = live.run(a);
        if (r === false) throw new Error('unknown action');
        return typeof r === 'object' ? { ok: true, ...r } : undefined;
      }
    }
  }

  const pageCount = (path) => [...streams].filter((x) => x.page === path).length;
  return { record, handle, pushState, pageCount, onGame: (m) => live.onGame(m), mystery: (u, l) => live.mystery(u, l), get settings() { return settings; },
    liveRun: (a) => live.run(a), liveState: () => { const s = live.snapshot(); return { gtguess: s.gtguess, gt: s.gt, digguess: s.digguess, dig: s.dig }; } };
}
