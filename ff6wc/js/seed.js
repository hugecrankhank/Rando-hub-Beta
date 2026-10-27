/*
 * seed.js — the "New seed" dialog: your FF3 US ROM, a preset or flag string
 * and a seed in, a Worlds Collide seed out. The generator (Worlds Collide
 * itself, in Python) runs in a worker (wc/seed-worker.js); Python and the
 * generator are only downloaded the first time.
 */
(function () {
  'use strict';
  const D = window.FF6;
  const $ = (id) => document.getElementById(id);
  let base = null;            // { bytes: Uint8Array (3 MB, header off), name }
  let last = null;            // { rom, name, meta, log }
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
    if (bytes.length !== D.ROM.size) throw new Error('That isn’t the right ROM: Worlds Collide needs Final Fantasy III (USA) v1.0, a 3 MB .sfc / .smc (yours is ' + (bytes.length / 1048576).toFixed(2) + ' MB).');
    let ok = true;
    try { ok = (await sha256(bytes)) === D.ROM.sha256; } catch (e) { ok = true; }
    if (!ok) throw new Error('That ROM isn’t the one Worlds Collide wants (Final Fantasy III (USA) v1.0, unheadered). A v1.1, a different region or an already-patched copy won’t work.');
    base = { bytes, name };
    if (remember) FF6Store.set('base', { bytes: bytes.buffer.slice(0), name }).catch(() => {});
    paintBase();
  }
  function paintBase() {
    const el = $('base-status');
    if (base) { el.textContent = base.name + ' · Final Fantasy III (USA) v1.0 ✓'; el.className = 'msg ok'; }
    else { el.textContent = 'Choose your Final Fantasy III (USA) v1.0 ROM (.sfc or .smc, 3 MB). It stays on this device.'; el.className = 'msg'; }
    $('generate').disabled = !base || busy;
  }

  // ── flags ────────────────────────────────────────────────────────────────
  function preset() { return D.PRESETS.find((p) => p.id === $('preset').value) || D.PRESETS[0]; }
  function paintPreset() {
    const p = preset();
    $('preset-about').textContent = p.about;
    const f = $('flags');
    if (p.id !== 'custom') { f.value = p.flags; f.readOnly = true; }
    else { f.readOnly = false; try { f.value = localStorage.getItem('ff6wc:custom-flags') || ''; } catch (e) { f.value = ''; } }
    paintFlagMsg();
  }
  function flagList() {
    return $('flags').value.trim().split(/\s+/).filter(Boolean);
  }
  function paintFlagMsg() {
    const list = flagList();
    const m = $('flag-msg');
    if (!list.length) { m.textContent = 'No flags: the generator’s defaults (a plain open world).'; m.className = 'msg warn'; return; }
    const bad = list.find((t) => /^-/.test(t) && !/^-[a-z]/.test(t)) || (list[0][0] !== '-' ? list[0] : null);
    if (bad) { m.textContent = '“' + bad + '” doesn’t look like a flag.'; m.className = 'msg bad'; return; }
    m.textContent = list.filter((t) => t[0] === '-').length + ' flags' + (/-cg\b/.test(list.join(' ')) ? ' · character gating' : /-open\b/.test(list.join(' ')) ? ' · open world' : '');
    m.className = 'msg';
  }

  // ── seeds ────────────────────────────────────────────────────────────────
  function randomSeed() {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789', v = new Uint8Array(12);
    crypto.getRandomValues(v);
    return Array.from(v).map((x) => a[x % 36]).join('');
  }

  // ── generating ───────────────────────────────────────────────────────────
  function setStatus(text, cls) { const s = $('gen-status'); s.textContent = text || ''; s.className = 'msg ' + (cls || ''); }

  function generate() {
    if (!base || busy) return Promise.resolve(null);
    const seed = ($('seed').value.trim() || randomSeed()).replace(/\s+/g, '');
    const flags = flagList();
    if (preset().id === 'custom') { try { localStorage.setItem('ff6wc:custom-flags', $('flags').value.trim()); } catch (e) {} }
    try { localStorage.setItem('ff6wc:preset', preset().id); } catch (e) {}
    busy = true; $('generate').disabled = true; $('result').hidden = true;
    setStatus('Starting…', 'busy');
    return new Promise((resolve, reject) => {
      const w = new Worker('wc/seed-worker.js', { type: 'module' });
      const bytes = base.bytes.slice(0);
      const t = setTimeout(() => { w.terminate(); reject(new Error('The generator took too long (5 minutes).')); }, 300000);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'stage') { setStatus(m.text, 'busy'); return; }
        clearTimeout(t); w.terminate();
        if (m.type === 'error') { reject(new Error(m.error + (m.detail && /Traceback/.test(m.detail) ? '' : ''))); console.warn('[ff6wc]', m.detail); return; }
        resolve(m);
      };
      w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || 'The generator failed to load.')); };
      w.postMessage({ type: 'gen', rom: bytes, seed, flags }, [bytes.buffer]);
    }).then((m) => {
      const meta = { seed: m.seed, flags: m.flags, hash: m.hash || [], version: m.version, objectives: parseObjectives(m.log || ''), generator: 'Worlds Collide', made: Date.now() };
      last = { rom: new Uint8Array(m.rom), name: 'ffiii_wc_' + m.seed + '.sfc', meta, log: m.log || '' };
      setStatus('Ready in ' + (m.ms / 1000).toFixed(1) + ' s.', 'ok');
      $('result-seed').textContent = 'Seed ' + m.seed;
      $('result-hash').textContent = (m.hash || []).join(', ');
      $('result').hidden = false;
      $('result').scrollIntoView({ block: 'nearest' });
      return last;
    }).catch((e) => {
      setStatus('Couldn’t make the seed: ' + (e && e.message || e), 'bad');
      throw e;
    }).finally(() => { busy = false; $('generate').disabled = !base; });
  }

  // The log's Objectives section (two columns, 60 wide): each objective is
  // "    A Result        args", then its conditions indented two more, then
  // "    Conditions Required  n-n".
  function parseObjectives(log) {
    const lines = log.split(/\r?\n/);
    let i = lines.findIndex((l) => /^-+ Objectives -+$/.test(l.trim()));
    if (i < 0) return [];
    const cols = [[], []];
    for (i++; i < lines.length && !/^-{10,} .+ -{10,}$/.test(lines[i].trim()); i++) {
      cols[0].push(lines[i].slice(0, 60).replace(/\s+$/, ''));
      cols[1].push(lines[i].slice(60).replace(/\s+$/, ''));
    }
    const out = [];
    for (const col of cols) {
      let cur = null;
      for (const l of col) {
        let m;
        if ((m = l.match(/^ {4}([A-Y]) (.+?)(?: {2,}(.*))?$/))) { cur = { letter: m[1], result: m[2].trim() + (m[3] ? ' ' + m[3].trim() : ''), conditions: [], required: '' }; out.push(cur); }
        else if (cur && (m = l.match(/^ {4}Conditions Required\s+(\S+)/))) { const r = m[1].split('-'); cur.required = r[0] === r[1] ? (r[0] === String(cur.conditions.length) ? 'All of these' : r[0] + ' of these') : r[0] + '–' + r[1] + ' of these'; }
        else if (cur && (m = l.match(/^ {6}(\S.*?)(?: {2,}(.*))?$/))) cur.conditions.push(m[1].trim() + (m[2] ? ' ' + m[2].trim() : ''));
      }
    }
    out.sort((a, b) => a.letter < b.letter ? -1 : 1);
    return out;
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
    sel.innerHTML = D.PRESETS.map((p) => '<option value="' + p.id + '">' + p.name + '</option>').join('');
    try { sel.value = localStorage.getItem('ff6wc:preset') || 'ul'; } catch (e) {}
    if (!sel.value) sel.value = 'ul';
    sel.addEventListener('change', paintPreset);
    $('flags').addEventListener('input', paintFlagMsg);
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
    FF6Store.get('base').then((b) => { if (b && b.bytes && !base) takeRom(new Uint8Array(b.bytes), b.name, { remember: false }).catch(() => {}); });
    $('generate').addEventListener('click', () => generate().catch(() => {}));
    $('play').addEventListener('click', () => { if (last) { dlg.close(); onPlay(last); } });
    $('dl-rom').addEventListener('click', () => last && download(last.rom, last.name));
    $('dl-log').addEventListener('click', () => last && download(last.log, last.name.replace(/\.sfc$/, '.txt'), 'text/plain'));
    paintBase();
  }

  window.FF6Seed = {
    init,
    open() { $('seed-dlg').showModal(); },
    // Roll with the current settings and a fresh seed, then play (the hub's reroll)
    reroll() { $('seed').value = ''; $('seed-dlg').showModal(); return generate().then((r) => { if (r) { $('seed-dlg').close(); onPlay(r, { confirmed: true }); } return r; }); },
    get last() { return last; },
    release() { last = null; },
  };
})();
