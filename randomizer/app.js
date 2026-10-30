// Randomizer bar: settings dropdowns -> seed generation (in a worker) ->
// patch the player's own Japanese 1.0 ROM in the browser -> boot it.
import { md5 } from './md5.js';
import { parseSprite, applySprite, drawHead, drawSheet } from './sprite.js';
import { MsuPlayer, trackNumber, isRandoTitle } from './msu.js';
import { listZip, zipEntryBlob } from './zip.js';
import { buildLink, readLink, clearLink, codeForSeed, codeFromRom, codeNames, renderCode, PARAMS } from './share.js';
import { openLibrary, labelOf, isPlainLink, loadList } from './library.js';
import { createCollection, keyOf, pickFrom } from './collection.js';
import { relayUrl, ownRelay, setRelayUrl, DEFAULT_RELAY, alttprId, fetchAlttprSeed, baseFor, patchSeed } from './remote.js';
import * as Kara from './kara/index.js';
import * as Avian from './avianart.js';
import * as AvianUi from './avianart-ui.js';
import { buildUi as buildKaraUi } from './kara/ui.js';
import { initCustomizer, customizerOn, customRequest, snapshotAlttpr, applyAlttpr, fromSiteSave } from './custom-ui.js';
import * as Saved from './saved-presets.js';
import { SETTINGS as KARA_SETTINGS } from './kara/settings-data.js';
import { patchRomCredits } from './hub-credits.js';

const msu = new MsuPlayer();

const JP10_MD5 = '03a63945398191337e896e5771f77173';   // ALttP (Japan) v1.0, headerless
const BASE_MD5 = 'edc01f3db798ae4dfe21101311598d44';   // after the 2024-02-18 base patch (alttpr.com build)
const ROM_SIZE = 0x200000;
const $ = (id) => document.getElementById(id);

// ── tiny IndexedDB key/value store (ROMs never leave the device) ──────────────
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rhb-beta-s9x-kara', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function kvDel(key) {
  const db = await idb();
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
export { kvGet, kvSet, kvDel };

// ★ favourites and your own sprite files (collection.js)
const coll = createCollection({ kvGet, kvSet, kvDel });

// ── settings ─────────────────────────────────────────────────────────────────
const FIELDS = ['r-gen', 'r-mode', 'r-goal', 'r-tower', 'r-ganon', 'r-weapons', 'r-placement', 'r-dungeon', 'r-access',
  'r-pool', 'r-func', 'r-hints', 'r-heartbeep', 'r-quickswap', 'r-menuspeed'];

function readSettings() {
  return {
    mode: $('r-mode').value,
    goal: $('r-goal').value,
    crystals: { tower: $('r-tower').value, ganon: $('r-ganon').value },
    weapons: $('r-weapons').value,
    item_placement: $('r-placement').value,
    dungeon_items: $('r-dungeon').value,
    accessibility: $('r-access').value,
    item: { pool: $('r-pool').value, functionality: $('r-func').value },
    hints: $('r-hints').value,
  };
}

function saveFields() {
  const o = {};
  FIELDS.forEach((id) => { if ($(id)) o[id] = $(id).value; });
  try { localStorage.setItem('unified-kara-fields', JSON.stringify(o)); } catch (e) {}
}

function loadFields() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('unified-kara-fields') || '{}'); } catch (e) {}
  // Quickswap became On by default. Settings saved before that hold the old
  // default (Off), so drop it once; choosing Off again after this is kept.
  try {
    if (!localStorage.getItem('unified-quickswap-default-on')) {
      if ('r-quickswap' in o) {
        delete o['r-quickswap'];
        localStorage.setItem('unified-kara-fields', JSON.stringify(o));
      }
      localStorage.setItem('unified-quickswap-default-on', '1');
    }
  } catch (e) {}
  FIELDS.forEach((id) => {
    const el = $(id);
    if (el && o[id] != null && [...el.options].some((op) => op.value === o[id])) el.value = o[id];
  });
}

// ── base ROM ─────────────────────────────────────────────────────────────────
function stripHeader(bytes) {
  return bytes.length % 1024 === 512 ? bytes.subarray(512) : bytes;
}

async function setBaseRom(file) {
  let bytes = stripHeader(new Uint8Array(await file.arrayBuffer()));
  if (bytes.length > 0x100000) bytes = bytes.subarray(0, 0x100000);
  const sum = md5(bytes);
  if (sum !== JP10_MD5) {
    throw new Error('That file isn\'t a Japanese 1.0 "Zelda no Densetsu: Kamigami no Triforce" ROM '
      + '(the one alttpr.com uses). MD5 ' + sum);
  }
  await kvSet('base-jp10', bytes.slice());
  return true;
}

let basePatchCache = null;
async function loadBasePatch() {
  if (basePatchCache) return basePatchCache;
  const res = await fetch(new URL('data/base-patch.bin', import.meta.url));
  if (!res.ok) throw new Error('Could not load the base patch (' + res.status + ')');
  basePatchCache = new Uint8Array(await res.arrayBuffer());
  return basePatchCache;
}

async function buildBaseRom() {
  const jp = await kvGet('base-jp10');
  if (!jp) throw new Error('Choose your Japanese 1.0 ROM first (Base ROM button).');
  const rom = new Uint8Array(ROM_SIZE);
  rom.set(jp.subarray(0, 0x100000));
  const p = await loadBasePatch();
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  if (String.fromCharCode(p[0], p[1], p[2], p[3]) !== 'Z3BP') throw new Error('Corrupt base patch file');
  const n = dv.getUint32(4, true);
  let o = 8;
  for (let i = 0; i < n; i++) {
    const off = dv.getUint32(o, true), len = dv.getUint32(o + 4, true);
    o += 8;
    rom.set(p.subarray(o, o + len), off);
    o += len;
  }
  // Should match alttpr.com's own base ROM exactly. If it ever doesn't, still
  // play (the seed data is the same) but say so.
  const sum = md5(rom);
  if (sum !== BASE_MD5) console.warn('[randomizer] base ROM MD5 ' + sum + ' differs from alttpr.com build ' + BASE_MD5);
  return { rom, baseOk: sum === BASE_MD5 };
}

// menuSpeed: false for Kara's branch, whose site doesn't offer it (she asked
// that nothing beyond her own site's options be written to her seeds)
function applyCosmetics(rom, { quickswap = true, menuSpeed = true } = {}) {
  const w = (off, ...b) => b.forEach((v, i) => { rom[off + i] = v; });
  const beep = { off: 0x00, half: 0x40, quarter: 0x80, double: 0x10, normal: 0x20 }[$('r-heartbeep').value] ?? 0x40;
  w(0x180033, beep);
  w(0x18004B, quickswap && $('r-quickswap').value === 'on' ? 0x01 : 0x00);
  if (menuSpeed) {
    const ms = $('r-menuspeed').value;
    w(0x180048, { instant: 0xE8, fast: 0x10, normal: 0x08, slow: 0x04 }[ms] ?? 0x08);
    const fast = ms === 'instant';
    w(0x6DD9A, fast ? 0x20 : 0x11);
    w(0x6DF2A, fast ? 0x20 : 0x12);
    w(0x6E0E9, fast ? 0x20 : 0x12);
  }
  w(0x18021A, 0x00);   // music on
  w(0x18017F, 0x00);   // reduce flashing off
}

// The playtesters and shout-outs in the game's ending (hub-credits.js), for
// seeds from any generator; then the header checksum again.
function addHubCredits(rom) {
  try { if (rom && patchRomCredits(rom) && rom.length % 1024 === 0) updateChecksum(rom); } catch (e) { console.warn('[randomizer] credits', e); }
}

function updateChecksum(rom) {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) if (i < 0x7FDC || i >= 0x7FE0) sum += rom[i];
  const checksum = (sum + 0x1FE) & 0xFFFF;
  const inverse = checksum ^ 0xFFFF;
  rom[0x7FDC] = inverse & 0xFF; rom[0x7FDD] = inverse >> 8;
  rom[0x7FDE] = checksum & 0xFF; rom[0x7FDF] = checksum >> 8;
}

// ── generation in a worker ────────────────────────────────────────────────────
let worker = null, reqId = 0;
const pending = new Map();
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'Generator failed to load'));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}
function runGenerator(settings, seed, custom = false) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, settings, seed, stamp: true, custom });
  });
}

function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] >>> 0;
}

function parseSeed(text) {
  text = String(text || '').trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(BigInt(text) % 4294967296n);
  // any other text: hash it into a seed so "words" work too
  let h = 2166136261;
  for (const c of new TextEncoder().encode(text)) { h ^= c; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// ── UI ───────────────────────────────────────────────────────────────────────
let last = null;   // { rom, name, spoiler }

function status(msg, kind = '') {
  const el = $('r-status');
  el.textContent = msg;
  el.className = kind;
}

async function refreshBaseStatus() {
  const has = !!(await kvGet('base-jp10').catch(() => null));
  $('r-base-text').textContent = has ? 'Base ROM ✓' : 'Base ROM…';
  $('r-base-label').classList.toggle('ok', has);
  $('r-base-label').title = has
    ? 'Your Japanese 1.0 ROM is saved in this browser: every generator makes its seeds from it. Click to replace it.'
    : 'Choose your Japanese 1.0 ALttP ROM: every generator makes its seeds from it (it stays on this device)';
  return has;
}

function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Which ROM is in the emulator; the share buttons are for a generated seed
// only, and only while it's the one being played.
let playing = null;   // { name, code }

function showLast() {
  const live = !!last && (!playing || playing.name === last.name);
  $('r-download').hidden = !last;
  // a race seed keeps its spoiler hidden
  $('r-spoiler').hidden = !last || !!last.race;
  if (last && last.alttpr) {
    $('r-seed-out').textContent = `alttpr.com seed ${last.alttpr}`;
    $('r-seed-out').title = 'Paste this id, or its alttpr.com link, to load the same seed again';
  } else if (last && last.avian) {
    $('r-seed-out').textContent = `AVIANART ${last.race ? 'race seed' : 'seed'} ${last.avian}`;
    $('r-seed-out').title = 'A seed from AVIANART: its permalink opens on avianart.games, and pasting it here loads it again';
  } else if (last && last.gwaa) {
    $('r-seed-out').textContent = `Kara ${last.race ? 'race seed' : 'seed'} ${last.gwaa}`;
    $('r-seed-out').title = 'A seed from Kara\'s server: its link opens on her site, and pasting it here loads it again';
  } else if (last && last.kara) {
    $('r-seed-out').textContent = `Kara ${last.race ? 'race seed' : 'seed'} ${last.spoiler.seed}`;
    $('r-seed-out').title = last.race ? 'A race seed: its spoiler stays hidden'
      : 'Kara\'s branch: this number with the same settings gives the same game again';
  } else if (last && last.custom) {
    $('r-seed-out').textContent = `Customized seed ${last.spoiler.seed}`;
    $('r-seed-out').title = 'This number with the same customizer settings (save them as a preset) gives the same game again';
  } else {
    $('r-seed-out').textContent = last ? (last.race ? `Race seed ${last.spoiler.seed}` : `Seed ${last.spoiler.seed}`) : '';
    $('r-seed-out').title = last && last.race ? 'A race seed: its spoiler stays hidden'
      : 'Type this number in the seed box to get the same game again';
  }
  const canShare = live && (!!last.fields || !!last.alttpr || !!last.kara || !!last.gwaa || !!last.avian);
  $('r-share').hidden = !canShare;
  $('r-share-race').hidden = !canShare || !!last.alttpr || !!last.gwaa || !!last.avian;   // their link is the link   // an alttpr.com seed's link is the link
  const code = playing ? playing.code : (last ? (last.code || (last.alttpr || last.avian ? null : codeForSeed(last.spoiler.seed))) : null);
  renderCode($('r-code'), code);
  try { showSeedInfo(last, live); } catch (e) { console.warn('[randomizer] seed info', e); }
}

// Called by the main page whenever a ROM starts, generated or loaded.
function noteRom(bytes, name) {
  const off = bytes.length % 1024 === 512 ? 512 : 0;
  playing = { name, code: codeFromRom(bytes.subarray(off)) };
  showLast();
}

// ── seed type and settings (under the code), to check the tracker's logic ──
// What kind of seed it was (seed-log.js: who rolled it and how), every
// setting the generator used, and what the tracker was set to for it.
const META_LABELS = {
  mode: 'World state', goal: 'Goal', logic: 'Logic', weapons: 'Swords', dungeon_items: 'Dungeon items',
  item_placement: 'Item placement', accessibility: 'Accessibility', item_pool: 'Item pool', item_functionality: 'Item functionality',
  entry_crystals_tower: 'GT crystals (asked)', crystals_tower: 'GT crystals', entry_crystals_ganon: 'Ganon crystals (asked)', crystals_ganon: 'Ganon crystals',
  hints: 'Hints', pseudoboots: 'Pseudoboots', allow_quickswap: 'Quickswap', shuffle: 'Entrance shuffle', entrances: 'Entrance shuffle',
  'enemizer.boss_shuffle': 'Boss shuffle', 'enemizer.enemy_shuffle': 'Enemy shuffle', 'enemizer.enemy_damage': 'Enemy damage',
  'enemizer.enemy_health': 'Enemy health', 'enemizer.pot_shuffle': 'Pot shuffle', spoilers: 'Spoiler', tournament: 'Race',
};
const META_SKIP = new Set(['build', 'worlds', 'world_id', 'size', 'rom_mode', 'name', 'notes', 'version', 'hash', 'seed', 'permalink', 'user_id', 'created_at']);
const MF_LABELS = {
  worldState: 'World state', logicMode: 'Logic', goal: 'Goal', ganonVulnerable: 'Ganon vulnerable', gtOpen: 'GT open', swords: 'Swords',
  wildSmallKeys: 'Small keys', wildBigKeys: 'Big keys outside dungeons', wildMaps: 'Maps outside', wildCompasses: 'Compasses outside',
  entranceMode: 'Entrance mode', shuffleLinks: "Link's house shuffled", bossShuffle: 'Boss shuffle', enemyShuffle: 'Enemy shuffle',
  pottery: 'Pottery', enemyDrop: 'Enemy drops', prizeShuffle: 'Prizes', followerShuffle: 'Followers', activatedFlute: 'Flute activated',
  shopsanity: 'Shopsanity', pseudoboots: 'Pseudoboots', mirrorScroll: 'Mirror scroll',
};
const HUTCH_LABELS = { gamemode: 'World state', dungeonitems: 'Dungeon items', swordless: 'Swordless', gtcrystals: 'GT crystals',
  bossshuffle: 'Boss shuffle', enemizer: 'Enemizer' };
const showVal = (v) => v === true ? 'yes' : v === false ? 'no' : v == null || v === '' ? '—' : String(v);
function seedSettings(l) {
  const rows = [];   // [label, value, isDefault]
  if (l.kara) {
    for (const st of KARA_SETTINGS) {
      const v = l.kara[st.key] ?? st.def, opt = (st.values || []).find((x) => x[0] === v);
      rows.push([st.label || st.key, opt ? opt[1] : v, v === st.def]);
    }
    return rows;
  }
  const meta = (l.spoiler && l.spoiler.meta) || {};
  for (const [k, v] of Object.entries(meta)) {
    if (META_SKIP.has(k) || (v && typeof v === 'object')) continue;
    rows.push([META_LABELS[k] || k.replace(/[._]/g, ' '), showVal(v), false]);
  }
  return rows;
}
function trackerSettings(l) {
  let t = null;
  try { const r = JSON.parse(localStorage.getItem('rhb-seed-tracker') || 'null'); if (r && r.name === l.name) t = r.flags; } catch (e) {}
  if (!t) return null;
  // Mudora 2.0 (Muffins' logic): what it was told, by its own mapping
  const T = window.UnifiedTracker, f = document.getElementById('emo-frame');
  let M2 = null;
  try { M2 = f && f.contentWindow && f.contentWindow.Mudora2; } catch (e) {}
  if (T && T.mudora2 && T.mudora2() && M2 && M2.fromSeed) {
    const m = M2.fromSeed(t);
    return { title: 'Mudora 2.0 (Muffins\' logic) was set to', rows: Object.keys(m).map((k) => [MF_LABELS[k] || k, showVal(m[k])]) };
  }
  const rows = Object.keys(HUTCH_LABELS).filter((k) => k in t).map((k) => [HUTCH_LABELS[k], showVal(t[k])]);
  Object.entries(t.more || {}).forEach(([k, v]) => rows.push([k, showVal(v)]));
  return { title: 'The tracker was given', rows };
}
function showSeedInfo(l, live) {
  const box = $('r-seed-info');
  if (!box) return;
  if (!l || !live) { box.hidden = true; return; }
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const gen = l.alttpr ? 'alttpr.com' : l.avian ? 'AVIANART' + (l.avianPreset ? ': ' + l.avianPreset : '') : l.gwaa ? 'Kara (her server)' : l.kara ? 'Kara' : l.custom ? 'Customizer' : 'Rando Hub';
  let how = '', pick = '', by = '';
  const L = window.RandoSeedLog;
  if (L) { const e = L.list().slice().reverse().find((x) => x.name === l.name); if (e) { how = L.kindText(e); pick = e.pick || e.preset || ''; by = e.by || ''; } }
  const type = [how || 'Generate & Play', gen, pick].filter(Boolean).join(' · ') + (by ? ' (by ' + by + ')' : '') + (l.race ? ' · race' : '');
  box.querySelector('summary').innerHTML = '<b>Seed type:</b> ' + esc(type);
  const rows = seedSettings(l), tr = trackerSettings(l);
  const table = (rs) => '<table>' + rs.map((r) => '<tr' + (r[2] ? ' class="def"' : '') + '><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>';
  box.querySelector('.si-body').innerHTML =
    '<div><h5>Seed settings' + (l.kara ? ' <small>(dim: left at default)</small>' : '') + '</h5>' + (rows.length ? table(rows) : '<p>This generator didn\'t say.</p>') + '</div>' +
    (tr ? '<div><h5>' + esc(tr.title) + '</h5>' + table(tr.rows) + '</div>' : '');
  box.hidden = false;
}

function linkFor(l, race) {
  if (!l || (!l.fields && !l.alttpr && !l.kara && !l.gwaa && !l.avian)) return '';
  return l.alttpr ? `https://alttpr.com/h/${l.alttpr}`
    : l.avian ? Avian.permLink(l.avian)
    : l.gwaa ? Kara.siteLink(l.gwaa)
    : l.kara ? Kara.buildLink(l.spoiler.seed, l.kara, race)
      : buildLink(l.spoiler.seed, l.fields, race);
}

// The seed history (seed-log.js): one entry each time a seed is started here.
// Who asked for it and how (Crowd Control, 🎲 Reroll…) is added by seed-log.js.
function logSeed({ fromLink = false } = {}) {
  const L = window.RandoSeedLog;
  if (!L || !last) return;
  try {
    const code = last.code || (last.alttpr || last.avian ? null : codeForSeed(last.spoiler.seed));
    const sel = $('r-saved'), opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;
    L.add({
      name: last.name, game: 'Zelda 3', what: $('r-seed-out').textContent || last.name,
      generator: last.alttpr ? 'alttpr.com' : last.avian ? 'AVIANART' + (last.avianPreset ? ': ' + last.avianPreset : '') : last.gwaa ? 'Kara (her server)' : last.kara ? 'Kara' : last.custom ? 'Customizer' : 'Rando Hub',
      preset: opt ? opt.textContent.replace(/^★\s*/, '').trim() : '',
      code: code ? codeNames(code).join(' / ') : '', race: !!last.race, link: linkFor(last, !!last.race),
      ...(fromLink ? { kind: 'link' } : {}),
    });
  } catch (e) { console.warn('[randomizer] seed log', e); }
}

async function copyLink(race) {
  if (!last || (!last.fields && !last.alttpr && !last.kara && !last.gwaa && !last.avian)) return;
  const url = linkFor(last, race);
  const what = last.alttpr ? 'alttpr.com link' : last.avian ? 'AVIANART permalink' : last.gwaa ? 'Kara seed link' : race ? 'Race link' : 'Seed link';
  try {
    await navigator.clipboard.writeText(url);
    status(`${what} copied. Anyone who opens it gets the same game (they need their own base ROM).` +
      (race ? ' The spoiler is hidden for them.' : ''), 'ok');
  } catch (e) {
    window.prompt(`${what}: copy it from here`, url);
  }
}

// ── a seed link someone shared ────────────────────────────────────────────────
let shared = null;   // { seed, fields, race } while the link's seed is waiting to be played

function settingsMatch(fields) {
  return Object.keys(PARAMS).every((k) => { const id = PARAMS[k]; return !(id in fields) || $(id).value === fields[id]; });
}
function currentFields() {
  const o = {};
  Object.values(PARAMS).forEach((id) => { o[id] = $(id).value; });
  return o;
}

function showShared() {
  const box = $('r-shared');
  if (!shared) { box.hidden = true; return; }
  const parts = shared.kara ? ['Kara\'s branch', ...Kara.describe(shared.kara)] : Object.values(PARAMS).map((id) => {
    const el = $(id); return el && el.selectedOptions[0] ? el.selectedOptions[0].textContent : '';
  }).filter(Boolean);
  box.hidden = false;
  box.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = shared.race ? `Race seed ${shared.seed}` : `Shared seed ${shared.seed}`;
  const p = document.createElement('span');
  p.textContent = ' · ' + parts.join(' · ');
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'primary'; go.textContent = 'Play this seed';
  go.addEventListener('click', generateAndPlay);
  const x = document.createElement('button');
  x.type = 'button'; x.textContent = 'Dismiss';
  x.addEventListener('click', () => {
    if (shared && shared.kara && karaUi) { karaUi.hold(false); karaUi.set(karaSaved || Kara.presetSettings('default'), { persist: false }); }
    shared = null; clearLink(); showShared(); $('r-seed').value = '';
  });
  box.append(b, p, go, x);
  const notes = [];
  if (shared.race) notes.push('Race: the spoiler stays hidden. Check that everyone sees the same five-item code on the file select screen.');
  if (shared.otherBuild) notes.push('This link was made with a different version of the generator, so the game may not match the other players\' — compare the five-item code.');
  if (shared.problems.length) notes.push(`Some settings in the link weren't recognised (${shared.problems.join(', ')}).`);
  if (notes.length) {
    const n = document.createElement('div');
    n.className = 'note'; n.textContent = notes.join(' ');
    box.appendChild(n);
  }
}

// a Kara-branch link: switch to her generator with the link's settings
let karaSaved = null;   // the player's own Kara settings while a link's are showing
function takeKaraLink(l) {
  setGen('kara');
  if (!(shared && shared.kara)) karaSaved = karaUi.get();
  karaUi.hold(true);
  karaUi.set(l.settings, { persist: false });
  $('r-seed').value = String(l.seed);
  shared = { kara: karaUi.get(), seed: l.seed, race: l.race, otherBuild: l.otherBuild, problems: l.problems };
  document.body.classList.add('rando-open');
  $('r-toggle').setAttribute('aria-expanded', 'true');
  showShared();
}

function takeSharedLink() {
  const k = Kara.readLink(location.search);
  if (k) { takeKaraLink(k); return; }
  const l = readLink(location.search, $);
  if (!l) return;
  setGen('alttpr');
  Object.entries(l.fields).forEach(([id, v]) => { $(id).value = v; });
  $('r-seed').value = String(l.seed);
  shared = { seed: l.seed, fields: currentFields(), race: l.race, otherBuild: l.otherBuild, problems: l.problems };
  document.body.classList.add('rando-open');
  $('r-toggle').setAttribute('aria-expanded', 'true');
  showShared();
}

const TRACKER_DI = { standard: 'standard', mc: 'mapcompass', mcs: 'mapcompasskeys', full: 'keysanity' };

async function generateAndPlay() {
  if (isKara()) return generateKara();
  if (isAvian()) return rollAvian();
  if (msu.count) msu.unlock();
  const btn = $('r-generate');
  if (btn.disabled) return;
  if (!(await refreshBaseStatus())) {
    status('First choose your Japanese 1.0 ROM with the Base ROM button.', 'bad');
    $('r-base-input').click();
    return;
  }
  // playing a shared seed exactly as linked? then don't overwrite this
  // player's own saved choices with the link's
  // a shared link is a normal seed, so it's played without the customizer
  const fromLink = !!shared && !shared.kara && parseSeed($('r-seed').value) === shared.seed && settingsMatch(shared.fields);
  if (!fromLink) saveFields();
  const settings = readSettings();
  const fields = currentFields();
  const typed = parseSeed($('r-seed').value);
  const custom = !fromLink && customizerOn() ? await customRequest(settings) : null;
  btn.disabled = true;
  try {
    status('Patching base ROM…');
    const { rom: base, baseOk } = await buildBaseRom();
    let res = null, tries = 0, seed = typed ?? randomSeed();
    for (;;) {
      tries++;
      const what = custom ? 'customized seed' : 'seed';
      status(tries === 1 ? `Generating ${what}…` : `Generating ${what} (attempt ${tries})…`);
      try {
        res = await runGenerator(custom ? custom.req : settings, seed, !!custom);
        if (res.winnable) break;
        throw new Error('the finished game wasn\'t beatable');
      } catch (e) {
        // the official generator also gives up on some seeds (alttpr.com just
        // asks you to try again); for random seeds we quietly roll a new one
        if (typed !== null) throw new Error(`Seed ${seed} doesn't work with these settings (${e.message}). Try another number, or clear the seed box for a random one.`);
        if (tries >= 8) {
          if (custom) throw new Error(`Couldn't make a game from the customizer settings in ${tries} tries (${e.message}). `
            + 'Check the placed items and the Item Pool count' + (custom.poolOff ? ' (it doesn\'t match the number of locations)' : '') + ', then try again.');
          throw e;
        }
      }
      seed = randomSeed();
    }
    const rom = base;
    for (const w of res.patch) for (const [off, bytes] of Object.entries(w)) rom.set(bytes, Number(off));
    applyCosmetics(rom);
    if (msu.count) rom[0x18021A] = 0x01;   // game music off; the MSU pack plays instead
    const sprite = await kvGet('sprite').catch(() => null);
    if (sprite && sprite.bytes) {
      try { applySprite(rom, parseSprite(sprite.bytes)); } catch (e) { console.warn('[randomizer] sprite skipped:', e); }
    }
    updateChecksum(rom);

    const m = res.spoiler.meta || {};
    const name = `alttpr - ${custom ? 'custom-' : ''}${m.logic}-${m.mode}-${m.goal}_${res.hash}.sfc`;
    // a customized seed can't be shared as a link (the link holds only the bar's settings)
    last = { rom, name, fields: custom ? null : fields, custom: !!custom, race: fromLink && shared.race,
      spoiler: { seed: res.seed, hash: res.hash, ...res.spoiler } };
    if (fromLink) { shared = null; clearLink(); showShared(); $('r-seed').value = ''; }
    playing = null;
    showLast();
    status(baseOk ? `Ready: ${res.hash}, code ${codeNames(codeForSeed(res.seed)).join(' / ')} (${(res.ms / 1000).toFixed(1)}s)`
      : `Ready: ${res.hash}. Note: the base ROM check didn't match alttpr.com's build; report it if anything looks off.`, baseOk ? 'ok' : 'bad');
    // fold the settings away so the game is on screen (any layout), and
    // remember it across the reload EmulatorJS needs to switch games
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    // keep it across the page reload EmulatorJS needs when switching games
    addHubCredits(last.rom);
    try { await kvSet('last-seed', last); } catch (e) {}
    logSeed({ fromLink });

    window.UnifiedApp.playRom(rom, name, {
      gamemode: settings.mode,
      dungeonitems: custom ? custom.trackerDungeonItems(TRACKER_DI[settings.dungeon_items] || 'standard')
        : TRACKER_DI[settings.dungeon_items] || 'standard',
      swordless: settings.weapons === 'swordless' ? 'yes' : 'no',
      gtcrystals: String(m.crystals_tower ?? 7),
      // the rest of the seed, for trackers with more settings (Mudora 2.0)
      seed: { goal: settings.goal, ganon: String(m.entry_crystals_ganon ?? m.crystals_ganon ?? settings.crystals.ganon),
        gt: String(m.crystals_tower ?? settings.crystals.tower), logic: m.logic || 'noglitches', swords: settings.weapons, inverted: 1 },
    });
  } catch (e) {
    console.error(e);
    status(String(e.message || e), 'bad');
  } finally {
    btn.disabled = false;
  }
}

// ── Kara's branch, generated here ────────────────────────────────────────────
let karaUi = null;
const isKara = () => $('r-gen').value === 'kara';
const isAvian = () => $('r-gen').value === 'avianart';
const GEN_NAME = { alttpr: 'alttpr.com', kara: 'Kara\'s branch', avianart: 'AVIANART' };

function setGen(g) {
  $('r-gen').value = g;
  applyGen();
}
function applyGen() {
  const kara = isKara();
  document.body.classList.toggle('gen-kara', kara);
  document.body.classList.toggle('gen-avian', isAvian());
  $('r-gen-name').textContent = ' · ' + (GEN_NAME[$('r-gen').value] || 'alttpr.com');
  if (isAvian()) refreshAvianList();
  document.querySelectorAll('#r-gen-menu [data-gen]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.gen === $('r-gen').value)));
  // start Python in the background, so the first Kara seed is quicker
  clearTimeout(applyGen.t);
  if (kara && karaUi && karaUi.where() === 'browser') applyGen.t = setTimeout(Kara.prewarm, 800);
  else Kara.discardWarm();
}

function karaSeed() {
  // her generator's own range for random seeds
  return Math.floor(randomSeed() / 4294967296 * 1000000000);
}

async function generateKara({ local = false, note = '' } = {}) {
  if (!local && karaUi.where() === 'server' && parseSeed($('r-seed').value) === null && !(shared && shared.kara)) {
    const settings = karaUi.get(), race = karaUi.race();
    saveFields(); karaUi.hold(false); karaUi.save();
    return playGwaa(null, {
      settings, race,
      // her server out of reach: make a normal seed here instead (never a race one)
      fallback: race ? null : () => generateKara({ local: true, note: 'Kara\'s server couldn\'t be reached, so this seed was made in your browser. ' }),
    });
  }
  if (msu.count) msu.unlock();
  const btn = $('r-generate');
  if (btn.disabled) return;
  if (!(await refreshBaseStatus())) {
    status('First choose your Japanese 1.0 ROM with the Base ROM button.', 'bad');
    $('r-base-input').click();
    return;
  }
  const settings = karaUi.get();
  const typed = parseSeed($('r-seed').value);
  const fromLink = !!shared && !!shared.kara && typed === shared.seed && JSON.stringify(settings) === JSON.stringify(shared.kara);
  if (!fromLink) { saveFields(); karaUi.hold(false); karaUi.save(); }
  btn.disabled = true;
  $('r-stop').hidden = false;
  const started = Date.now();
  let stage = 'Starting…';
  const show = () => status(`${stage} ${Math.round((Date.now() - started) / 1000)}s`);
  const tick = setInterval(show, 1000);
  try {
    const jp = await kvGet('base-jp10');
    const { rom: base, ok } = await Kara.baseRom(jp);
    if (!ok) console.warn('[kara] base ROM MD5 differs from Kara\'s build');
    let seed = typed ?? karaSeed(), res = null;
    for (let tries = 1; ; tries++) {
      try {
        res = await Kara.generate(seed, settings, (t) => {
          stage = tries > 1 && /^Generating/.test(t) ? `Generating seed (attempt ${tries} of ${Kara.KARA_TRIES})…` : t;
          show();
        });
        break;
      } catch (e) {
        if (e.cancelled) throw e;
        // her server also tries a few seeds before giving up
        if (typed !== null) throw new Error(`Seed ${seed} doesn't work with these settings (${e.message}). Try another number, or clear the seed box for a random one.`);
        if (tries >= Kara.KARA_TRIES) throw new Error(`Couldn't make a seed with these settings in ${tries} tries (${e.message}).`);
        seed = karaSeed();
      }
    }
    const rom = Kara.patchRom(base, res.patch);
    applyCosmetics(rom, { menuSpeed: false });
    if (msu.count) rom[0x18021A] = 0x01;
    const sprite = await kvGet('sprite').catch(() => null);
    if (sprite && sprite.bytes) {
      try { applySprite(rom, parseSprite(sprite.bytes)); } catch (e) { console.warn('[randomizer] sprite skipped:', e); }
    }
    updateChecksum(rom);
    const code = codeFromRom(rom);
    const name = `alttpr-kara - ${seed}.sfc`;
    last = { rom, name, kara: settings, code, race: fromLink && shared.race, spoiler: { ...(res.spoiler || {}), seed } };
    if (fromLink) { shared = null; clearLink(); showShared(); $('r-seed').value = ''; karaUi.hold(false); karaSaved = null; }
    playing = null;
    showLast();
    const gaps = Kara.trackerGaps(settings);
    status(note + `Ready: Kara seed ${seed}` + (code ? `, code ${codeNames(code).join(' / ')}` : '') + ` (${(res.ms / 1000).toFixed(1)}s)` +
      (gaps.length ? `. The tracker doesn't follow ${gaps.join(', ')}.` : '') +
      (ok ? '' : ' Note: the base ROM check didn\'t match Kara\'s build; report it if anything looks off.'), ok ? 'ok' : 'bad');
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    addHubCredits(last.rom);
    try { await kvSet('last-seed', last); } catch (e) {}
    logSeed({ fromLink });
    window.UnifiedApp.playRom(rom, name, Kara.trackerFor(settings));
  } catch (e) {
    if (e.cancelled) status('Stopped.', '');
    else { console.error(e); status(String(e.message || e), 'bad'); }
  } finally {
    clearInterval(tick);
    btn.disabled = false;
    $('r-stop').hidden = true;
    // a fresh Python for the next seed
    setTimeout(() => { if (isKara() && karaUi.where() === 'browser') Kara.prewarm(); }, 1500);
  }
}

// A seed from Kara's server: a new one from these settings (id null), or one
// by its id (a link from her site).
let karaAbort = null;
async function playGwaa(id, { settings = null, race = false, fallback = null } = {}) {
  if (msu.count) msu.unlock();
  const btn = $('r-generate');
  if (btn.disabled) return;
  if (!(await refreshBaseStatus())) {
    status('First choose your Japanese 1.0 ROM with the Base ROM button.', 'bad');
    $('r-base-input').click();
    return;
  }
  btn.disabled = true;
  $('r-stop').hidden = false;
  karaAbort = new AbortController();
  const signal = karaAbort.signal;
  const started = Date.now();
  let stage = id ? `Getting Kara seed ${id}…` : `Asking Kara's server for a ${race ? 'race ' : ''}seed…`;
  const show = () => status(`${stage} ${Math.round((Date.now() - started) / 1000)}s`);
  const tick = setInterval(show, 1000);
  show();
  let fellBack = false;
  try {
    if (!id) id = await Kara.serverGenerate(settings, race, signal);
    const data = await Kara.serverSeed(id, { signal, onWait: () => { stage = `Kara's server is making seed ${id}…`; } });
    stage = 'Building the ROM…';
    const jp = await kvGet('base-jp10');
    const rom = Kara.serverRom(jp, data);
    const s = Kara.normalize(data.settings || {});
    const isRace = !!data.settings && data.settings.race === 'race';
    applyCosmetics(rom, { menuSpeed: false });
    if (msu.count) rom[0x18021A] = 0x01;
    const sprite = await kvGet('sprite').catch(() => null);
    if (sprite && sprite.bytes) {
      try { applySprite(rom, parseSprite(sprite.bytes)); } catch (e) { console.warn('[randomizer] sprite skipped:', e); }
    }
    updateChecksum(rom);
    const code = codeFromRom(rom);
    const name = `GK_${id}.sfc`;
    last = { rom, name, gwaa: id, kara: s, code, race: isRace, spoiler: { ...(data.spoiler || {}), seed: id } };
    playing = null;
    showLast();
    const gaps = Kara.trackerGaps(s);
    status(`Ready: Kara ${isRace ? 'race seed' : 'seed'} ${id}` + (code ? `, code ${codeNames(code).join(' / ')}` : '') +
      (gaps.length ? `. The tracker doesn't follow ${gaps.join(', ')}.` : ''), 'ok');
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    addHubCredits(last.rom);
    try { await kvSet('last-seed', last); } catch (e) {}
    logSeed();
    window.UnifiedApp.playRom(rom, name, Kara.trackerFor(s));
  } catch (e) {
    if (e.cancelled) status('Stopped.', '');
    else if (e.unreachable && fallback) fellBack = true;
    else { console.error(e); status(String(e.message || e), 'bad'); }
  } finally {
    clearInterval(tick);
    karaAbort = null;
    btn.disabled = false;
    $('r-stop').hidden = true;
  }
  if (fellBack) fallback();
}

// ── an alttpr.com seed, played here ──────────────────────────────────────────
const kv = { get: kvGet, set: kvSet };
async function ownBase() {
  const { rom, baseOk } = await buildBaseRom();
  return { rom, md5: baseOk ? BASE_MD5 : md5(rom) };
}
const ALTTPR_MODES = ['open', 'standard', 'inverted', 'retro'];

async function playAlttprSeed(id) {
  if (msu.count) msu.unlock();
  const btn = $('r-generate');
  if (btn.disabled) return;
  if (!(await refreshBaseStatus())) {
    status('First choose your Japanese 1.0 ROM with the Base ROM button.', 'bad');
    $('r-base-input').click();
    return;
  }
  btn.disabled = true;
  try {
    status(`Getting seed ${id} from alttpr.com…`);
    const seed = await fetchAlttprSeed(id);
    status('Building the ROM…');
    const jp = await kvGet('base-jp10');
    const base = await baseFor(seed, jp, ownBase, kv);
    const rom = patchSeed(base, seed.data);
    const m = (seed.data.spoiler && seed.data.spoiler.meta) || {};
    // a race seed may lock quickswap off
    applyCosmetics(rom, { quickswap: !m.tournament || !!m.allow_quickswap });
    if (msu.count) rom[0x18021A] = 0x01;
    const sprite = await kvGet('sprite').catch(() => null);
    if (sprite && sprite.bytes) {
      try { applySprite(rom, parseSprite(sprite.bytes)); } catch (e) { console.warn('[randomizer] sprite skipped:', e); }
    }
    updateChecksum(rom);
    const code = codeFromRom(rom);
    const name = `alttpr - ${id}.sfc`;
    const spoilerOn = m.spoilers === 'on' && seed.data.spoiler && Object.keys(seed.data.spoiler).length > 1;
    last = { rom, name, alttpr: id, code, race: !spoilerOn, spoiler: { seed: id, hash: id, ...(seed.data.spoiler || {}) } };
    playing = null;
    showLast();
    status(`Ready: alttpr.com seed ${id}${m.notes ? ' (' + String(m.notes).replace(/<[^>]*>/g, '').trim() + ')' : ''}` +
      (code ? `, code ${codeNames(code).join(' / ')}` : ''), 'ok');
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    addHubCredits(last.rom);
    try { await kvSet('last-seed', last); } catch (e) {}
    logSeed();
    window.UnifiedApp.playRom(rom, name, {
      gamemode: ALTTPR_MODES.includes(m.mode) ? m.mode : 'open',
      dungeonitems: TRACKER_DI[m.dungeon_items] || 'standard',
      swordless: m.weapons === 'swordless' ? 'yes' : 'no',
      gtcrystals: String(m.entry_crystals_tower ?? 7),
      bossshuffle: m['enemizer.boss_shuffle'] && m['enemizer.boss_shuffle'] !== 'none' ? 'yes' : 'no',
      enemizer: m['enemizer.enemy_shuffle'] && m['enemizer.enemy_shuffle'] !== 'none' ? 'yes' : 'no',
      seed: { goal: m.goal, ganon: String(m.entry_crystals_ganon ?? m.crystals_ganon ?? 7), gt: String(m.entry_crystals_tower ?? 7),
        logic: m.logic, swords: m.weapons, entrances: m.shuffle || m.entrances, inverted: 1 },
    });
  } catch (e) {
    console.error(e);
    status(String(e.message || e), 'bad');
    if (e.needsRelay) { ['r-rom-more', 'r-rom-adv'].forEach((id) => { const d = $(id); if (d) d.open = true; }); $('r-relay').focus(); }
  } finally {
    btn.disabled = false;
  }
}

// ── an AVIANART seed, played here ────────────────────────────────────────────
// A new seed from one of its presets (hash null), or one by its permalink.
// Uses the Stop button and its controller, like Kara's server seeds.
async function playAvian(hash, { preset = null, custom = null, race = false } = {}) {
  if (msu.count) msu.unlock();
  const btn = $('r-generate');
  if (btn.disabled) return;
  if (!(await refreshBaseStatus())) {
    status('First choose your Japanese 1.0 ROM with the Base ROM button.', 'bad');
    $('r-base-input').click();
    return;
  }
  btn.disabled = true;
  $('r-stop').hidden = false;
  karaAbort = new AbortController();
  const signal = karaAbort.signal;
  const started = Date.now();
  let stage = hash ? `Getting AVIANART seed ${hash}…` : custom ? 'Asking AVIANART to roll your settings…' : `Asking AVIANART to roll ${preset}…`;
  const show = () => status(`${stage} ${Math.round((Date.now() - started) / 1000)}s`);
  const tick = setInterval(show, 1000);
  show();
  try {
    if (!hash) hash = custom ? await Avian.generateCustom(custom, { signal }) : await Avian.generate(preset, { race, signal });
    const r = await Avian.seed(hash, {
      signal,
      onWait: (st, tries) => { stage = `AVIANART is making seed ${hash}${tries > 1 ? ` (try ${tries})` : ''}…`; },
    });
    stage = 'Building the ROM…';
    const jp = await kvGet('base-jp10');
    const rom = await Avian.buildRom(jp, r, { get: kvGet, set: kvSet });
    const m = Avian.meta(r);
    const raceSeed = Avian.isRace(m);
    applyCosmetics(rom, { menuSpeed: false });
    if (msu.count) rom[0x18021A] = 0x01;
    const sprite = await kvGet('sprite').catch(() => null);
    if (sprite && sprite.bytes) {
      try { applySprite(rom, parseSprite(sprite.bytes)); } catch (e) { console.warn('[randomizer] sprite skipped:', e); }
    }
    updateChecksum(rom);
    const code = codeFromRom(rom);
    const name = `AVIANART - ${hash}.sfc`;
    const presetName = preset || '';   // a loaded permalink rerolls with the AVIANART row's preset
    last = { rom, name, avian: hash, avianPreset: presetName, code, race: raceSeed, spoiler: { ...(r.spoiler || {}), seed: hash } };
    playing = null;
    showLast();
    // its OnlyADKD-style presets get the tracker's OnlyADKD mode
    const info = Avian.presetInfo(preset);
    if (info && info.onlyadkd && window.UnifiedOnlyAdkd && !window.UnifiedOnlyAdkd.on()) window.UnifiedOnlyAdkd.set(true);
    const gaps = Avian.trackerGaps(m);
    status(`Ready: AVIANART ${raceSeed ? 'race seed' : 'seed'} ${hash}` + (code ? `, code ${codeNames(code).join(' / ')}` : '') +
      (gaps.length ? `. The tracker doesn't follow ${gaps.join(', ')}.` : ''), 'ok');
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    addHubCredits(last.rom);
    try { await kvSet('last-seed', last); } catch (e) {}
    logSeed();
    window.UnifiedApp.playRom(rom, name, Avian.trackerFor(m));
  } catch (e) {
    if (e.cancelled) status('Stopped.', '');
    else {
      console.error(e);
      status(String(e.message || e), 'bad');
      if (e.needsRelay) { ['r-rom-more', 'r-rom-adv'].forEach((id) => { const d = $(id); if (d) d.open = true; }); $('r-avian-relay').focus(); }
      if (!hash && /didn't roll/.test(String(e.message))) status(String(e.message) + ' Check the preset name.', 'bad');
    }
  } finally {
    clearInterval(tick);
    karaAbort = null;
    btn.disabled = false;
    $('r-stop').hidden = true;
  }
}

// ── AVIANART's settings in the bar ───────────────────────────────────────────
// Its presets are in Saved presets (value "av:<preset>"); its four customizer
// tabs are avianart-ui.js. What Generate & Play rolls is AvianUi.getSource().
const AV_PREFIX = 'av:';
const AV_ASK = 'av:?';
let avianModes = Avian.cachedModes();
function avianName(id) {
  const m = avianModes.find((x) => x.prefix === id);
  const own = Avian.PRESETS.find((p) => p.id === id);
  return m ? m.name : own ? own.label : id;
}
function avianGroups() {
  const groups = Avian.groupModes(avianModes).map((g) => ({
    label: `AVIANART · ${g.label}`,
    options: g.modes.map((m) => ({
      value: AV_PREFIX + m.prefix, label: m.name,
      title: [m.description && m.description !== m.name ? m.description : '', Avian.TYPE_LABEL[m.type] || ''].filter(Boolean).join(' · '),
    })),
  }));
  groups.push({
    label: 'AVIANART · Players\' presets',
    options: [
      // (OnlyADKDF is in Built-in, so it isn't listed here a second time)
      ...Avian.PRESETS.filter((p) => !Saved.BUILTIN.some((b) => b.avian && b.avian.preset === p.id))
        .map((p) => ({ value: AV_PREFIX + p.id, label: p.label, title: p.note || '' })),
      { value: AV_ASK, label: 'Type a player\'s preset (namespace/preset)…', title: 'Any AVIANART preset by its name, as PedChicken shows it, like jem041/onlyadkdf' },
    ],
  });
  return groups;
}
let avianFetched = false;
function refreshAvianList() {
  if (avianFetched) return;
  avianFetched = true;
  Avian.fetchModes().then((m) => { avianModes = m; Saved.paint(); AvianUi.repaint(); })
    .catch((e) => { avianFetched = false; console.warn('[avianart] preset list:', e); });
}
// Saved presets picked one of AVIANART's own: switch over and roll that preset
async function applyAvianPick(value) {
  if (!value.startsWith(AV_PREFIX)) return null;
  let id = value.slice(AV_PREFIX.length);
  if (value === AV_ASK) {
    const cur = AvianUi.getSource();
    id = (window.prompt('AVIANART preset name (namespace/preset, as PedChicken shows it):', cur.kind === 'preset' && cur.id.includes('/') ? cur.id : '') || '').trim().toLowerCase();
    if (!id) return { cancelled: true };
    if (!/^[a-z0-9_.-]+(\/[a-z0-9_.-]+)?$/.test(id)) { status('That isn\'t an AVIANART preset name (like jem041/onlyadkdf).', 'bad'); return { cancelled: true }; }
  }
  if ($('r-gen').value !== 'avianart') { $('r-gen').value = 'avianart'; $('r-gen').dispatchEvent(new Event('change')); }
  AvianUi.setSource({ kind: 'preset', id }, { quiet: true });
  const own = Avian.PRESETS.find((p) => p.id === id);
  if (own && own.onlyadkd && window.UnifiedOnlyAdkd && !window.UnifiedOnlyAdkd.on()) window.UnifiedOnlyAdkd.set(true);
  return { name: `AVIANART preset ${avianName(id)}`, keep: value !== AV_ASK };
}

function rollAvian() {
  const src = AvianUi.getSource();
  const race = $('r-avian-race').value === 'yes';
  saveFields();
  if (src.kind === 'custom') playAvian(null, { custom: AvianUi.customSettings({ race }), race });
  else playAvian(null, { preset: src.id, race });
}

// ── crowd control: viewer-paid seed rolls (crowd/effects.js) ─────────────────
// presets(): every preset in the Saved presets menu. usePreset(value): set one
// up. chaos(): pick a generator at random and randomize its menus. Each
// returns a short text for the stream; Generate & Play then rolls it.
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
// Settings chaos leaves alone: glitched logic (seeds that need glitches),
// AVIANART's timer modes, race seeds, and Kara's permanent OHKO / gloom.
const CHAOS_KEEP = { kara: { damage_challenge: 'normal' }, avianart: { logiclevel: 'noglitches', timer: 'none' } };
const VT_CHAOS = ['r-mode', 'r-goal', 'r-tower', 'r-ganon', 'r-weapons', 'r-dungeon', 'r-placement', 'r-access', 'r-pool', 'r-func', 'r-hints'];
function crowdApi() {
  const optLabel = (sel) => { const o = sel && sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ''; };
  function presets() {
    const sel = $('r-saved');
    if (!sel) return [];
    const seen = new Set();
    return [...sel.querySelectorAll('option')].filter((o) => o.value && !o.disabled && o.value !== AV_ASK && !seen.has(o.value) && seen.add(o.value))
      .map((o) => ({ value: o.value, label: o.textContent.replace(/^★\s*/, '').trim() }));
  }
  // What a viewer's random preset picks from: your ★ favourite presets if you
  // have any, otherwise every preset except glitched-logic ones (HMG, OWG,
  // No Logic...), which can need glitches to finish.
  function pool() {
    const all = presets();
    const starred = new Set(Saved.favs());
    const fav = all.filter((p) => starred.has(p.value));
    if (fav.length) return fav;
    return all.filter((p) => !/glitch|no ?logic|anti-?logic|\b(hmg|owg|mg)\b/i.test(p.label));
  }
  async function usePreset(value) {
    const hit = presets().find((p) => p.value === value);
    if (!hit) return null;
    const ok = await Saved.apply(value, { quiet: true });
    if (!ok) return null;
    $('r-seed').value = '';
    return hit.label;
  }
  async function chaos() {
    const gen = pickOne(['alttpr', 'kara', 'avianart']);
    if ($('r-gen').value !== gen) { $('r-gen').value = gen; $('r-gen').dispatchEvent(new Event('change')); }
    $('r-seed').value = '';
    let parts = [];
    if (gen === 'alttpr') {
      if (customizerOn()) { $('r-custom-on').checked = false; $('r-custom-on').dispatchEvent(new Event('change', { bubbles: true })); }
      VT_CHAOS.forEach((id) => { const el = $(id); el.value = pickOne([...el.options]).value; el.dispatchEvent(new Event('change', { bubbles: true })); });
      parts = ['r-mode', 'r-goal', 'r-weapons', 'r-dungeon', 'r-pool'].map((id) => optLabel($(id)));
    } else if (gen === 'kara') {
      const o = {};
      Kara.SETTINGS.forEach((d) => { o[d.key] = pickOne(d.values)[0]; });
      Object.assign(o, CHAOS_KEEP.kara);
      karaUi.set(o);
      const now = karaUi.get();
      const lab = (k) => { const d = Kara.SETTINGS.find((x) => x.key === k); const v = d && d.values.find((x) => x[0] === now[k]); return v ? v[1] : now[k]; };
      parts = [lab('mode'), lab('goal'), lab('weapons'), 'entrances ' + lab('entrance_shuffle'), 'doors ' + lab('door_shuffle'), 'overworld ' + lab('overworld_layout')];
    } else {
      const items = [];
      AvianUi.ITEMS.forEach((it) => items.push(it));
      const v = {};
      items.forEach((it) => {
        if (it.type === 'checkbox') v[it.id] = Math.random() < 0.5;
        else if (it.options && it.options.length) v[it.id] = String(pickOne(it.options)[0]);
      });
      Object.assign(v, CHAOS_KEEP.avianart);
      AvianUi.setValues(v);
      AvianUi.setSource({ kind: 'custom' }, { quiet: true });
      $('r-avian-race').value = 'no';
      const lab = (id) => { const it = items.find((x) => x.id === id); const o = it && (it.options || []).find((x) => String(x[0]) === String(v[id])); return o ? String(o[1]).trim() : String(v[id]); };
      parts = [lab('worldstate'), lab('goal'), lab('weapons'), 'entrances ' + lab('entranceshuffle'), 'doors ' + lab('dungeondoorshuffle'), 'keys ' + lab('smallkeyshuffle')];
    }
    Saved.edited();
    return `${GEN_NAME[gen]}: ${parts.filter(Boolean).join(' · ')}`;
  }
  // Crowd Control's "Reveal a go-mode item": the spoiler of the seed being
  // played (only if the game running is that seed). race: its spoiler stays hidden.
  function spoiler() {
    if (!last || !last.spoiler) return null;
    if (playing && playing.name !== last.name) return null;
    return { spoiler: last.spoiler, race: !!last.race, name: last.name };
  }
  return { presets, pool, usePreset, chaos, spookySprite: () => randomSprite('spooky'), spoiler };
}

// ── "Load a seed": paste a link or a number ──────────────────────────────────
// This app's seed link -> its settings and seed number; an alttpr.com link or
// seed id -> that seed; a plain number -> that seed number with the current
// settings. Then it plays.
function loadPasted(text) {
  text = String(text || '').trim();
  if (!text) { status('Paste a seed link: alttpr.com, alttpr.gwaa.kiwi or avianart.games.', 'bad'); return false; }
  let url = null;
  try { url = new URL(text); } catch (e) {}
  const gk = Kara.gwaaId(text);
  if (gk) { setGen('kara'); playGwaa(gk); return true; }
  const av = Avian.avianId(text) || (isAvian() && /^[A-Za-z0-9]{4,32}$/.test(text) ? text : null);
  if (av) { setGen('avianart'); playAvian(av); return true; }
  if (url && url.searchParams.get('gen') === 'kara') {
    const k = Kara.readLink(url.search);
    if (!k) { status('That link doesn\'t have a seed in it.', 'bad'); return false; }
    takeKaraLink(k);
    generateAndPlay();
    return true;
  }
  if (url && url.searchParams.has('seed')) {
    const l = readLink(url.search, $);
    if (!l) { status('That link doesn\'t have a seed in it.', 'bad'); return false; }
    setGen('alttpr');
    Object.entries(l.fields).forEach(([id, v]) => { $(id).value = v; });
    $('r-seed').value = String(l.seed);
    shared = { seed: l.seed, fields: currentFields(), race: l.race, otherBuild: l.otherBuild, problems: l.problems };
    showShared();
    generateAndPlay();
    return true;
  }
  const id = alttprId(text);
  if (id) { playAlttprSeed(id); return true; }
  if (/^\d{1,10}$/.test(text)) {
    $('r-seed').value = text;
    generateAndPlay();
    return true;
  }
  status('That isn\'t a seed link from alttpr.com, alttpr.gwaa.kiwi or avianart.games (or a seed number).', 'bad');
  return false;
}

// Called by "Load ROM…": if the file is the plain Japanese 1.0 ROM, save it
// as the base ROM and generate a seed with the current settings.
async function useIfBaseRom(bytes) {
  let b = stripHeader(bytes);
  if (b.length !== 0x100000 || md5(b) !== JP10_MD5) return false;
  await kvSet('base-jp10', b.slice());
  await refreshBaseStatus();
  document.body.classList.add('rando-open');
  $('r-toggle').setAttribute('aria-expanded', 'true');
  status('That\'s the original game, so it\'s now your base ROM. Generating a seed…', 'ok');
  generateAndPlay();
  return true;
}

const LINK_PREVIEW = 'https://alttpr-assets.s3.us-east-2.amazonaws.com/001.link.1.zspr.png';

async function refreshSprite() {
  const sp = await kvGet('sprite').catch(() => null);
  $('r-sprite-name').textContent = sp ? sp.label : 'Default Link';
  try { localStorage.setItem('rhb-sprite-label', sp && sp.label ? sp.label : ''); } catch (e) {}   // alerts say who's playing (crowd/effects.js hero)
  $('r-sprite-name').title = sp ? sp.label : '';
  $('r-sprite-clear').hidden = !sp;
  // the preview: alttpr.com's own picture for library sprites, otherwise the
  // head drawn from the file (and its whole sheet on click)
  const img = $('r-sprite-prev').querySelector('img'), cv = $('r-sprite-prev').querySelector('canvas');
  let parsed = null;
  try { parsed = sp && sp.bytes ? parseSprite(sp.bytes) : null; } catch (e) {}
  const own = !!parsed && !sp.preview && drawHead(parsed, cv);
  cv.hidden = !own;
  img.hidden = own;
  // a library sprite whose picture is missing on alttpr's host: draw it
  img.onerror = () => {
    if (parsed && drawHead(parsed, cv)) { img.hidden = true; cv.hidden = false; }
  };
  if (!own) img.src = (sp && sp.preview) || LINK_PREVIEW;
  $('r-sprite-prev').title = own ? 'Show the whole sprite sheet' : 'Browse the sprite library';
  $('r-sprite-prev').dataset.sheet = own ? '1' : '';
  $('r-sprite-sheet').hidden = true;
  if (own) drawSheet(parsed, $('r-sprite-sheet').querySelector('canvas'));
  updateSpriteButton(sp, parsed);
  paintStar(sp);
}

// ☆/★ beside the sprite's name: star whatever Link is wearing now
async function paintStar(sp) {
  const st = $('r-sprite-star');
  await coll.load().catch(() => {});
  if (st) {
    st.hidden = !(sp && sp.key);
    const on = !!(sp && sp.key && coll.isFav(sp.key));
    st.textContent = on ? '\u2605' : '\u2606';
    st.classList.toggle('on', on);
    st.setAttribute('aria-pressed', on ? 'true' : 'false');
    st.title = on ? 'Remove from favourites' : 'Star this sprite';
  }
}

// ── changing the sprite during a game ────────────────────────────────────────
// Link's graphics are read from the ROM every frame, so writing the new sprite
// into the running ROM changes him at once; his colours live in the palette
// buffer in work RAM, which gets the new ones too. Also kept with the game
// (Resume and switching games carry the new ROM).
const WRAM = 0xF50000;   // usb2snes address of $7E0000
function rd(addr) { try { return window.AlttpBridge.read(WRAM + addr, 1)[0]; } catch (e) { return 0; } }

async function liveSprite(sp) {
  const app = window.UnifiedApp, br = window.AlttpBridge;
  const run = app && app.runningRom && app.runningRom();
  if (!run || !br || !br.patchRom) return null;          // no game running
  let rom = run.bytes;
  const hdr = rom.length % 1024 === 512 ? 512 : 0;
  rom = rom.slice(hdr);
  if (rom.length < 0xE0000) return false;
  if (sp && sp.bytes) {
    applySprite(rom, parseSprite(sp.bytes));
  } else {
    // the game's own Link, from your base ROM
    const jp = await kvGet('base-jp10').catch(() => null);
    const b = jp && (jp.bytes || jp);
    if (!b || !b.length) return false;
    const base = new Uint8Array(b).subarray(b.length % 1024 === 512 ? 512 : 0);
    rom.set(base.subarray(0x80000, 0x87000), 0x80000);
    rom.set(base.subarray(0xDD308, 0xDD308 + 120), 0xDD308);
    rom.set(base.subarray(0xDEDF5, 0xDEDF9), 0xDEDF5);
  }
  const n = br.patchRom(rom);
  if (!n) return false;
  // keep the changed ROM with the game
  const full = new Uint8Array(hdr + rom.length);
  full.set(run.bytes.subarray(0, hdr)); full.set(rom, hdr);
  app.setRunningRom(full);
  // Link's colours now: mail 0-2 (bunny uses the 4th set), gloves in colour 13
  const set = rd(0x02E0) ? 3 : Math.min(rd(0xF35B), 2);
  const pal = rom.slice(0xDD308 + set * 30, 0xDD308 + set * 30 + 30);
  const gl = rd(0xF354);
  if (gl === 1 || gl === 2) { const g = 0xDEDF5 + (gl - 1) * 2; pal[24] = rom[g]; pal[25] = rom[g + 1]; }
  const ok = br.writeWram(WRAM + 0xC6E2, pal) && br.writeWram(WRAM + 0xC4E2, pal) &&
    br.writeWram(WRAM + 0x0015, new Uint8Array([1]));   // upload the palette next frame
  return ok ? 'now' : 'colours-later';
}

function spriteStatus(label, live) {
  if (live === 'now') return `Sprite set: ${label}. Changed in this game, and used for the next seed.`;
  if (live === 'colours-later') return `Sprite set: ${label}. Changed in this game (its colours after the next door or screen), and used for the next seed.`;
  if (live === false) return `Sprite set: ${label}. It applies to the next seed you generate (couldn't change this game).`;
  return `Sprite set: ${label}. It applies to the next seed you generate.`;
}

// 🎲 rolls the whole library plus your own sprites; 🎲★ only your favourites.
// Neither gives you the sprite you already have when there's another.
const SPOOKY_RE = /skele|skull|ghost|ghoul|zombie|pumpkin|jack.?o|witch|vampire|dracula|frankenstein|mummy|reaper|spook|halloween|haunt|boo\b|poe\b|stalfos|gibdo|redead|undead|phantom|shade|specter|spectre|wraith|demon|devil|bat\b|werewolf|monster|creep|horror|corpse|dead/i;
async function randomSprite(mode) {
  const favs = mode === 'fav';
  const btns = [$('r-sprite-random'), $('r-sprite-fav-roll'), $('sprite-btn'), $('sprite-fav-btn')].filter(Boolean);
  if (btns.some((b) => b.disabled)) return;   // one is being fetched already
  btns.forEach((b) => { b.disabled = true; });
  const hb = $(favs ? 'sprite-fav-btn' : 'sprite-btn');
  if (hb) hb.classList.add('busy');
  try {
    status(favs ? 'Picking one of your favourites…' : 'Picking a random sprite…');
    await coll.load();
    const cur = await kvGet('sprite').catch(() => null);
    let pool;
    if (favs) {
      // works offline too: starred sprites keep a saved copy
      const list = await loadList().catch(() => []);
      pool = await coll.favEntries(list);
      if (!pool.length) throw new Error('No favourites yet. Open the Library and tap \u2606 on the sprites you like.');
    } else {
      const list = (await loadList().catch((e) => {
        if (coll.ownEntries().length) return [];
        throw e;
      })).filter((e) => !isPlainLink(e));
      pool = coll.ownEntries().concat(list);
      // Crowd Control's "Spooky sprite": only the Halloween-ish ones (by name or tag)
      if (mode === 'spooky') {
        const spooky = pool.filter((e) => SPOOKY_RE.test(e.name + ' ' + (e.tags || []).join(' ')));
        if (spooky.length) pool = spooky;
      }
    }
    const entry = pickFrom(pool, cur && cur.key);
    await useLibrarySprite(entry);
  } catch (e) {
    const msg = String(e.message || e);
    status(msg, 'bad');
    // the Randomizer bar is usually folded away during a game: say it here too
    if (hb && !document.body.classList.contains('rando-open')) alert(msg);
  } finally {
    btns.forEach((b) => { b.disabled = false; });
    if (hb) hb.classList.remove('busy');
  }
}

// ── header button: Link's current sprite; tap for a random one ──────────────
function buildSpriteButton() {
  const split = $('rando-split');
  if (!split || $('sprite-btn')) return;
  const b = document.createElement('button');
  b.id = 'sprite-btn';
  b.type = 'button';
  b.setAttribute('aria-label', 'Random sprite');
  // the head preview, with a small die in its corner
  b.innerHTML = '<span class="sb-head"><img alt=""><canvas hidden></canvas>' +
    '<svg class="sb-die" viewBox="0 0 12 12" aria-hidden="true"><rect x=".75" y=".75" width="10.5" height="10.5" rx="2.5"/>' +
    '<circle cx="4" cy="4" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="8" cy="4" r="1.1"/><circle cx="4" cy="8" r="1.1"/></svg></span>' +
    '<span class="sb-lbl">Sprite</span>';
  b.addEventListener('click', () => randomSprite('all'));
  split.parentNode.insertBefore(b, split.nextSibling);
  // 🎲★ beside it: a random favourite (always shown; with none starred it says how)
  const f = document.createElement('button');
  f.id = 'sprite-fav-btn';
  f.type = 'button';
  f.setAttribute('aria-label', 'Random favourite sprite');
  f.title = 'A random sprite from your favourites';
  f.innerHTML = '<span class="sfb-star" aria-hidden="true">\u2605</span>' +
    '<svg class="sb-die" viewBox="0 0 12 12" aria-hidden="true"><rect x=".75" y=".75" width="10.5" height="10.5" rx="2.5"/>' +
    '<circle cx="4" cy="4" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="8" cy="4" r="1.1"/><circle cx="4" cy="8" r="1.1"/></svg>';
  f.addEventListener('click', () => randomSprite('fav'));
  b.parentNode.insertBefore(f, b.nextSibling);
  const st = document.createElement('style');
  st.textContent = [
    '#sprite-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; white-space: nowrap; }',
    '#sprite-btn .sb-head { position: relative; display: block; width: 22px; height: 22px; flex: none; }',
    '#sprite-btn .sb-head img, #sprite-btn .sb-head canvas { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }',
    '#sprite-btn .sb-head [hidden] { display: none; }',
    '#sprite-btn .sb-die { position: absolute; right: -5px; bottom: -4px; width: 11px; height: 11px; }',
    '#sprite-btn .sb-die rect { fill: var(--bg, #111); stroke: currentColor; stroke-width: 1.3; }',
    '#sprite-btn .sb-die circle { fill: currentColor; }',
    '#sprite-btn:disabled .sb-head { opacity: .5; }',
    // phones: stays in the header beside Reroll, icon only
    'body.phone #sprite-btn { min-width: 44px; min-height: 34px; padding: 0 8px; }',
    'body.phone #sprite-btn .sb-lbl { display: none; }',
    // with the Sprite button too, Reroll and Map go icon-only on phones so the
    // header stays one line (⚙ included)
    'body.phone #reroll-btn .reroll-lbl, body.phone #phone-map-btn .map-lbl { display: none; }',
    'body.phone #reroll-btn { min-width: 44px; }',
    '#sprite-btn.busy .sb-head { animation: sb-spin .6s linear infinite; }',
    '#sprite-fav-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 38px; }',
    '#sprite-fav-btn[hidden] { display: none; }',
    '#sprite-fav-btn .sfb-star { color: #f5c542; font-size: 17px; line-height: 1; }',
    '#sprite-fav-btn .sb-die { position: absolute; right: 4px; bottom: 3px; width: 10px; height: 10px; }',
    '#sprite-fav-btn .sb-die rect { fill: var(--bg, #111); stroke: currentColor; stroke-width: 1.3; }',
    '#sprite-fav-btn .sb-die circle { fill: currentColor; }',
    '#sprite-fav-btn.busy .sfb-star { display: inline-block; animation: sb-spin .6s linear infinite; }',
    'body.phone #sprite-fav-btn { min-width: 34px; min-height: 34px; padding: 0 5px; }',
    // with the ★ button showing, tighten the header's spacing so ⚙ stays on its line
    'body.phone header:has(#sprite-fav-btn:not([hidden])) { column-gap: 6px; }',
    '@keyframes sb-spin { to { transform: rotate(360deg); } }',
  ].join('\n');
  document.head.appendChild(st);
}

function updateSpriteButton(sp, parsed) {
  const b = $('sprite-btn');
  if (!b) return;
  const img = b.querySelector('img'), cv = b.querySelector('canvas');
  const own = !!parsed && !(sp && sp.preview) && drawHead(parsed, cv);
  cv.hidden = !own; img.hidden = own;
  // picture host unreachable (offline): draw the head from the file, or just show the die
  img.onerror = () => { img.hidden = true; if (parsed && drawHead(parsed, cv)) cv.hidden = false; };
  if (!own) img.src = (sp && sp.preview) || LINK_PREVIEW;
  b.title = `Sprite: ${sp ? sp.label : 'Default Link'}. Tap for a random one (changes Link in the game you're playing, and the next seed).`;
}

async function useLibrarySprite(entry) {
  if (isPlainLink(entry)) {
    await kvDel('sprite');
    status(spriteStatus('Default Link', await liveSprite(null).catch(() => false)), 'ok');
    refreshSprite();
    return;
  }
  // yours, the saved copy of a favourite, or a download from alttpr.com
  const bytes = await coll.bytesFor(entry);
  parseSprite(bytes);   // throws with a readable reason if it isn't a sprite
  const label = entry.label || labelOf(entry);
  const sp = { bytes: bytes.slice(), label, key: keyOf(entry) };
  if (!entry.own && entry.preview) sp.preview = entry.preview;
  await kvSet('sprite', sp);
  status(spriteStatus(label, await liveSprite(sp).catch(() => false)), 'ok');
  refreshSprite();
}

function spriteLabel(info, fileName) {
  if (!info.name) return fileName;
  return info.author ? `${info.name} by ${info.author}` : info.name;
}

// ── MSU-1 packs ──────────────────────────────────────────────────────────────
// A first guess at the pack's name: its .zip or folder name when there is one
// (most packs name their songs alttp_msu-1.pcm…, so that alone says little),
// otherwise the songs' shared name. The player can change it when it's added.
function packName(files, zip) {
  if (zip) return zip.name.replace(/\.zip$/i, '');
  const path = files[0] && (files[0].webkitRelativePath || '');
  const dirs = path.split('/').slice(0, -1).filter(Boolean);
  if (dirs.length) return dirs[dirs.length - 1];
  const n = files.map((f) => f.name.replace(/-\d+\.pcm$/i, ''));
  return n.every((x) => x === n[0]) ? n[0] : 'MSU-1 pack';
}

// Ask for a name (the guess filled in). Cancel or empty keeps the guess.
function askPackName(guess, title = 'Name this MSU-1 pack') {
  let v = null;
  try { v = window.prompt(title, guess); } catch (e) {}
  v = (v || '').trim().slice(0, 60);
  return v || guess;
}

// A small "♪ pack name" card over the game for 3 seconds whenever the MSU-1
// pack changes (menu, 🎲 roll or a crowd gift), so viewers see what's playing.
function msuToast(name) {
  const host = document.querySelector('.s9x');
  if (!host) return;
  if (!document.getElementById('msu-toast-css')) {
    const st = document.createElement('style'); st.id = 'msu-toast-css';
    st.textContent =
      '@font-face { font-family: "Rando Pixel"; src: url(fonts/PressStart2P-Regular.ttf) format("truetype"); font-display: swap; }' +
      // Sits over the HUD's rupee / bomb / arrow counters (top of the picture),
      // never over Link. Placed by msuToast() from the picture's position.
      '.msu-toast { position: absolute; left: 43%; top: 8px; transform: translate(-50%, -8px); z-index: 26; pointer-events: none;' +
      ' display: flex; align-items: center; gap: 8px; max-width: 40%; padding: 5px 12px 5px 9px; border-radius: 8px;' +
      ' background: rgba(18,12,34,.9); border: 2px solid #e63946; box-shadow: 0 4px 14px rgba(0,0,0,.5); color: #fff;' +
      ' opacity: 0; transition: opacity .35s ease, transform .35s ease; }' +
      '.msu-toast.show { opacity: 1; transform: translate(-50%, 0); }' +
      '.msu-toast .note { font-size: 18px; line-height: 1; color: #f5c542; animation: msu-bop .5s ease-in-out infinite alternate; }' +
      '@keyframes msu-bop { to { transform: translateY(-3px) rotate(-8deg); } }' +
      '.msu-toast .lab { display: block; font: 7px/1.2 "Rando Pixel", ui-monospace, monospace; color: #ff8a92; letter-spacing: .04em; margin-bottom: 3px; }' +
      '.msu-toast > span:last-child { min-width: 0; }' +
      '.msu-toast .nm { display: block; font: 700 13px/1.2 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; }';
    document.head.appendChild(st);
  }
  let el = host.querySelector('.msu-toast');
  if (!el) { el = document.createElement('div'); el.className = 'msu-toast'; el.innerHTML = '<span class="note">♪</span><span><span class="lab"></span><span class="nm"></span></span>'; host.appendChild(el); }
  // over the HUD counters: a little below the top of the game picture
  const P = window.Snes9xPlayer, r = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
  if (r && r.w > 0) {
    el.style.left = Math.round(r.x + r.w * 0.43) + 'px';
    el.style.top = Math.round(r.y + r.h * 0.045) + 'px';
    el.style.maxWidth = Math.round(r.w * 0.4) + 'px';
  }
  el.querySelector('.lab').textContent = name ? 'NOW PLAYING' : 'MSU-1 OFF';
  el.querySelector('.nm').textContent = name || "The game's own music";
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(msuToast.t); msuToast.t = setTimeout(() => el.classList.remove('show'), 3000);
}

function showMsu(name) {
  // the pick button shows the pack in use (or asks for one)
  $('r-msu-pick-text').textContent = msu.count ? name : 'Choose pack…';
  $('r-msu-name').textContent = msu.count ? `${msu.count} tracks · tap to change` : '.zip or .pcm files';
  $('r-msu-pick').classList.toggle('on', !!msu.count);
  $('r-msu-pick').title = msu.count ? `MSU-1 pack: ${name} (${msu.count} tracks). Tap to choose another.` : 'Choose an MSU-1 pack: one .zip, or all its .pcm files';
  $('r-msu-clear').hidden = !msu.count;
  updateMusicButton(name);
}

// A chosen folder: use the folder that holds the pack's .pcm files, ignoring
// subfolders like "Alternative" whose tracks would replace the main ones.
function packFolderFiles(fileList) {
  const byDir = new Map();
  for (const f of fileList) {
    if (trackNumber(f.name) === null) continue;
    const path = f.webkitRelativePath || f.name;
    const dir = path.slice(0, path.lastIndexOf('/') + 1);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(f);
  }
  let best = [];
  for (const [dir, files] of byDir) {
    const depth = dir.split('/').length;
    const bDepth = best.length ? (best[0].webkitRelativePath || '').split('/').length : Infinity;
    if (!best.length || depth < bDepth || (depth === bDepth && files.length > best.length)) best = files;
  }
  return best;
}

// A pack as one .zip: songs are unpacked from it only when they play.
function zipTracks(zip, list) {
  return new Map(list.map(([n, ent]) => [n, () => zipEntryBlob(zip, ent)]));
}

async function loadMsuZip(zip) {
  status(`Opening ${zip.name}…`);
  const pcm = (await listZip(zip))
    .map((ent) => ({ ent, name: ent.path.split('/').pop(), webkitRelativePath: ent.path }))
    .filter((f) => !/(^|\/)__MACOSX\//.test(f.ent.path) && !f.name.startsWith('._') && trackNumber(f.name) !== null);
  const files = packFolderFiles(pcm);
  if (!files.length) throw new Error('No MSU-1 .pcm files in that .zip (they should be named like pack-1.pcm, pack-2.pcm, …).');
  const list = files.map((f) => [trackNumber(f.name), f.ent]);
  return addPack({ name: packName(files, zip), zip, entries: list }, list.length, zip.size);
}

async function loadMsuPack(fileList) {
  const zip = [...fileList].find((f) => /\.zip$/i.test(f.name));
  if (zip) return loadMsuZip(zip);
  const files = [...fileList].filter((f) => trackNumber(f.name) !== null);
  if (!files.length) throw new Error('Choose the .pcm files from an MSU-1 pack (named like pack-1.pcm, pack-2.pcm, …), or the pack as one .zip.');
  const tracks = new Map(files.map((f) => [trackNumber(f.name), f]));
  const size = files.reduce((n, f) => n + f.size, 0);
  return addPack({ name: packName(files), tracks: [...tracks] }, tracks.size, size);
}

// ── My packs: every pack you add is kept in the browser, ☆/★ favourites ─────
// 'msu-packs' lists them ({ id, name, count, size, fav }); each pack's songs
// are in 'msu-pack:<id>' (the .zip, or its .pcm files). 'msu-current' is the
// one playing. Packs are big (100-500 MB), so the menu shows the space used
// and ✕ removes one.
let packs = [];
let currentPack = null;      // id, or null: the game's own music
let visitPack = null;        // a pack too big to keep: { name, count }, this visit only

async function loadPacks() {
  packs = (await kvGet('msu-packs').catch(() => null)) || [];
  currentPack = (await kvGet('msu-current').catch(() => null)) || null;
  // the single pack older versions kept
  const old = await kvGet('msu-pack').catch(() => null);
  if (old && ((old.zip && old.entries && old.entries.length) || (old.tracks && old.tracks.length))) {
    const id = 'p' + Date.now().toString(36);
    const count = old.zip ? old.entries.length : old.tracks.length;
    const size = old.zip ? old.zip.size : old.tracks.reduce((n, [, f]) => n + f.size, 0);
    try {
      await kvSet('msu-pack:' + id, old);
      packs.push({ id, name: old.name, count, size, fav: false });
      await kvSet('msu-packs', packs);
      currentPack = id;
      await kvSet('msu-current', id);
      await kvDel('msu-pack');
    } catch (e) { console.warn('[msu] could not move the saved pack', e); }
  }
  if (currentPack && !packs.some((x) => x.id === currentPack)) currentPack = null;
}

function playPackData(p) {
  if (p.zip) msu.setTracks(zipTracks(p.zip, p.entries));
  else msu.setTracks(new Map(p.tracks.map(([n, f]) => [n, f])));
  showMsu(p.name);
  msu.start();
}

async function addPack(data, count, size) {
  msu.unlock();
  // the same pack again: use the copy already kept (matched by what it was
  // added as, not the name the player gave it)
  const src = data.name;
  const same = packs.find((x) => (x.src || x.name) === src && x.count === count && x.size === size);
  if (same) {
    playPackData({ ...data, name: same.name });
    msuToast(same.name);
    visitPack = null;
    await setCurrent(same.id);
    status(`MSU-1 pack: ${same.name} (already in My packs). ${musicNote(await liveMusic(true).catch(() => null))}`, 'ok');
    renderMusicMenu();
    return;
  }
  data = { ...data, name: askPackName(src) };
  playPackData(data);
  msuToast(data.name);
  status(`Saving ${data.name} in this browser…`);
  const id = 'p' + Date.now().toString(36);
  const keep = data.zip ? data : { name: data.name, tracks: data.tracks.map(([n, f]) => [n, new Blob([f], { type: 'application/octet-stream' })]) };
  let saved = false;
  try {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    await kvSet('msu-pack:' + id, keep);
    packs.push({ id, name: data.name, src, count, size, fav: false });
    await kvSet('msu-packs', packs);
    saved = true;
  } catch (e) {
    console.warn('[msu] could not store pack', e);
    kvDel('msu-pack:' + id);
    packs = packs.filter((x) => x.id !== id);
  }
  const live = musicNote(await liveMusic(true).catch(() => null));
  if (saved) {
    visitPack = null;
    await setCurrent(id);
    status(`MSU-1 pack ready: ${data.name}, kept in My packs (♪). ${live}`, 'ok');
  } else {
    visitPack = { name: data.name, count };
    await setCurrent(null, true);
    status(`MSU-1 pack ready for this visit: ${data.name}. The browser is out of room to keep it; remove a pack in ♪ to make space. ${live}`, 'ok');
  }
  renderMusicMenu();
}

async function setCurrent(id, keepPlaying) {
  currentPack = id;
  if (id) await kvSet('msu-current', id).catch(() => {});
  else await kvDel('msu-current');
  if (!id && !keepPlaying) visitPack = null;
}

async function usePack(id) {
  const meta = packs.find((x) => x.id === id);
  if (!meta) return;
  msu.unlock();
  const data = await kvGet('msu-pack:' + id).catch(() => null);
  if (!data) throw new Error(`${meta.name} isn't in this browser any more. Remove it and add it again.`);
  playPackData({ ...data, name: meta.name });
  msuToast(meta.name);
  visitPack = null;
  await setCurrent(id);
  status(`MSU-1 pack: ${meta.name}. ${musicNote(await liveMusic(true).catch(() => null))}`, 'ok');
  renderMusicMenu();
}

async function musicOff() {
  msu.setTracks(new Map());
  showMsu('');
  msuToast('');
  await setCurrent(null);
  const live = await liveMusic(false).catch(() => null);
  status(live === 'now' ? "MSU-1 off. The game's own music is back, here and on seeds after." :
    "MSU-1 off. Seeds you generate from now on use the game's own music.", 'ok');
  renderMusicMenu();
}

async function toggleFavPack(id) {
  const meta = packs.find((x) => x.id === id);
  if (!meta) return;
  meta.fav = !meta.fav;
  await kvSet('msu-packs', packs).catch(() => {});
  renderMusicMenu();
}

async function removePack(id) {
  const meta = packs.find((x) => x.id === id);
  if (!meta || !confirm(`Remove ${meta.name} from My packs? (Frees ${fmtSize(meta.size)}.)`)) return;
  packs = packs.filter((x) => x.id !== id);
  await kvSet('msu-packs', packs).catch(() => {});
  await kvDel('msu-pack:' + id);
  if (currentPack === id) {
    // keeps playing this visit (the songs are still open), not after
    currentPack = null;
    visitPack = { name: meta.name, count: meta.count };
    await kvDel('msu-current');
  }
  status(`Removed ${meta.name} from My packs.`, 'ok');
  renderMusicMenu();
}

// 🎲 a random favourite (never the one playing when there's another)
async function rollPack() {
  const favs = packs.filter((x) => x.fav);
  if (!favs.length) {
    const msg = packs.length ? 'No favourite packs yet. Tap ☆ beside the packs you like in ♪.' :
      'No packs yet. Add one in ♪ first, then tap ☆ to make it a favourite.';
    status(msg, 'bad');
    if (!document.body.classList.contains('rando-open')) alert(msg);
    return;
  }
  const others = favs.length > 1 ? favs.filter((x) => x.id !== currentPack) : favs;
  const pick = others[Math.floor(Math.random() * others.length)];
  const b = $('music-roll-btn');
  if (b) { if (b.disabled) return; b.disabled = true; b.classList.add('busy'); }
  try { await usePack(pick.id); }
  catch (e) { status(String(e.message || e), 'bad'); }
  finally { if (b) { b.disabled = false; b.classList.remove('busy'); } }
}

function fmtSize(n) {
  if (!n) return '';
  return n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.round(n / 1e6) + ' MB';
}

// Called by "Load ROM…" for seed files: turn the game's music off when a pack
// is loaded, so the pack plays instead (randomizer ROMs only).
function prepareLoadedRom(bytes) {
  if (!msu.count) return bytes;
  const off = bytes.length % 1024 === 512 ? 512 : 0;
  if (bytes.length < off + 0x200000 || !isRandoTitle(bytes.subarray(off + 0x7FC0, off + 0x7FC2))) return bytes;
  const rom = bytes.slice(off);
  rom[0x18021A] = 0x01;
  updateChecksum(rom);
  msu.unlock();
  return rom;
}

// What a seed from elsewhere (Load ROM) was rolled with, read from the ROM,
// for the tracker's logic: the randomizer's own flag bytes (swordless, GT
// crystals) and, for boss shuffle, the Eastern Palace boss room's sprite list
// (pointer table 0x4D62E, bank 9; a sort byte, then y / x / kind to 0xFF).
// Vanilla bosses put the Armos Knights (0x53) there; a shuffled seed puts
// another boss. Without this the map assumed bosses were shuffled and let EP
// go green with no bow (HydeOut, Oct 2026). Null if it isn't an alttpr ROM.
function romFlags(bytes) {
  const off = bytes.length % 1024 === 512 ? 512 : 0;
  if (bytes.length < off + 0x200000 || !isRandoTitle(bytes.subarray(off + 0x7FC0, off + 0x7FC2))) return null;
  const rom = bytes.subarray(off);
  let bosses = null;
  try {
    const ptr = 0x4D62E + 0xC8 * 2, at = rom[ptr] + rom[ptr + 1] * 0x100 + 0x40000;
    const kinds = [];
    for (let i = at + 1; i < at + 64 && rom[i] !== 0xFF; i += 3) kinds.push(rom[i + 2]);
    if (kinds.length) bosses = kinds.includes(0x53) ? 'no' : 'yes';
  } catch (e) {}
  const gt = rom[0x18019A];
  return {
    swordless: rom[0x18003F] === 1 ? 'yes' : 'no',
    gtcrystals: gt >= 0 && gt <= 7 ? String(gt) : '7',
    bossshuffle: bosses || 'no',
    enemizer: bosses || 'no',
  };
}

// ── switching the music during a game ───────────────────────────────────────
// The pack only plays when the running ROM has its own music off (0x18021A).
// A seed started before the pack was chosen (Resume, an older seed, Load ROM)
// has it on, so flip that flag in the running ROM, like the sprite change does.
// The game checks the flag on every song request, so we then ask it for the
// current song again: it mutes (pack on) or restarts (pack off) the SPC music
// right away instead of at the next door. The changed ROM is kept with the game.
const NO_BGM = 0x18021A;
let musicChecked = null;   // the game already switched to the pack
async function liveMusic(on) {
  const app = window.UnifiedApp, br = window.AlttpBridge;
  const run = app && app.runningRom && app.runningRom();
  if (!run || !br || !br.patchRom || !br.ready || !br.ready()) return null;   // no game running
  const hdr = run.bytes.length % 1024 === 512 ? 512 : 0;
  const rom = run.bytes.slice(hdr);
  if (rom.length < 0x200000 || !isRandoTitle(rom.subarray(0x7FC0, 0x7FC2))) return 'not-rando';
  const want = on ? 1 : 0;
  if (rom[NO_BGM] !== want) {
    rom[NO_BGM] = want;
    if (!br.patchRom(rom)) return false;
    const full = new Uint8Array(hdr + rom.length);
    full.set(run.bytes.subarray(0, hdr)); full.set(rom, hdr);
    app.setRunningRom(full);
  }
  if (on) { musicChecked = run; msu.unlock(); msu.start(); msu.restart(); }
  // ask for the song that's playing again ($012C request; clearing $0133,
  // the current one, so the game doesn't skip it as already playing)
  const song = rd(0x0130);
  if (song >= 1 && song <= 0x3F && rd(0x012C) === 0) {
    br.writeWram(WRAM + 0x0133, new Uint8Array([0]));
    br.writeWram(WRAM + 0x012C, new Uint8Array([song]));
  }
  return 'now';
}

function musicNote(live) {
  if (live === 'now') return 'Playing in this game now, and on every seed after.';
  if (live === 'not-rando') return "This game isn't a randomizer seed, so it keeps its own music; the pack plays on seeds.";
  if (live === false) return "Couldn't switch this game's music; the pack plays on the next seed.";
  return 'It plays on seeds you start from now on.';
}

// A pack is set but the game running still has its own music on (started
// before the pack was chosen, or resumed): switch it over once per game.
function checkRunningMusic() {
  const app = window.UnifiedApp, br = window.AlttpBridge;
  const run = app && app.runningRom && app.runningRom();
  if (!msu.count || !run || run === musicChecked || !br || !br.ready || !br.ready()) return;
  const st = br.status();
  if (!st.running || st.mode !== 'live') return;
  musicChecked = run;
  let flag = 1;
  try { flag = br.read(NO_BGM, 1)[0]; } catch (e) {}
  if (flag === 0) liveMusic(true).catch(() => {});
}

// ── header button: ♪ My packs, during a game too ────────────────────────────
// Tap: a menu with 🎲 a random favourite, your packs (tap one to play it, ☆/★,
// ✕ to remove), + Add pack (the folder picker on computers; the file picker,
// a .zip or the .pcm files, on iPhone/iPad), and the game's own music.
function buildMusicButton() {
  if ($('music-btn')) return;
  const after = $('sprite-fav-btn') || $('sprite-btn');
  if (!after) return;
  const b = document.createElement('button');
  b.id = 'music-btn';
  b.type = 'button';
  b.setAttribute('aria-label', 'MSU-1 music packs');
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5.5l11-2V16"/>' +
    '<ellipse cx="6.5" cy="18" rx="2.6" ry="2.1" fill="currentColor"/><ellipse cx="17.5" cy="16" rx="2.6" ry="2.1" fill="currentColor"/></svg>' +
    '<span class="mb-lbl">Music</span>';
  b.addEventListener('click', () => musicMenu($('music-menu').hidden));
  after.parentNode.insertBefore(b, after.nextSibling);
  // 🎲♪ beside it: a random favourite pack in one tap
  const r = document.createElement('button');
  r.id = 'music-roll-btn';
  r.type = 'button';
  r.setAttribute('aria-label', 'Random favourite MSU-1 pack');
  r.title = 'A random MSU-1 pack from your favourites (switches this game too)';
  r.innerHTML = '<svg class="mr-note" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5.5l11-2V16"/>' +
    '<ellipse cx="6.5" cy="18" rx="2.6" ry="2.1" fill="currentColor"/><ellipse cx="17.5" cy="16" rx="2.6" ry="2.1" fill="currentColor"/></svg>' +
    '<svg class="sb-die" viewBox="0 0 12 12" aria-hidden="true"><rect x=".75" y=".75" width="10.5" height="10.5" rx="2.5"/>' +
    '<circle cx="4" cy="4" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="8" cy="4" r="1.1"/><circle cx="4" cy="8" r="1.1"/></svg>';
  r.addEventListener('click', () => { msu.unlock(); rollPack(); });
  b.parentNode.insertBefore(r, b.nextSibling);

  const m = document.createElement('div');
  m.id = 'music-menu';
  m.setAttribute('role', 'menu');
  m.hidden = true;
  document.body.appendChild(m);
  m.addEventListener('click', onMusicMenuClick);
  document.addEventListener('pointerdown', (e) => {
    if (!m.hidden && !e.target.closest('#music-menu, #music-btn')) musicMenu(false);
  }, true);
  window.addEventListener('blur', () => { if (!m.hidden) musicMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) { musicMenu(false); b.focus(); } });
  window.addEventListener('resize', () => { if (!m.hidden) placeMusicMenu(); });

  const st = document.createElement('style');
  st.textContent = [
    '#music-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }',
    '#music-btn svg { display: block; flex: none; }',
    '#music-btn.on svg { color: var(--accent, #5fbf6f); }',
    '#music-btn[aria-expanded=true] { border-color: var(--accent, #5fbf6f); }',
    '#music-btn.busy svg { animation: sb-spin .6s linear infinite; }',
    'body.phone #music-btn { min-width: 34px; min-height: 34px; padding: 0 6px; }',
    'body.phone #music-btn .mb-lbl { display: none; }',
    '#music-roll-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 38px; }',
    '#music-roll-btn .mr-note { display: block; color: #f5c542; }',
    '#music-roll-btn .sb-die { position: absolute; right: 4px; bottom: 3px; width: 10px; height: 10px; }',
    '#music-roll-btn .sb-die rect { fill: var(--bg, #111); stroke: currentColor; stroke-width: 1.3; }',
    '#music-roll-btn .sb-die circle { fill: currentColor; }',
    '#music-roll-btn.busy .mr-note, #music-btn.busy svg { animation: sb-spin .6s linear infinite; }',
    'body.phone #music-roll-btn { min-width: 34px; min-height: 34px; padding: 0 5px; }',
    // two more buttons on phones: tighten the header so ⚙ stays on its line
    // the header's icon buttons get a little narrower so ⚙ stays on its line
    'body.phone header:has(#music-roll-btn) { column-gap: 4px !important; }',
    'body.phone header:has(#music-roll-btn) h1 { font-size: 13px; margin-right: 4px; }',
    'body.phone header:has(#music-roll-btn) #reroll-btn, body.phone header:has(#music-roll-btn) #sprite-btn { min-width: 34px !important; padding: 0 4px !important; }',
    'body.phone header:has(#music-roll-btn) #sprite-fav-btn, body.phone header:has(#music-roll-btn) #music-btn,' +
    ' body.phone header:has(#music-roll-btn) #music-roll-btn { min-width: 32px !important; padding: 0 3px !important; }',
    'body.phone header:has(#music-roll-btn) #phone-gear { min-width: 36px !important; padding: 0 4px !important; }',
    // small phones (iPhone SE/mini): the title makes way for the buttons
    '@media (max-width: 385px) { body.phone header:has(#music-roll-btn) h1 { display: none; } }',
    '#music-menu { position: fixed; z-index: 80; width: min(360px, calc(100vw - 32px)); max-height: min(70vh, 520px); overflow-y: auto;',
    '  -webkit-overflow-scrolling: touch; padding: 6px; display: flex; flex-direction: column; gap: 2px; background: var(--panel, #161b22);',
    '  border: 1px solid var(--line, #2a313c); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.55); font-size: 14px; }',
    '#music-menu[hidden] { display: none; }',
    '#music-menu .mm-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 4px 8px 6px;',
    '  color: var(--dim, #8b95a3); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }',
    '#music-menu .mm-h span:last-child { text-transform: none; letter-spacing: 0; }',
    '#music-menu button { border: 0; background: transparent; text-align: left; padding: 8px 10px; border-radius: 6px; min-height: 40px; }',
    '#music-menu button:hover, #music-menu button:focus-visible { background: #1b2430; outline: none; }',
    '#music-menu .mm-act { display: flex; align-items: center; gap: 10px; width: 100%; }',
    '#music-menu .mm-act .ic { width: 20px; text-align: center; flex: none; }',
    '#music-menu .mm-sep { height: 1px; background: var(--line, #2a313c); margin: 4px 2px; }',
    '#music-menu .mm-row { display: flex; align-items: center; gap: 2px; }',
    '#music-menu .mm-row .mm-pick { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding-left: 4px; }',
    '#music-menu .mm-pick b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '#music-menu .mm-pick small, #music-menu .mm-act small { color: var(--dim, #8b95a3); font-size: 11px; }',
    '#music-menu .mm-cur b { color: var(--accent, #5fbf6f); }',
    '#music-menu .mm-cur b::before { content: "\\266A  "; }',
    '#music-menu .mm-star, #music-menu .mm-del, #music-menu .mm-ren { flex: none; width: 40px; padding: 0; text-align: center; font-size: 17px; color: var(--dim, #8b95a3); }',
    '#music-menu .mm-star.on { color: #f5c542; }',
    '#music-menu .mm-del, #music-menu .mm-ren { font-size: 14px; }',
    '#music-menu .mm-ren { width: 34px; }',
    '#music-menu .mm-empty { padding: 6px 10px; color: var(--dim, #8b95a3); font-size: 13px; }',
  ].join('\n');
  document.head.appendChild(st);
  updateMusicButton(lastPackName);
}

let lastPackName = '';
function updateMusicButton(name) {
  lastPackName = name || '';
  const b = $('music-btn');
  if (!b) return;
  b.classList.toggle('on', !!msu.count);
  b.title = msu.count
    ? `Music: ${lastPackName}. Tap for My packs: another pack, a random favourite, or MSU Off.`
    : "Music: the game's own. Tap for My packs: add an MSU-1 pack, pick one, or roll a random favourite.";
}

function musicMenu(open) {
  const m = $('music-menu'), b = $('music-btn');
  if (!m || !b) return;
  if (open) { renderMusicMenu(); placeMusicMenu(); }
  m.hidden = !open;
  b.setAttribute('aria-expanded', String(open));
  if (open) { const f = m.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
}

// under the button, kept on screen (16px from the edges)
function placeMusicMenu() {
  const m = $('music-menu'), b = $('music-btn');
  const r = b.getBoundingClientRect();
  const w = Math.min(360, window.innerWidth - 32);
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.round(Math.max(16, Math.min(r.right - w, window.innerWidth - 16 - w))) + 'px';
}

function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ✎ in My packs: a new name for a kept pack
async function renamePack(id) {
  const meta = packs.find((x) => x.id === id);
  if (!meta) return;
  const name = askPackName(meta.name, 'Rename this MSU-1 pack');
  if (name === meta.name) return;
  if (!meta.src) meta.src = meta.name;
  meta.name = name;
  await kvSet('msu-packs', packs);
  if (id === currentPack && msu.count) showMsu(name);
  renderMusicMenu();
  status(`Renamed to ${name}.`, 'ok');
}

function renderMusicMenu() {
  const m = $('music-menu');
  if (!m) return;
  const favs = packs.filter((x) => x.fav).length;
  const total = packs.reduce((n, x) => n + (x.size || 0), 0);
  const folders = !$('r-msu-dir-label').hidden;
  let h = `<div class="mm-h"><span>MSU-1 music</span><span>${packs.length ? fmtSize(total) + ' kept' : ''}</span></div>`;
  h += `<button type="button" role="menuitem" class="mm-act" data-act="roll"><span class="ic">\u{1F3B2}</span>` +
    `<span>Random favourite<br><small>${favs ? `${favs} starred` : 'Tap ☆ on a pack to star it'}</small></span></button>`;
  h += '<div class="mm-sep"></div>';
  if (!packs.length && !visitPack) h += '<div class="mm-empty">No packs yet. Add one below and it stays here for next time.</div>';
  if (visitPack && msu.count) {
    h += `<div class="mm-row"><span class="mm-star" aria-hidden="true"></span><div class="mm-pick mm-cur"><b>${esc(visitPack.name)}</b>` +
      `<small>${visitPack.count} tracks · this visit only</small></div></div>`;
  }
  // favourites first, then the rest, each by name
  const sorted = packs.slice().sort((a, b) => (b.fav - a.fav) || a.name.localeCompare(b.name));
  for (const x of sorted) {
    const cur = x.id === currentPack && msu.count;
    h += `<div class="mm-row">` +
      `<button type="button" class="mm-star${x.fav ? ' on' : ''}" data-act="fav" data-id="${x.id}" aria-pressed="${x.fav}" ` +
      `title="${x.fav ? 'Remove from favourites' : 'Add to favourites'}">${x.fav ? '★' : '☆'}</button>` +
      `<button type="button" role="menuitemradio" aria-checked="${!!cur}" class="mm-pick${cur ? ' mm-cur' : ''}" data-act="use" data-id="${x.id}">` +
      `<b>${esc(x.name)}</b><small>${x.count} tracks${x.size ? ' · ' + fmtSize(x.size) : ''}</small></button>` +
      `<button type="button" class="mm-ren" data-act="ren" data-id="${x.id}" title="Rename" aria-label="Rename ${esc(x.name)}">✎</button>` +
      `<button type="button" class="mm-del" data-act="del" data-id="${x.id}" title="Remove from My packs" aria-label="Remove ${esc(x.name)}">✕</button></div>`;
  }
  h += '<div class="mm-sep"></div>';
  h += `<button type="button" role="menuitem" class="mm-act" data-act="add"><span class="ic">+</span>` +
    `<span>Add pack…<br><small>${folders ? "The pack's folder" : 'A .zip, or all its .pcm files'}</small></span></button>`;
  if (folders) h += `<button type="button" role="menuitem" class="mm-act" data-act="add-files"><span class="ic">+</span>` +
    `<span>Add from files…<br><small>A .zip, or all its .pcm files</small></span></button>`;
  h += `<button type="button" role="menuitemradio" aria-checked="${!msu.count}" class="mm-act${msu.count ? '' : ' mm-cur'}" data-act="off">` +
    `<span class="ic">${msu.count ? '' : '✓'}</span><span>MSU Off</span></button>`;
  m.innerHTML = h;
}

async function onMusicMenuClick(e) {
  const t = e.target.closest('button[data-act]');
  if (!t) return;
  const id = t.dataset.id;
  msu.unlock();
  try {
    switch (t.dataset.act) {
      case 'roll': musicMenu(false); await rollPack(); break;
      case 'use': musicMenu(false); await usePack(id); break;
      case 'fav': await toggleFavPack(id); break;
      case 'ren': await renamePack(id); break;
      case 'del': await removePack(id); break;
      case 'off': musicMenu(false); await musicOff(); break;
      case 'add': musicMenu(false); ($('r-msu-dir-label').hidden ? $('r-msu-input') : $('r-msu-dir')).click(); break;
      case 'add-files': musicMenu(false); $('r-msu-input').click(); break;
    }
  } catch (err) {
    const msg = String(err.message || err);
    status(msg, 'bad');
    if (!document.body.classList.contains('rando-open')) alert(msg);
  }
}

function initMsu() {
  const onPick = async (ev) => {
    const files = ev.target.files;
    msu.unlock();
    try { await loadMsuPack(ev.target.id === 'r-msu-dir' ? packFolderFiles(files) : files); }
    catch (e) { status(String(e.message || e), 'bad'); }
    ev.target.value = '';
  };
  $('r-msu-input').addEventListener('change', onPick);
  $('r-msu-dir').addEventListener('change', onPick);
  // Folder… needs a browser whose picker can choose folders (not iPhone/iPad)
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('r-msu-dir-label').hidden = ios || !('webkitdirectory' in $('r-msu-dir'));
  $('r-msu-clear').addEventListener('click', () => musicOff());
  // iOS only starts audio from a tap, so (re)unlock on any tap while a pack is loaded
  ['touchend', 'click', 'keydown'].forEach((t) => document.addEventListener(t, () => { if (msu.count) msu.unlock(); }, true));
  setInterval(checkRunningMusic, 1000);
  loadPacks().then(async () => {
    if (!currentPack) return;
    const data = await kvGet('msu-pack:' + currentPack).catch(() => null);
    const meta = packs.find((x) => x.id === currentPack);
    if (data) playPackData(meta ? { ...data, name: meta.name } : data);
    else currentPack = null;
  }).catch(() => {}).finally(renderMusicMenu);
}

export function init() {
  $('r-sprite-input').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const info = parseSprite(bytes);
      const label = spriteLabel(info, f.name.replace(/\.[^.]+$/, ''));
      // also kept in your sprites (Library → Mine), so it can be starred and rolled
      const mine = await coll.addOwn(bytes, f.name.replace(/\.[^.]+$/, '')).catch(() => null);
      const sp = { bytes: bytes.slice(), label, key: mine ? mine.key : undefined };
      await kvSet('sprite', sp);
      status(spriteStatus(label, await liveSprite(sp).catch(() => false)), 'ok');
    } catch (e) {
      status(String(e.message || e), 'bad');
    }
    refreshSprite();
  });
  $('r-sprite-clear').addEventListener('click', async () => {
    await kvDel('sprite');
    status(spriteStatus('Default Link', await liveSprite(null).catch(() => false)), 'ok');
    refreshSprite();
  });
  $('r-sprite-random').addEventListener('click', () => randomSprite('all'));
  $('r-sprite-fav-roll').addEventListener('click', () => randomSprite('fav'));
  $('r-sprite-star').addEventListener('click', async () => {
    const sp = await kvGet('sprite').catch(() => null);
    if (!sp || !sp.key) return;
    // a starred own sprite is already in the collection; a library one is
    // starred by key (its offline copy is the bytes we already have)
    const on = await coll.toggleFav({ key: sp.key, own: sp.key.startsWith('own:'), bytes: sp.bytes });
    if (on && sp.key.startsWith('lib:')) kvSet('sprite-cache:' + sp.key, sp.bytes.slice()).catch(() => {});
    status(on ? `Starred ${sp.label}.` : `Unstarred ${sp.label}.`, 'ok');
  });
  coll.onChange(async () => paintStar(await kvGet('sprite').catch(() => null)));
  buildSpriteButton();
  buildMusicButton();
  refreshSprite();

  window.UnifiedRando = { useIfBaseRom, prepareLoadedRom, romFlags, noteRom, crowd: crowdApi(),
    // crowd "music roulette" and the run-stats overlay
    music: {
      roulette: () => msu.roulette(),
      get count() { return msu.count; },
      get pack() { const m = packs.find((x) => x.id === currentPack); return m ? m.name : (visitPack ? visitPack.name : ''); },
    },
  };
  if (window.__pendingRomNote) { noteRom(window.__pendingRomNote.bytes, window.__pendingRomNote.name); window.__pendingRomNote = null; }
  $('r-sprite-lib').addEventListener('click', () => openLibrary($, useLibrarySprite, coll));
  $('r-sprite-prev').addEventListener('click', () => {
    if ($('r-sprite-prev').dataset.sheet) $('r-sprite-sheet').hidden = !$('r-sprite-sheet').hidden;
    else openLibrary($, useLibrarySprite, coll);
  });
  document.addEventListener('click', (e) => {
    if (!$('r-sprite-sheet').hidden && !e.target.closest('#r-sprite-sheet, #r-sprite-prev')) $('r-sprite-sheet').hidden = true;
  });
  $('r-paste-go').addEventListener('click', () => { if (loadPasted($('r-paste').value)) $('r-paste').value = ''; });
  $('r-paste').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (loadPasted($('r-paste').value)) $('r-paste').value = ''; }
  });
  // Pasting anywhere on the page (not into a box) works too, for anything
  // that looks like a seed link.
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    let isLink = false;
    try { isLink = new URL(text.trim()).searchParams.has('seed'); } catch (x) {}
    if (!isLink && !alttprId(text) && !Kara.gwaaId(text) && !Avian.avianId(text)) return;
    if (!/alttpr\.com|alttpr\.gwaa\.kiwi\/seed\/|avianart\.games\/perm\/|[?&]seed=/.test(text)) return;   // a bare id or number only from the box
    e.preventDefault();
    loadPasted(text);
  });
  // empty = the built-in relay; a value = the player's own
  $('r-relay').placeholder = DEFAULT_RELAY.replace(/^https:\/\//, '');
  $('r-relay').value = ownRelay();
  $('r-relay').addEventListener('change', () => {
    setRelayUrl($('r-relay').value);
    $('r-relay').value = ownRelay();
    status(ownRelay() ? 'Using your own relay for alttpr.com seeds.' : 'Using the built-in relay for alttpr.com seeds.', 'ok');
  });
  // AVIANART: its four customizer tabs, race and relay (its presets are in Saved presets)
  try { $('r-avian-race').value = localStorage.getItem('unified-avianart-race') === 'yes' ? 'yes' : 'no'; } catch (e) {}
  $('r-avian-race').addEventListener('change', () => { try { localStorage.setItem('unified-avianart-race', $('r-avian-race').value); } catch (e) {} });
  AvianUi.init({ nameOf: avianName, changed: () => Saved.edited() });
  $('r-avian-relay').placeholder = Avian.DEFAULT_RELAY.replace(/^https:\/\//, '');
  $('r-avian-relay').value = Avian.ownRelay();
  $('r-avian-relay').addEventListener('change', () => {
    Avian.setRelayUrl($('r-avian-relay').value);
    $('r-avian-relay').value = Avian.ownRelay();
    status(Avian.ownRelay() ? 'Using your own relay for AVIANART seeds.' : 'Using the built-in relay for AVIANART seeds.', 'ok');
  });
  $('r-share').addEventListener('click', () => copyLink(false));
  $('r-share-race').addEventListener('click', () => copyLink(true));
  initMsu();
  karaUi = buildKaraUi($('r-kara'), $('r-kara-more-body'));
  loadFields();
  initCustomizer({ status });
  // Saved presets: each one switches to its generator and sets it up
  const romFields = () => ({ 'r-heartbeep': $('r-heartbeep').value, 'r-quickswap': $('r-quickswap').value });
  const setRomFields = (f) => Object.entries(f || {}).forEach(([id, v]) => {
    const el = $(id);
    if (el && [...el.options].some((o) => o.value === v) && el.value !== v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  Saved.init({
    status,
    gen: () => $('r-gen').value,
    switchGen: (g) => {
      if ($('r-gen').value !== g) { $('r-gen').value = g; $('r-gen').dispatchEvent(new Event('change')); }
    },
    fromSiteSave,
    extraGroups: avianGroups,
    applyExtra: applyAvianPick,
    handlers: {
      alttpr: { snapshot: snapshotAlttpr, apply: applyAlttpr },
      kara: {
        snapshot: async () => ({ kara: karaUi.get(), rom: romFields() }),
        apply: async (p) => { if (p.kara) karaUi.set(p.kara); setRomFields(p.rom); },
      },
      avianart: {
        snapshot: async () => {
          const src = AvianUi.getSource();
          return {
            avian: src.kind === 'custom'
              ? { custom: AvianUi.getValues(), race: $('r-avian-race').value === 'yes' }
              : { preset: src.id, race: $('r-avian-race').value === 'yes' },
            rom: romFields(),
          };
        },
        apply: async (p) => {
          const a = p.avian || {};
          if (a.custom) { AvianUi.setValues(a.custom); AvianUi.setSource({ kind: 'custom' }, { quiet: true }); }
          else AvianUi.setSource({ kind: 'preset', id: a.preset || 'crosskeys' }, { quiet: true });
          $('r-avian-race').value = a.race ? 'yes' : 'no';
          try { localStorage.setItem('unified-avianart-race', $('r-avian-race').value); } catch (e) {}
          setRomFields(p.rom);
        },
      },
    },
  });
  // a setting changed by hand: the bar no longer matches the chosen preset
  $('rando-bar').addEventListener('change', (e) => {
    const t = e.target;
    if (!e.isTrusted || !t || !t.closest) return;
    if (t.closest('#r-saved-field, .paste-field, .sprite-field, #r-sprite-sheet') || t.type === 'file' || /relay$/.test(t.id || '')) return;
    Saved.edited();
  });
  FIELDS.forEach((id) => $(id) && $(id).addEventListener('change', saveFields));
  applyGen();
  $('r-gen').addEventListener('change', () => {
    // a shared seed for the other generator no longer applies
    if (shared && (!!shared.kara !== isKara())) {
      if (shared.kara) { karaUi.hold(false); karaUi.set(karaSaved || Kara.presetSettings('default'), { persist: false }); }
      shared = null; clearLink(); showShared(); $('r-seed').value = '';
    }
    applyGen();
    // show the settings for the generator just picked
    document.body.classList.add('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'true');
  });
  $('r-stop').addEventListener('click', () => { if (karaAbort) karaAbort.abort(); Kara.cancel(); });
  karaUi.onWhere(applyGen);
  // the arrow beside Randomizer: a small menu to pick the generator
  const genMenu = $('r-gen-menu'), genBtn = $('r-gen-btn');
  const items = () => [...genMenu.querySelectorAll('[data-gen]')];
  function menu(open) {
    genMenu.hidden = !open;
    genBtn.setAttribute('aria-expanded', String(open));
    if (open) (items().find((b) => b.getAttribute('aria-checked') === 'true') || items()[0]).focus();
  }
  genBtn.addEventListener('click', () => menu(genMenu.hidden));
  items().forEach((b) => b.addEventListener('click', () => {
    menu(false);
    genBtn.focus();
    if ($('r-gen').value === b.dataset.gen) {   // same one: just show its settings
      document.body.classList.add('rando-open');
      $('r-toggle').setAttribute('aria-expanded', 'true');
      return;
    }
    $('r-gen').value = b.dataset.gen;
    $('r-gen').dispatchEvent(new Event('change'));
    Saved.edited();
  }));
  document.addEventListener('pointerdown', (e) => { if (!genMenu.hidden && !e.target.closest('#rando-split')) menu(false); }, true);
  // a click in a tracker or the game (their own frames) doesn't reach this page
  window.addEventListener('blur', () => { if (!genMenu.hidden) menu(false); });
  genMenu.addEventListener('keydown', (e) => {
    const list = items(), i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); menu(false); genBtn.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
    }
  });
  $('r-base-input').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      await setBaseRom(f);
      status('Base ROM saved. New seeds are made from it: pick a preset or settings and press Generate & Play.', 'ok');
    } catch (e) {
      status(String(e.message || e), 'bad');
    }
    refreshBaseStatus();
  });
  $('r-generate').addEventListener('click', generateAndPlay);
  $('r-download').addEventListener('click', () => last && download(last.rom, last.name, 'application/octet-stream'));
  // the seed info is drawn again when opened (the tracker is ready by then) and once the seed is logged
  const refreshInfo = () => { try { showSeedInfo(last, !!last && (!playing || playing.name === last.name)); } catch (e) {} };
  $('r-seed-info').addEventListener('toggle', () => { if ($('r-seed-info').open) refreshInfo(); });
  window.addEventListener('seedlog', refreshInfo);
  $('r-spoiler').addEventListener('click', () => last && download(
    new TextEncoder().encode(JSON.stringify(last.spoiler, null, 2)), last.name.replace(/\.sfc$/, '') + '_spoiler.json', 'application/json'));
  $('r-toggle').addEventListener('click', () => {
    const open = document.body.classList.toggle('rando-open');
    $('r-toggle').setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('unified-kara-open', open ? '1' : '0'); } catch (e) {}
  });
  // While a game is running, the settings bar folds itself away as soon as
  // you go back to playing: a click on the game, a controller button, or a
  // key that isn't typed into one of the bar's fields. The Randomizer button
  // brings it back.
  const gameRunning = () => { const e = window.EJS_emulator; return !!(e && e.gameManager); };
  function foldForPlay() {
    if (!document.body.classList.contains('rando-open') || !gameRunning()) return;
    if (!$('sprite-lib').hidden) return;
    document.body.classList.remove('rando-open');
    $('r-toggle').setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
    setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  }
  $('game-wrap').addEventListener('pointerdown', foldForPlay, true);
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && t.closest && t.closest('#sprite-lib, #rando-split, input, select, textarea')) return;
    // (a button still focused from the bar would otherwise take Space/Enter)
    if (document.body.classList.contains('rando-open') && gameRunning() && t && t.tagName === 'BUTTON') t.blur();
    foldForPlay();
  }, true);
  setInterval(() => {
    if (!document.body.classList.contains('rando-open') || !gameRunning()) return;
    let pads = [];
    try { pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []); } catch (e) {}
    if (pads.some((gp) => gp && gp.buttons.some((b) => b.pressed))) foldForPlay();
  }, 200);

  let open = true;
  try { open = localStorage.getItem('unified-kara-open') !== '0'; } catch (e) {}
  document.body.classList.toggle('rando-open', open);
  $('r-toggle').setAttribute('aria-expanded', String(open));
  refreshBaseStatus();
  // load the generator's modules in the background so the first Generate is quick
  setTimeout(() => { try { if (!isKara()) getWorker(); } catch (e) {} }, 2000);
  kvGet('last-seed').then((v) => { if (v && v.rom) { last = v; showLast(); } }).catch(() => {});
  // opened from a seed link: set it up, ready to play (after loadFields, so
  // the link's settings win)
  takeSharedLink();
}
