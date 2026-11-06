/*
 * seed.js — the four-game combo's "New seed" dialog: your four ROMs (Super
 * Metroid and the Japanese Link to the Past 1.0, as SMZ3 asks; Zelda 1 and
 * Metroid, as the Zelda 1 + Metroid page asks), SMZ3's settings, the goal and
 * a seed in; the SNES ROM and the two NES ROMs out (js/gen.js). The ROMs you
 * gave the SMZ3 and Zelda 1 + Metroid pages are already here (the same
 * browser storage). Nothing is uploaded.
 */
(function () {
  'use strict';
  const D = window.SMZ3D, G = window.SMZ3Gen, Q = window.QuadGen, ZG = window.ZMGen;
  const $ = (id) => document.getElementById(id);
  const base = { sm: null, z3: null, z1: null, m1: null };
  const LABEL = { sm: 'Super Metroid (Japan, USA): 3 MB .sfc', z3: 'Zelda no Densetsu: Kamigami no Triforce (Japan) v1.0: 1 MB .sfc', z1: 'The Legend of Zelda (USA): .nes', m1: 'Metroid (USA): .nes' };
  let last = null, onPlay = () => {}, busy = false, ipsPromise = null;

  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
  function identify(bytes) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('that is a .zip file: unzip it and pick the ROM inside');
    const nes = ZG.normalize(bytes); if (nes) return [nes.kind, nes.bytes];   // (an NES dump with any header, or none)
    if (bytes.length % 1024 === 512) bytes = bytes.slice(512);
    const c = crc32(bytes);
    for (const k of ['sm', 'z3']) if (bytes.length === D.ROMS[k].size && c === D.ROMS[k].crc32) return [k, bytes];
    throw new Error('not one of the four ROMs (another version or a randomized copy won’t do)');
  }
  const storeOf = (k) => (k === 'z1' || k === 'm1' ? window.ZMStore : window.SMZ3Store);
  function takeRom(bytes, name, remember) {
    const [k, b] = identify(bytes);
    base[k] = { bytes: b, name };
    if (remember !== false) storeOf(k).set('base-' + k, { bytes: b.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    ['sm', 'z3', 'z1', 'm1'].forEach((k) => {
      const el = $('base-' + k);
      if (base[k]) { el.textContent = '✓ ' + LABEL[k].replace(/:.*/, '') + ' · ' + base[k].name; el.className = 'msg ok'; }
      else { el.textContent = LABEL[k] + ' (still needed)'; el.className = 'msg'; }
    });
    $('generate').disabled = !(base.sm && base.z3 && base.z1 && base.m1) || busy;
  }
  function ips() {
    if (!ipsPromise) ipsPromise = fetch('../smz3/gen/zsm.ips').then((r) => { if (!r.ok) throw new Error('the base patch didn’t load (' + r.status + ')'); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));
    ipsPromise.catch(() => { ipsPromise = null; });
    return ipsPromise;
  }

  // ── settings: the goal, then SMZ3's own ──────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OPTS = G.OPTIONS.filter((o) => o.key !== 'race');
  function buildOptions() {
    $('goal').innerHTML = Q.GOALS.map((g) => '<option value="' + g[0] + '">' + esc(g[1]) + '</option>').join('');
    $('fields').innerHTML = OPTS.map((o) => '<label class="field">' + esc(o.label) + '<select data-k="' + o.key + '">' +
      o.values.map((v) => '<option value="' + v[0] + '"' + (v[0] === o.def ? ' selected' : '') + '>' + esc(v[1]) + (v[0] === o.def ? ' (default)' : '') + '</option>').join('') + '</select></label>').join('');
    $('nes-fields').innerHTML = Q.NES_OPTIONS.map((o) => '<label class="field">' + esc(o.label) + '<select data-n="' + o.key + '">' +
      o.values.map((v) => '<option value="' + v[0] + '"' + (v[0] === o.def ? ' selected' : '') + '>' + esc(v[1]) + (v[0] === o.def ? ' (default)' : '') + '</option>').join('') + '</select></label>').join('');
    $('fields').addEventListener('change', saveOptions); $('goal').addEventListener('change', saveOptions); $('nes-fields').addEventListener('change', saveOptions);
  }
  function options() { const o = {}; $('fields').querySelectorAll('select[data-k]').forEach((s) => { o[s.dataset.k] = s.value; }); return o; }
  function nesOpts() { const o = {}; $('nes-fields').querySelectorAll('select[data-n]').forEach((s) => { o[s.dataset.n] = s.value; }); return o; }
  const NES_V = 2;   // settings saved before Kakariko became the default portals: their portal choice is set back to it once
  function setOptions(o) { if (!o) return;
    if (o.nes) $('nes-fields').querySelectorAll('select[data-n]').forEach((s) => { if (s.dataset.n === 'portals' && o.nesV !== NES_V) return; if (o.nes[s.dataset.n] !== undefined && Array.from(s.options).some((x) => x.value === o.nes[s.dataset.n])) s.value = o.nes[s.dataset.n]; }); $('fields').querySelectorAll('select[data-k]').forEach((s) => { if (o[s.dataset.k] !== undefined && Array.from(s.options).some((x) => x.value === o[s.dataset.k])) s.value = o[s.dataset.k]; }); if (o.goal) $('goal').value = o.goal; }
  function saveOptions() { try { localStorage.setItem('quad:settings', JSON.stringify(Object.assign(options(), { goal: $('goal').value, nes: nesOpts(), nesV: NES_V }))); } catch (e) {} }
  function summary(o, n) {
    const parts = [];
    if (n) Q.NES_OPTIONS.forEach((opt) => { if (n[opt.key] !== opt.def) { const v = opt.values.find((x) => x[0] === n[opt.key]); parts.push(opt.label + ': ' + (v ? v[1].replace(/:.*/, '') : n[opt.key])); } });
    OPTS.forEach((opt) => { if (o[opt.key] !== opt.def) { const v = opt.values.find((x) => x[0] === o[opt.key]); parts.push(opt.label + ': ' + (v ? v[1] : o[opt.key])); } });
    return parts.length ? parts.join(' · ') : 'the default settings';
  }

  // ── generating ───────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(v[0] % 2147483647); }
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  async function generate() {
    if (!(base.sm && base.z3 && base.z1 && base.m1) || busy) return null;
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing the four games…', 'busy');
    try {
      const patch = await ips();
      await new Promise((r) => setTimeout(r, 30));
      const t0 = performance.now(), o = options(), goal = $('goal').value, nes = nesOpts();
      const r = Q.generate({ sm: base.sm.bytes, z3: base.z3.bytes, ips: patch, z1: base.z1.bytes, m1: base.m1.bytes, seed: $('seed').value.trim() || randomSeed(), options: o, goal, nes });
      // the SMZ3 tracker's reveal: its locations' items
      r.meta.items = r.world.Locations.filter((l) => l.Id < Q.NES_ID).map((l) => [l.Id, l.Item.Name]);
      r.meta.summary = summary(o, nes);
      last = { rom: r.rom, z1: r.z1, m1: r.m1, name: 'quad-' + r.seed, meta: r.meta };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + r.seed + ' · goal: ' + Q.GOALS.find((g) => g[0] === goal)[1] + ' · ' + summary(o, nes);
      $('result-portals').textContent = 'Portals: ' + r.portals.filter((p, i, a) => !p.group || a.findIndex((q) => q.group === p.group) === i).map((p) => (p.group || p.name) + ' → ' + (p.to === 'z1' ? 'Zelda 1' : 'Metroid')).concat(r.meta && r.meta.smPortal ? [r.meta.smPortal.name + ' → Super Metroid'] : []).join(', ') + '.';
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    } catch (e) {
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
    try { setOptions(JSON.parse(localStorage.getItem('quad:settings') || '{}')); } catch (e) {}
    $('fields-toggle').addEventListener('click', () => { const u = $('fields'); u.hidden = !u.hidden; $('fields-toggle').textContent = u.hidden ? 'SMZ3 settings' : 'Hide SMZ3 settings'; });
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const files = Array.from(ev.target.files || []); ev.target.value = '';
      const msgs = [];
      for (const f of files) { try { takeRom(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { msgs.push(f.name + ': ' + e.message); } }
      $('base-msg').textContent = msgs.join(' '); $('base-msg').className = 'msg ' + (msgs.length ? 'bad' : '');
    });
    ['sm', 'z3', 'z1', 'm1'].forEach((k) => storeOf(k).get('base-' + k).then((b) => { if (b && b.bytes && !base[k]) { try { takeRom(new Uint8Array(b.bytes), b.name, false); } catch (e) {} } }).catch(() => {}));
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name + '.sfc'));
    $('dl-z1').addEventListener('click', () => last && download(last.z1, last.name + '-zelda1.nes'));
    $('dl-m1').addEventListener('click', () => last && download(last.m1, last.name + '-metroid.nes'));
    $('dl-spoiler').addEventListener('click', () => last && download(new TextEncoder().encode(last.meta.spoiler), last.name + '-spoiler.txt', 'text/plain'));
    paintBase();
    ips().catch(() => {});
  }

  window.QuadSeed = {
    init,
    open() { $('seed-dlg').showModal(); },
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
  };
})();
