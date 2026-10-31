/*
 * tracker.js — the Super Metroid tracker: Samus's gear and beams, tanks and
 * ammo, the bosses, and every item spot by area, read from the running
 * game's memory (autotracking) or ticked by hand.
 *
 *   SMRTracker.init(el)
 *   SMRTracker.setSession(id, label, meta, spoiler, placed)
 *   SMRTracker.ram = () => Uint8Array | null
 *   SMRTracker.onLink(fn)      'manual' | 'waiting' | 'live'
 *
 * The game keeps a bit for every item spot it has handed out ($7E:D870..),
 * so the spots tick themselves as you collect; the gear comes from the
 * equipment and beam words, the bosses from their area bits. The seed's
 * spoiler (what sits where, which boss is where, the area doors) is behind a
 * Reveal switch, off by default.
 */
(function () {
  'use strict';
  const D = window.SMR;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, spoiler = {}, placed = [], manual = {}, link = 'manual';
  const linkFns = [];
  let live = null, view = 'items', compact = false, reveal = false;

  // ── state from RAM ───────────────────────────────────────────────────────
  function readRam() {
    const r = SMRTracker.ram && SMRTracker.ram();
    if (!r || r.length < 0x20000) return null;
    const M = D.MEM, w = (a) => r[a] | r[a + 1] << 8;
    const s = {
      gear: D.GEAR.map((g) => !!(w(g[2]) & g[1])),
      bosses: D.BOSSES.map((b) => !!(r[M.BOSS + b[1]] & b[2])),
      minis: D.MINIS.map((b) => !!(r[M.BOSS + b[1]] & b[2])),
      locs: D.LOCATIONS.map((l) => !!(r[M.ITEMS + (l[2] >> 3)] & (1 << (l[2] & 7)))),
      energy: w(M.ENERGY), maxEnergy: w(M.MAX_ENERGY), reserve: w(M.RESERVE), maxReserve: w(M.MAX_RESERVE),
      missiles: w(M.MISSILES), maxMissiles: w(M.MAX_MISSILES), supers: w(M.SUPERS), maxSupers: w(M.MAX_SUPERS), pbs: w(M.PBS), maxPbs: w(M.MAX_PBS),
      state: r[M.STATE], area: r[M.AREA], room: w(M.ROOM), sx: w(M.SAMUS_X), sy: w(M.SAMUS_Y),
      started: false,
    };
    // in a game: playing (or paused, a door, a cutscene), with Samus's energy set up
    s.started = s.state >= 0x08 && s.state <= 0x2F && s.maxEnergy >= 99 && s.maxEnergy <= 1499 && s.maxMissiles <= 255;
    return s;
  }
  function isLive(k, i) { return !!(live && live.started && live[k] && live[k][i]); }
  function state() {
    const has = (k, n) => Array.from({ length: n }, (_, i) => isLive(k, i) || !!(manual[k] && manual[k][i]));
    return { gear: has('gear', D.GEAR.length), extra: has('extra', D.EXTRA.length), bosses: has('bosses', D.BOSSES.length), minis: has('minis', D.MINIS.length), locs: has('locs', D.LOCATIONS.length) };
  }

  // ── manual ticks ─────────────────────────────────────────────────────────
  function key() { return 'smr:manual:' + sessionId; }
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
  const SHORT = { 'Morph Ball': 'Morph', 'Spring Ball': 'Spring', 'Screw Attack': 'Screw', 'Varia Suit': 'Varia', 'Gravity Suit': 'Gravity', 'Hi-Jump Boots': 'Hi-Jump', 'Space Jump': 'Space J.', 'Speed Booster': 'Speed', 'Grapple Beam': 'Grapple', 'X-Ray Scope': 'X-Ray', 'Charge Beam': 'Charge', 'Ice Beam': 'Ice', 'Wave Beam': 'Wave', 'Plasma Beam': 'Plasma', 'Double Jump': 'Dbl Jump', 'Heat Shield': 'Heat Sh.', 'Pressure Valve': 'P. Valve' };

  function build() {
    root.innerHTML =
      '<div class="t-stats" id="t-stats"></div>' +
      '<div class="t-tabs" role="tablist">' +
        '<button type="button" role="tab" data-view="items">Samus</button>' +
        '<button type="button" role="tab" data-view="map">Map</button>' +
        '<button type="button" role="tab" data-view="locs">Spots</button>' +
        '<button type="button" role="tab" data-view="seed">Seed</button>' +
      '</div>' +
      '<div class="t-view items"><div class="t-sec"><h4>Gear <span id="n-gear"></span></h4><div class="grid gear" id="g-gear"></div></div>' +
        '<div class="t-sec"><h4>DASH items</h4><div class="grid gear" id="g-extra"></div></div>' +
        '<div class="t-sec"><h4>Bosses <span id="n-bosses"></span></h4><div class="grid bosses" id="g-bosses"></div></div>' +
        '<div class="t-sec"><h4>Mini-bosses <span id="n-minis"></span></h4><div class="grid bosses" id="g-minis"></div></div></div>' +
      '<div class="t-view map"><div class="t-sec"><h4>Map <span id="n-map"></span></h4><div id="g-map"></div></div></div>' +
      '<div class="t-view locs"><div class="t-sec"><h4>Item spots <span id="n-locs"></span></h4><p class="fine">The game ticks a spot as you take its item. With Reveal on, each spot shows what’s there.</p><div id="g-locs"></div></div></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div>' +
        '<div class="t-sec"><h4>Spoiler <label class="reveal"><input type="checkbox" id="t-reveal"> Reveal</label></h4><div id="g-spoiler"></div></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    $('t-reveal').addEventListener('change', () => { reveal = $('t-reveal').checked; render(); });
    $('g-gear').innerHTML = D.GEAR.map((g, i) => '<button type="button" class="cell gear" data-k="gear" data-i="' + i + '" title="' + esc(g[0]) + '"><b>' + esc(SHORT[g[0]] || g[0]) + '</b></button>').join('');
    $('g-extra').innerHTML = D.EXTRA.map((g, i) => '<button type="button" class="cell gear" data-k="extra" data-i="' + i + '" title="' + esc(g) + ' (tap when you have it)"><b>' + esc(SHORT[g] || g) + '</b></button>').join('');
    $('g-bosses').innerHTML = D.BOSSES.map((b, i) => '<button type="button" class="cell boss" data-k="bosses" data-i="' + i + '"><b>' + esc(b[0]) + '</b><small class="who"></small></button>').join('');
    $('g-minis').innerHTML = D.MINIS.map((b, i) => '<button type="button" class="cell boss" data-k="minis" data-i="' + i + '"><b>' + esc(b[0]) + '</b></button>').join('');
    $('g-locs').innerHTML = D.AREAS.map((a, ai) =>
      '<div class="area"><h5>' + esc(a) + ' <span class="an" data-area="' + ai + '"></span></h5><div class="list">' +
      D.LOCATIONS.map((l, i) => l[1] === ai ? '<button type="button" class="chk" data-k="locs" data-i="' + i + '"><i></i>' + esc(l[0]) + '<span class="what"></span></button>' : '').join('') + '</div></div>').join('');
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) toggle(b.dataset.k, +b.dataset.i); });
    if (window.SMRMap) SMRMap.init($('g-map'), { onToggle: (i) => toggle('locs', i) });
    setView(view);
  }
  function setView(v) {
    view = v; root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    try { localStorage.setItem('smr:view', v); } catch (e) {}
    if (v === 'map' && window.SMRMap) SMRMap.redraw();
  }

  function render() {
    if (!root) return;
    const s = state();
    const count = (k) => s[k].filter(Boolean).length;
    const paint = (k) => root.querySelectorAll('[data-k="' + k + '"]').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('have', s[k][i]);
      b.classList.toggle('manual', !!(manual[k] && manual[k][i]) && !isLive(k, i));
    });
    ['gear', 'extra', 'bosses', 'minis', 'locs'].forEach(paint);
    // where each placed item is (Reveal on): the spot's item; the bosses' spots
    const at = {}; placed.forEach((p) => { at[p.name + '|' + p.area] = p.item; });
    const AREA_KEY = ['Crateria', 'GreenBrinstar', 'RedBrinstar', 'KraidsLair', 'CrocomiresLair', 'WreckedShip', 'EastMaridia', 'WestMaridia', 'UpperNorfair', 'LowerNorfair'];
    root.querySelectorAll('[data-k="locs"]').forEach((b) => {
      const l = D.LOCATIONS[+b.dataset.i], item = at[l[0] + '|' + AREA_KEY[l[1]]];
      b.querySelector('.what').textContent = reveal && item ? ' · ' + item : '';
      b.hidden = placed.length > 0 && !(l[0] + '|' + AREA_KEY[l[1]] in at);   // DASH's boss-room copies that this seed doesn't use
    });
    const bs = (spoiler && spoiler.Bosses) || {};
    const SPOT = { Kraid: "Kraid's Lair", Phantoon: 'Wrecked Ship', Draygon: 'East Maridia', Ridley: 'Lower Norfair' };
    root.querySelectorAll('[data-k="bosses"]').forEach((b) => {
      const name = D.BOSSES[+b.dataset.i][0];
      const where = Object.keys(bs).find((loc) => bs[loc] === name);
      b.querySelector('.who').textContent = reveal && where && where !== SPOT[name] ? 'in ' + where : '';
    });
    root.querySelectorAll('.an').forEach((el) => {
      const ai = +el.dataset.area, idx = D.LOCATIONS.map((l, i) => l[1] === ai && !root.querySelector('[data-k="locs"][data-i="' + i + '"]').hidden ? i : -1).filter((i) => i >= 0);
      const n = idx.filter((i) => s.locs[i]).length;
      el.textContent = n + '/' + idx.length;
      el.parentElement.parentElement.classList.toggle('done', n === idx.length && idx.length > 0);
    });
    $('n-gear').textContent = count('gear') + '/' + D.GEAR.length;
    $('n-bosses').textContent = count('bosses') + '/4';
    $('n-minis').textContent = count('minis') + '/' + D.MINIS.length;
    const shownArr = D.LOCATIONS.map((l, i) => !root.querySelector('[data-k="locs"][data-i="' + i + '"]').hidden), shown = shownArr.filter(Boolean).length;
    $('n-locs').textContent = count('locs') + '/' + shown;
    $('n-map').textContent = count('locs') + '/' + shown;
    if (window.SMRMap) SMRMap.update({ have: s.locs, shown: shownArr, names: D.LOCATIONS.map((l) => l[0]), items: reveal ? D.LOCATIONS.map((l) => at[l[0] + '|' + AREA_KEY[l[1]]] || '') : null, liveHave: (i) => isLive('locs', i) });
    const l = live && live.started ? live : null;
    const stat = (ico, n, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + n + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML =
      stat('⚑', count('locs'), shown, 'Item spots taken') +
      stat('☠', count('bosses'), 4, 'Bosses') +
      (l ? stat('♥', l.energy, l.maxEnergy, 'Energy') + (l.maxReserve ? stat('◇', l.reserve, l.maxReserve, 'Reserve') : '') +
        stat('➶', l.missiles, l.maxMissiles, 'Missiles') + stat('✦', l.supers, l.maxSupers, 'Super Missiles') + stat('●', l.pbs, l.maxPbs, 'Power Bombs') : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    renderSeed();
  }

  function renderSeed() {
    const sd = $('g-seed'), g = $('g-spoiler');
    if (!sd) return;
    const m = meta || {};
    sd.innerHTML = (m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span>' + (m.preset ? ' <small>' + esc(m.preset) + '</small>' : '') + '</div>' : '') +
      (m.hash ? '<div class="seedline fine">DASH seed code: <span class="selectable">' + esc(m.hash) + '</span></div>' : '');
    const sp = spoiler || {};
    if (!Object.keys(sp).length) { g.innerHTML = '<p class="empty">' + (m.seed ? 'This seed has no spoiler.' : 'Roll a seed here and its spoiler is kept behind this switch.') + '</p>'; return; }
    if (!reveal) { g.innerHTML = '<p class="empty">Hidden. Turn Reveal on to see where the bosses, the area doors and every item are.</p>'; return; }
    const bs = sp.Bosses || {}, at = sp['Area Transitions'] || {}, it = sp.Items || {};
    g.innerHTML = '<h5>Bosses</h5><ul>' + Object.keys(bs).map((k) => '<li>' + esc(k) + ': ' + esc(bs[k] || '—') + '</li>').join('') + '</ul>' +
      (Object.values(at).some(Boolean) ? '<h5>Area doors</h5><ul>' + Object.keys(at).map((k) => '<li>' + esc(k) + ' → ' + esc(at[k] || '—') + '</li>').join('') + '</ul>' : '') +
      '<h5>Items</h5>' + Object.keys(it).map((a) => '<details><summary>' + esc(a) + '</summary><ul>' + Object.keys(it[a]).map((k) => '<li>' + esc(k) + ': <b>' + esc(it[a][k] || '—') + '</b></li>').join('') + '</ul></details>').join('');
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readRam();
    if (!s) { live = null; if (window.SMRMap) SMRMap.setSamus(null); setLink(window.Snes9xPlayer && Snes9xPlayer.ready ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    if (window.SMRMap) SMRMap.setSamus(s);
    const sig = JSON.stringify([s.gear, s.bosses, s.minis, s.locs, s.energy, s.maxEnergy, s.reserve, s.missiles, s.maxMissiles, s.supers, s.maxSupers, s.pbs, s.maxPbs, s.started]);
    if (sig !== last) { last = sig; render(); }
  }

  const SMRTracker = {
    ram: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('smr:view') || 'items'; } catch (e) {}
      build(); loadManual(); render();
      setInterval(poll, 500);
    },
    setSession(id, label, m, sp, pl) {
      sessionId = id || 'manual'; meta = m || {}; spoiler = sp || {}; placed = pl || [];
      reveal = false; const cb = $('t-reveal'); if (cb) cb.checked = false;
      loadManual(); render();
    },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
  };
  window.SMRTracker = SMRTracker;
})();
