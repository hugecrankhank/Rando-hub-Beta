// AVIANART in the Randomizer bar: what Generate & Play rolls (one of its
// presets, or your own settings) and the four customizer tabs, Items,
// Entrances, Dungeons and Enemizer, with the same settings as AVIANART's own
// customizer (avianart-settings.js).

import { AVIAN_SETTINGS } from './avianart-settings.js';

const LS_SOURCE = 'unified-avianart-source';   // { kind: 'preset', id } | { kind: 'custom' }
const LS_VALUES = 'unified-avianart-custom-values';
// shown once, as the bar's Race option (it applies to presets too)
const HIDDEN = new Set(['race']);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const ITEMS = [];
AVIAN_SETTINGS.tabs.forEach((t) => t.groups.forEach((g) => g.items.forEach((it) => { if (!HIDDEN.has(it.id)) ITEMS.push({ ...it, tab: t.tab }); })));
const byId = new Map(ITEMS.map((it) => [it.id, it]));

// a setting's default, as the value its control holds (selects hold strings)
const defOf = (it) => (it.type === 'checkbox' ? !!it.default : it.default == null ? String((it.options || [[''],])[0][0]) : String(it.default));
export function defaults() { const o = {}; ITEMS.forEach((it) => { o[it.id] = defOf(it); }); return o; }

let values = { ...defaults(), ...(lsGet(LS_VALUES, {}) || {}) };
let source = lsGet(LS_SOURCE, null) || { kind: 'preset', id: 'crosskeys' };
let onChange = () => {};
let labelFor = (id) => id;
let openTab = null;

export { ITEMS };
export const getSource = () => source;
export const getValues = () => ({ ...values });

/**
 * Your settings the way AVIANART's own customizer sends them (seen in its
 * request): by the GUI's setting names (worldstate, dungeondoorshuffle…),
 * every value a string, ticked boxes as "true" and unticked ones left out,
 * and branch null (its default build).
 */
export function customSettings({ race = false } = {}) {
  const out = {};
  ITEMS.forEach((it) => {
    const v = values[it.id];
    if (it.type === 'checkbox') { if (v) out[it.id] = 'true'; }
    else out[it.id] = String(v);
  });
  if (race) out.race = 'true';
  out.branch = null;
  return out;
}

/** A short description of what Generate & Play will roll. */
export function describe() {
  if (source.kind === 'custom') {
    const changed = ITEMS.filter((it) => values[it.id] !== defOf(it)).length;
    return `your own settings (${changed ? `${changed} changed from the defaults` : 'all defaults'})`;
  }
  return `${labelFor(source.id)} (AVIANART preset)`;
}

function paintSource() {
  const el = $('r-avian-desc');
  if (el) el.innerHTML = `Generate &amp; Play rolls <b>${esc(describe())}</b>.`
    + (source.kind === 'custom'
      ? ' Pick a preset in Saved presets to roll one of AVIANART\'s instead.'
      : ' Change anything in the tabs to roll your own settings instead.');
  document.querySelectorAll('#r-avian-tabs [data-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === openTab);
    b.setAttribute('aria-expanded', String(b.dataset.tab === openTab));
  });
  const badge = $('r-avian-mode');
  if (badge) { badge.textContent = source.kind === 'custom' ? 'Custom' : 'Preset'; badge.classList.toggle('on', source.kind === 'custom'); }
}

export function setSource(s, { quiet = false } = {}) {
  source = s && s.kind === 'custom' ? { kind: 'custom' } : { kind: 'preset', id: String((s && s.id) || 'crosskeys').toLowerCase() };
  lsSet(LS_SOURCE, source);
  paintSource();
  if (!quiet) onChange();
}

export function setValues(v) {
  values = { ...defaults(), ...(v || {}) };
  lsSet(LS_VALUES, values);
  if (openTab) renderTab(openTab);
  paintSource();
}

function renderTab(tab) {
  const panel = $('r-avian-panel');
  const t = AVIAN_SETTINGS.tabs.find((x) => x.tab === tab);
  if (!t) { panel.hidden = true; return; }
  const cell = (it) => {
    const tip = it.help ? ` title="${esc(it.help)}"` : '';
    if (it.type === 'checkbox') {
      return `<label class="av-check"${tip}><input type="checkbox" data-av="${esc(it.id)}"${values[it.id] ? ' checked' : ''}> ${esc(it.label.trim())}</label>`;
    }
    const opts = (it.options || []).map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(values[it.id]) ? ' selected' : ''}>${esc(l)}</option>`).join('');
    return `<label class="f"${tip}>${esc(it.label.trim())}<select data-av="${esc(it.id)}">${opts}</select></label>`;
  };
  const items = (g) => g.items.filter((it) => !HIDDEN.has(it.id));
  panel.innerHTML = `<div class="av-head"><b>${esc(t.label)}</b>`
    + '<span>Your own AVIANART settings. Changing any of them makes Generate &amp; Play roll them.</span>'
    + '<button type="button" class="linkish" id="r-avian-reset">Reset all tabs to defaults</button></div>'
    + t.groups.map((g) => {
      const list = items(g);
      if (!list.length) return '';
      const checks = list.filter((it) => it.type === 'checkbox'), rest = list.filter((it) => it.type !== 'checkbox');
      return `<div class="av-group">${rest.map(cell).join('')}${checks.length ? `<div class="av-checks">${checks.map(cell).join('')}</div>` : ''}</div>`;
    }).join('')
    + `<p class="hint">Settings from the Door Randomizer ${esc(AVIAN_SETTINGS.meta.version)} (the build AVIANART runs). Hover a setting for what it does.</p>`;
  panel.hidden = false;
}

function show(tab) {
  openTab = openTab === tab ? null : tab;
  if (openTab) renderTab(openTab); else $('r-avian-panel').hidden = true;
  paintSource();
}

/** Build the tab buttons and their panel. names: preset id -> its name. */
export function init({ changed, nameOf }) {
  onChange = changed || onChange;
  labelFor = nameOf || labelFor;
  const tabs = $('r-avian-tabs');
  tabs.innerHTML = AVIAN_SETTINGS.tabs.map((t) => `<button type="button" data-tab="${t.tab}" aria-expanded="false" aria-controls="r-avian-panel">${esc(t.label)}</button>`).join('');
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  const panel = $('r-avian-panel');
  panel.addEventListener('change', (e) => {
    const el = e.target.closest('[data-av]');
    if (!el) return;
    const it = byId.get(el.dataset.av);
    if (!it) return;
    values[it.id] = el.type === 'checkbox' ? el.checked : el.value;
    lsSet(LS_VALUES, values);
    if (source.kind !== 'custom') setSource({ kind: 'custom' });
    else { paintSource(); onChange(); }
  });
  panel.addEventListener('click', (e) => {
    if (!e.target.closest('#r-avian-reset')) return;
    if (!window.confirm('Put every AVIANART tab back to its default?')) return;
    setValues(defaults());
    onChange();
  });
  paintSource();
}

export const repaint = paintSource;
