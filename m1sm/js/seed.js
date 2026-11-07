/*
 * seed.js — M1SM's "New seed" dialog: your two ROMs (Super Metroid (Japan,
 * USA), as DASH asks, and Metroid (USA)), a DASH preset, how many items trade
 * games, the goal, the way back and a seed in; the Super Metroid ROM and the
 * Metroid ROM out (js/gen.js). The ROMs the Super Metroid / SMZ3 / Rando Cross
 * and Zelda 1 + Metroid pages were given are already here (the same browser
 * storage). Nothing is uploaded.
 */
(function () {
  'use strict';
  const ZG = window.ZMGen, SM = window.SMR;
  const $ = (id) => document.getElementById(id);
  const base = { sm: null, m1: null };
  const LABEL = { sm: 'Super Metroid (Japan, USA): 3 MB .sfc', m1: 'Metroid (USA): .nes' };
  let last = null, onPlay = () => {}, busy = false;
  const gen = () => new Promise((res) => { (function wait() { if (window.M1SMGen) res(window.M1SMGen); else setTimeout(wait, 50); })(); });

  async function sha256(b) { const h = await crypto.subtle.digest('SHA-256', b); return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join(''); }
  async function identify(bytes) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('that is a .zip file: unzip it and pick the ROM inside');
    const nes = ZG.normalize(bytes);
    if (nes) { if (nes.kind !== 'm1') throw new Error('that’s The Legend of Zelda: this page wants Metroid'); return ['m1', nes.bytes]; }
    let b = bytes.length % 1024 === 512 ? bytes.slice(512) : bytes;
    if (b.length === SM.ROM.size && await sha256(b) === SM.ROM.sha256) return ['sm', b];
    throw new Error('not one of the two ROMs (another version or a randomized copy won’t do)');
  }
  // where the other pages keep them: Super Metroid's page ('base'), SMZ3 / Rando Cross ('base-sm'), Zelda 1 + Metroid ('base-m1')
  async function takeRom(bytes, name, remember) {
    const [k, b] = await identify(bytes);
    base[k] = { bytes: b, name };
    if (remember !== false) (k === 'sm' ? SMRStore.set('base', { bytes: b.buffer.slice(0), name }) : ZMStore.set('base-m1', { bytes: b.buffer.slice(0), name })).catch(() => {});
    paintBase();
  }
  function paintBase() {
    ['sm', 'm1'].forEach((k) => {
      const el = $('base-' + k);
      if (base[k]) { el.textContent = '✓ ' + LABEL[k].replace(/:.*/, '') + ' · ' + base[k].name; el.className = 'msg ok'; }
      else { el.textContent = LABEL[k] + ' (still needed)'; el.className = 'msg'; }
    });
    $('generate').disabled = !(base.sm && base.m1) || busy;
  }

  // ── settings ─────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sel = (key, label, values, def) => '<label class="field">' + esc(label) + '<select data-k="' + key + '">' +
    values.map((v) => '<option value="' + esc(v[0]) + '"' + (v[0] === def ? ' selected' : '') + '>' + esc(v[1]) + (v[0] === def ? ' (default)' : '') + '</option>').join('') + '</select></label>';
  async function buildOptions() {
    const G = await gen();
    const presets = SM.PRESETS.filter((p) => p.id !== 'Custom').map((p) => [p.id, p.name]);
    $('fields').innerHTML = sel('preset', 'Super Metroid (DASH preset)', presets, 'ClassicMM') + sel('mix', 'Items that change games', G.MIX, 'some') +
      sel('goal', 'Goal', G.GOALS, 'both') + sel('exits', 'Back to Crateria from Metroid', G.EXITS, 'anywhere');
    try { setOptions(JSON.parse(localStorage.getItem('m1sm:settings') || '{}')); } catch (e) {}
    $('fields').addEventListener('change', saveOptions);
  }
  function options() { const o = {}; $('fields').querySelectorAll('select[data-k]').forEach((s) => { o[s.dataset.k] = s.value; }); return o; }
  function setOptions(o) { if (!o) return; $('fields').querySelectorAll('select[data-k]').forEach((s) => { if (o[s.dataset.k] !== undefined && Array.from(s.options).some((x) => x.value === o[s.dataset.k])) s.value = o[s.dataset.k]; }); }
  function saveOptions() { try { localStorage.setItem('m1sm:settings', JSON.stringify(options())); } catch (e) {} }

  // ── generating ───────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(v[0] % 1000000 + 1); }
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  async function generate() {
    if (!(base.sm && base.m1) || busy) return null;
    const typed = $('seed').value.trim();
    if (typed && !(/^\d{1,7}$/.test(typed) && +typed >= 1 && +typed <= 1000000)) { setStatus('A seed is a number from 1 to 1000000.', 'bad'); return null; }
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing both Zebes…', 'busy');
    try {
      const G = await gen();
      await new Promise((r) => setTimeout(r, 30));
      const t0 = performance.now(), o = options(), P = SM.PRESETS.find((p) => p.id === o.preset) || SM.PRESETS[0];
      let r = null, err = null;
      for (let t = 0; t < (typed ? 1 : 6) && !r; t++) {
        try { r = await G.generate({ sm: base.sm.bytes, m1: base.m1.bytes, seed: typed ? +typed : +randomSeed(), preset: P.name, settings: P.settings, options: P.options, mix: o.mix, goal: o.goal, exits: o.exits }); }
        catch (e) { err = e; console.warn('[m1sm]', e); }
      }
      if (!r) throw err || new Error('no seed');
      r.meta.summary = P.name + ' · ' + (G.MIX.find((m) => m[0] === o.mix) || ['', ''])[1].replace(/:.*/, '') + ' items trade games';
      last = { rom: r.rom, m1: r.m1, name: 'm1sm-' + r.seed, meta: r.meta };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + r.seed + ' · ' + r.meta.summary + ' (' + r.meta.trades + ' traded). The way into Metroid: ' + G.PORTAL.name + ', ' + G.PORTAL.how + '.';
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    } catch (e) {
      console.error('[m1sm]', e);
      setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad');
      throw e;
    } finally { busy = false; paintBase(); }
  }
  function download(bytes, name, type) {
    if (window.RHSaveFile && !type) { window.RHSaveFile(bytes, name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function init(opts) {
    onPlay = (opts && opts.onPlay) || onPlay;
    const dlg = $('seed-dlg');
    buildOptions();
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const files = Array.from(ev.target.files || []); ev.target.value = '';
      const msgs = [];
      for (const f of files) { try { await takeRom(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { msgs.push(f.name + ': ' + e.message); } }
      $('base-msg').textContent = msgs.join(' '); $('base-msg').className = 'msg ' + (msgs.length ? 'bad' : '');
    });
    const tryStored = (st, key) => st.get(key).then((b) => (b && b.bytes ? takeRom(new Uint8Array(b.bytes), b.name, false).catch(() => {}) : null)).catch(() => {});
    tryStored(SMRStore, 'base').then(() => { if (!base.sm) tryStored(SMZ3Store, 'base-sm'); });
    tryStored(ZMStore, 'base-m1');
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name + '.sfc'));
    $('dl-m1').addEventListener('click', () => last && download(last.m1, last.name + '-metroid.nes'));
    $('dl-spoiler').addEventListener('click', () => last && download(new TextEncoder().encode(last.meta.spoiler), last.name + '-spoiler.txt', 'text/plain'));
    paintBase();
  }

  window.M1SMSeed = {
    init,
    open() { if (!$('seed-dlg').open) $('seed-dlg').showModal(); },
    hasRom() { return !!(base.sm && base.m1); },   // a reroll that lands here waits for it (../roll-games.js landed)
    reroll() { $('seed').value = ''; if (!$('seed-dlg').open) $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
  };
})();
