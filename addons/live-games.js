/*
 * Live games, without Crowd Control: the GT big key game and the Digging
 * Game, run right here (HydeOut).
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

  // ── watching the game ─────────────────────────────────────────────────────
  var lastSeed = null;
  function tick() {
    if (seed() !== lastSeed) { lastSeed = seed(); load(); render(); }
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
        b.title = GAMES[g].name + ' guessing game, without Crowd Control: take the guesses, the game says who called it';
        b.addEventListener('click', function () { toggle(g); });
        var t = $('open-timer');
        if (t && t.parentNode === wb) wb.insertBefore(b, t); else wb.appendChild(b);
      });
    }
  }
  function toggle(g) {
    build();
    if (!panel.hidden && tab === g) { panel.hidden = true; return; }
    tab = g; panel.hidden = false; render();
    var inp = panel.querySelector('.lg-add input[type=text]'); if (inp && S[g] && S[g].open) inp.focus();
  }
  function renderLive() {
    var L = live(tab), c = panel.querySelector('.lg-count'), f = panel.querySelector('.lg-found');
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

    if (!R) {
      body.append(el('div', 'lg-state', 'No round yet. Start one before the first ' + G.what + ', take the guesses (1–' + G.max + '), and play: the game says who called it.'));
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

  window.RandoLiveGames = { open: function (g) { toggle(GAMES[g] ? g : 'gt'); }, games: GAMES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
