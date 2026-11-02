// DASH (https://github.com/dashrando/dash-randomizer, MIT) making a Super
// Metroid seed in a Web Worker: its core, bundled as dash-core.js, exactly as
// dashrando.net runs it in the browser. The vanilla ROM is checked (SHA-256),
// the mode's base patch (patches/dash_standard*.bps) and the seed's own patch
// go on it, and the finished ROM comes back with the spoiler the site writes.
//
// Messages in:  { type: 'gen', rom, seed, settings, options, preset }   (rom: Uint8Array, 3 MB, no header)
// Messages out: { type: 'stage', text }
//               { type: 'done', rom, name, hash, seed, spoiler, placed, ms }
//               { type: 'error', error, detail }
//
// The tracker's logic (js/logic.js) uses the same worker, kept open:
//   { type: 'logic-load', rom }        → { type: 'logic-loaded', ok, seed, settings, placed, spoiler } or { ok: false, error }
//   { type: 'logic', inv, n }          → { type: 'logic-reach', n, reach: { 'spot|Area': 'ok' | 'back' | 'no' } }

const stage = (text) => postMessage({ type: 'stage', text });
let core = null;
async function boot() {
  stage('Loading DASH…');
  core = await import('./dash-core.js');
  core.setPatchBase(new URL('patches/', import.meta.url).href);
}
const ready = boot();

onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'logic-load') {
    try {
      await ready;
      const p = core.readSeedParams(m.rom);
      if (p.error) { postMessage({ type: 'logic-loaded', ok: false, error: p.error }); return; }
      const r = core.logicLoad(p.seed, p.settings, p.options, m.rom);
      postMessage(Object.assign({ type: 'logic-loaded' }, r));
    } catch (err) { postMessage({ type: 'logic-loaded', ok: false, error: String((err && err.message) || err) }); }
    return;
  }
  if (m.type === 'logic') {
    try { await ready; postMessage({ type: 'logic-reach', n: m.n, reach: core.logicReach(m.inv) }); }
    catch (err) { postMessage({ type: 'logic-reach', n: m.n, reach: null, error: String((err && err.message) || err) }); }
    return;
  }
  if (m.type !== 'gen') return;
  const t0 = performance.now();
  try {
    await ready;
    const sig = await core.getSignature(m.rom);
    if (!core.isVerified(sig)) throw new Error(core.isHeadered(sig) ? 'That ROM has a copier header (the page should have removed it).' : 'That isn’t the Super Metroid (Japan, USA) ROM DASH needs.');
    const seed = core.getSeedNumber(m.seed ? Number(m.seed) : undefined);
    stage('Placing items…');
    const r = await core.generate(m.rom, seed, m.settings, m.options, m.preset || 'Custom');
    postMessage({ type: 'done', rom: r.data, name: r.name, hash: r.hash, seed, spoiler: r.spoiler, placed: r.placed, ms: performance.now() - t0 }, [r.data.buffer]);
  } catch (err) {
    const text = String((err && err.message) || err);
    postMessage({ type: 'error', error: text.split('\n')[0], detail: String(err && err.stack || text) });
  }
};
