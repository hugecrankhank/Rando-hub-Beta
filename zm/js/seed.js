/*
 * seed.js — the "New seed" dialog: your Zelda and Metroid ROMs and a seed in,
 * the two randomized ROMs out (js/gen.js). Nothing is uploaded.
 */
(function () {
  'use strict';
  const G = window.ZMGen, Z = window.ZM, M = window.M1;
  const $ = (id) => document.getElementById(id);
  const base = { z1: null, m1: null };
  let last = null, onPlay = () => {}, busy = false;

  function takeRom(bytes, name, remember) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('That is a .zip file. Unzip it and pick the ROM inside.');
    const k = G.whichRom(bytes);
    if (!k) throw new Error('That isn’t The Legend of Zelda (USA) (128 KB) or Metroid (USA) (128 KB; CRC32 ' + M.ROM.crc32 + ').');
    base[k] = { bytes, name };
    if (remember !== false) ZMStore.set('base-' + k, { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el1 = $('base-z1'), el2 = $('base-m1');
    el1.textContent = base.z1 ? '✓ ' + Z.ROM.name + ' · ' + base.z1.name : 'The Legend of Zelda (USA): 128 KB .nes (still needed)'; el1.className = 'msg ' + (base.z1 ? 'ok' : '');
    el2.textContent = base.m1 ? '✓ ' + M.ROM.name + ' · ' + base.m1.name : 'Metroid (USA): 128 KB .nes (still needed)'; el2.className = 'msg ' + (base.m1 ? 'ok' : '');
    $('generate').disabled = !(base.z1 && base.m1) || busy;
  }
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  function randomSeed() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000); }
  function generate() {
    if (!(base.z1 && base.m1) || busy) return Promise.resolve(null);
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing…', 'busy');
    return new Promise((r) => setTimeout(r, 30)).then(() => {
      const t0 = performance.now();
      const text = $('seed').value.trim().replace(/\D/g, '');
      const res = G.generate(base.z1.bytes, base.m1.bytes, { seed: text ? parseInt(text, 10) : 0 });
      last = { z1: res.z1, m1: res.m1, at: res.at, meta: res.meta, name: 'zm-' + res.seed };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + res.seed;
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    }).catch((e) => { setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad'); throw e; })
      .finally(() => { busy = false; paintBase(); });
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
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const files = Array.from(ev.target.files || []); ev.target.value = '';
      const msgs = [];
      for (const f of files) { try { takeRom(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { msgs.push(f.name + ': ' + e.message); } }
      $('base-msg').textContent = msgs.join(' '); $('base-msg').className = 'msg ' + (msgs.length ? 'bad' : '');
    });
    ['z1', 'm1'].forEach((k) => ZMStore.get('base-' + k).then((b) => { if (b && b.bytes && !base[k]) { try { takeRom(new Uint8Array(b.bytes), b.name, false); } catch (e) {} } }));
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-z1').addEventListener('click', () => last && download(last.z1, last.name + '-zelda.nes'));
    $('dl-m1').addEventListener('click', () => last && download(last.m1, last.name + '-metroid.nes'));
    $('dl-log').addEventListener('click', () => last && download(new TextEncoder().encode(last.meta.spoiler), last.name + '-spoiler.txt', 'text/plain'));
    paintBase();
  }
  window.ZMSeed = {
    init, open() { $('seed-dlg').showModal(); },
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; }, release() { last = null; },
  };
})();
