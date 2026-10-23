/*
 * Local signer: hear a TikTok LIVE through a normal browser window.
 *
 * TikTok's own LIVE web page connects to the live feed (signing and all), exactly
 * as it does for any viewer. We open that page in Chrome or Edge with its own
 * profile folder (so the TikTok login is remembered) and Chrome's debugging
 * connection turned on, then read the messages the page receives:
 *   - wss://…/webcast/im/push/…   binary push frames
 *   - https://…/webcast/im/fetch/  the first batch (and polling, if TikTok uses it)
 * and decode the few message types crowd control needs. Nothing is sent to
 * TikTok by us; we only read what the page is already getting.
 *
 * No npm packages: a tiny WebSocket client (node:net / node:http), a tiny
 * protobuf reader, and node:zlib for gzip.
 *
 * Message layout (field numbers) follows TikTok's webcast protocol as documented
 * by the community (github.com/isaackogan/TikTok-Webcast-Protobuf); the code here
 * is our own.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';

// ── finding a browser ──────────────────────────────────────────────────────
export function findBrowser(custom) {
  const env = process.env;
  const list = [];
  if (custom) list.push(custom);
  if (process.platform === 'win32') {
    for (const base of [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean)) {
      list.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      list.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      list.push(path.join(base, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
    }
  } else if (process.platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    list.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge', '/usr/bin/brave-browser', '/snap/bin/chromium');
  }
  return list.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

// ── tiny protobuf reader ───────────────────────────────────────────────────
// decode(buf) -> Map(fieldNo -> [values]); varints come back as BigInt,
// length-delimited as Buffer (decode again for nested messages).
export function decode(buf) {
  const out = new Map();
  let i = 0;
  const varint = () => {
    let r = 0n, s = 0n, b;
    do { if (i >= buf.length) throw new Error('truncated'); b = buf[i++]; r |= BigInt(b & 0x7f) << s; s += 7n; } while (b & 0x80);
    return r;
  };
  while (i < buf.length) {
    const key = Number(varint()), f = key >>> 3, w = key & 7;
    let v;
    if (w === 0) v = varint();
    else if (w === 2) { const n = Number(varint()); if (i + n > buf.length) throw new Error('truncated'); v = buf.subarray(i, i + n); i += n; }
    else if (w === 1) { v = buf.subarray(i, i + 8); i += 8; }
    else if (w === 5) { v = buf.subarray(i, i + 4); i += 4; }
    else throw new Error('wire type ' + w);
    if (!out.has(f)) out.set(f, []);
    out.get(f).push(v);
  }
  return out;
}
const one = (m, f) => (m && m.has(f) ? m.get(f)[0] : undefined);
const str = (m, f) => { const v = one(m, f); return Buffer.isBuffer(v) ? v.toString('utf8') : ''; };
const num = (m, f) => { const v = one(m, f); return typeof v === 'bigint' ? Number(BigInt.asIntN(64, v)) : 0; };
const sub = (m, f) => { const v = one(m, f); if (!Buffer.isBuffer(v)) return null; try { return decode(v); } catch { return null; } };
const unzip = (b) => (b && b.length > 2 && b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b);

function user(u) {   // User: nickname = 3, uniqueId (the @name) = 38, avatar = 9 (url list = 1)
  if (!u) return { user: 'someone', nickname: '', avatar: '' };
  const pic = sub(u, 9), urls = pic ? (pic.get(1) || []).map((x) => x.toString('utf8')) : [];
  return { user: str(u, 38) || str(u, 3) || 'someone', nickname: str(u, 3), avatar: urls.find((x) => /^https:\/\//.test(x)) || '' };
}

// One webcast message (method name + payload) -> a crowd-control event, or null.
export function parseMessage(method, payload) {
  let m; try { m = decode(payload); } catch { return null; }
  const common = sub(m, 1), id = common ? String(one(common, 2) ?? '') : '';
  switch (method) {
    case 'WebcastGiftMessage': {
      // gift = 15 (name = 16, type = 11, diamonds = 12, picture = 1 -> urls 1), user = 7,
      // repeatCount = 5, repeatEnd = 9, giftId = 2. Streakable gifts (type 1) send updates
      // while the streak runs; only the last one (repeatEnd) counts.
      const g = sub(m, 15), type = num(g, 11), end = num(m, 9);
      if (type === 1 && !end) return null;
      const pic = sub(g, 1), urls = pic ? (pic.get(1) || []).map((x) => x.toString('utf8')) : [];
      return { kind: 'gift', id, ...user(sub(m, 7)), gift: str(g, 16), giftId: num(m, 2), count: Math.max(1, num(m, 5)),
        diamonds: num(g, 12), picture: urls.find((x) => /^https:\/\//.test(x)) || '' };
    }
    case 'WebcastLikeMessage':   // likeCount = 2, user = 5
      return { kind: 'like', id, ...user(sub(m, 5)), count: Math.max(1, num(m, 2)) };
    case 'WebcastChatMessage':   // user = 2, comment = 3
      return { kind: 'chat', id, ...user(sub(m, 2)), text: str(m, 3) };
    case 'WebcastSocialMessage': {   // user = 2; follow vs share from common.displayText.key (8 -> 1)
      const t = common ? sub(common, 8) : null, key = (t ? str(t, 1) : '').toLowerCase();
      const kind = key.includes('follow') ? 'follow' : key.includes('share') ? 'share' : '';
      return kind ? { kind, id, ...user(sub(m, 2)) } : null;
    }
    case 'WebcastControlMessage': {   // action = 2: 3 = stream ended
      const a = num(m, 2);
      return a === 3 || a === 4 ? { kind: 'end', id } : null;
    }
    case 'WebcastSubNotifyMessage':   // a new subscriber, now called a Super Fan (user = 2)
      return { kind: 'superfan', id, ...user(findUser(m)) };
    default: {
      // Others are told apart by the label TikTok shows for them
      // (common.displayText.key). Super Fan and community / fan club joins
      // are matched by name; anything else with a label is reported as
      // "other" (the bridge logs each new one once).
      const t = common ? sub(common, 8) : null, key = (t ? str(t, 1) : '').toLowerCase();
      if (!key) return null;
      if (/super_?fan|subscri/.test(key)) return { kind: 'superfan', id, ...user(findUser(m)) };
      if (/fan_?club|fans_?club|fanteam|join_?team|team_?join|community/.test(key)) return { kind: 'community', id, ...user(findUser(m)) };
      if (method === 'WebcastMemberMessage' || method === 'WebcastRoomUserSeqMessage') return null;   // viewers coming and going
      return { kind: 'other', id, method, key };
    }
  }
}
// The viewer in a message we don't know the layout of: the first nested
// message that looks like a User (has an @name, field 38).
function findUser(m) {
  for (const f of [2, 5, 7, 3, 4, 6, 8, 9, 10]) {
    for (const v of (m.get(f) || [])) {
      if (!Buffer.isBuffer(v)) continue;
      let u; try { u = decode(v); } catch { continue; }
      if (u.has(38) && Buffer.isBuffer(one(u, 38))) return u;
    }
  }
  return null;
}

// A fetch result / push payload: messages = 1 (each: method = 1, payload = 2).
export function parseBatch(buf) {
  let m; try { m = decode(unzip(buf)); } catch { return []; }
  const evs = [];
  for (const raw of m.get(1) || []) {
    if (!Buffer.isBuffer(raw)) continue;
    let msg; try { msg = decode(raw); } catch { continue; }
    const ev = parseMessage(str(msg, 1), one(msg, 2) || Buffer.alloc(0));
    if (ev) evs.push(ev);
  }
  return evs;
}
// A websocket push frame: headers = 5 (key 1 / value 2), payloadType = 7, payload = 8.
export function parsePushFrame(buf) {
  let f; try { f = decode(buf); } catch { return []; }
  const type = str(f, 7), payload = one(f, 8);
  if (!Buffer.isBuffer(payload) || (type && type !== 'msg')) return [];
  let body = payload;
  try { body = unzip(payload); } catch { return []; }
  return parseBatch(body);
}

// ── minimal WebSocket client (for Chrome's debugging connection) ───────────
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
    req.on('upgrade', (res, socket) => {
      const ws = { socket, buf: Buffer.alloc(0), parts: [], onmessage: null, onclose: null, closed: false,
        send(text) { writeMasked(socket, Buffer.from(text), 0x1); },
        close() { try { socket.end(); } catch {} } };
      socket.on('data', (d) => { ws.buf = Buffer.concat([ws.buf, d]); readFrames(ws); });
      const bye = () => { if (!ws.closed) { ws.closed = true; ws.onclose && ws.onclose(); } };
      socket.on('close', bye); socket.on('error', bye);
      resolve(ws);
    });
    req.on('response', (res) => { res.resume(); reject(new Error('HTTP ' + res.statusCode)); });
    req.on('error', reject);
    req.end();
  });
}
function readFrames(ws) {
  for (;;) {
    const b = ws.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f, fin = b[0] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (b.length < off + len) return;
    const data = b.subarray(off, off + len);
    ws.buf = b.subarray(off + len);
    if (op === 0x1 || op === 0x2 || op === 0x0) {
      ws.parts.push(Buffer.from(data));
      if (fin) { const all = Buffer.concat(ws.parts); ws.parts = []; ws.onmessage && ws.onmessage(all.toString('utf8')); }
    } else if (op === 0x9) writeMasked(ws.socket, data, 0xA);
    else if (op === 0x8) { ws.close(); return; }
  }
}
function writeMasked(socket, payload, op) {
  const mask = crypto.randomBytes(4), n = payload.length;
  let head;
  if (n < 126) head = Buffer.from([0x80 | op, 0x80 | n]);
  else if (n < 65536) head = Buffer.from([0x80 | op, 0x80 | 126, n >> 8, n & 255]);
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(n), 2); }
  const body = Buffer.from(payload); for (let i = 0; i < n; i++) body[i] ^= mask[i & 3];
  try { socket.write(Buffer.concat([head, mask, body])); } catch {}
}
function getJson(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let t = ''; res.on('data', (d) => t += d); res.on('end', () => { try { resolve(JSON.parse(t)); } catch (e) { reject(e); } });
    }).on('error', reject).setTimeout(3000, function () { this.destroy(new Error('timeout')); });
  });
}

// ── the source ─────────────────────────────────────────────────────────────
// opts: { username, browserPath, port, profileDir, liveUrl, log, onEvent(ev), onStatus(text, ok) }
export function startLocalSigner(opts) {
  const log = opts.log || (() => {});
  const status = (t, ok) => { opts.onStatus && opts.onStatus(t, !!ok); };
  const port = opts.port || 21215;
  const name = String(opts.username || '').replace(/^@/, '').trim();
  const liveUrl = opts.liveUrl || (name ? `https://www.tiktok.com/@${encodeURIComponent(name)}/live` : 'https://www.tiktok.com/live');
  let stopped = false, cdp = null, retryT = null, child = null, lastFrame = 0, seen = new Set(), seenQ = [];
  const sockets = new Map();      // requestId -> url, per session ("sid|rid")
  const fetches = new Map();      // "sid|rid" -> url
  let nextId = 1; const pending = new Map();

  function emit(ev) {
    if (ev.id) { if (seen.has(ev.id)) return; seen.add(ev.id); seenQ.push(ev.id); if (seenQ.length > 4000) seen.delete(seenQ.shift()); }
    lastFrame = Date.now();
    opts.onEvent && opts.onEvent(ev);
  }
  function call(method, params = {}, sessionId) {
    return new Promise((resolve) => {
      if (!cdp || cdp.closed) return resolve(null);
      const id = nextId++;
      pending.set(id, resolve);
      cdp.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 8000);
    });
  }
  async function watch(sessionId) {
    await call('Network.enable', { maxTotalBufferSize: 50e6, maxResourceBufferSize: 20e6 }, sessionId);
    await call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
  }
  function onCdp(text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.id && pending.has(m.id)) { const r = pending.get(m.id); pending.delete(m.id); r(m.result || null); return; }
    const sid = m.sessionId || '', p = m.params || {};
    switch (m.method) {
      case 'Target.targetCreated': case 'Target.targetInfoChanged': {
        const t = p.targetInfo || {};
        if (t.type === 'page' && /tiktok\.com|\/live/.test(t.url || '') && !t.attached) call('Target.attachToTarget', { targetId: t.targetId, flatten: true });
        break;
      }
      case 'Target.attachedToTarget': watch(p.sessionId); break;   // the page and its workers
      case 'Network.webSocketCreated':
        if (/\/webcast\/im\//.test(p.url || '')) { sockets.set(sid + '|' + p.requestId, p.url); log('local signer: TikTok live feed opened'); status('Connected to TikTok LIVE (local signer)', true); }
        break;
      case 'Network.webSocketFrameReceived': {
        if (!sockets.has(sid + '|' + p.requestId)) break;
        const r = p.response || {};
        if (r.opcode !== 2) break;
        let buf; try { buf = Buffer.from(r.payloadData || '', 'base64'); } catch { break; }
        for (const ev of parsePushFrame(buf)) emit(ev);
        lastFrame = Date.now();
        break;
      }
      case 'Network.webSocketClosed':
        if (sockets.delete(sid + '|' + p.requestId)) status('TikTok page reconnecting…', false);
        break;
      case 'Network.responseReceived':
        if (/\/webcast\/im\/fetch/.test((p.response || {}).url || '')) fetches.set(sid + '|' + p.requestId, p.response.url);
        break;
      case 'Network.loadingFinished': {
        const k = sid + '|' + p.requestId;
        if (!fetches.has(k)) break;
        fetches.delete(k);
        call('Network.getResponseBody', { requestId: p.requestId }, sid || undefined).then((res) => {
          if (!res) return;
          const buf = Buffer.from(res.body || '', res.base64Encoded ? 'base64' : 'binary');
          const evs = parseBatch(buf);
          if (evs.length || buf.length) { lastFrame = Date.now(); status('Connected to TikTok LIVE (local signer)', true); }
          for (const ev of evs) emit(ev);
        });
        break;
      }
    }
  }
  async function connectCdp() {
    let info; try { info = await getJson(port, '/json/version'); } catch { return false; }
    try { cdp = await wsConnect(info.webSocketDebuggerUrl); } catch { return false; }
    cdp.onmessage = onCdp;
    cdp.onclose = () => { cdp = null; if (!stopped) { status('TikTok window closed. Click "Open my LIVE" to reopen it.', false); retry(5000); } };
    await call('Target.setDiscoverTargets', { discover: true });
    const tl = await call('Target.getTargets');
    let page = (tl && tl.targetInfos || []).find((t) => t.type === 'page' && /tiktok\.com|\/live/.test(t.url || ''));
    if (!page) { const r = await call('Target.createTarget', { url: liveUrl }); if (r) page = { targetId: r.targetId, fresh: true }; }
    if (page) {
      const a = await call('Target.attachToTarget', { targetId: page.targetId, flatten: true });
      // A LIVE page that was already open has its feed connected from before we were
      // watching, and Chrome only reports feeds opened after that. Reload it once.
      if (a && a.sessionId && !page.fresh) { await watch(a.sessionId); await call('Page.reload', {}, a.sessionId); }
    }
    status('TikTok window open. Waiting for the LIVE…', false);
    return true;
  }
  function launch() {
    if (!opts.browserPath) { status('No Chrome or Edge found. Install Chrome, or set "browserPath" in mapping.json.', false); log('local signer: no Chrome or Edge found'); return false; }
    fs.mkdirSync(opts.profileDir, { recursive: true });
    const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${opts.profileDir}`, '--no-first-run', '--no-default-browser-check',
      '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--window-size=900,700', '--new-window', liveUrl];
    try {
      child = spawn(opts.browserPath, args, { detached: true, stdio: 'ignore' });
      child.on('error', (e) => { log('local signer: could not start the browser: ' + e.message); status('Could not start the browser (' + e.message + ')', false); });
      child.unref();
      log(`local signer: opened ${liveUrl} in ${path.basename(opts.browserPath)} (keep that window open; minimizing is fine)`);
      return true;
    } catch (e) { status('Could not start the browser (' + e.message + ')', false); return false; }
  }
  function retry(ms) { clearTimeout(retryT); retryT = setTimeout(go, ms); }
  async function go(forceOpen) {
    if (stopped) return;
    if (await connectCdp()) {
      if (forceOpen) await call('Target.createTarget', { url: liveUrl });
      return;
    }
    if (!launch()) return retry(15000);
    for (let i = 0; i < 20 && !stopped; i++) { await new Promise((r) => setTimeout(r, 750)); if (await connectCdp()) return; }
    status('The TikTok window didn\'t answer. Close it and click "Open my LIVE".', false); retry(10000);
  }
  if (!name && !opts.liveUrl) status('Type your TikTok name and click Connect', false);
  else go();
  return {
    stop() { stopped = true; clearTimeout(retryT); if (cdp) cdp.close(); },
    open() { if (!cdp) go(); else call('Target.createTarget', { url: liveUrl }); },
    get url() { return liveUrl; },
    get lastFrame() { return lastFrame; },
  };
}
