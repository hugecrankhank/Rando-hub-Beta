/*
 * mudora2.js — Mudora 2.0: Mudora's look, Muffins' logic.
 *
 * Logic and settings: Muffins' Tracker 2.0 (https://github.com/KrisDavie/alttptracker,
 * react_rewrite), unchanged. It runs in a frame on this page
 * (../mfns-tracker/, his own build): you pick settings on his launch page, then
 * his tracker keeps running out of sight while Mudora shows its answers. This
 * file reads his tracker's state (items, dungeons, every location's logic
 * status) and sends clicks back as the same actions his own buttons send.
 *
 * Which locations sit in each map square, and where his squares are, come
 * from his data (../mfns-tracker/data.json, made from his source by
 * tools/mfns-extract.ts). Where each square is drawn is moved to the game's
 * own door / item positions read from the ROM (AT below), like Mudora 1.
 *
 * Everything else (pictures, maps, dungeon maps, marks) is Mudora's own:
 * ../mudora/mudora.js and ../mudora/ui.js. window.Mudora is filled in here.
 *
 * Problems with the logic: Muffins (his Discord). Problems with how it's
 * shown here: Rando Hub.
 */
(function () {
  'use strict';
  var M = window.Mudora;
  var Mudora2 = window.Mudora2 = {};
  M.logicName = 'Muffins’';

  // where each of his squares is in the game (game pixels, 4096 per world)
  var AT = {"Bombos Tablet":[888,3768],"Bottle Merchant":[392,1896],"Desert Ledge":[104,3752],"Ether Tablet":[1720,72],"Floating Island":[3320,56],"Flute Spot":[1180,2712],"Hobo":[2900,2855],"Waterfall Fairy":[3696,548],"King Zora":[3908,530],"Lake Hylia Island":[2968,3384],"Master Sword Pedestal":[205,139],"Maze Race":[120,2872],"Mushroom":[508,352],"Old Man":[1664,772],"Spectacle Rock":[2088,360],"Sunken Treasure":[1843,3826],"Zora's Ledge":[3950,556],"Bumper Cave Ledge":[1416,648],"Catfish":[3707,705],"Digging Game":[238,2834],"Pyramid":[2376,1832],"Stumpy":[1256,2808],"Sanctuary":[1888,1092],"Spectacle Rock Cave":[2000,596],"Paradox Cave":[3536,884],"Spiral Cave":[3264,372],"Dam":[1920,3828],"Blinds Hideout":[528,1716],"Hyrule Castle Secret Entrance":[2440,1704],"Kings Grave":[2464,1220],"Tavern North":[656,2340],"Chicken House":[400,2212],"Sahasrahlas Hut":[3328,1860],"Kakariko Well":[88,1736],"Blacksmiths Hut":[1248,2180],"Bat Cave":[1320,2312],"Sick Kids House":[640,2196],"Lost Woods Hideout":[776,536],"Lumberjack Tree":[1224,296],"Cave 45":[1155,3445],"Graveyard Cave":[2336,1124],"Checkerboard Cave":[720,3188],"Mini Moldorm Cave":[2672,3844],"Ice Rod Cave":[3664,3156],"Bonk Rock Cave":[1600,1204],"Library":[640,2692],"Potion Shop":[3280,1364],"Sanctuary Grave":[2195,1327],"Mimic Cave":[3456,372],"Superbunny Cave":[3456,596],"Hookshot Cave":[3408,276],"Pyramid Fairy":[1920,1988],"Hype Cave":[2448,3188],"Brewery":[448,2388],"C-Shaped House":[848,1972],"Chest Game":[208,1908],"Hammer Peg Cave":[1296,2484],"Mire Shed":[160,3284],"Spike Cave":[2352,596],"Links House":[2240,2820],"Aginahs Cave":[816,3380],"Hyrule Castle":[2048,1806],"Desert Palace":[304,3268],"Eastern Palace":[3936,1588],"Tower of Hera":[2304,132],"Castle Tower":[2048,1636],"Thieves Town":[512,1988],"Skull Woods":[160,212],"Ice Palace":[3264,3540],"Misery Mire":[304,3300],"Palace of Darkness":[3936,1604],"Swamp Palace":[1920,3828],"Turtle Rock":[3856,324],"Ganons Tower":[2304,68]};
  AT['Purple Chest'] = [1400, 3672];
  // his Purple Chest square is the man who opens it (Light World); the chest itself is found in the Dark World
  M.ALSO = [{ id: 'Purple Chest', world: 'dw', at: [1240, 2136], name: 'Purple Chest: where the chest is' }];

  var COLOR = { available: 'green', possible: 'yellow', ool: 'purple', information: 'orange', unavailable: 'red' };
  var ORDER = { unavailable: 0, information: 1, possible: 2, ool: 3, available: 4 };
  var DATA = null, store = null, state = null, launched = false;
  var frame = document.getElementById('mf-frame'), over = document.getElementById('mf');
  var SKEY = 'rhb-mudora2-session';

  fetch('../mfns-tracker/data.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d; read(); })
    .catch(function () { M.toast('Couldn’t load Muffins’ tracker data.'); });

  // ── his tracker, in the frame ─────────────────────────────────────────────
  function open(route) {
    store = null; state = null; launched = false;
    frame.src = '../mfns-tracker/index.html?route=' + encodeURIComponent(route);
    M.linked = false; M.emit('link');
  }
  function show(on) { over.classList.toggle('show', !!on); document.body.classList.toggle('mf-open', !!on); }
  Mudora2.show = show;
  Mudora2.newGame = function () { open('/'); show(true); };
  var saved = null;
  try { saved = localStorage.getItem(SKEY); } catch (e) {}
  if (saved) open('/tracker?id=' + saved); else { open('/'); show(true); }
  document.getElementById('b-mf').addEventListener('click', function () { show(!over.classList.contains('show')); });
  document.getElementById('b-new').addEventListener('click', function () {
    if (confirm('Start a new game? Muffins’ launch page opens to pick the settings (your current game stays in his list of sessions).')) Mudora2.newGame();
  });
  document.getElementById('mf-close').addEventListener('click', function () { show(false); });

  function action(type, payload) {
    var w = frame.contentWindow;
    // made in his page's own world, so his code sees an ordinary object
    var a = w.JSON.parse(JSON.stringify({ type: type, payload: payload }));
    store.dispatch(a);
  }

  setInterval(function () {
    var w = null;
    try { w = frame.contentWindow; } catch (e) {}
    if (!w) return;
    var path = '';
    try { path = w.location.pathname; } catch (e) { return; }
    if (path === '/tracker' && !launched) {
      var id = null;
      try { id = new URLSearchParams(w.location.search).get('id'); } catch (e) {}
      if (id) { launched = true; try { localStorage.setItem(SKEY, id); } catch (e) {} show(false); }
    }
    if (launched && !store) {
      var s = null;
      try { s = w.__rhStore && w.__rhStore(); } catch (e) {}
      if (s) { store = s; store.subscribe(soon); M.linked = true; M.emit('link'); read(); }
    }
  }, 300);
  var t = 0;
  function soon() { if (!t) t = setTimeout(function () { t = 0; read(); }, 60); }

  // ── what his settings put on the map ──────────────────────────────────────
  function active(l, S) {
    switch (l.category) {
      case 'chest': return true;
      case 'keyDrop': return S.enemyDrop !== 'none';
      case 'potKey': return S.pottery !== 'none';
      case 'pot':
        if (S.pottery === 'none' || S.pottery === 'keys') return false;
        if (l.regionType === 'Dungeon') return S.pottery === 'dungeon' || S.pottery === 'lottery';
        if (l.regionType === 'Cave') return S.pottery === 'cave' || S.pottery === 'cavekeys' || S.pottery === 'lottery';
        return true;
      case 'enemy': return S.enemyDrop === 'underworld';
      case 'bonk': return !!S.bonkShuffle;
      case 'shop': return !!S.shopsanity;
      case 'prize': return S.prizeShuffle !== 'vanilla';
      case 'event': return false;
      default: return true;
    }
  }
  function locsFor(entry, S) {
    var e = DATA.entries[entry]; if (!e) return [];
    return e.locs.filter(function (l) { return active(l, S); }).map(function (l) { return l.name; });
  }
  // his square colour: all done; else the best status among what's left
  // (several statuses with one of them available: "some available")
  function judge(names, LC) {
    var best = 'unavailable', set = {}, n = 0, left = 0;
    names.forEach(function (nm) {
      var c = LC[nm];
      if (c && c.checked) return;
      left++;
      var lg = (c && c.logic) || 'unavailable';
      if (!set[lg]) { set[lg] = 1; n++; }
      if (ORDER[lg] > ORDER[best]) best = lg;
    });
    if (!names.length) return { done: false, color: null };
    if (!left) return { done: true, color: 'done' };
    return { done: false, color: n !== 1 && set.available ? 'partial' : COLOR[best] };
  }

  var squares = {}, sqLocs = {};
  var MED = { bombos: 1, ether: 2, quake: 3 };
  var PRIZE = { crystal: 'crystal', redCrystal: 'redcrystal', pendant: 'pendant', greenPendant: 'greenpendant', unknown: 'unknown', map: 'unknown' };
  function read() {
    if (!store || !DATA) return;
    var st = store.getState();
    if (st === state) return;
    state = st;
    var S = st.settings, LC = st.checks.locationsChecks, D = st.dungeons, I = st.items;

    // squares on the map (his rule: not a second door, bonk spots only in bonk shuffle, something active inside)
    var checks = [], colors = {}, cleared = {}, dgs = {}, dcol = {}, ddone = {};
    squares = {}; sqLocs = {};
    Object.keys(DATA.entries).forEach(function (k) {
      var e = DATA.entries[k];
      if (e.secondary || (e.bonk && !S.bonkShuffle)) return;
      var names = locsFor(k, S);
      if (!names.length) return;
      if (e.isDungeon && e.dungeon) return;   // dungeons: below
      squares[k] = e; sqLocs[k] = names;
      var j = judge(names, LC);
      checks.push({ id: k, name: k, world: e.world });
      colors[k] = j.color === 'done' ? 'red' : j.color; cleared[k] = j.done;
    });

    // dungeons: their counters, as his own (dungeon items that aren't shuffled don't count)
    var it = {};
    Object.keys(DATA.dungeons).forEach(function (dk) {
      var dd = DATA.dungeons[dk], ds = D[dk]; if (!ds) return;
      var names = locsFor(dd.name, S);
      (dd.more || []).forEach(function (x) { names = names.concat(locsFor(x, S)); });
      var tot = dd.total || {};
      var max = names.length, got = names.filter(function (n) { return LC[n] && LC[n].checked; }).length;
      if (!S.includeDungeonItemsInCounter) {
        var sk = names.filter(function (n) { return n.indexOf('Key Drop') >= 0 || n.indexOf('Pot Key') >= 0; }).length + (tot.smallkeys || 0);
        var pz = names.filter(function (n) { return n.indexOf('Prize') >= 0; }).length;
        max -= (S.wildBigKeys ? 0 : tot.bigkey ? 1 : 0) + (S.wildSmallKeys === 'wild' ? 0 : sk) + (S.wildCompasses ? 0 : tot.compass ? 1 : 0) + (S.wildMaps ? 0 : tot.map ? 1 : 0) + (S.prizeShuffle === 'wild' ? 0 : pz);
        got -= ds.smallKeys && S.wildSmallKeys !== 'wild' ? ds.smallKeys : 0;
        got -= ds.bigKey && !S.wildBigKeys && (dk !== 'hc' || S.enemyDrop !== 'none') ? 1 : 0;
        got -= ds.compass && !S.wildCompasses ? 1 : 0;
        got -= ds.map && !S.wildMaps ? 1 : 0;
        got = Math.max(0, got);
      }
      var remaining = Math.max(0, max - got - (ds.collectedCount || 0));
      it[dk + 'MaxChests'] = max; it[dk + 'Chests'] = max - remaining;
      var km = (tot.smallkeys || 0) + (['keys', 'cavekeys', 'lottery', 'dungeon'].indexOf(S.pottery) >= 0 ? tot.keypots || 0 : 0) + (S.enemyDrop !== 'none' ? tot.keydrops || 0 : 0);
      km = Math.max(0, km + ((ds.manuallyChanged && ds.manuallyChanged.maxSmallKeys) || 0));
      it[dk + 'MaxSmallKeys'] = km;
      it[dk + 'SmallKeys'] = Math.max(0, Math.min(km, (ds.smallKeys || 0) + ((ds.manuallyChanged && ds.manuallyChanged.smallKeys) || 0)));
      it[dk + 'BigKey'] = !!ds.bigKey; it[dk + 'Map'] = !!ds.map; it[dk + 'Compass'] = !!ds.compass;
      it[dk + 'Prize'] = PRIZE[ds.prize] || 'unknown'; it[dk + 'PrizeObtained'] = !!ds.prizeCollected;
      var e = DATA.entries[dd.name] || {};
      var j = judge(names, LC);
      dgs[dk] = { world: e.world, name: dd.name };
      dcol[dk] = j.color === 'done' || !j.color ? 'red' : j.color;
      ddone[dk] = j.done || (names.length > 0 && remaining === 0);
      sqLocs['dg:' + dk] = names;
    });

    // items, the way Mudora's item grid counts them
    function a(n) { return (I[n] && I[n].amount) || 0; }
    var bow = [0, 1, 3, 2, 3][a('bow')] || 0;   // his: bow, silvers, bow and arrows, bow and silvers
    var single = ['hookshot', 'bomb', 'powder', 'firerod', 'icerod', 'bombos', 'ether', 'quake', 'hammer', 'shovel', 'net', 'book', 'somaria', 'byrna', 'cape', 'mirror', 'boots', 'flippers', 'moonpearl'];
    single.forEach(function (k) { it[k] = a(k) ? 1 : 0; });
    it.bow = bow; it.boomerang = a('boomerang'); it.mushroom = a('mushroom'); it.flute = a('flute'); it.lamp = a('lantern') ? 1 : 0;
    it.gloves = a('glove'); it.sword = a('sword'); it.shield = a('shield'); it.tunic = a('mail'); it.halfmagic = a('magic') ? 1 : 0;
    ['bottle1', 'bottle2', 'bottle3', 'bottle4'].forEach(function (b) { it[b] = a(b); });
    it.agahnim = D.ct && D.ct.bossDefeated ? 1 : 0;
    var E = st.entrances || {};
    it.mmMedallion = MED[E['Misery Mire'] && E['Misery Mire'].medallion] || 0;
    it.trMedallion = MED[E['Turtle Rock'] && E['Turtle Rock'].medallion] || 0;

    M.checks = checks; M.colors = colors; M.cleared = cleared;
    M.dungeons = dgs; M.dcolors = dcol; M.dcleared = ddone; M.items = it;
    M.emit('items'); M.emit('checks'); M.emit('dungeons'); M.emit('link');
  }

  // ── where things are ──────────────────────────────────────────────────────
  M.checkAt = function (c) {
    var p = AT[c.id]; if (p) return { x: p[0], y: p[1] };
    var e = DATA && DATA.entries[c.id];
    return e ? { x: e.x * 8, y: e.y * 8 } : { x: 0, y: 0 };
  };
  M.dungeonAt = function (k) {
    var d = M.dungeons[k]; if (!d) return null;
    var p = AT[d.name]; if (p) return { x: p[0], y: p[1] };
    var e = DATA && DATA.entries[d.name];
    return e ? { x: e.x * 8, y: e.y * 8 } : null;
  };
  M.locsOf = function (id) {
    var names = sqLocs[id] || [], LC = state ? state.checks.locationsChecks : {};
    return names.map(function (n) {
      var c = LC[n] || {};
      var lbl = n.indexOf(' - ') >= 0 ? n.split(' - ').slice(1).join(' - ') : n;
      return { name: n, label: lbl, done: !!c.checked, color: COLOR[c.logic] || 'red' };
    });
  };

  // ── clicks, as his own buttons send them ──────────────────────────────────
  function ready() { if (store) return true; M.toast(launched ? 'Muffins’ tracker is still starting…' : 'Pick your settings in Muffins’ tracker first.'); if (!launched) show(true); return false; }
  M.toggleCheck = function (id, on) {
    if (!ready()) return;
    var LC = state.checks.locationsChecks, up = {};
    (sqLocs[id] || []).forEach(function (n) {
      var c = LC[n] || { checked: false, logic: 'unavailable', manuallyChecked: false, scoutedItems: [] };
      up[n] = Object.assign({}, c, { checked: !!on, manuallyChecked: true });
    });
    action('checks/updateMultipleLocations', up);
  };
  M.toggleLoc = function (name, on) { if (ready()) action('checks/setLocationChecked', { location: name, checked: !!on, manual: true }); };
  var ITEM = { lamp: 'lantern', gloves: 'glove', tunic: 'mail', halfmagic: 'magic' };
  M.stepItem = function (key, dir) {
    if (!ready()) return true;
    if (key === 'agahnim') { action('dungeons/toggleDungeonBoss', { dungeon: 'ct' }); return true; }
    var name = ITEM[key] || key, sk = name;
    if (/^bottle\d$/.test(key)) name = 'bottle';
    action('items/incrementItemCount', { itemName: name, decrement: dir < 0, skipFirstImgOnCollect: false, storageKey: sk });
    return true;
  };
  // right click a medallion: which of Misery Mire / Turtle Rock it opens (neither → MM → TR → both)
  var MEDS = ['unknown', 'bombos', 'ether', 'quake'];
  function setMed(entrance, want) {
    var cur = MEDS.indexOf((state.entrances[entrance] || {}).medallion || 'unknown'), to = MEDS.indexOf(want);
    for (var i = 0; i < (to - cur + 4) % 4; i++) action('trackerEntrances/incrementMedallionCount', { entrance: entrance, decrement: false });
  }
  M.medallion = function (key) {
    if (!ready()) return;
    var E = state.entrances, mm = (E['Misery Mire'] || {}).medallion === key, tr = (E['Turtle Rock'] || {}).medallion === key;
    var s = ((mm ? 1 : 0) + (tr ? 2 : 0) + 1) % 4;
    setMed('Misery Mire', s & 1 ? key : mm ? 'unknown' : E['Misery Mire'].medallion);
    setMed('Turtle Rock', s & 2 ? key : tr ? 'unknown' : E['Turtle Rock'].medallion);
  };
  M.dungeonAct = function (k, part, dir) {
    if (!ready()) return true;
    var ds = state.dungeons[k], it = M.items || {}; if (!ds) return false;
    if (part === 'chest') {
      var max = it[k + 'MaxChests'] || 0, n = (ds.collectedCount || 0) + (dir > 0 ? 1 : -1);
      action('dungeons/setDungeonCollectedCount', { dungeon: k, count: Math.max(0, Math.min(max, n)) });
    } else if (part === 'key') action('dungeons/incrementSmallKeyCount', { dungeon: k, decrement: dir < 0 });
    else if (part === 'bigkey') action('dungeons/setBigKey', { dungeon: k, hasBigKey: dir > 0 ? !ds.bigKey : false });
    else if (part === 'map' || part === 'compass') { var ns = {}; ns[part] = dir > 0 ? !ds[part] : false; action('dungeons/updateDungeonState', { dungeon: k, newState: ns }); }
    else if (part === 'prize') {
      if (dir > 0) action('dungeons/togglePrizeCollected', { dungeon: k });
      else action('dungeons/incrementPrizeCount', { dungeon: k, decrement: false });
    }
    return true;
  };

  // ── words ─────────────────────────────────────────────────────────────────
  M.stats = function () {
    if (!state || !DATA) return [];
    var LC = state.checks.locationsChecks, seen = {}, tot = 0, got = 0;
    Object.keys(sqLocs).forEach(function (k) { sqLocs[k].forEach(function (n) { if (seen[n]) return; seen[n] = 1; tot++; if (LC[n] && LC[n].checked) got++; }); });
    var out = [['Locations', got + '/' + tot]];
    var S = state.settings;
    if (S.entranceMode && S.entranceMode !== 'none') out.push(['Entrance shuffle', 'use Muffins’ map']);
    return out;
  };
  M.linkText = function () {
    if (!launched) return 'Pick settings in Muffins’ tracker';
    if (!store) return 'Starting Muffins’ tracker…';
    var at = state && state.autotracker;
    var auto = at && at.isConnected ? ' · autotracking' : '';
    return (M.iconState === 'drawing' ? 'Drawing items from the game…' : 'Live') + auto;
  };
  M.helpText = 'Mudora 2.0 — Mudora’s look with Muffins’ logic.\n\n' +
    'Logic and settings: Muffins’ Tracker 2.0, unchanged. Pick your settings on his launch page (the Settings button brings it back); his tracker then runs out of sight and Mudora shows its answers. Pictures, maps and where each square sits come from your game itself.\n\n' +
    'Items: click to go up, right click (hold on a phone) to go back. Right click Bombos, Ether or Quake to mark which of Misery Mire / Turtle Rock it opens.\n' +
    'Map: click (tap) a square to mark everything in it done; click again to open it again. Right click (hold) a square to see what’s inside, tick off places one by one, or mark which item is there. A darker green square has some places available and some not. ⟲ on a map, or Reset maps at the top, puts the maps back as they started.\n' +
    'Dungeons: click a dungeon to open its map. Chests, small keys, big key, map and compass: click to count, right click to undo. Prize: click when you have it, right click to change which it is.\n\n' +
    'Entrance shuffle isn’t drawn here yet: open Muffins’ tracker (his button above) for that.\n\n' +
    'Problems with the logic: Muffins (his Discord). Problems with how it looks here: Rando Hub.';
})();
