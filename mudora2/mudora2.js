/*
 * mudora2.js — Mudora 2.0: Mudora's look, Muffins' logic.
 *
 * Logic and settings: Muffins' Tracker 2.0 (https://github.com/KrisDavie/alttptracker,
 * react_rewrite), unchanged, built as a library (../mfns-tracker/lib/mfns.js,
 * from tools/mfns-lib/): his logic engine, his Redux store and his sessions,
 * without his pages. This file keeps his store for the game in progress,
 * feeds his autotracker the emulator's memory, reads his state (items,
 * dungeons, every location's logic status) and sends clicks back as the same
 * actions his own buttons send.
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
  var SKEY = 'rhb-mudora2-session';
  var LIB = null;              // his tracker as a library (../mfns-tracker/lib/mfns.js)
  var libReady = import('../mfns-tracker/lib/mfns.js').then(function (m) { LIB = m; return m; })
    .catch(function (e) { M.toast('Couldn’t load Muffins’ logic: ' + (e && e.message || e)); throw e; });

  fetch('../mfns-tracker/data.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d; read(); })
    .catch(function () { M.toast('Couldn’t load Muffins’ tracker data.'); });

  // ── his tracker, as a library ─────────────────────────────────────────────
  // His store for the game in progress: his reducers, his logic (startLogic:
  // his LogicProvider), his sessions in his IndexedDB, so a game started in
  // his own tracker carries on here. No page of his runs any more.
  var curId = null, unsub = null, stopLogic = null;
  function drop() {
    if (unsub) { try { unsub(); } catch (e) {} }
    if (stopLogic) { try { stopLogic(); } catch (e) {} }
    unsub = null; stopLogic = null; store = null; state = null; launched = false; curId = null;
    M.linked = false; M.emit('link');
  }
  var opening = 0;
  function openSession(id) {
    var my = ++opening;
    drop();
    launched = true; curId = id;
    try { localStorage.setItem(SKEY, id); } catch (e) {}
    M.emit('link');
    return libReady.then(function (L) {
      var st = L.createTrackerStore(id);
      return st.ready.then(function () {
        if (my !== opening) return null;          // another game was opened meanwhile
        store = st;
        if (!store.getState().settings.autotracking) action('trackerSettings/setSettings', { autotracking: true });
        unsub = store.subscribe(soon);
        stopLogic = L.startLogic(store);
        L.sessions.touchSession(id).catch(function () {});
        M.linked = true; M.emit('link'); read();
        return store;
      });
    }).catch(function (e) { M.toast('Couldn’t open the game: ' + (e && e.message || e)); drop(); });
  }
  // a new game: his launch flow (defaults + his launcher prefs + a preset, or
  // settings given outright), then open it
  function startGame(opts) {
    return libReady.then(function (L) {
      return L.newSession(opts || {}).then(function (id) { return openSession(id); });
    });
  }
  function show() {}
  Mudora2.show = show;
  Mudora2.newGame = function () { Mudora2.settings(true); M.toast('Pick a preset to start a new game (the settings below change the game in progress).'); };
  // a new game straight from one of his presets (name or id)
  Mudora2.startPreset = function (name) {
    var all = (SET && SET.allPresets) || [], p = all.filter(function (x) { return x.id === name || x.name === name; })[0];
    if (!p) { M.toast('No preset called “' + name + '”.'); return; }
    startGame({ presetId: p.id }).then(function (st) { if (st) M.toast('New game: Muffins’ “' + p.name + '” preset.'); });
  };
  // ── a new seed rolled in Rando Hub: a new game with its settings ──────────
  // The hub writes the seed's settings to rhb-seed-tracker when it starts one
  // (index.html, playRom). Each seed is set up once: a new game with
  // everything the seed says.
  var SEED_KEY = 'rhb-seed-tracker', DONE_KEY = 'rhb-mudora2-seed';
  function norm(v) { return String(v == null ? '' : v).toLowerCase().replace(/[\s_-]+/g, ''); }
  function crystals(v, d) { v = norm(v); return /^[0-7]$/.test(v) ? v : /random/.test(v) ? 'random' : d; }
  Mudora2.fromSeed = function (t) {
    var x = t.seed || {}, more = t.more || {}, gm = norm(t.gamemode), di = t.dungeonitems || 'standard';
    var dsh = more.dungeonshuffle != null ? String(more.dungeonshuffle) : (di === 'keysanity' ? 'mcbk' : di === 'mapcompasskeys' ? 'mck' : di === 'mapcompass' ? 'mc' : '');
    var keys = more.universalkeys === 'yes' || gm === 'retro' ? 'universal' : dsh.indexOf('k') >= 0 ? 'wild' : 'inDungeon';
    var goal = norm(x.goal), ganon = crystals(x.ganon, '7');
    var G = { ganon: 'ganon', fastganon: 'fast_ganon', crystals: 'fast_ganon', pedestal: 'pedestal', triforcehunt: 'triforce_hunt',
      ganonhunt: 'ganonhunt', completionist: 'completionist', trinity: 'trinity' }[goal];
    if (goal === 'dungeons' || goal === 'alldungeons') { G = 'ganon'; ganon = 'ad'; }
    if (G === 'ganonhunt') ganon = 'triforce';
    if (G === 'completionist') ganon = 'completionist';
    var lg = norm(x.logic);
    var ENT = ['none', 'dungeonssimple', 'dungeonsfull', 'lite', 'lean', 'simple', 'restricted', 'full', 'district', 'swapped', 'crossed', 'insanity'];
    var ent = norm(x.entrances || (more.entranceshuffle === 'yes' ? 'full' : 'none'));
    ent = ent === 'decoupled' ? 'insanity' : ent === 'vanilla' || ent === 'off' || ent === 'no' ? 'none' : ENT.indexOf(ent) >= 0 ? ent : (more.entranceshuffle === 'yes' ? 'full' : 'none');
    var pot = norm(more.pottery || 'none');
    pot = pot === 'vanilla' ? 'none' : pot === 'all' ? 'lottery' : pot;
    var prz = norm(x.prizes);
    var sw = norm(x.swords);
    var out = {
      worldState: gm === 'standard' ? 'standard' : gm === 'inverted' ? (x.inverted === 2 ? 'inverted' : 'inverted_1') : 'open',
      logicMode: /overworld|owg/.test(lg) ? 'overworldglitches' : /hybrid|major|hmg/.test(lg) ? 'hybridglitches' : /nologic|none$/.test(lg) && lg ? 'nologic' : 'noglitches',
      goal: G || 'ganon',
      ganonVulnerable: ganon,
      gtOpen: crystals(x.gt != null ? x.gt : t.gtcrystals, '7'),
      swords: sw === 'swordless' || t.swordless === 'yes' ? 'swordless' : /assured/.test(sw) ? 'assured' : 'randomized',
      wildSmallKeys: keys,
      wildBigKeys: dsh.indexOf('b') >= 0,
      wildMaps: dsh.indexOf('m') >= 0,
      wildCompasses: dsh.indexOf('c') >= 0,
      entranceMode: ent,
      shuffleLinks: norm(x.links) === 'shuffled',
      bossShuffle: t.bossshuffle === 'yes' ? 'random' : 'none',
      enemyShuffle: t.enemizer === 'yes' ? 'random' : 'none',
      pottery: ['none', 'keys', 'cave', 'cavekeys', 'reduced', 'clustered', 'nonempty', 'dungeon', 'lottery'].indexOf(pot) >= 0 ? pot : 'none',
      enemyDrop: more.enemydrops === 'yes' ? 'underworld' : more.enemykeydrop === 'yes' ? 'keys' : 'none',
      prizeShuffle: prz === 'dungeon' || prz === 'indungeon' ? 'inDungeon' : prz === 'wild' || prz === 'nearby' ? 'wild' : 'vanilla',
      followerShuffle: norm(x.followers) === 'shuffled',
      activatedFlute: /preactivated|active/.test(norm(x.flute)),
      shopsanity: more.shopsanity === 'yes',
      pseudoboots: more.pseudoboots === 'yes',
      mirrorScroll: more.mirrorscroll === 'yes',
    };
    return out;
  };
  function pendingSeed() {
    var r = null, done = '';
    try { r = JSON.parse(localStorage.getItem(SEED_KEY) || 'null'); done = localStorage.getItem(DONE_KEY) || ''; } catch (e) {}
    // only a seed started in the last 10 minutes (not an old one, the first time this runs)
    if (!r || !r.at || !r.flags || String(r.at) === done || Date.now() - r.at > 600000) return null;
    return r;
  }
  var seedJob = null;
  Mudora2.matchSeed = function () {
    var r = pendingSeed();
    if (!r || seedJob === r.at) return false;
    seedJob = r.at;
    var patch = Mudora2.fromSeed(r.flags);
    try { localStorage.setItem(DONE_KEY, String(r.at)); } catch (e) {}
    startGame({ settings: patch, name: r.name ? String(r.name).replace(/\.sfc$/i, '') : undefined }).then(function (st) {
      if (st) M.toast('New seed: Muffins’ settings set to match it' + (r.name ? ' (' + String(r.name).replace(/\.sfc$/i, '') + ')' : '') + '. ⚙ Settings to check or change.');
    });
    return true;
  };
  window.addEventListener('storage', function (e) { if (e.key === SEED_KEY) Mudora2.matchSeed(); });

  var saved = null;
  try { saved = localStorage.getItem(SKEY); } catch (e) {}
  if (Mudora2.matchSeed()) {}
  else if (saved) openSession(saved);
  else startGame({ presetId: 'open' }).then(function (st) { if (st) M.toast('New game with Muffins’ Open preset. ⚙ Settings for another preset or to change settings.'); });
  var bmf = document.getElementById('b-mf'); if (bmf) bmf.remove();
  document.getElementById('b-new').addEventListener('click', function () { Mudora2.newGame(); });
  var mfEl = document.getElementById('mf'); if (mfEl) mfEl.remove();

  function action(type, payload) {
    if (!store) return;
    store.dispatch({ type: type, payload: payload });
  }

  // ── autotracking: his processing, the emulator's memory ───────────────────
  // His MEMORY_RANGES are read from the built-in emulator (../bridge/sni-bridge.js,
  // FxPak Pro addresses) twice a second and handed to his AutotrackerProvider's
  // processing step (createAutotracker in the library): nothing between the
  // game and his code but a copy of the bytes.
  var tracker = null, trackerFor = null, lastPoll = { at: 0, mode: -1, rom: '', ok: false, n: 0 };
  Mudora2.diag = [];
  function note(msg) { Mudora2.diag.push(new Date().toLocaleTimeString() + ' ' + msg); if (Mudora2.diag.length > 30) Mudora2.diag.shift(); try { console.warn('[mudora2] ' + msg); } catch (e) {} }
  setInterval(function () {
    if (!store || !LIB || !state) return;
    var b = M.bridge && M.bridge();
    if (!b) { if (lastPoll.ok) { lastPoll.ok = false; action('autotracker/setConnected', { selectedDevice: null, isConnected: false }); } return; }
    if (!state.settings.autotracking) return;
    if (trackerFor !== store) { tracker = LIB.createAutotracker(store); trackerFor = store; }
    var data = {}, R = LIB.data.MEMORY_RANGES, ok = true;
    try {
      Object.keys(R).forEach(function (k) { data[k] = b.read(R[k].start, R[k].size); });
    } catch (e) { ok = false; note('read failed: ' + (e && e.message || e)); }
    if (!ok) return;
    lastPoll.at = Date.now(); lastPoll.mode = data.gamemode ? data.gamemode[0] : -1; lastPoll.n++;
    if (!lastPoll.ok) { lastPoll.ok = true; action('autotracker/setConnected', { selectedDevice: 'Rando Hub emulator', isConnected: true }); }
    try { lastPoll.rom = tracker.process(data) || ''; } catch (e) { note('his processing failed: ' + (e && e.message || e)); }
  }, 500);
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
    // entrance shuffle: his rules for which squares give way to entrances
    var emode = S.entranceMode && S.entranceMode !== 'none' ? S.entranceMode : null;
    var EG = emode && DATA.ent ? (DATA.ent.groups[emode + (S.zelgaWoods ? '|z' : '')] || {}) : null;
    function givesWay(k, e) { return !!EG && (e.replaced || (e.entrance && EG[k] !== 'vanilla')); }
    var dhid = {};
    Object.keys(DATA.entries).forEach(function (k) {
      var e = DATA.entries[k];
      if (e.bonk && !S.bonkShuffle) return;
      if (EG ? givesWay(k, e) : e.secondary) return;
      var names = locsFor(k, S);
      if (!names.length) return;
      if (e.isDungeon && e.dungeon) return;   // dungeons: below
      squares[k] = e; sqLocs[k] = names;
      var j = judge(names, LC);
      checks.push({ id: k, name: k, world: e.world });
      colors[k] = j.color === 'done' ? 'red' : j.color; cleared[k] = j.done;
    });

    // dungeons: their counters, as his own (dungeon items that aren't shuffled don't count)
    var it = {}, remain = {};
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
      it[dk + 'Boss'] = ds.boss || 'unknown'; it[dk + 'BossDefeated'] = !!ds.bossDefeated;   // his boss (boss shuffle: picked by hand)
      var e = DATA.entries[dd.name] || {};
      var j = judge(names, LC);
      dgs[dk] = { world: e.world, name: dd.name };
      if (EG && givesWay(dd.name, e)) dhid[dk] = true;
      remain[dk] = remaining;
      dcol[dk] = j.color === 'done' || !j.color ? 'red' : j.color;
      ddone[dk] = j.done || (names.length > 0 && remaining === 0);
      sqLocs['dg:' + dk] = names;
    });

    // items, the way Mudora's item grid counts them
    function a(n) { return (I[n] && I[n].amount) || 0; }

    // ── "Visible": Rando Hub's addition, not Muffins' logic ──────────────────
    // His logic has no state for an item you can see but not reach yet, so
    // these classic ones stayed red. Hutch's rules (tracker/map.html) decide
    // when each counts as seen; only a red square ever turns orange. Off in
    // inverted and entrance shuffle, where the ways to see them change.
    var climbDM = a('flute') || a('glove');
    var VISIBLE = {
      'Lumberjack Tree': true, 'Lake Hylia Island': true, "Zora's Ledge": true, 'Desert Ledge': true,
      'Spectacle Rock': climbDM,
      'Floating Island': climbDM && (a('hookshot') || (a('mirror') && a('hammer'))),
      'Bumper Cave Ledge': !!a('moonpearl') && ((a('hammer') && a('glove')) || a('glove') >= 2 ||
        (a('agahnim') && a('hookshot') && (a('hammer') || a('glove') || a('flippers')))),
    };
    if (!EG && S.worldState !== 'inverted') Object.keys(VISIBLE).forEach(function (k) {
      if (VISIBLE[k] && colors[k] === 'red' && !cleared[k]) colors[k] = 'orange';
    });
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

    // the entrances themselves: his markers, his colours
    var ents = [];
    entInfo = {};
    if (EG) {
      var hid = DATA.ent.hidden[emode + (S.zelgaWoods ? '|z' : '')] || [], EC = st.checks.entranceChecks || {};
      var ED = M.entranceData;
      DATA.ent.names.forEach(function (n) {
        if (EG[n] === 'vanilla' || hid.indexOf(n) >= 0) return;
        if (n.indexOf('Inverted') >= 0 && S.worldState === 'open') return;
        var en = DATA.entries[n] || {}, x = E[n] || {}, to = x.to || null, ck = EC[n] || {};
        var locs = [];
        if (to) {
          locs = locsFor(to, S);
          var sd = DATA.ent.sides[to];
          if (sd) sd.forEach(function (o) { if (o !== to) locs = locs.concat(locsFor(o, S)); });
        }
        var toD = to && DATA.entries[to] ? DATA.entries[to].dungeon : null;
        var conn = !!to && (DATA.ent.connectors.indexOf(to) >= 0 || /^(Unknown|Generic) Connector/.test(to));
        var diamond = conn && !toD;
        var cls, done = false;
        if (to && locs.length) {
          var j = judge(locs, LC);
          if (j.done) { if (diamond) cls = 'conn'; else done = true; }
          else cls = j.color;
          if (toD && remain[toD] === 0 && !j.done) done = true;
        } else if (to) {
          if (ck.checked) done = true; else cls = diamond ? 'conn' : COLOR[ck.logic] || 'red';
        } else {
          if (ck.checked) done = true; else cls = COLOR[ck.logic] || 'red';
        }
        var lab = to ? (DATA.ent.labels[to] || null) : null;
        var p = ED && ED.doors[n];
        ents.push({ id: n, name: n, world: p ? p.world : en.world, at: p ? { x: p.x, y: p.y } : { x: (en.x || 0) * 8, y: (en.y || 0) * 8 },
          cls: cls || 'red', done: done, to: to, label: to ? (lab ? lab.label : to) : '', labelColor: lab ? lab.color : '',
          shape: diamond ? 'diamond' : locs.length ? 'square' : 'round' });
        entInfo[n] = { to: to, locs: locs, checked: !!ck.checked };
      });
    }

    M.checks = checks; M.colors = colors; M.cleared = cleared; M.entrances = ents; M.dhidden = dhid;
    M.dungeons = dgs; M.dcolors = dcol; M.dcleared = ddone; M.items = it;
    M.emit('items'); M.emit('checks'); M.emit('dungeons'); M.emit('link');
  }

  // ── entrances: his clicks, his entrance menu, and the emulator's finds ─────
  var entInfo = {}, told = false;
  M.entClick = function (n) {
    if (!ready()) return;
    var x = entInfo[n] || {}, LC = state.checks.locationsChecks;
    if (x.to && x.locs.length) {
      var all = x.locs.every(function (l) { return LC[l] && LC[l].checked; }), up = {};
      x.locs.forEach(function (l) { up[l] = Object.assign({ checked: false, logic: 'unavailable', manuallyChecked: false, scoutedItems: [] }, LC[l] || {}, { checked: !all, manuallyChecked: true }); });
      action('checks/updateMultipleLocations', up);
    } else action('checks/setEntranceChecked', { entrance: n, checked: !x.checked, manual: true });
  };
  // right click: where it leads, picked from his entrance menu's list (his
  // rules for which can go where); "Muffins' menu" opens his own over Mudora
  // (connectors, notes, scouting)
  function zkey() { return state.settings.zelgaWoods ? '1' : '0'; }
  function pairOf(n) { var P = (DATA.ent.pairs || {})[zkey()] || []; for (var i = 0; i < P.length; i++) if (P[i][0] === n || P[i][1] === n) return { drop: P[i][0], partner: P[i][1] }; return null; }
  function pool(n) {
    var p = pairOf(n);
    if (p && p.drop === n) return 'dropdown';
    if (p && state.settings.entranceMode !== 'insanity') return 'pairedDoor';
    return 'normal';
  }
  M.entMenu = function () { return !ready(); };
  M.entCodes = function (n) {
    if (!SET || !SET.entranceMenu || !state) return [];
    var mine = pool(n), cur = (state.entrances[n] || {}).to, L = DATA.ent.labels || {};
    var taken = {};
    Object.keys(state.entrances).forEach(function (k) { var t2 = state.entrances[k].to; if (t2 && k !== n) taken[t2] = 1; });
    return SET.entranceMenu.map(function (g) {
      return { title: g.title, codes: g.to.map(function (t) {
        var target = t, disabled = pool(t) !== mine, pr = pairOf(t);
        if (pr && (mine === 'dropdown' || mine === 'pairedDoor')) { target = mine === 'dropdown' ? pr.drop : pr.partner; disabled = false; }
        var lb = L[t] || { label: t, color: '#888888' };
        return { code: target, text: lb.label, color: lb.color + '99', disabled: disabled, on: cur === target, title: t + (taken[target] ? ' (already placed)' : '') };
      }) };
    });
  };
  M.entLabel = function (n, to) { if (ready()) action('trackerEntrances/setEntranceLink', { entrance: n, to: to, zelgaWoods: !!state.settings.zelgaWoods, entranceMode: state.settings.entranceMode }); };
  M.entClear = function (n) { M.entLabel(n, null); };
  // "pick on map": the next entrance clicked is where this one leads
  var pending = null;
  M.entConnectLabel = 'Pick on map…'; M.entConnectTitle = 'Then click the entrance whose inside this one leads to';
  M.entConnectHint = 'Now click the entrance it leads to (Esc to cancel).';
  M.entConnectStart = function (n) { pending = n; M.emit('checks'); };
  M.entPending = function () { return pending; };
  M.entCancel = function () { pending = null; M.emit('checks'); };
  M.entConnectTo = function (to) { var n = pending; pending = null; if (n) M.entLabel(n, to); M.emit('checks'); };
  // (his own entrance menu with connectors, notes and scouting needs his pages: not here)
  // the emulator saw where a door led (../mudora/entrack.js): link it, as his menu would
  M.on(function (w) {
    if (!w || !w.entrance || !store || !state) return;
    var ev = w.entrance, S = state.settings;
    if (!S.entranceMode || S.entranceMode === 'none') {
      // a door led somewhere new: this seed shuffles entrances
      if (ev.to.indexOf(ev.door) < 0 && !told) { told = true; M.toast('This seed shuffles entrances: pick its Entrance Mode in ⚙ Settings to track them.'); }
      return;
    }
    if (ev.kind === 'out' && S.entranceMode === 'insanity') return;
    var EG = DATA && DATA.ent && DATA.ent.groups[S.entranceMode + (S.zelgaWoods ? '|z' : '')];
    if (!EG || EG[ev.door] === 'vanilla' || !state.entrances[ev.door]) return;
    var inv = S.worldState !== 'open', used = {};
    Object.keys(state.entrances).forEach(function (k) { var t2 = state.entrances[k].to; if (t2 && k !== ev.door) used[t2] = 1; });
    var opts = ev.to.filter(function (t2) { return (t2.indexOf('Inverted') >= 0) === inv || ev.to.length === 1; });
    if (!opts.length) opts = ev.to;
    var cur = state.entrances[ev.door].to;
    if (cur && opts.indexOf(cur) >= 0) return;   // already known
    var pick = opts.filter(function (t2) { return !used[t2]; })[0] || opts[0];
    action('trackerEntrances/setEntranceLink', { entrance: ev.door, to: pick, zelgaWoods: !!S.zelgaWoods, entranceMode: S.entranceMode });
  });
  M.on(function (w) { if (w === 'entrancedata') { state = null; read(); } });

  // ── Crowd Control's "Reveal a go-mode item" (crowd/effects.js) ────────────
  // Marks the square that holds the revealed spot with the item. Spoiler
  // names are alttpr.com's; his are mostly the same without punctuation, and
  // these few differ.
  var REVEAL_ALIAS = { hyrulecastlezeldascell: "Hyrule Castle - Zelda's Chest", ganonstowermoldormchest: 'Ganons Tower - Validation Chest',
    bumpercave: 'Bumper Cave Ledge', pegasusrocks: 'Bonk Rock Cave', hypecavenpc: 'Hype Cave - Generous Guy',
    minimoldormcavenpc: 'Mini Moldorm Cave - Generous Guy', hammerpegs: 'Peg Cave', graveyardledge: 'Graveyard Cave' };
  function nrm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  // the square (or 'dg:<dungeon>') holding a spoiler spot, from his data
  M.revealSquare = function (m) {
    if (!state) return null;
    var want = nrm(REVEAL_ALIAS[nrm(m.loc)] || m.loc), sq = null;
    Object.keys(sqLocs).some(function (k) { if (sqLocs[k].some(function (n) { return nrm(n) === want; })) { sq = k; return true; } return false; });
    return sq;
  };

  // Go mode: his logic says Ganon can be beaten with what's in hand (the
  // "Ganon" check is available). The hub's go-mode alert (go-mode.js) asks.
  Mudora2.goMode = function () {
    var c = state && state.checks && state.checks.locationsChecks && state.checks.locationsChecks.Ganon;
    return !!(c && c.logic === 'available');
  };

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
  function ready() { if (store) return true; M.toast(launched ? 'Muffins’ logic is still starting…' : 'Start a game first (New game).'); if (!launched) Mudora2.settings(true); return false; }
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
    // which prize it is, forward or back (the map's prize marks, the dungeon card)
    else if (part === 'prizeType') action('dungeons/incrementPrizeCount', { dungeon: k, decrement: dir < 0 });
    else if (part === 'boss') action('dungeons/incrementBoss', { dungeon: k, decrement: dir < 0 });
    return true;
  };

  // set a dungeon's prize outright (the map's picker, or copied from the game's map):
  // his prize cycle forward as many times as it takes
  var MF_PRIZES = ['unknown', 'greenPendant', 'pendant', 'crystal', 'redCrystal'];
  var MF_OF = { unknown: 'unknown', greenpendant: 'greenPendant', pendant: 'pendant', crystal: 'crystal', redcrystal: 'redCrystal' };
  M.setPrize = function (k, name) {
    if (!ready()) return false;
    var ds = state.dungeons[k]; if (!ds || !MF_OF[name]) return false;
    var cur = MF_PRIZES.indexOf(!ds.prize || ds.prize === 'map' ? 'unknown' : ds.prize), to = MF_PRIZES.indexOf(MF_OF[name]);
    for (var n = (to - Math.max(0, cur) + 5) % 5; n > 0; n--) action('dungeons/incrementPrizeCount', { dungeon: k, decrement: false });
    return true;
  };

  // ── words ─────────────────────────────────────────────────────────────────
  M.stats = function () {
    // Muffins' tracker doesn't count deaths or bonks; the hub reads them from the game
    var RS0 = window.RandoKeysClient && window.RandoKeysClient.stats();
    // Checks: the game's own count of everything picked up (the same number as the run stats overlay)
    var game = RS0 ? [['Checks', RS0.checks || 0], ['Deaths', RS0.deaths || 0], ['Bonks', RS0.bonks || 0]] : [];
    if (!state || !DATA) return game;
    var LC = state.checks.locationsChecks, seen = {}, tot = 0, got = 0;
    Object.keys(sqLocs).forEach(function (k) { sqLocs[k].forEach(function (n) { if (seen[n]) return; seen[n] = 1; tot++; if (LC[n] && LC[n].checked) got++; }); });
    var out = [['Locations', got + '/' + tot]];
    out = out.concat(game);
    var S = state.settings;
    if (S.entranceMode && S.entranceMode !== 'none') {
      var ents = M.entrances || [], kn = ents.filter(function (e) { return e.to; }).length;
      out.push(['Entrances', kn + '/' + ents.length]);
    }
    return out;
  };
  // ── settings, any time (mid-game too) ─────────────────────────────────────
  // His launch page's own choices (read from his source into
  // ../mfns-tracker/settings.json by tools/mfns-settings.py), shown here for
  // the game in progress and sent with his own setSettings action: his logic
  // recomputes straight away and his tracker saves them with the game.
  var SET = null, setBox = document.getElementById('set'), setBody = document.getElementById('set-body');
  fetch('../mfns-tracker/settings.json').then(function (r) { return r.json(); }).then(function (d) { SET = d; if (setBox.classList.contains('show')) paintSettings(); }).catch(function () {});
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function changeSetting(patch) {
    if (!ready()) return;
    action('trackerSettings/setSettings', patch);
    // the ones his launcher owns (logic breaks and a few more) are kept in his
    // launcher prefs, which he puts back on every load: keep them there too
    var keep = (SET && SET.remembered) || [];
    var mine = Object.keys(patch).filter(function (k) { return keep.indexOf(k) >= 0; });
    if (mine.length) {
      try {
        var prefs = JSON.parse(localStorage.getItem('muffins_launcher_prefs') || '{}');
        mine.forEach(function (k) { prefs[k] = patch[k]; });
        localStorage.setItem('muffins_launcher_prefs', JSON.stringify(prefs));
      } catch (e) {}
    }
  }
  function paintSettings() {
    setBody.textContent = '';
    if (!SET) { setBody.appendChild(el('div', 's-note', 'Loading…')); return; }
    // a new game from one of his presets (OnlyADKD is "ADKDF")
    if (SET.presets && SET.presets.length) {
      setBody.appendChild(el('h4', null, 'New game from a preset'));
      // every preset he has (his "Browse all presets…"), his groups first, and a search (HydeOut, Oct 2026)
      var pr = el('div', 's-row'), sel = el('select'), go = el('button', null, 'Start');
      var sr = el('div', 's-row'), q = el('input'); q.type = 'search'; q.placeholder = 'Search presets (name, mode, “keys”…)';
      q.style.flex = '1'; q.style.background = '#1d2126'; q.style.border = '1px solid var(--line)'; q.style.borderRadius = '4px'; q.style.padding = '3px 6px'; q.style.color = 'inherit';
      var cnt = el('small', null, ''); cnt.style.color = 'var(--dim)';
      sr.appendChild(q); sr.appendChild(cnt);
      var grouped = {}, all = (SET.allPresets || []).filter(function (p) { return p.id !== 'mystery'; });
      SET.presets.forEach(function (g) { g.presets.forEach(function (p) { grouped[p.id] = 1; }); });
      function opt(p, parent) { var o = el('option', null, p.name + (p.desc ? ' — ' + p.desc : '')); o.value = p.id; parent.appendChild(o); }
      function fill() {
        var t = q.value.trim().toLowerCase(), was = sel.value, n = 0;
        sel.textContent = '';
        sel.appendChild(el('option', null, t ? 'Matching presets…' : 'Pick a preset…')).value = '';
        if (t) {
          all.forEach(function (p) { if ((p.name + ' ' + (p.desc || '') + ' ' + p.id).toLowerCase().indexOf(t) >= 0) { opt(p, sel); n++; } });
          cnt.textContent = n + ' of ' + all.length;
        } else {
          SET.presets.forEach(function (g) {
            var og = document.createElement('optgroup'); og.label = g.title;
            g.presets.forEach(function (p) { if (p.id === 'mystery') return; opt(p, og); n++; });
            sel.appendChild(og);
          });
          var rest = all.filter(function (p) { return !grouped[p.id]; });
          if (rest.length) { var og2 = document.createElement('optgroup'); og2.label = 'More presets'; rest.forEach(function (p) { opt(p, og2); n++; }); sel.appendChild(og2); }
          cnt.textContent = all.length + ' presets';   // a few sit in two of his groups
        }
        sel.value = was; if (sel.value !== was) sel.value = '';
        if (t && n === 1) sel.selectedIndex = 1;
      }
      q.addEventListener('input', fill);
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sel.value) go.click(); });
      fill();
      setBody.appendChild(sr);
      sel.style.maxWidth = '260px'; sel.style.flex = '1';
      go.type = 'button';
      go.addEventListener('click', function () {
        if (!sel.value) return;
        if (!confirm('Start a new game with Muffins’ “' + sel.options[sel.selectedIndex].textContent.split(' — ')[0] + '” preset? (Your current game stays in his list of sessions.)')) return;
        Mudora2.settings(false); Mudora2.startPreset(sel.value);
      });
      pr.appendChild(sel); pr.appendChild(go); setBody.appendChild(pr);
      setBody.appendChild(el('div', 's-note', 'Presets set everything for a mode at the start, including known entrances and checks it leaves out (OnlyADKD is “ADKDF”). The settings below change the game in progress.'));
      // earlier games (his sessions, shared with his own tracker)
      var ss = el('div', 's-row'), sesSel = el('select'), back = el('button', null, 'Open');
      sesSel.style.maxWidth = '260px'; sesSel.style.flex = '1'; back.type = 'button';
      sesSel.appendChild(el('option', null, 'Earlier games…')).value = '';
      if (LIB) LIB.sessions.getSessions().then(function (list) {
        list.forEach(function (x) { if (x.id === curId) return; var o = el('option', null, (x.name || x.id) + ' · ' + new Date(x.lastAccessedAt || x.createdAt).toLocaleString()); o.value = x.id; sesSel.appendChild(o); });
      }).catch(function () {});
      back.addEventListener('click', function () { if (sesSel.value) { Mudora2.settings(false); openSession(sesSel.value); } });
      ss.appendChild(sesSel); ss.appendChild(back); setBody.appendChild(ss);
    }
    // what autotracking is doing, for a screenshot when it doesn't work
    var dt = el('details'), sm = el('summary', null, 'Autotracking details'); dt.appendChild(sm);
    var pre = el('pre'); pre.style.cssText = 'white-space:pre-wrap;font-size:11px;color:var(--dim);margin:4px 0;';
    try {
      var at = state && state.autotracker || {};
      var b2 = M.bridge && M.bridge(), md = -1; try { md = b2 ? b2.read(0xF50010, 1)[0] : -1; } catch (e) {}
      pre.textContent = [
        'Autotracking: ' + (state ? (state.settings.autotracking ? 'on' : 'off') : '–') + ' · ' + (at.isConnected ? 'reading the emulator' : 'no game running') +
          (lastPoll.at ? ' · last read ' + Math.round((Date.now() - lastPoll.at) / 1000) + ' s ago (' + lastPoll.n + ' reads)' : ''),
        'Game mode now: ' + md + ' · in the last read: ' + lastPoll.mode,
        'ROM name read: ' + String(lastPoll.rom || '').replace(/[^\x20-\x7e]/g, '') + ' · stored: ' + (at.romName || '–').replace(/[^\x20-\x7e]/g, ''),
        'His logic: ' + (LIB ? 'library ' + (LIB.SOURCE_COMMIT || '') : 'loading…') + ' · game ' + (curId || '–'),
        'Log: ' + (Mudora2.diag.join(' | ') || 'none'),
      ].join('\n');
    } catch (e) { pre.textContent = 'Not available yet.'; }
    dt.appendChild(pre); setBody.appendChild(dt);
    setBody.appendChild(el('h4', null, 'This game'));
    if (!store || !state) { setBody.appendChild(el('div', 's-note', launched ? 'Muffins’ logic is still starting…' : 'Start a game first: pick a preset above.')); return; }
    var S = state.settings, n = 0;
    setBody.appendChild(el('div', 's-note', 'Muffins’ settings for this game. Changes apply right away, mid-game too, and stay with this game.'));
    function row(id, label, desc, input) {
      var r = el('div', 's-row'), l = el('label'); l.htmlFor = id; l.textContent = label;
      if (desc) { var sm = el('small', null, desc); l.appendChild(sm); }
      input.id = id; r.appendChild(l); r.appendChild(input); return r;
    }
    SET.sections.forEach(function (sec) {
      setBody.appendChild(el('h4', null, sec.title));
      var g = null;
      sec.items.forEach(function (it) {
        if (it.group && it.group !== g && it.group !== sec.title && !/Settings$/.test(it.group)) { g = it.group; setBody.appendChild(el('h5', null, g)); }
        var id = 'set-' + (n++), inp;
        if (it.type === 'select') {
          inp = el('select');
          var cur = String(S[it.key]), has = false;
          it.options.forEach(function (o) { var op = el('option', null, o.label); op.value = o.value; if (o.value === cur) has = true; inp.appendChild(op); });
          if (!has) { var op = el('option', null, cur); op.value = cur; inp.appendChild(op); }
          inp.value = cur;
          inp.addEventListener('change', function () { var p = {}; p[it.key] = inp.value; changeSetting(p); });
        } else {
          inp = el('input'); inp.type = 'checkbox'; inp.checked = !!S[it.key];
          inp.addEventListener('change', function () { var p = {}; p[it.key] = inp.checked; changeSetting(p); });
        }
        var desc = it.desc || '';
        setBody.appendChild(row(id, it.label, desc, inp));
      });
    });
    if (SET.breaks && SET.breaks.length) {
      setBody.appendChild(el('h4', null, 'Logic breaks'));
      var g2 = null, sb = S.sequenceBreaks || {};
      SET.breaks.forEach(function (b) {
        if (b.group !== g2) { g2 = b.group; setBody.appendChild(el('h5', null, g2)); }
        var inp = el('input'); inp.type = 'checkbox'; inp.checked = !!sb[b.id];
        inp.addEventListener('change', function () {
          var cur = Object.assign({}, state.settings.sequenceBreaks || {}); cur[b.id] = inp.checked;
          changeSetting({ sequenceBreaks: cur });
        });
        setBody.appendChild(row('set-' + (n++), b.label, b.desc, inp));
      });
    }
  }
  Mudora2.settings = function (on) {
    if (on === undefined) on = !setBox.classList.contains('show');
    setBox.classList.toggle('show', !!on);
    if (on) paintSettings();
  };
  document.getElementById('b-set').addEventListener('click', function () { Mudora2.settings(); });
  document.getElementById('set-close').addEventListener('click', function () { Mudora2.settings(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') Mudora2.settings(false); });

  M.linkText = function () {
    if (!launched) return 'No game: pick a preset (New game)';
    if (!store) return 'Starting Muffins’ logic…';
    var at = state && state.autotracker, on = state && state.settings.autotracking;
    var auto = !on ? ' · autotracking off (⚙ Settings)' : at && at.isConnected ? ' · autotracking' : ' · autotracking: waiting for the game…';
    return (M.iconState === 'drawing' ? 'Drawing items from the game…' : 'Live') + auto;
  };
  M.helpText = 'Mudora 2.0 — Mudora’s look with Muffins’ logic.\n\n' +
    'Logic and settings: Muffins’ Tracker 2.0, unchanged, running here as a library (no page of his). New game starts one from his presets; ⚙ Settings changes anything any time, mid-game too. Pictures, maps and where each square sits come from your game itself.\n\n' +
    'Items: click to go up, right click (hold on a phone) to go back. Right click Bombos, Ether or Quake to mark which of Misery Mire / Turtle Rock it opens.\n' +
    'Map: click (tap) a square to mark everything in it done; click again to open it again. Right click (hold) a square to see what’s inside, tick off places one by one, or mark which item is there. A darker green square has some places available and some not. ⟲ on a map, or Reset maps at the top, puts the maps back as they started.\n' +
    'Dungeons: click a dungeon to open its map. Chests, small keys, big key, map and compass: click to count, right click to undo. Prize: click when you have it, right click to change which it is.\n' +
    'This dungeon: the card under the list shows the dungeon Link is in: its boss (click / right click to pick another, for boss shuffle), its prize (click / right click: which it is), keys, and a chest for every check, open when found. It’s blank outside dungeons. List → This dungeon only shows just the card in the panel; ⧉ Dungeon card puts it in a small window of its own (for stream). Ready first puts the dungeons you can clear on top, crystals first.\n' +
    'Icons: Game pixels (the game’s own pictures), Smooth (the same pictures, enlarged smoothly), or Custom pictures: PNG files named after the item (hookshot.png, crystal_red.png…) take the place of the game’s, one by one.\n' +
    'Follow into dungeons: open a dungeon’s map when Link goes in (off: the world map stays up). The game’s own map (X): a button by each dungeon marks its prize here, click for the next, right click for the one before (⚙ Settings in Rando Hub turns it off).\n\n' +
    'Entrance shuffle: every shuffled door shows on the map. Walk through one and Rando Hub fills in where it leads, from the game itself. Click a door to mark it done; right click (hold) to set where it leads by hand.\n\n' +
    'Problems with the logic: Muffins (his Discord). Problems with how it looks here: Rando Hub.';
})();
