/*
 * tracker.js — the SMZ3 tracker: both games' items, the dungeon and Metroid
 * bosses with their prizes, and every one of the 316 locations, ticked from
 * the game's memory as you play (whichever game is running: the other one's
 * state is read from its save RAM). Locations are coloured by the SMZ3 logic
 * itself (gen/smz3gen.js): green = reachable with what you have.
 *
 *   SMZ3Tracker.ram  = () => WRAM    SMZ3Tracker.sram = () => SRAM    SMZ3Tracker.rom = () => ROM
 *   SMZ3Tracker.init(el); .setSession(id, label, meta); .setCompact(on); .onLink(fn)
 */
(function () {
  'use strict';
  const D = window.SMZ3D, G = window.SMZ3Gen, T = G.IT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let root = null, sessionId = 'manual', meta = {}, manual = {}, link = 'manual', view = 'items', compact = false, reveal = false;
  const linkFns = [];
  let live = null, logic = null, logicRom = null;

  // the locations, by region, as the generator has them
  const blank = G.blankWorld();
  const LOCS = blank.Locations.map((l) => ({ id: l.Id, name: l.Name, region: l.Region.Name, area: l.Region.Area, z3: !!l.Region.isZ3, mem: D.MEM[l.Id] }));
  const REGIONS = [];
  blank.Regions.forEach((r) => REGIONS.push({ name: r.Name, z3: !!r.isZ3, locs: LOCS.map((l, i) => l.region === r.Name ? i : -1).filter((i) => i >= 0) }));
  const short = (loc) => loc.name.indexOf(loc.region + ' - ') === 0 ? loc.name.slice(loc.region.length + 3) : loc.name;

  // the inventory cells: [key, label, how to read it]
  const Z3_ITEMS = [
    ['sword', 'Sword', (z) => z[0x359] && z[0x359] < 5 ? z[0x359] : 0, 4], ['shield', 'Shield', (z) => z[0x35A], 3], ['mail', 'Mail', (z) => z[0x35B], 2],
    ['bow', 'Bow', (z) => z[0x340] ? 1 : 0], ['silvers', 'Silvers', (z) => (z[0x38E] & 0x40) || z[0x340] >= 3 ? 1 : 0],
    ['boomb', 'Blue Boomerang', (z) => z[0x38C] & 0x80 ? 1 : 0], ['boomr', 'Red Boomerang', (z) => z[0x38C] & 0x40 ? 1 : 0],
    ['hook', 'Hookshot', (z) => z[0x342] ? 1 : 0], ['mush', 'Mushroom', (z) => z[0x38C] & 0x28 ? 1 : 0], ['powder', 'Powder', (z) => z[0x38C] & 0x10 ? 1 : 0],
    ['fire', 'Fire Rod', (z) => z[0x345] ? 1 : 0], ['ice', 'Ice Rod', (z) => z[0x346] ? 1 : 0], ['bombos', 'Bombos', (z) => z[0x347] ? 1 : 0],
    ['ether', 'Ether', (z) => z[0x348] ? 1 : 0], ['quake', 'Quake', (z) => z[0x349] ? 1 : 0], ['lamp', 'Lamp', (z) => z[0x34A] ? 1 : 0],
    ['hammer', 'Hammer', (z) => z[0x34B] ? 1 : 0], ['shovel', 'Shovel', (z) => z[0x38C] & 0x04 ? 1 : 0], ['flute', 'Flute', (z) => (z[0x38C] & 0x03) || z[0x34C] >= 2 ? 1 : 0],
    ['net', 'Bug Net', (z) => z[0x34D] ? 1 : 0], ['book', 'Book', (z) => z[0x34E] ? 1 : 0], ['bottle', 'Bottles', (z) => z[0x34F] || 0, 4],
    ['somaria', 'Somaria', (z) => z[0x350] ? 1 : 0], ['byrna', 'Byrna', (z) => z[0x351] ? 1 : 0], ['cape', 'Cape', (z) => z[0x352] ? 1 : 0],
    ['mirror', 'Mirror', (z) => z[0x353] ? 1 : 0], ['glove', 'Gloves', (z) => z[0x354], 2], ['boots', 'Boots', (z) => z[0x355] ? 1 : 0],
    ['flippers', 'Flippers', (z) => z[0x356] ? 1 : 0], ['pearl', 'Moon Pearl', (z) => z[0x357] ? 1 : 0], ['magic', '½ Magic', (z) => z[0x37B] ? 1 : 0],
  ];
  const SM_ITEMS = [
    ['charge', 'Charge', (m) => m.beams & 0x1000 ? 1 : 0], ['smice', 'Ice', (m) => m.beams & 0x2 ? 1 : 0], ['wave', 'Wave', (m) => m.beams & 0x1 ? 1 : 0],
    ['spazer', 'Spazer', (m) => m.beams & 0x4 ? 1 : 0], ['plasma', 'Plasma', (m) => m.beams & 0x8 ? 1 : 0],
    ['varia', 'Varia', (m) => m.items & 0x1 ? 1 : 0], ['gravity', 'Gravity', (m) => m.items & 0x20 ? 1 : 0], ['morph', 'Morph', (m) => m.items & 0x4 ? 1 : 0],
    ['bombs', 'Bombs', (m) => m.items & 0x1000 ? 1 : 0], ['spring', 'Spring Ball', (m) => m.items & 0x2 ? 1 : 0], ['screw', 'Screw', (m) => m.items & 0x8 ? 1 : 0],
    ['hijump', 'Hi-Jump', (m) => m.items & 0x100 ? 1 : 0], ['space', 'Space Jump', (m) => m.items & 0x200 ? 1 : 0], ['speed', 'Speed', (m) => m.items & 0x2000 ? 1 : 0],
    ['grapple', 'Grapple', (m) => m.items & 0x4000 ? 1 : 0], ['xray', 'X-Ray', (m) => m.items & 0x8000 ? 1 : 0],
    ['etank', 'E-Tanks', (m) => Math.max(0, Math.floor((m.energy - 99) / 100)), 14], ['reserve', 'Reserves', (m) => Math.floor(m.reserve / 100), 4],
    ['missile', 'Missiles', (m) => m.missiles, 999], ['super', 'Supers', (m) => m.supers, 999], ['pb', 'Power Bombs', (m) => m.pbs, 999],
  ];
  // the pictures: Link's items are the hub's Zelda 3 tracker's (../tracker/items/<name><level>.png), Samus's js/icons.js
  const Z3_PIC = { sword: 'sword', shield: 'shield', mail: 'mail', bow: 'bow10', silvers: 'bow12', boomb: 'boomerang10', boomr: 'boomerang01', hook: 'hookshot', mush: 'mushroom', powder: 'powder10',
    fire: 'firerod', ice: 'icerod', bombos: 'bombos10', ether: 'ether10', quake: 'quake10', lamp: 'lamp', hammer: 'hammer', shovel: 'shovel', flute: 'flute10', net: 'net', book: 'book', bottle: 'bottle',
    somaria: 'caneofsomaria', byrna: 'caneofbyrna', cape: 'cape', mirror: 'mirror', glove: 'gloves', boots: 'boots', flippers: 'flippers', pearl: 'moonpearl', magic: 'halfmagic' };
  const LEVELLED = { sword: 4, shield: 3, mail: 2, bottle: 4, glove: 2 };
  function z3Pic(k, v) {
    const n = Z3_PIC[k]; if (!n) return '';
    const lv = LEVELLED[k] ? Math.min(LEVELLED[k], Math.max(1, v || 0)) : '';
    return '<img src="../tracker/items/' + n + (/\d$/.test(n) ? '' : (LEVELLED[k] ? lv : '1')) + '.png" alt="">';
  }
  const smPic = (k) => window.SMIcons ? SMIcons.svg(k) : '';
  // the bosses: Zelda's by their boss location, Metroid's by their boss bits (area, mask)
  const Z3_BOSSES = [['Eastern Palace', 'Armos Knights'], ['Desert Palace', 'Lanmolas'], ['Tower of Hera', 'Moldorm'], ['Palace of Darkness', 'Helmasaur King'],
    ['Swamp Palace', 'Arrghus'], ['Skull Woods', 'Mothula'], ["Thieves' Town", 'Blind'], ['Ice Palace', 'Kholdstare'], ['Misery Mire', 'Vitreous'], ['Turtle Rock', 'Trinexx']];
  const BOSS_LOC = Z3_BOSSES.map(([r, b]) => LOCS.findIndex((l) => l.name === r + ' - ' + b));
  const SM_BOSSES = [['Brinstar Kraid', 'Kraid', 1], ['Wrecked Ship', 'Phantoon', 3], ['Maridia Inner', 'Draygon', 4], ['Norfair Lower East', 'Ridley', 2]];

  // ── reading the game ─────────────────────────────────────────────────────
  function readLive() {
    const r = SMZ3Tracker.ram && SMZ3Tracker.ram(), s = SMZ3Tracker.sram && SMZ3Tracker.sram();
    if (!r || r.length < 0x20000 || !s || s.length < 0x3400) return null;
    const g = s[D.SRAM.GAME];
    const game = g === 0 ? 'z3' : g === 0xFF ? 'sm' : 'credits';
    const zb = game === 'z3' ? 0xF000 : D.SRAM.Z3, zsrc = game === 'z3' ? r : s;
    const z = zsrc.subarray(zb, zb + 0x500);
    const sb = D.SRAM.SM;
    const w16 = (a, o) => a[o] | a[o + 1] << 8;
    const m = game === 'sm' ?
      { items: w16(r, 0x9A4), beams: w16(r, 0x9A8), energy: w16(r, 0x9C4), missiles: w16(r, 0x9C8), supers: w16(r, 0x9CC), pbs: w16(r, 0x9D0), reserve: w16(r, 0x9D4), bits: r.subarray(0xD870, 0xD890), bosses: r.subarray(0xD828, 0xD830) } :
      { items: w16(s, sb + 2), beams: w16(s, sb + 6), energy: w16(s, sb + 0x22), missiles: w16(s, sb + 0x26), supers: w16(s, sb + 0x2A), pbs: w16(s, sb + 0x2E), reserve: w16(s, sb + 0x32), bits: s.subarray(sb + 0xB0, sb + 0xD0), bosses: s.subarray(sb + 0x68, sb + 0x70) };
    // a game going: Zelda's module $10 / Metroid's game state $0998 past their title and file select
    const started = game === 'credits' || (game === 'z3' ? r[0x10] >= 0x06 && r[0x10] <= 0x1B : r[0x998] >= 0x06 && r[0x998] <= 0x28);
    const checks = LOCS.map((l) => {
      const k = l.mem; if (!k) return false;
      if (k[0] === 'sm') return !!(m.bits[k[1]] & k[2]);
      if (k[0] === 'misc') return !!(z[0x280 + k[1]] & k[2]);
      return !!(w16(z, k[1] * 2) & (1 << k[2]));
    });
    const inv = {};
    Z3_ITEMS.forEach(([k, , f]) => { inv[k] = f(z) || 0; });
    SM_ITEMS.forEach(([k, , f]) => { inv[k] = f(m) || 0; });
    const smBoss = SM_BOSSES.map(([, , area]) => !!(m.bosses[area] & 1));
    const z3Boss = BOSS_LOC.map((i) => i >= 0 && checks[i]);
    return { game, started, checks, inv, smBoss, z3Boss, aga: z[0x3C5] >= 3, pendants: z[0x374], crystals: z[0x37A], hearts: z[0x36C] >> 3, wram: r };
  }

  // the logic: the world as this ROM has it, and what the inventory reaches
  function logicWorld() {
    let rom = null; try { rom = SMZ3Tracker.rom && SMZ3Tracker.rom(); } catch (e) {}
    if (rom && rom.length % 1024 === 512) rom = rom.subarray(512);
    if (rom !== logicRom) { logicRom = rom; logic = rom ? G.romWorld(rom) : null; }
    return logic;
  }
  function itemTypes(inv) {
    const out = [], n = (t, c) => { for (let i = 0; i < c; i++) out.push(t); };
    n(T.ProgressiveSword, inv.sword); n(T.ProgressiveShield, inv.shield); n(T.ProgressiveTunic, inv.mail); n(T.ProgressiveGlove, inv.glove);
    const one = { bow: T.Bow, silvers: T.SilverArrows, boomb: T.BlueBoomerang, boomr: T.RedBoomerang, hook: T.Hookshot, mush: T.Mushroom, powder: T.Powder, fire: T.Firerod, ice: T.Icerod,
      bombos: T.Bombos, ether: T.Ether, quake: T.Quake, lamp: T.Lamp, hammer: T.Hammer, shovel: T.Shovel, flute: T.Flute, net: T.Bugnet, book: T.Book, bottle: T.Bottle, somaria: T.Somaria,
      byrna: T.Byrna, cape: T.Cape, mirror: T.Mirror, boots: T.Boots, flippers: T.Flippers, pearl: T.MoonPearl, magic: T.HalfMagic,
      charge: T.Charge, smice: T.Ice, wave: T.Wave, spazer: T.Spazer, plasma: T.Plasma, varia: T.Varia, gravity: T.Gravity, morph: T.Morph, bombs: T.Bombs, spring: T.SpringBall,
      screw: T.ScrewAttack, hijump: T.HiJump, space: T.SpaceJump, speed: T.SpeedBooster, grapple: T.Grapple, xray: T.XRay };
    for (const k in one) if (inv[k]) out.push(one[k]);
    n(T.ETank, inv.etank); n(T.ReserveTank, inv.reserve);
    if (inv.missile) out.push(T.Missile);
    if (inv.super) out.push(T.Super);
    if (inv.pb) n(T.PowerBomb, inv.pb >= 10 ? 2 : 1);
    return out;
  }

  // ── state: live ticks + manual ones ──────────────────────────────────────
  function key() { return 'smz3r:manual:' + sessionId; }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function isLive(k, i) { return !!(live && live.started && live[k] && live[k][i]); }
  function inv() {
    const out = {};
    Z3_ITEMS.concat(SM_ITEMS).forEach(([k]) => { const l = live && live.started ? live.inv[k] : 0, m = manual.inv && manual.inv[k] || 0; out[k] = Math.max(l, m); });
    return out;
  }
  function state() {
    const checks = LOCS.map((_, i) => isLive('checks', i) || !!(manual.checks && manual.checks[i]));
    return { checks, inv: inv() };
  }
  function toggle(k, i) {
    if (k === 'inv') {
      const cell = Z3_ITEMS.concat(SM_ITEMS).find((x) => x[0] === i), max = cell[3] || 1;
      manual.inv = manual.inv || {};
      const cur = inv()[i];
      if (max > 50) { const v = prompt(cell[1] + ': how many?', String(cur)); if (v === null) return; manual.inv[i] = Math.max(0, parseInt(v, 10) || 0); }
      else manual.inv[i] = cur >= max ? 0 : cur + 1;
      if (live && live.started && manual.inv[i] < live.inv[i]) manual.inv[i] = 0;
    } else {
      manual[k] = manual[k] || {};
      if (manual[k][i]) delete manual[k][i]; else manual[k][i] = 1;
    }
    saveManual(); render();
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  function build() {
    root.innerHTML =
      '<div class="t-stats" id="t-stats"></div>' +
      '<div class="t-tabs" role="tablist">' +
        '<button type="button" role="tab" data-view="items">Items</button>' +
        '<button type="button" role="tab" data-view="map">Map</button>' +
        '<button type="button" role="tab" data-view="bosses">Bosses</button>' +
        '<button type="button" role="tab" data-view="checks">Checks</button>' +
        '<button type="button" role="tab" data-view="seed">Seed</button>' +
      '</div>' +
      '<div class="t-view items"><div class="t-sec"><h4>Zelda <span id="n-z3"></span></h4><div class="grid gear" id="g-z3"></div></div>' +
        '<div class="t-sec"><h4>Super Metroid <span id="n-sm"></span></h4><div class="grid gear" id="g-sm"></div></div></div>' +
      '<div class="t-view bosses"><div class="t-sec"><h4>Dungeons <span id="n-dun"></span></h4><div class="grid bosses" id="g-dun"></div></div>' +
        '<div class="t-sec"><h4>Metroid bosses <span id="n-smb"></span></h4><div class="grid bosses" id="g-smb"></div></div>' +
        '<div class="t-sec"><h4>The way to the end</h4><div id="g-goal" class="goal-box"></div></div></div>' +
      '<div class="t-view checks"><div class="t-sec"><h4>Locations <span id="n-checks"></span></h4>' +
        '<p class="fine legend"><span class="dot ok"></span> reachable now (SMZ3’s own logic, keys aside) · <span class="dot no"></span> not yet</p><div id="g-checks"></div></div></div>' +
      '<div class="t-view map"><div id="g-map"></div><p class="fine legend map-legend"><span class="dot ok"></span> in logic · <span class="dot no"></span> not yet · a dungeon’s checks sit on its marker; Zebes is drawn from the ROM being played</p></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    const cell = (pic) => ([k, label]) => '<button type="button" class="cell gear" data-k="inv" data-i="' + k + '" title="' + esc(label) + '"><span class="ico">' + pic(k) + '</span><b>' + esc(label) + '</b><small class="n"></small></button>';
    $('g-z3').innerHTML = Z3_ITEMS.map(cell((k) => z3Pic(k, 1))).join('');
    $('g-sm').innerHTML = SM_ITEMS.map(cell(smPic)).join('');
    const BOSS_PIC = ['boss0', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'boss6', 'boss7', 'boss8', 'boss9'];
    $('g-dun').innerHTML = Z3_BOSSES.map(([r, b], i) => '<button type="button" class="cell boss" data-k="checks" data-i="' + BOSS_LOC[i] + '"><span class="ico"><img src="../tracker/boss/' + BOSS_PIC[i] + '.png" alt=""></span><b>' + esc(b) + '</b><small>' + esc(r) + '</small><span class="who"></span></button>').join('') +
      '<div class="cell boss" id="c-aga"><span class="ico"><img src="../tracker/items/aga11.png" alt=""></span><b>Agahnim</b><small>Castle Tower</small></div>';
    const SMB_PIC = ['kraid', 'phantoon', 'draygon', 'ridley'];
    $('g-smb').innerHTML = SM_BOSSES.map(([r, b], i) => '<div class="cell boss" data-smb="' + i + '"><span class="ico">' + smPic(SMB_PIC[i]) + '</span><b>' + esc(b) + '</b><small>' + esc(r.replace('Brinstar ', '').replace('Norfair Lower East', 'Lower Norfair').replace('Maridia Inner', 'Maridia')) + '</small><span class="who"></span></div>').join('');
    if (window.SMZ3Map) SMZ3Map.init($('g-map'), { onToggle: (i) => toggle('checks', i), names: (i) => LOCS[i].name, locs: LOCS });
    $('g-checks').innerHTML = REGIONS.map((r, ri) => '<div class="area" data-r="' + ri + '"><h5><span>' + (r.z3 ? '' : '<span class="tag">SM</span> ') + esc(r.name) + '</span> <span class="an"></span></h5><div class="list">' +
      r.locs.map((i) => '<button type="button" class="chk" data-k="checks" data-i="' + i + '"><i></i>' + esc(short(LOCS[i])) + '<span class="what"></span></button>').join('') + '</div></div>').join('');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (b && root.contains(b)) toggle(b.dataset.k, b.dataset.k === 'inv' ? b.dataset.i : +b.dataset.i);
      if (e.target.id === 't-reveal') { reveal = e.target.checked; render(); }
    });
    setView(view);
  }
  function setView(v) {
    view = v; root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    if (v === 'map' && window.SMZ3Map) setTimeout(() => SMZ3Map.redraw(), 0);
    try { localStorage.setItem('smz3r:view', v); } catch (e) {}
  }

  function render() {
    if (!root) return;
    const s = state(), lw = logicWorld();
    // items
    const allCells = Z3_ITEMS.concat(SM_ITEMS);
    root.querySelectorAll('[data-k="inv"]').forEach((b) => {
      const k = b.dataset.i, v = s.inv[k], c = allCells.find((x) => x[0] === k);
      b.classList.toggle('have', v > 0);
      b.classList.toggle('manual', !!(manual.inv && manual.inv[k]) && !(live && live.started && live.inv[k] >= manual.inv[k]));
      b.querySelector('.n').textContent = (c[3] || 1) > 1 && v ? (c[3] > 50 ? v : v + '/' + c[3]) : '';
      if (LEVELLED[k]) b.querySelector('.ico').innerHTML = z3Pic(k, v);
    });
    $('n-z3').textContent = Z3_ITEMS.filter(([k]) => s.inv[k]).length + '/' + Z3_ITEMS.length;
    $('n-sm').textContent = SM_ITEMS.filter(([k]) => s.inv[k]).length + '/' + SM_ITEMS.length;
    // logic
    let prog = null;
    if (lw) { try { prog = G.progression(itemTypes(s.inv), lw.world); } catch (e) { prog = null; } }
    const reach = prog ? lw.world.Locations.map((l) => { try { return l.Available(prog); } catch (e) { return null; } }) : null;
    // checks
    root.querySelectorAll('[data-k="checks"]').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('have', s.checks[i]);
      b.classList.toggle('manual', !!(manual.checks && manual.checks[i]) && !isLive('checks', i));
      b.classList.toggle('r-ok', !!reach && !s.checks[i] && reach[i] === true);
      b.classList.toggle('r-no', !!reach && !s.checks[i] && reach[i] === false);
      const w = b.querySelector('.what'); if (w) w.textContent = reveal && meta.items && meta.items[i] ? ' · ' + meta.items[i][1] : '';
    });
    root.querySelectorAll('.area').forEach((el) => {
      const r = REGIONS[+el.dataset.r], d = r.locs.filter((i) => s.checks[i]).length;
      el.querySelector('.an').textContent = d + '/' + r.locs.length;
      el.classList.toggle('done', d === r.locs.length);
    });
    const nChecks = s.checks.filter(Boolean).length;
    if (window.SMZ3Map) SMZ3Map.update({ have: s.checks, items: reveal && meta.items ? LOCS.map((l, i) => meta.items[i] ? meta.items[i][1] : '') : null, liveHave: (i) => isLive('checks', i), reach: reach ? LOCS.map((l, i) => s.checks[i] ? null : reach[i] === true ? 'ok' : reach[i] === false ? 'no' : null) : null });
    $('n-checks').textContent = nChecks + '/' + LOCS.length + (reach ? ' · ' + LOCS.filter((_, i) => !s.checks[i] && reach[i]).length + ' in logic' : '');
    // bosses and prizes (a prize shows once its boss falls, or with Reveal)
    const prizeOf = (name) => { if (!lw) return ''; const r = lw.world.GetRegion(name); return r ? lw.rewardName(r) : ''; };
    Z3_BOSSES.forEach(([r], i) => { const b = root.querySelector('#g-dun [data-i="' + BOSS_LOC[i] + '"] .who'); if (b) b.textContent = (s.checks[BOSS_LOC[i]] || reveal) ? prizeOf(r) : ''; });
    const aga = !!(live && live.started && live.aga) || !!manual.aga;
    $('c-aga').classList.toggle('have', aga);
    const smb = SM_BOSSES.map((x, i) => !!(live && live.started && live.smBoss[i]));
    root.querySelectorAll('[data-smb]').forEach((el) => { const i = +el.dataset.smb; el.classList.toggle('have', smb[i]); el.querySelector('.who').textContent = smb[i] || reveal ? prizeOf(SM_BOSSES[i][0]) : ''; });
    $('n-dun').textContent = Z3_BOSSES.filter((_, i) => s.checks[BOSS_LOC[i]]).length + '/10';
    $('n-smb').textContent = smb.filter(Boolean).length + '/4';
    const crystals = live && live.started ? popcount(live.crystals) : 0, pendants = live && live.started ? popcount(live.pendants) : 0;
    const ws = lw && lw.world.WorldState;
    $('g-goal').innerHTML = '<div class="goal"><span class="goal-r">Crystals ' + crystals + '/7 · pendants ' + pendants + '/3</span>' +
      (ws ? '<span class="goal-c">Ganon’s Tower opens with ' + ws.TowerCrystals + ' crystals, Ganon falls to ' + ws.GanonCrystals + '; Tourian opens after ' + ws.TourianBossTokens + ' Metroid bosses.</span>' : '') + '</div>' +
      (lw && reveal ? '<div class="goal"><span class="goal-c">Medallions: Misery Mire ' + esc(lw.medallionName(lw.world.GetRegion('Misery Mire'))) + ', Turtle Rock ' + esc(lw.medallionName(lw.world.GetRegion('Turtle Rock'))) + '</span></div>' : '');
    // stats
    const l = live && live.started ? live : null;
    const stat = (ico, v, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + v + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML = stat('✓', nChecks, LOCS.length, 'Locations checked') + stat('◆', crystals, 7, 'Crystals') + stat('♛', smb.filter(Boolean).length, 4, 'Metroid bosses') +
      (l ? '<span class="stat game" title="The game running">' + (l.game === 'z3' ? 'Zelda' : l.game === 'sm' ? 'Metroid' : 'The end') + '</span>' : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    renderSeed(lw);
  }
  function popcount(v) { let n = 0; for (v = v || 0; v; v >>= 1) n += v & 1; return n; }
  function renderSeed(lw) {
    const sd = $('g-seed'); if (!sd) return;
    const m = meta || {};
    const head = m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span> <small>' + esc(m.generator || '') + '</small></div>' +
      '<div class="seedline fine">' + esc(m.summary || '') + '</div><div class="seedline fine">Share code: <span class="selectable">' + esc(m.seed + '/' + (m.code || '')) + '</span> (paste it in New seed)</div>' :
      '<p class="empty">' + (m.source === 'file' ? 'A ROM from elsewhere (samus.link, say): the tracker reads its prizes and settings from the ROM itself' + (lw ? ' (SMZ3 v' + esc(lw.version) + ').' : '.') : 'Roll a seed and its seed, settings and spoiler show up here.') + '</p>';
    const rv = '<label class="reveal"><input type="checkbox" id="t-reveal"' + (reveal ? ' checked' : '') + '> Reveal (spoiler: every location’s item, the prizes, the medallions)</label>';
    const spoil = reveal && m.spoiler ? '<details><summary>Spoiler log</summary><pre class="spoiler selectable">' + esc(m.spoiler) + '</pre></details>' : '';
    sd.innerHTML = head + (m.race ? '<p class="fine">A race seed: no spoiler.</p>' : rv) + spoil;
  }

  // ── polling ──────────────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readLive();
    if (!s) { live = null; setLink(window.Snes9xPlayer && Snes9xPlayer.ready ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } if (window.SMZ3Map) SMZ3Map.live(null, null); return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    const sig = JSON.stringify([s.game, s.started, s.checks, s.inv, s.smBoss, s.aga, s.crystals, s.pendants]);
    if (sig !== last) { last = sig; render(); }
    if (window.SMZ3Map) { let rom = null; try { rom = SMZ3Tracker.rom && SMZ3Tracker.rom(); } catch (e) {} SMZ3Map.live(s, rom); }
  }

  const SMZ3Tracker = {
    ram: null, sram: null, rom: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('smz3r:view') || 'items'; } catch (e) {}
      build(); loadManual(); render();
      setInterval(poll, 600);
    },
    setSession(id, label, m) { sessionId = id || 'manual'; meta = m || {}; reveal = false; loadManual(); render(); },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
    LOCS,
  };
  window.SMZ3Tracker = SMZ3Tracker;
})();
