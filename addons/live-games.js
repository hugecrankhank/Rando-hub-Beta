/*
 * Live games: the GT big key game and the Digging Game (HydeOut).
 *
 * With Crowd Control+ connected (⋯ → Crowd effects), this panel runs ITS
 * rounds: viewers guess in TikTok chat (!gt 9, !dig 15), the guesses arrive
 * here as they come, and Start / Close / New round drive the bridge
 * (crowd/effects.js RandoCrowd; the bridge sends 'livegame' messages). The
 * result also goes on Crowd Control+'s alerts and overlays.
 *
 * Without it, the same games run right here, and the guesses still come from
 * chat: the page listens to TikFinity's Events API itself (ws://localhost:21213,
 * the free TikFinity app on the same PC; chat lines like "!gt 9"). Or type
 * them in by hand (Discord, the couch).
 *
 *   GT big key   which Ganon's Tower chest has the big key? (1-22: the places
 *                it can be, as the counters and Crowd Control+ count them)
 *   Digging Game which dig gives the prize? (1-30)
 *
 * Open a round, type in the guesses (from chat, Discord, the couch: a name
 * and a number each, or just your own), and play. Guesses close by
 * themselves at the first GT chest / the first dig. The game counts the
 * chests and digs (addons/hub-items.js reads them: window.RandoKeys.stats);
 * when the big key or the prize turns up, the result shows over the game:
 * exact guesses win, otherwise the closest.
 *
 * Opened by its buttons by the maps (Mudora's map bar, through
 * window.RandoLiveGames.open) and in the Desktop layout's window bar.
 * A round is kept per seed, so a reload keeps the guesses.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rhb-live-games';
  var GAMES = {
    gt: { name: 'GT big key', icon: '🗝', max: 22, what: 'chest', counted: 'GT chests opened',
      q: 'Which Ganon’s Tower chest has the big key?', unit: 'Chest' },
    dig: { name: 'Digging Game', icon: '⛏', max: 30, what: 'dig', counted: 'Digs',
      q: 'Which dig gives the Digging Game’s prize?', unit: 'Dig' },
  };
  var tab = 'gt', panel = null, banner = null;

  // ── state, kept per seed ───────────────────────────────────────────────────
  function seed() { var P = window.Snes9xPlayer; return (P && P.gameName) || window.EJS_gameName || ''; }
  var S = { seed: '', gt: null, dig: null };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.seed === seed()) S = s; else S = { seed: seed(), gt: null, dig: null }; }
    catch (e) { S = { seed: seed(), gt: null, dig: null }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function live(g) {
    var st = window.RandoKeys && window.RandoKeys.stats;
    var x = st && st[g];
    if (!x) return null;
    return g === 'gt' ? { count: x.chests, found: x.found, at: x.at } : { count: x.digs, found: x.found, at: x.at };
  }
  // A round: { open, guesses: [{ who, n }], count0, result: { at, winners, off } | null, startedFound }
  function newRound(g) {
    var L = live(g);
    S[g] = { open: true, guesses: [], count0: L ? L.count : 0, result: null, startedFound: !!(L && L.found) };
    save();
  }
  function score(g, at) {
    var R = S[g];
    if (!R || !R.guesses.length) return { at: at, winners: [], off: null };
    var best = Infinity;
    R.guesses.forEach(function (x) { best = Math.min(best, Math.abs(x.n - at)); });
    return { at: at, winners: R.guesses.filter(function (x) { return Math.abs(x.n - at) === best; }).map(function (x) { return x.who; }), off: best };
  }
  function resultText(g, r) {
    var G = GAMES[g];
    var head = g === 'gt' ? 'Big key in chest #' + r.at : 'Prize on dig #' + r.at;
    if (!r.winners.length) return { head: head, sub: 'nobody guessed' };
    var names = r.winners.slice(0, 5).join(', ') + (r.winners.length > 5 ? ' +' + (r.winners.length - 5) : '');
    return { head: head, sub: (r.off === 0 ? 'Called it: ' : 'Closest (' + r.off + ' off): ') + names };
  }

  // ── TikFinity, without Crowd Control+: chat guesses straight from its Events API ──
  var CHAT_KEY = 'rhb-live-games-chat';
  var chat = { on: true, url: 'ws://localhost:21213' };
  try { Object.assign(chat, JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')); } catch (e) {}
  function chatSave() { try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); } catch (e) {} }
  var tf = { ws: null, state: 'off', retryT: null, got: 0 };
  function tfWanted() { return chat.on && !cc() && !!(S.gt && S.gt.open || S.dig && S.dig.open || (panel && !panel.hidden)); }
  function tfConnect() {
    clearTimeout(tf.retryT);
    if (!tfWanted()) { tfClose('off'); return; }
    if (tf.ws) return;
    var ws;
    try { ws = new WebSocket(chat.url); } catch (e) { tf.state = 'bad address'; renderChat(); return; }
    tf.ws = ws; tf.state = 'connecting'; renderChat();
    ws.onopen = function () { tf.state = 'on'; renderChat(); };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (String(m.event || m.type || '').toLowerCase() !== 'chat') return;
      var d = m.data || {}, text = String(d.comment || d.text || '').trim();
      var who = d.nickname || (d.user && d.user.nickname) || d.uniqueId || (d.user && d.user.uniqueId) || 'someone';
      chatGuess(who, text);
    };
    ws.onclose = ws.onerror = function () {
      if (tf.ws !== ws) return;
      tf.ws = null; tf.state = tfWanted() ? 'waiting' : 'off'; renderChat();
      clearTimeout(tf.retryT); if (tfWanted()) tf.retryT = setTimeout(tfConnect, 8000);
    };
  }
  function tfClose(state) { clearTimeout(tf.retryT); if (tf.ws) { var w = tf.ws; tf.ws = null; try { w.onclose = w.onerror = null; w.close(); } catch (e) {} } tf.state = state || 'off'; renderChat(); }
  // "!gt 9" / "!dig 15" in chat: a guess in the open round (one per name; a new one replaces it)
  function chatGuess(who, text) {
    var m = /^!(gt|dig)\s*#?(\d{1,2})$/i.exec(text);
    if (!m) return;
    var g = m[1].toLowerCase(), n = +m[2], R = S[g];
    if (!R || !R.open || n < 1 || n > GAMES[g].max) return;
    R.guesses = R.guesses.filter(function (q) { return q.who.toLowerCase() !== String(who).toLowerCase(); });
    R.guesses.push({ who: String(who).slice(0, 40), n: n }); tf.got++; save();
    if (panel && !panel.hidden && tab === g) render();
  }
  function chatText() {
    if (!chat.on) return 'Chat guesses off: type them in below.';
    if (tf.state === 'on') return '\u25cf Listening to TikTok chat through TikFinity: viewers type !' + tab + ' and a number.' + (tf.got ? ' ' + tf.got + ' taken so far.' : '');
    if (tf.state === 'connecting') return 'Connecting to TikFinity\u2026';
    if (tf.state === 'bad address') return 'That address isn\u2019t a WebSocket address (ws://\u2026).';
    return 'Waiting for TikFinity (open it on this PC, logged in to your TikTok; Events API port 21213). Guesses can be typed in meanwhile.';
  }
  function renderChat() { if (!panel || panel.hidden) return; var e = panel.querySelector('.lg-chat'); if (e) e.textContent = chatText(); }
  setInterval(function () { if (tfWanted()) { if (!tf.ws && !tf.retryT) tfConnect(); } else if (tf.ws) tfClose('off'); }, 2000);

  // ── Crowd Control+: its rounds, from chat ─────────────────────────────────
  function cc() { var C = window.RandoCrowd; return C && C.connected() ? C : null; }
  var ccWas = false, ccResultSeen = { gt: null, dig: null };
  function ccRound(g) { var C = cc(); return C ? C.live()[g === 'gt' ? 'gtguess' : 'digguess'] : null; }
  function ccLive(g) {
    var C = cc(); if (!C) return null;
    var x = C.live()[g];
    if (!x) return null;
    return g === 'gt' ? { count: x.opened, found: x.found, at: x.at } : { count: x.digs, found: x.found, at: x.at };
  }
  function ccAct(action, args) { var C = cc(); if (C) C.liveAction(action, args); }
  document.addEventListener('rh-livegame', function () {
    ['gt', 'dig'].forEach(function (g) {
      var R = ccRound(g);
      // a result from the bridge: the banner over the game, once
      if (R && R.result && R.result.at && ccResultSeen[g] !== R.id + ':' + R.result.at) {
        ccResultSeen[g] = R.id + ':' + R.result.at;
        announce(g, { at: R.result.at, winners: R.result.winners || [], off: R.result.off });
      }
    });
    render();
  });

  // ── watching the game ─────────────────────────────────────────────────────
  var lastSeed = null;
  function tick() {
    if (seed() !== lastSeed) { lastSeed = seed(); load(); render(); }
    var on = !!cc();
    if (on !== ccWas) { ccWas = on; render(); }
    if (on) { if (panel && !panel.hidden) renderLive(); return; }
    ['gt', 'dig'].forEach(function (g) {
      var R = S[g], L = live(g);
      if (!R || !L) return;
      // the first chest / dig closes the guesses
      if (R.open && L.count > R.count0) { R.open = false; save(); render(); }
      // found: the result (once; a round opened after it was found waits for a new seed)
      if (!R.result && !R.startedFound && L.found) {
        if (typeof L.at === 'number') { R.result = score(g, L.at); R.open = false; save(); announce(g, R.result); }
        else { R.result = { at: null, winners: [], off: null, unknown: true }; R.open = false; save(); }
        render();
      }
    });
    if (panel && !panel.hidden) renderLive();
  }
  setInterval(tick, 500);

  // ── the result, over the game ─────────────────────────────────────────────
  function announce(g, r) {
    var host = window.Snes9xPlayer && window.Snes9xPlayer.fx && window.Snes9xPlayer.fx.container;
    if (!host) return;
    if (!banner || !banner.isConnected) { banner = document.createElement('div'); banner.className = 'lg-banner'; host.appendChild(banner); }
    var t = resultText(g, r);
    banner.innerHTML = '<span class="ic"></span><span><b></b><i></i></span>';
    banner.querySelector('.ic').textContent = GAMES[g].icon;
    banner.querySelector('b').textContent = (g === 'gt' ? 'BIG KEY FOUND! ' : 'DIGGING GAME! ') + t.head;
    banner.querySelector('i').textContent = t.sub;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
    clearTimeout(announce.t); announce.t = setTimeout(function () { banner.classList.remove('show'); }, 9000);
  }

  // ── the panel ─────────────────────────────────────────────────────────────
  var CSS =
    '#lg-panel { position: fixed; z-index: 80; right: 12px; top: 64px; width: min(340px, calc(100vw - 24px)); max-height: calc(100vh - 80px); display: flex; flex-direction: column;' +
    ' background: var(--panel, #161b22); border: 1px solid var(--line, #2a313c); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.55); color: var(--text, #e6e9ee); font: 13px/1.35 system-ui, sans-serif; }' +
    '#lg-panel[hidden] { display: none; }' +
    '#lg-panel .lg-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--line, #2a313c); }' +
    '#lg-panel .lg-head b { flex: 1; font-size: 14px; }' +
    '#lg-panel .lg-x { background: none; border: 0; color: inherit; font-size: 18px; cursor: pointer; padding: 0 4px; }' +
    '#lg-panel .lg-tabs { display: flex; gap: 4px; padding: 8px 10px 0; }' +
    '#lg-panel .lg-tabs button { flex: 1; padding: 6px; border-radius: 6px; border: 1px solid var(--line, #2a313c); background: #0d1117; color: var(--dim, #8b95a3); cursor: pointer; font-weight: 600; }' +
    '#lg-panel .lg-tabs button.on { background: #1f6feb; border-color: #1f6feb; color: #fff; }' +
    '#lg-panel .lg-body { padding: 10px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }' +
    '#lg-panel .lg-q { color: var(--dim, #8b95a3); }' +
    '#lg-panel .lg-live { display: flex; gap: 8px; }' +
    '#lg-panel .lg-live > div { flex: 1; background: #0d1117; border: 1px solid var(--line, #2a313c); border-radius: 6px; padding: 5px 8px; text-align: center; }' +
    '#lg-panel .lg-live small { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--dim, #8b95a3); }' +
    '#lg-panel .lg-live strong { font-size: 18px; font-variant-numeric: tabular-nums; }' +
    '#lg-panel .lg-state { padding: 6px 8px; border-radius: 6px; background: #0d1117; }' +
    '#lg-panel .lg-state.open { border-left: 3px solid #3fb950; } #lg-panel .lg-state.closed { border-left: 3px solid #e3b341; } #lg-panel .lg-state.done { border-left: 3px solid #1f6feb; }' +
    '#lg-panel .lg-add { display: flex; gap: 6px; }' +
    '#lg-panel input { background: #0d1117; border: 1px solid var(--line, #2a313c); border-radius: 6px; color: inherit; padding: 5px 7px; font: inherit; min-width: 0; }' +
    '#lg-panel .lg-add input[type=text] { flex: 1; } #lg-panel .lg-add input[type=number] { width: 64px; }' +
    '#lg-panel button.lg-b { background: #21262d; border: 1px solid var(--line, #2a313c); border-radius: 6px; color: inherit; padding: 5px 10px; cursor: pointer; white-space: nowrap; }' +
    '#lg-panel button.lg-b.primary { background: #238636; border-color: #2ea043; color: #fff; }' +
    '#lg-panel button.lg-b:disabled { opacity: .5; cursor: not-allowed; }' +
    '#lg-panel .lg-row { display: flex; gap: 6px; flex-wrap: wrap; }' +
    '#lg-panel ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow: auto; }' +
    '#lg-panel li { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 5px; background: #0d1117; }' +
    '#lg-panel li .n { width: 2.4em; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }' +
    '#lg-panel li .w { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
    '#lg-panel li.win { background: rgba(63,185,80,.18); }' +
    '#lg-panel li button { background: none; border: 0; color: var(--dim, #8b95a3); cursor: pointer; font-size: 14px; }' +
    '#lg-panel .lg-note { font-size: 11px; color: var(--dim, #8b95a3); }' +
    '.lg-banner { position: absolute; left: 50%; top: 14%; transform: translate(-50%, -10px); z-index: 27; pointer-events: none; display: flex; align-items: center; gap: 10px;' +
    ' max-width: 86%; padding: 8px 16px 8px 12px; border-radius: 10px; background: rgba(18,12,34,.94); border: 2px solid #ffd166; box-shadow: 0 6px 20px rgba(0,0,0,.55);' +
    ' color: #fff; opacity: 0; transition: opacity .3s, transform .3s; }' +
    '.lg-banner.show { opacity: 1; transform: translate(-50%, 0); }' +
    '.lg-banner .ic { font-size: 26px; animation: lg-bop .5s ease-in-out infinite alternate; }' +
    '@keyframes lg-bop { to { transform: translateY(-3px) scale(1.1); } }' +
    '.lg-banner b { display: block; font: 700 15px/1.25 system-ui, sans-serif; color: #ffd166; }' +
    '.lg-banner i { display: block; font: 600 13px/1.25 system-ui, sans-serif; font-style: normal; }' +
    '#win-bar .lg-open { white-space: nowrap; }';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function build() {
    if (panel) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = el('div'); panel.id = 'lg-panel'; panel.hidden = true;
    document.body.appendChild(panel);
    // Desktop layout: buttons in the window bar, next to Timer
    var wb = $('win-bar');
    if (wb && !$('lg-gt-btn')) {
      ['gt', 'dig'].forEach(function (g) {
        var b = el('button', 'lg-open', GAMES[g].icon + ' ' + (g === 'gt' ? 'Key game' : 'Dig game'));
        b.type = 'button'; b.id = 'lg-' + g + '-btn';
        b.title = GAMES[g].name + ' guessing game: with Crowd Control+ connected, chat guesses (' + (g === 'gt' ? '!gt' : '!dig') + ' N) come in live; without it, type the guesses in. The game says who called it';
        b.addEventListener('click', function () { toggle(g); });
        var t = $('open-timer');
        if (t && t.parentNode === wb) wb.insertBefore(b, t); else wb.appendChild(b);
      });
    }
  }
  function toggle(g) {
    build();
    if (!panel.hidden && tab === g) { panel.hidden = true; return; }
    tab = g; panel.hidden = false; render(); tfConnect();
    var inp = panel.querySelector('.lg-add input[type=text]'); if (inp && S[g] && S[g].open) inp.focus();
  }
  function renderLive() {
    var L = cc() ? ccLive(tab) : live(tab), c = panel.querySelector('.lg-count'), f = panel.querySelector('.lg-found');
    if (c) c.textContent = L ? L.count + ' / ' + GAMES[tab].max : '–';
    if (f) f.textContent = L ? (L.found ? (typeof L.at === 'number' ? '#' + L.at : 'yes') : 'not yet') : '–';
  }
  function render() {
    if (!panel || panel.hidden) return;
    var G = GAMES[tab], R = S[tab];
    panel.textContent = '';
    var head = el('div', 'lg-head'); head.append(el('b', null, '🎲 Live games'));
    var x = el('button', 'lg-x', '×'); x.type = 'button'; x.title = 'Close'; x.onclick = function () { panel.hidden = true; }; head.append(x);
    var tabs = el('div', 'lg-tabs');
    ['gt', 'dig'].forEach(function (g) {
      var b = el('button', g === tab ? 'on' : '', GAMES[g].icon + ' ' + GAMES[g].name); b.type = 'button';
      b.onclick = function () { tab = g; render(); }; tabs.append(b);
    });
    var body = el('div', 'lg-body');
    body.append(el('div', 'lg-q', G.q));
    var lv = el('div', 'lg-live');
    var a = el('div'); a.append(el('small', null, G.counted), el('strong', 'lg-count', '–'));
    var b2 = el('div'); b2.append(el('small', null, tab === 'gt' ? 'Big key' : 'Prize'), el('strong', 'lg-found', '–'));
    lv.append(a, b2); body.append(lv);
    if (!seed()) body.append(el('div', 'lg-note', 'Start a game first: the counts come from it.'));

    if (cc()) { renderCC(body, G); panel.append(head, tabs, body); renderLive(); return; }
    // chat guesses through TikFinity (no Crowd Control+ needed)
    var ch = el('div', 'lg-row'); ch.style.alignItems = 'center';
    var tog = el('label'); tog.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer';
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!chat.on;
    cb.onchange = function () { chat.on = cb.checked; chatSave(); if (chat.on) tfConnect(); else tfClose('off'); render(); };
    tog.append(cb, el('span', null, 'Guesses from TikTok chat (TikFinity)'));
    var addr = el('input'); addr.type = 'text'; addr.value = chat.url; addr.title = 'TikFinity\u2019s Events API address'; addr.style.width = '150px';
    addr.onchange = function () { chat.url = addr.value.trim() || 'ws://localhost:21213'; chatSave(); tfClose('off'); tfConnect(); };
    ch.append(tog, addr); body.append(ch);
    body.append(el('div', 'lg-note lg-chat', chatText()));
    if (!R) {
      body.append(el('div', 'lg-state', 'No round yet. Start one before the first ' + G.what + ': chat guesses (1–' + G.max + ') come in by themselves, or type them in, and play: the game says who called it.'));
      var go = el('button', 'lg-b primary', 'Start a round'); go.type = 'button';
      go.onclick = function () { newRound(tab); render(); }; body.append(go);
    } else {
      var state = R.result ? 'done' : R.open ? 'open' : 'closed';
      var txt = R.result
        ? (R.result.unknown ? (tab === 'gt' ? 'The big key didn’t come from a GT chest, so there’s no number to score.' : 'Couldn’t tell which dig it came on.') : (function () { var t = resultText(tab, R.result); return t.head + ' — ' + t.sub; })())
        : R.open ? 'Guesses open: they close at the first ' + G.what + '.'
        : R.startedFound ? (tab === 'gt' ? 'The big key was already found when this round started: start one on a new seed.' : 'The prize was already taken this game: start one on a new seed.')
        : 'Guesses closed. Waiting for the ' + (tab === 'gt' ? 'big key' : 'prize') + '…';
      body.append(el('div', 'lg-state ' + state, txt));
      if (R.open) {
        var add = el('div', 'lg-add');
        var who = el('input'); who.type = 'text'; who.placeholder = 'Name'; who.maxLength = 40;
        var n = el('input'); n.type = 'number'; n.min = 1; n.max = G.max; n.placeholder = '1-' + G.max;
        var ok = el('button', 'lg-b primary', 'Add'); ok.type = 'button';
        var addIt = function () {
          var v = parseInt(n.value, 10), w = who.value.trim() || 'Guess ' + (R.guesses.length + 1);
          if (!(v >= 1 && v <= G.max)) { n.focus(); return; }
          // one guess per name: a new one replaces the old
          R.guesses = R.guesses.filter(function (q) { return q.who.toLowerCase() !== w.toLowerCase(); });
          R.guesses.push({ who: w, n: v }); save(); render();
          var i2 = panel.querySelector('.lg-add input[type=text]'); if (i2) i2.focus();
        };
        ok.onclick = addIt;
        [who, n].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (i === who) n.focus(); else addIt(); } }); });
        add.append(who, n, ok); body.append(add);
      }
      if (R.guesses.length) {
        var ul = el('ul'), win = R.result && R.result.winners ? R.result.winners : [];
        R.guesses.slice().sort(function (p, q) { return p.n - q.n; }).forEach(function (q) {
          var li = el('li', win.indexOf(q.who) >= 0 ? 'win' : '');
          li.append(el('span', 'n', '#' + q.n), el('span', 'w', q.who));
          if (R.open) { var d = el('button', null, '×'); d.type = 'button'; d.title = 'Remove'; d.onclick = function () { R.guesses = R.guesses.filter(function (z) { return z !== q; }); save(); render(); }; li.append(d); }
          ul.append(li);
        });
        body.append(el('div', 'lg-note', R.guesses.length + (R.guesses.length === 1 ? ' guess' : ' guesses')), ul);
      }
      var row = el('div', 'lg-row');
      if (R.open) { var cl = el('button', 'lg-b', 'Close guesses'); cl.type = 'button'; cl.onclick = function () { R.open = false; save(); render(); }; row.append(cl); }
      else if (!R.result) { var ro = el('button', 'lg-b', 'Reopen guesses'); ro.type = 'button'; ro.onclick = function () { R.open = true; var L = live(tab); R.count0 = L ? L.count : R.count0; save(); render(); }; row.append(ro); }
      if (!R.result && !R.open) {
        var hand = el('button', 'lg-b', 'Enter the answer…'); hand.type = 'button';
        hand.title = 'If the game couldn’t count it (the key came from elsewhere, say): type the ' + G.what + ' number';
        hand.onclick = function () { var v = parseInt(prompt(G.unit + ' number (1-' + G.max + '):', ''), 10); if (v >= 1 && v <= G.max) { R.result = score(tab, v); save(); announce(tab, R.result); render(); } };
        row.append(hand);
      }
      if (R.result && R.result.unknown) {
        var hand2 = el('button', 'lg-b', 'Enter the answer…'); hand2.type = 'button';
        hand2.onclick = function () { var v = parseInt(prompt(G.unit + ' number (1-' + G.max + '):', ''), 10); if (v >= 1 && v <= G.max) { R.result = score(tab, v); save(); announce(tab, R.result); render(); } };
        row.append(hand2);
      }
      if (R.result && !R.result.unknown) { var again = el('button', 'lg-b', 'Show it again'); again.type = 'button'; again.onclick = function () { announce(tab, R.result); }; row.append(again); }
      var nr = el('button', 'lg-b', 'New round'); nr.type = 'button';
      nr.onclick = function () { if (R.guesses.length && !R.result && !confirm('Start over? The ' + R.guesses.length + ' guesses go.')) return; newRound(tab); render(); };
      row.append(nr);
      body.append(row);
    }
    if (tab === 'gt') body.append(el('div', 'lg-note', 'Chests count 1–22: the places in Ganon’s Tower the big key can be, in the order you open them.'));
    else body.append(el('div', 'lg-note', 'Digs count from the first shovel in the Digging Game (Dark World, south of the Village of Outcasts).'));
    panel.append(head, tabs, body);
    renderLive();
  }

  // The round Crowd Control+ is running, from chat.
  function renderCC(body, G) {
    var R = ccRound(tab), cmd = (R && R.command) || (tab === 'gt' ? '!gt' : '!dig');
    body.append(el('div', 'lg-note', '\u25cf Live with Crowd Control+: viewers guess in TikTok chat with ' + cmd + ' and a number (1\u2013' + G.max + '). One guess each; a new one replaces it.'));
    if (!R) {
      body.append(el('div', 'lg-state', 'No round open. Start one before the first ' + G.what + '; chat guesses come in here as they\u2019re typed, and the game says who called it.'));
      var go = el('button', 'lg-b primary', 'Start a round'); go.type = 'button';
      go.onclick = function () { ccAct(tab + '-start'); }; body.append(go);
      return;
    }
    var state = R.result ? 'done' : R.open ? 'open' : 'closed';
    var txt = R.result
      ? (function () { var t = resultText(tab, { at: R.result.at, winners: R.result.winners || [], off: R.result.off }); return t.head + ' \u2014 ' + t.sub; })()
      : R.open ? 'Guesses open (' + R.guesses + ' so far): they close at the first ' + G.what + '.'
      : 'Guesses closed (' + R.guesses + '). Waiting for the ' + (tab === 'gt' ? 'big key' : 'prize') + '\u2026';
    body.append(el('div', 'lg-state ' + state, txt));
    var list = R.list || [];
    if (list.length) {
      var ul = el('ul'), win = (R.result && R.result.winners) || [];
      list.slice().sort(function (p, q) { return p.n - q.n; }).forEach(function (q) {
        var li = el('li', win.indexOf(q.who) >= 0 ? 'win' : '');
        li.append(el('span', 'n', '#' + q.n), el('span', 'w', q.who));
        ul.append(li);
      });
      body.append(el('div', 'lg-note', R.guesses + (R.guesses === 1 ? ' guess' : ' guesses') + ' from chat'), ul);
    } else if (R.open) body.append(el('div', 'lg-note', 'No guesses yet. Tell chat: ' + cmd + ' 1\u2013' + G.max));
    var row = el('div', 'lg-row');
    if (R.open) { var cl = el('button', 'lg-b', 'Close guesses'); cl.type = 'button'; cl.onclick = function () { ccAct(tab + '-lock'); }; row.append(cl); }
    if (!R.result) {
      var hand = el('button', 'lg-b', 'Enter the answer\u2026'); hand.type = 'button';
      hand.title = 'If the game couldn\u2019t count it: type the ' + G.what + ' number';
      hand.onclick = function () { var v = parseInt(prompt(G.unit + ' number (1-' + G.max + '):', ''), 10); if (v >= 1 && v <= G.max) ccAct(tab + '-resolve', { at: v }); };
      row.append(hand);
      var cx = el('button', 'lg-b', 'Cancel round'); cx.type = 'button';
      cx.onclick = function () { if (!R.guesses || confirm('Cancel this round? The ' + R.guesses + ' guesses go.')) ccAct(tab + '-cancel'); };
      row.append(cx);
    } else {
      var again = el('button', 'lg-b', 'Show it again'); again.type = 'button';
      again.onclick = function () { announce(tab, { at: R.result.at, winners: R.result.winners || [], off: R.result.off }); }; row.append(again);
      var nr = el('button', 'lg-b', 'New round'); nr.type = 'button';
      nr.onclick = function () { ccAct(tab + '-start'); }; row.append(nr);
    }
    body.append(row);
    body.append(el('div', 'lg-note', tab === 'gt' ? 'Chests count 1\u201322: the places in Ganon\u2019s Tower the big key can be, in the order you open them. The same round shows on Crowd Control+\u2019s Live tab and its GT big key overlay.' : 'Digs count from the first shovel in the Digging Game. The same round shows on Crowd Control+\u2019s Live tab and its Digging Game overlay.'));
  }

  window.RandoLiveGames = { open: function (g) { toggle(GAMES[g] ? g : 'gt'); }, games: GAMES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
