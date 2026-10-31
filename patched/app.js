// Patched games: a library of ROM hacks the player has patched here, each
// with its title screen as the cover, played on Rando Hub's own emulators:
// FCEUmm for NES (../z1r/emu/) and Snes9x for SNES (../emu/). One game per
// page load (?play=<id>), like the other pages: switching games reloads.
//
// Kept in this browser's IndexedDB ('rhb-beta-patched'): games (the patched
// ROM, name, system, cover) and the original ROMs the player chose to keep.

import { buildGame, patchKind, isZip, fromZip, systemOf, internalName, crc32 } from './patch.js';

const $ = (id) => document.getElementById(id);
const DB_NAME = 'rhb-beta-patched';
const EMU = { nes: '../z1r/emu/', snes: '../emu/' };
const SYS = { nes: 'NES', snes: 'SNES' };

// ── storage ───────────────────────────────────────────────────────────────────
let dbP = null;
function db() {
  return dbP || (dbP = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('games', { keyPath: 'id' });
      r.result.createObjectStore('bases', { keyPath: 'crc' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('storage aborted (full?)'));
  });
}
const all = (store) => tx(store, 'readonly', (s) => s.getAll());
const get = (store, k) => tx(store, 'readonly', (s) => s.get(k));
const put = (store, v) => tx(store, 'readwrite', (s) => s.put(v));
const del = (store, k) => tx(store, 'readwrite', (s) => s.delete(k));
// Ask the browser to keep this site's data (games, saves) when space is tight
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

function toast(msg, ms = 3500) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms);
}
const crcHex = (b) => crc32(b).toString(16).toUpperCase().padStart(8, '0');
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cleanName = (f) => f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
const urls = new Set();
function blobUrl(b) { const u = URL.createObjectURL(b); urls.add(u); return u; }

// ── the library ───────────────────────────────────────────────────────────────
async function showLibrary() {
  document.body.classList.remove('playing');
  const games = (await all('games')).sort((a, b) => (b.played || b.added) - (a.played || a.added));
  const grid = $('grid');
  urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
  grid.replaceChildren();
  if (!games.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.style.gridColumn = '1 / -1';
    e.innerHTML = '<b>No patched games yet.</b><br>Get a hack’s patch (romhacking.net has thousands), then add it here with your own copy of the game it was made for.<br>';
    const b = document.createElement('button'); b.className = 'primary'; b.textContent = '＋ Add a game'; b.onclick = openAdd;
    e.append(b); grid.append(e); return;
  }
  for (const g of games) grid.append(card(g));
}
function coverEl(g) {
  if (g.cover) { const img = document.createElement('img'); img.className = 'cover'; img.alt = ''; img.src = blobUrl(g.cover); return img; }
  const d = document.createElement('div'); d.className = 'cover none'; d.textContent = g.name; return d;
}
function card(g) {
  const c = document.createElement('div');
  c.className = 'card'; c.tabIndex = 0; c.title = 'Play ' + g.name;
  const meta = document.createElement('div'); meta.className = 'meta';
  meta.innerHTML = '<div class="nm"></div><div class="sub"><span class="sys ' + g.system + '">' + SYS[g.system] + '</span><span class="from"></span></div>';
  meta.querySelector('.nm').textContent = g.name;
  meta.querySelector('.from').textContent = g.patchName ? g.patchName : 'already patched ROM';
  const more = document.createElement('button'); more.type = 'button'; more.className = 'more'; more.textContent = '⋯'; more.title = 'More';
  c.append(coverEl(g), meta, more);
  const play = () => { location.search = '?play=' + encodeURIComponent(g.id); };
  c.addEventListener('click', (e) => { if (!e.target.closest('.more, .menu')) play(); });
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = c.querySelector('.menu'); document.querySelectorAll('.card .menu').forEach((m) => m.remove());
    if (open) return;
    const m = document.createElement('div'); m.className = 'menu';
    const item = (t, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (cls) b.className = cls; b.onclick = (ev) => { ev.stopPropagation(); m.remove(); fn(); }; m.append(b); };
    item('▶ Play', play);
    item('Rename…', async () => { const n = prompt('Name:', g.name); if (n && n.trim()) { g.name = n.trim().slice(0, 80); await put('games', g); showLibrary(); } });
    item('Choose a cover picture…', () => pickCover(g, showLibrary));
    if (g.cover) item('Remove the cover (pick the title screen again)', async () => { g.cover = null; g.coverAuto = false; await put('games', g); showLibrary(); });
    item('Save the patched ROM…', () => {
      const a = document.createElement('a'); a.href = blobUrl(new Blob([g.rom])); a.download = g.name.replace(/[\\/:*?"<>|]+/g, '') + (g.system === 'nes' ? '.nes' : '.sfc'); a.click();
    });
    item('Delete', async () => {
      if (!confirm('Delete "' + g.name + '" from this browser? Its in-game saves are kept, so adding it again picks them up.')) return;
      await del('games', g.id); showLibrary();
    }, 'danger');
    c.append(m);
  });
  return c;
}
document.addEventListener('click', (e) => { if (!e.target.closest('.card .more, .card .menu')) document.querySelectorAll('.card .menu').forEach((m) => m.remove()); });

function pickCover(g, after) {
  const f = $('f-cover');
  f.onchange = async () => {
    const file = f.files && f.files[0]; f.value = '';
    if (!file) return;
    g.cover = await shrink(file); g.coverAuto = false;
    await put('games', g); after && after(g);
  };
  f.click();
}
// A picture of the player's, made no bigger than it needs to be (covers stay small)
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise((r) => cv.toBlob(r, 'image/png'));
  } catch (e) { return file; }
}

// ── adding a game ─────────────────────────────────────────────────────────────
const add = { base: null, baseName: '', patch: null, patchName: '', nameTouched: false };
async function openAdd() {
  Object.assign(add, { base: null, baseName: '', patch: null, patchName: '', nameTouched: false });
  $('a-err').hidden = true; $('a-name').value = '';
  $('a-patch-got').textContent = '.ips, .bps, .ups, or the .zip it came in. Leave it empty to add a ROM that’s already patched.';
  $('a-patch-got').className = 'got';
  $('a-base-got').textContent = 'The clean ROM the hack was made for (its page says which: e.g. "Legend of Zelda, The (USA)").';
  $('a-base-got').className = 'got';
  const sel = $('a-base');
  const bases = (await all('bases').catch(() => [])).sort((a, b) => (b.used || 0) - (a.used || 0));
  sel.replaceChildren(new Option(bases.length ? 'Choose a ROM you added before, or a file…' : 'Choose a ROM file…', ''));
  bases.forEach((b) => sel.append(new Option(b.name + ' · ' + SYS[b.system] + ' · CRC ' + b.crc, b.crc)));
  sel.disabled = !bases.length;
  check();
  $('add-dlg').showModal();
}
function check() { $('a-go').disabled = !add.base || !$('a-name').value.trim(); }
function suggestName() {
  if (add.nameTouched) return;
  let n = add.patchName ? cleanName(add.patchName) : add.baseName ? cleanName(add.baseName) : '';
  if (!add.patchName && add.base) n = internalName(add.base) || n;
  $('a-name').value = n; check();
}
async function readFile(file) { return new Uint8Array(await file.arrayBuffer()); }

$('a-base-file').onclick = () => $('f-base').click();
$('f-base').onchange = async () => {
  const f = $('f-base').files && $('f-base').files[0]; $('f-base').value = '';
  if (!f) return;
  try {
    let b = await readFile(f), name = f.name;
    if (isZip(b)) { const z = await fromZip(b, 'rom'); b = z.bytes; name = z.name; }
    const sys = systemOf(b);
    if (!sys) throw new Error('"' + name + '" doesn’t look like an NES (.nes) or SNES (.sfc / .smc) ROM.');
    add.base = b; add.baseName = name;
    $('a-base').value = '';
    $('a-base-got').textContent = '✓ ' + name + ' · ' + SYS[sys] + ' · CRC ' + crcHex(b) + (b.length % 1024 === 512 && sys === 'snes' ? ' · has a copier header' : '');
    $('a-base-got').className = 'got ok'; $('a-err').hidden = true;
    suggestName();
  } catch (e) { showErr(e); }
};
$('a-base').onchange = async () => {
  const k = $('a-base').value; if (!k) return;
  const b = await get('bases', k); if (!b) return;
  add.base = new Uint8Array(b.bytes); add.baseName = b.name;
  $('a-base-got').textContent = '✓ ' + b.name + ' · ' + SYS[b.system] + ' · CRC ' + b.crc; $('a-base-got').className = 'got ok';
  suggestName();
};
$('a-patch-file').onclick = () => $('f-patch').click();
$('f-patch').onchange = async () => {
  const f = $('f-patch').files && $('f-patch').files[0]; $('f-patch').value = '';
  if (!f) return;
  try {
    let b = await readFile(f), name = f.name, extra = '';
    if (isZip(b)) {
      const z = await fromZip(b, 'patch'); b = z.bytes; name = z.name;
      if (z.others.length) extra = ' (the .zip also has ' + z.others.join(', ') + '; to use one of those, unzip it and pick it)';
    }
    const k = patchKind(b);
    if (!k) throw new Error('"' + name + '" isn’t an IPS, BPS or UPS patch. (xdelta patches aren’t supported yet.)');
    add.patch = b; add.patchName = name;
    $('a-patch-got').textContent = '✓ ' + name + ' · ' + k.toUpperCase() + ' patch' + extra; $('a-patch-got').className = 'got ok';
    $('a-err').hidden = true; add.nameTouched = false;
    suggestName();
  } catch (e) { showErr(e); }
};
$('a-name').oninput = () => { add.nameTouched = true; check(); };
$('a-cancel').onclick = () => $('add-dlg').close();
function showErr(e) { const el = $('a-err'); el.textContent = (e && e.message) || String(e); el.hidden = false; }
$('a-go').onclick = async () => {
  $('a-go').disabled = true;
  try {
    const { rom, system, notes } = buildGame(add.base, add.patch);
    const g = { id: newId(), name: $('a-name').value.trim().slice(0, 80), system, rom, patchName: add.patchName || '',
      baseName: add.baseName, baseCrc: crcHex(add.base), added: Date.now(), played: 0, cover: null, coverAuto: false };
    await put('games', g);
    if ($('a-keep').checked) {
      const crc = crcHex(add.base);
      await put('bases', { crc, name: add.baseName, system: systemOf(add.base), bytes: add.base, used: Date.now() }).catch(() => {});
    }
    if (notes.length) sessionStorage.setItem('rhb-patched-note', notes.join(' '));
    $('add-dlg').close();
    location.search = '?play=' + encodeURIComponent(g.id);
  } catch (e) { showErr(e); check(); }
};
$('add-btn').onclick = () => {
  if (document.body.classList.contains('playing')) { if (!confirm('Add another game? This one closes (its save stays).')) return; location.search = '?add=1'; return; }
  openAdd();
};
$('lib-btn').onclick = () => { location.search = ''; };

// ── playing ───────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('couldn’t load ' + src)); document.head.append(s); });
}
// One frame (RGB565) as a canvas
function frameCanvas(f) {
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(f.w, f.h), d = img.data, s = f.data;
  for (let i = 0, o = 0; i < s.length; i++, o += 4) {
    const v = s[i];
    d[o] = ((v >> 11) & 31) * 255 / 31; d[o + 1] = ((v >> 5) & 63) * 255 / 63; d[o + 2] = (v & 31) * 255 / 31; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
// How much of a title screen a frame looks like: lots of colours, little black
function richness(f) {
  const s = f.data, seen = new Set(); let lit = 0, n = 0;
  for (let i = 0; i < s.length; i += 7) { n++; const v = s[i]; if (v & 0xE79C) lit++; if (seen.size < 400) seen.add(v); }
  const frac = lit / Math.max(1, n);
  if (frac < 0.04) return 0;
  return seen.size * Math.min(1, frac * 2.5);
}
const toBlob = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));

async function play(id) {
  const g = await get('games', id).catch(() => null);
  if (!g) { toast('That game isn’t in this browser any more.'); history.replaceState(null, '', location.pathname); return showLibrary(); }
  document.body.classList.add('playing');
  $('lib-btn').hidden = false;
  document.title = g.name + ' - Patched games';
  $('p-name').textContent = g.name;
  $('p-sub').innerHTML = '<span class="sys ' + g.system + '">' + SYS[g.system] + '</span>';
  $('p-sub').append(g.patchName ? 'patched with ' + g.patchName : 'already patched ROM');
  const showCover = (blob) => { const img = $('p-cover'); if (blob) { img.src = blobUrl(blob); img.hidden = false; } else img.hidden = true; };
  showCover(g.cover);
  g.played = Date.now(); put('games', g).catch(() => {});
  const note = sessionStorage.getItem('rhb-patched-note');
  if (note) { sessionStorage.removeItem('rhb-patched-note'); toast(note, 6000); }

  window.EMU_BASE = EMU[g.system];
  try {
    for (const f of ['core.js', 'video.js', 'audio.js', 'input.js', 'player.js']) await loadScript(EMU[g.system] + f);
  } catch (e) { toast('The emulator didn’t load: ' + e.message, 8000); return; }
  const P = g.system === 'nes' ? window.EmuPlayer : window.Snes9xPlayer;
  const small = window.matchMedia('(max-width: 900px), (max-aspect-ratio: 1/1)');
  const place = () => { if (P.setTouchPlacement) P.setTouchPlacement('overlay'); };
  // The cover: the title screen, picked as the game starts (the most colourful
  // frame of the first 15 seconds), unless the game already has one
  let best = null, bestScore = 0, t0 = 0;
  window.EJS_onGameStart = () => {
    t0 = performance.now();
    const iv = setInterval(async () => {
      const core = P.core; if (!core) return;
      const el = (performance.now() - t0) / 1000;
      if (el > 2) {
        const f = core.frame(), sc = richness(f);
        if (sc > bestScore * 1.05) { bestScore = sc; best = frameCanvas(f); if (!g.cover) { $('p-cover').src = best.toDataURL(); $('p-cover').hidden = false; } }
      }
      if (el > 15) {
        clearInterval(iv);
        if (!g.cover && best) { g.cover = await toBlob(best); g.coverAuto = true; put('games', g).catch(() => {}); }
      }
    }, 400);
  };
  $('p-shot').onclick = async () => {
    const core = P.core; if (!core) return;
    g.cover = await toBlob(frameCanvas(core.frame())); g.coverAuto = false;
    await put('games', g); showCover(g.cover); toast('Cover saved');
  };
  $('p-pick').onclick = () => pickCover(g, (x) => { showCover(x.cover); toast('Cover saved'); });
  if (small.addEventListener) small.addEventListener('change', place);
  place();
  // the save file name: unique per game (in-game saves are kept by name)
  P.boot('#game', new File([g.rom], 'patched-' + g.id + (g.system === 'nes' ? '.nes' : '.sfc')))
    .catch((e) => { console.error('[patched]', e); toast('The game didn’t start: ' + (e && e.message || e), 8000); });
  place();
  // Zelda 3 hacks get a world map (z3map.js): it shows itself once such a ROM runs
  if (g.system !== 'nes' && window.Z3Map) Z3Map.attach({ player: P, host: $('p-map'), gameId: g.id });
}

const q = new URLSearchParams(location.search);
if (q.get('play')) play(q.get('play'));
else { showLibrary(); if (q.get('add')) { history.replaceState(null, '', location.pathname); openAdd(); } }
