/*
 * seed.js — the "New seed" dialog: your Guardian Legend ROM, flags and a
 * seed number in, a randomized ROM out. The randomizer (js/randomizer.js)
 * is plain JavaScript and runs right here in a few milliseconds.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = window.GLRandomizer, T = window.TGL;
  let base = null;         // { bytes, name }
  let last = null;         // { rom, name, meta, text }
  let onPlay = () => {};

  const PRESETS = [
    { label: 'Standard (keys + items + corridor bonuses)', flags: 'K1I2B1' },
    { label: 'Keys only', flags: 'K1I0B0' },
    { label: 'Items only (rooms + mini-bosses)', flags: 'K0I2B0' },
    { label: 'Light (keys + item rooms)', flags: 'K1I1B0' },
    { label: 'Vanilla (no password, nothing moved)', flags: 'K0I0B0' },
  ];
  const OPTIONS = [
    { id: 'K', label: 'Corridor keys', values: [['0', 'Vanilla'], ['1', 'Shuffled among corridors 1-10']] },
    { id: 'I', label: 'Items', values: [['0', 'Vanilla'], ['1', 'Shuffle item rooms'], ['2', 'Shuffle item rooms and mini-boss drops']] },
    { id: 'B', label: 'Corridor bonus items', values: [['0', 'Vanilla'], ['1', 'Shuffled']] },
  ];

  const readSaved = () => { try { return JSON.parse(localStorage.getItem('glr:seedform')) || {}; } catch (e) { return {}; } };
  const writeSaved = (o) => { try { localStorage.setItem('glr:seedform', JSON.stringify(o)); } catch (e) {} };

  function setStatus(text, kind) { const m = $('gen-status'); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
  function setFlagMsg(text, kind) { const m = $('flag-msg'); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }

  // ── base ROM ─────────────────────────────────────────────────────────────
  async function loadBaseFromStore() {
    const b = await GLRStore.get('baseRom');
    if (b && b.bytes) { base = { bytes: new Uint8Array(b.bytes), name: b.name }; paintBase(); }
  }
  function paintBase() {
    const el = $('base-status');
    if (!base) { el.textContent = 'Choose your The Guardian Legend (USA) .nes file. It stays on this device.'; el.className = 'msg'; return; }
    const err = T.checkBase(base.bytes);
    el.textContent = err ? base.name + ': ' + err : base.name + ' · The Guardian Legend (USA) ✓';
    el.className = 'msg ' + (err ? 'bad' : 'ok');
    updateButton();
  }
  $('base-input').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    base = { bytes, name: f.name };
    paintBase();
    if (!T.checkBase(bytes)) await GLRStore.set('baseRom', { bytes: bytes.buffer.slice(0), name: f.name }).catch(() => {});
  });

  // ── flags ────────────────────────────────────────────────────────────────
  function buildForm() {
    const sel = $('preset');
    sel.innerHTML = '';
    for (const p of PRESETS) { const o = document.createElement('option'); o.value = p.flags; o.textContent = p.label; sel.append(o); }
    const c = document.createElement('option'); c.value = ''; c.textContent = 'Custom'; sel.append(c);
    const box = $('flag-fields');
    box.innerHTML = '';
    for (const opt of OPTIONS) {
      const row = document.createElement('label');
      row.className = 'flag-row';
      const s = document.createElement('select');
      s.dataset.flag = opt.id;
      for (const [v, t] of opt.values) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }
      s.addEventListener('change', () => { setFlags(fromFields()); });
      row.append(document.createTextNode(opt.label), s);
      box.append(row);
    }
    sel.addEventListener('change', () => { if (sel.value) setFlags(sel.value); });
    $('flags').addEventListener('input', () => setFlags($('flags').value, true));
  }
  function fromFields() {
    return Array.from(document.querySelectorAll('#flag-fields select')).map((s) => s.dataset.flag + s.value).join('');
  }
  function setFlags(str, typing) {
    let f;
    try { f = G.parseFlags(str); } catch (e) { setFlagMsg(e.message, 'bad'); updateButton(true); return; }
    const norm = G.formatFlags(f);
    if (!typing) $('flags').value = norm;
    document.querySelectorAll('#flag-fields select').forEach((s) => { s.value = String(f[{ K: 'keys', I: 'items', B: 'bonus' }[s.dataset.flag]]); });
    $('preset').value = PRESETS.some((p) => p.flags === norm) ? norm : '';
    setFlagMsg('');
    const saved = readSaved(); saved.flags = norm; writeSaved(saved);
    updateButton();
  }
  function updateButton(bad) {
    $('generate').disabled = !!bad || !base || !!T.checkBase(base.bytes);
  }

  // ── generate ─────────────────────────────────────────────────────────────
  $('dice').addEventListener('click', () => { $('seed').value = String(Math.floor(Math.random() * 1e9)); });
  $('generate').addEventListener('click', () => {
    if (!base) return;
    if (!$('seed').value.trim()) $('seed').value = String(Math.floor(Math.random() * 1e9));
    setStatus('Generating…', 'busy');
    setTimeout(() => {
      try {
        const out = G.generate(base.bytes, { seed: $('seed').value, flags: $('flags').value });
        const name = 'GLR_' + out.seed + '_' + out.flags + '.nes';
        last = { rom: out.rom, name, text: out.text, meta: { seed: out.seed, flags: out.flags, code: out.code, version: out.version } };
        $('result-seed').textContent = 'Seed ' + out.seed + ' · flags ' + out.flags;
        $('result-code').textContent = out.code;
        $('result').hidden = false;
        setStatus('');
        $('result').scrollIntoView({ block: 'nearest' });
      } catch (e) {
        setStatus(e.message, 'bad');
      }
    }, 20);
  });
  function download(bytes, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name, 'application/octet-stream'));
  $('dl-spoiler').addEventListener('click', () => last && download(last.text, last.name.replace(/\.nes$/, '_spoiler.txt'), 'text/plain'));
  $('play').addEventListener('click', async () => {
    if (!last) return;
    await GLRStore.set('current', { bytes: last.rom.buffer.slice(0), name: last.name, meta: last.meta }).catch(() => {});
    $('seed-dlg').close();
    onPlay({ rom: last.rom, name: last.name, meta: last.meta });
  });

  window.GLRSeed = {
    init(opts) {
      onPlay = opts.onPlay || onPlay;
      $('glr-version').textContent = 'v' + G.VERSION;
      buildForm();
      setFlags(readSaved().flags || G.DEFAULT_FLAGS);
      loadBaseFromStore().then(paintBase);
      paintBase();
    },
    open() { $('result').hidden = true; setStatus(''); if (!$('seed').value) $('seed').value = String(Math.floor(Math.random() * 1e9)); $('seed-dlg').showModal(); },
    release() {},
  };
})();
