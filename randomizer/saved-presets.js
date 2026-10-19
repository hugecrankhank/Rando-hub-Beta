// Saved presets (the Randomizer bar's first field): one list for every
// generator. A preset knows its generator (alttpr.com, Kara's branch or
// AVIANART) and that generator's settings, so picking one switches to the
// right site and sets everything up; Generate & Play rolls it.
//
// Built-in presets come first and can't be deleted. The player's own are kept
// in this browser, in the store the Customizer's presets always used (an entry
// with no `gen` is an alttpr.com one), and can be exported and imported.

import { TRUE_ICE_ROD_HUNT, ADKEYS } from './data/sahasrahbot-presets.js';

const LS_PRESETS = 'unified-custom-presets';
const LS_CURRENT = 'unified-custom-preset';
const BUILTIN_PREFIX = 'builtin:';

export const BUILTIN = [
  {
    id: 'onlyadkdf', name: 'OnlyADKDF', gen: 'avianart',
    avian: { preset: 'jem041/onlyadkdf', race: false }, onlyadkd: true,
    note: 'AVIANART preset jem041/onlyadkdf: open, crossed entrances, pot and enemy key drops, random weapons, 7/6 crystals. Turns on the tracker\'s OnlyADKD mode.',
  },
  {
    id: 'casualboots', name: 'CasualBoots', gen: 'avianart',
    avian: { preset: 'kaesden/casualboots', race: false }, onlyadkd: false,
    note: 'AVIANART preset kaesden/casualboots, the one SahasrahBot rolls: Standard with a starting weapon, and you start with the Pegasus Boots.',
  },
  {
    id: 'cabookey', name: 'Cabookey', gen: 'avianart',
    avian: { preset: 'kaesden/cabookey', race: false }, onlyadkd: false,
    note: 'AVIANART preset kaesden/cabookey, the one SahasrahBot rolls.',
  },
  {
    id: 'adkeys', name: 'ADKeys', gen: 'alttpr', api: ADKEYS, onlyadkd: false,
    note: 'SahasrahBot preset adkeys (All Dungeons Keysanity): open, every dungeon including Castle Tower is required, '
      + 'all dungeon items shuffled anywhere, 7/7 crystals, random weapons. Customizer off.',
  },
  {
    id: 'trueicerodhunt', name: 'True Ice Rod Hunt', gen: 'alttpr', api: TRUE_ICE_ROD_HUNT, onlyadkd: false,
    note: 'SahasrahBot preset trueicerodhunt (/alttpr preset preset:trueicerodhunt): you start with every item except the Ice Rod, '
      + 'and every chest is empty except one Ice Rod. Find it and beat Trinexx (Turtle Rock\'s boss holds the Triforce). Open, keysanity, 0/7 crystals.',
  },
];

export const GEN_LABEL = { alttpr: 'alttpr.com', kara: 'Kara', avianart: 'AVIANART' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

export const genOf = (p) => (p && p.gen) || 'alttpr';
/** The player's own presets: { name: preset }. */
export function own() { const p = lsGet(LS_PRESETS, {}); return p && typeof p === 'object' ? p : {}; }
function putAll(all) { return lsSet(LS_PRESETS, all); }
export const current = () => lsGet(LS_CURRENT, '');
function setCurrent(v) { lsSet(LS_CURRENT, v || ''); paint(); }
/** A setting was changed by hand: the bar no longer matches the preset exactly. */
export function edited() { if (current()) setCurrent(''); }

const usable = (p) => p && typeof p === 'object' && (p.gen || p.custom);

let hooks = null;   // { switchGen(gen), handlers: { gen: { snapshot, apply } }, status(msg, kind), fromSiteSave(json) }

// ★ favourites: preset values (yours, built-in or a site's), shown first
const LS_FAVS = 'unified-preset-favs';
export const favs = () => { const f = lsGet(LS_FAVS, []); return Array.isArray(f) ? f : []; };
function setFavs(list) { lsSet(LS_FAVS, list); }
const favable = (v) => !!v && v !== 'av:?';

export function paint() {
  const sel = $('r-saved');
  if (!sel) return;
  const cur = current();
  const all = own();
  const mine = Object.keys(all).filter((n) => usable(all[n])).sort((a, b) => a.localeCompare(b));
  // every group as data first, so favourites can be lifted out of theirs
  const groups = [
    { label: 'Your presets', empty: 'None yet: set things up, then Save as preset',
      options: mine.map((n) => ({ value: n, label: `${n} · ${GEN_LABEL[genOf(all[n])] || 'alttpr.com'}` })) },
    { label: 'Built-in',
      options: BUILTIN.map((b) => ({ value: BUILTIN_PREFIX + b.id, label: `${b.name} · ${GEN_LABEL[b.gen]}`, title: b.note || '' })) },
    // other sites' own presets (AVIANART's list), straight from their generator
    ...(hooks && hooks.extraGroups ? hooks.extraGroups() : []),
  ];
  const byValue = new Map();
  // in Favorites a site's preset keeps its site's name ("Trinity · AVIANART")
  groups.forEach((g) => g.options.forEach((o) => {
    const site = / · /.test(g.label) ? g.label.split(' · ')[0] : '';
    byValue.set(o.value, site && !o.label.includes(' · ') ? { ...o, label: `${o.label} · ${site}` } : o);
  }));
  const starred = favs().filter((v) => byValue.has(v));
  const isFav = new Set(starred);
  const opt = (o, star) => `<option value="${esc(o.value)}"${o.title ? ` title="${esc(o.title)}"` : ''}>${star ? '★ ' : ''}${esc(o.label)}</option>`;
  sel.innerHTML = '<option value="">Choose a preset…</option>'
    + (starred.length ? '<optgroup label="★ Favorites">' + starred.map((v) => opt(byValue.get(v), true)).join('') + '</optgroup>' : '')
    + groups.map((g) => {
      const list = g.options.filter((o) => !isFav.has(o.value));
      if (!list.length && !g.empty) return '';
      return `<optgroup label="${esc(g.label)}">`
        + (list.length ? list.map((o) => opt(o, false)).join('') : `<option value="" disabled>${esc(g.empty)}</option>`)
        + '</optgroup>';
    }).join('');
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  const isOwn = !!sel.value && !sel.value.startsWith(BUILTIN_PREFIX) && !!own()[sel.value];
  $('r-saved-del').disabled = !isOwn;
  const fb = $('r-saved-fav');
  if (fb) {
    const on = isFav.has(sel.value);
    fb.disabled = !favable(sel.value);
    fb.textContent = on ? '★' : '☆';
    fb.classList.toggle('on', on);
    fb.setAttribute('aria-pressed', String(on));
    fb.title = !favable(sel.value) ? 'Pick a preset, then star it to keep it at the top of the list'
      : on ? 'Remove from favorites' : 'Add to favorites (shown at the top of the list)';
  }
  const b = BUILTIN.find((x) => BUILTIN_PREFIX + x.id === sel.value);
  sel.title = b ? b.note : 'Presets: each one sets the generator (alttpr.com, Kara\'s branch or AVIANART) and its settings';
}

function toggleFav() {
  const v = $('r-saved').value;
  if (!favable(v)) return;
  const list = favs();
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1); else list.push(v);
  setFavs(list);
  paint();
}

function lookup(value) {
  if (!value) return null;
  if (value.startsWith(BUILTIN_PREFIX)) {
    const b = BUILTIN.find((x) => BUILTIN_PREFIX + x.id === value);
    return b ? { name: b.name, p: b } : null;
  }
  const p = own()[value];
  return usable(p) ? { name: value, p } : null;
}

/** Switch to a preset's generator and put its settings in the bar. */
export async function apply(value, { quiet = false } = {}) {
  // a site's own preset (like AVIANART's): the page sets it up
  if (hooks.applyExtra) {
    const done = await hooks.applyExtra(value);
    if (done) {
      if (done.cancelled) { paint(); return false; }
      setCurrent(done.keep === false ? '' : value);
      if (!quiet) hooks.status(`${done.name} is set. Press Generate & Play to roll it.`, 'ok');
      return true;
    }
  }
  const hit = lookup(value);
  if (!hit) return false;
  const { name, p } = hit;
  const gen = genOf(p);
  hooks.switchGen(gen);
  const h = hooks.handlers[gen];
  if (h) await h.apply(p);
  if (typeof p.onlyadkd === 'boolean' && window.UnifiedOnlyAdkd && window.UnifiedOnlyAdkd.on() !== p.onlyadkd) {
    window.UnifiedOnlyAdkd.set(p.onlyadkd);
  }
  setCurrent(value);
  if (!quiet) hooks.status(`Preset "${name}" (${GEN_LABEL[gen]}) is set. Press Generate & Play to roll a seed with it.`, 'ok');
  return true;
}

async function save() {
  const gen = hooks.gen();
  const cur = current();
  const suggest = cur && own()[cur] ? cur : '';
  let name = window.prompt(`Name this preset (${GEN_LABEL[gen]} with the settings you have now):`, suggest);
  if (name == null) return;
  name = name.trim().slice(0, 60);
  if (!name) { hooks.status('A preset needs a name.', 'bad'); return; }
  const all = own();
  const over = name in all;
  if (over && name !== suggest && !window.confirm(`Replace your preset "${name}"?`)) return;
  const h = hooks.handlers[gen];
  const snap = h ? await h.snapshot() : {};
  const entry = { v: 1, gen, savedAt: new Date().toISOString(), ...snap };
  if (window.UnifiedOnlyAdkd) entry.onlyadkd = !!window.UnifiedOnlyAdkd.on();
  all[name] = entry;
  if (!putAll(all)) { hooks.status('Couldn\'t save the preset: this browser\'s storage is full or blocked.', 'bad'); return; }
  setCurrent(name);
  hooks.status(`${over ? 'Updated' : 'Saved'} preset "${name}" (${GEN_LABEL[gen]}).`, 'ok');
}

function del() {
  const name = $('r-saved').value;
  if (!name || !own()[name]) return;
  if (!window.confirm(`Delete the preset "${name}"?`)) return;
  const all = own();
  delete all[name];
  putAll(all);
  setFavs(favs().filter((v) => v !== name));
  setCurrent('');
  hooks.status(`Deleted preset "${name}".`, 'ok');
}

function downloadJson(obj, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportPresets() {
  const name = $('r-saved').value;
  const all = own();
  if (name && all[name]) {
    downloadJson({ alttprUnifiedPresets: 1, presets: { [name]: all[name] } }, `${name.replace(/[^\w\- ]+/g, '_')}-preset.json`);
  } else if (Object.keys(all).length) {
    downloadJson({ alttprUnifiedPresets: 1, presets: all }, 'alttpr-presets.json');
  } else {
    hooks.status('No presets of your own to export yet.', 'bad');
  }
}

async function importFile(file) {
  let json;
  try { json = JSON.parse(await file.text()); } catch (e) { hooks.status('That file isn\'t a presets file.', 'bad'); return; }
  const base = file.name.replace(/(-settings|-preset)?\.json$/i, '') || 'Imported';
  const all = own();
  if (json && json.alttprUnifiedPresets && json.presets && typeof json.presets === 'object') {
    const names = Object.keys(json.presets).filter((n) => usable(json.presets[n]));
    names.forEach((n) => { all[n] = json.presets[n]; });
    putAll(all);
    if (names.length === 1) await apply(names[0], { quiet: true });
    else paint();
    hooks.status(names.length ? `Imported ${names.length} preset${names.length === 1 ? '' : 's'}${names.length === 1 ? ` ("${names[0]}") and switched to it` : ''}.` : 'No presets in that file.', names.length ? 'ok' : 'bad');
    return;
  }
  // a Save file from alttpr.com's Customizer
  const fromSite = hooks.fromSiteSave ? await hooks.fromSiteSave(json) : null;
  if (fromSite) {
    let name = base, i = 2;
    while (all[name]) name = `${base} (${i++})`;
    all[name] = { v: 1, gen: 'alttpr', savedAt: new Date().toISOString(), useCustomizer: true, fields: fromSite.fields, custom: fromSite.custom };
    putAll(all);
    await apply(name, { quiet: true });
    hooks.status(`Imported alttpr.com customizer settings as the preset "${name}".`, 'ok');
    return;
  }
  hooks.status('That file isn\'t a presets file or an alttpr.com customizer save.', 'bad');
}

/** Wire up the Saved presets field. */
export function init(h) {
  hooks = h;
  $('r-saved').addEventListener('change', async (e) => {
    const v = e.target.value;
    if (!v) { setCurrent(''); return; }
    await apply(v);
  });
  $('r-saved-save').addEventListener('click', save);
  $('r-saved-del').addEventListener('click', del);
  $('r-saved-fav').addEventListener('click', toggleFav);
  $('r-saved-export').addEventListener('click', exportPresets);
  $('r-saved-import').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) await importFile(f);
  });
  paint();
}
