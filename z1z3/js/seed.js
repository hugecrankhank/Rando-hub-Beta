/*
 * seed.js — Z1Z3's "New seed" dialog: your two ROMs (the Japanese 1.0 A Link
 * to the Past, as alttpr.com asks, and The Legend of Zelda (USA)), the
 * settings and a seed in; the ALttP ROM and the Zelda 1 ROM out (js/gen.js).
 * The ROMs the SMZ3 / Rando Cross and Zelda 1 + Metroid pages were given are
 * already here (the same browser storage). Nothing is uploaded.
 */
(function () {
  'use strict';
  const ZG = window.ZMGen;
  const $ = (id) => document.getElementById(id);
  const base = { jp: null, z1: null };
  const LABEL = { jp: 'Zelda no Densetsu: Kamigami no Triforce (Japan) v1.0: 1 MB .sfc', z1: 'The Legend of Zelda (USA): .nes' };
  let last = null, onPlay = () => {}, busy = false;
  const gen = () => new Promise((res) => { (function wait() { if (window.Z1Z3Gen) res(window.Z1Z3Gen); else setTimeout(wait, 50); })(); });

  async function identify(bytes) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('that is a .zip file: unzip it and pick the ROM inside');
    const nes = ZG.normalize(bytes);
    if (nes) { if (nes.kind !== 'z1') throw new Error('that’s Metroid: this page wants The Legend of Zelda'); return ['z1', nes.bytes]; }
    const G = await gen();
    if (G.checkJp(bytes)) { let b = bytes.length % 1024 === 512 ? bytes.slice(512) : bytes; if (b.length > 0x100000) b = b.slice(0, 0x100000); return ['jp', b]; }
    throw new Error('not one of the two ROMs (another version or a randomized copy won’t do)');
  }
  const storeOf = (k) => (k === 'z1' ? window.ZMStore : window.SMZ3Store);
  const storeKey = (k) => (k === 'z1' ? 'base-z1' : 'base-z3');
  async function takeRom(bytes, name, remember) {
    const [k, b] = await identify(bytes);
    base[k] = { bytes: b, name };
    if (remember !== false) storeOf(k).set(storeKey(k), { bytes: b.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    ['jp', 'z1'].forEach((k) => {
      const el = $('base-' + k);
      if (base[k]) { el.textContent = '✓ ' + LABEL[k].replace(/:.*/, '') + ' · ' + base[k].name; el.className = 'msg ok'; }
      else { el.textContent = LABEL[k] + ' (still needed)'; el.className = 'msg'; }
    });
    const zp = window.Z1Z3ZoraForm ? Z1Z3ZoraForm.problem : '';
    $('generate').disabled = !(base.jp && base.z1) || busy || !!zp;
    if (zp && !busy) setStatus(zp, 'warn'); else if (!busy && /Zelda 1 flags|ZORA is still/.test($('gen-status').textContent)) setStatus('');
  }

  // ── settings ─────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let OPTS = [];
  async function buildOptions() {
    OPTS = (await gen()).OPTIONS;
    $('fields').innerHTML = OPTS.map((o) => '<label class="field">' + esc(o.label) + '<select data-k="' + o.key + '">' +
      o.values.map((v) => '<option value="' + v[0] + '"' + (v[0] === o.def ? ' selected' : '') + '>' + esc(v[1]) + (v[0] === o.def ? ' (default)' : '') + '</option>').join('') + '</select></label>').join('');
    try { setOptions(JSON.parse(localStorage.getItem('z1z3:settings') || '{}')); } catch (e) {}
    $('fields').addEventListener('change', saveOptions);
  }
  function options() { const o = {}; $('fields').querySelectorAll('select[data-k]').forEach((s) => { o[s.dataset.k] = s.value; }); return o; }
  function setOptions(o) { if (!o) return; $('fields').querySelectorAll('select[data-k]').forEach((s) => { if (o[s.dataset.k] !== undefined && Array.from(s.options).some((x) => x.value === o[s.dataset.k])) s.value = o[s.dataset.k]; }); }
  function saveOptions() { try { localStorage.setItem('z1z3:settings', JSON.stringify(options())); } catch (e) {} }
  function summary(o) {
    const parts = [];
    OPTS.forEach((opt) => { if (o[opt.key] !== opt.def) { const v = opt.values.find((x) => x[0] === o[opt.key]); parts.push(opt.label + ': ' + (v ? v[1] : o[opt.key])); } });
    const zs = window.Z1Z3ZoraForm && o.zora ? Z1Z3ZoraForm.summary : '';
    if (zs) parts.push(zs);
    return parts.length ? parts.join(' · ') : 'the default settings';
  }

  // ── generating ───────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(v[0] % 2147483646 + 1); }
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  async function generate() {
    if (!(base.jp && base.z1) || busy) return null;
    const typed = $('seed').value.trim();
    if (typed && !(/^\d{1,10}$/.test(typed) && +typed >= 1 && +typed <= 2147483647)) { setStatus('A seed is a number from 1 to 2147483647.', 'bad'); return null; }
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing both Hyrules…', 'busy');
    try {
      const G = await gen();
      await new Promise((r) => setTimeout(r, 30));
      if (window.Z1Z3ZoraForm && Z1Z3ZoraForm.mode === 'zora') {
        setStatus('Starting ZORA…', 'busy'); await Z1Z3ZoraForm.ready();
        if (Z1Z3ZoraForm.problem) throw new Error(Z1Z3ZoraForm.problem);
      }
      const t0 = performance.now(), o = options(), zo = window.Z1Z3ZoraForm ? Z1Z3ZoraForm.value : null;
      const r = await G.generate({ jp: base.jp.bytes, z1: base.z1.bytes, seed: typed ? +typed : 0, options: o, zora: zo, stage: (t) => setStatus(t, 'busy') });
      r.meta.summary = summary(Object.assign({ zora: !!zo }, r.meta.options));
      r.meta.spoiler = r.spoiler; r.meta.at = r.at; r.meta.chests = r.chests;
      last = { rom: r.rom, z1: r.z1, name: 'z1z3-' + r.seed, meta: r.meta };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + r.seed + ' (' + r.hash + ') · ' + r.meta.summary + '. The way into Zelda 1: ' + r.meta.portal.name + ' (' + r.meta.portal.region + ').';
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    } catch (e) {
      console.error('[z1z3]', e);
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
    if (window.Z1Z3ZoraForm) Z1Z3ZoraForm.init(paintBase);
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const files = Array.from(ev.target.files || []); ev.target.value = '';
      const msgs = [];
      for (const f of files) { try { await takeRom(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { msgs.push(f.name + ': ' + e.message); } }
      $('base-msg').textContent = msgs.join(' '); $('base-msg').className = 'msg ' + (msgs.length ? 'bad' : '');
    });
    ['jp', 'z1'].forEach((k) => storeOf(k).get(storeKey(k)).then((b) => { if (b && b.bytes && !base[k]) return takeRom(new Uint8Array(b.bytes), b.name, false).catch(() => {}); }).catch(() => {}));
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name + '.sfc'));
    $('dl-z1').addEventListener('click', () => last && download(last.z1, last.name + '-zelda1.nes'));
    $('dl-spoiler').addEventListener('click', () => last && download(new TextEncoder().encode(last.meta.spoiler), last.name + '-spoiler.txt', 'text/plain'));
    paintBase();
  }

  window.Z1Z3Seed = {
    init,
    open() { if (!$('seed-dlg').open) $('seed-dlg').showModal(); },
    hasRom() { return !!(base.jp && base.z1); },   // a reroll that lands here waits for it (../roll-games.js landed)
    reroll() { $('seed').value = ''; if (!$('seed-dlg').open) $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
  };
})();
