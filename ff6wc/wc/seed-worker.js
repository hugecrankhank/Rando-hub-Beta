// Worlds Collide (https://github.com/ff6wc/WorldsCollide, MIT) running in
// Pyodide inside a Web Worker. One worker makes one seed and is then thrown
// away: the generator keeps state in its modules (the flags are read when
// the `args` module is imported), so every seed starts from a fresh Python,
// the same as a fresh run of wc.py on a computer. The pinned Pyodide version
// and fixed hash seed make the same seed and flags give everyone the same game.
//
// Messages in:  { type: 'gen', rom, seed, flags }   (rom: Uint8Array, 3 MB, no header)
// Messages out: { type: 'stage', text }
//               { type: 'done', rom, log, seed, flags, hash, version, ms }
//               { type: 'error', error }

const PYODIDE_VERSION = '0.27.7';
const LOCAL = new URL('../../pyodide/', import.meta.url).href;
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PACKAGE = new URL('worldscollide.zip', import.meta.url).href;

const stage = (text) => postMessage({ type: 'stage', text });

const SETUP = `
import contextlib, io, json, os, sys
os.chdir('/wc')
sys.path.insert(0, '/wc')

def generate(seed, flags_json):
    sys.argv = ['wc.py', '-i', '/in/ffiii.smc', '-o', '/out/ffiii.smc'] + (['-s', seed] if seed else []) + json.loads(flags_json)
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        import wc
        wc.main()
    import args, version
    with open('/out/ffiii.txt', 'r', errors='replace') as f:
        log = f.read()
    return json.dumps({
        'seed': args.seed, 'flags': args.flags, 'version': version.__version__,
        'hash': [e.name for e in args.sprite_hash], 'printed': out.getvalue(), 'log': log,
    })
`;

let py = null;

async function boot() {
  stage('Starting Python…');
  let mod, indexURL;
  try {
    mod = await import(LOCAL + 'pyodide.mjs');
    indexURL = LOCAL;
  } catch (e) {
    // a copy of the app without the deploy step's download: the CDN's copy of the same version
    mod = await import(CDN + 'pyodide.mjs');
    indexURL = CDN;
  }
  const [pyodide, pkg] = await Promise.all([
    mod.loadPyodide({ indexURL, env: { PYTHONHASHSEED: '0', HOME: '/home/pyodide' }, stdout: () => {}, stderr: () => {} }),
    fetch(PACKAGE).then((r) => { if (!r.ok) throw new Error('worldscollide.zip: HTTP ' + r.status); return r.arrayBuffer(); }),
  ]);
  stage('Loading Worlds Collide…');
  pyodide.FS.mkdir('/wc'); pyodide.FS.mkdir('/in'); pyodide.FS.mkdir('/out');
  pyodide.unpackArchive(pkg, 'zip', { extractDir: '/wc' });
  pyodide.runPython(SETUP);
  py = pyodide;
}

const ready = boot();

onmessage = async (e) => {
  const m = e.data;
  if (m.type !== 'gen') return;
  const t0 = performance.now();
  try {
    await ready;
    py.FS.writeFile('/in/ffiii.smc', m.rom);
    stage('Randomizing… (about half a minute)');
    const res = JSON.parse(py.globals.get('generate')(m.seed ? String(m.seed) : '', JSON.stringify(m.flags || [])));
    const rom = py.FS.readFile('/out/ffiii.smc');
    postMessage({ type: 'done', rom, log: res.log, seed: res.seed, flags: res.flags, hash: res.hash,
      version: res.version, printed: res.printed, ms: performance.now() - t0 }, [rom.buffer]);
  } catch (err) {
    let text = String((err && err.message) || err);
    // the useful line of a Python traceback
    const lines = text.trim().split('\n');
    const last = lines[lines.length - 1] || text;
    postMessage({ type: 'error', error: last.replace(/^\w*Error: /, ''), detail: text });
  }
};
