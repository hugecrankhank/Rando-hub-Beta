/*
 * seed.js — the "New seed" dialog: your Super Mario RPG (USA) ROM, a preset
 * or your own flags and a seed in, an Open World Randomizer seed out. The
 * generator (the randomizer's own Python) runs in a worker (gen/seed-worker.js);
 * Python and the generator are only downloaded the first time.
 *
 * The flag builder is the site's: each flag is a letter (K, R, C...), its
 * choices one more letter after it (Cs, Cj...), options too, and the dash
 * flags (-showequips) stand alone. The flag string and the ticks are kept in
 * step both ways, so a pasted race string sets the ticks and ticking rebuilds
 * the string. Flags hidden in the other mode (linear / open) are left out.
 */
(function () {
  'use strict';
  const D = window.SMRPG;
  const $ = (id) => document.getElementById(id);
  let base = null;            // { bytes: Uint8Array (4 MB), name }
  let last = null;            // { rom, name, meta, spoiler }
  let onPlay = (entry, opts) => {};
  let busy = false;
  let mode = 'open';

  // ── the base ROM ─────────────────────────────────────────────────────────
  // MD5 for the check the site makes (the browser has no MD5 of its own).
  function md5(bytes) {
    const K = new Int32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const n = bytes.length, len = ((n + 8) >> 6 << 6) + 64;
    const m = new Uint8Array(len); m.set(bytes); m[n] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(len - 8, (n * 8) >>> 0, true); dv.setUint32(len - 4, Math.floor(n / 536870912), true);
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    const w = new Int32Array(16);
    for (let off = 0; off < len; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4, true);
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
        else { f = c ^ (b | ~d); g = (7 * i) & 15; }
        const s = S[(i >> 4) * 4 + (i & 3)], t = (a + f + K[i] + w[g]) | 0;
        a = d; d = c; c = b; b = (b + ((t << s) | (t >>> (32 - s)))) | 0;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    return [a0, b0, c0, d0].map((x) => { const u = new Uint8Array(4); new DataView(u.buffer).setInt32(0, x, true); return Array.from(u).map((y) => y.toString(16).padStart(2, '0')).join(''); }).join('');
  }
  async function takeRom(bytes, name, { remember = true } = {}) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('That is a .zip file. Unzip it and pick the ROM inside.');
    if (bytes.length === D.ROM.size + 512) bytes = bytes.slice(512);     // copier header off
    if (bytes.length !== D.ROM.size) throw new Error('That isn’t the right ROM: the randomizer needs ' + D.ROM.name + ', a 4 MB .sfc / .smc (yours is ' + (bytes.length / 1048576).toFixed(2) + ' MB).');
    if (md5(bytes) !== D.ROM.md5) throw new Error('That ROM isn’t the one the randomizer wants (' + D.ROM.name + ', unheadered). A different region, a bad dump or an already-patched copy won’t work.');
    base = { bytes, name };
    if (remember) SMRPGStore.set('base', { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el = $('base-status');
    if (base) { el.textContent = base.name + ' · ' + D.ROM.name + ' ✓'; el.className = 'msg ok'; }
    else { el.textContent = 'Choose your ' + D.ROM.name + ' ROM (.sfc or .smc, 4 MB). It stays on this device.'; el.className = 'msg'; }
    $('generate').disabled = !base || busy;
  }

  // ── flags: presets, the string and the builder ──────────────────────────
  const CUSTOM = { id: 'custom', name: 'Custom', about: 'Your own flags: tick them below or paste a flag string from the randomizer site, a race or a friend.', flags: '' };
  const presets = D.PRESETS.concat([CUSTOM]);
  function preset() { return presets.find((p) => p.id === $('preset').value) || presets[0]; }
  function allFlags() { const out = []; D.CATEGORIES.forEach((c) => c.flags.forEach((f) => out.push(f))); return out; }

  // the builder: one row per flag, choices as radios, options as checkboxes, nested
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function flagId(f, parent) { return 'fl-' + (f.value + (parent || '')).replace(/[^A-Za-z0-9@-]/g, '_'); }
  function flagHtml(f, parent, radio, checked) {
    const id = flagId(f, parent), name = radio ? 'fc-' + (parent || '').replace(/[^A-Za-z0-9-]/g, '_') : '';
    const label = f.value.startsWith('@') ? '…' : f.value;
    const sub = f.choices.map((c, i) => flagHtml(c, '-' + f.value + (parent || ''), true, i === 0)).join('') +
      f.options.map((o) => flagHtml(o, '-' + f.value + (parent || ''), false, false)).join('');
    return '<div class="flag' + (f.hard ? ' hard' : '') + '" data-modes="' + esc(f.modes.join(' ')) + '">' +
      '<label class="flag-row"><input type="' + (radio ? 'radio' : 'checkbox') + '" id="' + id + '"' + (name ? ' name="' + name + '"' : '') + (checked ? ' checked' : '') + '>' +
      '<code>' + esc(label) + '</code><span class="flag-name">' + esc(f.name) + '</span></label>' +
      (f.desc ? '<div class="flag-desc">' + esc(f.desc) + '</div>' : '') +
      (sub ? '<div class="flag-sub">' + sub + '</div>' : '') + '</div>';
  }
  function buildFlagUi() {
    $('flag-ui').innerHTML = D.CATEGORIES.map((c) =>
      '<details class="flag-cat"><summary>' + esc(c.name) + '</summary>' + c.flags.map((f) => flagHtml(f, '', false, false)).join('') + '</details>').join('');
    $('flag-ui').addEventListener('change', () => { if (preset().id !== 'custom') { $('preset').value = 'custom'; paintPresetText(); } buildFlagString(); });
  }
  // flag string → ticks (the site's applyFlags)
  function applyFlags(str) {
    $('flag-ui').querySelectorAll('input[type=checkbox]').forEach((i) => { i.checked = false; });
    const tick = (val) => $('flag-ui').querySelectorAll('[id^="' + 'fl-' + val.replace(/[^A-Za-z0-9@-]/g, '_') + '"]').forEach((i) => {
      // only the exact flag (its id continues with the parent chain, which starts with "-")
      const rest = i.id.slice(('fl-' + val.replace(/[^A-Za-z0-9@-]/g, '_')).length);
      if (rest === '' || rest.startsWith('-')) i.checked = true;
    });
    (str || '').trim().split(/\s+/).filter(Boolean).forEach((flag) => {
      if (flag.startsWith('-')) tick(flag);
      else { tick('@' + flag[0]); tick(flag[0]); for (const ch of flag.slice(1)) tick(flag[0] + ch); }
    });
  }
  // ticks → flag string (the site's buildFlagString)
  function part(f, parent, map) {
    const el = $(flagId(f, parent));
    if (!f.modes.includes(mode) || !el || !el.checked) return;
    if (f.value.startsWith('-')) { map.set(f.value, true); return; }
    let ch, rest = '';
    if (f.value.startsWith('@')) { ch = f.value[1]; map.get('@').push(ch); } else { ch = f.value[0]; rest = f.value.slice(1); }
    if (!map.has(ch)) map.set(ch, []);
    if (rest) map.get(ch).push(rest);
    f.choices.forEach((c) => part(c, '-' + f.value + (parent || ''), map));
    f.options.forEach((o) => part(o, '-' + f.value + (parent || ''), map));
  }
  function buildFlagString() {
    const map = new Map(); map.set('@', []);
    allFlags().forEach((f) => part(f, '', map));
    let s = '';
    for (const [k, v] of map) {
      if (k === '@') continue;
      if (k.startsWith('-')) s += k + ' ';
      else if (v.length || !map.get('@').includes(k)) s += k + v.join('') + ' ';
    }
    $('flags').value = s.trim();
    paintFlagMsg();
    try { localStorage.setItem('smrpg:custom-flags', $('flags').value); } catch (e) {}
  }
  function paintPresetText() { const p = preset(); $('preset-about').textContent = p.about; }
  function paintPreset() {
    const p = preset();
    paintPresetText();
    let flags = p.flags;
    if (p.id === 'custom') { try { flags = localStorage.getItem('smrpg:custom-flags') || ''; } catch (e) { flags = ''; } }
    applyFlags(flags); buildFlagString();
  }
  function paintFlagMsg() {
    const s = $('flags').value.trim();
    const m = $('flag-msg');
    if (!s) { m.textContent = 'No flags: a plain ' + mode + ' mode game.'; m.className = 'msg warn'; return; }
    const hard = allFlags().some((f) => f.hard && $(flagId(f, '')) && $(flagId(f, '')).checked);
    m.textContent = s.split(/\s+/).length + ' flags' + (hard ? ' · includes hard options' : '');
    m.className = 'msg';
  }
  function setMode(v) {
    mode = v === 'linear' ? 'linear' : 'open';
    try { localStorage.setItem('smrpg:mode', mode); } catch (e) {}
    $('flag-ui').querySelectorAll('.flag').forEach((el) => { el.hidden = !el.dataset.modes.split(' ').includes(mode); });
    $('flag-ui').querySelectorAll('.flag-cat').forEach((c) => { c.hidden = !c.querySelector('.flag:not([hidden])'); });
    $('mode-about').textContent = mode === 'open' ? 'Open world: Mario’s Pad to begin, the world open, Star Pieces on random bosses; collect them all to open Bowser’s Keep (the way racers play).' : 'Linear: the story in its usual order, with the shuffles you pick.';
    buildFlagString();
  }

  // ── seeds ────────────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(v[0] || 1); }

  // ── generating ───────────────────────────────────────────────────────────
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }

  function generate() {
    if (!base || busy) return Promise.resolve(null);
    const seed = $('seed').value.trim();
    const flags = $('flags').value.trim();
    try { localStorage.setItem('smrpg:preset', preset().id); } catch (e) {}
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Starting…', 'busy');
    return new Promise((resolve, reject) => {
      const w = new Worker('gen/seed-worker.js', { type: 'module' });
      const bytes = base.bytes.slice(0);
      const t = setTimeout(() => { w.terminate(); reject(new Error('The generator took too long (5 minutes).')); }, 300000);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'stage') { setStatus(m.text, 'busy'); return; }
        clearTimeout(t); w.terminate();
        if (m.type === 'error') { reject(new Error(m.error)); console.warn('[smrpg]', m.detail); return; }
        resolve(m);
      };
      w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || 'The generator failed to load.')); };
      w.postMessage({ type: 'gen', rom: bytes, seed, mode, flags }, [bytes.buffer]);
    }).then((m) => {
      const meta = { seed: String(m.seed), hash: m.hash, flags: m.flags, mode: m.mode, version: m.version, character: m.character, fileHash: m.fileHash,
        preset: preset().name, generator: 'SMRPG Open World Randomizer', made: Date.now() };
      last = { rom: new Uint8Array(m.rom), name: 'SMRPG_US_' + m.version + '_' + m.mode + '_' + m.hash + '_' + m.seed + '.sfc', meta, spoiler: m.spoiler || {} };
      setStatus('Ready in ' + (m.ms / 1000).toFixed(1) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + m.seed + ' · ' + (m.mode === 'open' ? 'open world' : 'linear');
      $('result-hash').textContent = (m.fileHash || '') + (m.character ? ' · ' + m.character + ' on the file select' : '');
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
    const lines = ['Super Mario RPG Open World Randomizer ' + (m.version || ''), 'Seed ' + m.seed + '  mode ' + m.mode + '  hash ' + (m.hash || ''), 'Flags: ' + (m.flags || ''), 'File select: ' + (m.fileHash || '') + (m.character ? ' (' + m.character + ')' : ''), ''];
    for (const sec of Object.keys(s)) {
      lines.push('--- ' + sec + ' ---');
      const v = s[sec];
      for (const k of Object.keys(v || {})) {
        const x = v[k];
        lines.push('  ' + k.padEnd(28) + (x && typeof x === 'object' ? Object.keys(x).map((kk) => kk + ': ' + x[kk]).join(', ') : String(x)));
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
    sel.innerHTML = presets.map((p) => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('');
    buildFlagUi();
    try { sel.value = localStorage.getItem('smrpg:preset') || 'casual'; } catch (e) {}
    if (!sel.value) sel.value = presets[0].id;
    sel.addEventListener('change', paintPreset);
    try { mode = localStorage.getItem('smrpg:mode') || 'open'; } catch (e) {}
    $('mode').value = mode;
    $('mode').addEventListener('change', () => setMode($('mode').value));
    // a pasted or edited string: once you leave the box, the ticks follow it and it's tidied
    $('flags').addEventListener('change', () => { sel.value = 'custom'; paintPresetText(); applyFlags($('flags').value); buildFlagString(); });
    $('flags').addEventListener('input', paintFlagMsg);
    $('flags-toggle').addEventListener('click', () => { const u = $('flag-ui'); u.hidden = !u.hidden; $('flags-toggle').textContent = u.hidden ? 'Customize flags' : 'Hide the flag list'; });
    setMode(mode);
    paintPreset();
    $('seed').value = '';
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { await takeRom(new Uint8Array(await f.arrayBuffer()), f.name); }
      catch (e) { $('base-status').textContent = e.message; $('base-status').className = 'msg bad'; }
    });
    SMRPGStore.get('base').then((b) => { if (b && b.bytes && !base) takeRom(new Uint8Array(b.bytes), b.name, { remember: false }).catch(() => {}); });
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-log').addEventListener('click', () => last && download(spoilerText(last), last.name.replace(/\.sfc$/, '_spoiler.txt'), 'text/plain'));
    paintBase();
  }

  window.SMRPGSeed = {
    init,
    open() { $('seed-dlg').showModal(); },
    // Roll with the current settings and a fresh seed, then play (the hub's reroll)
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
    spoilerText,
  };
})();
