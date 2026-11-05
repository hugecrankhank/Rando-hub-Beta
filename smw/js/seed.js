/*
 * seed.js — the "New seed" dialog: your Super Mario World ROM, a preset (or
 * every option one by one) and a seed in, a randomized ROM out.
 *
 * The generator is the SMW Randomizer itself (authorblues + kaizoman666, v2.2,
 * MIT), unchanged, in a hidden frame (gen/gen.html): it reads its options from
 * its own page's inputs, so this dialog sets those and calls its
 * randomizeROM(buffer, seed). Its presets and share codes ("seed/preset", as
 * in its own links: #!/1234abcd/4, or a custom set "x" + hex) work here too.
 * Nothing is uploaded.
 */
(function () {
  'use strict';
  const D = window.SMWD;
  const $ = (id) => document.getElementById(id);
  let base = null;            // { bytes: Uint8Array (512 KB, no header), name }
  let last = null;            // { rom, name, meta }
  let onPlay = (entry, opts) => {};
  let busy = false, frame = null, framePromise = null;

  // ── the generator's frame ───────────────────────────────────────────────
  function gen() {
    if (framePromise) return framePromise;
    framePromise = new Promise((resolve, reject) => {
      frame = document.createElement('iframe');
      frame.src = 'gen/gen.html'; frame.title = 'SMW Randomizer'; frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px';
      const t = setTimeout(() => reject(new Error('The generator didn’t load.')), 20000);
      frame.onload = () => { clearTimeout(t); const w = frame.contentWindow; if (w && typeof w.randomizeROM === 'function') resolve(w); else reject(new Error('The generator didn’t load.')); };
      document.body.appendChild(frame);
    });
    return framePromise;
  }

  // ── the base ROM ─────────────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
  function takeRom(bytes, name, { remember = true } = {}) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('That is a .zip file. Unzip it and pick the ROM inside.');
    if (bytes.length === D.ROM.size + 512) bytes = bytes.slice(512);
    if (bytes.length !== D.ROM.size || crc32(bytes) !== D.ROM.crc32) throw new Error('That isn’t ' + D.ROM.name + ' (512 KB, CRC32 ' + D.ROM.crc32 + '), the ROM the randomizer is made for. A hack, another region or an already-randomized copy won’t do (it can still be played with Play ROM file).');
    base = { bytes, name };
    if (remember) SMWStore.set('base', { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el = $('base-status');
    if (base) { el.textContent = base.name + ' · ' + D.ROM.name + ' ✓'; el.className = 'msg ok'; }
    else { el.textContent = 'Choose your ' + D.ROM.name + ' ROM (.sfc or .smc, 512 KB). It stays on this device.'; el.className = 'msg'; }
    $('generate').disabled = !base || busy;
  }

  // ── options: the generator's own inputs, mirrored here ───────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let gw = null;   // the generator's window
  function buildOptions(w) {
    gw = w;
    const doc = w.document, wrap = $('fields');
    // its preset list
    $('preset').innerHTML = Array.from(doc.querySelectorAll('#preset option')).map((o) => '<option value="' + esc(o.value) + '">' + esc(o.value === '0' ? 'Custom' : o.textContent.trim()) + '</option>').join('');
    // its option groups: a heading, then its checkboxes and radio buttons with their labels
    const groups = [];
    doc.querySelectorAll('h3, input[type=checkbox], input[type=radio]').forEach((n) => {
      if (n.tagName === 'H3') { groups.push([n.textContent.replace(/\s+/g, ' ').trim(), []]); return; }
      if (n.id && n.id !== 'cheat_devmode' && groups.length) groups[groups.length - 1][1].push(n);
    });
    for (let k = groups.length - 1; k >= 0; k--) if (!groups[k][1].length) groups.splice(k, 1);
    wrap.innerHTML = groups.map(([title, inputs]) => '<fieldset class="opt-group"><legend>' + esc(title) + '</legend>' + inputs.map((i) => {
      const lab = (i.closest('label') || i.parentElement).textContent.replace(/\s+/g, ' ').trim().replace('&#8482;', '™');
      return '<label class="flag-row"><input type="' + i.type + '" data-id="' + esc(i.id) + '"' + (i.name ? ' name="g-' + esc(i.name) + '"' : '') + '> ' + esc(lab) + '</label>';
    }).join('') + '</fieldset>').join('');
    wrap.addEventListener('change', (e) => {
      const el = e.target.closest('input[data-id]'); if (!el) return;
      const gi = doc.getElementById(el.dataset.id); if (!gi) return;
      gi.checked = el.checked;
      if (el.type === 'checkbox' || el.checked) { if (gi.classList.contains('presetoption')) doc.getElementById('preset').value = '0'; }
      $('preset').value = doc.getElementById('preset').value;
      paintSummary();
    });
  }
  function readOptions() {
    if (!gw) return;
    const doc = gw.document;
    $('fields').querySelectorAll('input[data-id]').forEach((el) => { const gi = doc.getElementById(el.dataset.id); if (gi) el.checked = gi.checked; });
    $('preset').value = doc.getElementById('preset').value;
    paintSummary();
  }
  function setPreset(v) {
    if (!gw) return;
    gw.document.getElementById('preset').value = String(v);
    if (+v > 0) gw.updatePreset();
    readOptions();
  }
  function shareCode() { if (!gw) return ''; const p = +gw.document.getElementById('preset').value; return p ? String(p) : 'x' + gw.getRandomizerSettings(); }
  function paintSummary() {
    if (!gw) return;
    const p = +gw.document.getElementById('preset').value;
    $('preset-about').textContent = p ? 'The randomizer’s ' + gw.getPresetName(p) + ' preset (1 is the easiest, 7 the hardest, 8 hardcore).' : 'Your own settings (share code ' + shareCode() + ').';
    try { localStorage.setItem('smwr:settings', shareCode()); } catch (e) {}
  }
  // "seed/preset", a link from the randomizer's site (…#!/seed/preset), or a preset / x-code alone
  function applyCode(text) {
    const t = String(text || '').trim(); if (!t || !gw) return false;
    const m = t.match(/#!\/([0-9a-fA-F]{1,8})\/(x?[0-9a-fA-F]+)/) || t.match(/^([0-9a-fA-F]{1,8})\s*\/\s*(x?[0-9a-fA-F]+)$/) || t.match(/^()(x[0-9a-fA-F]+|[0-8])$/);
    if (!m) return false;
    if (m[1]) $('seed').value = m[1].toLowerCase();
    if (m[2][0] === 'x') { gw.document.getElementById('preset').value = '0'; gw.setRandomizerSettings(m[2].slice(1)); readOptions(); }
    else setPreset(+m[2]);
    return true;
  }

  // ── seeds ────────────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return v[0].toString(16).padStart(8, '0'); }

  // ── generating ───────────────────────────────────────────────────────────
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  async function generate() {
    if (!base || busy) return null;
    const seedText = $('seed').value.trim().replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing…', 'busy');
    try {
      const w = await gen();
      const t0 = performance.now();
      let res = null, seed = seedText ? parseInt(seedText, 16) : null;
      // a random seed that fails the randomizer's own checks: try the next one (a given seed is reported as is)
      for (let tries = 0; tries < (seedText ? 1 : 8); tries++) {
        const copy = base.bytes.slice(0);
        res = w.randomizeROM(copy.buffer, seed == null ? parseInt(randomSeed(), 16) : seed);
        if (!res.errors.length) break;
      }
      if (res.errors.length) throw new Error('the randomizer’s checks failed for this seed (' + res.errors[0] + '). Try another seed.');
      const rom = new Uint8Array(res.buffer);
      const presetName = typeof res.preset === 'number' ? w.getPresetName(res.preset) : 'Custom';
      const meta = { seed: res.seed, preset: String(res.preset), presetName, checksum: res.checksum, version: w.VERSION_STRING, generator: 'SMW Randomizer ' + w.VERSION_STRING, made: Date.now() };
      last = { rom, name: 'smw-' + w.VERSION_STRING + '-' + res.seed + '.sfc', meta };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + res.seed + ' · ' + presetName + ' · ' + res.checksum;
      $('result-hash').textContent = 'Share: ' + res.seed + '/' + res.preset;
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    } catch (e) {
      setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad');
      throw e;
    } finally { busy = false; $('generate').disabled = !base; }
  }

  function download(bytes, name) {
    if (window.RHSaveFile) { window.RHSaveFile(bytes, name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function init(opts) {
    onPlay = (opts && opts.onPlay) || onPlay;
    const dlg = $('seed-dlg');
    gen().then((w) => {
      buildOptions(w);
      let saved = null; try { saved = localStorage.getItem('smwr:settings'); } catch (e) {}
      if (!saved || !applyCode(saved)) setPreset(4);
      $('seed').value = '';
    }).catch((e) => setStatus(e.message, 'bad'));
    $('preset').addEventListener('change', () => setPreset(+$('preset').value));
    $('fields-toggle').addEventListener('click', () => { const u = $('fields'); u.hidden = !u.hidden; $('fields-toggle').textContent = u.hidden ? 'Customize settings' : 'Hide the settings'; });
    $('code').addEventListener('change', () => { const ok = applyCode($('code').value); $('code-msg').textContent = ok ? 'Loaded.' : 'Not a share code: paste seed/preset (1234abcd/4), a custom code (1234abcd/x…), or the randomizer’s link.'; $('code-msg').className = 'msg ' + (ok ? 'ok' : 'bad'); });
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { takeRom(new Uint8Array(await f.arrayBuffer()), f.name); }
      catch (e) { $('base-status').textContent = e.message; $('base-status').className = 'msg bad'; }
    });
    SMWStore.get('base').then((b) => { if (b && b.bytes && !base) { try { takeRom(new Uint8Array(b.bytes), b.name, { remember: false }); } catch (e) {} } });
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    paintBase();
  }

  window.SMWSeed = {
    init,
    open() { $('seed-dlg').showModal(); },
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
    crc32,
  };
})();
