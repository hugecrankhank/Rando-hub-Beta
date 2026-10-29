/*
 * Dungeon card: when Link walks into a dungeon, a card over the game for the
 * stream — its name, boss, prize, chests opened / left, small keys, big key,
 * map and compass (HydeOut's ask, Oct 2026).
 *
 * Which dungeon: $7E040C in the emulator's RAM (an even dungeon ID; 0xFF on the
 * overworld and in caves), read only while the game is actually playing
 * ($7E0010 in 0x07 dungeon / 0x09 overworld / 0x0B special). Menus and text
 * keep the last answer; the title screen means nobody is anywhere.
 *
 * What's on it comes from the tracker in use:
 *   Hutch's       his dungeons[] / dngCardCounts() / trackerItems in #items-frame
 *                 (the same numbers as the hover card on his map)
 *   Mudora 2.0    Mudora.items as mudora2.js fills it (…Chests / MaxChests / SmallKeys / Boss / Prize)
 *
 * ⚙ Settings → "Dungeon card": Off / On entry (8 s) / While inside; Test shows
 * Tower of Hera for eight seconds. Drawn over the game picture, top left, so a
 * stream capture of the game has it.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rhb-dungeon-card';
  var mode = 'entry';
  try { mode = localStorage.getItem(KEY) || 'entry'; } catch (e) {}
  if (['off', 'entry', 'inside'].indexOf(mode) < 0) mode = 'entry';
  var SHOW_MS = 8000;
  var IMG = 'tracker/items/', BOSS = 'tracker/boss/';
  var ID_KEY = { 0x00: 'hc', 0x02: 'hc', 0x04: 'ep', 0x06: 'dp', 0x08: 'ct', 0x0A: 'sp', 0x0C: 'pod', 0x0E: 'mm', 0x10: 'sw', 0x12: 'ip', 0x14: 'toh', 0x16: 'tt', 0x18: 'tr', 0x1A: 'gt' };
  var NAMES = { hc: 'Hyrule Castle', ep: 'Eastern Palace', dp: 'Desert Palace', ct: "Agahnim's Tower", sp: 'Swamp Palace', pod: 'Palace of Darkness', mm: 'Misery Mire', sw: 'Skull Woods', ip: 'Ice Palace', toh: 'Tower of Hera', tt: "Thieves' Town", tr: 'Turtle Rock', gt: "Ganon's Tower" };
  var BOSS_NUM = { armos: 1, lanmolas: 2, moldorm: 3, helmasaurking: 4, arrghus: 5, mothula: 6, blind: 7, kholdstare: 8, vitreous: 9, trinexx: 10 };
  var BOSS_NAME = [null, 'Armos Knights', 'Lanmolas', 'Moldorm', 'Helmasaur King', 'Arrghus', 'Mothula', 'Blind', 'Kholdstare', 'Vitreous', 'Trinexx'];
  var PRIZE = { crystal: 'crystal', redcrystal: 'redcrystal', pendant: 'pendant', greenpendant: 'greenpendant' };
  var CSS =
    '@font-face { font-family: "Rando Pixel"; src: url(fonts/PressStart2P-Regular.ttf) format("truetype"); font-display: swap; }' +
    '.dg-card { position: absolute; z-index: 26; pointer-events: none; display: flex; align-items: center; gap: 10px; box-sizing: border-box;' +
    ' padding: 7px 12px 7px 9px; background: rgba(10,12,16,.86); border: 2px solid #e8c25a; border-left: 0; border-top: 0; border-radius: 0 0 10px 0;' +
    ' font: 700 clamp(11px, 1.6vw, 16px)/1.25 "Rando Pixel", "Press Start 2P", system-ui, sans-serif; color: #fff; letter-spacing: .02em;' +
    ' box-shadow: 0 4px 14px rgba(0,0,0,.5); opacity: 0; transform: translateY(-110%); transition: opacity .25s, transform .35s cubic-bezier(.2,1.2,.4,1); }' +
    '.dg-card.show { opacity: 1; transform: none; }' +
    '.dg-card img { display: block; image-rendering: pixelated; width: 2.6em; height: 2.6em; }' +
    '.dg-card .dg-boss { position: relative; width: 4em; height: 4em; }' +
    '.dg-card .dg-boss img { width: 100%; height: 100%; }' +
    '.dg-card .dg-boss.beaten::after { content: "\\2713"; position: absolute; right: -.2em; bottom: -.2em; color: #2ecc71; font-size: 1.1em; text-shadow: 0 0 4px #000, 0 0 4px #000; }' +
    '.dg-card .dg-boss.none { display: flex; align-items: center; justify-content: center; font-size: 2em; color: #aaa; }' +
    '.dg-card .dg-main { display: flex; flex-direction: column; gap: 5px; }' +
    '.dg-card .dg-name { color: #e8c25a; font-size: 1.15em; text-shadow: 0 2px 0 #3a2a00; white-space: nowrap; }' +
    '.dg-card .dg-row { display: flex; align-items: center; gap: 4px; }' +
    '.dg-card .dg-row img { width: 1.9em; height: 1.9em; }' +
    '.dg-card .dg-row .dim { opacity: .28; filter: grayscale(1); }' +
    '.dg-card .dg-chests { display: flex; flex-wrap: wrap; gap: 1px; max-width: 16em; }' +
    '.dg-card .dg-chests img { width: 1.4em; height: 1.4em; margin: 0; }' +
    '.dg-card .dg-left { margin-left: 4px; color: #e8c25a; white-space: nowrap; }' +
    '.dg-card .dg-left.done { color: #2ecc71; }' +
    '.dg-card .dg-n { margin-right: 6px; white-space: nowrap; }' +
    '.dg-card .dg-prize { margin-left: 2px; }';
  var card = null, hideT = null, cur = null, testUntil = 0, lastHtml = '';

  function host() { return document.querySelector('.s9x'); }
  function style() { if ($('dungeon-card-css')) return; var st = document.createElement('style'); st.id = 'dungeon-card-css'; st.textContent = CSS; document.head.appendChild(st); }
  function place() {
    var P = window.Snes9xPlayer, r = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (!(r && r.w > 0) || !card) return;
    card.style.left = Math.round(r.x) + 'px'; card.style.top = Math.round(r.y) + 'px';
    card.style.maxWidth = Math.round(r.w * .9) + 'px';
  }

  // where Link is, from the game's own RAM
  function hereNow() {
    var P = window.Snes9xPlayer, c = P && P.core, r = c && c.wram && c.wram();
    if (!r || r.length < 0x1000) return cur;
    var m = r[0x10];
    if (m < 0x06) return null;                              // title / file select
    if (m !== 0x07 && m !== 0x09 && m !== 0x0B) return cur; // menus, text, transitions: keep the last answer
    return ID_KEY[r[0x40C]] || null;
  }

  // the card's numbers, from whichever tracker is up
  function hutch(k) {
    var w; try { w = $('items-frame').contentWindow; } catch (e) { return null; }
    if (!w || !w.dungeons) return null;
    var d = w.dungeons[k] || {}, ti = w.trackerItems || {};
    var c = w.dngCardCounts ? w.dngCardCounts(k) : { opened: 0, total: 0, bossBeaten: null };
    var crossed = w.doorShuffleMode && w.doorShuffleMode() === 'crossed';
    var prize = null, got = false;
    try {
      var img = w.document.querySelector('[data-dungeon-key="' + k + '"] .prize-img');
      var f = img ? (img.getAttribute('src') || '').split('/').pop() : '';
      var pm = /^(greenpendant|redcrystal|pendant|crystal)/.exec(f);
      prize = pm ? pm[1] : (img ? 'unknown' : null); got = /1\.png$/.test(f);
    } catch (e) {}
    var n = (k === 'ct' || k === 'gt' || k === 'hc') ? 0 : (d.bossState || 0);
    return {
      name: NAMES[k], chests: crossed ? (k === 'ct' ? (ti.ctItems || 0) : (d.itemCount || 0)) : c.opened,
      maxChests: crossed ? (k === 'ct' ? w.ctItemMaxLabel() : (d.totalUnknown ? '?' : d.maxItems)) : c.total,
      keys: ti[k + 'SmallKeys'] || d.smallKeyCount || 0,
      maxKeys: k === 'ct' ? (w.ctKeyMaxLabel ? w.ctKeyMaxLabel() : '?') : (d.keysUnknown ? '?' : (d.maxSmallKeys || 0)),
      map: (k === 'ct' || !d.mapAddr) ? null : !!d.mapState, compass: (k === 'ct' || d.noCompass) ? null : !!d.compassState,
      bigKey: k === 'ct' ? null : !!d.bigkeyState,
      boss: k === 'ct' ? 'Agahnim' : k === 'gt' ? 'Agahnim 2' : BOSS_NAME[n], bossNum: n,
      bossBeaten: c.bossBeaten, prize: prize, prizeGot: got
    };
  }
  function mudora(k) {
    var M; try { M = $('emo-frame').contentWindow.Mudora; } catch (e) { return null; }   // Mudora2.js fills Mudora.items
    var it = M && M.items; if (!it || it[k + 'MaxChests'] == null) return null;
    var b = it[k + 'Boss'] || 'unknown', n = BOSS_NUM[b] || 0;
    var hasPrize = k !== 'hc' && k !== 'ct' && k !== 'gt';
    return {
      name: NAMES[k], chests: it[k + 'Chests'] || 0, maxChests: it[k + 'MaxChests'] || 0,
      keys: it[k + 'SmallKeys'] || 0, maxKeys: it[k + 'MaxSmallKeys'] || 0,
      map: k === 'ct' ? null : !!it[k + 'Map'], compass: k === 'ct' ? null : !!it[k + 'Compass'], bigKey: k === 'ct' ? null : !!it[k + 'BigKey'],
      boss: k === 'ct' ? 'Agahnim' : k === 'gt' ? 'Agahnim 2' : BOSS_NAME[n], bossNum: n, bossBeaten: !!it[k + 'BossDefeated'],
      prize: hasPrize ? (PRIZE[it[k + 'Prize']] || 'unknown') : null, prizeGot: !!it[k + 'PrizeObtained']
    };
  }
  function stateOf(k) {
    var b = document.body;
    if (b.classList.contains('tracker-off')) return null;
    return (b.classList.contains('tracker-emo') ? mudora(k) : hutch(k)) || { name: NAMES[k], chests: 0, maxChests: '?', keys: 0, maxKeys: '?', map: null, compass: null, bigKey: null, boss: null, bossNum: 0, bossBeaten: null, prize: null };
  }

  function html(s) {
    var h = '';
    if (s.boss === 'Agahnim' || s.boss === 'Agahnim 2') h += '<div class="dg-boss none' + (s.bossBeaten ? ' beaten' : '') + '" title="' + s.boss + '">⚔</div>';
    else h += '<div class="dg-boss' + (s.bossBeaten ? ' beaten' : '') + '" title="' + (s.boss || 'Boss unknown') + '"><img src="' + BOSS + 'boss' + (s.bossNum || 0) + '.png" alt=""></div>';
    h += '<div class="dg-main"><div class="dg-name">' + s.name + '</div>';
    var tot = typeof s.maxChests === 'number' ? s.maxChests : 0, open = Math.min(s.chests, tot);
    h += '<div class="dg-row"><div class="dg-chests">';
    for (var i = 0; i < tot && i < 30; i++) h += '<img src="' + IMG + (i < open ? 'chest00' : 'chest0') + '.png" alt="">';
    h += '</div>';
    var left = typeof s.maxChests === 'number' ? Math.max(0, tot - s.chests) : '?';
    h += '<span class="dg-left' + (left === 0 ? ' done' : '') + '">' + (left === 0 ? 'all found' : left + ' left') + (typeof s.maxChests !== 'number' ? ' (' + s.chests + '/' + s.maxChests + ')' : '') + '</span></div>';
    h += '<div class="dg-row"><img src="' + IMG + 'smallkey' + (s.keys ? '0' : '00') + '.png" alt="keys"><span class="dg-n">' + s.keys + '/' + s.maxKeys + '</span>';
    if (s.bigKey !== null) h += '<img class="' + (s.bigKey ? '' : 'dim') + '" src="' + IMG + 'bigkey1.png" alt="big key">';
    if (s.map !== null) h += '<img class="' + (s.map ? '' : 'dim') + '" src="' + IMG + 'map1.png" alt="map">';
    if (s.compass !== null) h += '<img class="' + (s.compass ? '' : 'dim') + '" src="' + IMG + 'compass1.png" alt="compass">';
    if (s.prize) h += '<img class="dg-prize" src="' + IMG + (PRIZE[s.prize] || 'crystal') + (s.prizeGot ? '1' : '0') + '.png" alt="prize"' + (s.prize === 'unknown' ? ' style="filter:grayscale(1);opacity:.45"' : '') + '>';
    h += '</div></div>';
    return h;
  }

  function show(s) {
    var h = host(); if (!h) return;
    style();
    if (!card || !card.isConnected) { card = document.createElement('div'); card.className = 'dg-card'; h.appendChild(card); lastHtml = ''; }
    var x = html(s); if (x !== lastHtml) { card.innerHTML = x; lastHtml = x; }
    place();
    if (!card.classList.contains('show')) { void card.offsetWidth; card.classList.add('show'); }
  }
  function hide() { clearTimeout(hideT); hideT = null; if (card) card.classList.remove('show'); }

  function tick() {
    if (testUntil > Date.now()) {
      show({ name: 'Tower of Hera', chests: 2, maxChests: 6, keys: 1, maxKeys: 1, map: true, compass: false, bigKey: true, boss: 'Moldorm', bossNum: 3, bossBeaten: false, prize: 'greenpendant', prizeGot: false });
      return;
    }
    if (mode === 'off') { if (card && card.classList.contains('show')) hide(); cur = hereNow(); return; }
    var k = hereNow(), entered = k && k !== cur;
    cur = k;
    if (!k) { if (hideT || mode === 'inside') hide(); return; }
    if (entered) {
      show(stateOf(k));
      clearTimeout(hideT); hideT = null;
      if (mode === 'entry') hideT = setTimeout(function () { hideT = null; if (card) card.classList.remove('show'); }, SHOW_MS);
    } else if (mode === 'inside' || hideT) show(stateOf(k));   // live counts while it's up
  }
  setInterval(tick, 500);

  // ⚙ Settings
  function settings() {
    var panel = $('trk-settings'); if (!panel || $('dg-card-mode')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'When Link walks into a dungeon: a card over the game with its name, boss, prize, chests opened and left, small keys, big key, map and compass. For the stream.';
    lab.innerHTML = 'Dungeon card (over the game) <span><select id="dg-card-mode"><option value="off">Off</option><option value="entry">On entry (8 s)</option><option value="inside">While inside</option></select> <button type="button" id="dg-card-test" title="Show one for eight seconds">Test</button></span>';
    panel.appendChild(lab);
    var sel = lab.querySelector('#dg-card-mode'); sel.value = mode;
    sel.addEventListener('change', function () { mode = sel.value; try { localStorage.setItem(KEY, mode); } catch (e) {} hide(); cur = null; });
    lab.querySelector('#dg-card-test').addEventListener('click', function (e) { e.stopPropagation(); testUntil = Date.now() + SHOW_MS; tick(); setTimeout(function () { if (testUntil <= Date.now()) { hide(); cur = null; } }, SHOW_MS + 100); });
  }
  function init() { settings(); var tries = 0; var t = setInterval(function () { settings(); if ($('dg-card-mode') || ++tries > 50) clearInterval(t); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RandoDungeonCard = { test: function () { testUntil = Date.now() + SHOW_MS; tick(); }, state: stateOf, here: hereNow };
})();
