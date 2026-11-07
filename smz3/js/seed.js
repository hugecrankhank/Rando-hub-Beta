/*
 * seed.js — the "New seed" dialog: your Super Metroid and Zelda (Japan 1.0)
 * ROMs, the settings and a seed in, an SMZ3 ROM out.
 *
 * The generator is the SMZ3 Randomizer (v11.3.2, tewtal, MIT), ported to
 * JavaScript (gen/smz3gen.js): the same seed and settings give the same item
 * placement as samus.link's. The ROM is built as samus.link's web page builds
 * it: the two games merged, the combo's base patch (gen/zsm.ips), the seed.
 * Nothing is uploaded.
 */
(function () {
  'use strict';
  const D = window.SMZ3D, G = window.SMZ3Gen;
  const $ = (id) => document.getElementById(id);
  const base = { sm: null, z3: null };   // { bytes, name }
  let last = null;                       // { rom, name, meta }
  let onPlay = () => {};
  let busy = false, ipsPromise = null;

  // ── the base ROMs ────────────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
  // which of the two a file is (by its checksum), or why it's neither
  function identify(bytes) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('That is a .zip file. Unzip it and pick the ROM inside.');
    if (bytes.length % 1024 === 512) bytes = bytes.slice(512);
    const c = crc32(bytes);
    for (const k of ['sm', 'z3']) if (bytes.length === D.ROMS[k].size && c === D.ROMS[k].crc32) return [k, bytes];
    throw new Error('That isn’t one of the two ROMs SMZ3 is made from: ' + D.ROMS.sm.name + ' (3 MB, CRC32 ' + D.ROMS.sm.crc32 + ') or ' + D.ROMS.z3.name + ' (1 MB, CRC32 ' + D.ROMS.z3.crc32 + '). Another version or a randomized copy won’t do.');
  }
  function takeRom(bytes, name, remember) {
    const [k, b] = identify(bytes);
    base[k] = { bytes: b, name };
    if (remember !== false) SMZ3Store.set('base-' + k, { bytes: b.buffer.slice(0), name }).catch(() => {});
    paintBase();
    return k;
  }
  function paintBase() {
    for (const k of ['sm', 'z3']) {
      const el = $('base-' + k);
      if (base[k]) { el.textContent = '✓ ' + D.ROMS[k].name + ' · ' + base[k].name; el.className = 'msg ok'; }
      else { el.textContent = (k === 'sm' ? 'Super Metroid (Japan, USA): 3 MB .sfc / .smc' : 'Zelda no Densetsu: Kamigami no Triforce (Japan) v1.0: 1 MB .sfc / .smc') + ' (still needed)'; el.className = 'msg'; }
    }
    $('generate').disabled = !(base.sm && base.z3) || busy;
  }
  function ips() {
    if (!ipsPromise) ipsPromise = fetch('gen/zsm.ips').then((r) => { if (!r.ok) throw new Error('the base patch didn’t load (' + r.status + ')'); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));
    ipsPromise.catch(() => { ipsPromise = null; });
    return ipsPromise;
  }

  // ── settings ─────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function buildOptions() {
    $('fields').innerHTML = G.OPTIONS.map((o) => '<label class="field">' + esc(o.label) + '<select data-k="' + o.key + '">' +
      o.values.map((v) => '<option value="' + v[0] + '"' + (v[0] === o.def ? ' selected' : '') + '>' + esc(v[1]) + (v[0] === o.def ? ' (default)' : '') + '</option>').join('') + '</select></label>').join('');
    $('fields').addEventListener('change', () => { saveOptions(); paintSummary(); });
  }
  function options() { const o = {}; $('fields').querySelectorAll('select[data-k]').forEach((s) => { o[s.dataset.k] = s.value; }); return o; }
  function setOptions(o) { $('fields').querySelectorAll('select[data-k]').forEach((s) => { if (o && o[s.dataset.k] !== undefined && Array.from(s.options).some((x) => x.value === o[s.dataset.k])) s.value = o[s.dataset.k]; }); paintSummary(); }
  function saveOptions() { try { localStorage.setItem('smz3r:settings', JSON.stringify(options())); } catch (e) {} }
  // the settings as a short code: one letter per option (its index), after the seed: "321661004/aaiifaaaa" is samus.link’s defaults
  function code(o) { return G.OPTIONS.map((opt) => String.fromCharCode(97 + Math.max(0, opt.values.findIndex((v) => v[0] === o[opt.key])))).join(''); }
  function fromCode(c) { const o = {}; G.OPTIONS.forEach((opt, i) => { const v = opt.values[(c.charCodeAt(i) || 97) - 97]; if (v) o[opt.key] = v[0]; }); return o; }
  function summary(o) {
    const parts = [];
    G.OPTIONS.forEach((opt) => { if (o[opt.key] !== opt.def) { const v = opt.values.find((x) => x[0] === o[opt.key]); parts.push(opt.label + ': ' + (v ? v[1] : o[opt.key])); } });
    return parts.length ? parts.join(' · ') : 'samus.link’s defaults (normal logic, defeat Ganon and Mother Brain, 7 crystals, 4 bosses)';
  }
  function paintSummary() { $('opt-summary').textContent = summary(options()); }
  function applyCode(text) {
    const m = String(text || '').trim().match(/^(\d{1,10})?\s*\/\s*([a-z]{1,12})$/) || String(text || '').trim().match(/^(\d{1,10})$/);
    if (!m) return false;
    if (m[1]) $('seed').value = m[1];
    if (m[2]) setOptions(fromCode(m[2]));
    saveOptions();
    return true;
  }

  // ── generating ───────────────────────────────────────────────────────────
  function randomSeed() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(v[0] % 2147483647); }
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }
  function spoilerText(r, o) {
    const L = ['SMZ3 Randomizer v' + G.version + ' (Rando Hub port of samus.link’s generator)', 'Seed: ' + r.seed, 'Settings: ' + summary(o), 'Share code: ' + r.seed + '/' + code(o), ''];
    L.push('Prizes:'); r.rewards.forEach((x) => { if (x.reward !== 'Agahnim') L.push('  ' + x.region + ': ' + x.reward); });
    L.push('Medallions: Misery Mire ' + r.medallions['Misery Mire'] + ', Turtle Rock ' + r.medallions['Turtle Rock']);
    L.push("Ganon's Tower needs " + r.towerCrystals + ' crystals, Ganon ' + r.ganonCrystals + ', Tourian ' + r.tourianBosses + ' bosses', '');
    r.playthrough.forEach((sp, i) => { if (!sp.length) return; L.push(i === r.playthrough.length - 1 ? 'Rewards:' : 'Sphere ' + (i + 1) + ':'); sp.forEach(([k, v]) => L.push('  ' + k + ': ' + v)); L.push(''); });
    L.push('All locations:');
    let region = '';
    r.locations.forEach((l) => { if (l.region !== region) { region = l.region; L.push('  ' + region); } L.push('    ' + l.name + ': ' + l.itemName); });
    return L.join('\n');
  }
  async function generate() {
    if (!(base.sm && base.z3) || busy) return null;
    const seedText = $('seed').value.trim();
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Randomizing…', 'busy');
    try {
      const patch = await ips();
      await new Promise((r) => setTimeout(r, 30));   // let the status paint
      const t0 = performance.now();
      const o = options();
      const r = G.generate(o, seedText || randomSeed());
      const rom = G.buildRom(base.sm.bytes, base.z3.bytes, patch, r);
      const race = !!r.config.Race;
      const meta = { seed: String(r.seed), code: code(o), options: o, summary: summary(o), version: G.version, generator: 'SMZ3 Randomizer v' + G.version, made: Date.now(), race,
        spoiler: race ? null : spoilerText(r, o), items: race ? null : r.locations.map((l) => [l.id, l.itemName]) };
      last = { rom, name: 'smz3-v' + G.version + '-' + r.seed + '.sfc', meta };
      setStatus('Ready in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + r.seed + ' · ' + summary(o);
      $('result-hash').textContent = 'Share code: ' + r.seed + '/' + code(o);
      $('dl-spoiler').hidden = race;
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

  // ── wiring ───────────────────────────────────────────────────────────────
  function init(opts) {
    onPlay = (opts && opts.onPlay) || onPlay;
    const dlg = $('seed-dlg');
    buildOptions();
    try { setOptions(JSON.parse(localStorage.getItem('smz3r:settings') || '{}')); } catch (e) { paintSummary(); }
    $('fields-toggle').addEventListener('click', () => { const u = $('fields'); u.hidden = !u.hidden; $('fields-toggle').textContent = u.hidden ? 'Change settings' : 'Hide the settings'; });
    $('code').addEventListener('change', () => { const ok = applyCode($('code').value); $('code-msg').textContent = ok ? 'Loaded.' : 'Not a share code: seed/settings, e.g. 321661004/aaiifaaaa.'; $('code-msg').className = 'msg ' + (ok ? 'ok' : 'bad'); });
    $('dice').addEventListener('click', () => { $('seed').value = randomSeed(); });
    $('base-input').addEventListener('change', async (ev) => {
      const files = Array.from(ev.target.files || []);
      ev.target.value = '';
      const msgs = [];
      for (const f of files) { try { takeRom(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { msgs.push(f.name + ': ' + e.message); } }
      $('base-msg').textContent = msgs.join(' '); $('base-msg').className = 'msg ' + (msgs.length ? 'bad' : '');
    });
    ['sm', 'z3'].forEach((k) => SMZ3Store.get('base-' + k).then((b) => { if (b && b.bytes && !base[k]) { try { takeRom(new Uint8Array(b.bytes), b.name, false); } catch (e) {} } }));
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-spoiler').addEventListener('click', () => last && last.meta.spoiler && download(new TextEncoder().encode(last.meta.spoiler), last.name.replace(/\.sfc$/, '-spoiler.txt'), 'text/plain'));
    paintBase();
    ips().catch(() => {});
  }

  window.SMZ3Seed = {
    init,
    open() { $('seed-dlg').showModal(); },
    hasRom() { return !!(base.sm && base.z3); },   // a reroll that lands here waits for it (../roll-games.js landed)
    reroll() { $('seed').value = ''; if (!$('seed-dlg').open) $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
    crc32,
  };
})();
