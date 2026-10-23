/*
 * Rando Hub — item sound packs (addon for Hutch's broadcast view).
 *
 * A sound pack is a folder with one sub-folder per item, any number of sounds
 * in each:
 *
 *     Hydro Pack/
 *       hookshot/   grab1.mp3  grab2.mp3  ...
 *       sword-2/    master.ogg            (a level-specific folder wins)
 *       sword/      any-sword.wav
 *
 * Every pickup plays ONE sound picked at random from that item's folder (never
 * the same one twice in a row when there are two or more).
 *
 * Packs come from two places:
 *   built-in   sounds/packs/<Pack>/... in this repo, listed in
 *              sounds/packs/index.json (tools/build-sound-packs.py writes it)
 *   imported   a folder picked from the computer in the Item Sounds window,
 *              kept in this browser's IndexedDB (localStorage is too small)
 *
 * Which pack is live:  localStorage 'rando-hub-sound-pack'
 *   ''           off — the Item Sounds profiles play exactly as before
 *   '<pack id>'  that pack; an item the pack has no folder for falls back to
 *                the profile sound, so a pack can cover only some items
 *   '*mix*'      every pack at once, a random sound from any of them
 *
 * Hutch's tracker/ folder is replaced from his repository on every deploy, so
 * nothing here edits his files: tools/update-hutch.py adds one <script> line
 * to broadcast.html and bcast-sounds.html, and this file wraps his
 * playItemSound / playGomodeSound. The main app loads it too, for the Crowd
 * Control effects (crowd/effects.js: sound_pack_next, sound_pack_random).
 */
(function (root) {
  'use strict';
  if (root.RandoSoundPacks) return;

  var ACTIVE_KEY = 'rando-hub-sound-pack';
  var VOL_KEY = 'rando-hub-sound-pack-vol';
  var MIX = '*mix*';
  var DB_NAME = 'rando-hub-sound-packs';
  var AUDIO_EXT = /\.(mp3|ogg|oga|wav|m4a|aac|flac|webm|opus)$/i;

  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var BUILTIN_BASE = scriptSrc ? new URL('../sounds/packs/', scriptSrc).href : 'sounds/packs/';

  // ── folder names → tracker item keys ──────────────────────────────────────
  // Folders are matched loosely ("Fire Rod", "fire_rod", "05 - Fire Rod" all
  // land on firerod), so a pack made for another tracker usually just works.
  var ALIASES = {
    gomode: ['gomode'],
    bow: ['bow', 'bows'], 'bow-1': ['bowonly'], 'bow-2': ['woodarrows', 'woodenarrows', 'arrows', 'bow2'],
    'bow-3': ['silverarrows', 'silvers', 'silverbow', 'bow3'],
    sword: ['sword', 'swords', 'progressivesword'], 'sword-1': ['fightersword', 'fighterssword', 'sword1'],
    'sword-2': ['mastersword', 'sword2'], 'sword-3': ['temperedsword', 'sword3'],
    'sword-4': ['goldensword', 'goldsword', 'butterswords', 'sword4'],
    gloves: ['gloves', 'glove', 'progressiveglove'], 'gloves-1': ['powerglove', 'gloves1'],
    'gloves-2': ['titansmitt', 'titansmitts', 'mitts', 'mitt', 'gloves2'],
    shield: ['shield', 'shields', 'progressiveshield'], 'shield-1': ['blueshield', 'fightersshield', 'shield1'],
    'shield-2': ['fireshield', 'redshield', 'shield2'], 'shield-3': ['mirrorshield', 'shield3'],
    tunic: ['tunic', 'mail', 'armor', 'armour', 'progressivemail'], 'tunic-1': ['bluemail', 'bluetunic', 'tunic1'],
    'tunic-2': ['redmail', 'redtunic', 'tunic2'],
    boomerang: ['boomerang', 'boomerangs', 'blueboomerang', 'redboomerang'],
    hookshot: ['hookshot'], mushroom: ['mushroom', 'shroom'], powder: ['powder', 'magicpowder'],
    firerod: ['firerod'], icerod: ['icerod'], moonpearl: ['moonpearl', 'pearl'],
    agahnim: ['agahnim', 'aga', 'agahnimdefeated', 'aga1'], bombos: ['bombos'], ether: ['ether'], quake: ['quake'],
    lamp: ['lamp', 'lantern'], hammer: ['hammer', 'magichammer'], shovel: ['shovel'],
    flute: ['flute', 'ocarina'], net: ['net', 'bugnet', 'bugcatchingnet'],
    book: ['book', 'bookofmudora', 'mudora'], bottle: ['bottle', 'bottles', 'bottle1'],
    somaria: ['somaria', 'caneofsomaria', 'canesomaria'], byrna: ['byrna', 'caneofbyrna', 'canebyrna'],
    cape: ['cape', 'magiccape'], mirror: ['mirror', 'magicmirror'], halfmagic: ['halfmagic'],
    boots: ['boots', 'pegasusboots'], flippers: ['flippers', 'zorasflippers', 'zoraflippers'],
    map: ['map', 'maps', 'dungeonmap'], compass: ['compass', 'compasses', 'dungeoncompass'],
    bigkey: ['bigkey', 'bigkeys'], smallkey: ['smallkey', 'smallkeys', 'key', 'keys']
  };
  var ALIAS_TO_KEY = {};
  Object.keys(ALIASES).forEach(function (k) {
    ALIAS_TO_KEY[norm(k)] = k;
    ALIASES[k].forEach(function (a) { ALIAS_TO_KEY[a] = k; });
  });
  function norm(s) {
    return String(s || '').toLowerCase().replace(/^[\s\d._-]+(?=[a-z])/, '').replace(/[^a-z0-9]/g, '');
  }
  function itemKeyForFolder(name) { return ALIAS_TO_KEY[norm(name)] || null; }

  // What the broadcast view asks for → the folders to try, best first.
  function lookupKeys(key, val) {
    var out = [];
    if (/^bottle\d$/.test(key)) key = 'bottle';
    if (val !== undefined && val !== null && val !== '') out.push(key + '-' + val);
    out.push(key);
    return out;
  }

  // ── IndexedDB (imported packs) ────────────────────────────────────────────
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!root.indexedDB) { rej(new Error('This browser has no IndexedDB')); return; }
      var r = root.indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('packs')) d.createObjectStore('packs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('sounds')) {
          var s = d.createObjectStore('sounds', { keyPath: 'id', autoIncrement: true });
          s.createIndex('pack', 'pack');
        }
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    dbP.catch(function () { dbP = null; });
    return dbP;
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function txDone(t) { return new Promise(function (res, rej) { t.oncomplete = res; t.onerror = t.onabort = function () { rej(t.error); }; }); }

  // ── loaded state ──────────────────────────────────────────────────────────
  // packs: [{ id, name, kind: 'builtin'|'local', items: { key: [{ src, name }] } }]
  var packs = [];
  var objectUrls = [];
  var lastPlayed = {};
  var listeners = [];
  var readyP = null;

  function loadBuiltin() {
    return fetch(BUILTIN_BASE + 'index.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { packs: [] }; })
      .catch(function () { return { packs: [] }; })
      .then(function (j) {
        return (j.packs || []).map(function (p) {
          var items = {};
          // index.json keeps the folder names as they are on disk; they're
          // matched to items here, the same way an imported folder is.
          Object.keys(p.items || {}).forEach(function (folder) {
            var k = itemKeyForFolder(folder);
            if (!k) return;
            items[k] = (items[k] || []).concat(p.items[folder].map(function (f) {
              return { src: BUILTIN_BASE + f.split('/').map(encodeURIComponent).join('/'), name: f.split('/').pop() };
            }));
          });
          return { id: 'builtin:' + p.id, name: p.name, kind: 'builtin', items: items };
        });
      });
  }

  function loadLocal() {
    return db().then(function (d) {
      var t = d.transaction(['packs', 'sounds'], 'readonly');
      return Promise.all([reqP(t.objectStore('packs').getAll()), reqP(t.objectStore('sounds').getAll())]);
    }).then(function (r) {
      var byId = {};
      var list = r[0].sort(function (a, b) { return (a.added || 0) - (b.added || 0); }).map(function (p) {
        return (byId[p.id] = { id: p.id, name: p.name, kind: 'local', items: {} });
      });
      r[1].forEach(function (s) {
        var p = byId[s.pack];
        if (!p || !s.blob) return;
        var url = URL.createObjectURL(s.blob);
        objectUrls.push(url);
        (p.items[s.item] = p.items[s.item] || []).push({ src: url, name: s.name });
      });
      return list;
    }).catch(function () { return []; });
  }

  function reload() {
    objectUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    objectUrls = [];
    readyP = Promise.all([loadBuiltin(), loadLocal()]).then(function (r) {
      packs = r[0].concat(r[1]);
      emit();
      return packs;
    });
    return readyP;
  }
  function ready() { return readyP || reload(); }

  // ── selection ─────────────────────────────────────────────────────────────
  function getActive() { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; } }
  function setActive(id, quiet) {
    try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    emit();
    if (!quiet) post({ type: 'active', id: id || '' });
    return id;
  }
  function packById(id) { for (var i = 0; i < packs.length; i++) if (packs[i].id === id) return packs[i]; return null; }
  function activeName(id) {
    id = id === undefined ? getActive() : id;
    if (!id) return 'Off (Item Sounds profile)';
    if (id === MIX) return 'Mix (all packs)';
    var p = packById(id);
    return p ? p.name : 'Off (Item Sounds profile)';
  }
  // The order a button or a Crowd Control gift steps through.
  function choices() {
    var c = [''].concat(packs.map(function (p) { return p.id; }));
    if (packs.length > 1) c.push(MIX);
    return c;
  }
  function next() {
    return ready().then(function () {
      var c = choices(), i = c.indexOf(getActive());
      return setActive(c[(i + 1) % c.length]);
    });
  }
  function random() {
    return ready().then(function () {
      var c = choices().filter(function (id) { return id && id !== getActive(); });
      if (!c.length) return null;
      return setActive(c[Math.floor(Math.random() * c.length)]);
    });
  }

  function volume() {
    var v = parseInt((function () { try { return localStorage.getItem(VOL_KEY); } catch (e) { return null; } })(), 10);
    return isNaN(v) ? 1 : Math.max(0, Math.min(1, v / 100));
  }
  function setVolume(pct) {
    try { localStorage.setItem(VOL_KEY, String(Math.max(0, Math.min(100, pct | 0)))); } catch (e) {}
    post({ type: 'reload' });
  }

  // A sound for this pickup from the live selection, or null (play the profile).
  function pick(key, val) {
    var id = getActive();
    if (!id) return null;
    var pool = id === MIX ? packs : [packById(id)].filter(Boolean);
    var tries = lookupKeys(key, val);
    for (var t = 0; t < tries.length; t++) {
      var opts = [];
      pool.forEach(function (p) { (p.items[tries[t]] || []).forEach(function (s) { opts.push(s); }); });
      if (!opts.length) continue;
      var last = lastPlayed[tries[t]];
      if (opts.length > 1) opts = opts.filter(function (s) { return s.src !== last; });
      var s = opts[Math.floor(Math.random() * opts.length)];
      lastPlayed[tries[t]] = s.src;
      return s;
    }
    return null;
  }
  function play(key, val) {
    var s = pick(key, val);
    if (!s) return false;
    try {
      var a = new Audio(s.src);
      a.volume = volume();
      a.play().catch(function () {});
    } catch (e) { return false; }
    return true;
  }

  // ── importing a folder ────────────────────────────────────────────────────
  // `files` is a FileList from <input webkitdirectory>. Accepts either the pack
  // folder itself (items directly inside) or a folder holding several packs.
  function importFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return AUDIO_EXT.test(f.name); });
    if (!files.length) return Promise.reject(new Error('No sound files in that folder (mp3, ogg, wav, m4a…)'));
    var groups = {}, skipped = {};
    files.forEach(function (f) {
      var parts = (f.webkitRelativePath || f.name).split('/');
      // …/<item>/<file>: the item is the file's own folder, the pack the one above it
      var item = parts.length >= 2 ? itemKeyForFolder(parts[parts.length - 2]) : null;
      if (!item) { skipped[parts.length >= 2 ? parts[parts.length - 2] : f.name] = 1; return; }
      var packName = parts.length >= 3 ? parts[parts.length - 3] : parts[0];
      (groups[packName] = groups[packName] || []).push({ item: item, file: f });
    });
    var names = Object.keys(groups);
    if (!names.length) {
      return Promise.reject(new Error('No item folders recognised. Name the folders after items, e.g. hookshot, fire rod, master sword.'));
    }
    return db().then(function (d) {
      var t = d.transaction(['packs', 'sounds'], 'readwrite');
      var ps = t.objectStore('packs'), ss = t.objectStore('sounds');
      var now = Date.now(), made = [];
      names.forEach(function (n, i) {
        var id = 'local:' + now.toString(36) + i;
        ps.put({ id: id, name: n, added: now + i });
        groups[n].forEach(function (g) { ss.put({ pack: id, item: g.item, name: g.file.name, blob: g.file }); });
        made.push({ id: id, name: n, sounds: groups[n].length });
      });
      return txDone(t).then(function () { return made; });
    }).then(function (made) {
      return reload().then(function () {
        post({ type: 'reload' });
        return { packs: made, skipped: Object.keys(skipped) };
      });
    });
  }

  function removePack(id) {
    if (String(id).indexOf('local:') !== 0) return Promise.reject(new Error('Built-in packs live in the app'));
    return db().then(function (d) {
      var t = d.transaction(['packs', 'sounds'], 'readwrite');
      t.objectStore('packs').delete(id);
      var idx = t.objectStore('sounds').index('pack');
      idx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = function (e) {
        var c = e.target.result;
        if (c) { t.objectStore('sounds').delete(c.primaryKey); c.continue(); }
      };
      return txDone(t);
    }).then(function () {
      if (getActive() === id) setActive('', true);
      return reload();
    }).then(function () { post({ type: 'reload' }); });
  }

  // ── other windows ─────────────────────────────────────────────────────────
  var bc = null;
  try { bc = new BroadcastChannel('rando-hub-sound-packs'); } catch (e) {}
  function post(m) { try { bc && bc.postMessage(m); } catch (e) {} }
  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
    if (m.type === 'reload') reload();
    else if (m.type === 'active') emit();
  };
  root.addEventListener('storage', function (e) { if (e.key === ACTIVE_KEY) emit(); });

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var api = {
    MIX: MIX,
    ready: ready, reload: reload, packs: function () { return packs.slice(); },
    getActive: getActive, setActive: setActive, activeName: activeName, choices: choices,
    next: next, random: random, volume: volume, setVolume: setVolume,
    pick: pick, play: play, importFiles: importFiles, removePack: removePack,
    onChange: onChange, itemKeyForFolder: itemKeyForFolder
  };
  root.RandoSoundPacks = api;

  // ── wrap Hutch's broadcast view ───────────────────────────────────────────
  // His functions are global declarations, so replacing the window property
  // replaces what his own code calls. His Race Mode and "No Sounds" profile
  // still mute everything: those checks run before ours.
  function raceMode() { try { return typeof RACE_MODE !== 'undefined' && !!RACE_MODE; } catch (e) { return false; } }
  function muted() { try { return parseInt(localStorage.getItem('alttp-sound-profile') || '1', 10) === 5; } catch (e) { return false; } }
  // The hub page (addons/hub-items.js) plays pack sounds for every tracker
  // while it's open and says so once a second; then this view leaves the
  // pack's item sounds to it, so nothing plays twice.
  var hubAt = 0;
  try { new BroadcastChannel('rando-hub-sound-packs-hub').onmessage = function () { hubAt = Date.now(); }; } catch (e) {}
  if (typeof root.playItemSound === 'function') {
    var origItem = root.playItemSound;
    root.playItemSound = function (key, val) {
      if (key !== 'gomode' && Date.now() - hubAt < 3000 && getActive() && pick(key, val)) return;
      if (!raceMode() && !muted() && play(key, val)) return;
      return origItem.apply(this, arguments);
    };
  }
  if (typeof root.playGomodeSound === 'function') {
    var origGo = root.playGomodeSound;
    root.playGomodeSound = function () {
      if (!raceMode() && !muted() && play('gomode')) return;
      return origGo.apply(this, arguments);
    };
  }
  ready();
})(window);
