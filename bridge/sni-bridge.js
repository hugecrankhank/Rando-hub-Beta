/*
 * sni-bridge.js — in-page replacement for SNI / QUsb2Snes (Snes9x edition).
 *
 * Exposes window.AlttpBridge, which answers usb2snes-style memory reads
 * straight from the built-in Snes9x core (emu/snes9x.wasm). We build that
 * core ourselves and it exports pointers to its WRAM, SRAM and ROM, so every
 * read and write is a direct view of live emulator memory: no save-state
 * snapshots and no searching the heap.
 *
 * usb2snes / SD2SNES address space:
 *   0x000000-0xDFFFFF  ROM   (file offset, copier header stripped)
 *   0xE00000-0xEFFFFF  SRAM  (cartridge save RAM)
 *   0xF50000-0xF6FFFF  WRAM  (the SNES's 128 KB work RAM, $7E0000-$7FFFFF)
 *
 * Same API as the EmulatorJS edition's bridge: read, ready, setRom,
 * invalidate, status, writeWram, patchRom, onStatus, peek.
 */
(function () {
  'use strict';

  const WRAM_SIZE = 0x20000;
  const WRAM_BASE = 0xF50000;
  const SRAM_BASE = 0xE00000;

  const state = { rom: null, romName: '', listeners: new Set(), lastMode: 'idle' };

  function emu() { const e = window.EJS_emulator; return e && e.snes9x ? e : null; }
  function core() { const e = emu(); return e ? e.core : null; }

  function status() {
    const c = core();
    return {
      romLoaded: !!state.rom,
      running: !!c,
      mode: c && c.loaded ? 'live' : 'idle',
      ptr: -1,
      romName: state.romName,
    };
  }
  function emit() {
    const s = status();
    state.lastMode = s.mode;
    state.listeners.forEach(fn => { try { fn(s); } catch (e) {} });
  }
  // The game starting is noticed on the next read; tell listeners once.
  function check() { const c = core(); const m = c && c.loaded ? 'live' : 'idle'; if (m !== state.lastMode) emit(); return c; }

  function copy(out, src, off, len) {
    if (!src || off < 0 || off >= src.length) return;
    out.set(src.subarray(off, Math.min(off + len, src.length)));
  }

  function read(addr, len) {
    const out = new Uint8Array(len);
    const c = check();
    if (addr >= WRAM_BASE && addr < WRAM_BASE + WRAM_SIZE) {
      if (c && c.loaded) copy(out, c.wram(), addr - WRAM_BASE, len);
    } else if (addr >= SRAM_BASE && addr < 0xF00000) {
      if (c && c.loaded) copy(out, c.sram(), addr - SRAM_BASE, len);
    } else if (addr < SRAM_BASE) {
      // The core's ROM is the running copy (sprite changes land there); fall
      // back to the file we were given before the game starts.
      const r = c && c.loaded ? c.rom() : state.rom;
      copy(out, r && r.length ? r : state.rom, addr, len);
    }
    return out;
  }

  // Ready = a game is running.
  function ready() { const c = check(); return !!(c && c.loaded && state.rom); }

  function setRom(bytes, name) {
    let rom = bytes;
    if (rom.length % 1024 === 512) rom = rom.subarray(512); // copier header
    state.rom = rom;
    state.romName = name || '';
    emit();
  }

  // Nothing to re-locate: memory pointers come straight from the core.
  function invalidate() { emit(); }

  // ── writes (used to change Link's sprite during a game) ──────────────────
  function writeWram(addr, bytes) {
    const c = core();
    if (!c || !c.loaded) return false;
    const off = addr - WRAM_BASE;
    if (off < 0 || off + bytes.length > WRAM_SIZE) return false;
    c.wram().set(bytes, off);
    return true;
  }

  // Change the running game's ROM to `next` (same size, header stripped):
  // only the bytes that differ are written. Returns 1 when written, 0 when it
  // couldn't be, -1 when nothing changed.
  function patchRom(next) {
    const c = core(), old = state.rom;
    if (!c || !c.loaded || !old || !next || next.length !== old.length) return 0;
    const live = c.rom();
    if (!live.length) return 0;
    let changed = 0;
    const n = Math.min(next.length, live.length);
    for (let i = 0; i < n; i++) if (live[i] !== next[i]) { live[i] = next[i]; changed++; }
    state.rom = next;
    return changed ? 1 : -1;
  }

  window.AlttpBridge = {
    read, ready, setRom, invalidate, status, writeWram, patchRom,
    deviceName: 'Snes9x (built-in)',
    onStatus(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); },
    // Debug helper: AlttpBridge.peek(0x7EF340, 16)
    peek(snesAddr, len) {
      const a = (snesAddr >= 0x7E0000 && snesAddr < 0x800000) ? WRAM_BASE + (snesAddr - 0x7E0000) : snesAddr;
      return Array.from(read(a, len || 16), b => b.toString(16).padStart(2, '0')).join(' ');
    },
  };
})();
