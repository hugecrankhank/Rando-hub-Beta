// Z1Z3's ZORA mode: ZORA (https://github.com/tetraly/zora, MIT) in Pyodide inside a Web Worker,
// through its own Archipelago interface (glue.py). The wheel and the flag tabs are the Z1R page's
// (../../z1r/zora/), so both pages run the same ZORA.
//
// Messages in (each with an `id`):
//   init   {wheelUrl, glueUrl, tabsUrl}
//   check  {flags, zoraFlags}                → {check: {flags, zoraFlags, refused}}
//   build  {bytes, seed, flags, zoraFlags}   → {build: {places, logic, triforces, codes, ...}}
//   finish {assignment, received}            → {rom}   (assignment: place → item name, or null: the other game's)
//   state / change / zoraChange              → {state}  (the flag form, as on the Z1R page)
// Messages out: {type:'ready', metadata, tabs} | {type:'result', id, ...} | {type:'error', id, message}

let pyodide = null;
const call = (name, ...args) => pyodide.globals.get(name)(...args);
const json = (name, ...args) => JSON.parse(call(name, ...args));

// the hub's own Python (../../pyodide/, put there by the deploy), else the CDN's copy of it
const PYODIDE_VERSION = '0.27.7';
const LOCAL = new URL('../../pyodide/', import.meta.url).href;
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

async function init({ wheelUrl, glueUrl, tabsUrl }) {
  let mod, indexURL;
  try { mod = await import(LOCAL + 'pyodide.mjs'); indexURL = LOCAL; } catch (e) { mod = await import(CDN + 'pyodide.mjs'); indexURL = CDN; }
  const [py, wheel, glue, tabs] = await Promise.all([
    mod.loadPyodide({ indexURL, stdout: () => {}, stderr: () => {} }),
    fetch(wheelUrl).then((r) => { if (!r.ok) throw new Error('wheel ' + r.status); return r.arrayBuffer(); }),
    fetch(glueUrl).then((r) => { if (!r.ok) throw new Error('glue ' + r.status); return r.text(); }),
    fetch(tabsUrl).then((r) => r.json()).catch(() => ({})),
  ]);
  pyodide = py;
  pyodide.unpackArchive(wheel, 'wheel');   // ZORA has no dependencies: unpacking the wheel installs it
  pyodide.runPython(glue);
  postMessage({ type: 'ready', metadata: json('form_metadata'), tabs });
}

const handlers = {
  check: ({ flags, zoraFlags }) => ({ check: json('check', flags, zoraFlags || '') }),
  build: ({ bytes, seed, flags, zoraFlags }) => ({ build: json('build', bytes, String(seed), flags, zoraFlags || '') }),
  state: ({ flags, zoraFlags }) => ({ state: json('form_state', flags, zoraFlags || '') }),
  change: ({ previous, values, zoraFlags }) => ({ state: json('form_change', previous, JSON.stringify(values), zoraFlags || '') }),
  zoraChange: ({ flags, zoraValues }) => ({ state: json('zora_form_change', flags, JSON.stringify(zoraValues)) }),
};

function finish({ id, assignment, received }) {
  const out = call('finish', JSON.stringify(assignment), JSON.stringify(received || []));
  const rom = out.toJs(); out.destroy();
  postMessage({ type: 'result', id, rom }, [rom.buffer]);
}

self.onmessage = async (event) => {
  const m = event.data;
  try {
    if (m.type === 'init') await init(m);
    else if (m.type === 'finish') finish(m);
    else if (handlers[m.type]) postMessage({ type: 'result', id: m.id, ...handlers[m.type](m) });
  } catch (err) {
    postMessage({ type: 'error', id: m.id, message: String(err && err.message || err).split('\n').filter(Boolean).slice(-1)[0] });
  }
};
