/*
 * training.js — Z1R Training: a route guide drawn over the game.
 *
 * Learn a speedrun route by playing it. On every screen an arrow shows where
 * the route goes next, the bush / wall / rock / grave / armos to burn, bomb,
 * push or touch is outlined, bombs placed on the route are marked, and a
 * faint trail shows the line the route takes through the screen.
 *
 * Routes are recorded, not typed: press Record and play the route once (for
 * example along with a speedrun video). Every screen, cave and dungeon room
 * you go through becomes a step, with the path you walked, where you left,
 * the secrets you opened and where you dropped bombs. Then Guide plays it
 * back over the game. Routes can be exported as a .json file and imported on
 * another computer; files in training/routes.json are offered to everyone.
 *
 * Reads the game's RAM through NesBridge; overworld secrets come from the
 * ROM's own map (OwMap, via Z1Tracker), so they're on the right square for
 * the ROM being played (the normal game or a seed).
 *
 * Steps: { lv, room, cave, path: [[x, y]...], exit: [x, y] | null,
 *          secrets: [{ col, row, k }], bombs: [[x, y]...], note }
 * x / y are Link's middle in NES screen pixels (the play area starts at y 64).
 */
(function () {
  'use strict';

  const A = { LEVEL: 0x10, MODE: 0x12, SLOT: 0x16, ROOM: 0xEB, X: 0x70, Y: 0x84, BOMBS: 0x658, WORLD: 0x67F };
  const PLAY = 5, CAVE = 0x0B, SHORTCUT = 0x0C;
  const KEY = 'z1r:train:v1';
  const FORMAT = 'z1r-training-route';
  const LOOK = 40;               // how far along the route a screen is looked for
  const PATH_STEP = 6;           // px Link moves between trail points
  const PATH_MAX = 600;
  const TOP = 64;                // the play area's top, NES screen px
  const coord = (s) => 'ABCDEFGH'[(s >> 4) & 7] + ((s & 15) + 1);
  const $ = (id) => document.getElementById(id);

  // ── stored state ───────────────────────────────────────────────────────────
  let D = { routes: {}, current: null, mode: 'off', show: { arrows: true, path: true, secrets: true, notes: true } };
  try { const raw = localStorage.getItem(KEY); if (raw) D = Object.assign(D, JSON.parse(raw)); } catch (e) {}
  D.show = Object.assign({ arrows: true, path: true, secrets: true, notes: true }, D.show);
  if (D.mode === 'record') D.mode = 'off';          // recording never resumes by itself
  let builtIn = {};                                   // training/routes.json, read-only
  function save() {
    clearTimeout(save.t);
    save.t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { toast('Couldn’t save the route: storage is full?'); } }, 400);
  }
  const route = () => (D.current && (D.routes[D.current] || builtIn[D.current])) || null;
  const editable = () => !!(D.current && D.routes[D.current]);
  const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ── the game ──────────────────────────────────────────────────────────────
  function sample() {
    const r = window.NesBridge && NesBridge.ram();
    if (!r || r[0xF5] !== 0x5A || r[0x528] !== 0x5A || r[A.SLOT] > 2) return null;
    const mode = r[A.MODE], lvRaw = r[A.LEVEL];
    return {
      r, mode,
      stable: mode === PLAY || mode === CAVE || mode === SHORTCUT,
      lv: lvRaw <= 9 ? lvRaw : 0, room: r[A.ROOM], cave: mode === CAVE || mode === SHORTCUT ? 1 : 0,
      x: r[A.X] + 8, y: r[A.Y] + 11,
    };
  }
  const keyOf = (s) => s.lv + ':' + s.room + ':' + s.cave;
  const ow = () => (window.Z1Tracker && Z1Tracker._ow && Z1Tracker._ow()) || null;
  function where(st) {
    if (!st) return '';
    if (st.lv) return 'Level ' + st.lv + ' room ' + coord(st.room);
    return (st.cave ? 'cave at ' : '') + coord(st.room);
  }
  // What opening a screen's secret takes, from the ROM's tile there.
  function secretKind(room, col, row) {
    const o = ow();
    const p = o && o.squareKind ? o.squareKind(room, col, row) : 0;
    const by = { 0xE5: 'push', 0xE6: 'bomb', 0xE7: 'burn', 0xE8: 'push', 0xE9: 'touch', 0xEA: 'touch' }[p];
    if (by) return by;
    const e = o && o.screen(room) && o.screen(room).entrance;
    return { bomb: 'bomb', 'ladder+bomb': 'bomb', candle: 'burn', bracelet: 'push', recorder: 'recorder', raft: 'raft' }[e] || 'secret';
  }
  const KIND = {
    bomb: ['BOMB', '#F83800'], burn: ['BURN', '#F8B800'], push: ['PUSH', '#3CBCFC'], touch: ['TOUCH', '#B8F818'],
    recorder: ['PLAY RECORDER', '#F878F8'], raft: ['RAFT', '#3CBCFC'], secret: ['SECRET', '#FCFCFC'],
  };

  // ── recording ─────────────────────────────────────────────────────────────
  let rec = null;      // { bombs, sec: Uint8Array(128), last: [x, y] }
  function startRecording() {
    let r = route();
    if (!r || !editable()) {
      const id = newId();
      D.routes[id] = { id, name: 'Route ' + new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), created: Date.now(), steps: [] };
      D.current = id; r = D.routes[id];
    }
    rec = { bombs: null, sec: null, last: null, settle: 0 };
    D.mode = 'record'; save();
  }
  function recordTick(s) {
    const r = route();
    if (!r || !s) return;
    if (!rec.sec) { rec.sec = new Uint8Array(128); for (let i = 0; i < 128; i++) rec.sec[i] = s.r[A.WORLD + i] & 0x80 ? 1 : 0; }
    // Secrets opened (overworld): kept on the step where it happened
    for (let i = 0; i < 128; i++) {
      const f = s.r[A.WORLD + i] & 0x80 ? 1 : 0;
      if (f && !rec.sec[i]) {
        const st = r.steps[r.steps.length - 1];
        const o = ow();
        if (st && o) {
          const sq = o.entranceSquare(i);
          const k = secretKind(i, sq.col, sq.row);
          const target = st.room === i && !st.lv ? st : r.steps.slice().reverse().find((x) => !x.lv && !x.cave && x.room === i) || st;
          if (!target.secrets.some((q) => q.col === sq.col && q.row === sq.row)) target.secrets.push({ col: sq.col, row: sq.row, k });
          save();
        }
      }
      rec.sec[i] = f;
    }
    if (!s.stable) return;
    let st = r.steps[r.steps.length - 1];
    if (!st || keyOf(st) !== keyOf(s)) {
      if (st && rec.last) st.exit = rec.last;
      st = { lv: s.lv, room: s.room, cave: s.cave, path: [], exit: null, secrets: [], bombs: [], note: '' };
      r.steps.push(st);
      rec.last = null; rec.settle = 3;
      save(); renderPanel();
    }
    // The first frames on a new screen can still hold the old spot
    if (rec.settle > 0) { rec.settle--; rec.bombs = s.r[A.BOMBS]; return; }
    const p = [s.x, s.y], lp = st.path[st.path.length - 1];
    if (s.y < TOP) return;                        // between screens: not a real spot
    if ((!lp || Math.abs(lp[0] - p[0]) + Math.abs(lp[1] - p[1]) >= PATH_STEP) && st.path.length < PATH_MAX) { st.path.push(p); save(); }
    rec.last = p;
    const b = s.r[A.BOMBS];
    if (rec.bombs != null && b < rec.bombs) { st.bombs.push(p); save(); }
    rec.bombs = b;
  }

  // ── guiding ───────────────────────────────────────────────────────────────
  let gi = 0, off = false, done = false;
  function locate(s, from) {
    const r = route(); if (!r || !r.steps.length) return -1;
    const k = keyOf(s), n = r.steps.length;
    for (let i = from; i < Math.min(n, from + LOOK); i++) if (keyOf(r.steps[i]) === k) return i;      // ahead
    for (let i = from - 1; i >= Math.max(0, from - LOOK); i--) if (keyOf(r.steps[i]) === k) return i; // went back
    let best = -1;
    for (let i = 0; i < n; i++) if (keyOf(r.steps[i]) === k && (best < 0 || Math.abs(i - from) < Math.abs(best - from))) best = i;
    return best;
  }
  function guideTick(s) {
    const r = route();
    if (!r || !s || !s.stable || !r.steps.length) return;
    const cur = r.steps[gi];
    if (cur && keyOf(cur) === keyOf(s)) { if (off) { off = false; renderPanel(); } return; }
    const at = locate(s, gi + 1 <= r.steps.length - 1 && cur ? gi + 1 : gi);
    if (at >= 0) { gi = at; off = false; done = gi === r.steps.length - 1 && r.steps.length > 1; }
    else off = true;
    renderPanel();
  }
  function startGuide() {
    D.mode = 'guide'; rec = null; off = false; done = false; save();
    const s = sample();
    gi = 0;
    if (s) { const at = locate(s, 0); if (at >= 0) gi = at; }
  }

  // ── drawing over the game ─────────────────────────────────────────────────
  let cv = null, ctx = null, host = null;
  function ensureCanvas() {
    const P = window.EmuPlayer, root = P && P.fx && P.fx.container;
    if (!root) return false;
    if (host !== root || !cv || !cv.isConnected) {
      host = root;
      cv = document.createElement('canvas');
      cv.className = 'z1t-overlay';
      const game = root.querySelector('canvas');
      if (game && game.nextSibling) root.insertBefore(cv, game.nextSibling); else root.appendChild(cv);
      ctx = cv.getContext('2d');
    }
    const d = window.devicePixelRatio || 1, w = Math.round(root.clientWidth * d), h = Math.round(root.clientHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return true;
  }
  function clear() { if (ctx) ctx.clearRect(0, 0, cv.width, cv.height); }

  function arrowShape(c, x, y, dir, size, color, t) {
    const bob = Math.sin(t / 160) * size * 0.18;
    const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir];
    c.save();
    c.translate(x + Math.cos(ang) * bob, y + Math.sin(ang) * bob);
    c.rotate(ang);
    const s = size;
    c.beginPath();
    c.moveTo(s * 0.55, 0); c.lineTo(0, -s * 0.5); c.lineTo(0, -s * 0.2); c.lineTo(-s * 0.5, -s * 0.2);
    c.lineTo(-s * 0.5, s * 0.2); c.lineTo(0, s * 0.2); c.lineTo(0, s * 0.5); c.closePath();
    c.lineJoin = 'round'; c.lineWidth = Math.max(2, s * 0.12); c.strokeStyle = '#000'; c.stroke();
    c.fillStyle = color; c.fill();
    c.restore();
  }
  function label(c, text, x, y, color, px) {
    c.save();
    c.font = '700 ' + Math.round(px) + 'px "Pixelify Sans", ui-monospace, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + px * 0.8, h = px * 1.4;
    c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(x - w / 2, y - h / 2, w, h);
    c.fillStyle = color; c.fillText(text, x, y + px * 0.05);
    c.restore();
  }
  // How the route leaves a step: { kind: 'edge'|'in'|'out'|'stairs'|'warp', dir }
  function leaving(st, nx) {
    if (!nx) return null;
    const e = st.exit || st.path[st.path.length - 1] || [128, TOP + 88];
    if (st.lv === nx.lv && !st.cave && !nx.cave) {
      const dx = (nx.room & 15) - (st.room & 15), dy = (nx.room >> 4) - (st.room >> 4);
      if (Math.abs(dx) + Math.abs(dy) === 1) return { kind: 'edge', dir: dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up', at: e };
    }
    // Not next door: near an edge it's still that way out; otherwise right here
    const near = e[0] < 22 ? 'left' : e[0] > 234 ? 'right' : e[1] < TOP + 20 ? 'up' : e[1] > 220 ? 'down' : null;
    if (st.cave && !nx.cave) return { kind: 'out', dir: 'down', at: e };
    if (!st.cave && nx.cave && nx.room === st.room && !st.lv) return { kind: 'in', dir: 'up', at: e };
    if (st.lv && !nx.lv) return near ? { kind: 'edge', dir: near, at: e } : { kind: 'out', dir: 'down', at: e };
    if (!st.lv && nx.lv) return { kind: 'in', dir: 'up', at: e, label: 'LEVEL ' + nx.lv };
    if (near) return { kind: 'edge', dir: near, at: e };
    return { kind: st.lv ? 'stairs' : 'warp', dir: 'down', at: e };
  }

  function draw(t) {
    if (D.mode === 'off' || !ensureCanvas()) { clear(); return; }
    const P = window.EmuPlayer, rect = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    clear();
    if (!rect || !rect.w) return;
    const d = window.devicePixelRatio || 1, c = ctx;
    const sx = rect.w / 256 * d, sy = rect.h / 224 * d;
    const X = (x) => (rect.x * d) + x * sx, Y = (y) => (rect.y * d) + (y - 8) * sy;
    const u = Math.min(sx, sy);           // one NES pixel
    c.save();
    c.beginPath(); c.rect(rect.x * d, rect.y * d, rect.w * d, rect.h * d); c.clip();
    const r = route(), s = sample();

    if (D.mode === 'record') {
      const st = r && r.steps[r.steps.length - 1];
      if (st && s && keyOf(st) === keyOf(s)) {
        c.strokeStyle = 'rgba(248,56,0,.75)'; c.lineWidth = 2 * u; c.setLineDash([3 * u, 3 * u]);
        c.beginPath(); st.path.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); c.setLineDash([]);
        st.secrets.forEach((q) => { c.strokeStyle = '#F83800'; c.lineWidth = 2 * u; c.strokeRect(X(q.col * 16), Y(TOP + q.row * 16), 16 * sx, 16 * sy); });
      }
      const blink = Math.floor(t / 500) % 2;
      label(c, (blink ? '● ' : '  ') + 'REC  step ' + (r ? r.steps.length : 0), X(256 - 46), Y(TOP + 8), '#F83800', 7 * u);
      c.restore(); return;
    }

    // guide
    if (!r || !r.steps.length) { label(c, 'No route yet: record one first', X(128), Y(TOP + 88), '#FCFCFC', 8 * u); c.restore(); return; }
    const st = r.steps[gi], nx = r.steps[gi + 1];
    if (off) {
      label(c, 'OFF ROUTE', X(128), Y(TOP + 12), '#F8B800', 9 * u);
      label(c, 'Route continues at ' + where(st), X(128), Y(TOP + 28), '#FCFCFC', 6.5 * u);
      // which way, when it's on the same map
      if (s && s.lv === st.lv && !s.cave && !st.cave) {
        const dx = (st.room & 15) - (s.room & 15), dy = (st.room >> 4) - (s.room >> 4);
        if (dx || dy) {
          const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          const at = { right: [240, TOP + 88], left: [16, TOP + 88], up: [128, TOP + 14], down: [128, 226] }[dir];
          arrowShape(c, X(at[0]), Y(at[1]), dir, 22 * u, '#F8B800', t);
        }
      }
      c.restore(); return;
    }
    // the trail
    if (D.show.path && st.path.length > 1) {
      c.strokeStyle = 'rgba(184,248,24,.55)'; c.lineWidth = 2.5 * u; c.lineCap = 'round'; c.setLineDash([1, 5 * u]);
      c.beginPath(); st.path.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); c.setLineDash([]);
    }
    // where to go next (worked out first: its label may join a secret's)
    const lvg = D.show.arrows ? leaving(st, nx) : null;
    const onSecret = (q) => lvg && lvg.kind !== 'edge' && Math.abs(lvg.at[0] - (q.col * 16 + 8)) <= 14 && Math.abs(lvg.at[1] - (TOP + q.row * 16 + 8)) <= 18;
    // the secrets to open here
    if (D.show.secrets) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t / 300));
      st.secrets.forEach((q) => {
        const k = KIND[q.k] || KIND.secret;
        const x0 = X(q.col * 16), y0 = Y(TOP + q.row * 16), w = 16 * sx, h = 16 * sy;
        c.save(); c.globalAlpha = pulse; c.lineWidth = 2.5 * u; c.strokeStyle = '#000'; c.strokeRect(x0 - u, y0 - u, w + 2 * u, h + 2 * u);
        c.strokeStyle = k[1]; c.lineWidth = 1.6 * u; c.strokeRect(x0, y0, w, h); c.restore();
        const txt = onSecret(q) ? k[0] + ' · ' + ({ in: 'GO IN', out: 'EXIT', stairs: 'STAIRS', warp: 'WARP' }[lvg.kind] || '') : k[0];
        label(c, txt, x0 + w / 2, y0 + h + 7 * u, k[1], 6 * u);
      });
      st.bombs.forEach((p) => {
        c.save(); c.globalAlpha = 0.85; c.strokeStyle = '#F83800'; c.lineWidth = 1.6 * u;
        c.beginPath(); c.arc(X(p[0]), Y(p[1]), 7 * u, 0, Math.PI * 2); c.stroke(); c.restore();
        label(c, 'BOMB', X(p[0]), Y(p[1]) + 13 * u, '#F83800', 5.5 * u);
      });
    }
    // where to go next
    if (D.show.arrows) {
      const lv = lvg;
      if (lv) {
        const e = lv.at, z = 20 * u;
        if (lv.kind === 'edge') {
          const at = {
            right: [244, Math.min(232, Math.max(TOP + 10, e[1]))], left: [12, Math.min(232, Math.max(TOP + 10, e[1]))],
            up: [Math.min(244, Math.max(12, e[0])), TOP + 12], down: [Math.min(244, Math.max(12, e[0])), 224],
          }[lv.dir];
          arrowShape(c, X(at[0]), Y(at[1]), lv.dir, z, '#B8F818', t);
        } else {
          const txt = lv.label || { in: 'GO IN', out: 'EXIT', stairs: 'STAIRS', warp: 'WARP' }[lv.kind];
          const y = Math.max(TOP + 26, e[1] - 18);
          arrowShape(c, X(e[0]), Y(y), 'down', z * 0.8, '#B8F818', t);
          if (!(D.show.secrets && st.secrets.some(onSecret))) label(c, txt, X(e[0]), Y(y - 14), '#B8F818', 6 * u);
        }
      } else if (done || gi === r.steps.length - 1) {
        label(c, 'END OF ROUTE', X(128), Y(TOP + 88), '#B8F818', 10 * u);
      }
    }
    if (D.show.notes && st.note) label(c, st.note.slice(0, 60), X(128), Y(TOP + 10), '#FCFCFC', 6.5 * u);
    c.restore();
  }

  // ── loop ──────────────────────────────────────────────────────────────────
  let raf = 0;
  function frame(t) {
    raf = 0;
    const s = sample();
    if (D.mode === 'record' && rec) recordTick(s);
    else if (D.mode === 'guide') guideTick(s);
    draw(t);
    statusLine();
    if (D.mode !== 'off') raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && D.mode !== 'off') raf = requestAnimationFrame(frame); if (D.mode === 'off') clear(); }

  // ── the panel ─────────────────────────────────────────────────────────────
  let panel = null, btn = null;
  const CSS = `
  .z1t-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
  #z1t-btn.on { border-color: var(--link); color: var(--link); }
  #z1t-btn.rec { border-color: var(--life); color: #F83800; }
  #z1t { position: fixed; z-index: 60; right: 10px; top: 56px; width: min(360px, calc(100vw - 20px)); max-height: calc(100vh - 70px);
    display: flex; flex-direction: column; background: #000; border: 2px solid var(--frame); color: var(--white); font: 14px var(--body);
    box-shadow: 0 10px 30px rgba(0,0,0,.6); }
  #z1t[hidden] { display: none; }
  #z1t header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 2px solid var(--frame); font: 600 16px var(--px); position: static; }
  #z1t header .x { margin-left: auto; background: none; border: 0; color: var(--white); font-size: 20px; cursor: pointer; }
  #z1t .sec { padding: 8px 10px; border-bottom: 1px solid #222; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  #z1t select, #z1t input[type=text] { background: #111; color: var(--white); border: 1px solid #333; padding: 4px 6px; font: inherit; min-width: 0; }
  #z1t .sec > select { flex: 1 1 100%; }
  #z1t .btn { padding: 4px 9px; font-size: 13px; }
  #z1t .seg { display: flex; width: 100%; }
  #z1t .seg button { flex: 1; background: #111; color: var(--text-dim); border: 1px solid #333; padding: 6px; font: 600 14px var(--body); cursor: pointer; }
  #z1t .seg button.on { background: var(--frame); color: #fff; border-color: var(--frame); }
  #z1t .seg button.rec.on { background: var(--life); border-color: var(--life); }
  #z1t .status { width: 100%; font-size: 13px; color: var(--text-dim); min-height: 1.3em; }
  #z1t .status b { color: var(--white); }
  #z1t .hint { width: 100%; font-size: 12px; color: var(--text-dim); line-height: 1.35; }
  #z1t label.ck { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
  #z1t .note { flex: 1; }
  #z1t ol { list-style: none; margin: 0; padding: 4px 0; overflow: auto; flex: 1 1 auto; min-height: 60px; font-size: 13px; }
  #z1t li { display: flex; align-items: center; gap: 6px; padding: 3px 10px; cursor: pointer; }
  #z1t li:hover { background: #111; }
  #z1t li.cur { background: #0b2a66; }
  #z1t li .n { color: var(--text-dim); width: 2.6em; text-align: right; font-variant-numeric: tabular-nums; }
  #z1t li .w { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #z1t li .tag { font: 600 11px var(--px); padding: 0 4px; border: 1px solid; }
  #z1t li .del { background: none; border: 0; color: var(--text-dim); cursor: pointer; font-size: 15px; padding: 0 2px; }
  #z1t li .del:hover { color: #F83800; }
  `;
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
      else if (k === 'class') e.className = v; else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v);
    });
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  }
  function toast(m) { if (window.EmuPlayer && EmuPlayer.toast) EmuPlayer.toast(m); else console.log('[training]', m); }

  function build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    btn = el('button', { class: 'btn', id: 'z1t-btn', type: 'button', title: 'Z1R Training: record a route, then follow it with arrows over the game',
      on: { click: () => { panel.hidden = !panel.hidden; renderPanel(); } } }, '🎯 Training');
    const spacer = document.querySelector('header .spacer');
    if (spacer) spacer.before(btn); else document.querySelector('header').append(btn);
    panel = el('div', { id: 'z1t', hidden: true });
    document.body.append(panel);
    renderPanel();
  }

  function setMode(m) {
    if (m === D.mode) return;
    if (D.mode === 'record') finishRecording();
    if (m === 'record') {
      const r = route();
      if (r && !editable()) { if (!confirm('“' + r.name + '” is built in. Record a new route instead?')) return; D.current = null; }
      else if (r && r.steps.length && !confirm('Add to “' + r.name + '” from here? (Cancel and press New for a fresh route.)')) return;
      startRecording();
    } else if (m === 'guide') startGuide();
    else { D.mode = 'off'; save(); }
    renderPanel(); run();
  }
  function finishRecording() {
    const r = route(), s = sample();
    if (r && editable() && rec && rec.last) { const st = r.steps[r.steps.length - 1]; if (st && !st.exit) st.exit = rec.last; }
    rec = null; D.mode = 'off'; save();
  }
  // Deleting a step joins the steps around it when they're the same place.
  function deleteStep(i) {
    const r = route(); if (!r || !editable()) return;
    r.steps.splice(i, 1);
    const a = r.steps[i - 1], b = r.steps[i];
    if (a && b && keyOf(a) === keyOf(b)) {
      a.path = a.path.concat(b.path).slice(0, PATH_MAX); a.secrets = a.secrets.concat(b.secrets); a.bombs = a.bombs.concat(b.bombs);
      a.exit = b.exit; a.note = [a.note, b.note].filter(Boolean).join(' · ');
      r.steps.splice(i, 1);
    }
    if (gi >= r.steps.length) gi = Math.max(0, r.steps.length - 1);
    save(); renderPanel();
  }
  function exportRoute() {
    const r = route(); if (!r) return;
    const out = { format: FORMAT, version: 1, name: r.name, exported: new Date().toISOString(), steps: r.steps };
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (r.name.replace(/[^\w\- ]+/g, '').trim() || 'route') + '.z1route.json' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function parseRoute(j) {
    if (!j || j.format !== FORMAT || !Array.isArray(j.steps)) throw new Error('not a Z1R Training route file');
    const steps = j.steps.filter((s) => s && Number.isInteger(s.lv) && Number.isInteger(s.room)).map((s) => ({
      lv: s.lv, room: s.room, cave: s.cave ? 1 : 0, path: Array.isArray(s.path) ? s.path.slice(0, PATH_MAX) : [],
      exit: Array.isArray(s.exit) ? s.exit : null, secrets: Array.isArray(s.secrets) ? s.secrets : [],
      bombs: Array.isArray(s.bombs) ? s.bombs : [], note: typeof s.note === 'string' ? s.note.slice(0, 200) : '' }));
    return { name: String(j.name || 'Imported route').slice(0, 80), steps };
  }
  function importRoute() {
    const inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const r = parseRoute(JSON.parse(await f.text()));
        const id = newId();
        D.routes[id] = { id, name: r.name, created: Date.now(), steps: r.steps };
        D.current = id; save(); renderPanel();
        toast('Imported “' + r.name + '” (' + r.steps.length + ' steps)');
      } catch (e) { alert('Couldn’t import that file: ' + e.message); }
    });
    inp.click();
  }

  let lastStatus = '';
  function statusText() {
    const r = route(), s = sample();
    if (!s) return 'Start the game (a Zelda 1 ROM, the normal game or a seed) to use the route.';
    if (D.mode === 'record') return '<b>Recording</b> · step ' + (r ? r.steps.length : 0) + ' · you’re at ' + where(s);
    if (D.mode === 'guide') {
      if (!r || !r.steps.length) return 'This route has no steps yet.';
      if (off) return '<b>Off route</b> · it continues at ' + where(r.steps[gi]);
      return '<b>Step ' + (gi + 1) + ' of ' + r.steps.length + '</b> · ' + where(r.steps[gi]) + (r.steps[gi + 1] ? ' → ' + where(r.steps[gi + 1]) : ' · end');
    }
    return 'Off. Pick Guide to follow the route, or Record to make one.';
  }
  function statusLine() {
    if (!panel || panel.hidden) return;
    const t = statusText();
    if (t !== lastStatus) { lastStatus = t; const e = panel.querySelector('.status'); if (e) e.innerHTML = t; }
    const ul = panel.querySelector('ol');
    if (ul && D.mode === 'guide') {
      const cur = ul.querySelector('li.cur'), want = ul.children[gi];
      if (want && cur !== want) { if (cur) cur.classList.remove('cur'); want.classList.add('cur'); want.scrollIntoView({ block: 'nearest' }); }
    }
  }

  function renderPanel() {
    if (!panel) return;
    if (btn) { btn.classList.toggle('on', D.mode === 'guide'); btn.classList.toggle('rec', D.mode === 'record'); }
    if (panel.hidden) return;
    const r = route();
    const opts = [el('option', { value: '' }, r ? '' : 'No route chosen')].filter(() => !r);
    const mine = Object.values(D.routes).sort((a, b) => b.created - a.created);
    const groups = [];
    if (mine.length) groups.push(el('optgroup', { label: 'Your routes' }, mine.map((x) => el('option', { value: x.id, selected: x.id === D.current }, x.name + ' (' + x.steps.length + ')'))));
    const bi = Object.values(builtIn);
    if (bi.length) groups.push(el('optgroup', { label: 'Built in' }, bi.map((x) => el('option', { value: x.id, selected: x.id === D.current }, x.name))));
    const sel = el('select', { title: 'Route', on: { change: () => { if (D.mode === 'record') finishRecording(); D.current = sel.value || null; gi = 0; off = false; if (D.mode === 'guide') startGuide(); save(); renderPanel(); run(); } } }, opts, groups);
    const seg = el('div', { class: 'seg' },
      [['off', 'Off'], ['guide', '▶ Guide'], ['record', '● Record']].map(([m, t]) =>
        el('button', { type: 'button', class: (m === 'record' ? 'rec ' : '') + (D.mode === m ? 'on' : ''), on: { click: () => setMode(m) } }, t)));
    const B = (t, title, fn, dis) => el('button', { class: 'btn', type: 'button', title, disabled: !!dis, on: { click: fn } }, t);
    const manage = el('div', { class: 'sec' },
      sel,
      B('New', 'Start a new, empty route', () => {
        const name = prompt('Name for the new route:', 'Any% route'); if (name === null) return;
        if (D.mode === 'record') finishRecording();
        const id = newId(); D.routes[id] = { id, name: name.trim() || 'Route', created: Date.now(), steps: [] }; D.current = id; save(); renderPanel();
      }),
      B('Rename', 'Rename this route', () => { const x = route(); const n = prompt('Route name:', x.name); if (n) { x.name = n.trim().slice(0, 80); save(); renderPanel(); } }, !editable()),
      B('Delete', 'Delete this route', () => {
        const x = route(); if (!confirm('Delete “' + x.name + '” (' + x.steps.length + ' steps)? Export it first if you want a copy.')) return;
        if (D.mode !== 'off') { if (D.mode === 'record') finishRecording(); D.mode = 'off'; }
        delete D.routes[x.id]; D.current = null; save(); renderPanel(); run();
      }, !editable()),
      B('Import…', 'Load a route file (.json) someone exported', importRoute),
      B('Export', 'Save this route as a file to share', exportRoute, !r));
    const modeSec = el('div', { class: 'sec' }, seg, el('div', { class: 'status' }, ''));
    if (D.mode === 'record') {
      modeSec.append(el('div', { class: 'hint' }, 'Play the route once. Each screen, cave and dungeon room becomes a step with the path you walk, where you leave, secrets you open and bombs you drop. Took a wrong turn? Delete those steps below (the steps either side join up). Press Off when you’re done.'));
      const last = r && r.steps[r.steps.length - 1];
      const note = el('input', { type: 'text', class: 'note', placeholder: 'Note for this screen (shown over the game)', value: last ? last.note : '', maxLength: 60,
        on: { input: () => { const x = route() && route().steps[route().steps.length - 1]; if (x) { x.note = note.value; save(); } } } });
      modeSec.append(note);
    } else if (D.mode === 'guide') {
      modeSec.append(
        B('◀ Step', 'Back one step', () => { gi = Math.max(0, gi - 1); off = false; renderPanel(); }),
        B('Step ▶', 'Skip ahead one step', () => { const x = route(); gi = Math.min((x ? x.steps.length : 1) - 1, gi + 1); off = false; renderPanel(); }),
        B('Restart', 'Back to the start of the route', () => { gi = 0; off = false; renderPanel(); }));
    } else if (!r) {
      modeSec.append(el('div', { class: 'hint' }, 'Record a route by playing it once (for example along with a speedrun video), then Guide shows it over the game: an arrow to the next screen, the bush, wall, rock or armos to burn, bomb, push or touch, where to bomb, and the path to walk.'));
    }
    const shows = el('div', { class: 'sec' }, [['arrows', 'Arrows'], ['secrets', 'Secrets & bombs'], ['path', 'Path'], ['notes', 'Notes']].map(([k, t]) =>
      el('label', { class: 'ck' }, el('input', { type: 'checkbox', checked: !!D.show[k], on: { change: (e) => { D.show[k] = e.target.checked; save(); } } }), t)));
    const list = el('ol', {}, (r ? r.steps : []).map((s, i) => {
      const nx = r.steps[i + 1], lv = nx && leaving(s, nx);
      const tags = s.secrets.map((q) => { const k = KIND[q.k] || KIND.secret; return el('span', { class: 'tag', style: 'color:' + k[1] }, k[0]); });
      if (s.bombs.length) tags.push(el('span', { class: 'tag', style: 'color:#F83800' }, s.bombs.length > 1 ? 'BOMB×' + s.bombs.length : 'BOMB'));
      return el('li', { class: D.mode === 'guide' && i === gi ? 'cur' : '', title: s.note || '',
        on: { click: (e) => { if (e.target.closest('.del')) return; if (D.mode !== 'guide') setMode('guide'); gi = i; off = false; renderPanel(); } } },
        el('span', { class: 'n' }, String(i + 1)),
        el('span', { class: 'w' }, where(s) + (lv ? ' ' + ({ edge: { up: '↑', down: '↓', left: '←', right: '→' }[lv.dir], in: '⤓', out: '⤒', stairs: '⇣', warp: '♪' }[lv.kind] || '') : '') + (s.note ? ' · ' + s.note : '')),
        tags,
        editable() ? el('button', { class: 'del', type: 'button', title: 'Delete this step', on: { click: () => deleteStep(i) } }, '×') : null);
    }));
    panel.replaceChildren(
      el('header', {}, '🎯 Z1R Training', el('button', { class: 'x', type: 'button', 'aria-label': 'Close', on: { click: () => { panel.hidden = true; } } }, '×')),
      manage, modeSec, shows, list);
    lastStatus = ''; statusLine();
  }

  // Routes everyone gets: training/routes.json → [{ file, name }]
  fetch('training/routes.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then(async (list) => {
    for (const it of Array.isArray(list) ? list : []) {
      try {
        const j = await (await fetch('training/' + it.file, { cache: 'no-cache' })).json();
        const p = parseRoute(j), id = 'b:' + it.file;
        builtIn[id] = { id, name: it.name || p.name, steps: p.steps, builtIn: true };
      } catch (e) { console.warn('[training] route', it.file, e); }
    }
    if (D.current && !route()) D.current = null;
    renderPanel(); run();
  }).catch(() => {});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); run(); });
  else { build(); run(); }

  window.Z1Training = {
    get mode() { return D.mode; }, setMode, get step() { return gi; }, get off() { return off; },
    route, _D: () => D, _leaving: leaving, _parse: parseRoute,
  };
})();
