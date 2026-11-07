/*
 * zora-form.js — the seed dialog's Zelda 1 choice: Rando Hub's own (its 17 spots shared), or
 * ZORA with every Z1R option (dungeon shapes, overworld, caves, shops, monsters, start items...):
 * a preset, the flag strings, the Z1R page's last flags, and every option in tabs, as on the Z1R
 * page (the same ZORA, js/zora.js, answering for its form). What ZORA's multiworld doesn't offer
 * yet (an option a shared seed can't use) is said, and stops Generate.
 *
 *   Z1Z3ZoraForm.init(onChange)
 *   Z1Z3ZoraForm.mode                'hub' | 'zora'
 *   Z1Z3ZoraForm.value               { flags, zoraFlags } (ZORA mode), or null
 *   Z1Z3ZoraForm.problem             why it can't generate now, or ''
 *   Z1Z3ZoraForm.summary             a few words for the seed's summary
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Z = () => window.Z1Z3Zora;
  let metadata = null, tabs = {}, form = null, zoraState = null, refused = [], loading = null, mode = 'hub', onChange = () => {}, activeTab = null;

  const plain = (t) => {
    if (!t) return '';
    if (typeof t === 'object') t = t.message || t.reason || JSON.stringify(t);
    const labels = new Map((metadata ? metadata.fields : []).map((f) => [f.id, f.label]));
    return String(t).replace(/<[^>]+>/g, '').replace(/\b([BC]\d\d) \(([^)]+)\)/g, '$2').replace(/\b[BC]\d\d\b/g, (id) => labels.get(id) || 'this setting');
  };
  function saved() { try { return JSON.parse(localStorage.getItem('z1z3:zora') || '{}'); } catch (e) { return {}; } }
  function keep() { try { localStorage.setItem('z1z3:zora', JSON.stringify({ flags: form && form.flags, zoraFlags: zoraFlags() })); } catch (e) {} }
  const zoraFlags = () => (zoraState && zoraState.ok ? zoraState.flags : '');
  function msg(t, cls) { const m = $('zora-msg'); m.textContent = t || ''; m.className = 'msg ' + (cls || ''); }

  function load() {
    if (loading) return loading;
    msg('Starting ZORA (the Z1R page’s randomizer)… the first time takes a little while.', 'busy');
    loading = (window.Z1Z3Zora ? Promise.resolve() : new Promise((r) => { (function w() { if (window.Z1Z3Zora) r(); else setTimeout(w, 50); })(); }))
      .then(() => Z().ready()).then(async (r) => {
        metadata = r.metadata; tabs = r.tabs || {};
        const sel = $('zora-preset');
        sel.innerHTML = metadata.presets.filter((p) => p.available).map((p) => '<option>' + p.label.replace(/</g, '&lt;') + '</option>').join('') + '<option value="">Custom flags</option>';
        const s = saved();
        await setFlags(s.flags || metadata.defaultFlags, s.zoraFlags || '');
      }).catch((e) => { loading = null; msg('ZORA couldn’t start: ' + (e && e.message || e) + '. Check your connection and try again.', 'bad'); onChange(); });
    return loading;
  }
  async function setFlags(flags, zf) {
    const { state } = await Z().ask('state', { flags, zoraFlags: zf || '' });
    await show(state);
  }
  async function show(state) {
    if (!state.ok) { msg(plain(state.error || 'Those flags could not be read.'), 'bad'); onChange(); return; }
    form = state; zoraState = state.zora;
    $('zora-flags').value = state.flags; $('zora-zflags').value = zoraFlags();
    const p = metadata.presets.find((x) => x.available && x.flags === state.flags && (x.zoraFlags || '') === zoraFlags());
    $('zora-preset').value = p ? p.label : '';
    const notes = [].concat(state.refusals || [], state.adjustments || []).map(plain);
    if (zoraState && !zoraState.ok) notes.push(plain(zoraState.error));
    if (state.blockedChange) notes.unshift('That change was not allowed and was undone: ' + plain(state.blockedChange));
    // what a shared seed always needs, and what ZORA's multiworld doesn't offer yet
    const c = (await Z().ask('check', { flags: state.flags, zoraFlags: zoraFlags() })).check;
    refused = (c.refused || []).map(plain);
    if (refused.length) notes.push('Not possible in a shared seed yet: ' + refused.join('; ') + '.');
    notes.push('Shared seeds always shuffle items fully (Item Shuffle: Full), and the way back from Zelda 1 is ⇄ / P (ZORA moves the caves).');
    msg(notes.join(' '), refused.length ? 'bad' : '');
    if ($('zora-editor').open) render();
    keep(); onChange();
  }

  function render() {
    if (!metadata || !form) return;
    const names = [];
    metadata.fields.forEach((f) => { const t = (tabs[f.id] && tabs[f.id].tab) || 'Other'; if (names.indexOf(t) < 0) names.push(t); });
    const zt = metadata.zora && metadata.zora.fields ? (metadata.zora.tab || 'ZORA extras') : null;
    if (zt) names.push(zt);
    if (!activeTab || names.indexOf(activeTab) < 0) activeTab = names[0];
    const bar = $('zora-tabs'); bar.innerHTML = '';
    names.forEach((t) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(t === activeTab));
      b.onclick = () => { activeTab = t; render(); };
      bar.append(b);
    });
    const box = $('zora-fields'); box.innerHTML = '';
    const isZ = activeTab === zt;
    const fields = isZ ? metadata.zora.fields : metadata.fields.filter((f) => ((tabs[f.id] && tabs[f.id].tab) || 'Other') === activeTab);
    fields.forEach((f) => {
      const id = isZ ? f.name : f.id, st = isZ ? null : form.fields[id];
      if (!isZ && !st) return;
      const row = document.createElement('label'); row.className = 'field';
      const help = isZ ? f.help : tabs[f.id] && tabs[f.id].help; if (help) row.title = help;
      row.append(document.createTextNode(f.label));
      const sel = document.createElement('select'); sel.dataset.id = id;
      const sup = f.supportedValues ? new Set(f.supportedValues) : null;
      f.values.forEach((v) => {
        const o = document.createElement('option'); o.value = String(v.value); o.textContent = v.label;
        if ((st && st.blocked && st.blocked[String(v.value)]) || (sup && !sup.has(v.value))) { o.disabled = true; o.textContent += ' (unavailable)'; }
        sel.append(o);
      });
      sel.value = String(isZ ? (zoraState && zoraState.ok ? zoraState.values[id] : 0) : st.value);
      if (st && st.disabled) sel.disabled = true;
      sel.onchange = () => (isZ ? zoraChanged() : fieldChanged());
      row.append(sel); box.append(row);
    });
  }
  async function fieldChanged() {
    const values = {};
    Object.entries(form.fields).forEach(([id, st]) => { values[id] = String(st.value); });
    $('zora-fields').querySelectorAll('select').forEach((s) => { values[s.dataset.id] = s.value; });
    const { state } = await Z().ask('change', { previous: form.flags, values, zoraFlags: zoraFlags() });
    show(state);
  }
  async function zoraChanged() {
    const zv = Object.assign({}, zoraState && zoraState.ok ? zoraState.values : {});
    $('zora-fields').querySelectorAll('select').forEach((s) => { zv[s.dataset.id] = +s.value; });
    const { state } = await Z().ask('zoraChange', { flags: form.flags, zoraValues: zv });
    show(state);
  }

  function setMode(m) {
    mode = m === 'zora' ? 'zora' : 'hub';
    $('z1-mode').value = mode; $('zora-box').hidden = mode !== 'zora';
    try { localStorage.setItem('z1z3:z1mode', mode); } catch (e) {}
    if (mode === 'zora') load();
    onChange();
  }

  function init(cb) {
    onChange = cb || onChange;
    let m = 'hub'; try { m = localStorage.getItem('z1z3:z1mode') || 'hub'; } catch (e) {}
    $('z1-mode').addEventListener('change', () => setMode($('z1-mode').value));
    $('zora-preset').addEventListener('change', () => { const p = metadata && metadata.presets.find((x) => x.label === $('zora-preset').value); if (p) setFlags(p.flags, p.zoraFlags || ''); });
    $('zora-flags').addEventListener('change', () => setFlags($('zora-flags').value.trim(), $('zora-zflags').value.trim()));
    $('zora-zflags').addEventListener('change', () => setFlags($('zora-flags').value.trim(), $('zora-zflags').value.trim()));
    $('zora-editor').addEventListener('toggle', () => { if ($('zora-editor').open) render(); });
    $('zora-z1r').addEventListener('click', () => {
      let s = null; try { s = JSON.parse(localStorage.getItem('z1ru:flags') || 'null'); } catch (e) {}
      if (!s || !s.flags) { msg('No flags from the Z1R page in this browser yet: roll a seed there once, or paste its flags here.', 'warn'); return; }
      setFlags(s.flags, s.zoraFlags || '');
    });
    setMode(m);
  }

  window.Z1Z3ZoraForm = {
    init,
    ready() { return mode === 'zora' ? load() : Promise.resolve(); },   // (a reroll before ZORA has started waits for it)
    get mode() { return mode; },
    get value() { return mode === 'zora' && form ? { flags: form.flags, zoraFlags: zoraFlags() } : null; },
    get problem() {
      if (mode !== 'zora') return '';
      if (!form) return 'ZORA is still starting.';
      if (refused.length) return 'Those Zelda 1 flags can’t be used in a shared seed yet (see Zelda 1).';
      return '';
    },
    get summary() {
      if (mode !== 'zora' || !form) return '';
      const p = metadata.presets.find((x) => x.available && x.flags === form.flags && (x.zoraFlags || '') === zoraFlags());
      return 'Zelda 1 by ZORA: ' + (p ? p.label : 'flags ' + form.flags + (zoraFlags() ? ' ' + zoraFlags() : ''));
    },
  };
})();
