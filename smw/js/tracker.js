/*
 * tracker.js — the Super Mario World tracker: exits found (of 96), every
 * overworld spot's exits by world, the switch palaces, the Koopa Kids'
 * castles, and Mario (power-up, lives, coins, Yoshi), read from the running
 * game's memory, or ticked by hand.
 *
 *   SMWTracker.init(el)
 *   SMWTracker.setSession(id, label, meta)
 *   SMWTracker.ram = () => Uint8Array | null       the SNES's work RAM
 *   SMWTracker.rom = () => Uint8Array | null       the ROM being played (for its event table)
 *   SMWTracker.onLink(fn)      'manual' | 'waiting' | 'live'
 *
 * A spot keeps its place on the map whatever the randomizer put in it; each
 * of its exits sets an overworld event (data.js), which the game keeps as a
 * bit, so the exits tick themselves as you find them. The randomizer may swap
 * a level's normal and secret exits: the list says which path each one opens.
 */
(function () {
  'use strict';
  const D = window.SMWD;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, manual = {}, link = 'manual';
  const linkFns = [];
  let live = null, view = 'levels', compact = false;

  // the checks: one per exit of every spot, the four palaces, the seven castles
  const EXITS = [];      // { stage index, secret: bool }
  D.STAGES.forEach((s, i) => { for (let k = 0; k < s[3]; k++) EXITS.push({ s: i, secret: k === 1 }); });
  const CASTLES = D.STAGES.map((s, i) => s[4] > 0 ? i : -1).filter((i) => i >= 0).sort((a, b) => D.STAGES[a][4] - D.STAGES[b][4]);
  const KIDS = ['Iggy', 'Morton', 'Lemmy', 'Ludwig', 'Roy', 'Wendy', 'Larry'];

  // the event each exit sets: from the ROM being played (the randomizer moves some), else the game's own
  let events = null, eventsRom = null;
  function eventTable() {
    let r = null; try { r = SMWTracker.rom && SMWTracker.rom(); } catch (e) {}
    if (r && r.length % 1024 === 512) r = r.subarray(512);
    if (!r || r.length < 0x80000) return events;
    if (eventsRom === r && events) return events;
    events = EXITS.map((x) => { const st = D.STAGES[x.s]; return r[D.TRANSLEVEL_EVENTS + D.translevel(st[6])] + (x.secret ? 1 : 0); });
    eventsRom = r;
    return events;
  }

  // ── state from RAM ───────────────────────────────────────────────────────
  function readRam() {
    const r = SMWTracker.ram && SMWTracker.ram();
    if (!r || r.length < 0x20000) return null;
    const M = D.MEM, ev = eventTable();
    const flag = (e) => !!(r[M.EVENTS + (e >> 3)] & (0x80 >> (e & 7)));
    const s = {
      exits: ev ? EXITS.map((x, i) => flag(ev[i])) : EXITS.map(() => false),
      palaces: D.PALACES.map((p) => !!r[p[1]]),
      mode: r[M.MODE], count: r[M.EXITS], lives: r[M.LIVES] + 1, coins: r[M.COINS], power: r[M.POWER], yoshi: !!r[M.YOSHI], item: r[M.ITEM],
      started: false,
      // Bowser: the ending is a cutscene ($0100 $18–$29) with cutscene number 8 (1–7: the castles falling)
      bowser: [r[M.MODE] >= 0x18 && r[M.MODE] <= 0x29 && r[M.CUTSCENE] >= 8],
    };
    s.castles = CASTLES.map((si) => { const k = EXITS.findIndex((x) => x.s === si); return k >= 0 && s.exits[k]; });
    // a game going: the overworld or a level (under $0B: the title, its demo and the file select)
    s.started = s.mode >= 0x0B && s.mode <= 0x29 && s.count <= 96 && !!ev;
    return s;
  }
  function isLive(k, i) { return !!(live && live.started && live[k] && live[k][i]) || (k === 'bowser' && !!manual.ended); }
  function state() {
    const has = (k, n) => Array.from({ length: n }, (_, i) => isLive(k, i) || !!(manual[k] && manual[k][i]));
    const s = { exits: has('exits', EXITS.length), palaces: has('palaces', 4), castles: has('castles', 7), bowser: has('bowser', 1) };
    // a castle ticked by hand ticks its exit too, and the other way round
    CASTLES.forEach((si, c) => { const k = EXITS.findIndex((x) => x.s === si); if (s.castles[c]) s.exits[k] = true; if (s.exits[k]) s.castles[c] = true; });
    return s;
  }

  // ── manual ticks ─────────────────────────────────────────────────────────
  function key() { return 'smwr:manual:' + sessionId; }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(k, i) {
    if (isLive(k, i)) return;
    manual[k] = manual[k] || {};
    if (manual[k][i]) delete manual[k][i]; else manual[k][i] = 1;
    saveManual(); render();
  }

  // ── rendering ────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const POWER = ['Small', 'Super', 'Cape', 'Fire'], ITEM = ['', 'Mushroom', 'Fire Flower', 'Star', 'Feather'];

  function build() {
    root.innerHTML =
      '<div class="t-stats" id="t-stats"></div>' +
      '<div class="t-tabs" role="tablist">' +
        '<button type="button" role="tab" data-view="levels">Levels</button>' +
        '<button type="button" role="tab" data-view="mario">Bosses</button>' +
        '<button type="button" role="tab" data-view="map">Map</button>' +
        '<button type="button" role="tab" data-view="seed">Seed</button>' +
      '</div>' +
      '<div class="t-view mario"><div class="t-sec"><h4>Switch palaces <span id="n-palaces"></span></h4><div class="grid palaces" id="g-palaces"></div></div>' +
        '<div class="t-sec"><h4>Koopa Kids <span id="n-castles"></span></h4><div class="grid bosses" id="g-castles"></div></div>' +
        '<div class="t-sec"><h4>Mario</h4><div class="mario-line" id="g-mario"></div></div></div>' +
      '<div class="t-view map"><div class="t-sec"><h4>Map <span id="n-map"></span></h4><div id="g-map"></div><p class="fine" id="map-note" hidden></p></div></div>' +
      '<div class="t-view levels"><div class="t-sec"><h4>Exits <span id="n-exits"></span></h4><p class="fine">Each spot on the overworld, with its exits: they tick as the game opens their paths. The randomizer can swap a level’s normal and secret exits; “secret” here means the path the secret exit opens on the map.</p><div id="g-levels"></div></div></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    $('g-palaces').innerHTML = D.PALACES.map((p, i) => '<button type="button" class="cell palace" data-k="palaces" data-i="' + i + '" style="--c:' + p[2] + '" title="' + esc(p[0]) + ' Switch Palace"><i></i><b>' + esc(p[0]) + '</b></button>').join('');
    $('g-castles').innerHTML = KIDS.map((n, i) => '<button type="button" class="cell boss" data-k="castles" data-i="' + i + '" title="' + esc(D.STAGES[CASTLES[i]][1]) + '"><b>' + esc(n) + '</b><small>#' + (i + 1) + '</small></button>').join('') +
      '<button type="button" class="cell boss" data-k="bowser" data-i="0" title="Bowser: ticks itself when the ending starts (or tap it)"><b>Bowser</b><small>the end</small></button>';
    const byWorld = {};
    EXITS.forEach((x, i) => { const st = D.STAGES[x.s]; (byWorld[st[2]] = byWorld[st[2]] || []).push(i); });
    $('g-levels').innerHTML = Object.keys(byWorld).sort((a, b) => a - b).map((w) =>
      '<div class="area"><h5>' + esc(D.WORLDS[w]) + ' <span class="an" data-world="' + w + '"></span></h5><div class="list">' +
      byWorld[w].map((i) => { const x = EXITS[i], st = D.STAGES[x.s]; return '<button type="button" class="chk" data-k="exits" data-i="' + i + '"><i></i>' + esc(st[1]) + (st[3] > 1 ? '<span class="sub"> · ' + (x.secret ? 'secret' : 'normal') + '</span>' : '') + '</button>'; }).join('') +
      '</div></div>').join('');
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b && root.contains(b)) toggle(b.dataset.k, +b.dataset.i); });
    // the map's checks: the exits, then the palaces, then Bowser
    if (window.SMWMap) SMWMap.init($('g-map'), {
      onToggle: (i) => i < EXITS.length ? toggle('exits', i) : i < EXITS.length + 4 ? toggle('palaces', i - EXITS.length) : toggle('bowser', 0),
      names: (i) => {
        if (i < EXITS.length) { const x = EXITS[i], st = D.STAGES[x.s]; return st[1] + (st[3] > 1 ? ' · ' + (x.secret ? 'secret exit' : 'normal exit') : ''); }
        if (i < EXITS.length + 4) return D.PALACES[i - EXITS.length][0] + ' Switch Palace';
        return 'Bowser’s Castle (front door)';
      },
    });
    setView(view);
  }
  function setView(v) {
    view = v; root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    try { localStorage.setItem('smwr:view', v); } catch (e) {}
    if (v === 'map' && window.SMWMap) SMWMap.redraw();
  }

  function render() {
    if (!root) return;
    const s = state();
    const paint = (k) => root.querySelectorAll('[data-k="' + k + '"]').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('have', !!s[k][i]);
      b.classList.toggle('manual', !!(manual[k] && manual[k][i]) && !isLive(k, i));
    });
    ['exits', 'palaces', 'castles', 'bowser'].forEach(paint);
    const n = (k) => s[k].filter(Boolean).length;
    root.querySelectorAll('.an').forEach((el) => {
      const w = +el.dataset.world, idx = EXITS.map((x, i) => D.STAGES[x.s][2] === w ? i : -1).filter((i) => i >= 0), d = idx.filter((i) => s.exits[i]).length;
      el.textContent = d + '/' + idx.length;
      el.parentElement.parentElement.classList.toggle('done', d === idx.length);
    });
    const exits = n('exits') + n('palaces');
    $('n-exits').textContent = exits + '/96';
    $('n-palaces').textContent = n('palaces') + '/4';
    $('n-castles').textContent = n('castles') + '/7';
    const l = live && live.started ? live : null;
    $('g-mario').innerHTML = l ? '<span>' + esc(POWER[l.power] || '?') + ' Mario</span>' + (l.item && ITEM[l.item] ? '<span>Item box: ' + esc(ITEM[l.item]) + '</span>' : '') + (l.yoshi ? '<span>Yoshi along</span>' : '') :
      '<span class="fine">Shows Mario’s power-up, item box and Yoshi while a game is running.</span>';
    const stat = (ico, v, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + v + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML = stat('★', l ? Math.max(l.count, exits) : exits, 96, 'Exits found (the game’s own count while it runs)') + stat('⌂', n('palaces'), 4, 'Switch palaces') + stat('♜', n('castles'), 7, 'Koopa Kids beaten') +
      (l ? stat('♥', l.lives, '', 'Lives') + stat('●', l.coins, '', 'Coins') : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    if (window.SMWMap) {
      const nE = EXITS.length;
      SMWMap.update({ have: s.exits.concat(s.palaces, s.bowser), liveHave: (i) => i < nE ? isLive('exits', i) : i < nE + 4 ? isLive('palaces', i - nE) : isLive('bowser', 0) });
      const mn = $('map-note'); if (mn) { mn.textContent = SMWMap.note; mn.hidden = !SMWMap.note; }
    }
    renderSeed();
  }
  function renderSeed() {
    const sd = $('g-seed'); if (!sd) return;
    const m = meta || {};
    sd.innerHTML = m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span> <small>' + esc(m.presetName || '') + '</small></div>' +
      '<div class="seedline fine">Share code: <span class="selectable">' + esc(m.seed + '/' + m.preset) + '</span> (paste it in New seed, or use the randomizer’s own link) · ROM checksum ' + esc(m.checksum || '') + ' · ' + esc(m.generator || '') + '</div>'
      : '<p class="empty">' + (m.source === 'file' ? 'A ROM from elsewhere: the tracker follows it the same way. Its seed is on the game’s title screen.' : 'Roll a seed and its seed and share code show up here.') + '</p>';
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readRam();
    if (window.SMWMap) { let ram = null, rom = null; try { ram = SMWTracker.ram && SMWTracker.ram(); rom = SMWTracker.rom && SMWTracker.rom(); } catch (e) {} SMWMap.live(ram && ram.length >= 0x20000 ? ram : null, rom, !!(s && s.started)); }
    if (!s) { live = null; setLink(window.Snes9xPlayer && Snes9xPlayer.ready ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    // the ending passes (credits, a reset): keep Bowser beaten for this seed
    if (s.started && s.bowser[0] && !manual.ended) { manual.ended = 1; saveManual(); }
    const sig = JSON.stringify([s.exits, s.palaces, s.count, s.lives, s.coins, s.power, s.yoshi, s.item, s.started, s.bowser]);
    if (sig !== last) { last = sig; render(); }
  }

  const SMWTracker = {
    ram: null, rom: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('smwr:view') || 'levels'; } catch (e) {}
      build(); loadManual(); render();
      setInterval(poll, 500);
    },
    setSession(id, label, m) { sessionId = id || 'manual'; meta = m || {}; events = null; eventsRom = null; loadManual(); render(); },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
  };
  window.SMWTracker = SMWTracker;
})();
