/*
 * z3-media.js — Link's sprite and MSU-1 music for every game with Zelda 3 in
 * it outside the Zelda 3 page itself: the combos (SMZ3, Rando Cross) and Zelda 3 ROM
 * hacks and seeds on Patched games. Set up the way the Zelda 3 page does it,
 * with the same library,
 * favourites, your own sprite files and "My packs" (one browser store:
 * the Zelda 3 page's, so a sprite starred or a pack added on either shows
 * up on both).
 *
 *   Sprite: "Same as Zelda 3" (whatever Link wears there: the default), the
 *   game's own Link, or any sprite from the library / your files / 🎲. It's
 *   written into the combo ROM where samus.link puts it (Link's sheet at
 *   $10:8000, his mail colours at $1B:D308, the gloves at $1B:EDF5, the
 *   author in the credits), at every boot, and into the running game at once.
 *
 *   Music: an SMZ3 MSU-1 pack (Zelda's songs numbered 1–61 as in ALttP packs,
 *   Super Metroid's 101–140). The emulator has no MSU-1 chip, so as on the
 *   Zelda 3 page the hub plays the songs beside it:
 *     Hyrule: the ROM's "no background music" flag ($40:021A) keeps the game's
 *       own music quiet, and ../randomizer/msu.js follows the song Zelda asks for.
 *     Zebes: the ROM's own MSU-1 code for Super Metroid (src/sm/msu.asm in the
 *       combo ROM) is let past its "is there an MSU-1?" check, so it silences
 *       the game's music itself when a song of the pack plays (and lets the
 *       game's own play where the pack has none, from the track table the hub
 *       writes into save RAM at $A1:7F70); the hub works out the same song from
 *       the game's music state and plays it.
 *   A Zelda 3 pack works too: Hyrule gets its songs, Zebes keeps the game's.
 *
 *   A Zelda 3 ROM on its own (a hack, or a seed played as a patched game):
 *   the sprite where the Zelda 3 page puts it (sprite.js), "Default Link" being
 *   the ROM's own (a hack's Link stays the hack's); music when the ROM is a
 *   randomizer seed (its "music off" flag at 0x18021A, as on the Zelda 3 page);
 *   a plain hack has no MSU-1 code to follow, so its music stays its own.
 *
 *   A new page with Zelda 3 in it: load this as a module and boot the ROM
 *   through prepare() (ADDING-A-GAME.md). The 🎨 Sprite & music button goes
 *   after the header's New seed / 🎲 Reroll, or before #lib-btn (Patched
 *   games, shown only while a Zelda 3 game runs).
 *
 *   window.RHZ3Media.prepare(romBytes) → Promise<the ROM to boot>   (any ROM: others come back as they are)
 */
import { parseSprite, drawHead, applySprite } from './randomizer/sprite.js';
import { MsuPlayer, trackNumber, isRandoTitle } from './randomizer/msu.js';
import { listZip, zipEntryBlob } from './randomizer/zip.js';
import { openLibrary, labelOf, isPlainLink, loadList } from './randomizer/library.js';
import { createCollection, keyOf, pickFrom } from './randomizer/collection.js';

const $ = (id) => document.getElementById(id);
const G = () => window.SMZ3Gen;
const SN = (a) => G().snes(a);

// ── the Zelda 3 page's store ────────────────────────────────────────────────
let dbp = null;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open('rhb-beta-s9x-kara', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
async function kvGet(k) { const db = await idb(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
async function kvDel(k) { const db = await idb(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
const coll = createCollection({ kvGet, kvSet, kvDel });

// ── the combo ROM ───────────────────────────────────────────────────────────
const core = () => { const p = window.Snes9xPlayer; return p && p.core; };
const game = () => { const c = core(); try { const s = c && c.sram(); return s && s.length > 0x33FE ? s[0x33FE] : null; } catch (e) { return null; } };   // 0 Zelda, $FF Super Metroid
const isCombo = (rom) => !!rom && rom.length >= 0x600000 && rom[0xFFC0] === 0x5A && rom[0xFFC1] === 0x53 && rom[0xFFC2] === 0x4D;   // "ZSM" (ExHiROM header at $00:FFC0)
// a Zelda 3 ROM on its own (LoROM, title at 0x7FC0): the game, a hack of it, or a randomizer seed (h: a copier header's 512 bytes)
function z3Kind(rom) {
  if (!rom || rom.length < 0x100000) return null;
  const h = rom.length % 1024 === 512 ? 512 : 0;
  let t = ''; for (let i = 0; i < 21; i++) t += String.fromCharCode(rom[h + 0x7FC0 + i]);
  if (/^THE LEGEND OF ZELDA|^ZELDANODENSETSU/.test(t)) return { kind: 'z3', h, seed: false };
  if (/^(VT|GK|DR|ER|OR)/.test(t) && rom.length - h >= 0x200000 && isRandoTitle(rom.subarray(h + 0x7FC0, h + 0x7FC2))) return { kind: 'z3', h, seed: true };
  return null;
}
function romKind(rom) { return isCombo(rom) ? { kind: 'combo', h: 0, seed: true } : z3Kind(rom); }
let bootKind = null, bootOrig = null;   // the game booted through prepare(): its kind, and its ROM as it came (headerless)

const BIG = {}; ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').forEach((c, i) => {
  if (c === ' ') BIG[c] = [0x7F, 0x7F];
  else if (i <= 16) BIG[c] = [0x1F + i, 0x2F + i];                 // A–P
  else if (i <= 26) BIG[c] = [0x40 + i - 17, 0x50 + i - 17];       // Q–Z
  else BIG[c] = [0x60 + i - 27, 0x70 + i - 27];                    // 0–9
});
function writeSprite(rom, sp, plain, k) {
  if (k && k.kind === 'z3') {   // the Zelda 3 page's own writer, on the ROM without its header
    const r = rom.subarray(k.h);
    if (sp) applySprite(r, sp);
    else if (plain) [[0x80000, 0x7000], [0xDD308, 120], [0xDEDF5, 4]].forEach(([a, n]) => r.set(plain.subarray(a, a + n), a));
    return;
  }
  if (sp) {
    const b = sp.bytes, u32 = (i) => (b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24) >>> 0;
    let gfx, pal, gl;
    if (sp.kind === 'spr') { gfx = 0; pal = 0x7000; gl = [b[0x7036], b[0x7037], b[0x7054], b[0x7055]]; }
    else { gfx = u32(9); pal = u32(15); gl = Array.from(b.subarray(pal + 120, pal + 124)); }
    if (gfx !== 0xFFFFFFFF) rom.set(b.subarray(gfx, gfx + 0x7000), SN(0x108000));
    rom.set(b.subarray(pal, pal + 120), SN(0x1BD308));
    rom.set(gl, SN(0x1BEDF5));
  } else if (plain) {   // the game's own Link, from the plain Zelda ROM
    const pc = (a) => ((a >> 16) << 15) | (a & 0x7FFF);
    rom.set(plain.subarray(pc(0x108000), pc(0x108000) + 0x7000), SN(0x108000));
    rom.set(plain.subarray(pc(0x1BD308), pc(0x1BD308) + 120), SN(0x1BD308));
    rom.set(plain.subarray(pc(0x1BEDF5), pc(0x1BEDF5) + 4), SN(0x1BEDF5));
  }
}
function writeAuthor(rom, author) {   // samus.link's "sprite by" line in the credits
  author = String(author || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/ +/g, ' ').trim().slice(0, 30).trim();
  if (!/[A-Z0-9]/.test(author)) return;
  const pad = (32 - author.length) >> 1;
  rom[SN(0xF47002)] = 1;
  author.split('').forEach((c, i) => { const t = BIG[c] || BIG[' ']; rom[SN(0xFD1480 + 2 * (pad + i))] = t[0]; rom[SN(0xFD1480 + 2 * (pad + i + 32))] = t[1]; });
}
// the music switches: Zelda's music off; Super Metroid's MSU-1 code past its check (BEQ → BRA)
const SM_CHECK = 0x00F947, SM_CHECK_BYTES = [0xAD, 0x02, 0x20, 0xC9, 0x53];
function writeMusic(rom, on, k) {
  if (k && k.kind === 'z3') { if (k.seed) rom[k.h + 0x18021A] = on ? 1 : 0; return; }
  rom[0x40021A] = on ? 1 : 0;
  if (SM_CHECK_BYTES.every((v, i) => rom[SM_CHECK + i] === v) && (rom[SM_CHECK + 5] === 0xF0 || rom[SM_CHECK + 5] === 0x80) && rom[SM_CHECK + 6] === 0x03) rom[SM_CHECK + 5] = on ? 0x80 : 0xF0;
}

// ── the sprite choice: 'combo-sprite' = { mode: 'z3' | 'plain' } or a sprite record ──
async function spriteChoice() {
  const c = await kvGet('combo-sprite').catch(() => null);
  if (c && c.bytes) return { kind: 'own', rec: c, label: c.label };
  if (c && c.mode === 'plain') return { kind: 'plain', label: 'Link (the game’s own)' };
  const z = await kvGet('sprite').catch(() => null);
  return z && z.bytes ? { kind: 'z3', rec: z, label: z.label + ' (as on Zelda 3)' } : { kind: 'z3', rec: null, label: 'Same as Zelda 3 (the game’s own Link there)' };
}
async function plainZelda() {
  const st = window.SMZ3Store; if (!st) return null;
  const b = await st.get('base-z3').catch(() => null);
  if (!b || !b.bytes) return null;
  const u = new Uint8Array(b.bytes); return u.subarray(u.length % 1024 === 512 ? 512 : 0);
}
async function spritePatch(rom, k) {
  const ch = await spriteChoice();
  if (ch.rec && ch.rec.bytes) { let sp; try { sp = parseSprite(ch.rec.bytes); } catch (e) { return; } writeSprite(rom, sp, null, k); if (k.kind === 'combo') writeAuthor(rom, sp.authorShort || sp.author); return; }
  if (ch.kind === 'plain' && k.kind === 'combo') { const p = await plainZelda(); if (p) writeSprite(rom, null, p); }   // (a Zelda 3 ROM's own Link is already there)
  // "Same as Zelda 3" with the game's own Link there: the ROM as it is (a samus.link seed keeps its own sprite)
}
// Link's colours in the running game (Hyrule): the palette buffer, uploaded next frame (as the Zelda 3 page does)
function liveColours(rom, k) {
  const c = core(); if (!c || (k.kind === 'combo' && game() !== 0)) return;
  const r = c.wram(), set = r[0x02E0] ? 3 : Math.min(r[0xF35B], 2), base = k.kind === 'combo' ? SN(0x1BD308) : 0xDD308, gbase = k.kind === 'combo' ? SN(0x1BEDF5) : 0xDEDF5;
  const pal = rom.slice(base + set * 30, base + set * 30 + 30);
  const gl = r[0xF354]; if (gl === 1 || gl === 2) { const g = gbase + (gl - 1) * 2; pal[24] = rom[g]; pal[25] = rom[g + 1]; }
  r.set(pal, 0xC6E2); r.set(pal, 0xC4E2); r[0x15] = 1;
}
async function liveSprite() {
  const c = core(); const rom = c && c.rom && c.rom(); const k = romKind(rom); if (!k) return false;
  const ch = await spriteChoice();
  if (ch.rec && ch.rec.bytes) writeSprite(rom, parseSprite(ch.rec.bytes), null, k);
  else if (k.kind === 'z3') { if (!bootOrig) return false; writeSprite(rom, null, bootOrig, k); }   // its own Link, from the ROM as it booted
  else { const p = await plainZelda(); if (!p) return false; writeSprite(rom, null, p); }
  liveColours(rom, k);
  return true;
}

// ── music ───────────────────────────────────────────────────────────────────
// Super Metroid's songs (src/sm/msu.asm): the music value in the bank being played → the pack's song (+100)
const SM_BANKS = [[4, 5], [4, 5], [6, 0, 7], [8, 9], [10], [11], [12], [13], [14], [15, 16], [17, 0], [18], [19, 21, 20], [22, 23], [24], [0, 25, 0], [26, 27], [0, 0, 0], [28], [29], [30], [0], [0], [22, 23], [10]];
const BOSS2 = [0, 32, 0, 34, 0, 38], TENSION = [0, 31, 0, 33, 0, 37];
const SM_ONCE = new Set([101, 102, 129, 130]);
class ComboMsu extends MsuPlayer {
  constructor() { super(); this.on = false; this.smLast = -1; this.lastGame = null; }
  playOnce(t) { return t > 100 ? SM_ONCE.has(t) : super.playOnce(t); }
  active() { const c = core(); return this.on && this.tracks.size > 0 && !!c && !!window.Snes9xPlayer.ready && !!bootKind && bootKind.seed; }
  ram(addr, len = 1) { const c = core(); const r = c && c.wram(); return r ? r.subarray(addr, addr + len) : new Uint8Array(len); }
  has(t) { return this.tracks.has(t + 100); }
  smTrack() {
    const r = this.ram(0, 0x1000), w = (a) => r[a] | r[a + 1] << 8;
    const cur = r[0x64C] & 0x7F; if (!cur) return 0;
    const fall = (m) => (this.has(m) ? m + 100 : 0);
    if (cur === 4) return r[0x998] === 0x1A ? fall(40) : 0;   // game over; other ambience: the game's
    let m = cur;
    if (cur >= 5) { const bank = SM_BANKS[Math.floor(r[0x7F3] / 3)]; m = bank ? bank[cur - 5] || 0 : 0; if (!m) return 0; }
    let ext = 0;
    if (m === 10) { const room = w(0x79B); if (room === 0xDCB1) return 0; if (room === 0xDD58) ext = 39; }
    else if (m === 19) { const room = w(0x79B); if (room === 0xDA60) ext = 35; if (room === 0xB32E) ext = 36; }
    else if (m === 22) ext = BOSS2[r[0x79F]] || 0;
    else if (m === 23) ext = TENSION[r[0x79F]] || 0;
    if (ext && this.has(ext)) return ext + 100;
    return fall(m);
  }
  // the ROM's own track table (save RAM $A1:7F70): which Super Metroid songs the pack has
  writeTable() {
    const c = core(); const s = c && c.sram(); if (!s || s.length < 0x3F78) return;
    for (let x = 0; x < 5; x++) { let v = 0; for (let y = 0; y < 8; y++) if (this.has(x * 8 + y + 1)) v |= 1 << y; s[0x3F70 + x] = v; }
  }
  tick() {
    if (!this.active()) { if (this.playing) this.stop(); return; }
    const g = bootKind && bootKind.kind === 'z3' ? 0 : game();   // a Zelda 3 seed: always Hyrule
    if (g !== this.lastGame) { this.lastGame = g; this.stopSource(); this.playing = 0; this.lastCmd = 0; this.smLast = -1; }
    if (g === 0) { super.tick(); return; }
    if (g !== 0xFF) return;   // the credits: as it is
    this.writeTable();
    const now = performance.now(), frame = this.ram(0x5B6)[0];
    if (frame !== this.lastFrame) { this.lastFrame = frame; this.lastFrameAt = now; }
    const paused = now - this.lastFrameAt > 600;
    if (this.ctx) {
      if (paused && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      if (!paused && !document.hidden && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }
    if (paused) return;
    this.keepLooping();
    const t = this.smTrack();
    if (t !== this.smLast) {
      this.smLast = t; this.target = 1; this.fadingOut = false;
      if (t) this.request(0, t); else { this.stopSource(); this.playing = 0; }
    }
    this.applyVolume(now);
  }
}
const msu = new ComboMsu();
let packs = [], current = null;
const zipTracks = (zip, list) => new Map(list.map(([n, ent]) => [n, () => zipEntryBlob(zip, ent)]));
async function loadPacks() {
  packs = (await kvGet('msu-packs').catch(() => null)) || [];
  current = (await kvGet('combo-msu-current').catch(() => null)) || null;
  if (current && !packs.some((p) => p.id === current)) current = null;
}
async function startPack(id) {
  const meta = packs.find((p) => p.id === id); if (!meta) return false;
  const data = await kvGet('msu-pack:' + id).catch(() => null);
  if (!data) return false;
  msu.setTracks(data.zip ? zipTracks(data.zip, data.entries) : new Map(data.tracks.map(([n, f]) => [n, f])));
  msu.on = true; msu.start();
  return true;
}
function liveMusic(on) { const c = core(); const rom = c && c.rom && c.rom(); const k = romKind(rom); if (k && k.seed) { writeMusic(rom, on, k); if (msu.restart) msu.restart(); return true; } return false; }
async function usePack(id) {
  msu.unlock();
  current = id || null;
  if (id) await kvSet('combo-msu-current', id).catch(() => {}); else await kvDel('combo-msu-current');
  if (!id) { msu.on = false; msu.stop(); liveMusic(false); return; }
  if (!(await startPack(id))) throw new Error('That pack isn’t in this browser any more: add it again.');
  liveMusic(true);
}
function packFiles(list) {   // the folder that holds the songs (not "Alternative" subfolders)
  const by = new Map();
  for (const f of list) { if (trackNumber(f.name) === null) continue; const p = f.webkitRelativePath || f.name, d = p.slice(0, p.lastIndexOf('/') + 1); if (!by.has(d)) by.set(d, []); by.get(d).push(f); }
  let best = [];
  for (const [, fs] of by) { const dep = (fs[0].webkitRelativePath || '').split('/').length, bd = best.length ? (best[0].webkitRelativePath || '').split('/').length : Infinity; if (!best.length || dep < bd || (dep === bd && fs.length > best.length)) best = fs; }
  return best;
}
async function addPack(fileList) {
  msu.unlock();
  const zip = [...fileList].find((f) => /\.zip$/i.test(f.name));
  let data, count, size, name;
  if (zip) {
    const pcm = (await listZip(zip)).map((ent) => ({ ent, name: ent.path.split('/').pop(), webkitRelativePath: ent.path }))
      .filter((f) => !/(^|\/)__MACOSX\//.test(f.ent.path) && !f.name.startsWith('._') && trackNumber(f.name) !== null);
    const fs = packFiles(pcm); if (!fs.length) throw new Error('No MSU-1 .pcm files in that .zip.');
    const list = fs.map((f) => [trackNumber(f.name), f.ent]);
    name = zip.name.replace(/\.zip$/i, ''); data = { name, zip, entries: list }; count = list.length; size = zip.size;
  } else {
    const fs = [...fileList].filter((f) => trackNumber(f.name) !== null);
    if (!fs.length) throw new Error('Choose an MSU-1 pack: its .zip, or all its .pcm files (named like pack-1.pcm, pack-101.pcm, …).');
    const tracks = [...new Map(fs.map((f) => [trackNumber(f.name), f]))];
    name = fs[0].name.replace(/-\d+\.pcm$/i, ''); count = tracks.length; size = fs.reduce((n, f) => n + f.size, 0);
    data = { name, tracks: tracks.map(([n, f]) => [n, new Blob([f], { type: 'application/octet-stream' })]) };
  }
  await loadPacks();
  const same = packs.find((p) => (p.src || p.name) === name && p.count === count && p.size === size);
  if (same) { await usePack(same.id); return same.name; }
  const id = 'p' + Date.now().toString(36);
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
  await kvSet('msu-pack:' + id, data);
  packs.push({ id, name, src: name, count, size, fav: false });
  await kvSet('msu-packs', packs);
  await usePack(id);
  return name;
}
const smz3Pack = (p) => p && p.count > 61;   // (packs with Super Metroid's songs have more than Zelda's 61)

// ── boot ────────────────────────────────────────────────────────────────────
async function prepare(bytes) {
  const k = romKind(bytes);
  if (!k) { bootKind = null; showButton(); return bytes; }
  bootKind = k; bootOrig = k.kind === 'z3' ? bytes.slice(k.h) : null;
  showButton();
  const rom = bytes.slice();
  try { await spritePatch(rom, k); } catch (e) { console.warn('[z3 media] sprite skipped', e); }
  try { await loadPacks(); if (k.seed && current && await startPack(current)) writeMusic(rom, true, k); } catch (e) { console.warn('[z3 media] music skipped', e); }
  return rom;
}

// ── the dialog ──────────────────────────────────────────────────────────────
const CSS = `
#cm-dlg { background: var(--win2, #1a1230); color: var(--text, #eee); border: 2px solid var(--line, #3fa860); border-radius: 6px; padding: 0; width: min(560px, calc(100vw - 20px)); max-height: calc(100dvh - 20px); overflow: auto; }
#cm-dlg::backdrop { background: rgba(0,0,10,.7); }
#cm-dlg .cm-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 2px solid var(--line, #3fa860); }
#cm-dlg h2 { margin: 0; font: 600 20px/1 var(--px, monospace); color: var(--gold, #f0c840); }
#cm-dlg h3 { margin: 0 0 8px; font: 400 16px/1 var(--px, monospace); color: var(--gold, #f0c840); }
#cm-dlg section { padding: 12px 16px; border-bottom: 1px solid var(--cell-line, #3a2c60); }
#cm-dlg .cm-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
#cm-dlg .cm-cur { display: flex; gap: 10px; align-items: center; margin: 0 0 10px; }
#cm-dlg .cm-cur canvas, #cm-dlg .cm-cur img { width: 32px; height: 32px; image-rendering: pixelated; background: #000; border: 1px solid var(--cell-line, #3a2c60); border-radius: 4px; object-fit: contain; }
#cm-dlg .cm-cur b { font-weight: 400; }
#cm-dlg .cm-note { font-size: 12.5px; color: var(--dim, #a69cc0); margin: 8px 0 0; }
#cm-dlg select { background: #000020; color: inherit; border: 2px solid var(--cell-line, #3a2c60); border-radius: 4px; padding: 6px; font: inherit; font-size: 14px; flex: 1 1 220px; min-width: 0; }
#cm-dlg .cm-msg { font-size: 13px; color: var(--green, #58d890); margin: 8px 0 0; min-height: 1em; } #cm-dlg .cm-msg.bad { color: var(--red, #ff6a5a); }
#cm-dlg .x { background: none; border: 0; color: inherit; font-size: 28px; line-height: 1; cursor: pointer; width: 44px; height: 44px; margin: -8px -10px -8px 0; }
#sprite-lib { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.6); --panel: var(--win2, #1a1230); --accent: var(--gold, #f0c840); }
#sprite-lib[hidden] { display: none; }
#sprite-lib .sl-box { display: flex; flex-direction: column; width: min(980px, 100%); max-height: 100%; background: var(--panel); border: 1px solid var(--line, #3fa860); border-radius: 10px; overflow: hidden; color: var(--text, #eee); }
#sprite-lib .sl-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--cell-line, #3a2c60); }
#sprite-lib .sl-head b { margin-right: auto; }
#sprite-lib button, #sprite-lib select, #sprite-lib .filebtn { background: var(--cell, #1e1638); color: inherit; border: 1px solid var(--cell-line, #3a2c60); border-radius: 6px; padding: 5px 9px; font: inherit; font-size: 13px; cursor: pointer; }
#sl-search { background: #0d1117; color: inherit; border: 1px solid var(--cell-line, #3a2c60); border-radius: 6px; padding: 5px 8px; font: inherit; font-size: 13px; width: 16em; max-width: 100%; }
#sl-grid { flex: 1; overflow-y: auto; padding: 10px; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
#sl-grid .sl-cell { position: relative; display: flex; min-width: 0; }
#sl-grid .sl-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px 6px; min-width: 0; }
#sl-grid .sl-star, #sl-grid .sl-del { position: absolute; top: 2px; width: 26px; height: 26px; padding: 0; min-width: 0; display: flex; align-items: center; justify-content: center; border: 0; background: transparent; font-size: 16px; line-height: 1; color: var(--dim, #a69cc0); }
#sl-grid .sl-star { right: 2px; } #sl-grid .sl-star.on { color: #f5c542; } #sl-grid .sl-del { left: 2px; font-size: 12px; opacity: .7; }
#sl-grid .sl-cell.own .sl-item { border-style: dashed; }
#sprite-lib .sl-views { display: flex; gap: 4px; flex: 1 1 260px; flex-wrap: wrap; align-items: center; }
#sprite-lib .sl-views [aria-selected=true] { border-color: var(--accent); }
#sprite-lib .sl-count:empty { display: none; } #sprite-lib .sl-count { font-size: 11px; color: var(--dim, #a69cc0); margin-left: 2px; }
#sl-grid .sl-item img { width: 32px; height: 48px; image-rendering: pixelated; }
#sl-grid .sl-item canvas.sl-head-only { width: 32px; height: 32px; margin: 8px 0; image-rendering: pixelated; }
#sl-grid .sl-item .sl-name { font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#sl-grid .sl-item .sl-author { font-size: 10px; color: var(--dim, #a69cc0); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#sl-grid .sl-item.picking { border-color: var(--accent); }
#sprite-lib.busy #sl-grid { opacity: .6; pointer-events: none; }
#sprite-lib .sl-note { padding: 8px 12px; border-top: 1px solid var(--cell-line, #3a2c60); font-size: 12px; color: var(--dim, #a69cc0); }
`;
const HTML = `
<dialog id="cm-dlg" aria-labelledby="cm-title"><form method="dialog">
  <div class="cm-head"><h2 id="cm-title">Sprite &amp; music</h2><button class="x" value="close" aria-label="Close">×</button></div>
  <section>
    <h3>Link's sprite</h3>
    <div class="cm-cur"><span id="cm-prev"></span><b id="cm-sprite-name"></b></div>
    <div class="cm-row">
      <button type="button" class="btn" id="cm-lib">Library…</button>
      <button type="button" class="btn" id="cm-rand" title="A random sprite from the library and your own">🎲</button>
      <button type="button" class="btn" id="cm-fav" title="A random one of your ★ favourites">🎲★</button>
      <button type="button" class="btn" id="cm-same" title="Whatever Link wears on the Zelda 3 page">Same as Zelda 3</button>
      <button type="button" class="btn" id="cm-plain" title="The game's own Link">Default Link</button>
    </div>
    <p class="cm-note">The library, ★ favourites and your own sprite files are the Zelda 3 page's. Changed in the running game at once (in Hyrule, his colours too; elsewhere when you're next there) and kept for every boot.</p>
  </section>
  <section>
    <h3>MSU-1 music</h3>
    <div class="cm-row"><select id="cm-pack" aria-label="MSU-1 pack"></select>
      <label class="btn" for="cm-pack-in" title="An MSU-1 pack: its .zip, or all its .pcm files">Add pack…</label><input type="file" id="cm-pack-in" multiple accept=".zip,.pcm" hidden></div>
    <p class="cm-note" id="cm-nomusic" hidden>This game is a Zelda 3 hack without the randomizer's MSU-1 support, so its music stays its own (a pack plays on randomizer seeds and the combos).</p>
    <p class="cm-note">An SMZ3 pack has Zelda's songs as 1–61 and Super Metroid's as 101–140 and plays in both worlds; a Zelda 3 pack plays in Hyrule only. My packs are shared with the Zelda 3 page. Super Metroid's songs come in at the next song change.</p>
  </section>
  <section><p class="cm-msg" id="cm-msg"></p></section>
</form>
<div id="sprite-lib" hidden role="dialog" aria-modal="true" aria-label="Sprite library">
  <div class="sl-box">
    <div class="sl-head">
      <b>Sprite library</b>
      <input type="search" id="sl-search" placeholder="Search names, authors, tags" autocomplete="off" spellcheck="false">
      <select id="sl-tag" aria-label="Tag"><option value="">All tags</option></select>
      <button type="button" id="sl-random" title="Pick one at random (from the ones shown)">Random</button>
      <button type="button" id="sl-close" aria-label="Close">&#10005;</button>
      <div class="sl-views" role="tablist" aria-label="Show">
        <button type="button" role="tab" data-view="all">All</button>
        <button type="button" role="tab" data-view="fav">&#9733; Favorites <span class="sl-count"></span></button>
        <button type="button" role="tab" data-view="own">Mine <span class="sl-count"></span></button>
      </div>
      <label class="filebtn" for="sl-add-input" title="Keep your own .zspr / .spr files in this list">+ Add files</label>
      <input type="file" id="sl-add-input" multiple accept=".zspr,.spr" hidden>
    </div>
    <div id="sl-grid"></div>
    <div id="sl-note" class="sl-note"></div>
  </div>
</div>
</dialog>`;

function say(t, bad) { const m = $('cm-msg'); if (m) { m.textContent = t || ''; m.className = 'cm-msg' + (bad ? ' bad' : ''); } }
async function paintSprite() {
  const ch = await spriteChoice();
  $('cm-sprite-name').textContent = ch.label;
  const host = $('cm-prev'); host.innerHTML = '';
  if (ch.rec && ch.rec.preview) { const im = new Image(); im.src = ch.rec.preview; im.alt = ''; host.appendChild(im); }
  else if (ch.rec && ch.rec.bytes) { const c = document.createElement('canvas'); try { drawHead(parseSprite(ch.rec.bytes), c); } catch (e) {} host.appendChild(c); }
  else { const c = document.createElement('canvas'); c.width = c.height = 16; host.appendChild(c); }
  const b = $('cm-media-btn'); if (b) b.title = 'Sprite: ' + ch.label + ' · Music: ' + packLabel();
}
const packLabel = () => { const p = packs.find((x) => x.id === current); return p ? p.name : 'the game’s own'; };
async function paintPacks() {
  await loadPacks();
  const sel = $('cm-pack');
  sel.innerHTML = '<option value="">The game’s own music</option>' + packs.map((p) => '<option value="' + p.id + '">' + esc(p.name) + ' · ' + p.count + ' songs' + (smz3Pack(p) ? '' : ' (Zelda only)') + '</option>').join('');
  sel.value = current || '';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function setSprite(rec, what) {
  if (rec) await kvSet('combo-sprite', rec); else await kvDel('combo-sprite');
  const live = await liveSprite().catch(() => false);
  await paintSprite();
  say('Sprite: ' + what + (live ? ' (changed in this game).' : ' (for the next game).'));
}
async function useLibrary(entry) {
  if (isPlainLink(entry)) { await setSprite({ mode: 'plain' }, 'Link (the game’s own)'); return; }
  const bytes = await coll.bytesFor(entry);
  parseSprite(bytes);
  const label = entry.label || labelOf(entry);
  const rec = { bytes: bytes.slice(), label, key: keyOf(entry) };
  if (!entry.own && entry.preview) rec.preview = entry.preview;
  await setSprite(rec, label);
}
async function randomSprite(favs) {
  say(favs ? 'Picking one of your favourites…' : 'Picking a random sprite…');
  try {
    const cur = await kvGet('combo-sprite').catch(() => null);
    let pool;
    if (favs) { pool = await coll.favEntries(await loadList().catch(() => [])); if (!pool.length) throw new Error('No ★ favourites yet: star some in the Library.'); }
    else pool = coll.ownEntries().concat((await loadList()).filter((e) => !isPlainLink(e)));
    const e = pickFrom(pool, cur && cur.key); if (!e) throw new Error('No sprites to pick from.');
    await useLibrary(e);
  } catch (e) { say(String(e.message || e), true); }
}

function build() {
  if ($('cm-dlg')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const wrap = document.createElement('div'); wrap.innerHTML = HTML; while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  // the header button: after New seed / 🎲 Reroll (the combos), or before ◂ Library (Patched games, while a Zelda 3 game runs)
  const ns = $('new-seed'), lib = $('lib-btn');
  if ((ns || lib) && !$('cm-media-btn')) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'cm-media-btn'; b.innerHTML = '🎨<span class="hub-short"> Sprite &amp; music</span>';
    b.addEventListener('click', open);
    if (ns) { const after = $('hub-reroll') || ns; after.parentNode.insertBefore(b, after.nextSibling); }
    else { b.hidden = true; lib.parentNode.insertBefore(b, lib); }
  }
  $('cm-lib').addEventListener('click', () => openLibrary($, useLibrary, coll));
  $('cm-rand').addEventListener('click', () => randomSprite(false));
  $('cm-fav').addEventListener('click', () => randomSprite(true));
  $('cm-same').addEventListener('click', async () => { await kvDel('combo-sprite'); const ch = await spriteChoice(); const live = ch.rec ? await liveSprite().catch(() => false) : false; await paintSprite(); say('Sprite: same as Zelda 3' + (live ? ' (changed in this game).' : ' (from the next boot).')); });
  $('cm-plain').addEventListener('click', () => setSprite({ mode: 'plain' }, 'Link (the game’s own)').catch((e) => say(String(e.message || e), true)));
  $('cm-pack').addEventListener('change', (e) => { const id = e.target.value || null; usePack(id).then(() => { say(id ? 'Music: ' + packLabel() + '.' : 'Music: the game’s own.'); paintSprite(); }, (er) => say(String(er.message || er), true)); });
  $('cm-pack-in').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    say('Adding the pack…');
    try { const n = await addPack(files); await paintPacks(); say('Music: ' + n + ', kept in My packs.'); paintSprite(); } catch (er) { say(String(er.message || er), true); }
  });
}
function showButton() { const b = $('cm-media-btn'); if (b && !$('new-seed')) b.hidden = !bootKind; }
async function open() {
  build(); msu.unlock(); say(''); await paintSprite(); await paintPacks();
  const noMusic = bootKind && !bootKind.seed;
  $('cm-pack').disabled = !!noMusic;
  $('cm-nomusic').hidden = !noMusic;
  $('cm-dlg').showModal();
}

function init() { build(); loadPacks().then(paintSprite).catch(() => {}); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
// the first tap on the page lets the music start (browsers want one)
document.addEventListener('pointerdown', () => { if (msu.on) msu.unlock(); }, { capture: true });
document.addEventListener('keydown', () => { if (msu.on) msu.unlock(); }, { capture: true });

window.RHZ3Media = window.RHComboMedia = { prepare, open, romKind, get msu() { return msu; } };
