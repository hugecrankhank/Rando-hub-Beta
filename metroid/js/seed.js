/*
 * seed.js — the "New seed" dialog: your Metroid ROM, the settings and a seed
 * number in, a randomized ROM out (js/randomizer.js, right here in the
 * page). Nothing is uploaded; the ROM stays in this browser.
 */
(function () {
  'use strict';
  const D = window.M1;
  const $ = (id) => document.getElementById(id);
  let base = null;            // { bytes: Uint8Array, name }
  let last = null;            // { rom, name, meta, placed, spheres }
  let onPlay = (entry, opts) => {};
  let busy = false;

  // ── the base ROM ─────────────────────────────────────────────────────────
  function takeRom(bytes, name, { remember = true } = {}) {
    bytes = M1Rando.normalize(bytes);   // (with its header or without)
    const c = M1Rando.check(bytes, name);
    if (c.error) throw new Error(c.error);
    if (!M1Rando.isBase(bytes)) throw new Error('That isn’t ' + D.ROM.name + ' (128 KB, CRC32 ' + D.ROM.crc32 + '): seeds are rolled from the plain game. A hack, another region or an already-randomized copy won’t do (it can still be played with Play ROM file).');
    base = { bytes, name };
    if (remember) M1Store.set('base', { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el = $('base-status');
    if (base) { el.textContent = base.name + ' · ' + D.ROM.name + ' ✓'; el.className = 'msg ok'; }
    else { el.textContent = 'Choose your ' + D.ROM.name + ' ROM (.nes, 128 KB). It stays on this device.'; el.className = 'msg'; }
    $('generate').disabled = !base || busy;
  }

  // ── seeds ────────────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(1 + (v[0] % 999999)); }
  function options() { return { startMaru: $('f-maru').checked }; }

  // ── generating ───────────────────────────────────────────────────────────
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  function generate() {
    if (!base || busy) return Promise.resolve(null);
    const seedText = $('seed').value.trim();
    if (seedText && !/^\d{1,6}$/.test(seedText) || (seedText && (+seedText < 1 || +seedText > 999999))) { setStatus('Seeds are a number from 1 to 999999.', 'bad'); return Promise.resolve(null); }
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Rolling…', 'busy');
    const o = options();
    try { localStorage.setItem('m1r:options', JSON.stringify(o)); } catch (e) {}
    return new Promise((resolve) => setTimeout(resolve, 30)).then(() => {
      const t0 = performance.now();
      const g = M1Rando.generate(base.bytes, { seed: seedText ? +seedText : 0, startMaru: o.startMaru });
      last = { rom: g.rom, name: g.name, meta: g.meta, placed: g.placed, spheres: g.spheres };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + g.seed + ' · ' + (o.startMaru ? 'start with Maru Mari' : 'Maru Mari in place') + ' · ' + g.hash;
      $('result-hash').textContent = g.name;
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    }).catch((e) => {
      setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad');
      throw e;
    }).finally(() => { busy = false; $('generate').disabled = !base; });
  }

  function download(bytes, name, type) {
    if (window.RHSaveFile && !type) { window.RHSaveFile(bytes, name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function init(opts) {
    onPlay = (opts && opts.onPlay) || onPlay;
    const dlg = $('seed-dlg');
    try { const o = JSON.parse(localStorage.getItem('m1r:options') || 'null'); if (o) $('f-maru').checked = o.startMaru !== false; } catch (e) {}
    $('seed').value = '';
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { takeRom(new Uint8Array(await f.arrayBuffer()), f.name); }
      catch (e) { $('base-status').textContent = e.message; $('base-status').className = 'msg bad'; }
    });
    M1Store.get('base').then((b) => { if (b && b.bytes && !base) { try { takeRom(new Uint8Array(b.bytes), b.name, { remember: false }); } catch (e) {} } });
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-log').addEventListener('click', () => last && download(M1Rando.spoilerText(last), last.name.replace(/\.nes$/, '_spoiler.txt'), 'text/plain'));
    paintBase();
  }

  window.M1Seed = {
    init,
    open() { $('seed-dlg').showModal(); },
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
    get base() { return base; },
  };
})();
