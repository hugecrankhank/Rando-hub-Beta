/*
 * tracker.js — the Zelda 1 + Metroid tracker: Link's and Samus's items (read
 * from both games, the one playing and the one waiting), every spot of both
 * worlds ticked as it's taken, coloured by the seed's own logic, and the
 * portals and the goal.
 *
 *   ZMTracker.init(el); .setSession(id, label, meta); .setCompact(on); .onLink(fn)
 */
(function () {
  'use strict';
  const Z = window.ZM, M = window.M1, G = window.ZMGen, K = window.ZMLink;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let root = null, sessionId = 'manual', meta = {}, manual = {}, link = 'manual', view = 'items', compact = false, reveal = false;
  const linkFns = [];
  // Zelda 1 alone (Z1Z3, ../z1z3/: window.ZM_ONLY = 'z1' before this file): no Samus, no Zebes
  const ONLY_Z1 = window.ZM_ONLY === 'z1';
  const SPOTS_HERE = () => (ONLY_Z1 ? G.SPOTS.filter((s) => s.game === 'z1') : G.SPOTS);

  // Link's items: [key, label, read(ram) → level, max, icon (../z1r/js/icons.js), tints per level]
  const Z_ITEMS = [
    ['sword', 'Sword', (r) => r[0x657], 3, 'sword', [null, { x: 'N', z: 'T' }, { x: 'W', z: 'G' }, { x: 'C', z: 'B' }]],
    ['boom', 'Boomerang', (r) => r[0x675] ? 2 : r[0x674] ? 1 : 0, 2, 'boomerang', [null, { x: 'N', z: 'Y' }, { x: 'B', z: 'C' }]],
    ['bow', 'Bow', (r) => r[0x65A], 0, 'bow'], ['arrows', 'Arrows', (r) => r[0x659], 2, 'arrow', [null, { x: 'Y', z: 'G' }, { x: 'W', z: 'C' }]],
    ['candle', 'Candle', (r) => r[0x65B], 2, 'candle', [null, { x: 'B', z: 'C' }, { x: 'R', z: 'O' }]], ['recorder', 'Recorder', (r) => r[0x65C], 0, 'recorder'],
    ['bait', 'Bait', (r) => r[0x65D], 0, 'bait'], ['wand', 'Wand', (r) => r[0x65F], 0, 'wand'], ['raft', 'Raft', (r) => r[0x660], 0, 'raft'],
    ['book', 'Book', (r) => r[0x661], 0, 'book'], ['ring', 'Ring', (r) => r[0x662], 2, 'ring', [null, { x: 'B', z: 'C' }, { x: 'R', z: 'O' }]], ['ladder', 'Ladder', (r) => r[0x663], 0, 'ladder'],
    ['mkey', 'Magical Key', (r) => r[0x664], 0, 'key'], ['bracelet', 'Bracelet', (r) => r[0x665], 0, 'bracelet'], ['letter', 'Letter', (r) => r[0x666] ? 1 : 0, 0, 'letter', [null, { x: 'G', z: 'G' }]],
    ['hearts', 'Hearts', (r) => (r[0x66F] >> 4) + 1, 16, 'heart'], ['triforce', 'Triforces', (r) => { let n = 0; for (let v = r[0x671]; v; v >>= 1) n += v & 1; return n; }, 8, 'triforce'],
  ];
  // Samus's: [key, label, gear bit, icon (js/icons.js)]
  const S_ITEMS = [
    ['mm', 'Maru Mari', 4, 'mm'], ['b', 'Bombs', 0, 'b'], ['hj', 'High Jump', 1, 'hj'], ['lb', 'Long Beam', 2, 'lb'], ['sa', 'Screw Attack', 3, 'sa'], ['va', 'Varia', 5, 'va'], ['wb', 'Wave Beam', 6, 'wb'], ['ib', 'Ice Beam', 7, 'ib'],
  ];
  const zIcon = (c, v) => window.Z1Icons ? Z1Icons.svg(c[4], c[5] && c[5][Math.min(Math.max(v, 1), c[5].length - 1)]) : '';
  const sIcon = (n) => window.M1Icons ? M1Icons.svg(n) : '';
  function readZelda() {
    const r = K.ram('z1'); if (!r || !K.inPlay('z1')) return null;
    const o = {}; Z_ITEMS.forEach(([k, , f]) => { o[k] = f(r) || 0; }); return o;
  }
  function readSamus() {
    const s = K.sram('m1'); if (!s || s.length < 0x900 || !K.inPlay('m1')) return null;
    const o = {}; S_ITEMS.forEach(([k, , bit]) => { o[k] = s[M.MEM.GEAR] & (1 << bit) ? 1 : 0; });
    o.tanks = s[M.MEM.TANKS]; o.missiles = s[M.MEM.MAX_MISSILES]; o.kraid = s[0x87B] ? 1 : 0; o.ridley = s[0x87C] ? 1 : 0;
    return o;
  }
  // the logic keys from what's held (Samus always has Maru Mari)
  function keys(z, s) {
    const v = new Set(['MM']);
    if (z) { if (z.sword) v.add('SW'); if (z.bow) v.add('BOW'); if (z.raft) v.add('RAFT'); if (z.ladder) v.add('LAD'); if (z.recorder) v.add('REC'); }
    if (s) { if (s.b) v.add('B'); if (s.hj) v.add('HJ'); if (s.ib) v.add('IB'); if (s.missiles) v.add('MI'); if (s.lb) v.add('LB'); if (s.sa) v.add('SA'); if (s.va) v.add('VA'); if (s.wb) v.add('WB'); }
    for (const k in manual.keys || {}) if (manual.keys[k]) v.add(k);
    return v;
  }

  function key() { return 'zmr:manual:' + sessionId; }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(k, i) {
    if (k === 'key') { manual.keys = manual.keys || {}; manual.keys[i] = !manual.keys[i]; }
    else { manual[k] = manual[k] || {}; if (manual[k][i]) delete manual[k][i]; else manual[k][i] = 1; }
    saveManual(); render();
  }

  function build() {
    const regions = []; SPOTS_HERE().forEach((s) => { let r = regions.find((x) => x.name === s.region); if (!r) regions.push(r = { name: s.name && s.region, locs: [] }); r.locs.push(s.i); });
    root.innerHTML =
      '<div class="t-stats" id="t-stats"></div>' +
      '<div class="t-tabs" role="tablist"><button type="button" role="tab" data-view="items">Items</button><button type="button" role="tab" data-view="map">Map</button><button type="button" role="tab" data-view="locs">Spots</button><button type="button" role="tab" data-view="seed">Seed</button></div>' +
      '<div class="t-view items">' +
        '<div class="t-sec"><h4>Link <span id="n-z"></span></h4><div class="grid gear" id="g-z"></div></div>' +
        '<div class="t-sec"' + (ONLY_Z1 ? ' hidden' : '') + '><h4>Samus <span id="n-s"></span></h4><div class="grid gear" id="g-s"></div><div class="mario-line" id="g-sline"></div></div>' +
        '<div class="t-sec"><h4>The way</h4><div id="g-way" class="goal"></div></div></div>' +
      '<div class="t-view locs"><div class="t-sec"><h4>Spots <span id="n-locs"></span></h4>' +
        '<p class="fine legend"><span class="dot ok"></span> reachable with what’s held (the seed’s logic) · <span class="dot no"></span> not yet · ' + (ONLY_Z1 ? 'an A Link to the Past item here is five rupees, until the hub hands it over' : 'a Metroid item in Hyrule is five rupees, a Hyrule item on Zebes a missile pack, until the hub hands it over') + '</p><div id="g-locs">' +
        regions.map((r, ri) => '<div class="area" data-r="' + ri + '"><h5><span>' + esc(r.name) + '</span><span class="an"></span></h5><div class="list">' +
          r.locs.map((i) => '<button type="button" class="chk" data-k="locs" data-i="' + i + '"><i></i>' + esc(G.SPOTS[i].name) + '<span class="what"></span></button>').join('') + '</div></div>').join('') +
        '</div></div></div>' +
      '<div class="t-view map"><div id="g-map"></div><p class="fine legend map-legend"><span class="dot ok"></span> in logic · <span class="dot no"></span> not yet · <span class="portal-dot"></span> a portal · Hyrule is drawn from the Zelda ROM being played; a dungeon’s spots sit on its entrance</p></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root._regions = regions;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    $('g-z').innerHTML = Z_ITEMS.map((c) => '<div class="cell gear" data-z="' + c[0] + '" title="' + esc(c[1]) + '"><span class="ico">' + zIcon(c, 1) + '</span><b>' + esc(c[1]) + '</b><small class="n"></small></div>').join('');
    $('g-s').innerHTML = S_ITEMS.map((c) => '<div class="cell gear" data-s="' + c[0] + '" title="' + esc(c[1]) + '"><span class="ico">' + sIcon(c[3]) + '</span><b>' + esc(c[1]) + '</b></div>').join('') +
      '<div class="cell gear wide" data-s="tanks"><span class="ico">' + sIcon('tank') + '</span><b>Tanks</b><small class="n"></small></div><div class="cell gear wide" data-s="missiles"><span class="ico">' + sIcon('missile') + '</span><b>Missiles</b><small class="n"></small></div>' +
      '<div class="cell gear" data-s="kraid"><span class="ico">' + sIcon('kraid') + '</span><b>Kraid</b></div><div class="cell gear" data-s="ridley"><span class="ico">' + sIcon('ridley') + '</span><b>Ridley</b></div>';
    if (window.ZMMap) ZMMap.init($('g-map'), { onToggle: (i) => toggle('locs', i), names: (i) => G.SPOTS[i].name });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (b && root.contains(b)) toggle(b.dataset.k, +b.dataset.i);
      if (e.target.id === 't-reveal') { reveal = e.target.checked; render(); }
    });
    setView(view);
  }
  function setView(v) {
    view = v; root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    if (v === 'map' && window.ZMMap) setTimeout(() => ZMMap.redraw(), 0);
    try { localStorage.setItem('zmr:view', v); } catch (e) {}
  }

  function render() {
    if (!root) return;
    const z = readZelda(), s = readSamus(), st = K.state, inv = keys(z, s);
    root.querySelectorAll('[data-z]').forEach((el) => { const c = Z_ITEMS.find((x) => x[0] === el.dataset.z), v = z ? z[c[0]] : 0; el.classList.toggle('have', v > 0); el.querySelector('.n').textContent = c[3] && v ? (c[3] > 3 ? v : v + '/' + c[3]) : ''; if (c[5]) el.querySelector('.ico').innerHTML = zIcon(c, v); });
    root.querySelectorAll('[data-s]').forEach((el) => { const k = el.dataset.s, v = s ? s[k] : 0; el.classList.toggle('have', !!v); const n = el.querySelector('.n'); if (n) n.textContent = v ? (k === 'tanks' ? v + '/8' : String(v)) : ''; });
    $('n-z').textContent = z ? Z_ITEMS.filter(([k]) => z[k] && k !== 'hearts' && k !== 'triforce').length + ' items · ' + z.hearts + ' hearts · ' + z.triforce + '/8 triforces' : 'not in play yet';
    $('n-s').textContent = s ? S_ITEMS.filter(([k]) => s[k]).length + '/8' : 'not in play yet';
    $('g-sline').innerHTML = s ? '<span>Tanks ' + s.tanks + '/8</span><span>Missiles ' + s.missiles + '</span>' + (s.kraid ? '<span>Kraid ✓</span>' : '') + (s.ridley ? '<span>Ridley ✓</span>' : '') : '';
    // spots
    const reach = G.reach(inv), taken = st.taken;
    let n = 0;
    root.querySelectorAll('[data-k="locs"]').forEach((b) => {
      const i = +b.dataset.i, have = taken.has(i) || !!(manual.locs && manual.locs[i]);
      if (have) n++;
      b.classList.toggle('have', have);
      b.classList.toggle('manual', !!(manual.locs && manual.locs[i]) && !taken.has(i));
      b.classList.toggle('r-ok', !have && reach[i] === 'ok');
      b.classList.toggle('r-no', !have && reach[i] === 'no');
      const w = b.querySelector('.what'); w.textContent = reveal && meta.items && meta.items[i] ? ' · ' + G.itemName({ game: meta.items[i][0], type: meta.items[i][1] }) : '';
    });
    root.querySelectorAll('.area').forEach((el) => { const r = root._regions[+el.dataset.r], d = r.locs.filter((i) => taken.has(i) || (manual.locs && manual.locs[i])).length; el.querySelector('.an').textContent = d + '/' + r.locs.length; el.classList.toggle('done', d === r.locs.length); });
    $('n-locs').textContent = n + '/' + SPOTS_HERE().length + ' · ' + reach.filter((v, i) => v === 'ok' && !taken.has(i) && (!ONLY_Z1 || G.SPOTS[i].game === 'z1')).length + ' in logic';
    if (window.ZMMap) ZMMap.update({ have: G.SPOTS.map((sp, i) => taken.has(i) || !!(manual.locs && manual.locs[i])), items: reveal && meta.items ? meta.items.map((it) => G.itemName({ game: it[0], type: it[1] })) : null, liveHave: (i) => taken.has(i), reach: G.SPOTS.map((sp, i) => taken.has(i) ? null : reach[i]) });
    // the way
    const here = st.game === 'z1' ? 'Hyrule' : 'Zebes';
    const waiting = (g) => st.pending[g].length ? ' · ' + st.pending[g].map(G.itemName).join(', ') + ' waiting for ' + (g === 'z1' ? 'Link' : 'Samus') : '';
    if (window.ZMWay) $('g-way').innerHTML = window.ZMWay(st, inv);   // the four-game combo's own words (../cross/nes-tracker.html)
    else $('g-way').innerHTML = '<span class="goal-r">Playing: ' + here + (K.atPortal(st.game) ? ' · at a portal' : '') + '</span>' +
      '<span class="goal-c">Portals: Hyrule’s take-any-road caves ($1D, $23, $49, $79) → Zebes; Zebes’ elevator rooms → Hyrule (⇄ / P).' + waiting('z1') + waiting('m1') + '</span>' +
      '<span class="goal-c">Goal: Ganon (' + (inv.has('T8') ? 'the eight triforces are in reach' : 'all eight triforces, then level 9') + ') and Mother Brain (' + (reach.length && M && window.M1Logic.has(M.GOALS[2][1], new Set(inv)) ? 'Tourian is in reach' : 'both statues, Bombs, missiles, Ice Beam') + ').</span>';
    const stat = (ico, v, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + v + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML = stat('✓', n, SPOTS_HERE().length, 'Spots taken') + stat('▲', z ? z.triforce : 0, 8, 'Triforces') + stat('♥', z ? z.hearts : 3, '', 'Hearts') + (ONLY_Z1 ? '' : stat('⚡', s ? s.tanks : 0, 8, 'Energy tanks')) +
      '<span class="stat game">' + (ONLY_Z1 ? 'Zelda 1' : here) + '</span>';
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    const sd = $('g-seed');
    sd.innerHTML = (meta.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(meta.seed) + '</span> <small>' + esc(meta.generator || '') + '</small></div>' : '<p class="empty">Roll a seed and it shows up here.</p>') +
      '<label class="reveal"><input type="checkbox" id="t-reveal"' + (reveal ? ' checked' : '') + '> Reveal (spoiler: every spot’s item)</label>' +
      (reveal && meta.spoiler ? '<details open><summary>Spoiler log</summary><pre class="spoiler selectable">' + esc(meta.spoiler) + '</pre></details>' : '');
  }

  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const playing = K.cores[K.game] && K.inPlay(K.game);
    setLink(playing ? 'live' : (window.EmuPlayer && EmuPlayer.core ? 'waiting' : 'manual'));
    const z = readZelda(), s = readSamus(), st = K.state;
    const sig = JSON.stringify([z, s, Array.from(st.taken), st.pending, st.game, K.atPortal(st.game)]);
    if (sig !== last) { last = sig; render(); }
    if (window.ZMMap) ZMMap.live();
    // the map follows the game being played: Hyrule for Zelda 1, Zebes for Metroid (even before the dot shows)
    if (st.game !== followGame && window.ZMMap && ZMMap.setWorld) { followGame = st.game; ZMMap.setWorld(st.game === 'm1' ? 1 : 0); }
  }
  let followGame = null;

  window.ZMTracker = {
    init(el) { root = el; try { view = localStorage.getItem('zmr:view') || 'items'; } catch (e) {} build(); loadManual(); render(); setInterval(poll, 500); K.onChange(() => { last = ''; }); },
    setSession(id, label, m) { sessionId = id || 'manual'; meta = m || {}; reveal = false; loadManual(); render(); },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get live() { return K.cores[K.game] && K.inPlay(K.game) ? { started: true, game: K.game } : null; },
  };
})();
