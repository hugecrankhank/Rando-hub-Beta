// The Super Mario RPG Open World Randomizer (https://github.com/Super-Mario-RPG-Randomizer/smrpg_web_randomizer,
// MIT) running in Pyodide inside a Web Worker. The site does it in two halves:
// its Python makes a patch (a list of address → bytes) and the browser puts
// the patch on your ROM, on top of the mode's base patch (open_mode.json). Here
// both halves run in the worker, in Python, and the finished ROM comes back.
// The randomizer's own seed rules: a number 1–4294967295 as is, any other
// text through CRC32, nothing → a random 32-bit seed. One worker makes one
// seed and is thrown away, so every seed starts from a fresh Python.
//
// Messages in:  { type: 'gen', rom, seed, mode, flags }   (rom: Uint8Array, 4 MB)
// Messages out: { type: 'stage', text }
//               { type: 'done', rom, seed, hash, flags, mode, version, character, fileHash, spoiler, ms }
//               { type: 'error', error, detail }

const PYODIDE_VERSION = '0.27.7';
const LOCAL = new URL('../../pyodide/', import.meta.url).href;
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PACKAGE = new URL('smrpg_randomizer.zip', import.meta.url).href;

const stage = (text) => postMessage({ type: 'stage', text });

const SETUP = `
import binascii, json, random, sys, warnings
warnings.simplefilter('ignore')
sys.path.insert(0, '/gen')
from randomizer.logic.main import GameWorld, Settings, VERSION
from randomizer.logic.flags import FlagError
from randomizer.logic.patch import PatchJSONEncoder

def apply(rom, patch):
    for entry in patch:
        for addr, data in entry.items():
            addr = int(addr)
            if isinstance(data, int): data = [data]
            rom[addr:addr + len(data)] = bytes(data)

def generate(seed_text, mode, flags):
    seed = None
    seed_text = (seed_text or '').strip()
    if seed_text:
        if seed_text.isdigit():
            seed = int(seed_text)
            if seed < 1 or seed > 0xFFFFFFFF: seed = None
        else:
            seed = binascii.crc32(seed_text.encode())
    if not seed:
        seed = random.SystemRandom().getrandbits(32) or 1
    world = GameWorld(seed, Settings(mode or 'open', False, flags or ''))
    try:
        world.randomize()
        patch = json.loads(json.dumps(world.build_patch(), cls=PatchJSONEncoder))
    except FlagError as e:
        return json.dumps({'error': str(e.args[0])})
    rom = bytearray(open('/in/rom.sfc', 'rb').read())
    with open('/gen/patches/%s_mode.json' % (mode or 'open')) as f:
        apply(rom, json.load(f))
    apply(rom, patch)
    s = sum(rom) & 0xFFFF; inv = s ^ 0xFFFF
    rom[0x7FDC:0x7FE0] = bytes([inv & 0xFF, inv >> 8, s & 0xFF, s >> 8])
    open('/out/rom.sfc', 'wb').write(rom)
    return json.dumps({
        'seed': seed, 'hash': world.hash, 'flags': world.settings.flag_string, 'mode': mode or 'open', 'version': VERSION,
        'character': world.file_select_character, 'fileHash': world.file_select_hash, 'spoiler': world.spoiler,
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
    mod = await import(CDN + 'pyodide.mjs');   // a copy of the app without the deploy step's download
    indexURL = CDN;
  }
  const [pyodide, pkg] = await Promise.all([
    mod.loadPyodide({ indexURL, env: { PYTHONHASHSEED: '0', HOME: '/home/pyodide' }, stdout: () => {}, stderr: () => {} }),
    fetch(PACKAGE).then((r) => { if (!r.ok) throw new Error('smrpg_randomizer.zip: HTTP ' + r.status); return r.arrayBuffer(); }),
  ]);
  stage('Loading the randomizer…');
  pyodide.FS.mkdir('/gen'); pyodide.FS.mkdir('/in'); pyodide.FS.mkdir('/out');
  pyodide.unpackArchive(pkg, 'zip', { extractDir: '/gen' });
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
    py.FS.writeFile('/in/rom.sfc', m.rom);
    stage('Randomizing…');
    const res = JSON.parse(py.globals.get('generate')(m.seed ? String(m.seed) : '', m.mode || 'open', m.flags || ''));
    if (res.error) { postMessage({ type: 'error', error: res.error, detail: res.error }); return; }
    const rom = py.FS.readFile('/out/rom.sfc');
    postMessage(Object.assign({ type: 'done', rom, ms: performance.now() - t0 }, res), [rom.buffer]);
  } catch (err) {
    let text = String((err && err.message) || err);
    const lines = text.trim().split('\n');
    const last = lines[lines.length - 1] || text;
    postMessage({ type: 'error', error: last.replace(/^\w*Error: /, ''), detail: text });
  }
};
