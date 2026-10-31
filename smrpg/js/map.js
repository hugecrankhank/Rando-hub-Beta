/*
 * map.js — the Super Mario RPG map: the world laid out the way the game's map
 * screen lays it out, one marker per place, zoomable. Tap a place for its
 * spots (its boss fights and key-item spots), ticked by the game or by hand.
 *
 *   SMRPGMap.init(el, { onToggle(kind, i) })      kind: 'bosses' | 'kspots'
 *   SMRPGMap.update({ bosses, kspots, bossLive, kspotLive, who, star, item })
 *
 * The picture is drawn here (an SVG), not taken from the game: the places sit
 * roughly where they are on the game's world map, joined in the order the game
 * joins them. bosses[i] / kspots[i] say whether BOSS_LOCATIONS[i] /
 * KEY_LOCATIONS[i] is done; with Reveal on, who[i] / star[i] / item[i] say
 * what's really there.
 */
(function () {
  'use strict';
  const D = window.SMRPG;
  const VW = 1000, VH = 680;
  // [name as the spots name it, label, x, y, kind]  kind: t town, d dungeon, k keep, w way (no spots)
  const PLACES = [
    ["Mario's Pad", "Mario's Pad", 215, 560, 't'], ['Mushroom Way', 'Mushroom Way', 300, 515, 'd'], ['Mushroom Kingdom', 'Mushroom Kingdom', 395, 468, 't'],
    ["Bandit's Way", "Bandit's Way", 485, 535, 'd'], ['Kero Sewers', 'Kero Sewers', 365, 392, 'd'], ['Midas River', 'Midas River', 315, 325, 'w'],
    ['Tadpole Pond', 'Tadpole Pond', 420, 290, 't'], ['Rose Way', 'Rose Way', 500, 405, 'w'], ['Rose Town', 'Rose Town', 585, 425, 't'],
    ['Forest Maze', 'Forest Maze', 645, 345, 'd'], ['Pipe Vault', 'Pipe Vault', 690, 470, 'w'], ["Yo'ster Isle", "Yo'ster Isle", 800, 565, 't'],
    ['Moleville Mines', 'Moleville', 555, 270, 't'], ['Booster Pass', 'Booster Pass', 630, 215, 'w'], ["Booster's Tower", "Booster's Tower", 690, 150, 'd'],
    ['Booster Hill', 'Booster Hill', 760, 210, 'w'], ['Marrymore', 'Marrymore', 845, 185, 't'], ['Star Hill', 'Star Hill', 885, 295, 'd'],
    ['Seaside Town', 'Seaside Town', 905, 405, 't'], ['Sunken Ship', 'Sunken Ship', 940, 500, 'd'], ["Land's End", "Land's End", 820, 590, 'w'],
    ["Belome's Temple", "Belome's Temple", 760, 645, 'd'], ['Monstro Town', 'Monstro Town', 685, 595, 't'], ['Bean Valley', 'Bean Valley', 590, 625, 'd'],
    ['Nimbus Land', 'Nimbus Land', 545, 100, 't'], ['Barrel Volcano', 'Barrel Volcano', 445, 165, 'd'], ["Bowser's Keep", "Bowser's Keep", 290, 175, 'k'],
    ['Factory', 'Factory', 190, 85, 'k'],
  ];
  const ROADS = [["Mario's Pad", 'Mushroom Way'], ['Mushroom Way', 'Mushroom Kingdom'], ['Mushroom Kingdom', "Bandit's Way"], ['Mushroom Kingdom', 'Kero Sewers'],
    ['Kero Sewers', 'Midas River'], ['Midas River', 'Tadpole Pond'], ['Mushroom Kingdom', 'Rose Way'], ['Rose Way', 'Rose Town'], ['Rose Town', 'Forest Maze'],
    ['Forest Maze', 'Pipe Vault'], ['Pipe Vault', "Yo'ster Isle"], ['Forest Maze', 'Moleville Mines'], ['Moleville Mines', 'Booster Pass'], ['Booster Pass', "Booster's Tower"],
    ["Booster's Tower", 'Booster Hill'], ['Booster Hill', 'Marrymore'], ['Marrymore', 'Star Hill'], ['Star Hill', 'Seaside Town'], ['Seaside Town', 'Sunken Ship'],
    ['Seaside Town', "Land's End"], ["Land's End", "Belome's Temple"], ["Land's End", 'Monstro Town'], ["Land's End", 'Bean Valley'], ['Bean Valley', 'Nimbus Land'],
    ['Nimbus Land', 'Barrel Volcano'], ["Mario's Pad", "Bowser's Keep"], ["Bowser's Keep", 'Factory']];
  const P = {}; PLACES.forEach((p) => { P[p[0]] = p; });
  const spotsOf = {};   // place -> [{ kind, i, name }]
  D.BOSS_LOCATIONS.forEach((b, i) => { (spotsOf[b[1]] = spotsOf[b[1]] || []).push({ kind: 'bosses', i, name: b[0] }); });
  D.KEY_LOCATIONS.forEach((k, i) => { (spotsOf[k[1]] = spotsOf[k[1]] || []).push({ kind: 'kspots', i, name: k[2] }); });

  let host, stage, svg, layer, pop, sel = null, onToggle = null;
  let view = { x: 0, y: 0, w: VW, h: VH }, moved = false;
  let st = { bosses: [], kspots: [], bossLive: () => false, kspotLive: () => false, who: null, star: null, item: null };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── the picture ──────────────────────────────────────────────────────────
  function scenery() {
    // the land: one big island, a small one for Yo'ster, clouds for Nimbus Land
    return '<defs><pattern id="mp-sea" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 q6.5 -5 13 0 t13 0" fill="none" stroke="rgba(120,160,230,.10)" stroke-width="1.5"/></pattern>' +
      '<filter id="mp-soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>' +
      '<rect x="-2000" y="-2000" width="5000" height="5000" fill="#0c1526"/><rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#mp-sea)"/>' +
      '<path d="M150 640 C110 560 120 470 170 420 C120 380 150 300 200 260 C180 200 240 120 320 130 C360 110 420 120 450 140 C480 90 560 70 620 100 C660 70 760 90 800 140 C870 120 950 170 960 240 C990 300 980 380 960 440 C990 500 950 560 900 600 C860 660 780 690 700 670 C640 690 560 690 500 650 C420 680 320 680 250 660 C210 660 180 660 150 640 Z" fill="#1a2a3d" stroke="#2f4663" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M760 540 C790 515 840 520 850 555 C860 590 820 615 785 605 C755 598 740 565 760 540 Z" fill="#1a2a3d" stroke="#2f4663" stroke-width="3"/>' +
      // mountains at the Keep and the volcano, hills, the sewer, the ship
      '<path d="M235 215 l30 -55 l20 30 l25 -45 l35 65 Z M405 205 l25 -50 l15 25 l20 -35 l30 60 Z" fill="#243650" stroke="#3a5478" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="885" cy="300" rx="34" ry="18" fill="#223550" stroke="#3a5478" stroke-width="2"/>' +
      '<path d="M495 90 q25 -40 60 -20 q25 -35 65 -5 q40 -10 45 30 q25 10 5 30 q-30 25 -80 15 q-40 20 -75 0 q-40 5 -45 -20 q-10 -25 25 -30 Z" fill="#2a3b58" stroke="#4b6690" stroke-width="2" opacity=".95"/>' +
      '<text x="545" y="62" class="mp-cap">in the clouds</text>' +
      '<text x="80" y="470" class="mp-cap" transform="rotate(-70 80 470)">the sea</text>';
  }
  function roads() {
    return ROADS.map(([a, b]) => { const A = P[a], B = P[b]; return '<line x1="' + A[2] + '" y1="' + A[3] + '" x2="' + B[2] + '" y2="' + B[3] + '" class="mp-road"/>'; }).join('');
  }
  function places() {   // HTML markers over the picture: the same size at every zoom
    return PLACES.map((p) => {
      const has = !!spotsOf[p[0]];
      return '<div class="mp-place k-' + p[4] + (has ? ' has' : ' bare') + '" data-place="' + esc(p[0]) + '"><i class="mp-dot">' + (has ? '<b class="mp-n"></b>' : '') + '</i><span class="mp-label">' + esc(p[1]) + '</span></div>';
    }).join('');
  }
  function placeMarkers() {
    const u = unitsPerPx();
    stage.classList.toggle('z-far', u > 2.3); stage.classList.toggle('z-mid', u > 1.35 && u <= 2.3);
    stage.querySelectorAll('.mp-place').forEach((m) => { const p = P[m.dataset.place], [x, y] = toScreen(p[2], p[3]); m.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; });
  }

  // ── view ─────────────────────────────────────────────────────────────────
  function apply() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); placeMarkers(); placePop(); }
  function unitsPerPx() { const r = stage.getBoundingClientRect(); return Math.max(view.w / r.width, view.h / r.height); }
  function fit() { const r = stage.getBoundingClientRect(), k = Math.max(VW / r.width, VH / r.height); view = { w: r.width * k, h: r.height * k, x: (VW - r.width * k) / 2, y: (VH - r.height * k) / 2 }; moved = false; apply(); }
  function zoomAt(sx, sy, f) {
    const r = stage.getBoundingClientRect(), u = unitsPerPx(), wx = view.x + (view.w - r.width * u) / 2 + sx * u, wy = view.y + (view.h - r.height * u) / 2 + sy * u;
    const nk = Math.max(0.12, Math.min(2.2, (view.w / VW) / f));
    const nw = VW * nk, nh = view.h / view.w * nw;
    view = { x: wx - (wx - view.x) * (nw / view.w), y: wy - (wy - view.y) * (nh / view.h), w: nw, h: nh }; moved = true; apply();
  }
  function toScreen(x, y) {   // SVG units -> px in the stage (the viewBox is centred, meet)
    const r = stage.getBoundingClientRect(), u = unitsPerPx();
    return [(x - view.x) / u - (view.w / u - r.width) / 2, (y - view.y) / u - (view.h / u - r.height) / 2];
  }
  function placePop() {
    if (!sel) { pop.hidden = true; return; }
    const p = P[sel], [x, y] = toScreen(p[2], p[3]), r = stage.getBoundingClientRect();
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(r.width - w - 4, x - w / 2)) + 'px';
    pop.style.top = (y - h - 26 > 4 ? y - h - 26 : y + 26) + 'px';
  }

  // ── pointer: drag to pan, pinch and wheel to zoom, tap a place ───────────
  const ptrs = new Map(); let drag = null, pinch = null, lastTap = 0;
  function pos(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function down(e) {
    if (e.button > 0 || e.target.closest('.mp-pop')) return;
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, far: false, target: e.target.closest('.mp-place') };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
  }
  function move(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, pos(e));
    const u = unitsPerPx();
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pinch.d > 0) zoomAt(mx, my, d / pinch.d);
      view.x -= (mx - pinch.mx) * unitsPerPx(); view.y -= (my - pinch.my) * unitsPerPx(); pinch = { d, mx, my }; moved = true; apply();
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.far = true;
      if (drag.far) { view.x = drag.vx - dx * u; view.y = drag.vy - dy * u; moved = true; apply(); }
    }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.far && ptrs.size === 0) {
      const now = Date.now(), g = drag.target;
      if (g && g.classList.contains('has')) { sel = sel === g.dataset.place ? null : g.dataset.place; lastTap = 0; paint(); }
      else if (now - lastTap < 300) { zoomAt(x, y, 2); lastTap = 0; }
      else { lastTap = now; if (sel) { sel = null; paint(); } }
    }
    if (ptrs.size === 0) drag = null;
  }

  // ── state onto the picture ───────────────────────────────────────────────
  function done(s) { return s.kind === 'bosses' ? !!st.bosses[s.i] : !!st.kspots[s.i]; }
  function paint() {
    stage.querySelectorAll('.mp-place.has').forEach((g) => {
      const list = spotsOf[g.dataset.place], n = list.filter(done).length;
      g.classList.toggle('all', n === list.length); g.classList.toggle('some', n > 0 && n < list.length); g.classList.toggle('sel', g.dataset.place === sel);
      g.querySelector('.mp-n').textContent = n + '/' + list.length;
      const stars = st.star ? list.filter((s) => s.kind === 'bosses' && st.star[s.i]).length : 0;
      g.classList.toggle('star', stars > 0);
    });
    if (sel) {
      const list = spotsOf[sel];
      pop.innerHTML = '<div class="mp-h">' + esc(P[sel][1]) + '</div>' + list.map((s) => {
        const d = done(s), liveT = s.kind === 'bosses' ? st.bossLive(s.i) : st.kspotLive(s.i);
        const extra = s.kind === 'bosses' ? ((st.star && st.star[s.i] ? '★ ' : '') + (st.who && st.who[s.i] && st.who[s.i] !== s.name ? st.who[s.i] : ''))
          : (st.item && st.item[s.i] ? st.item[s.i] : '');
        return '<button type="button" class="mp-spot' + (d ? ' have' : '') + (liveT ? ' live' : '') + '" data-kind="' + s.kind + '" data-i="' + s.i + '"><i></i><span>' + (s.kind === 'kspots' ? '🔑 ' : '') + esc(s.name) + '</span>' + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</button>';
      }).join('');
    }
    placePop();
  }

  const SMRPGMap = {
    init(el, opts) {
      host = el; onToggle = opts && opts.onToggle;
      host.innerHTML = '<div class="mp-bar"><span class="mp-hint">Tap a place for its spots · zoom in for the names</span><button type="button" class="mp-fit" title="Fit the map">⤢</button></div>' +
        '<div class="mp-stage"><svg class="mp-svg" xmlns="http://www.w3.org/2000/svg"><g class="mp-scenery">' + scenery() + '</g><g class="mp-roads">' + roads() + '</g></svg>' + places() + '<div class="mp-pop" hidden></div></div>';
      stage = host.querySelector('.mp-stage'); svg = host.querySelector('svg'); pop = host.querySelector('.mp-pop');
      host.querySelector('.mp-fit').addEventListener('click', fit);
      stage.style.touchAction = 'none';
      stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move); stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      stage.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
      pop.addEventListener('click', (e) => { const b = e.target.closest('.mp-spot'); if (b && onToggle && !b.classList.contains('live')) onToggle(b.dataset.kind, +b.dataset.i); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (!moved) fit(); else apply(); }).observe(stage);
      fit();
    },
    update(s) { st = Object.assign(st, s); paint(); },
    redraw() { if (!moved) fit(); else apply(); },
    get places() { return PLACES; },
  };
  window.SMRPGMap = SMRPGMap;
})();
