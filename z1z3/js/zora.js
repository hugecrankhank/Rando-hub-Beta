/*
 * zora.js — Z1Z3's ZORA mode: the worker (../zora/worker.js: ZORA in Python, through its own
 * Archipelago interface) started once, when first needed, and asked by name.
 *
 *   Z1Z3Zora.ready()                 → Promise<{ metadata, tabs }>   (ZORA's flag form: fields, presets)
 *   Z1Z3Zora.ask(type, fields)       → Promise<result>               (check, build, finish, state, change, zoraChange)
 *   Z1Z3Zora.started                 whether the worker is up (or loading)
 */
let worker = null, readyP = null, nextId = 1;
const pending = new Map();

export function ready() {
  if (readyP) return readyP;
  worker = new Worker(new URL('../zora/worker.js', import.meta.url), { type: 'module' });
  let fail = null;
  readyP = new Promise((resolve, reject) => {
    fail = reject;
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') { resolve({ metadata: m.metadata, tabs: m.tabs || {} }); return; }
      const p = pending.get(m.id);
      if (!p) { if (m.type === 'error') reject(new Error(m.message)); return; }
      pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m);
    };
    worker.onerror = (e) => reject(new Error(e.message || 'ZORA failed to load.'));
  });
  readyP.catch(() => { readyP = null; try { worker.terminate(); } catch (e) {} worker = null; });
  // the Z1R page's ZORA (its wheel.json names the wheel), so both pages roll with the same one
  const Z1R = new URL('../../z1r/zora/', import.meta.url);
  fetch(new URL('wheel.json', Z1R)).then((r) => r.json()).then((w) => worker && worker.postMessage({ type: 'init',
    wheelUrl: new URL(w.wheel, Z1R).href, glueUrl: new URL('../zora/glue.py', import.meta.url).href,
    tabsUrl: new URL('flag-tabs.json', Z1R).href })).catch((e) => fail(new Error('ZORA couldn’t load (' + (e && e.message || e) + ').')));
  return readyP;
}

export async function ask(type, fields, transfer) {
  await ready();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage(Object.assign({ type, id }, fields), transfer || []);
  });
}

window.Z1Z3Zora = { ready, ask, get started() { return !!readyP; } };
