/*
 * seed.js — the "New seed" dialog: your base ROM, ZORA flags and a seed
 * number in, a randomized ROM out. ZORA runs in a worker (zora/seed-worker.js)
 * and is only downloaded the first time the dialog opens.
 */
(function () {
  'use strict';

  const PYODIDE_VERSION = '0.28.3';
  const $ = (id) => document.getElementById(id);
  let worker = null, ready = null, metadata = null, tabs = {};
  let nextId = 1;
  const pending = new Map();
  let base = null;          // {bytes: Uint8Array, name, identity}
  let form = null;          // last form state from ZORA
  let zoraState = null;
  let last = null;          // last generated {rom, name, meta}
  let onPlay = () => {};
  let busy = false;

  // ── worker plumbing ──────────────────────────────────────────────────────
  function ask(type, fields, transfer) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(Object.assign({ type, id }, fields), transfer || []);
    });
  }
  function startWorker() {
    if (ready) return ready;
    setStatus('Loading the randomizer… the first time takes a little while.', 'busy');
    worker = new Worker('zora/seed-worker.js', { type: 'module' });
    ready = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { metadata = m.metadata; tabs = m.tabs || {}; resolve(); return; }
        const p = pending.get(m.id);
        if (!p) { if (m.type === 'error') reject(new Error(m.message)); return; }
        pending.delete(m.id);
        if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m);
      };
      worker.onerror = (e) => reject(new Error(e.message || 'The randomizer failed to load.'));
    });
    fetch('zora/wheel.json').then((r) => r.json()).then((w) => {
      worker.postMessage({ type: 'init', pyodideVersion: PYODIDE_VERSION,
        wheelUrl: new URL('zora/' + w.wheel, location.href).href,
        tabsUrl: new URL('zora/flag-tabs.json', location.href).href });
    }).catch((e) => { setStatus('Could not load the randomizer: ' + e.message, 'bad'); });
    ready.then(afterReady, (e) => {
      ready = null; worker = null;
      setStatus('Could not load the randomizer (' + e.message + '). Check your connection and reopen this dialog.', 'bad');
    });
    return ready;
  }

  async function afterReady() {
    $('zora-version').textContent = 'ZORA ' + metadata.version;
    const sel = $('preset');
    sel.innerHTML = '';
    metadata.presets.filter((p) => p.available).forEach((p) => {
      const o = document.createElement('option');
      o.value = p.label; o.textContent = p.label; sel.append(o);
    });
    const custom = document.createElement('option');
    custom.value = ''; custom.textContent = 'Custom flags'; sel.append(custom);
    const saved = readSaved();
    await loadFlags(saved.flags || metadata.defaultFlags, saved.zoraFlags || '');
    if (base) await identifyBase();
    updateButton();
  }

  // ── base ROM ─────────────────────────────────────────────────────────────
  async function loadBaseFromStore() {
    const b = await Z1Store.get('baseRom');
    if (b && b.bytes) { base = { bytes: new Uint8Array(b.bytes), name: b.name, identity: null }; paintBase(); }
  }
  async function identifyBase() {
    if (!base || !worker) return;
    const { identity } = await ask('identify', { bytes: base.bytes });
    base.identity = identity;
    paintBase(); updateButton();
  }
  function paintBase() {
    const s = $('base-status');
    if (!base) { s.textContent = 'Pick your own Legend of Zelda (USA) ROM file. It stays on this device.'; s.className = 'msg'; return; }
    if (!base.identity) { s.textContent = base.name + ' — checking…'; s.className = 'msg'; return; }
    if (base.identity.recognized) {
      s.textContent = base.name + ' — ' + base.identity.revision + (base.identity.modifiedGraphics ? ', custom graphics' : '') + ', ready.';
      s.className = 'msg ok';
    } else {
      s.textContent = base.name + ': ' + base.identity.message;
      s.className = 'msg bad';
    }
  }
  async function onBasePicked(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) { alert('That is a .zip file. Unzip it and pick the .nes inside.'); return; }
    base = { bytes, name: f.name, identity: null };
    paintBase();
    Z1Store.set('baseRom', { bytes: bytes.buffer.slice(0), name: f.name }).catch(() => {});
    if (worker) await ready.then(identifyBase).catch(() => {});
  }

  // ── flags ────────────────────────────────────────────────────────────────
  function readSaved() { try { return JSON.parse(localStorage.getItem('z1ru:flags') || '{}'); } catch (e) { return {}; } }
  function writeSaved() {
    if (!form) return;
    try { localStorage.setItem('z1ru:flags', JSON.stringify({ flags: form.flags, zoraFlags: zoraState && zoraState.ok ? zoraState.flags : '' })); } catch (e) {}
  }
  const plain = (t) => {
    if (!t) return '';
    if (typeof t === 'object') t = t.message || t.reason || JSON.stringify(t);
    const labels = new Map((metadata ? metadata.fields : []).map((f) => [f.id, f.label]));
    return String(t).replace(/<[^>]+>/g, '')
      .replace(/\b([BC]\d\d) \(([^)]+)\)/g, '$2')
      .replace(/\b[BC]\d\d\b/g, (id) => labels.get(id) || 'this setting')
      .replace(/^not produced: /, 'Not available yet: ');
  };

  // Things ZORA lets through that surprised players (Kallax, Oct 2026): a start
  // item ticked while "Limit on starting items" is "At most 0" (the item is
  // silently dropped), and "Shuffle the overworld monsters" off while the enemy
  // group shuffles are on (the screens' monsters still change).
  const START_ITEMS = [].concat(Array.from({ length: 22 }, (_, i) => 'B' + (57 + i)), ['B85']);
  const label = (id) => { const f = metadata && metadata.fields.find((x) => x.id === id); return f ? f.label : id; };
  function startItemsOn(fields) { return START_ITEMS.filter((id) => fields[id] && +fields[id].value > 0); }
  function limitCuts(fields, n) { const lim = fields.C17 ? +fields.C17.value : 0; return n > 0 && ((lim >= 1 && lim <= 21 && lim - 1 < n) || lim === 22); }
  // The flags are made to agree with what was picked, with a note saying so
  // (contradictory settings were confusing people, Oct 2026):
  //   start items ticked / unticked -> "Limit on starting items" = that many
  //     (a limit lowered by hand on purpose, for a random few, is left alone)
  //   overworld monster shuffle off  -> enemy / overworld group shuffles off too
  //   either group shuffle turned on -> overworld monster shuffle on too
  let limitByHand = false;   // the limit was set lower on purpose: keep it until the start items change
  function harmonize(st, changed) {
    const F = st.fields || {}, values = {}, notes = [], ch = changed || null;
    const on = startItemsOn(F), n = on.length, lim = F.C17 ? +F.C17.value : 0;
    const want = n === 0 ? lim : Math.min(n, 20) + 1;   // value i = "At most i-1"; 0 = all chosen
    const itemsChanged = ch ? ch.some((id) => START_ITEMS.includes(id)) : false;
    if (ch && ch.includes('C17')) limitByHand = true;
    if (itemsChanged) limitByHand = false;
    if (n > 0 && limitByHand && limitCuts(F, n)) {
      notes.push(lim === 22 ? 'A random number (0 to 20) of the ' + n + ' start items ticked will be in each seed.' : (lim - 1) + ' of the ' + n + ' start items ticked will be picked at random for the seed.');
    } else if (n > 0 && want !== lim && (itemsChanged || limitCuts(F, n))) {
      values.C17 = String(want);
      notes.push('Limit on starting items set to ' + n + ' to match the ' + (n > 1 ? n + ' start items' : 'start item') + ' ticked.');
    } else if (n === 0 && itemsChanged && lim !== 1 && lim !== 22) {
      values.C17 = '1'; notes.push('Limit on starting items set back to 0 (no start items ticked).');
    }
    const groups = ['B42', 'B43'].filter((id) => F[id] && +F[id].value > 0);
    const owOff = F.B31 && +F.B31.value === 0;
    if (owOff && groups.length) {
      const turnedOn = ch ? groups.filter((id) => ch.includes(id)) : [];
      if (turnedOn.length && !ch.includes('B31')) {
        values.B31 = '1';
        notes.push('"' + label('B31') + '" turned on too: "' + turnedOn.map(label).join('" and "') + '" ' + (turnedOn.length > 1 ? 'change' : 'changes') + ' the overworld monsters.');
      } else {
        groups.forEach((id) => { values[id] = '0'; });
        notes.push('"' + groups.map(label).join('" and "') + '" turned off too, so the overworld screens keep their usual monsters.');
      }
    }
    return Object.keys(values).length || notes.length ? { values, note: notes.join(' ') } : null;
  }
  async function applyHarmonize(state, changed) {
    const h = harmonize(state, changed); if (!h) return state;
    if (!Object.keys(h.values).length) { state.autoNote = h.note; return state; }
    const values = {};
    Object.entries(state.fields).forEach(([id, st]) => { values[id] = String(st.value); });
    Object.assign(values, h.values);
    const r = await ask('change', { previous: state.flags, values, zoraFlags: zoraState && zoraState.ok ? zoraState.flags : (state.zora && state.zora.ok ? state.zora.flags : '') });
    if (!r.state.ok || r.state.blockedChange) return state;
    r.state.autoNote = h.note;
    return r.state;
  }

  async function loadFlags(flags, zoraFlags) {
    const { state } = await ask('state', { flags, zoraFlags });
    showState(state.ok ? await applyHarmonize(state) : state);
  }
  function showState(state) {
    if (!state.ok) { setFlagMsg(plain(state.error || 'Those flags could not be read.'), 'bad'); updateButton(); return; }
    form = state;
    zoraState = state.zora;
    $('flags').value = state.flags;
    $('zflags').value = zoraState && zoraState.ok ? zoraState.flags : $('zflags').value;
    const preset = metadata.presets.find((p) => p.available && p.flags === state.flags &&
      (p.zoraFlags || '') === (zoraState && zoraState.ok ? zoraState.flags : ''));
    $('preset').value = preset ? preset.label : '';
    const notes = [].concat(state.refusals || [], state.adjustments || []).map(plain);
    if (zoraState && !zoraState.ok) notes.push(plain(zoraState.error));
    if (zoraState && zoraState.conflicts && zoraState.conflicts.length) notes.push(...zoraState.conflicts.map(plain));
    if (state.blockedChange) notes.unshift('That change was not allowed and was undone: ' + plain(state.blockedChange));
    if (state.autoNote) notes.unshift(state.autoNote);
    setFlagMsg(notes.join(' '), state.blockedChange ? 'bad' : notes.length ? 'warn' : '');
    if ($('flag-editor').open) renderEditor();
    writeSaved();
    updateButton();
  }
  function setFlagMsg(t, cls) { const m = $('flag-msg'); m.textContent = t; m.className = 'msg ' + (cls || ''); }

  let activeTab = null;
  function renderEditor() {
    if (!metadata || !form) return;
    const tabNames = [];
    metadata.fields.forEach((f) => { const t = (tabs[f.id] && tabs[f.id].tab) || 'Other'; if (tabNames.indexOf(t) < 0) tabNames.push(t); });
    if (metadata.zora && metadata.zora.fields) tabNames.push(metadata.zora.tab || 'ZORA extras');
    if (!activeTab || tabNames.indexOf(activeTab) < 0) activeTab = tabNames[0];
    const bar = $('flag-tabs');
    bar.innerHTML = '';
    tabNames.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(t === activeTab));
      b.onclick = () => { activeTab = t; renderEditor(); };
      bar.append(b);
    });
    const box = $('flag-fields');
    box.innerHTML = '';
    const isZora = metadata.zora && activeTab === (metadata.zora.tab || 'ZORA extras');
    const fields = isZora ? metadata.zora.fields
      : metadata.fields.filter((f) => ((tabs[f.id] && tabs[f.id].tab) || 'Other') === activeTab);
    fields.forEach((f) => {
      const id = isZora ? f.name : f.id;
      const st = isZora ? null : form.fields[id];
      const cur = isZora ? (zoraState && zoraState.ok ? zoraState.values[id] : 0) : st.value;
      const row = document.createElement('label');
      row.className = 'flag-row';
      const name = document.createElement('span');
      name.textContent = f.label;
      const help = isZora ? f.help : tabs[f.id] && tabs[f.id].help;
      if (help) row.title = help;
      const sel = document.createElement('select');
      sel.dataset.id = id;
      const supported = f.supportedValues ? new Set(f.supportedValues) : null;
      f.values.forEach((v) => {
        const o = document.createElement('option');
        o.value = String(v.value); o.textContent = v.label;
        const blocked = st && st.blocked && st.blocked[String(v.value)];
        if (blocked || (supported && !supported.has(v.value))) { o.disabled = true; o.textContent += ' (unavailable)'; }
        sel.append(o);
      });
      sel.value = String(cur);
      if (st && st.disabled) sel.disabled = true;
      sel.onchange = () => (isZora ? onZoraChange() : onFieldChange());
      row.append(name, sel);
      box.append(row);
    });
  }
  async function onFieldChange() {
    const values = {};
    Object.entries(form.fields).forEach(([id, st]) => { values[id] = String(st.value); });
    $('flag-fields').querySelectorAll('select').forEach((s) => { values[s.dataset.id] = s.value; });
    const changed = Object.keys(values).filter((id) => form.fields[id] && String(form.fields[id].value) !== String(values[id]));
    const { state } = await ask('change', { previous: form.flags, values, zoraFlags: zoraState && zoraState.ok ? zoraState.flags : '' });
    showState(state.ok && !state.blockedChange ? await applyHarmonize(state, changed) : state);
  }
  async function onZoraChange() {
    const zv = Object.assign({}, zoraState && zoraState.ok ? zoraState.values : {});
    $('flag-fields').querySelectorAll('select').forEach((s) => { zv[s.dataset.id] = +s.value; });
    const { state } = await ask('zoraChange', { flags: form.flags, zoraValues: zv });
    showState(state);
  }

  // ── generate ─────────────────────────────────────────────────────────────
  function seedValue() {
    const t = $('seed').value.trim();
    if (!/^\d{1,20}$/.test(t)) return null;
    const v = BigInt(t);
    return v < 2n ** 64n ? v.toString() : null;
  }
  function randomSeed() { $('seed').value = String(crypto.getRandomValues(new Uint32Array(1))[0] || 1); updateButton(); }

  function updateButton() {
    const reasons = [];
    if (!metadata) reasons.push('The randomizer is still loading.');
    if (!base) reasons.push('Choose your Zelda ROM first.');
    else if (base.identity && !base.identity.recognized) reasons.push('That ROM is not one ZORA can use.');
    if (form && form.generateRefusals && form.generateRefusals.length) reasons.push(...form.generateRefusals.map(plain));
    if (!seedValue()) reasons.push('Enter a seed number, or tap Random.');
    $('generate').disabled = busy || reasons.length > 0;
    if (metadata && !busy) setStatus(reasons.join(' '), reasons.length ? 'warn' : '');
  }
  function setStatus(t, cls) { const s = $('gen-status'); s.textContent = t; s.className = 'msg ' + (cls || ''); }

  async function generate() {
    if (busy) return;
    busy = true; updateButton();
    $('result').hidden = true;
    setStatus('Generating seed ' + seedValue() + '…', 'busy');
    try {
      const flags = form.flags, zoraFlags = zoraState && zoraState.ok ? zoraState.flags : '';
      const res = await ask('generate', { bytes: base.bytes, seed: seedValue(), flags, zoraFlags });
      const rom = new Uint8Array(res.rom);
      const meta = { source: 'zora', seed: res.seed, flags: res.flags, zoraFlags: res.zoraFlags, code: res.code,
        version: metadata.version, made: Date.now() };
      const name = 'ZORA_' + res.seed + '.nes';
      last = { rom, name, meta };
      await Z1Store.set('current', { bytes: rom.buffer.slice(0), name, meta }).catch(() => {});
      $('result-code').textContent = (res.code || []).join(', ');
      $('result-seed').textContent = 'Seed ' + res.seed + ', made in ' + (res.ms / 1000).toFixed(1) + ' s';
      $('result').hidden = false;
      setStatus('', '');
      $('play').focus();
    } catch (e) {
      setStatus('Generation failed: ' + plain(e.message) + ' Try another seed number.', 'bad');
    } finally {
      busy = false; updateButton();
    }
  }

  function download(bytes, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function spoiler() {
    if (!last) return;
    try {
      await startWorker();
      const { report } = await ask('report', { bytes: last.rom, seed: last.meta.seed, flags: last.meta.flags, zoraFlags: last.meta.zoraFlags });
      download(report.spoiler, report.spoilerName || ('ZORA_' + last.meta.seed + '_spoiler.txt'), 'text/plain');
    } catch (e) {
      alert('No spoiler log for this seed: ' + plain(e.message));
    }
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function open() {
    const d = $('seed-dlg');
    if (!d.open) d.showModal();
    if (!$('seed').value) randomSeed();
    paintBase();
    startWorker();
    updateButton();
  }

  function init(opts) {
    onPlay = opts.onPlay || onPlay;
    $('base-input').addEventListener('change', onBasePicked);
    $('dice').addEventListener('click', randomSeed);
    $('seed').addEventListener('input', updateButton);
    $('generate').addEventListener('click', generate);
    $('preset').addEventListener('change', () => {
      const p = metadata.presets.find((x) => x.label === $('preset').value);
      if (p) loadFlags(p.flags, p.zoraFlags || '');
    });
    $('flags').addEventListener('change', () => loadFlags($('flags').value.trim(), $('zflags').value.trim()));
    $('zflags').addEventListener('change', () => loadFlags($('flags').value.trim(), $('zflags').value.trim()));
    $('flag-editor').addEventListener('toggle', () => { if ($('flag-editor').open) renderEditor(); });
    $('play').addEventListener('click', () => { if (last) { $('seed-dlg').close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-spoiler').addEventListener('click', spoiler);
    loadBaseFromStore();
  }

  // Free the randomizer (Pyodide holds a lot of memory) once a game is running.
  // iOS kills tabs that use too much memory, which looks like a crash mid-game.
  // It reloads on its own the next time the dialog opens.
  function release() {
    if (!worker || busy) return;
    try { worker.terminate(); } catch (e) {}
    worker = null; ready = null; metadata = null;
    pending.forEach((p) => p.reject(new Error('The randomizer was closed.')));
    pending.clear();
  }

  // Crowd Control's new seeds (js/crowd.js): a new seed number with the
  // flags last used in this dialog (or a random preset's), then straight into it. Resolves with the
  // seed number once it's made; the page then reloads into the new game.
  // opts.mode 'preset' or 'chaos': a random preset's flags instead.
  async function rollAndPlay(opts) {
    const mode = opts && opts.mode;
    if (busy) throw new Error('A seed is already being made');
    if (!base) await loadBaseFromStore();
    if (!base) throw new Error('No base ROM yet: open New seed once and pick your Zelda ROM');
    await startWorker();
    if (!form) { const saved = readSaved(); await loadFlags(saved.flags || metadata.defaultFlags, saved.zoraFlags || ''); }
    if (mode === 'preset' || mode === 'chaos') {
      const list = metadata.presets.filter((p) => p.available);
      if (list.length) { const p = list[Math.floor(Math.random() * list.length)]; await loadFlags(p.flags, p.zoraFlags || ''); }
    }
    randomSeed();
    last = null;
    await generate();
    if (!last) throw new Error(($('gen-status').textContent || 'Generation failed').trim());
    const made = last;
    setTimeout(() => onPlay(made, { noConfirm: true }), 0);
    return made.meta.seed;
  }

  window.Z1Seed = { init, open, release, rollAndPlay };
})();
