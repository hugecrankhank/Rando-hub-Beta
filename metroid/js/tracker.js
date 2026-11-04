/*
 * tracker.js — the Metroid tracker: Samus's gear, tanks and missiles, the
 * two statues (Kraid and Ridley), and every item spot by area, read from the
 * running game's memory (autotracking) or ticked by hand.
 *
 *   M1Tracker.init(el)
 *   M1Tracker.setSession(id, label, meta, placed)   placed: the seed's items per spot (ours), for Reveal and the logic
 *   M1Tracker.mem = () => { wram, sram } | null
 *   M1Tracker.onLink(fn)      'manual' | 'waiting' | 'live'
 *
 * The game records every unique item it has handed out ($6887.., as (type,
 * map x, map y)), so the spots tick themselves as you collect; beams (Long,
 * Wave, Ice) aren't recorded, they respawn, so those spots are ticked by
 * hand (or show as taken when you hold that beam and the seed is ours).
 * With the seed's placements known, js/logic.js colours each spot: green =
 * reachable with what Samus has now, red = not yet.
 */
(function () {
  'use strict';
  const D = window.M1, L = window.M1Logic;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, placed = [], manual = {}, link = 'manual';
  const linkFns = [];
  let live = null, view = 'items', compact = false, reveal = false;

  // ── state from RAM ───────────────────────────────────────────────────────
  function readRam() {
    const m = M1Tracker.mem && M1Tracker.mem();
    if (!m || !m.wram || m.wram.length < 0x800) return null;
    const w = m.wram, sr = m.sram && m.sram.length >= 0x900 ? m.sram : null, M = D.MEM;
    if (!sr) return null;
    const gearByte = sr[M.GEAR], n = Math.min(sr[M.TAKEN_N], 0x74) & ~1;
    const taken = new Set();
    for (let i = 0; i < n; i += 2) taken.add(sr[M.TAKEN + i] | sr[M.TAKEN + i + 1] << 8);
    const s = {
      gear: D.GEAR.map((g) => !!(gearByte & (1 << g[1]))),
      bosses: D.BOSSES.map((b) => !!(sr[b[1]] & 0x80)),
      locs: D.SPOTS.map((sp, i) => {
        // the item the spot holds (ours: known; another seed: whatever the game gave, unknown → try every type)
        const t = placed[i] ? placed[i].type : -1;
        if (t >= 0) { if (D.BEAMS.includes(t)) return false; const id = D.itemId(sp, t); return taken.has(id[0] | id[1] << 8); }
        for (let k = 0; k < 10; k++) { if (D.BEAMS.includes(k)) continue; const id = D.itemId(sp, k); if (taken.has(id[0] | id[1] << 8)) return true; }
        return false;
      }),
      tanks: sr[M.TANKS], missiles: sr[M.MISSILES], maxMissiles: sr[M.MAX_MISSILES],
      hp: (w[M.HP_HI] >> 4) * 100 + (w[M.HP_HI] & 15) * 10 + (w[M.HP_LO] >> 4),
      mode: w[M.MODE], area: D.AREA_CODE[w[M.AREA] & 0x0F], mapX: w[M.MAP_X], mapY: w[M.MAP_Y], sx: w[M.SX], sy: w[M.SY],
      started: false,
    };
    // playing: the game engine running (mode 0), somewhere on the map, with sane stats
    s.started = s.mode === 0 && s.area !== undefined && s.mapX < 32 && s.mapY < 32 && s.tanks <= 6 && s.maxMissiles <= 255 && (w[M.HP_HI] | w[M.HP_LO]) !== 0;
    return s;
  }
  function isLive(k, i) { return !!(live && live.started && live[k] && live[k][i]); }
  function state() {
    const has = (k, n) => Array.from({ length: n }, (_, i) => isLive(k, i) || !!(manual[k] && manual[k][i]));
    const s = { gear: has('gear', D.GEAR.length), bosses: has('bosses', D.BOSSES.length), locs: has('locs', D.SPOTS.length) };
    // a beam Samus holds, in our seed: its spot(s) count as visited when only one holds it
    if (placed.length) D.GEAR.forEach((g, gi) => {
      const t = D.ITEMS.indexOf(g[0]);
      if (!s.gear[gi] || !D.BEAMS.includes(t)) return;
      const at = placed.map((p, i) => p.type === t ? i : -1).filter((i) => i >= 0);
      if (at.length === 1) s.locs[at[0]] = true;
    });
    return s;
  }

  // ── manual ticks ─────────────────────────────────────────────────────────
  function key() { return 'm1r:manual:' + sessionId; }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(k, i) {
    if (isLive(k, i)) return;
    manual[k] = manual[k] || {};
    if (manual[k][i]) delete manual[k][i]; else manual[k][i] = 1;
    saveManual(); render();
  }

  // ── logic: what Samus can reach with what she has ─────────────────────────
  function inventory(s) {
    const inv = new Set();
    D.GEAR.forEach((g, i) => { if (s.gear[i]) inv.add(L.KEY[D.ITEMS.indexOf(g[0])]); });
    const l = live && live.started ? live : null;
    if ((l && l.maxMissiles > 0) || (manual.mi && manual.mi[0])) inv.add('MI');
    if (s.bosses[0] && s.bosses[1]) inv.add('ST');
    if (meta.startMaru) inv.add('MM');
    // a beam that sits somewhere she can get to counts (it respawns; Wave and Ice swap)
    if (placed.length) { let grew = true; while (grew) { grew = false; const r = L.reach(inv); placed.forEach((p, i) => { if (r[i] === 'ok' && D.BEAMS.includes(p.type) && !inv.has(L.KEY[p.type])) { inv.add(L.KEY[p.type]); grew = true; } }); } }
    return inv;
  }
  let reach = null;
  function paintReach(s) {
    const inv = inventory(s);
    reach = L.reach(inv);
    root.querySelectorAll('[data-k="locs"]').forEach((b) => {
      const i = +b.dataset.i, r = s.locs[i] ? null : reach[i];
      b.classList.toggle('r-ok', r === 'ok'); b.classList.toggle('r-no', r === 'no');
    });
    const lg = $('t-legend');
    if (lg) lg.innerHTML = '<span class="dot ok"></span> reachable with what Samus has · <span class="dot no"></span> not yet — careful rules: no bomb jumps or tricks';
    const goals = $('t-goals');
    const invB = new Set(inv); if (L.has(D.GOALS[0][1], inv) && L.has(D.GOALS[1][1], inv)) invB.add('ST');   // both bosses beatable = the statues can be raised
    if (goals) goals.innerHTML = D.GOALS.map((g, i) => { const ok = L.has(g[1], invB); const done = i < 2 && s.bosses[i]; return '<span class="goal-l ' + (done ? 'done' : ok ? 'ok' : 'no') + '">' + esc(g[0]) + (done ? ' ✓' : ok ? ' · open' : ' · not yet') + '</span>'; }).join('');
    return inv;
  }

  // ── rendering ────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SHORT = { 'High Jump': 'Hi-Jump', 'Long Beam': 'Long', 'Screw Attack': 'Screw', 'Maru Mari': 'Maru Mari', 'Wave Beam': 'Wave', 'Ice Beam': 'Ice' };

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
        '<div class="t-sec"><h4>Statues <span id="n-bosses"></span></h4><div class="grid bosses" id="g-bosses"><button type="button" class="cell boss" data-k="mi" data-i="0" title="A missile pack: red doors and the bosses (ticks itself from the game)"><b>Missiles</b></button></div></div>' +
        '<div class="t-sec"><h4>Way out</h4><div class="goals" id="t-goals"></div></div></div>' +
      '<div class="t-view map"><div class="t-sec"><h4>Map <span id="n-map"></span></h4><div id="g-map"></div></div></div>' +
      '<div class="t-view locs"><div class="t-sec"><h4>Item spots <span id="n-locs"></span></h4><p class="fine">The game ticks a spot as you take its item (beams respawn: tick those yourself). With Reveal on, each spot shows what’s there.</p><p class="fine legend" id="t-legend"></p><div id="g-locs"></div></div></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div>' +
        '<div class="t-sec"><h4>Spoiler <label class="reveal"><input type="checkbox" id="t-reveal"> Reveal</label></h4><div id="g-spoiler"></div></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    $('t-reveal').addEventListener('change', () => { reveal = $('t-reveal').checked; render(); });
    $('g-gear').innerHTML = D.GEAR.map((g, i) => '<button type="button" class="cell gear" data-k="gear" data-i="' + i + '" title="' + esc(g[0]) + '"><b>' + esc(SHORT[g[0]] || g[0]) + '</b></button>').join('');
    $('g-bosses').insertAdjacentHTML('afterbegin', D.BOSSES.map((b, i) => '<button type="button" class="cell boss" data-k="bosses" data-i="' + i + '" title="' + esc(b[0]) + ' beaten: the statue is raised"><b>' + esc(b[0]) + '</b></button>').join(''));
    $('g-locs').innerHTML = D.AREAS.map((a, ai) => {
      const idx = D.SPOTS.map((s, i) => s[0] === ai ? i : -1).filter((i) => i >= 0);
      if (!idx.length) return '';
      return '<div class="area"><h5>' + esc(a) + ' <span class="an" data-area="' + ai + '"></span></h5><div class="list">' +
        idx.map((i) => '<button type="button" class="chk" data-k="locs" data-i="' + i + '"><i></i>' + esc(D.SPOTS[i][6]) + '<span class="what"></span></button>').join('') + '</div></div>';
    }).join('');
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) toggle(b.dataset.k, +b.dataset.i); });
    if (window.M1Map) M1Map.init($('g-map'), { onToggle: (i) => toggle('locs', i) });
    setView(view);
  }
  function setView(v) {
    view = v; root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    try { localStorage.setItem('m1r:view', v); } catch (e) {}
    if (v === 'map' && window.M1Map) M1Map.redraw();
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
    ['gear', 'bosses', 'locs'].forEach(paint);
    const l = live && live.started ? live : null;
    const mi = root.querySelector('[data-k="mi"]');
    mi.classList.toggle('have', !!((l && l.maxMissiles > 0) || (manual.mi && manual.mi[0])));
    mi.classList.toggle('manual', !!(manual.mi && manual.mi[0]) && !(l && l.maxMissiles > 0));
    root.querySelectorAll('[data-k="locs"]').forEach((b) => {
      const p = placed[+b.dataset.i];
      b.querySelector('.what').textContent = reveal && p ? ' · ' + p.item : '';
    });
    root.querySelectorAll('.an').forEach((el) => {
      const ai = +el.dataset.area, idx = D.SPOTS.map((sp, i) => sp[0] === ai ? i : -1).filter((i) => i >= 0);
      const n = idx.filter((i) => s.locs[i]).length;
      el.textContent = n + '/' + idx.length;
      el.parentElement.parentElement.classList.toggle('done', n === idx.length);
    });
    $('n-gear').textContent = count('gear') + '/' + D.GEAR.length;
    $('n-bosses').textContent = count('bosses') + '/2';
    $('n-locs').textContent = count('locs') + '/' + D.SPOTS.length;
    $('n-map').textContent = count('locs') + '/' + D.SPOTS.length;
    const inv = paintReach(s);
    if (window.M1Map) M1Map.update({ have: s.locs, items: reveal ? placed.map((p) => p.item) : null, liveHave: (i) => isLive('locs', i), reach: s.locs.map((h, i) => h ? null : reach[i]) });
    const stat = (ico, n, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + n + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML =
      stat('⚑', count('locs'), D.SPOTS.length, 'Item spots taken') +
      stat('☠', count('bosses'), 2, 'Statues raised (Kraid, Ridley)') +
      (l ? stat('♥', l.hp, (l.tanks + 1) * 100 - 1, 'Energy (tanks ' + l.tanks + ')') + stat('➶', l.missiles, l.maxMissiles, 'Missiles') : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    renderSeed(inv);
  }

  function renderSeed(inv) {
    const sd = $('g-seed'), g = $('g-spoiler');
    if (!sd) return;
    const m = meta || {};
    sd.innerHTML = (m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span> <small>' + (m.startMaru ? 'start with Maru Mari' : 'Maru Mari in place') + (m.hash ? ' · ' + esc(m.hash) : '') + '</small></div>' : m.source === 'file' ? '<div class="seedline fine">A ROM from elsewhere: the spots tick, but what’s where isn’t known, so there’s no logic colouring.</div>' : '') +
      (inv ? '<div class="seedline fine">Logic: Samus has ' + esc(Array.from(inv).filter((k) => k !== 'ST').join(', ') || 'nothing') + (inv.has('ST') ? ' · both statues' : '') + (reach ? ' · ' + reach.filter((r) => r === 'ok').length + ' spots in reach' : '') + '</div>' : '');
    if (!placed.length) { g.innerHTML = '<p class="empty">' + (m.seed ? 'This seed has no spoiler.' : 'Roll a seed here and its spoiler is kept behind this switch.') + '</p>'; return; }
    if (!reveal) { g.innerHTML = '<p class="empty">Hidden. Turn Reveal on to see what every spot holds.</p>'; return; }
    g.innerHTML = D.AREAS.map((a) => { const in_ = placed.filter((p) => p.area === a); return in_.length ? '<details><summary>' + esc(a) + '</summary><ul>' + in_.map((p) => '<li>' + esc(p.name) + ': <b>' + esc(p.item) + '</b></li>').join('') + '</ul></details>' : ''; }).join('');
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readRam();
    if (!s) { live = null; if (window.M1Map) M1Map.setSamus(null); setLink(window.EmuPlayer && EmuPlayer.ready ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    if (window.M1Map) M1Map.setSamus(s.started ? s : null);
    const sig = JSON.stringify([s.gear, s.bosses, s.locs, s.tanks, s.missiles, s.maxMissiles, s.hp, s.started]);
    if (sig !== last) { last = sig; render(); }
  }

  const M1Tracker = {
    mem: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('m1r:view') || 'items'; } catch (e) {}
      build(); loadManual(); render();
      setInterval(poll, 500);
    },
    setSession(id, label, m, pl) {
      sessionId = id || 'manual'; meta = m || {}; placed = pl || [];
      reveal = false; const cb = $('t-reveal'); if (cb) cb.checked = false;
      loadManual(); render();
    },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
  };
  window.M1Tracker = M1Tracker;
})();
