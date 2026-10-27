/*
 * ui.js — what Mudora shows: items, dungeons, the two worlds with their
 * checks, dungeon maps, counters. Everything comes from window.Mudora
 * (mudora.js): Hutch's logic, and pictures from the game itself.
 */
(function () {
  'use strict';
  var M = window.Mudora, D = window.EmoDungeons;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var COLOR_WORD = { green: 'Available', partial: 'Some available', yellow: 'Possible', orange: 'Visible (can see it, can’t get it yet)', purple: 'Out of logic (a trick gets it)', red: 'Not yet', done: 'Done' };
  var CSS = { green: 'var(--c-green)', partial: 'var(--c-partial, #0b7a3a)', yellow: 'var(--c-yellow)', orange: 'var(--c-orange)', purple: 'var(--c-purple)', red: 'var(--c-red)', done: '#2a2d30' };
  var LOGIC = M.logicName || 'Hutch’s';   // whose logic, in messages
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // ── items ─────────────────────────────────────────────────────────────────
  // like the game's own menu: Y items, then equipment
  var ITEMS = ['bow', 'boomerang', 'hookshot', 'bomb', 'mushroom', 'powder',
    'firerod', 'icerod', 'bombos', 'ether', 'quake', 'lamp',
    'hammer', 'shovel', 'flute', 'net', 'book', 'somaria',
    'byrna', 'cape', 'mirror', 'boots', 'gloves', 'flippers',
    'moonpearl', 'sword', 'shield', 'tunic', 'halfmagic', 'agahnim',
    'bottle1', 'bottle2', 'bottle3', 'bottle4'];
  var SINGLE = { hookshot: 1, bomb: 1, powder: 1, firerod: 1, icerod: 1, bombos: 1, ether: 1, quake: 1, lamp: 1, hammer: 1, shovel: 1, net: 1,
    book: 1, somaria: 1, byrna: 1, cape: 1, mirror: 1, boots: 1, flippers: 1, moonpearl: 1 };
  var NAMES = { bow: 'Bow', boomerang: 'Boomerang', hookshot: 'Hookshot', bomb: 'Bombs', mushroom: 'Mushroom', powder: 'Magic Powder',
    firerod: 'Fire Rod', icerod: 'Ice Rod', bombos: 'Bombos', ether: 'Ether', quake: 'Quake', lamp: 'Lamp', hammer: 'Hammer', shovel: 'Shovel',
    flute: 'Flute', net: 'Bug Net', book: 'Book of Mudora', somaria: 'Cane of Somaria', byrna: 'Cane of Byrna', cape: 'Magic Cape',
    mirror: 'Magic Mirror', boots: 'Pegasus Boots', gloves: 'Gloves', flippers: 'Flippers', moonpearl: 'Moon Pearl', sword: 'Sword',
    shield: 'Shield', tunic: 'Mail', halfmagic: 'Half Magic', agahnim: 'Agahnim', bottle1: 'Bottle', bottle2: 'Bottle', bottle3: 'Bottle', bottle4: 'Bottle' };
  // the picture for an item at a state: [icon keys], dim
  function look(key, s) {
    var I = M.icons;
    s = s || 0;
    if (SINGLE[key]) return { ic: [key], off: !s };
    switch (key) {
      case 'bow': return { ic: ['bow' + (s || 2)], off: !s };
      case 'boomerang': return { ic: s === 3 ? ['boomerang1', 'boomerang2'] : ['boomerang' + (s === 2 ? 2 : 1)], off: !s };
      case 'mushroom': return { ic: ['mushroom'], off: !s, lbl: s === 2 ? '✓' : '' };
      case 'flute': return { ic: ['flute'], off: !s, lbl: s === 2 ? 'bird' : '' };
      case 'gloves': return { ic: ['gloves' + (s || 1)], off: !s };
      case 'sword': return { ic: ['sword' + (s || 1)], off: !s };
      case 'shield': return { ic: ['shield' + (s || 1)], off: !s };
      case 'tunic': return { ic: ['tunic' + Math.min(2, s)], off: false };
      case 'halfmagic': return M.icons.halfmagic ? { ic: ['halfmagic'], off: !s } : { tx: '½', off: !s };
      case 'agahnim': return { tx: s ? '☠' : 'A', off: !s, title: s ? 'Agahnim defeated' : 'Agahnim' };
      default:
        if (/^bottle/.test(key)) return { ic: ['bottle' + (s || 1)], off: !s };
    }
    return { ic: [key], off: !s };
  }
  M.look = look;
  function iconImg(k) { var u = M.icons[k]; if (!u) return null; var i = new Image(); i.src = u; i.alt = ''; i.draggable = false; return i; }
  var itemEls = {};
  function buildItems() {
    var box = $('items'); box.textContent = '';
    ITEMS.forEach(function (key) {
      var b = el('div', 'it'); b.dataset.key = key; b.title = NAMES[key] || key;
      b.addEventListener('click', function (e) { e.preventDefault(); if (!M.stepItem(key, 1)) M.toast(LOGIC + ' tracker isn’t running yet.'); });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (key === 'bombos' || key === 'ether' || key === 'quake') M.medallion(key);
        else M.stepItem(key, -1);
      });
      longPress(b, function () { b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
      box.appendChild(b); itemEls[key] = b;
    });
    paintItems();
  }
  function itemState(key) {
    var it = M.items || {};
    var v = it[key];
    return typeof v === 'number' ? v : 0;
  }
  function paintItems() {
    var it = M.items || {};
    ITEMS.forEach(function (key) {
      var b = itemEls[key]; if (!b) return;
      var s = itemState(key), L = look(key, s);
      var sig = JSON.stringify([L, M.iconState, medLabel(key), M.iconRev]);
      if (b.__sig === sig) return;
      b.__sig = sig; b.textContent = '';
      b.classList.toggle('off', !!L.off);
      b.classList.toggle('two', !!(L.ic && L.ic.length > 1));
      var drew = false;
      (L.ic || []).forEach(function (k) { var i = iconImg(k); if (i) { b.appendChild(i); drew = true; } });
      if (!drew) b.appendChild(el('span', 'tx', L.tx || (NAMES[key] || key).slice(0, 2)));
      var ml = medLabel(key) || L.lbl;
      if (ml) b.appendChild(el('span', 'lbl', ml));
      if (L.title) b.title = L.title;
    });
  }
  function medLabel(key) {
    var it = M.items || {};
    if (key !== 'bombos' && key !== 'ether' && key !== 'quake') return '';
    var n = { bombos: 1, ether: 2, quake: 3 }[key], out = [];
    if (it.mmMedallion === n) out.push('MM');
    if (it.trMedallion === n) out.push('TR');
    return out.join(' ');
  }

  // ── dungeons ──────────────────────────────────────────────────────────────
  var DGS = [['hc', 'HC', 'Hyrule Castle'], ['ep', 'EP', 'Eastern Palace'], ['dp', 'DP', 'Desert Palace'], ['toh', 'ToH', 'Tower of Hera'],
    ['ct', 'AT', 'Agahnim’s Tower'], ['pod', 'PoD', 'Palace of Darkness'], ['sp', 'SP', 'Swamp Palace'], ['sw', 'SW', 'Skull Woods'],
    ['tt', 'TT', 'Thieves’ Town'], ['ip', 'IP', 'Ice Palace'], ['mm', 'MM', 'Misery Mire'], ['tr', 'TR', 'Turtle Rock'], ['gt', 'GT', 'Ganon’s Tower']];
  // dungeons.js's list order, by short name
  function dgIndex(short) { if (!D) return -1; for (var i = 0; i < D.list.length; i++) if (D.list[i][1] === short) return i; return -1; }
  var dgEls = {};
  function buildDungeons() {
    var box = $('dungeons'); box.textContent = '';
    DGS.forEach(function (d) {
      var k = d[0], r = el('div', 'dg'); r.title = d[2] + '\nClick: open its map. Chests, keys and items: click to count, right click to undo.';
      var nm = el('span', 'nm', d[1]), pz = el('span', 'pz'), mid = el('span', 'row'), end = el('span', 'row');
      var chest = el('span', 'n'), key = el('span', 'key'), bk = el('img', 'ic'), mp = el('img', 'ic'), cp = el('img', 'ic');
      [bk, mp, cp].forEach(function (i) { i.alt = ''; i.draggable = false; });
      mid.appendChild(bk); mid.appendChild(mp); mid.appendChild(cp); mid.appendChild(key);
      end.appendChild(chest);
      r.appendChild(nm); r.appendChild(pz); r.appendChild(mid); r.appendChild(end);
      function act(part) {
        return function (e) { e.stopPropagation(); e.preventDefault(); M.dungeonAct(k, part, e.type === 'contextmenu' ? -1 : 1); };
      }
      [[chest, 'chest'], [key, 'key'], [bk, 'bigkey'], [mp, 'map'], [cp, 'compass'], [pz, 'prize']].forEach(function (p) {
        p[0].style.cursor = 'pointer';
        p[0].addEventListener('click', act(p[1])); p[0].addEventListener('contextmenu', act(p[1]));
      });
      r.addEventListener('click', function () { var i = dgIndex(d[1]); if (i >= 0) selectDg(i); });
      box.appendChild(r);
      dgEls[k] = { r: r, nm: nm, pz: pz, chest: chest, key: key, bk: bk, mp: mp, cp: cp };
    });
    paintDungeons();
  }
  function prizeIcon(name) {
    return { crystal: 'crystal', redcrystal: 'crystal_red', pendant: 'pendant_blue', greenpendant: 'pendant_green', unknown: '' }[name] || '';
  }
  function setImg(img, k) { var u = k && M.icons[k]; if (u) { if (img.getAttribute('src') !== u) img.src = u; img.style.visibility = ''; } else img.style.visibility = 'hidden'; }
  if (window.RandoKeysClient) window.RandoKeysClient.onChange(function () { paintDungeons(); paintStats(); });
  function paintDungeons() {
    var it = M.items || {};
    DGS.forEach(function (d) {
      var k = d[0], E = dgEls[k]; if (!E) return;
      var col = M.dcolors[k] || 'red', done = M.dcleared[k];
      E.r.className = 'dg ' + (done ? 'done' : col);
      var max = it[k + 'MaxChests'], got = it[k + 'Chests'];
      var left = max === '?' ? '?' : Math.max(0, (max || 0) - (got || 0));
      E.chest.textContent = max != null ? left : '';
      E.chest.className = 'n' + (left === 0 ? ' zero' : '');
      E.chest.title = max != null ? 'Chests left: ' + left + ' (' + (got || 0) + ' of ' + max + ' found)' : '';
      var km = it[k + 'MaxSmallKeys'] != null ? it[k + 'MaxSmallKeys'] : it[k + 'SmallKeysMax'];
      // Found / In hand / Both: the hub's "Tracker keys" setting (addons/keys-client.js)
      var KC = window.RandoKeysClient, kf = it[k + 'SmallKeys'] || 0, kh = KC ? KC.held(k) : null;
      E.key.textContent = km ? '🗝' + (KC ? KC.text(kf, k, km) : kf + '/' + km) : '';
      E.key.classList.toggle('done', !!km && km !== '?' && kf >= km);   // every small key found: green, like Hutch's
      E.key.title = km ? 'Small keys: ' + kf + ' of ' + km + ' found' + (kh !== null ? ', ' + kh + ' in hand' : '') : '';
      setImg(E.bk, 'bigkey'); E.bk.classList.toggle('off', !it[k + 'BigKey']);
      setImg(E.mp, 'map'); E.mp.classList.toggle('off', !it[k + 'Map']);
      setImg(E.cp, 'compass'); E.cp.classList.toggle('off', !it[k + 'Compass']);
      var pn = it[k + 'Prize'];
      E.mp.style.display = E.cp.style.display = k === 'ct' ? 'none' : '';
      var pk = k === 'hc' || k === 'ct' || k === 'gt' ? null : prizeIcon(pn);
      var psig = [pk, M.icons[pk] ? 1 : 0, !!it[k + 'PrizeObtained'], M.iconRev].join();
      if (E.pz.__sig !== psig) {
        E.pz.__sig = psig; E.pz.textContent = '';
        if (pk && M.icons[pk]) {
          // got it: bright, with a glow in its own colour; not yet: grey (HydeOut: make it obvious)
          var pi = iconImg(pk); E.pz.appendChild(pi);
          E.pz.className = 'pz ' + (it[k + 'PrizeObtained'] ? 'got ' : 'no ') + pk;
          // red crystal and green pendant look like the others once grayed out: a + marks them
          if (pk === 'crystal_red' || pk === 'pendant_green') E.pz.appendChild(el('b', 'plus' + (pk === 'crystal_red' ? ' red' : ' green'), '+'));
        }
        else { E.pz.className = 'pz'; if (pk === '') E.pz.textContent = '?'; }
      }
      E.pz.title = pn ? pn.replace('green', 'green ').replace('red', 'red ') : '';
      // items revealed in this dungeon, next to its name
      var rvl = (M.dmarks ? M.dmarks(k) : []).filter(function (x) { return M.icons[x]; }), rsig = rvl.join(',');
      if (E.nm.__rv !== rsig) {
        E.nm.__rv = rsig;
        Array.prototype.slice.call(E.nm.querySelectorAll('img.rv')).forEach(function (x) { x.remove(); });
        rvl.forEach(function (x) { var im = iconImg(x); if (im) { im.className = 'rv'; im.title = 'Revealed in this dungeon'; E.nm.appendChild(im); } });
      }
      // "Ready first": dungeons you can clear on top, crystals before the rest, done at the bottom
      E.r.style.order = listMode === 'ready' ? String(readyRank(k, col, done, pn)) : '';
    });
    paintHere();
  }
  var RANK = { green: 0, partial: 1, yellow: 2, orange: 3, purple: 4, red: 5 };
  function readyRank(k, col, done, pn) {
    if (done) return 900 + DGS.findIndex(function (d) { return d[0] === k; });
    var crystal = pn === 'crystal' || pn === 'redcrystal';
    return (RANK[col] != null ? RANK[col] : 5) * 40 + (crystal ? 0 : 20) + DGS.findIndex(function (d) { return d[0] === k; });
  }

  // ── this dungeon: a card for the dungeon Link is in (HydeOut, Oct 2026) ───
  // Its boss (click / right click to pick another, for boss shuffle), prize
  // (click / right click: which it is), keys, and a chest for every check:
  // open ones found, shut ones still to get. Blank outside dungeons, so it
  // can sit on stream on its own ("This dungeon only").
  var BOSS_ART = { unknown: '../tracker/boss/boss0.png', armos: '../tracker/boss/boss1.png', lanmolas: '../tracker/boss/boss2.png',
    moldorm: '../tracker/boss/boss3.png', helmasaurking: '../tracker/boss/boss4.png', arrghus: '../tracker/boss/boss5.png',
    mothula: '../tracker/boss/boss6.png', blind: '../tracker/boss/boss7.png', kholdstare: '../tracker/boss/boss8.png',
    vitreous: '../tracker/boss/boss9.png', trinexx: '../tracker/boss/boss10.png', agahnim: '../tracker/map/agahnim0.png',
    agahnim2: '../tracker/map/agahnim0.png', bnc: '../mfns-tracker/app/dungeons/ballnchain.png' };
  var BOSS_NAME = { unknown: 'Boss not known yet', armos: 'Armos Knights', lanmolas: 'Lanmolas', moldorm: 'Moldorm', helmasaurking: 'Helmasaur King',
    arrghus: 'Arrghus', mothula: 'Mothula', blind: 'Blind', kholdstare: 'Kholdstare', vitreous: 'Vitreous', trinexx: 'Trinexx',
    agahnim: 'Agahnim', agahnim2: 'Agahnim 2', bnc: 'Ball and Chain Trooper' };
  var BOSS_CYCLE = ['unknown', 'armos', 'lanmolas', 'moldorm', 'helmasaurking', 'arrghus', 'mothula', 'blind', 'kholdstare', 'vitreous', 'trinexx', 'agahnim', 'agahnim2'];
  var VANILLA_BOSS = { hc: 'bnc', ep: 'armos', dp: 'lanmolas', toh: 'moldorm', ct: 'agahnim', pod: 'helmasaurking', sp: 'arrghus', sw: 'mothula',
    tt: 'blind', ip: 'kholdstare', mm: 'vitreous', tr: 'trinexx', gt: 'agahnim2' };
  // Hutch's tracker has no bosses to pick: Mudora keeps them, per game
  function localBosses() { try { return JSON.parse(localStorage.getItem('rhb-mudora-bosses:' + (M.game || '')) || '{}'); } catch (e) { return {}; } }
  function bossOf(k) {
    var it = M.items || {}, b = it[k + 'Boss'];
    if (b && b !== 'unknown') return b;
    // his "not known yet" (boss shuffle); Agahnim's two towers and the castle never change
    if (b === 'unknown') return localBosses()[k] || (k === 'ct' || k === 'gt' || k === 'hc' ? VANILLA_BOSS[k] : 'unknown');
    return localBosses()[k] || VANILLA_BOSS[k] || 'unknown';
  }
  function stepBoss(k, dir) {
    if ((M.items || {})[k + 'Boss'] != null && M.dungeonAct(k, 'boss', dir)) return;
    var L = localBosses(), i = BOSS_CYCLE.indexOf(bossOf(k)), n = BOSS_CYCLE.length;
    L[k] = BOSS_CYCLE[((i < 0 ? 0 : i) + (dir < 0 ? n - 1 : 1)) % n];
    try { localStorage.setItem('rhb-mudora-bosses:' + (M.game || ''), JSON.stringify(L)); } catch (e) {}
    paintHere(true);
  }
  var here = null;
  function buildHere() {
    var box = $('dghere'); if (!box) return;
    box.innerHTML = '<div class="hb" title=""><img alt=""></div><div class="hm"><div class="ht"><b class="hn"></b><span class="hp"></span><span class="hk"></span></div><div class="hc"></div></div>';
    here = { box: box, boss: box.querySelector('.hb'), bimg: box.querySelector('.hb img'), nm: box.querySelector('.hn'), pz: box.querySelector('.hp'),
      keys: box.querySelector('.hk'), chests: box.querySelector('.hc'), k: null, sig: '' };
    function on(node, fn) {
      node.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (here.k) fn(here.k, 1); });
      node.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); if (here.k) fn(here.k, -1); });
      longPress(node, function () { if (here.k) fn(here.k, -1); });
    }
    on(here.boss, stepBoss);
    on(here.pz, function (k, d) { M.dungeonAct(k, 'prizeType', d); });
    on(here.chests, function (k, d) { M.dungeonAct(k, 'chest', d); });
  }
  function hereKey() {
    if (!D) return null;
    var w = D.where(), i = w && w.dg;
    if (i == null || i < 0 || !D.list[i]) return null;
    var short = D.list[i][1];
    return (DGS.filter(function (d) { return d[1] === short; })[0] || [])[0] || null;
  }
  function paintHere(force) {
    if (!here) return;
    var k = hereKey(), it = M.items || {};
    if (!k) { if (here.k !== null || force) { here.k = null; here.sig = ''; here.box.className = 'dghere empty'; copyToPop(); } return; }
    var d = DGS.filter(function (x) { return x[0] === k; })[0];
    var boss = bossOf(k), pn = it[k + 'Prize'], pk = k === 'hc' || k === 'ct' || k === 'gt' ? null : prizeIcon(pn);
    var max = it[k + 'MaxChests'], got = it[k + 'Chests'] || 0, beaten = !!(it[k + 'BossDefeated'] || it[k + 'PrizeObtained'] || M.dcleared[k]);
    var KC = window.RandoKeysClient, km = it[k + 'MaxSmallKeys'] != null ? it[k + 'MaxSmallKeys'] : it[k + 'SmallKeysMax'], kf = it[k + 'SmallKeys'] || 0;
    var sig = [k, boss, pk, M.icons[pk] ? 1 : 0, M.iconRev, !!it[k + 'PrizeObtained'], max, got, beaten, km, kf, !!it[k + 'BigKey'], M.icons.bigkey ? 1 : 0].join('|');
    if (sig === here.sig && !force) return;
    here.sig = sig; here.k = k;
    here.box.className = 'dghere' + (beaten ? ' beaten' : '');
    here.nm.textContent = d[2];
    here.bimg.src = abs(BOSS_ART[boss] || BOSS_ART.unknown);
    here.boss.title = (BOSS_NAME[boss] || boss) + (beaten ? ' (beaten)' : '') + '\nClick / right click: another boss (boss shuffle)';
    here.pz.textContent = '';
    if (pk && M.icons[pk]) {
      var pi = iconImg(pk); here.pz.appendChild(pi);
      here.pz.className = 'hp ' + (it[k + 'PrizeObtained'] ? 'got ' : 'no ') + pk;
    } else { here.pz.className = 'hp'; if (pk === '') here.pz.textContent = '?'; }
    here.pz.title = pk !== null ? (pn ? pn.replace('green', 'green ').replace('red', 'red ') : 'Prize') + '\nClick / right click: which prize it is' : '';
    here.keys.textContent = '';
    if (it[k + 'BigKey'] && M.icons.bigkey) { var bk = iconImg('bigkey'); bk.className = 'bk'; bk.title = 'Big key'; here.keys.appendChild(bk); }
    if (km) here.keys.appendChild(el('span', 'kc' + (km !== '?' && kf >= km ? ' done' : ''), '🗝' + (KC ? KC.text(kf, k, km) : kf + '/' + km)));
    // the chests: one per check, open when found
    here.chests.textContent = '';
    if (max == null || max === '?') { here.chests.appendChild(el('span', 'hl', max === '?' ? '? chests' : '')); return; }
    var left = Math.max(0, max - got), show = Math.min(max, 16);
    var openN = Math.max(0, show - Math.min(left, show));
    for (var i = 0; i < show; i++) {
      var c = el('img', 'ch' + (i < openN ? ' open' : '')); c.alt = ''; c.draggable = false;
      c.src = abs(i < openN ? '../mfns-tracker/app/dungeons/chest0.png' : '../mfns-tracker/app/dungeons/smallchest.png');
      here.chests.appendChild(c);
    }
    here.chests.appendChild(el('span', 'hl' + (left ? '' : ' none'), left ? left + ' left' + (max > 16 ? ' of ' + max : '') : 'all done'));
    here.chests.title = got + ' of ' + max + ' found\nClick: one more found, right click: undo';
    copyToPop();
  }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  // ── the card in a window of its own (for stream: OBS window capture) ──────
  // HydeOut: under the list it made the side panel scroll, so in the panel it
  // only shows with "This dungeon only"; ⧉ Pop out puts it in its own small
  // window, kept up to date from here.
  var pop = null;
  function popCss() {
    var out = [];
    Array.prototype.forEach.call(document.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      Array.prototype.forEach.call(rules || [], function (r) { if (/dghere|:root|\.hp\b|icons-smooth/.test(r.cssText)) out.push(r.cssText); });
    });
    return out.join('\n') + '\nhtml,body{margin:0;background:#101214;color:#d7dde3;font:13px/1.3 system-ui,sans-serif;overflow:hidden}.dghere{margin:6px}';
  }
  function copyToPop() {
    if (!pop || pop.closed || !here) return;
    var d = pop.document, box = d.getElementById('c');
    if (!box) {
      d.open(); d.write('<!doctype html><title>Mudora: this dungeon</title><style>' + popCss() + '</style><div id="c"></div>'); d.close();
      box = d.getElementById('c');
      if (document.documentElement.classList.contains('icons-smooth')) d.documentElement.classList.add('icons-smooth');
    }
    var html = here.box.outerHTML;
    if (box.__html !== html) { box.__html = html; box.innerHTML = html; var c = box.firstChild; if (c) { c.removeAttribute('id'); c.classList.remove('hide-side'); } }
  }
  function popOut() {
    if (pop && !pop.closed) { pop.focus(); return; }
    pop = window.open('', 'mudora-dungeon', 'width=420,height=110,menubar=no,toolbar=no,location=no,status=no');
    if (!pop) { M.toast('The pop-out was blocked: allow pop-ups for this page.'); return; }
    paintHere(true);
  }
  M.popOutDungeon = popOut;

  // ── long press (phones): the same as a right click ────────────────────────
  // The tap a hold ends with must not also count as a tap (iOS still sends
  // that click at times, which marked the check as well as opening its card),
  // so any click within a moment of a hold is dropped before anything sees it.
  var heldAt = 0, heldNode = null;
  document.addEventListener('click', function (e) {
    if (heldAt && Date.now() - heldAt < 900 && heldNode && heldNode.contains(e.target)) { heldAt = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);
  function longPress(node, fn) {
    var t = null, sx = 0, sy = 0;
    node.addEventListener('touchstart', function (e) { var p = e.touches[0]; sx = p.clientX; sy = p.clientY; heldAt = 0; t = setTimeout(function () { t = 'done'; heldAt = Date.now(); heldNode = node; fn(); }, 480); }, { passive: true });
    node.addEventListener('touchmove', function (e) { var p = e.touches[0]; if (t && t !== 'done' && Math.abs(p.clientX - sx) + Math.abs(p.clientY - sy) > 10) { clearTimeout(t); t = null; } }, { passive: true });
    node.addEventListener('touchend', function (e) { if (t === 'done') { e.preventDefault(); heldAt = Date.now(); } else clearTimeout(t); t = null; });
    node.addEventListener('touchcancel', function () { if (t !== 'done') clearTimeout(t); t = null; });
  }

  // ── the two worlds ────────────────────────────────────────────────────────
  var views = [];
  // Drawn on a canvas the size of the box, not as one huge zoomed picture:
  // zooming a 4096-pixel world as a page element made iPhone Safari build a
  // picture many times the screen and run out of memory. Fully zoomed out it
  // draws a small copy of the world (1024 x 1024, made once); zoomed in, only
  // the screens in view at full size (a handful kept, the rest let go).
  function WorldView(world) {
    var self = this;
    this.world = world;
    this.box = el('div', 'wv');
    this.cv = el('canvas', 'wcv'); this.cx = this.cv.getContext('2d');
    this.pins = el('div', 'pins');
    this.box.appendChild(this.cv); this.box.appendChild(this.pins);
    this.box.setAttribute('aria-label', world === 'lw' ? 'Light World' : 'Dark World');   // (no name drawn over the map)
    var rs = el('button', 'wreset', '⟲'); rs.type = 'button'; rs.title = 'Reset this map (whole world, as at the start)';
    rs.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    rs.addEventListener('click', function (e) { e.stopPropagation(); self.fit(); });
    this.box.appendChild(rs);
    this.zoom = 0.1; this.pan = [0, 0]; this.userMoved = false; this.pinEls = {};
    this.small = null; this.full = {}; this.used = []; this.raf = 0;
    // wheel / pinch zoom, drag to move, double-click / double-tap to fit
    var pts = new Map(), pinch = null, drag = null, lastTap = 0, box = this.box;
    box.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    box.addEventListener('dblclick', function (e) { if (!e.target.closest('.pin')) self.fit(); });
    box.addEventListener('pointerdown', function (e) {
      if (e.isPrimary) { pts.clear(); pinch = null; drag = null; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (e.pointerType === 'touch' && !e.target.closest('.pin')) { try { box.setPointerCapture(e.pointerId); } catch (x) {} }
      if (pts.size === 2) { var a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); pinch = d > 20 ? { d: d, z: self.zoom, c: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2] } : null; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, p: self.pan.slice(), moved: false };
    });
    box.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        var a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
        self.setZoomAt(pinch.c[0], pinch.c[1], self.clampZ(pinch.z * Math.max(0.25, Math.min(4, d / pinch.d))));
      } else if (drag) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
        if (drag.moved) { self.pan = [drag.p[0] + e.clientX - drag.x, drag.p[1] + e.clientY - drag.y]; self.userMoved = true; self.apply(); }
      }
    });
    function upEv(e) {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size) {
        if (e.pointerType === 'touch' && drag && !drag.moved && !e.target.closest('.pin')) {
          var now = Date.now(); if (now - lastTap < 300) { self.fit(); lastTap = 0; } else lastTap = now;
        }
        drag = null;
      }
    }
    box.addEventListener('pointerup', upEv); box.addEventListener('pointercancel', upEv);
    views.push(this);
    this.paintTiles();
  }
  WorldView.prototype.clampZ = function (z) { var f = this.fitZ || 0.05; return Math.max(f * 0.8, Math.min(3, z)); };
  WorldView.prototype.maps = function () { return M.romMaps && M.romMaps[this.world === 'lw' ? 'light' : 'dark']; };
  // a new game's pictures: make the small copy, one screen at a time
  WorldView.prototype.paintTiles = function () {
    var maps = this.maps(), key = maps ? maps[0] : 'none', self = this;
    if (this.__tiles === key) return;
    this.__tiles = key; this.small = null; this.full = {}; this.used = [];
    if (!maps) { this.draw(); return; }
    var sc = document.createElement('canvas'); sc.width = sc.height = 1024;
    var sx = sc.getContext('2d'), i = 0;
    (function next() {
      if (self.__tiles !== key) return;
      if (i >= 64) { self.small = sc; self.draw(); return; }
      var im = new Image(), n = i++;
      im.onload = function () { sx.drawImage(im, (n % 8) * 128, Math.floor(n / 8) * 128, 128, 128); im.src = ''; next(); };
      im.onerror = next;
      im.src = maps[n];
    })();
    this.draw();
  };
  WorldView.prototype.tile = function (n) {
    var t = this.full[n], self = this, maps = this.maps();
    if (t) { t.at = Date.now(); return t.ok ? t.im : null; }
    if (!maps) return null;
    t = this.full[n] = { im: new Image(), ok: false, at: Date.now() };
    t.im.onload = function () { t.ok = true; self.draw(); };
    t.im.src = maps[n];
    // keep a few screens only
    var keys = Object.keys(this.full);
    if (keys.length > 24) {
      keys.sort(function (a, b) { return self.full[a].at - self.full[b].at; }).slice(0, keys.length - 24).forEach(function (k) {
        self.full[k].im.onload = null; self.full[k].im.src = ''; delete self.full[k];
      });
    }
    return null;
  };
  WorldView.prototype.draw = function () {
    var self = this;
    if (this.raf) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.drawNow(); });
  };
  WorldView.prototype.drawNow = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    var cx = this.cx, z = this.zoom, px = this.pan[0], py = this.pan[1];
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#050607'; cx.fillRect(0, 0, W, H);
    cx.imageSmoothingEnabled = z * dpr < 1;
    var maps = this.maps();
    if (!maps) { cx.fillStyle = '#1a2a1a'; cx.fillRect(px, py, 4096 * z, 4096 * z); }
    else {
      var useFull = z * dpr > 0.3;
      if (this.small) cx.drawImage(this.small, px, py, 4096 * z, 4096 * z);
      if (useFull) {
        var x0 = Math.max(0, Math.floor(-px / z / 512)), x1 = Math.min(7, Math.floor((W - px) / z / 512));
        var y0 = Math.max(0, Math.floor(-py / z / 512)), y1 = Math.min(7, Math.floor((H - py) / z / 512));
        for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
          var im = this.tile(ty * 8 + tx);
          if (im) cx.drawImage(im, px + tx * 512 * z, py + ty * 512 * z, 512 * z + 0.5, 512 * z + 0.5);
        }
      }
    }
    if (!document.body.classList.contains('no-grid')) {
      cx.strokeStyle = 'rgba(255,255,255,.14)'; cx.lineWidth = 1; cx.beginPath();
      for (var i = 1; i < 8; i++) {
        var gx = Math.round(px + i * 512 * z) + 0.5, gy = Math.round(py + i * 512 * z) + 0.5;
        cx.moveTo(gx, py); cx.lineTo(gx, py + 4096 * z); cx.moveTo(px, gy); cx.lineTo(px + 4096 * z, gy);
      }
      cx.stroke();
    }
  };
  WorldView.prototype.fit = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    if (!W || !H) return;
    this.userMoved = false;
    this.zoom = this.fitZ = Math.min(W, H) / 4096;
    this.pan = [(W - 4096 * this.zoom) / 2, (H - 4096 * this.zoom) / 2];
    this.apply();
  };
  WorldView.prototype.apply = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    // a broken zoom (or none yet): back to the whole world
    if (!isFinite(this.zoom) || this.zoom <= 0 || !isFinite(this.pan[0]) || !isFinite(this.pan[1])) { if (W && H) { this.fit(); return; } }
    // keep part of the world on screen: it can't be dragged away and lost
    if (W && H) {
      var m = Math.min(80, W / 3, H / 3), size = 4096 * this.zoom;
      this.pan[0] = Math.max(m - size, Math.min(W - m, this.pan[0]));
      this.pan[1] = Math.max(m - size, Math.min(H - m, this.pan[1]));
    }
    var z = this.zoom, px = this.pan[0], py = this.pan[1], self = this;
    // pins keep their size on screen, a little bigger when zoomed in
    var ps = (this.box.clientWidth < 500 ? 0.85 : 1) * Math.min(1.8, Math.max(1, Math.sqrt(z / (this.fitZ || z))));
    this.pins.style.setProperty('--pz', ps);
    // small screens: entrance tags only once zoomed in a little (they'd cover the map)
    this.pins.classList.toggle('notag', this.box.clientWidth < 500 && z < (this.fitZ || z) * 1.5);
    Object.keys(this.pinEls).forEach(function (id) {
      var p = self.pinEls[id];
      p.style.left = (px + p.__x * z) + 'px'; p.style.top = (py + p.__y * z) + 'px';
    });
    this.draw();
  };
  WorldView.prototype.zoomAt = function (cx, cy, f) { this.setZoomAt(cx, cy, this.clampZ(this.zoom * f)); };
  WorldView.prototype.setZoomAt = function (cx, cy, z) {
    var r = this.box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    this.pan = [x - (x - this.pan[0]) * z / this.zoom, y - (y - this.pan[1]) * z / this.zoom];
    this.zoom = z; this.userMoved = true; this.apply();
  };
  WorldView.prototype.place = function (p, at) {
    p.__x = at.x; p.__y = at.y;
    p.style.left = (this.pan[0] + at.x * this.zoom) + 'px'; p.style.top = (this.pan[1] + at.y * this.zoom) + 'px';
  };
  WorldView.prototype.paintPins = function () {
    var self = this, seen = {};
    M.checks.forEach(function (c) {
      if (c.world !== self.world) return;
      var id = 'c' + c.id; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin');
        self.place(p, M.checkAt(c));
        hookPin(p, function () { return { kind: 'check', c: c }; });
        self.pins.appendChild(p);
      }
      var col = M.colors[c.id];
      var cls = 'pin ' + (col === null || c.hidden ? 'gone' : M.cleared[c.id] ? 'done' : (col || 'red'));
      if (p.className !== cls) p.className = cls;
      var mk = M.marks[c.id];
      var cur = p.querySelector('img');
      if (mk && M.icons[mk]) { if (!cur) { cur = el('img'); cur.alt = ''; p.appendChild(cur); } if (cur.getAttribute('src') !== M.icons[mk]) cur.src = M.icons[mk]; }
      else if (cur) cur.remove();
    });
    // a second spot for some checks (same state as the check itself)
    (M.ALSO || []).forEach(function (a) {
      if (a.world !== self.world) return;
      var c = M.checks.filter(function (x) { return x.id === a.id; })[0]; if (!c) return;
      var id = 'a' + a.id + a.world; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin');
        self.place(p, { x: a.at[0], y: a.at[1] });
        hookPin(p, function () { return { kind: 'check', c: c, label: a.name }; });
        self.pins.appendChild(p);
      }
      var col = M.colors[c.id];
      var cls = 'pin ' + (col === null ? 'gone' : M.cleared[c.id] ? 'done' : (col || 'red'));
      if (p.className !== cls) p.className = cls;
    });
    Object.keys(M.dungeons).forEach(function (k) {
      var d = M.dungeons[k]; if (!d || d.world !== self.world || (M.dhidden && M.dhidden[k])) return;
      var at = M.dungeonAt(k); if (!at) return;
      var id = 'd' + k; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin dgn');
        self.place(p, at);
        hookPin(p, function () { return { kind: 'dungeon', k: k }; });
        self.pins.appendChild(p);
      }
      var cls = 'pin dgn ' + (M.dcleared[k] ? 'done' : (M.dcolors[k] || 'red'));
      if (p.className !== cls) p.className = cls;
      // its prize, once marked, inside the circle (HydeOut: the map shows which dungeons are crystals)
      var it2 = M.items || {}, pk2 = k === 'hc' || k === 'ct' || k === 'gt' ? null : prizeIcon(it2[k + 'Prize']);
      var psrc = pk2 && M.icons[pk2] ? M.icons[pk2] : '', pzi = p.querySelector('img.pzi');
      if (psrc) {
        if (!pzi) { pzi = el('img', 'pzi'); pzi.alt = ''; p.appendChild(pzi); }
        if (pzi.getAttribute('src') !== psrc) pzi.src = psrc;
        pzi.classList.toggle('got', !!it2[k + 'PrizeObtained']);
      } else if (pzi) pzi.remove();
      // items revealed inside it (Crowd Control's reveal, M.dmark): up to two pictures over the square
      var dm = (M.dmarks ? M.dmarks(k) : []).filter(function (x) { return M.icons[x]; }).slice(-2), dsig = dm.join(',');
      if (p.__dm !== dsig) {
        p.__dm = dsig;
        Array.prototype.slice.call(p.querySelectorAll('img:not(.pzi)')).forEach(function (x) { x.remove(); });
        dm.forEach(function (x, i) { var im = el('img'); im.alt = ''; im.src = M.icons[x]; if (i) im.style.left = '16px'; p.appendChild(im); });
      }
    });
    // entrances (entrance shuffle): every door and hole, where it leads
    var pend = M.entPending ? M.entPending() : null;
    (M.entrances || []).forEach(function (e) {
      if (e.world !== self.world) return;
      var id = 'e' + e.id; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin ent');
        p.appendChild(el('i'));
        hookEnt(p, e.id);
        self.pins.appendChild(p);
      }
      if (p.__x !== e.at.x || p.__y !== e.at.y) self.place(p, e.at);
      var cls = 'pin ent ' + (e.shape || 'round') + (e.done ? ' done' : '') + (e.color ? '' : ' ' + (e.cls || 'red')) + (pend === e.id ? ' pend' : '');
      if (p.className !== cls) p.className = cls;
      var bg = e.done ? '' : (e.color || '');
      if (p.firstChild.style.background !== bg) p.firstChild.style.background = bg;
      var tag = p.querySelector('.tag');
      if (e.label) {
        if (!tag) { tag = el('span', 'tag'); p.appendChild(tag); }
        if (tag.textContent !== e.label) tag.textContent = e.label;
        tag.style.borderColor = e.labelColor || '#888';
      } else if (tag) tag.remove();
      p.title = e.name + (e.to ? ' → ' + e.to : '');
    });
    Object.keys(this.pinEls).forEach(function (id) { if (!seen[id]) { self.pinEls[id].remove(); delete self.pinEls[id]; } });
  };

  function layoutWorlds() {
    var w = $('worlds'), W = w.clientWidth, H = w.clientHeight;
    var stack = W && H && (H / 2 > W / 2 ? Math.min(W, H / 2) > Math.min(W / 2, H) : false);
    w.classList.toggle('stack', !!stack);
    views.forEach(function (v) { v.box.style.display = phoneTab === 'lw' || phoneTab === 'dw' ? (phoneTab === v.world ? '' : 'none') : ''; });
    requestAnimationFrame(function () { views.forEach(function (v) { if (!v.userMoved || !v.fitZ) v.fit(); else v.apply(); }); });
  }

  // ── the card: what's at a check, and what to do about it ──────────────────
  var card = $('card'), cardFor = null, cardSticky = false, cardTimer = null;
  // A check: click (tap) marks it done, or open again; right click (hold) opens
  // its card, to mark which item is there (and, with several places in one
  // square, tick them off one by one). A dungeon: click opens its card.
  function hookPin(p, what) {
    p.addEventListener('click', function (e) {
      e.stopPropagation();
      var w = what();
      if (w.kind === 'check') { hideCard(); M.toggleCheck(w.c.id, !M.cleared[w.c.id]); }
      else showCard(w, p, true);
    });
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); var w = what(); showCard(w, p, true, w.kind === 'check'); });
    longPress(p, function () { var w = what(); showCard(w, p, true, w.kind === 'check'); });
  }
  // An entrance: click marks it done (or, while joining a connector, picks
  // its other end); right click (hold) opens its menu.
  function hookEnt(p, id) {
    p.addEventListener('click', function (e) {
      e.stopPropagation();
      if (M.entPending && M.entPending() && M.entPending() !== id) { M.entConnectTo(id); return; }
      hideCard(); M.entClick(id);
    });
    function menu() { if (M.entMenu && M.entMenu(id, p)) return; showCard({ kind: 'ent', id: id }, p, true); }
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); menu(); });
    longPress(p, menu);
  }
  function entById(id) { return (M.entrances || []).filter(function (x) { return x.id === id; })[0]; }
  card.addEventListener('mouseenter', function () { clearTimeout(cardTimer); });
  card.addEventListener('mouseleave', function () { if (!cardSticky) cardTimer = setTimeout(hideCard, 250); });
  document.addEventListener('pointerdown', function (e) { if (card.classList.contains('show') && !card.contains(e.target) && !e.target.closest('.pin')) hideCard(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideCard(); if (M.entPending && M.entPending()) M.entCancel(); } });
  function hideCard() { card.classList.remove('show'); cardFor = null; cardSticky = false; document.querySelectorAll('.pin.hl').forEach(function (p) { p.classList.remove('hl'); }); }
  function showCard(w, pin, sticky, picking) {
    clearTimeout(cardTimer);
    cardFor = { w: w, pin: pin }; cardSticky = sticky;
    document.querySelectorAll('.pin.hl').forEach(function (p) { p.classList.remove('hl'); });
    pin.classList.add('hl');
    fillCard(picking);
    card.classList.add('show');
    var r = pin.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    var x = r.right + 8, y = r.top - 8;
    if (x + cw > innerWidth - 6) x = r.left - cw - 8;
    if (x < 6) x = Math.max(6, Math.min(innerWidth - cw - 6, r.left - cw / 2));
    if (y + ch > innerHeight - 6) y = innerHeight - ch - 6;
    card.style.left = Math.max(6, x) + 'px'; card.style.top = Math.max(6, y) + 'px';
  }
  function fillCard(picking) {
    if (!cardFor) return;
    var w = cardFor.w; card.textContent = '';
    var x = el('button', 'x', '✕'); x.type = 'button'; x.title = 'Close (Esc)'; x.addEventListener('click', hideCard); card.appendChild(x);
    var btns = el('div', 'btns');
    function btn(label, fn, title) { var b = el('button', null, label); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); btns.appendChild(b); }
    if (w.kind === 'ent') {
      var en = entById(w.id); if (!en) { hideCard(); return; }
      card.appendChild(el('h4', null, en.name));
      var es = el('div', 'st'); var ei = el('i'); ei.style.background = en.done ? CSS.done : (en.color || CSS[en.cls] || '#555'); es.appendChild(ei);
      es.appendChild(document.createTextNode(en.done ? 'Done' : en.to ? 'Leads to ' + en.to : en.label ? 'Marked ' + en.label : 'Not found yet'));
      card.appendChild(es);
      if (en.links && en.links.length) card.appendChild(el('div', 'st', 'Connector to: ' + en.links.join(', ')));
      btn(en.done ? '↺ Not done' : '✓ Done', function () { M.entClick(en.id); hideCard(); });
      if (M.entConnectStart) btn(M.entPending && M.entPending() === en.id ? 'Cancel' : (M.entConnectLabel || 'Connector…'), function () {
        if (M.entPending() === en.id) M.entCancel(); else { M.entConnectStart(en.id); M.toast(M.entConnectHint || 'Now click the other end of the connector (Esc to cancel).'); }
        hideCard();
      }, M.entConnectTitle || 'Join this door to the other door of the same cave');
      if (M.entMore) btn(M.entMoreLabel || 'More…', function () { hideCard(); M.entMore(en.id); }, M.entMoreTitle || '');
      if (M.entClear && (en.label || en.to || (en.links && en.links.length))) btn('Clear', function () { M.entClear(en.id); hideCard(); }, 'Forget where it leads');
      card.appendChild(btns);
      (en.links || []).forEach(function (o) {
        var r = el('div', 'btns'); var b2 = el('button', null, '✕ ' + o); b2.type = 'button'; b2.title = 'Remove this connector';
        b2.addEventListener('click', function (e) { e.stopPropagation(); M.entUnlink(en.id, o); hideCard(); }); r.appendChild(b2); card.appendChild(r);
      });
      var groups = M.entCodes ? M.entCodes(en.id) : [];
      groups.forEach(function (g) {
        card.appendChild(el('div', 'sub', g.title));
        var gr = el('div', 'codes');
        g.codes.forEach(function (c) {
          var b3 = el('button', 'code' + ((c.on != null ? c.on : en.label === c.text) ? ' on' : ''), c.text); b3.type = 'button';
          if (c.color) b3.style.background = c.color;
          if (c.title) b3.title = c.title;
          if (c.disabled) { b3.disabled = true; b3.style.opacity = '.35'; }
          b3.addEventListener('click', function (e) { e.stopPropagation(); M.entLabel(en.id, c.code); hideCard(); });
          gr.appendChild(b3);
        });
        card.appendChild(gr);
      });
      return;
    }
    if (w.kind === 'check') {
      var c = w.c, done = !!M.cleared[c.id], col = done ? 'done' : (M.colors[c.id] || 'red');
      card.appendChild(el('h4', null, w.label || c.name));
      var st = el('div', 'st'); var i = el('i'); i.style.background = CSS[col] || '#555'; st.appendChild(i); st.appendChild(document.createTextNode(COLOR_WORD[col] || col)); card.appendChild(st);
      if (M.marks[c.id]) { var m = el('div', 'st', 'Marked: '); var mi = iconImg(M.marks[c.id]); if (mi) { mi.style.width = mi.style.height = '20px'; mi.style.verticalAlign = 'middle'; mi.style.imageRendering = 'pixelated'; m.appendChild(mi); } card.appendChild(m); }
      btn(done ? '↺ Not done' : (M.locsOf && M.locsOf(c.id).length > 1 ? '✓ All done' : '✓ Done'), function () { M.toggleCheck(c.id, !done); hideCard(); }, done ? 'Open it again' : 'Mark it collected');
      btn('Mark an item…', function () { fillCard(true); }, 'Note which item is there (shows on the map)');
      card.appendChild(btns);
      // a square with several places in it: each one, to tick off on its own
      var locs = M.locsOf ? M.locsOf(c.id) : [];
      if (locs.length > 1) {
        var ul = el('div', 'locs');
        locs.forEach(function (L) {
          var row = el('button', 'loc' + (L.done ? ' done' : '')); row.type = 'button';
          var d = el('i'); d.style.background = CSS[L.done ? 'done' : L.color] || '#555'; row.appendChild(d);
          row.appendChild(document.createTextNode(L.label));
          row.title = L.done ? 'Done: click to open it again' : (COLOR_WORD[L.color] || '') + ': click to mark it done';
          row.addEventListener('click', function (e) { e.stopPropagation(); M.toggleLoc(L.name, !L.done); setTimeout(function () { fillCard(false); }, 120); });
          ul.appendChild(row);
        });
        card.appendChild(ul);
      }
      if (picking) {
        var pick = el('div', 'pick');
        var keys = ['bow2', 'boomerang1', 'boomerang2', 'hookshot', 'bomb', 'mushroom', 'powder', 'firerod', 'icerod', 'bombos', 'ether', 'quake', 'lamp', 'hammer',
          'shovel', 'flute', 'net', 'book', 'bottle1', 'somaria', 'byrna', 'cape', 'mirror', 'boots', 'gloves1', 'gloves2', 'flippers', 'moonpearl',
          'sword1', 'shield1', 'tunic1', 'bow3', 'halfmagic', 'bigkey', 'map', 'compass', 'crystal', 'pendant_green'];
        keys.forEach(function (k) {
          if (!M.icons[k]) return;
          var b = el('button'); b.type = 'button'; b.title = k; var im = iconImg(k); b.appendChild(im);
          b.addEventListener('click', function (e) { e.stopPropagation(); M.mark(c.id, k); fillCard(false); });
          pick.appendChild(b);
        });
        if (M.marks[c.id]) { var cl = el('button', null, '✕'); cl.type = 'button'; cl.title = 'Clear the mark'; cl.addEventListener('click', function (e) { e.stopPropagation(); M.mark(c.id, null); fillCard(false); }); pick.appendChild(cl); }
        if (!pick.children.length) pick.appendChild(el('span', null, 'Item pictures are still being drawn from the game…'));
        card.appendChild(pick);
      }
    } else {
      var k = w.k, nm = (DGS.filter(function (d) { return d[0] === k; })[0] || [k, k, k])[2], it = M.items || {};
      card.appendChild(el('h4', null, nm));
      var dc = M.dcleared[k] ? 'done' : (M.dcolors[k] || 'red');
      var s2 = el('div', 'st'); var i2 = el('i'); i2.style.background = CSS[dc] || '#555'; s2.appendChild(i2); s2.appendChild(document.createTextNode(COLOR_WORD[dc] || dc)); card.appendChild(s2);
      var max = it[k + 'MaxChests'];
      if (max != null) card.appendChild(el('div', 'st', 'Chests: ' + (it[k + 'Chests'] || 0) + ' of ' + max + (it[k + 'BigKey'] ? ' · big key ✓' : '')));
      var dmk = M.dmarks ? M.dmarks(k) : [];
      if (dmk.length) {
        var rv = el('div', 'st', 'Revealed inside: ');
        dmk.forEach(function (x) { var im = iconImg(x); if (im) { im.style.width = im.style.height = '20px'; im.style.verticalAlign = 'middle'; im.style.imageRendering = 'pixelated'; rv.appendChild(im); } });
        card.appendChild(rv);
        btn('Clear revealed', function () { M.mark('dg:' + k, null); hideCard(); });
      }
      var short = (DGS.filter(function (d) { return d[0] === k; })[0] || [])[1];
      btn('Open its map', function () { var i = dgIndex(short); hideCard(); if (i >= 0) selectDg(i); });
      card.appendChild(btns);
    }
  }

  // ── World / dungeon buttons, and the dungeon map ──────────────────────────
  var dgSel = -1, dgView = null, dgBtns = [];
  function buildDgBar() {
    var bar = $('dgbar'); bar.textContent = '';
    function mk(i, label, title) {
      var b = el('button', 'dg-btn', label); b.type = 'button'; b.title = title;
      b.addEventListener('click', function () { selectDg(i); });
      bar.appendChild(b); dgBtns.push(b);
    }
    mk(-1, 'World', 'The Light and Dark World');
    if (D) {
      D.list.forEach(function (d, i) { mk(i, d[1], d[2]); });
      dgView = new D.View($('dgview'));
      // follow Link into a dungeon's map only when asked (HydeOut: the world map stays up to plan the way on)
      D.onEnter = function (dg) { if (follow) selectDg(dg); paintHere(); };
    }    // The live games (GT big key, Digging Game) without Crowd Control: Rando Hub
    // runs them (addons/live-games.js); here they're a tap away, by the maps (HydeOut)
    var hub = null;
    try { hub = (window.parent !== window && window.parent.RandoLiveGames) || (window.opener && window.opener.RandoLiveGames) || null; } catch (e) {}
    if (hub) {
      var box = el('span', 'lg-btns');
      [['gt', '🗝', 'GT big key game: take guesses on which Ganon\u2019s Tower chest has the big key'],
       ['dig', '⛏', 'Digging Game: take guesses on which dig gives the prize']].forEach(function (g) {
        var b = el('button', 'dg-btn lg-btn', g[1]); b.type = 'button'; b.title = g[2];
        b.addEventListener('click', function () { try { hub.open(g[0]); } catch (e) {} });
        box.appendChild(b);
      });
      bar.appendChild(box);
    }
  }
  function selectDg(i) { dgSel = i; paintDg(); }
  function paintDg() {
    var here = D ? D.where().dg : -1;
    $('worlds').style.display = dgSel < 0 ? '' : 'none';
    $('dgview').style.display = dgSel < 0 ? 'none' : '';
    dgBtns.forEach(function (b, k) {
      var i = k - 1;
      b.classList.toggle('on', i === dgSel);
      b.classList.toggle('here', i >= 0 && i === here);
      b.classList.toggle('seen', i >= 0 && D && D.explored(i));
    });
    if (dgSel >= 0 && dgView && dgView.dg !== dgSel) dgView.show(dgSel);
    if (dgSel < 0) layoutWorlds();
  }
  setInterval(function () { paintDg(); paintHere(); }, 1000);

  // ── footer: counters from the game ────────────────────────────────────────
  function paintStats() {
    var KS = window.RandoKeysClient && window.RandoKeysClient.stats();
    var it = M.items || {}, g = (KS && KS.gt) || it.gtBk || null, s = $('stats');
    var parts = M.stats ? M.stats() : [['Checks', it.checks || 0], ['Deaths', it.deaths || 0], ['Bonks', it.bonks || 0]];
    var html = parts.map(function (p) { return '<span>' + p[0] + ' <b>' + p[1] + '</b></span>'; }).join('');
    if (g && g.enabled !== false) html += '<span title="Ganon’s Tower: chests opened, and which chest had the big key">GT chests <b>' + (g.chests || 0) + '</b>/' + (g.total || 22) + (g.found ? ' · big key at <b>' + (g.at != null ? g.at : '?') + '</b>' : '') + '</span>';
    s.innerHTML = html;
    paintSideStats(KS, g, parts);
  }
  // iPad layout: the counters in the space right of the items (HydeOut): checks, deaths, bonks,
  // then the GT big key game and the digging game
  function paintSideStats(KS, g, parts) {
    var L = $('sst-l'), R = $('sst-r'); if (!L || !R) return;
    function box(label, val, sub, title) {
      return '<div class="sst" title="' + (title || label) + '"><small>' + label + '</small><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>';
    }
    var get = function (n) { var p = parts.filter(function (x) { return x[0] === n; })[0]; return p ? p[1] : (KS && KS[n.toLowerCase()]) || 0; };
    // checks out of the places there are, when the logic knows them ("Locations 46/216")
    var loc = parts.filter(function (x) { return x[0] === 'Locations'; })[0], tot = loc ? String(loc[1]).split('/')[1] : '';
    var l = box('Checks', get('Checks') + (tot ? '<span>/' + tot + '</span>' : ''), '', 'Checks: items picked up' + (tot ? ', out of ' + tot + ' places' : '')) + box('Deaths', get('Deaths')) + box('Bonks', get('Bonks'));
    var r = '';
    if (g && g.enabled !== false) r += box('GT chests', (g.chests || 0) + '<span>/' + (g.total || 22) + '</span>', g.found ? 'big key at ' + (g.at != null ? g.at : '?') : '', 'Ganon’s Tower: chests opened, and which chest had the big key');
    var dg = KS && KS.dig;
    if (dg) r += box('Dig game', dg.found ? '✓' : (dg.digs || 0) + '<span>/' + (dg.total || 30) + '</span>', dg.found ? 'prize on dig ' + (dg.at != null ? dg.at : '?') : '', 'The digging game: digs, and which dig gave the prize');
    if (L.__h !== l) { L.__h = l; L.innerHTML = l; }
    if (R.__h !== r) { R.__h = r; R.innerHTML = r; }
  }

  // ── link status ───────────────────────────────────────────────────────────
  function paintLink() {
    var l = $('link'), t = $('link-t');
    var on = M.linked && !!M.items;
    l.classList.toggle('on', on);
    t.textContent = M.linkText ? M.linkText() : !M.linked ? 'Waiting for Hutch’s logic…' : !M.items ? 'Waiting for the item tracker…' : M.iconState === 'drawing' ? 'Drawing items from the game…' : 'Live';
  }

  // ── options ───────────────────────────────────────────────────────────────
  var SIZE_KEY = 'rhb-mudora-isize', isize = 'auto';
  // Rando Hub laying this page out around its game (iPad layout, or Tablet on a wide screen)
  function hosted() { var c = document.body.classList; return c.contains('stack') || c.contains('wide'); }
  try { isize = localStorage.getItem(SIZE_KEY) || 'auto'; } catch (e) {}
  function applySize() {
    var side = $('side'), px;
    if (stackIsz && hosted()) px = stackIsz;
    else if (isize === 'auto') {
      var W = phoneTab === 'items' ? innerWidth - 24 : document.body.classList.contains('stack') ? Math.min(($('side').clientWidth || 600) * 0.45, 340) : Math.min(innerWidth * 0.32, 340);
      px = Math.max(26, Math.min(phoneTab ? 48 : 64, Math.floor((W - 30 - 5 * 4) / 6)));
    } else px = +isize;
    document.documentElement.style.setProperty('--isz', px + 'px');
  }
  $('isize').value = isize;
  $('isize').addEventListener('change', function () { isize = this.value; try { localStorage.setItem(SIZE_KEY, isize); } catch (e) {} applySize(); layoutWorlds(); });
  var gridOn = true;
  try { gridOn = localStorage.getItem('rhb-mudora-grid') !== '0'; } catch (e) {}
  $('o-grid').checked = gridOn; document.body.classList.toggle('no-grid', !gridOn);
  $('o-grid').addEventListener('change', function () { document.body.classList.toggle('no-grid', !this.checked); views.forEach(function (v) { v.draw(); }); try { localStorage.setItem('rhb-mudora-grid', this.checked ? '1' : '0'); } catch (e) {} });
  var follow = false, listMode = 'all';
  try { follow = localStorage.getItem('rhb-mudora-follow') === '1'; listMode = localStorage.getItem('rhb-mudora-dglist') || 'all'; } catch (e) {}
  if ($('o-follow')) {
    $('o-follow').checked = follow;
    $('o-follow').addEventListener('change', function () { follow = this.checked; try { localStorage.setItem('rhb-mudora-follow', follow ? '1' : '0'); } catch (e) {} });
  }
  function applyList() {
    document.body.classList.toggle('dg-here-only', listMode === 'here');
    if ($('dglist')) $('dglist').value = listMode;
    paintDungeons();
  }
  if ($('b-pop')) $('b-pop').addEventListener('click', popOut);
  // how the item pictures look: the game's pixels, smoothed, or your own
  var ICON_KEYS = 'bow1 bow2 bow3 boomerang1 boomerang2 hookshot bomb mushroom powder firerod icerod bombos ether quake lamp hammer shovel flute net book ' +
    'bottle1 bottle2 bottle3 bottle4 bottle5 bottle6 bottle7 somaria byrna cape mirror boots gloves1 gloves2 flippers moonpearl sword1 sword2 sword3 sword4 ' +
    'shield1 shield2 shield3 tunic0 tunic1 tunic2 halfmagic bigkey map compass crystal crystal_red pendant_red pendant_blue pendant_green';
  function iconSel() {
    var s = $('iconstyle'); if (!s) return;
    var n = Object.keys(M.customIcons ? M.customIcons() : {}).length;
    s.querySelector('option[value=custom]').textContent = n ? 'Custom pictures (' + n + ')…' : 'Custom pictures…';
    s.querySelector('option[value=clear]').hidden = !n;
    s.value = M.iconStyle || 'pixel';
  }
  if ($('iconstyle')) {
    iconSel();
    $('iconstyle').addEventListener('change', function () {
      var v = this.value;
      if (v === 'pixel' || v === 'smooth') { M.setIconStyle(v); iconSel(); return; }
      if (v === 'clear') { if (confirm('Forget your own pictures and use the game’s again?')) M.setCustomIcons({}); iconSel(); return; }
      iconSel();
      alert('Your own item pictures: pick PNG files named after the item, for example hookshot.png, sword2.png, crystal_red.png.\n' +
        'Each one takes the place of the game’s picture for that item; the rest stay as they are.\n\nNames: ' + ICON_KEYS.split(' ').join(', '));
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/gif,image/webp'; inp.multiple = true;
      inp.addEventListener('change', function () {
        var map = Object.assign({}, M.customIcons()), files = Array.prototype.slice.call(inp.files || []), left = files.length, used = 0, skipped = [];
        if (!left) return;
        files.forEach(function (f) {
          var k = f.name.replace(/\.[a-z]+$/i, '').toLowerCase();
          if (ICON_KEYS.split(' ').indexOf(k) < 0 || f.size > 200000) { skipped.push(f.name); if (!--left) done(); return; }
          var rd = new FileReader();
          rd.onload = function () { map[k] = rd.result; used++; if (!--left) done(); };
          rd.onerror = function () { skipped.push(f.name); if (!--left) done(); };
          rd.readAsDataURL(f);
        });
        function done() {
          if (used) M.setCustomIcons(map);
          iconSel();
          M.toast(used + ' picture' + (used === 1 ? '' : 's') + ' used' + (skipped.length ? '; not used (name not an item, or over 200 KB): ' + skipped.join(', ') : ''));
        }
      });
      inp.click();
    });
  }
  if ($('dglist')) $('dglist').addEventListener('change', function () { listMode = this.value; try { localStorage.setItem('rhb-mudora-dglist', listMode); } catch (e) {} applyList(); });
  function dgModes() {
    var sel = $('dgmode');
    if (!D) { sel.parentNode.style.display = 'none'; return; }
    var opts = [['explore', 'Explore (fog of war)'], ['map', 'Map (like the game)']];
    if (!document.body.classList.contains('phone')) opts.push(['full', 'Full (every room)']);
    var sig = opts.map(function (o) { return o[0]; }).join();
    if (sel.__sig !== sig) { sel.__sig = sig; sel.textContent = ''; opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; sel.appendChild(e); }); }
    sel.value = D.mode();
  }
  $('dgmode').addEventListener('change', function () {
    var m = this.value;
    if (m === 'full' && D.pref() !== 'full' && !confirm('Full dungeon maps show every room of every dungeon right away, before you’ve been there.\n\n' +
        'That’s meant for players new to rando: seeing the whole dungeon helps find the way to each check (and the pots in pot shuffle). ' +
        'It gives away the layout, so if you like finding your own way, keep Explore.\n\nUse full maps?')) { this.value = D.mode(); return; }
    D.setMode(m);
  });
  // put every map back as it started (both worlds, and the dungeon map)
  function resetMaps() {
    hideCard();
    layoutWorlds();
    views.forEach(function (v) { v.userMoved = false; v.fit(); });
    if (dgView && dgView.fit) { try { dgView.fit(); } catch (e) {} }
  }
  window.MudoraResetMaps = resetMaps;
  $('b-reset').addEventListener('click', resetMaps);
  $('gear').addEventListener('click', function (e) { e.stopPropagation(); document.body.classList.toggle('bar-open'); });
  // phone: tapping anywhere else closes the options
  document.addEventListener('pointerdown', function (e) {
    if (!document.body.classList.contains('bar-open') || !(document.body.classList.contains('phone') || hosted())) return;
    if (e.target.closest('#bar') || e.target.closest('#gear') || e.target.closest('#set') || e.target.closest('#card')) return;
    document.body.classList.remove('bar-open');
  });
  // on a phone the colour key lives with the options, not under the map
  function placeLegend() {
    var lg = $('legend'), want = document.body.classList.contains('phone') || hosted() ? $('bar') : $('foot');
    if (lg && lg.parentNode !== want) want.appendChild(lg);
  }
  $('b-help').addEventListener('click', function () {
    if (M.helpText) { alert(M.helpText); return; }
    alert('Mudora — Rando Hub’s own tracker.\n\n' +
      'Logic: Hutch’s tracker, unchanged (it runs out of sight and Mudora shows its answers). Pictures, maps and where each check sits come from your game itself.\n\n' +
      'Items: click to go up, right click (hold on a phone) to go back. Right click Bombos, Ether or Quake to mark which of Misery Mire / Turtle Rock it opens.\n' +
      'Map: click (tap) a square to mark it done; click again to open it again. Right click (hold) a square to mark which item is there. ⟲ on a map, or Reset maps at the top, puts the maps back as they started.\n' +
      'Dungeons: click a dungeon to open its map (with Follow into dungeons, entering one in the game shows it too). Chests, small keys, big key, map and compass: click to count, right click to undo.\n' +
      'This dungeon: the card under the list shows the dungeon Link is in (boss: click to pick another; prize: click / right click; a chest for every check). List → This dungeon only shows just the card, for stream.\n\n' +
      'Zoom with the wheel or a pinch, drag to move, double-click (double-tap) to fit.');
  });

  // ── phone: Rando Hub's tabs (items / Light World / Dark World) ────────────
  var phoneTab = null;
  window.MudoraPhone = {
    set: function (t) {
      t = t === 'lw' || t === 'dw' || t === 'items' || t === 'keys' ? t : null;
      phoneTab = t;
      document.body.classList.toggle('phone', !!t);
      ['items', 'keys', 'lw', 'dw'].forEach(function (x) { document.body.classList.toggle('ph-' + x, t === x); });
      dgModes(); applySize(); placeLegend(); layoutWorlds();
    },
    zoom: function (dir) {
      var v = views.filter(function (x) { return x.box.offsetParent; })[0];
      if (v) { var r = v.box.getBoundingClientRect(); v.zoomAt(r.left + r.width / 2, r.top + r.height / 2, dir > 0 ? 1.4 : 1 / 1.4); }
    },
  };
  var qs = new URLSearchParams(location.search);
  if (qs.get('phone')) window.MudoraPhone.set(qs.get('phone'));

  // ── Rando Hub's iPad layout (mudora-stack.js): the game sits over this page ─
  // Rando Hub says how big a space to leave for it, top left; the items and
  // dungeons go under it, the maps beside (sideways) or below (upright), as
  // with Hutch's tracker in that layout. The options go behind ⚙.
  var stackSig = '', stackIsz = 0;
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.type !== 'mudora-stack') return;
    var b = document.body, r = document.documentElement.style;
    var st = d.on && d.strip;
    var sig = d.on ? [d.hole.w, d.hole.h, d.each, d.side, d.isz, d.wide, d.sideW, st ? [st.x, st.y, st.w, st.h].join(':') : ''].join() : 'off';
    stackIsz = d.on ? d.isz || 0 : 0;
    if (sig === stackSig) return;
    stackSig = sig;
    b.classList.toggle('stack', !!(d.on && !d.wide));
    b.classList.toggle('wide', !!(d.on && d.wide));
    b.classList.toggle('stack-side', !!(d.on && d.side && !d.wide));
    if (d.on) {
      r.setProperty('--hole-w', d.hole.w + 'px'); r.setProperty('--hole-h', d.hole.h + 'px');
      r.setProperty('--each', d.each + 'px'); r.setProperty('--sgap', (d.gap || 4) + 'px');
      r.setProperty('--side-w', (d.sideW || 0) + 'px');
      if (st) { r.setProperty('--strip-x', st.x + 'px'); r.setProperty('--strip-y', st.y + 'px'); r.setProperty('--strip-w', st.w + 'px'); r.setProperty('--strip-h', st.h + 'px'); }
    } else b.classList.remove('bar-open');
    b.classList.toggle('has-strip', !!st);
    b.classList.toggle('strip-col', !!(st && st.h > st.w));
    stripStats(!!st);
    placeLegend(); applySize(); layoutWorlds(); fitStack();
  });
  // The counters go in the room the game leaves, beside or under it (and back after)
  function stripStats(on) {
    var L = $('sst-l'), R = $('sst-r'), st = $('sst-strip'), it = $('items');
    if (!L || !R || !it) return;
    if (on) {
      if (!st) { st = document.createElement('div'); st.id = 'sst-strip'; $('main').appendChild(st); }
      if (L.parentNode !== st) { st.appendChild(L); st.appendChild(R); }
    } else if (st && L.parentNode === st) {
      it.parentNode.insertBefore(L, it); it.parentNode.insertBefore(R, it.nextSibling);
    }
  }
  // the items shrink until the items and dungeons fit under (or beside) the game without scrolling (HydeOut)
  function fitStack() {
    if (!stackIsz || !hosted()) return;
    var side = $('side'), px = stackIsz;
    document.documentElement.style.setProperty('--isz', px + 'px');
    while (px > 18 && side.scrollHeight > side.clientHeight + 1) {
      px -= 1; document.documentElement.style.setProperty('--isz', px + 'px');
    }
  }
  try { if (window.parent !== window) window.parent.postMessage({ type: 'mudora-stack-ask' }, '*'); } catch (e) {}

  // ── start ─────────────────────────────────────────────────────────────────
  function onResize() { applySize(); layoutWorlds(); fitStack(); }
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(onResize, 80); });
  buildItems(); buildDungeons(); buildHere(); buildDgBar(); applyList();
  ['lw', 'dw'].forEach(function (w) { $('worlds').appendChild(new WorldView(w).box); });
  applySize(); dgModes(); paintDg(); paintStats(); paintLink();
  M.on(function (what) {
    if (what === 'items') { paintItems(); paintDungeons(); fitStack(); paintStats(); paintLink(); views.forEach(function (v) { v.paintPins(); }); }
    else if (what === 'checks') { views.forEach(function (v) { v.paintPins(); }); paintDungeons(); if (cardFor && !cardSticky) fillCard(false); }
    else if (what === 'dungeons') paintDungeons();
    else if (what === 'maps') views.forEach(function (v) { v.paintTiles(); });
    else if (what === 'icons') { iconSel(); paintItems(); paintDungeons(); views.forEach(function (v) { v.paintPins(); }); var bi = $('brand-ic'); if (M.icons.book) bi.src = M.icons.book; paintLink(); }
    else if (what === 'link') paintLink();
  });
  setTimeout(onResize, 50);
})();
