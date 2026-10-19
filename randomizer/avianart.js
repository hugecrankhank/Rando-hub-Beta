// Seeds from AVIANART (avianart.games), played here.
//
// AVIANART runs the Door Randomizer on its own server, and rolls seeds from
// presets only (no settings one by one). It's asked the way SahasrahBot asks it:
//   GET  api.php?action=presets                     -> { response: { modes: [{prefix, name, type, category, description}] } }
//   POST api.php?action=generate&preset=<preset>   body [{args:{race}}]   (preset: "crosskeys" or "namespace/preset")
//        -> { status: 200, response: { hash, status: 'generating' } }
//   GET  api.php?action=permlink&hash=<hash>        (poll until it's done)
//        -> { status: 200, response: { status?, message?, bps_t0_p1 | patch, basepatch, spoiler } }
// A finished seed has no response.status (or 'finished'). Its ROM is either a
// BPS patch (base64, onto the Japanese 1.0 ROM) or, for older seeds, an
// alttpr.com-style byte patch onto the Door Randomizer base ROM (basepatch.bps).
//
// The browser tries AVIANART directly first. If AVIANART doesn't allow other
// sites to read it (CORS), it goes through a relay: relay/avianart-worker.js,
// a free Cloudflare Worker (see the README).

import { applyBps, crc32 } from './bps.js';

const API = 'https://avianart.games/api.php';
export const SITE = 'https://avianart.games';
const RELAY_KEY = 'unified-avianart-relay';
export const DEFAULT_RELAY = 'https://avianart-relay.hugecrankhank.workers.dev';

// Players' own presets ("namespace/preset", as PedChicken shows them), offered
// beside AVIANART's list. AVIANART's list doesn't include these.
export const PRESETS = [
  { id: 'jem041/onlyadkdf', label: 'OnlyADKDF (jem041)', onlyadkd: true,
    note: 'Open, crossed entrances, pot and enemy key drops, random weapons, 7/6 crystals' },
  // SahasrahBot rolls these two (its 2025 presets)
  { id: 'kaesden/casualboots', label: 'Casual Boots (kaesden)', onlyadkd: false,
    note: 'Standard with a starting weapon, but you start with the Pegasus Boots too' },
  { id: 'kaesden/cabookey', label: 'Cabookey (kaesden)', onlyadkd: false, note: 'Kaesden\'s Cabookey' },
];

// AVIANART's own preset list (api.php?action=presets), as of October 2026:
// prefix|name|type|category. The live list replaces it when AVIANART answers.
const SNAPSHOT = `dungeonsfull_hmg|Dungeonsfull HMG|dr|misc
dungeonssimple_hmg|Dungeonssimple HMG|dr|misc
adkdb|ADKDB - AD Keydrop Boots|dr|misc
adkeys|All Dungeons Keysanity|vt|ladder
ambroz1a|AmbroZ1a Ganon Hunt|doors|misc
ambroz1adr|WJB's AmbroZ1a Ganon Hunt|doors|testing
ambroz1agt|AmbroZ1a Slow Ganon Hunt|doors|testing
antil|Anti-Logic|vt|misc
antiv|ANTIvrosia|vt|tournament2022
bees|Bee Weapon|doors|kara
bomberman|Bomberman|doors|kara
bunday|Bunday|dr|misc
buzzpriest|Buzzpriest|doors|kisspriest
cabookey|cabookey|dr|misc
casualboots|Casual Boots|vt|misc
casualboots_ladder|Casual Boots (Ladder)|vt|ladder
casualbooty|Definitely Casboots|dr|misc
casualopen|Casual Open|vt|mt
completionist_keysanity|Completionist Keysanity|dr|misc
crisscross|crisscross|dr|misc
crisscross_zw|crisscross_zw|dr|misc
crosshunt|Crosshunt|doors|malmo
crosshunt9|Crosshunt9|doors|malmo
crosskeys|Crosskeys|dr|vtp
ftkh|Fake True Key Hunt|doors|soz
gadk|Actually Good AD Keys|vt|wizzrobe
hmg|Hybrid Major Glitches|vt|ladder
invc|Invertacrismizer|vt|tournament2022
invc2023|Invertacrismiser 2023|doors|tournament2023
invc2023hmg|Invertacrismiser 2023 (HMG)|doors|tournament2023g
invc2023nl|Invertacrismiser 2023 (NoLogic)|doors|tournament2023g
invc2023owg|Invertacrismiser 2023 (OWG)|doors|tournament2023g
inverted_adkeys|Inverted AD Keys|vt|ladder
inverted_adkeys_dr|Inverted ADKeys|doors|ladder
invrosia|Invrosia|vt|ladder
iter|iS tHiS eVeN rAnDoMiZeD?|vt|tournament2022
keysanity|Keysanity|dr|misc
kpd|Kekpriest|doors|kisspriest
kpdd|Kekpriest (Decoupled Doors)|doors|kisspriest
kpdlite|Kekpriest (Annoying Traps Removed)|doors|kisspriest
kpdlottery|Kekpriest Lottery|doors|kisspriest
ladderbeginnerdoors|Ladder Beginner Doors|doors|ladder
ladderintermediatedoors|Ladder Intermediate Doors|doors|ladder
ldi|Ludicrous Dungeon Items|vt|wizzrobe
league_bosshunt|League Bosshunt|dr|misc
leaguebeginnerweek1|DR Beginner Week 1 & 2|doors|doorsleague
leaguebeginnerweek3|DR Beginner Week 3+|doors|doorsleague
lightspeed|Lightspeed w/ Crossed Doors|dr|misc
ludicrouskeys|Ludicrous Keys|vt|wizzrobe
ludicrousspeed|Ludicrous Speed|vt|ladder
mixed_turnier|Mixed Overworld Shops Big Keys|dr|misc
mmmmavid23|MMMM|doors|tournament2023
nologic_rods|nologic_rods|dr|misc
open|Open|vt|mt
openboots_enemizer|Open Boots Enemizer|dr|misc
owg_assured|Overworld Glitches (Assured Sword)|vt|ladder
owg_mixed_tile_swap|OWG Mixed Tile Swap|dr|misc
owrfestivetest|Testing|doors|testing
pab|Pots and Bones|doors|tournament2023
pab1|Pots and Bones|doors|tournament2023
pabhmg|Pots and Bones (HMG)|doors|tournament2023g
pabnl|Pots and Bones (NoLogic)|doors|tournament2023g
pabowg|Pots and Bones (OWG)|doors|tournament2023g
pabprize|PB&J|doors|testing
pabs|Pots, Shops, and Bones|doors|testing
polarm|Polar Mixed|dr|misc
retrance_bow|Retrance no rupee bow|dr|misc
shadowrush|Shadow Rush|vt|misc
spbj|Smooth PB&J|dr|misc
spoiler_keysanity|Spoiler Keysanity|dr|testing
standard|Standard|vt|mt
standardinverted|Standard 'Inverted'|doors|overworld
standardinverteddev|Standard 'Inverted' [OWRDev]|doors|overworld
stdinvboots|Standard 'Inverted' Boots|doors|misc
swapkeys|Swapkeys|dr|misc
swapkeysdev|Swapkeys [OWRDev]|dr|misc
tkp|True Kekpriest|doors|kisspriest
tkpv|True Kekpriest (Enemy Drops)|doors|kisspriest
tph|True Pot Hunt|doors|tournament2022
tph2023|True Pot Hunt 2023|doors|tournament2023
tph2023hmg|True Pot Hunt 2023 (HMG)|doors|tournament2023g
tph2023nl|True Pot Hunt 2023 (NoLogic)|doors|tournament2023g
tph2023owg|True Pot Hunt 2023 (OWG)|doors|tournament2023g
tphdoors|True Pot Hunt (w/ Lvl 3 Doors)|doors|tph
tphenemizer|True Pot Hunt (w/ Enemizer)|doors|tph
tphfull|Truest Pot Hunt (420/420 Triforce Pieces)|doors|tph
tphlite|True Pot Hunt 2023 (Lite)|doors|tph
tphmirror|True Pot Hunt w/ Starting Mirror|doors|tph
tphone|True Pot Hunt 2023 (One)|doors|tph
tphowr|True Pot Hunt (Overworld Randomized)|doors|tph
tribomb|Trinity Bomberman|dr|misc
trinimizer|Trinimizer|dr|testing
trinity|Trinity|doors|tournament2023
trinityhmg|Trinity (HMG)|doors|tournament2023g
trinitynl|Trinity (NoLogic)|doors|tournament2023g
trinityowg|Trinity (OWG)|doors|tournament2023g
witt|wiTt|vt|tournament2022`;

const snapshotModes = () => SNAPSHOT.split('\n').map((l) => {
  const [prefix, name, type, category] = l.split('|');
  return { prefix, name, type, category, description: null };
});

// AVIANART's category codes, as headings (in this order; others after, A-Z)
const CATEGORIES = [
  ['mt', 'Main'], ['ladder', 'Ladder'], ['vtp', 'Crosskeys'], ['doorsleague', 'Doors League'],
  ['tournament2023', 'Tournament 2023'], ['tournament2023g', 'Tournament 2023 (glitched)'],
  ['tournament2022', 'Tournament 2022'], ['tph', 'True Pot Hunt'], ['kisspriest', 'Kekpriest'],
  ['malmo', 'Malmo'], ['overworld', 'Overworld'], ['wizzrobe', 'Wizzrobe'], ['kara', 'Kara'], ['soz', 'SoZ'],
  ['misc', 'Misc'], ['testing', 'Testing'],
];
export function categoryLabel(c) {
  const k = CATEGORIES.find(([id]) => id === c);
  return k ? k[1] : String(c || 'Other').replace(/^./, (x) => x.toUpperCase());
}
const catOrder = (c) => { const i = CATEGORIES.findIndex(([id]) => id === c); return i < 0 ? 50 : i; };
export const TYPE_LABEL = { vt: 'item randomizer', dr: 'Door Randomizer', doors: 'Door Randomizer' };

/** AVIANART's presets in groups: [{ category, label, modes: [...] }]. */
export function groupModes(modes) {
  const by = new Map();
  for (const m of modes) {
    if (!m || !m.prefix) continue;
    const c = m.category || 'other';
    if (!by.has(c)) by.set(c, []);
    by.get(c).push(m);
  }
  return [...by.entries()]
    .sort((a, b) => catOrder(a[0]) - catOrder(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, list]) => ({
      category, label: categoryLabel(category),
      modes: list.sort((a, b) => String(a.name).localeCompare(String(b.name))),
    }));
}

const LIST_KEY = 'unified-avianart-presets';
/** The list kept from last time (or the built-in copy), right away. */
export function cachedModes() {
  try {
    const v = JSON.parse(localStorage.getItem(LIST_KEY) || 'null');
    if (v && Array.isArray(v.modes) && v.modes.length) return v.modes;
  } catch (e) {}
  return snapshotModes();
}
/** AVIANART's current list (kept for next time). */
export async function fetchModes({ signal } = {}) {
  const j = await call('action=presets', {}, signal);
  const modes = j && j.response && j.response.modes;
  if (!Array.isArray(modes) || !modes.length) throw new Error('AVIANART didn\'t send its preset list.');
  const clean = modes.filter((m) => m && typeof m.prefix === 'string').map((m) => ({
    prefix: m.prefix, name: String(m.name || m.prefix), type: m.type || '', category: m.category || 'other',
    description: m.description || null,
  }));
  try { localStorage.setItem(LIST_KEY, JSON.stringify({ at: Date.now(), modes: clean })); } catch (e) {}
  return clean;
}

export function ownRelay() {
  try { return (localStorage.getItem(RELAY_KEY) || '').trim().replace(/\/+$/, ''); } catch (e) { return ''; }
}
export function setRelayUrl(u) {
  try {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u) localStorage.setItem(RELAY_KEY, u); else localStorage.removeItem(RELAY_KEY);
  } catch (e) {}
}
const relayUrl = () => ownRelay() || DEFAULT_RELAY;

/** "https://avianart.games/perm/xsuXUdwND" (or without https://) -> the hash. */
export function avianId(text) {
  const m = String(text || '').trim().match(/avianart\.games\/perm\/([A-Za-z0-9]{4,32})\b/);
  return m ? m[1] : null;
}
export const permLink = (hash) => `${SITE}/perm/${hash}`;

/** "jem041/onlyadkdf" -> { namespace: 'jem041', preset: 'onlyadkdf' }. */
export function splitPreset(id) {
  const s = String(id || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  const i = s.indexOf('/');
  return i < 0 ? { namespace: '', preset: s } : { namespace: s.slice(0, i), preset: s.slice(i + 1) };
}
export const presetInfo = (id) => PRESETS.find((p) => p.id === String(id || '').toLowerCase()) || null;

// ── talking to AVIANART (directly, or through the relay) ─────────────────────
let direct = null;   // null = not tried yet, true/false once known

function abortError() { const x = new Error('Stopped.'); x.cancelled = true; return x; }

async function call(query, init = {}, signal) {
  const tries = direct === false ? ['relay'] : ['direct', 'relay'];
  let lastErr = null;
  for (const how of tries) {
    const url = how === 'direct' ? `${API}?${query}` : `${relayUrl()}/api.php?${query}`;
    let r;
    try {
      r = await fetch(url, { ...init, signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw abortError();
      if (how === 'direct') { direct = false; continue; }   // CORS (or offline): use the relay from now on
      lastErr = new Error('Couldn\'t reach AVIANART or its relay. If the relay isn\'t set up yet, see "AVIANART relay" in the README.');
      lastErr.needsRelay = true;
      break;
    }
    if (how === 'direct') direct = true;
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch (e) {}
    if (!j) throw new Error(`AVIANART didn't answer with seed data (${r.status}).`);
    return j;
  }
  throw lastErr;
}

/** Ask AVIANART to roll a preset: the new seed's hash. */
export async function generate(presetId, { race = false, signal } = {}) {
  const { namespace, preset } = splitPreset(presetId);
  if (!/^[a-z0-9_.-]+$/.test(preset) || (namespace && !/^[a-z0-9_.-]+$/.test(namespace))) {
    throw new Error('That isn\'t an AVIANART preset name (like jem041/onlyadkdf).');
  }
  const ask = (name, args) => call(`action=generate&preset=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ args }]),
  }, signal);
  const hashOf = (j) => (j && j.status === 200 && j.response && j.response.hash) || null;
  // the way SahasrahBot asks for someone's preset: "namespace/preset" as the name
  let j = await ask(namespace ? `${namespace}/${preset}` : preset, { race: !!race });
  let hash = hashOf(j);
  // and the other way, with the namespace on its own
  if (!hash && namespace) {
    const j2 = await ask(preset, { race: !!race, namespace }).catch(() => null);
    if (hashOf(j2)) { j = j2; hash = hashOf(j2); }
  }
  if (!hash) {
    throw new Error('AVIANART didn\'t roll that preset' + (j && j.response && j.response.message ? `: ${j.response.message}` : '.'));
  }
  return String(hash);
}

/**
 * Ask AVIANART to roll your own settings: the new seed's hash. args are
 * avianart-ui.js customSettings(); sent exactly as AVIANART's customizer does:
 * POST api.php?action=generate, body [{args}], as text/plain.
 */
export async function generateCustom(args, { signal } = {}) {
  const j = await call('action=generate', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify([{ args }]),
  }, signal);
  const hash = j && j.status === 200 && j.response && j.response.hash;
  if (!hash) {
    throw new Error('AVIANART didn\'t roll your settings' + (j && j.response && j.response.message ? `: ${j.response.message}` : '.'));
  }
  return String(hash);
}

/** A seed by its hash, waiting while AVIANART is still making it: the response. */
export async function seed(hash, { signal, onWait } = {}) {
  const started = Date.now();
  for (;;) {
    const j = await call(`action=permlink&hash=${encodeURIComponent(hash)}`, {}, signal);
    const r = (j && j.response) || null;
    if (!r) throw new Error('AVIANART has no seed with that link.');
    const st = r.status;
    if (!st || st === 'finished') {
      if (r.bps_t0_p1 || r.patch) return r;
      throw new Error('AVIANART sent this seed without its ROM patch.');
    }
    if (st === 'failure') throw new Error('AVIANART couldn\'t make this seed' + (r.message ? `: ${String(r.message).trim()}` : '.'));
    if (Date.now() - started > 6 * 60 * 1000) throw new Error('AVIANART is taking too long with this seed. Try its link again later.');
    if (onWait) onWait(st, r.attempts, r.message);
    await new Promise((res, rej) => {
      const t = setTimeout(res, 4000);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(abortError()); }, { once: true });
    });
  }
}

// ── the ROM ──────────────────────────────────────────────────────────────────
function b64(s) {
  const bin = atob(String(s).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const bpsSourceCrc = (p) => new DataView(p.buffer, p.byteOffset, p.byteLength).getUint32(p.length - 12, true);

async function basePatchFor(r, kv) {
  const url = r.basepatch && r.basepatch.bps;
  if (!url) throw new Error('AVIANART didn\'t say which base ROM this seed needs.');
  const name = String(url).split('/').pop();
  const key = 'avian-bps-' + name;
  let bps = await kv.get(key).catch(() => null);
  if (bps) return bps;
  const full = /^https?:\/\//.test(url) ? url : `https://${String(url).replace(/^\/+/, '')}`;
  let res = null;
  try { res = await fetch(full); } catch (e) {}
  if (!res || !res.ok) {
    try { res = await fetch(`${relayUrl()}/file?u=${encodeURIComponent(full)}`); } catch (e) { res = null; }
  }
  if (!res || !res.ok) throw new Error('Couldn\'t download the base patch for this AVIANART seed.');
  bps = new Uint8Array(await res.arrayBuffer());
  await kv.set(key, bps).catch(() => {});
  return bps;
}

/** The seed's ROM from the player's Japanese 1.0 ROM (cosmetics and checksum are the caller's). */
export async function buildRom(jp, r, kv) {
  jp = jp.subarray(0, 0x100000);
  if (r.bps_t0_p1) {
    const p = b64(r.bps_t0_p1);
    if (bpsSourceCrc(p) === crc32(jp)) return applyBps(jp, p);
    // a patch onto the Door Randomizer base ROM instead
    return applyBps(applyBps(jp, await basePatchFor(r, kv)), p);
  }
  // older seeds: byte patches onto the base ROM
  const base = applyBps(jp, await basePatchFor(r, kv));
  let size = Math.max(0x200000, base.length, (r.size || 2) * 1024 * 1024);
  const writes = Array.isArray(r.patch) ? r.patch : [r.patch];
  for (const w of writes) for (const [off, bytes] of Object.entries(w)) size = Math.max(size, Number(off) + bytes.length);
  const rom = new Uint8Array(size);
  rom.set(base);
  for (const w of writes) for (const [off, bytes] of Object.entries(w)) rom.set(bytes, Number(off));
  return rom;
}

// ── what the seed is ─────────────────────────────────────────────────────────
// The Door Randomizer's spoiler settings (spoiler.meta), as AVIANART sends
// them: one value per setting. Key names differ a little between DR versions.
export function meta(r) { return (r && r.spoiler && r.spoiler.meta) || {}; }

const pick = (m, ...keys) => { for (const k of keys) if (m[k] !== undefined && m[k] !== null) return m[k]; return undefined; };
const on = (v) => v === true || v === 1 || /^(true|yes|on|1|wild)$/i.test(String(v));
const notVanilla = (v) => v !== undefined && !/^(none|vanilla|false|no|off|0|original)$/i.test(String(v));

/** What Hutch's tracker should be told about this seed. */
export function trackerFor(m) {
  const yes = (b) => (b ? 'yes' : 'no');
  const ks = pick(m, 'keyshuffle', 'keysanity');
  const keys = on(ks) || /universal/i.test(String(ks));
  const bks = on(pick(m, 'bigkeyshuffle'));
  const maps = on(pick(m, 'mapshuffle')), comps = on(pick(m, 'compassshuffle'));
  const flags = (maps ? 'm' : '') + (comps ? 'c' : '') + (bks ? 'b' : '') + (keys ? 'k' : '');
  const di = bks && keys ? 'keysanity' : keys ? 'mapcompasskeys' : (maps || comps) ? 'mapcompass' : 'standard';
  const mode = String(pick(m, 'mode') || 'open').toLowerCase();
  const pottery = String(pick(m, 'pottery') || 'none').toLowerCase();
  const drops = String(pick(m, 'dropshuffle', 'keydropshuffle') || 'none').toLowerCase();
  const gt = String(pick(m, 'gt_crystals', 'crystals_gt', 'entry_crystals_tower') ?? '7');
  return {
    gamemode: ['open', 'standard', 'inverted', 'retro'].includes(mode) ? mode : 'open',
    dungeonitems: di,
    swordless: yes(/swordless/i.test(String(pick(m, 'weapons') || ''))),
    gtcrystals: /^\d$/.test(gt) ? gt : '7',
    bossshuffle: yes(notVanilla(pick(m, 'boss_shuffle', 'shufflebosses'))),
    enemizer: yes(notVanilla(pick(m, 'enemy_shuffle', 'shuffleenemies'))),
    more: {
      dungeonshuffle: flags,
      universalkeys: yes(/universal/i.test(String(ks))),
      entranceshuffle: yes(notVanilla(pick(m, 'shuffle', 'entrance_shuffle'))),
      shopsanity: yes(on(pick(m, 'shopsanity'))),
      pottery: pottery === 'none' ? 'none' : pottery.replace(/_/g, ''),
      enemykeydrop: yes(notVanilla(drops) || on(pick(m, 'keydropshuffle'))),
      enemydrops: yes(drops === 'underworld'),
      pseudoboots: yes(on(pick(m, 'pseudoboots'))),
      mirrorscroll: yes(on(pick(m, 'mirrorscroll'))),
    },
  };
}

/** Parts of the seed the tracker can't follow (shown as a note). */
export function trackerGaps(m) {
  const out = [];
  if (notVanilla(pick(m, 'door_shuffle'))) out.push('door shuffle');
  if (notVanilla(pick(m, 'ow_shuffle', 'overworld_shuffle')) || on(pick(m, 'ow_swap', 'ow_mixed'))) out.push('overworld shuffle');
  return out;
}

/** The race flag as AVIANART reports it. */
export function isRace(m) {
  return on(m.race);
}
