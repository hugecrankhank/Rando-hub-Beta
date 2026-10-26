/*
 * tracker.js — the GLR tracker: items, keys, corridors, the labyrinth map
 * (drawn from the ROM by js/labmap.js) and a pickup log.
 *
 * Autotracking reads the NES's 2 KB of RAM (js/nes-bridge.js):
 *   $52/$53 screen X/Y, $30 bit 6 = flying a corridor
 *   $47/$48 max/current health, $4C/$4D chips (max $4E/$4F)
 *   $4A attack, $4B defense, $6B shield, $46 Red Landers
 *   $04A0-$04A8 item and mini-boss flags, $04A9-$04AA corridors cleared
 *   $04AC-$04AE sub-weapon levels (2 bits each), $04AF Enemy Eraser ammo,
 *   $04B0 keys
 * What an item room or mini-boss holds is read from the ROM you're playing,
 * but only shown once its flag is set (you picked it up): no spoilers.
 *
 * Without a game everything can be set by hand: tap an item to cycle it,
 * tap a key or corridor to toggle it. A hand-set value stays until the
 * game's own value for it changes.
 */
(function () {
  'use strict';
  const T = window.TGL;
  const $el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  let root = null, sessionId = 'manual', sessionLabel = '', rom = null, map = null;
  let linkFn = null, linkState = 'idle';
  let S = null;          // persisted state for this ROM
  let live = null;       // last values read from RAM
  let view = 'map';
  let mapCanvas = null, overlay = null, cells = [];

  // ── persisted state ───────────────────────────────────────────────────────
  function blank() {
    return {
      seen: [], log: [], manual: {},               // manual: { key: value }
      lastLive: {},                                // last live value per field (for hand-set overrides)
      flags: new Array(9).fill(0), cleared: 0, keys: 0,
      w: [0, 0, 0], ee: 0, stats: {},
    };
  }
  const storeKey = () => 'glr:trk:' + sessionId;
  function load() {
    try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(storeKey())) || {}); } catch (e) { S = blank(); }
  }
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(storeKey(), JSON.stringify(S)); } catch (e) {} }, 400);
  }

  // ── values (live or hand-set) ─────────────────────────────────────────────
  // Hand-set values: 'w0'..'w10' (level 0-3), 'k1'..'k7', 'c1'..'c21', 'ee', 'bl', 'rl', 'at', 'df', 'sh'
  function liveVal(k) {
    if (!live) return null;
    if (k[0] === 'w') { const i = +k.slice(1); return (live.w[i >> 2] >> ((i & 3) * 2)) & 3; }
    if (k[0] === 'k') return (live.keys >> (+k.slice(1) - 1)) & 1;
    if (k[0] === 'c') { const c = +k.slice(1); return c <= 16 ? (live.cleared >> (c - 1)) & 1 : 0; }
    if (k === 'ee') return live.ee;
    if (k === 'bl') return Math.max(0, (live.hpMax >> 3) - 8);
    if (k === 'rl') return live.redLanders;
    if (k === 'at') return live.attack;
    if (k === 'df') return live.defense;
    if (k === 'sh') return live.shield;
    return null;
  }
  function val(k) {
    if (k in S.manual) return S.manual[k];
    const v = liveVal(k);
    if (v != null) return v;
    if (k[0] === 'w') { const i = +k.slice(1); return (S.w[i >> 2] >> ((i & 3) * 2)) & 3; }
    if (k[0] === 'k') return (S.keys >> (+k.slice(1) - 1)) & 1;
    if (k[0] === 'c') { const c = +k.slice(1); return (S.cleared >> (c - 1)) & 1; }
    return S.stats[k] || 0;
  }
  const keySet = () => { const s = new Set(); for (let k = 1; k <= 7; k++) if (val('k' + k)) s.add(k); return s; };
  const flagSet = (i) => !!((S.flags[i >> 3] >> (i & 7)) & 1);

  // ── reading RAM ───────────────────────────────────────────────────────────
  function readRam(r) {
    const inGame = r[0x47] > 0 && r[0x52] < 24 && r[0x53] < 24;
    if (!inGame) return null;
    return {
      x: r[0x52], y: r[0x53], area: r[0x50] & 0x0F, corridor: !!(r[0x30] & 0x40),
      hp: r[0x48], hpMax: r[0x47], chips: r[0x4C] | (r[0x4D] << 8), chipMax: r[0x4E] | (r[0x4F] << 8),
      attack: r[0x4A], defense: r[0x4B], shield: r[0x6B], redLanders: r[0x46],
      flags: Array.from(r.subarray(0x4A0, 0x4A9)), cleared: r[0x4A9] | (r[0x4AA] << 8),
      w: [r[0x4AC], r[0x4AD], r[0x4AE] & 0x3F], ee: (r[0x4AE] & 0x40) ? r[0x4AF] : 0, keys: r[0x4B0] & 0x7F,
      score: Array.from(r.subarray(0x170, 0x176)).map((d) => d & 15).join('').replace(/^0+(?=\d)/, '') + '0',
    };
  }

  function poll() {
    const r = window.NesBridge && NesBridge.ram();
    const prev = live;
    live = r ? readRam(r) : null;
    setLink(r ? (live ? 'live' : 'waiting') : 'idle');
    if (!live) { if (prev) render(); return; }
    let changed = !prev || prev.x !== live.x || prev.y !== live.y || prev.corridor !== live.corridor;
    // Hand-set values give way once the game's own value changes.
    for (const k of Object.keys(S.manual)) {
      const v = liveVal(k);
      if (v != null && S.lastLive[k] != null && v !== S.lastLive[k]) { delete S.manual[k]; changed = true; }
    }
    for (const k of ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'ee', 'bl', 'rl', 'at', 'df', 'sh']) S.lastLive[k] = liveVal(k);
    for (let c = 1; c <= 21; c++) S.lastLive['c' + c] = liveVal('c' + c);
    // Walked screens
    if (!live.corridor) {
      const i = live.y * 24 + live.x;
      if (!S.seen[i]) { S.seen[i] = 1; changed = true; }
    }
    // New pickups: item / mini-boss flags
    for (let b = 0; b < 72; b++) {
      const now = (live.flags[b >> 3] >> (b & 7)) & 1, was = (S.flags[b >> 3] >> (b & 7)) & 1;
      if (now && !was) { logFlag(b); changed = true; }
    }
    // Corridors cleared, keys gained
    for (let c = 1; c <= 16; c++) {
      if (((live.cleared >> (c - 1)) & 1) && !((S.cleared >> (c - 1)) & 1)) { addLog('Cleared corridor ' + c, 'corridor', c); changed = true; }
    }
    for (let k = 1; k <= 7; k++) {
      if (((live.keys >> (k - 1)) & 1) && !((S.keys >> (k - 1)) & 1)) { addLog(T.KEYS[k - 1] + ' key', 'key' + k, live.corridor ? 'corridor' : ''); changed = true; }
    }
    if (JSON.stringify(live.w) !== JSON.stringify(S.w) || live.ee !== S.ee) changed = true;
    S.flags = live.flags; S.cleared = live.cleared; S.keys = live.keys; S.w = live.w; S.ee = live.ee;
    if (changed) { save(); render(); } else renderStats();
  }

  function logFlag(b) {
    if (!map) return;
    const r = map.rooms.find((q) => (q.type === 'item' || q.type === 'boss') && q.flag === b);
    if (!r) return;
    const kind = rom[T.AT.itemKind + b];
    addLog(T.KINDS[kind] || 'Item', GLRIcons.KIND_ART[kind], (r.type === 'boss' ? 'mini-boss ' : '') + r.x + ',' + r.y, kind);
  }
  function addLog(text, icon, where, kind) {
    S.log.push({ t: Date.now(), text, icon, where: where || '', kind });
    if (S.log.length > 300) S.log.shift();
  }

  function setLink(s) {
    if (s === linkState) return;
    linkState = s;
    if (linkFn) linkFn(s);
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  function build() {
    root.innerHTML = '';
    root.append($el('div', 't-stats', ''));
    const items = $el('div', 'itemsp');
    items.append($el('div', 't-items g-items'), $el('div', 'g-keys'), $el('div', 'g-corr'));
    root.append(items);
    const tabs = $el('div', 't-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [id, label] of [['items', 'Items'], ['map', 'Map'], ['log', 'Log']]) {
      const b = $el('button', 'tab-' + id, label);
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.v = id;
      b.addEventListener('click', () => { view = id; render(); });
      tabs.append(b);
    }
    root.append(tabs);
    const mapv = $el('div', 't-view ow');
    const mapWrap = $el('div', 'lab-map');
    mapCanvas = $el('canvas', 'lab-canvas');
    overlay = $el('div', 'lab-grid');
    cells = [];
    for (let i = 0; i < 576; i++) {
      const c = $el('button', 'lab-cell');
      c.type = 'button';
      c.dataset.i = i;
      c.addEventListener('click', () => openRoom(i % 24, (i / 24) | 0, c));
      overlay.append(c); cells.push(c);
    }
    mapWrap.append(mapCanvas, overlay);
    mapv.append(mapWrap, $el('div', 'ow-bar'), $el('p', 'hint', 'Tap a screen for a close-up. Dots: green = you can reach it now, red = needs a key. A check mark = done.'));
    const logv = $el('div', 't-view log');
    root.append(mapv, logv);
    const foot = $el('div', 't-foot');
    const reset = $el('button', 'linkish', 'Reset tracker');
    reset.type = 'button';
    reset.addEventListener('click', () => { if (confirm('Clear everything tracked for this game?')) { S = blank(); save(); render(); } });
    foot.append($el('span', 'sess', ''), reset);
    root.append(foot);
    fit();
    render();
  }

  function renderStats() {
    const st = root.querySelector('.t-stats');
    if (!st) return;
    const L = live;
    const pos = L ? (L.corridor ? 'In a corridor' : 'X' + L.x + ' Y' + L.y + ' · Area ' + L.area) : 'Not in game';
    st.innerHTML = L
      ? '<span class="stat hp">HP ' + L.hp + '/' + L.hpMax + '</span><span class="stat">Chips ' + L.chips + '/' + L.chipMax +
        '</span><span class="stat">Score ' + L.score + '</span><span class="stat pos">' + pos + '</span>'
      : '<span class="stat pos">' + pos + '</span>';
  }

  function itemCell(key, art, title, max, badge) {
    const v = val(key);
    const b = $el('button', 'item' + (v ? ' have' : '') + (key in S.manual ? ' manual' : ''));
    b.type = 'button'; b.title = title;
    b.innerHTML = '<span class="ico">' + GLRIcons.svg(art) + '</span>' + (badge != null ? badge(v) : '');
    b.addEventListener('click', () => { S.manual[key] = (v + 1) % (max + 1); save(); render(); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); S.manual[key] = (v + max) % (max + 1); save(); render(); });
    return b;
  }

  function renderItems() {
    const g = root.querySelector('.g-items');
    g.innerHTML = '';
    for (let i = 0; i <= 10; i++) g.append(itemCell('w' + i, 'w' + i, T.WEAPONS[i], 3, (v) => (v ? '<span class="badge">L' + v + '</span>' : '')));
    g.append(itemCell('ee', 'ee', 'Enemy Eraser (ammo)', 255, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));
    g.append(itemCell('bl', 'bl', 'Blue Landers (max health)', 20, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));
    g.append(itemCell('rl', 'rl', 'Red Landers (chip max)', 10, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));
    g.append(itemCell('at', 'at', 'Attack', 8, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));
    g.append(itemCell('df', 'df', 'Defense', 8, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));
    g.append(itemCell('sh', 'sh', 'Shield', 5, (v) => (v ? '<span class="badge">' + v + '</span>' : '')));

    const k = root.querySelector('.g-keys');
    k.innerHTML = '<span class="g-lbl">Keys</span>';
    for (let i = 1; i <= 7; i++) {
      const c = itemCell('k' + i, 'key' + i, T.KEYS[i - 1] + ' key', 1);
      c.classList.add('key');
      k.append(c);
    }
    renderCorridors();
  }

  function corridorInfo(c) {
    if (!map) return null;
    const r = map.rooms.find((q) => q.type === 'corridor' && q.corridor === c);
    return r;
  }
  function renderCorridors() {
    const g = root.querySelector('.g-corr');
    g.innerHTML = '<span class="g-lbl">Corridors</span>';
    const reach = map ? T.reachable(map.rooms, map.edges, keySet()) : null;
    for (let c = 1; c <= 21; c++) {
      const done = val('c' + c);
      const r = corridorInfo(c);
      const open = r && reach && reach.has(r) && (c !== 21 || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((p) => val('c' + p)));
      const b = $el('button', 'corr' + (done ? ' done' : open ? ' open' : ' locked') + (c <= 10 ? ' primary' : '') + ('c' + c in S.manual ? ' manual' : ''));
      b.type = 'button';
      let reward = '';
      if (done && c <= 10 && rom) { const k = rom[T.AT.keyTable + c]; if (k) reward = '<span class="rw">' + GLRIcons.svg('key' + k) + '</span>'; }
      const need = r && r.key ? '<span class="nd">' + GLRIcons.svg('key' + r.key) + '</span>' : '';
      b.innerHTML = '<b>' + c + '</b>' + (done ? reward : need);
      b.title = 'Corridor ' + c + (r ? ' at X' + r.x + ' Y' + r.y : '') + (r && r.key ? ', needs the ' + T.KEYS[r.key - 1] + ' key' : '') +
        (T.UNLOCK[c] ? '. Opens: ' + T.UNLOCK[c] : c === 21 ? '. Opens once corridors 1-10 are cleared' : '');
      b.addEventListener('click', () => {
        if (map && r && !done && view === 'map') { openRoom(r.x, r.y, cells[r.y * 24 + r.x]); return; }
        S.manual['c' + c] = done ? 0 : 1; save(); render();
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); S.manual['c' + c] = done ? 0 : 1; save(); render(); });
      g.append(b);
    }
  }

  function renderMap() {
    const bar = root.querySelector('.ow-bar');
    if (!map) {
      mapCanvas.width = 24; mapCanvas.height = 24;
      bar.textContent = 'Start a game to draw the labyrinth from its ROM.';
      cells.forEach((c) => { c.className = 'lab-cell'; c.innerHTML = ''; });
      return;
    }
    const reach = T.reachable(map.rooms, map.edges, keySet());
    let found = 0, total = 0;
    for (let i = 0; i < 576; i++) {
      const r = map.rooms[i], c = cells[i];
      let cls = 'lab-cell' + (r.empty ? ' void' : '') + (S.seen[i] ? ' seen' : '');
      let inner = '';
      if (!r.empty) {
        if (r.type === 'item' || r.type === 'boss') {
          total++;
          const got = flagSet(r.flag);
          if (got) found++;
          inner = '<i class="chk ' + (got ? 'done' : 'todo ' + (reach.has(r) ? 'go' : 'no')) + '"></i>';
          if (r.type === 'boss') inner += '<i class="mk boss"></i>';
        } else if (r.type === 'corridor') {
          const done = val('c' + r.corridor);
          inner = '<b class="cn' + (done ? ' done' : '') + '">' + r.corridor + '</b>';
        } else if (r.type === 'save') inner = '<i class="mk save"></i>';
        else if (r.type === 'shop') inner = '<i class="mk shop"></i>';
      }
      if (live && !live.corridor && live.x === i % 24 && live.y === ((i / 24) | 0)) cls += ' here';
      if (c.className !== cls) c.className = cls;
      if (c.innerHTML !== inner) c.innerHTML = inner;
    }
    bar.textContent = 'Items found ' + found + ' / ' + total + '   ·   Keys ' + keySet().size + ' / 7';
  }

  function renderLog() {
    const lv = root.querySelector('.log');
    if (!S.log.length) { lv.innerHTML = '<p class="empty">Pickups show up here as you play.</p>'; return; }
    const ul = $el('ul', 'log-list');
    for (const e of S.log.slice().reverse()) {
      const li = $el('li');
      li.innerHTML = '<span class="ico">' + (e.icon ? GLRIcons.svg(e.icon) : '') + '</span><span>' + e.text + '</span><span class="where">' + e.where + '</span>';
      ul.append(li);
    }
    lv.innerHTML = ''; lv.append(ul);
  }

  function render() {
    if (!root || !S) return;
    root.dataset.view = view;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.v === view ? 'true' : 'false'));
    renderStats(); renderItems(); renderMap(); renderLog();
    const foot = root.querySelector('.sess');
    if (foot) foot.textContent = sessionLabel;
  }

  // ── room close-up ─────────────────────────────────────────────────────────
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function openRoom(x, y, anchor) {
    closePop();
    if (!map) return;
    const r = map.room(x, y);
    if (r.empty) return;
    pop = $el('div', 'picker');
    const head = $el('div', 'pk-head', describe(r));
    const cv = $el('canvas', 'pk-zoom');
    map.drawRoom(cv, x, y, 12, { keyIcon });
    pop.append(head, cv);
    const info = $el('p', 'msg', roomDetail(r));
    pop.append(info);
    if (r.type === 'corridor') {
      const b = $el('button', 'pk-clear', val('c' + r.corridor) ? 'Mark not cleared' : 'Mark cleared');
      b.type = 'button';
      b.addEventListener('click', () => { S.manual['c' + r.corridor] = val('c' + r.corridor) ? 0 : 1; save(); closePop(); render(); });
      pop.append(b);
    }
    const close = $el('button', 'pk-done', 'Close');
    close.type = 'button';
    close.addEventListener('click', closePop);
    pop.append(close);
    document.body.append(pop);
    const a = anchor.getBoundingClientRect(), p = pop.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - p.width - 8, a.left + a.width / 2 - p.width / 2));
    const top = a.bottom + 8 + p.height < window.innerHeight ? a.bottom + 8 : Math.max(8, a.top - p.height - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function describe(r) {
    const where = 'X' + r.x + ' Y' + r.y;
    switch (r.type) {
      case 'corridor': return 'Corridor ' + r.corridor + ' · ' + where;
      case 'save': return 'Blue Lander (save) · ' + where;
      case 'shop': return 'Shop · ' + where;
      case 'message': return 'Message · ' + where;
      case 'item': return 'Item room · Area ' + r.area + ' · ' + where;
      case 'boss': return 'Mini-boss · Area ' + r.area + ' · ' + where;
      case 'maze': return 'Pyramid maze · Area ' + r.area + ' · ' + where;
      default: return 'Area ' + r.area + ' · ' + where;
    }
  }
  function roomDetail(r) {
    const reach = T.reachable(map.rooms, map.edges, keySet());
    const DIR = { U: 'up', L: 'left', R: 'right', D: 'down' };
    const locks = (map.edges.get(r) || []).filter((e) => e.key).map((e) => DIR[e.dir] + ': ' + T.KEYS[e.key - 1]);
    const need = (r.inner && r.key ? 'The way in needs the ' + T.KEYS[r.key - 1] + ' key. ' : '') +
      (locks.length ? 'Locked doors out (' + locks.join(', ') + '). ' : '');
    const status = reach.has(r) ? 'You can reach it now.' : 'Not reachable with your keys yet.';
    if (r.type === 'item' || r.type === 'boss') {
      if (flagSet(r.flag)) return 'Got: ' + (T.KINDS[rom[T.AT.itemKind + r.flag]] || '?') + '.';
      return (r.type === 'boss' ? 'Defeat the mini-boss for its item. ' : 'Shoot the pyramids around the item. ') + status;
    }
    if (r.type === 'corridor') {
      const c = r.corridor;
      let s = need + (T.UNLOCK[c] ? 'Opens: ' + T.UNLOCK[c].toLowerCase() + '. ' : c === 21 ? 'Opens once corridors 1-10 are cleared. ' : 'Always open. ');
      if (val('c' + c) && c <= 10 && rom) { const k = rom[T.AT.keyTable + c]; s += k ? 'Gave the ' + T.KEYS[k - 1] + ' key.' : 'No key here.'; }
      return s + (val('c' + c) ? '' : ' ' + status);
    }
    return need + status;
  }
  document.addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('.lab-cell, .corr'))) closePop(); });

  // ── sizing ────────────────────────────────────────────────────────────────
  const COMPACT_Q = window.matchMedia('(max-width: 900px) and (orientation: portrait), (orientation: landscape) and (max-height: 560px)');
  function fit() {
    if (!root) return;
    root.classList.toggle('compact', COMPACT_Q.matches);
    const cs = getComputedStyle(root);
    const w = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
    const item = Math.max(30, Math.min(48, Math.floor((w - 40) / 9)));
    root.style.setProperty('--item', item + 'px');
    const wrap = root.querySelector('.lab-map');
    if (wrap) {
      // 24x16 by 24x12 metatiles: 4:3
      let mw = Math.min(w, 640);
      if (root.classList.contains('compact')) {
        const avail = root.clientHeight - (root.querySelector('.t-tabs').offsetHeight + root.querySelector('.ow-bar').offsetHeight + 24);
        mw = Math.max(160, Math.min(mw, avail * 4 / 3));
      }
      wrap.style.width = mw + 'px'; wrap.style.height = (mw * 3 / 4) + 'px';
    }
  }
  window.addEventListener('resize', fit);
  if (COMPACT_Q.addEventListener) COMPACT_Q.addEventListener('change', fit);

  // Key-symbol images for the map canvas (loaded once).
  const keyImg = {};
  function keyIcons() {
    return Promise.all([1, 2, 3, 4, 5, 6, 7].map((k) => new Promise((res) => {
      const im = GLRIcons.image('key' + k);
      keyImg[k] = im;
      if (im.complete && im.naturalWidth) res(); else { im.onload = res; im.onerror = res; }
    })));
  }
  const keyIcon = (k) => (keyImg[k] && keyImg[k].naturalWidth ? keyImg[k] : null);

  // ── public ────────────────────────────────────────────────────────────────
  window.GLRTracker = {
    init(el) { root = el; load(); build(); setInterval(poll, 250); },
    setSession(id, label) { sessionId = id; sessionLabel = label || ''; load(); render(); },
    setRom(bytes) {
      rom = bytes;
      try { map = LabMap.read(bytes); } catch (e) { console.warn('[tracker] not a Guardian Legend ROM?', e); map = null; render(); return; }
      const bar = root && root.querySelector('.ow-bar');
      map.build((p) => { if (bar) bar.textContent = 'Drawing the labyrinth from the ROM… ' + Math.round(p * 100) + '%'; })
        .then(keyIcons).then(() => { map.drawMap(mapCanvas, 2, { keyIcon }); render(); fit(); });
    },
    onLink(fn) { linkFn = fn; fn(linkState); },
    get mapInfo() { return map ? map.built + ' screens drawn' : 'no map'; },
    _state: () => ({ S, live }),
  };
})();
