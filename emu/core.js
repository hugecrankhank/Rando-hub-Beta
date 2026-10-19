/*
 * Snes9x core wrapper. Loads core/snes9x.wasm (snes9x built with wasi-sdk)
 * and exposes a small API. Works in the browser and in Node (for tests).
 *
 *   const core = await Snes9xCore.create(wasmBytesOrUrl);
 *   core.load(romUint8Array);
 *   core.runFrame(pad1Bits, pad2Bits);
 *   core.frame()  -> { w, h, data: Uint16Array (RGB565) }
 *   core.audio()  -> Int16Array interleaved stereo (view, copy if kept)
 *   core.wram()   -> Uint8Array view of live 128 KB WRAM
 */
(function (root) {
  'use strict';

  // Just enough WASI for a reactor that never opens files: stdio goes to
  // the console, everything else reports "not supported".
  function wasiImports(getMem) {
    const ENOSYS = 52, EBADF = 8;
    const dec = new TextDecoder();
    let line = '';
    return {
      fd_write(fd, iovs, n, nwritten) {
        const mem = getMem(), dv = new DataView(mem.buffer);
        let total = 0;
        for (let i = 0; i < n; i++) {
          const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
          line += dec.decode(new Uint8Array(mem.buffer, p, l));
          total += l;
        }
        let nl;
        while ((nl = line.indexOf('\n')) >= 0) { if (line.slice(0, nl).trim()) console.warn('[snes9x]', line.slice(0, nl)); line = line.slice(nl + 1); }
        dv.setUint32(nwritten, total, true);
        return 0;
      },
      environ_get() { return 0; },
      environ_sizes_get(c, s) { const dv = new DataView(getMem().buffer); dv.setUint32(c, 0, true); dv.setUint32(s, 0, true); return 0; },
      clock_time_get(id, prec, out) {
        const ns = BigInt(Math.round((id === 0 ? Date.now() : performance.now()) * 1e6));
        new DataView(getMem().buffer).setBigUint64(out, ns, true); return 0;
      },
      random_get(p, l) { crypto.getRandomValues(new Uint8Array(getMem().buffer, p, l)); return 0; },
      fd_close() { return 0; },
      fd_fdstat_get() { return EBADF; },
      fd_fdstat_set_flags() { return ENOSYS; },
      fd_prestat_get() { return EBADF; },
      fd_prestat_dir_name() { return EBADF; },
      fd_read() { return EBADF; },
      fd_seek() { return EBADF; },
      fd_tell() { return EBADF; },
      path_open() { return 44; /* ENOENT */ },
      proc_exit(c) { throw new Error('snes9x exited ' + c); },
    };
  }

  async function create(source) {
    let mem = null;
    const imports = { wasi_snapshot_preview1: wasiImports(() => mem) };
    let inst;
    if (typeof source === 'string') {
      const res = fetch(source);
      try { inst = (await WebAssembly.instantiateStreaming(res, imports)).instance; }
      catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(source)).arrayBuffer(), imports)).instance; }
    } else {
      inst = (await WebAssembly.instantiate(source, imports)).instance;
    }
    const x = inst.exports;
    mem = x.memory;
    x._initialize();
    x.s9x_init();
    return new Core(x);
  }

  function Core(x) { this.x = x; this.loaded = false; }
  Core.prototype = {
    get memory() { return this.x.memory; },
    load(rom) {
      rom = stripCopierHeader(rom);
      const p = this.x.s9x_alloc(rom.length);
      new Uint8Array(this.x.memory.buffer, p, rom.length).set(rom);
      this.loaded = !!this.x.s9x_load(p, rom.length);
      return this.loaded;
    },
    reset() { this.x.s9x_reset(); },
    runFrame(p1, p2) { this.x.s9x_run(p1 | 0, p2 | 0); },
    get fps() { return this.x.s9x_fps(); },
    get sampleRate() { return this.x.s9x_sample_rate(); },
    frameSerial() { return this.x.s9x_frame_serial(); },
    frame() {
      const w = this.x.s9x_frame_w(), h = this.x.s9x_frame_h();
      return { w, h, data: new Uint16Array(this.x.memory.buffer, this.x.s9x_frame_ptr(), w * h) };
    },
    audio() {
      const n = this.x.s9x_audio_take();
      return new Int16Array(this.x.memory.buffer, this.x.s9x_audio_ptr(), n * 2);
    },
    region(which) {
      const p = this.x.s9x_mem_ptr(which), n = this.x.s9x_mem_size(which);
      return p && n ? new Uint8Array(this.x.memory.buffer, p, n) : new Uint8Array(0);
    },
    wram() { return this.region(0); },
    sram() { return this.region(1); },
    rom() { return this.region(2); },
    saveState() {
      if (!this.x.s9x_state_save()) return null;
      const n = this.x.s9x_state_size();
      return new Uint8Array(this.x.memory.buffer, this.x.s9x_state_buf(), n).slice();
    },
    loadState(bytes) {
      const p = this.x.s9x_state_buf();
      new Uint8Array(this.x.memory.buffer, p, bytes.length).set(bytes);
      return !!this.x.s9x_state_load(bytes.length);
    },
  };

  // .smc dumps sometimes carry a 512-byte copier header.
  function stripCopierHeader(rom) {
    return (rom.length % 1024 === 512) ? rom.subarray(512) : rom;
  }

  // SNES pad bits (libretro RETRO_DEVICE_ID_JOYPAD_* order)
  const BTN = { B: 0, Y: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7, A: 8, X: 9, L: 10, R: 11 };

  const api = { create, BTN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Snes9xCore = api;
})(typeof self !== 'undefined' ? self : this);
