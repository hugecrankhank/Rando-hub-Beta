// Patched games: apply a ROM hack's patch (IPS, UPS or BPS) to the player's
// own ROM, in the browser. Nothing is uploaded and no ROM or hack is shipped
// with the app: the player brings both files.
//
//   const { rom, system, notes } = await buildGame(romBytes, patchBytes | null)
//
// Copier headers (SNES ROMs with an extra 512 bytes in front) are handled: a
// UPS / BPS patch says which ROM it wants (CRC32), so the headered or plain
// copy that matches is used; for IPS (which can't say) the copy whose result
// has a valid SNES header checksum wins, else the ROM as given.

import { applyBps, crc32 } from '../randomizer/bps.js';
import { listZip, zipEntryBlob } from '../randomizer/zip.js';

export { crc32 };
const PATCH_EXT = /\.(ips|bps|ups)$/i;
const ROM_EXT = /\.(nes|sfc|smc|fig|swc)$/i;

const magic = (b, s) => b.length >= s.length && [...s].every((ch, i) => b[i] === ch.charCodeAt(0));
export function patchKind(b) {
  if (magic(b, 'PATCH')) return 'ips';
  if (magic(b, 'UPS1')) return 'ups';
  if (magic(b, 'BPS1')) return 'bps';
  return null;
}
export const isZip = (b) => b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4;

/** A .zip's patch or ROM, picked out: { bytes, name } (or throws). want: 'patch' | 'rom' */
export async function fromZip(bytes, want) {
  const blob = new Blob([bytes]);
  const files = await listZip(blob);
  const re = want === 'patch' ? PATCH_EXT : ROM_EXT;
  const hits = files.filter((f) => re.test(f.path) && !/(^|\/)__MACOSX\//.test(f.path));
  if (!hits.length) throw new Error(want === 'patch' ? 'There’s no .ips, .bps or .ups patch in that .zip.' : 'There’s no ROM (.nes, .sfc, .smc) in that .zip.');
  // A hack with several patches (versions, options): the biggest is usually the main one
  hits.sort((a, b) => b.size - a.size);
  const ent = hits[0];
  const out = new Uint8Array(await (await zipEntryBlob(blob, ent)).arrayBuffer());
  return { bytes: out, name: ent.path.split('/').pop(), others: hits.slice(1).map((h) => h.path.split('/').pop()) };
}

// ── IPS ──────────────────────────────────────────────────────────────────────
export function applyIps(src, p) {
  if (!magic(p, 'PATCH')) throw new Error('That isn’t an IPS patch.');
  let out = new Uint8Array(Math.max(src.length, 0));
  out.set(src);
  const grow = (n) => { if (n > out.length) { const o = new Uint8Array(n); o.set(out); out = o; } };
  let i = 5;
  for (;;) {
    if (i + 3 > p.length) throw new Error('The IPS patch is cut short.');
    if (p[i] === 0x45 && p[i + 1] === 0x4F && p[i + 2] === 0x46) {    // EOF
      i += 3;
      if (i + 3 <= p.length) { const t = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2]; if (t < out.length) out = out.slice(0, t); }  // truncate extension
      return out;
    }
    const off = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
    const size = (p[i + 3] << 8) | p[i + 4];
    i += 5;
    if (size) {
      if (i + size > p.length) throw new Error('The IPS patch is cut short.');
      grow(off + size); out.set(p.subarray(i, i + size), off); i += size;
    } else {                                                          // RLE
      const n = (p[i] << 8) | p[i + 1], v = p[i + 2];
      i += 3; grow(off + n); out.fill(v, off, off + n);
    }
  }
}

// ── UPS ──────────────────────────────────────────────────────────────────────
export function applyUps(src, p, { checkSource = true } = {}) {
  if (!magic(p, 'UPS1')) throw new Error('That isn’t a UPS patch.');
  const end = p.length - 12;
  let i = 4;
  const num = () => {
    let v = 0, shift = 1;
    for (;;) {
      if (i >= end) throw new Error('The UPS patch is damaged.');
      const x = p[i++]; v += (x & 0x7f) * shift;
      if (x & 0x80) break;
      shift *= 128; v += shift;
    }
    return v;
  };
  const inSize = num(), outSize = num();
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const inCrc = dv.getUint32(end, true), outCrc = dv.getUint32(end + 4, true), pCrc = dv.getUint32(end + 8, true);
  if (crc32(p.subarray(0, end + 8)) !== pCrc) throw new Error('The UPS patch is damaged (checksum).');
  let forward = true;
  if (checkSource && (src.length !== inSize || crc32(src) !== inCrc)) {
    // UPS works both ways: the patched game given instead of the original
    if (src.length === outSize && crc32(src) === outCrc) forward = false;
    else throw new Error('This patch is for a different version of the game (wrong ROM).');
  }
  const size = forward ? outSize : inSize;
  const out = new Uint8Array(size);
  out.set(src.subarray(0, Math.min(src.length, size)));
  let pos = 0;
  while (i < end) {
    pos += num();
    while (i < end) {
      const x = p[i++];
      if (pos < size) out[pos] = (pos < src.length ? src[pos] : 0) ^ x;
      pos++;
      if (!x) break;
    }
  }
  if (crc32(out) !== (forward ? outCrc : inCrc)) throw new Error('Patching didn’t come out right (checksum): wrong ROM?');
  return out;
}

// ── which system ─────────────────────────────────────────────────────────────
export function systemOf(rom) {
  if (magic(rom, 'NES\x1a')) return 'nes';
  const body = rom.length % 1024 === 512 ? rom.length - 512 : rom.length;
  if (body >= 0x20000 && body <= 0x1000000) return 'snes';
  return null;
}
// How right a SNES ROM's internal header looks (LoROM $7FDC, HiROM $FFDC,
// ExHiROM $40FFDC): 2 = checksum and complement agree and the checksum is the
// ROM's real sum, 1 = they only agree with each other, 0 = no header found.
function snesHeaderScore(rom) {
  const b = rom.length % 1024 === 512 ? rom.subarray(512) : rom;
  let sum = 0;
  for (let i = 0; i < b.length; i++) sum += b[i];
  sum &= 0xFFFF;
  let best = 0;
  for (const h of [0x7FDC, 0xFFDC, 0x40FFDC]) {
    if (h + 4 > b.length) continue;
    const comp = b[h] | (b[h + 1] << 8), chk = b[h + 2] | (b[h + 3] << 8);
    if ((comp ^ chk) !== 0xFFFF) continue;
    best = Math.max(best, chk === sum ? 2 : 1);
  }
  return best;
}
// The game's own name from its header (SNES), for a starting title
export function internalName(rom) {
  if (systemOf(rom) !== 'snes') return '';
  const b = rom.length % 1024 === 512 ? rom.subarray(512) : rom;
  for (const h of [0x7FC0, 0xFFC0]) {
    if (h + 21 > b.length) continue;
    const s = String.fromCharCode(...b.subarray(h, h + 21)).replace(/[^\x20-\x7e]/g, '').trim();
    if (s.length >= 3 && /^[\x20-\x7e]+$/.test(s)) return s;
  }
  return '';
}
const stripHeader = (r) => (r.length % 1024 === 512 ? r.slice(512) : r);
const addHeader = (r) => { const o = new Uint8Array(r.length + 512); o.set(r, 512); return o; };

/** The playable game from a ROM and (optionally) a patch. */
export function buildGame(rom, patch) {
  const notes = [];
  if (!patch) {
    const sys = systemOf(rom);
    if (!sys) throw new Error('That doesn’t look like an NES (.nes) or SNES (.sfc / .smc) ROM.');
    return { rom, system: sys, notes };
  }
  const kind = patchKind(patch);
  if (!kind) throw new Error('That patch isn’t IPS, BPS or UPS. (xdelta and other formats aren’t supported yet.)');
  // the ROM as given, and the other copy (header taken off, or put on) for SNES
  const snesLike = !magic(rom, 'NES\x1a');
  const variants = [rom];
  if (snesLike) variants.push(rom.length % 1024 === 512 ? stripHeader(rom) : addHeader(rom));
  let out = null, lastErr = null;
  if (kind === 'ips') {
    const results = variants.map((v) => applyIps(v, patch));
    out = results[0];
    // the other copy only when its result looks clearly more like a real SNES game
    if (snesLike && snesHeaderScore(results[1]) > snesHeaderScore(results[0])) out = results[1];
    if (snesLike && out !== results[0]) notes.push(rom.length % 1024 === 512 ? 'Took the copier header off your ROM to match the patch.' : 'Added a copier header to your ROM to match the patch.');
  } else {
    for (const v of variants) {
      try {
        out = kind === 'bps' ? applyBps(v, patch) : applyUps(v, patch);
        if (v !== rom) notes.push(rom.length % 1024 === 512 ? 'Took the copier header off your ROM to match the patch.' : 'Added a copier header to your ROM to match the patch.');
        break;
      } catch (e) { lastErr = e; }
    }
    if (!out) {
      let want = '';
      try {
        const dv = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);
        want = (dv.getUint32(patch.length - 12, true) >>> 0).toString(16).toUpperCase().padStart(8, '0');
      } catch (e) {}
      const msg = String(lastErr && lastErr.message || lastErr);
      throw new Error(/different|wrong ROM/i.test(msg)
        ? 'This patch is for a different version of the game. It wants a ROM with CRC32 ' + want + '; yours is ' + crc32(rom).toString(16).toUpperCase().padStart(8, '0') + '. (Most hacks list the exact ROM they need on their page.)'
        : msg.replace('base patch', 'patch').replace('base ROM', 'ROM'));
    }
  }
  const sys = systemOf(out);
  if (!sys) throw new Error('Patching worked, but the result isn’t an NES or SNES game this app can play.');
  return { rom: out, system: sys, notes };
}
