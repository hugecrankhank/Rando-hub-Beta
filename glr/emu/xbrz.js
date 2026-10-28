/*
 * xBRZ, the real one: Zenju's scaler (core/xbrz/, GPL-3.0; the copy Mesen
 * ships) built to WebAssembly (emu/xbrz.wasm, core/build-xbrz.sh). The GPU
 * "6xBRZ" shader is an approximation that rounds corners more than xBRZ does;
 * this one gives the same picture as Mesen's xBRZ. It runs on the CPU, about
 * 3–8 ms a frame at NES size, so it's for computers rather than phones, and
 * it builds a 64 MB colour-distance table the first time it runs (~0.2 s),
 * which load() does ahead of time.
 *
 *   NesXbrz.load(base)              -> promise; base is where emu/ is
 *   NesXbrz.ready                   true once usable
 *   NesXbrz.scale(frame, factor)    frame {w, h, data: Uint16Array RGB565}
 *                                   -> {w, h, rgba: Uint8Array} scaled 2..6×
 */
(function (root) {
  'use strict';
  var x = null, loading = null, lastMs = 0;
  function load(base) {
    if (loading) return loading;
    var url = (base || '') + 'xbrz.wasm';
    var imports = { wasi_snapshot_preview1: new Proxy({}, { get: function () { return function () { return 0; }; } }),
                    env: new Proxy({}, { get: function () { return function () { return 0; }; } }) };
    loading = (WebAssembly.instantiateStreaming
      ? WebAssembly.instantiateStreaming(fetch(url), imports).catch(function () {
          return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.instantiate(b, imports); }); })
      : fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.instantiate(b, imports); }))
      .then(function (r) {
        x = r.instance.exports;
        // build the distance table now, not on the first frame
        var p = x.xb_input(8, 8); new Uint16Array(x.memory.buffer, p, 64).fill(0); x.xb_scale(2, 8, 8);
        api.ready = true;
        return api;
      });
    return loading;
  }
  function scale(frame, factor) {
    if (!x) return null;
    factor = Math.max(2, Math.min(6, factor | 0));
    var w = frame.w, h = frame.h, t0 = performance.now();
    var p = x.xb_input(w, h);
    new Uint16Array(x.memory.buffer, p, w * h).set(frame.data.subarray ? frame.data.subarray(0, w * h) : frame.data);
    var q = x.xb_scale(factor, w, h);
    lastMs = lastMs ? lastMs * 0.9 + (performance.now() - t0) * 0.1 : performance.now() - t0;
    return { w: w * factor, h: h * factor, rgba: new Uint8Array(x.memory.buffer, q, w * h * factor * factor * 4) };
  }
  var api = { load: load, scale: scale, ready: false, ms: function () { return lastMs; } };
  root.NesXbrz = api; root.Xbrz = api;
})(typeof self !== 'undefined' ? self : this);
