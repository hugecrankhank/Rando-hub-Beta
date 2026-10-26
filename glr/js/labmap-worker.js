/* labmap-worker.js — builds every labyrinth screen off the main thread (see js/labmap.js). */
importScripts('tgl-data.js', 'cpu6502.js', 'labmap.js');
self.onmessage = (e) => {
  try {
    const tiles = LabMap.read(new Uint8Array(e.data.rom)).buildAll();
    self.postMessage({ tiles }, [tiles.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
