/*
 * seed.js — the "New seed" dialog: your Super Metroid ROM, a DASH preset (or
 * its settings one by one, the way dashrando.net's Generate page offers them)
 * and a seed number in, a DASH seed out. The generator (DASH's own core,
 * bundled) runs in a worker (gen/seed-worker.js); nothing is downloaded but
 * the bundle, and nothing is uploaded.
 */
(function () {
  'use strict';
  const D = window.SMR, E = D.ENUMS;
  const $ = (id) => document.getElementById(id);
  let base = null;            // { bytes: Uint8Array (3 MB, no header), name }
  let last = null;            // { rom, name, meta, spoiler, placed }
  let onPlay = (entry, opts) => {};
  let busy = false;

  // ── the base ROM ─────────────────────────────────────────────────────────
  async function sha256(bytes) {
    const h = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function takeRom(bytes, name, { remember = true } = {}) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('That is a .zip file. Unzip it and pick the ROM inside.');
    if (bytes.length === D.ROM.size + 512) bytes = bytes.slice(512);     // copier header off
    if (bytes.length !== D.ROM.size) throw new Error('That isn’t the right ROM: DASH needs ' + D.ROM.name + ', a 3 MB .sfc / .smc (yours is ' + (bytes.length / 1048576).toFixed(2) + ' MB).');
    let ok = true;
    try { ok = (await sha256(bytes)) === D.ROM.sha256; } catch (e) { ok = true; }
    if (!ok) throw new Error('That ROM isn’t the one DASH wants (' + D.ROM.name + ', the usual (JU) dump, unheadered). A different region, a bad dump or an already-patched copy won’t work.');
    base = { bytes, name };
    if (remember) SMRStore.set('base', { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el = $('base-status');
    if (base) { el.textContent = base.name + ' · ' + D.ROM.name + ' ✓'; el.className = 'msg ok'; }
    else { el.textContent = 'Choose your ' + D.ROM.name + ' ROM (.sfc or .smc, 3 MB). It stays on this device.'; el.className = 'msg'; }
    $('generate').disabled = !base || busy;
  }

  // ── presets and settings ────────────────────────────────────────────────
  // the site's Generate page: a mode (preset) sets every control; touching a control makes it Custom
  const CUSTOM = { id: 'Custom', name: 'Custom', tags: [], settings: null, options: null };
  const presets = D.PRESETS.concat([CUSTOM]);
  const FIELDS = [
    ['item-split', 'Item split', [['standard-mm', 'Major / Minor'], ['chozo', 'Chozo'], ['full', 'Full']], 'Which items shuffle among which spots: majors with majors (the classic way), Chozo items in Chozo statues, or everything anywhere.'],
    ['boss', 'Boss locations', [['vanilla', 'Vanilla'], ['shifted', 'Shifted'], ['shuffled', 'Shuffled'], ['surprise', 'Surprise'], ['scrambled', 'Scrambled']], 'Where the four bosses are. Shifted: moved one along. Shuffled: swapped. Surprise: you find out at the door. Scrambled: anything goes, repeats too.'],
    ['map-layout', 'Map layout', [['standard', 'Vanilla'], ['randomized', 'Area randomization']], 'Area randomization shuffles the doors between the areas.'],
    ['minors', 'Minor item distribution', [['standard', 'Standard, 3:2:1'], ['dash', 'DASH, 2:1:1']], 'Missiles : Supers : Power Bombs.'],
    ['environment', 'Environment updates', [['standard', 'Standard'], ['dash-classic', 'DASH']], 'DASH: the Classic map tweaks (a few rooms changed to open things up).'],
    ['charge-beam', 'Charge Beam', [['vanilla', 'Vanilla'], ['starter', 'Starter'], ['starter-plus', 'Starter+']], 'Starter: you begin with Charge. Starter+: and the Charge spot holds something else.'],
    ['gravity-heat-reduction', 'Gravity heat reduction', [['on', 'On'], ['off', 'Off']], 'Gravity Suit cuts heat damage (on) or not (off).'],
    ['double-jump', 'Double Jump', [['off', 'Off'], ['on', 'On']], 'DASH’s Double Jump is in the item pool.'],
    ['heat-shield', 'Heat Shield', [['off', 'Off'], ['on', 'On']], 'DASH’s Heat Shield (heat protection without Varia) is in the pool.'],
    ['pressure-valve', 'Pressure Valve', [['none', 'Off'], ['one', 'On']], 'DASH’s Pressure Valve (water movement without Gravity) is in the pool.'],
    ['logic', 'Logic', [['standard', 'Standard'], ['relaxed', 'Relaxed']], 'What the seed may expect of you. Relaxed asks for less.'],
    ['bosses-known', 'Bosses known', [['off', 'Off'], ['on', 'On']], 'With shuffled bosses: the map shows who is where.'],
    ['fanfare', 'Item fanfare', [['on', 'On'], ['off', 'Off']], 'The jingle on picking up an item.'],
  ];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function preset() { return presets.find((p) => p.id === $('preset').value) || presets[0]; }
  function val(f) { return $('f-' + f).value; }
  // settings/options ↔ the controls (the site's own mapping)
  function fromPreset(p) {
    const s = p.settings, o = p.options;
    const set = (f, v) => { $('f-' + f).value = v; };
    set('item-split', s.majorDistribution === E.MajorDistributionMode.Full ? 'full' : s.majorDistribution === E.MajorDistributionMode.Chozo ? 'chozo' : 'standard-mm');
    set('boss', { 0: 'vanilla', 1: 'shuffled', 2: 'shifted', 3: 'surprise', 4: 'scrambled' }[s.bossMode] || 'vanilla');
    set('map-layout', s.randomizeAreas ? 'randomized' : 'standard');
    set('minors', s.minorDistribution === E.MinorDistributionMode.Dash ? 'dash' : 'standard');
    set('environment', s.mapLayout === E.MapLayout.Classic ? 'dash-classic' : 'standard');
    set('charge-beam', s.beamMode === E.BeamMode.Starter ? 'starter' : s.beamMode === E.BeamMode.StarterPlus ? 'starter-plus' : 'vanilla');
    set('gravity-heat-reduction', s.gravityHeatReduction === E.GravityHeatReduction.Off ? 'off' : 'on');
    set('double-jump', s.extraItems.includes(E.Item.DoubleJump) ? 'on' : 'off');
    set('heat-shield', s.extraItems.includes(E.Item.HeatShield) ? 'on' : 'off');
    set('pressure-valve', s.extraItems.includes(E.Item.PressureValve) ? 'one' : 'none');
    set('logic', o.RelaxedLogic ? 'relaxed' : 'standard');
    set('bosses-known', o.BossesKnown ? 'on' : 'off');
    set('fanfare', o.DisableFanfare ? 'off' : 'on');
  }
  function toSettings() {
    const extra = [];
    if (val('double-jump') === 'on') extra.push(E.Item.DoubleJump);
    if (val('heat-shield') === 'on') extra.push(E.Item.HeatShield);
    if (val('pressure-valve') === 'one') extra.push(E.Item.PressureValve);
    const settings = {
      mapLayout: val('environment') === 'dash-classic' ? E.MapLayout.Classic : E.MapLayout.Standard,
      majorDistribution: val('item-split') === 'full' ? E.MajorDistributionMode.Full : val('item-split') === 'chozo' ? E.MajorDistributionMode.Chozo : E.MajorDistributionMode.Standard,
      minorDistribution: val('minors') === 'dash' ? E.MinorDistributionMode.Dash : E.MinorDistributionMode.Standard,
      extraItems: extra,
      beamMode: val('charge-beam') === 'starter' ? E.BeamMode.Starter : val('charge-beam') === 'starter-plus' ? E.BeamMode.StarterPlus : E.BeamMode.Vanilla,
      suitMode: E.SuitMode.Dash,
      gravityHeatReduction: val('gravity-heat-reduction') === 'off' ? E.GravityHeatReduction.Off : E.GravityHeatReduction.On,
      randomizeAreas: val('map-layout') === 'randomized',
      bossMode: { vanilla: 0, shuffled: 1, shifted: 2, surprise: 3, scrambled: 4 }[val('boss')] || 0,
    };
    const options = { DisableFanfare: val('fanfare') === 'off', RelaxedLogic: val('logic') === 'relaxed', Mystery: false, Spoiler: false, BossesKnown: val('bosses-known') === 'on' };
    return { settings, options };
  }
  // the preset whose settings match the controls, if any (the site's findPreset)
  function matchPreset() {
    const { settings: s, options: o } = toSettings();
    return D.PRESETS.find((p) => JSON.stringify([p.settings, p.options.DisableFanfare, p.options.RelaxedLogic, p.options.BossesKnown]) ===
      JSON.stringify([Object.assign({}, p.settings, s), o.DisableFanfare, o.RelaxedLogic, o.BossesKnown]));
  }
  function paintPreset() {
    const p = preset();
    if (p.settings) fromPreset(p);
    else { try { const c = JSON.parse(localStorage.getItem('smr:custom') || 'null'); if (c) FIELDS.forEach((f) => { if (c[f[0]]) $('f-' + f[0]).value = c[f[0]]; }); } catch (e) {} }
    $('preset-about').textContent = p.settings ? 'DASH’s ' + p.name + (p.tags.length ? ' (' + p.tags.join(', ') + ')' : '') : 'Your own settings, below.';
    paintSummary();
  }
  function paintSummary() {
    const m = $('flag-msg');
    const o = {}; FIELDS.forEach((f) => { o[f[0]] = val(f[0]); });
    try { localStorage.setItem('smr:custom', JSON.stringify(o)); } catch (e) {}
    const p = matchPreset();
    m.textContent = p ? 'These are DASH’s ' + p.name + ' settings.' : 'Custom settings.';
    m.className = 'msg';
  }
  function buildFields() {
    $('fields').innerHTML = FIELDS.map((f) => '<label class="field" title="' + esc(f[3]) + '">' + esc(f[1]) + '<select id="f-' + f[0] + '">' + f[2].map((o) => '<option value="' + o[0] + '">' + esc(o[1]) + '</option>').join('') + '</select><small class="fine">' + esc(f[3]) + '</small></label>').join('');
    $('fields').addEventListener('change', () => {
      const p = matchPreset();
      $('preset').value = p ? p.id : 'Custom';
      $('preset-about').textContent = p ? 'DASH’s ' + p.name : 'Your own settings, below.';
      paintSummary();
    });
  }

  // ── seeds ────────────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(1 + (v[0] % 999999)); }

  // ── generating ───────────────────────────────────────────────────────────
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  function generate() {
    if (!base || busy) return Promise.resolve(null);
    const seedText = $('seed').value.trim();
    if (seedText && !/^\d{1,6}$/.test(seedText) || (seedText && (+seedText < 1 || +seedText > 999999))) { setStatus('DASH seeds are a number from 1 to 999999.', 'bad'); return Promise.resolve(null); }
    const { settings, options } = toSettings();
    const p = preset();
    try { localStorage.setItem('smr:preset', p.id); } catch (e) {}
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Starting…', 'busy');
    return new Promise((resolve, reject) => {
      const w = new Worker('gen/seed-worker.js', { type: 'module' });
      const bytes = base.bytes.slice(0);
      const t = setTimeout(() => { w.terminate(); reject(new Error('The generator took too long (2 minutes).')); }, 120000);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'stage') { setStatus(m.text, 'busy'); return; }
        clearTimeout(t); w.terminate();
        if (m.type === 'error') { reject(new Error(m.error)); console.warn('[sm]', m.detail); return; }
        resolve(m);
      };
      w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || 'The generator failed to load.')); };
      w.postMessage({ type: 'gen', rom: bytes, seed: seedText ? +seedText : 0, settings, options, preset: p.settings ? p.id : (matchPreset() || {}).id || 'Custom' }, [bytes.buffer]);
    }).then((m) => {
      const meta = { seed: String(m.seed), hash: m.hash, preset: (p.settings ? p : matchPreset() || CUSTOM).name, settings, options, generator: 'DASH', made: Date.now() };
      last = { rom: new Uint8Array(m.rom), name: m.name, meta, spoiler: m.spoiler || {}, placed: m.placed || [] };
      setStatus('Ready in ' + (m.ms / 1000).toFixed(1) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + m.seed + ' · ' + meta.preset;
      $('result-hash').textContent = m.name;
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    }).catch((e) => {
      setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad');
      throw e;
    }).finally(() => { busy = false; $('generate').disabled = !base; });
  }

  function spoilerText(entry) {
    const s = entry.spoiler || {}, m = entry.meta || {};
    const lines = ['DASH Super Metroid Randomizer', 'Seed ' + m.seed + '  ' + (m.preset || ''), 'File: ' + entry.name, ''];
    for (const sec of Object.keys(s)) {
      lines.push('--- ' + sec + ' ---');
      const v = s[sec] || {};
      for (const k of Object.keys(v)) {
        const x = v[k];
        if (x && typeof x === 'object') { lines.push('  ' + k); for (const kk of Object.keys(x)) lines.push('    ' + kk.padEnd(36) + x[kk]); }
        else lines.push('  ' + k.padEnd(24) + String(x));
      }
      lines.push('');
    }
    return lines.join('\n');
  }
  function download(bytes, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function init(opts) {
    onPlay = (opts && opts.onPlay) || onPlay;
    const dlg = $('seed-dlg');
    const sel = $('preset');
    sel.innerHTML = presets.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
    buildFields();
    try { sel.value = localStorage.getItem('smr:preset') || 'ClassicMM'; } catch (e) {}
    if (!sel.value) sel.value = presets[0].id;
    sel.addEventListener('change', paintPreset);
    paintPreset();
    $('fields-toggle').addEventListener('click', () => { const u = $('fields'); u.hidden = !u.hidden; $('fields-toggle').textContent = u.hidden ? 'Customize settings' : 'Hide the settings'; });
    $('seed').value = '';
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { await takeRom(new Uint8Array(await f.arrayBuffer()), f.name); }
      catch (e) { $('base-status').textContent = e.message; $('base-status').className = 'msg bad'; }
    });
    SMRStore.get('base').then((b) => { if (b && b.bytes && !base) takeRom(new Uint8Array(b.bytes), b.name, { remember: false }).catch(() => {}); });
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-log').addEventListener('click', () => last && download(spoilerText(last), last.name.replace(/\.sfc$/, '_spoiler.txt'), 'text/plain'));
    paintBase();
  }

  window.SMRSeed = {
    init,
    open() { $('seed-dlg').showModal(); },
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
    spoilerText,
  };
})();
