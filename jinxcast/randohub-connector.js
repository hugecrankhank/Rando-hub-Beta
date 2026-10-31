/*
 * Rando Hub ⇄ JinxCast connector
 * Copyright (c) 2026 Hank (hugecrankhank). Part of Rando Hub, licensed like the
 * rest of it (LICENSE.md, NOTICE.md).
 *
 * Permission: this file may be used and adapted in Snack OS / JinxCast, with
 * credit to Huge Crank Hank (Hank @huge_crank_hank) kept (NOTICE.md, 3).
 *
 * The Snack OS side of the link: a server module for JinxCast / Snack OS
 * (Kuba's stream engine) that Rando Hub's game pages connect to. It lives in
 * Snack OS's server/ folder as randohub-connector.js, next to
 * randohub-effects.json (both in this folder).
 */
/**
 * Rando Hub (ALTTPR + Z1R in the browser) — effect transport.
 *
 *   port       43386 (RANDOHUB_PORT in server/.env)
 *   direction  THE GAME DIALS OUT TO US, like Sail and Dusklight. Rando Hub is
 *              a web page; a page cannot listen, so it connects in over a
 *              WebSocket and retries on its own (2 s, backing off to 15 s).
 *   framing    one JSON object per WebSocket message
 *
 * Rando Hub already runs every effect itself, inside its own emulator: RAM
 * writes, button filters, picture tricks, boss detours, seed rolls. So nothing
 * here pokes memory and there is no ROM patch — any seed works, and the
 * effects behave exactly as they do on Hank's own stream. This file only
 * carries requests in and answers out.
 *
 *   hub → us   {"type":"hello","app":"alttpr-snes9x"|"z1r","proto":2,"effects":[{id,name,secs,good}]}
 *   us → hub   {"type":"effect","id":7,"effect":"invert","user":"someone","label":"Rose","count":1}
 *   hub → us   {"type":"result","id":7,"effect":"invert","status":"queued"}
 *   hub → us   {"type":"result","id":7,"effect":"invert","status":"applied"}      (when it lands)
 *              {"type":"result","id":7,"effect":"invert","status":"refused","reason":"No empty bottle"}
 *
 * "queued" is the answer that matters for a gift. Rando Hub keeps its own
 * queue and only applies effects in normal play (not menus, text boxes or
 * screen transitions), so a gift sent during a cutscene is held there and
 * lands a few seconds later. Snack OS does not need a retry queue of its own
 * for this game; holding it twice would fire it twice.
 *
 * An older Rando Hub (proto 1, before the JinxCast link) never sends "result".
 * It is still usable: the request is taken as queued once it is written, and
 * its "applied" messages are matched by effect id.
 */

const http = require('http');
const WebSocket = require('ws');

const DEFAULT_PORT = 43386;
const DEFAULT_HOST = '127.0.0.1';

/* Who may connect. The server is loopback-only, but any web page open in the
   streamer's browser can still dial localhost, and one that did could take
   the place of the game and swallow every gift. So only Rando Hub's own
   pages are let in: the two GitHub Pages sites, the Windows app (served from
   127.0.0.1) and a hub opened from a local folder or dev server. Add more
   with RANDOHUB_ORIGINS (comma separated). */
const DEFAULT_ORIGINS = [
  'https://hugecrankhank.github.io',
  'http://localhost', 'http://127.0.0.1',
  'https://localhost', 'https://127.0.0.1',
  'null', // file://
];

const APP_GAME = { 'alttpr-snes9x': 'alttp', alttpr: 'alttp', z1r: 'z1' };
const GAME_NAME = { alttp: 'A Link to the Past', z1: 'Zelda 1' };

class RandoHubConnector {
  constructor(opts = {}) {
    this.port = opts.port || DEFAULT_PORT;
    this.host = opts.host || DEFAULT_HOST;
    this.origins = DEFAULT_ORIGINS.concat(opts.origins || []);
    this.server = null;
    this.wss = null;
    this.socket = null;
    this.connected = false;
    this.bindError = null;
    this.hub = null;              // { app, game, proto, hero, effects: Map<id, {id,name,secs,good}> }
    this.run = null;              // the hub's last "run" report (seed, deaths...)
    this.nextId = 1;
    this.pending = new Map();     // id -> { resolve, timer, effect }
    this.inFlight = new Map();    // id -> { effect, user, at } — queued in the hub, not landed yet
    this.onStatusChange = null;
    this.onLanded = null;         // (info) when the hub reports an effect has landed / been refused
    this.durations = null;        // () => { effectId: secs } pushed to the hub on connect
    this.stats = { sent: 0, queued: 0, landed: 0, refused: 0, failed: 0 };
  }

  _originOk(origin) {
    if (!origin) return true; // the Windows app and command-line tools send none
    const o = String(origin).toLowerCase();
    return this.origins.some((allowed) => {
      allowed = String(allowed).toLowerCase();
      // localhost / 127.0.0.1 on any port
      return o === allowed || (/^https?:\/\/(localhost|127\.0\.0\.1)$/.test(allowed) && o.startsWith(allowed + ':'));
    });
  }

  listen() {
    if (this.server) return;
    this.server = http.createServer((req, res) => {
      // A plain GET answers what this port is, so a curious browser tab gets a
      // sentence instead of an error.
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Snack OS — Rando Hub link. Point Rando Hub\'s Crowd effects at ws://localhost:' + this.port + '\n');
    });
    this.wss = new WebSocket.Server({
      server: this.server,
      verifyClient: (info) => {
        const ok = this._originOk(info.origin);
        if (!ok) console.log('🎲 Rando Hub: refused a connection from ' + info.origin + ' (not a Rando Hub page; add it to RANDOHUB_ORIGINS if it is)');
        return ok;
      },
    });

    this.wss.on('connection', (ws) => {
      /* Newest connection wins, as with Dusklight. Reloading the hub, or
         switching it from ALTTP to Zelda 1, opens a new page before the old
         one has closed; refusing the newcomer would wedge the link until the
         old socket timed out. */
      if (this.socket && this.socket !== ws) {
        try { this.socket.close(4000, 'replaced by a newer Rando Hub page'); } catch (_) {}
        this._settleAll('Rando Hub reconnected');
      }
      this.socket = ws;
      this.hub = null;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (data) => this._handle(ws, data));
      const gone = () => {
        if (this.socket !== ws) return;
        this.socket = null;
        const was = this.connected;
        this.connected = false;
        this.hub = null;
        this._settleAll('Rando Hub disconnected');
        console.log('🎲 Rando Hub disconnected');
        if (was && this.onStatusChange) this.onStatusChange(false);
      };
      ws.on('close', gone);
      ws.on('error', gone);
      // It is not "connected" until it says hello: that is when we know
      // which game it is and what it can do.
    });

    // ws re-emits the HTTP server's errors on itself; with no listener that
    // would throw, and the bridge's crash guard treats a busy port as "Snack
    // OS is already running" and stops everything. The server's own handler
    // below says what went wrong.
    this.wss.on('error', () => {});

    this.server.on('error', (err) => {
      this.bindError = err.code === 'EADDRINUSE'
        ? 'port ' + this.port + ' is already taken — another copy of Snack OS? Set RANDOHUB_PORT in server/.env to move it'
        : err.message;
      console.log('🎲 Rando Hub: ' + this.bindError);
      this.server = null; this.wss = null;
    });

    this.server.listen(this.port, this.host, () => {
      this.bindError = null;
      console.log('🎲 Rando Hub: waiting on ws://localhost:' + this.port + ' — in Rando Hub, ⋯ menu → Crowd effects → JinxCast');
    });

    // A browser tab that was closed without a clean goodbye (a crash, a
    // sleeping laptop) leaves a socket that looks open forever. Ping it.
    this.heartbeat = setInterval(() => {
      const ws = this.socket;
      if (!ws) return;
      if (!ws.isAlive) { try { ws.terminate(); } catch (_) {} return; }
      ws.isAlive = false;
      try { ws.ping(); } catch (_) {}
    }, 15000);
  }

  close() {
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
    if (this.socket) { try { this.socket.terminate(); } catch (_) {} this.socket = null; }
    if (this.wss) { try { this.wss.close(); } catch (_) {} this.wss = null; }
    if (this.server) { try { this.server.close(); } catch (_) {} this.server = null; }
    this._settleAll('Rando Hub listener stopped');
    const was = this.connected;
    this.connected = false;
    this.hub = null;
    if (was && this.onStatusChange) this.onStatusChange(false);
  }

  _settleAll(reason) {
    for (const [, w] of this.pending) { clearTimeout(w.timer); w.resolve({ ok: false, reason }); }
    this.pending.clear();
    this.inFlight.clear();
  }

  _send(msg, ws = this.socket) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try { ws.send(JSON.stringify(msg)); return true; } catch (_) { return false; }
  }

  _handle(ws, data) {
    if (ws !== this.socket) return;
    let m;
    try { m = JSON.parse(String(data)); } catch (_) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'hello') {
      const effects = new Map();
      (Array.isArray(m.effects) ? m.effects : []).forEach((e) => { if (e && e.id) effects.set(String(e.id), e); });
      const game = APP_GAME[m.app] || 'alttp';
      this.hub = { app: m.app || '?', game, proto: m.proto | 0 || 1, hero: m.hero || '', effects, at: Date.now() };
      const was = this.connected;
      this.connected = true;
      console.log('🎲 Rando Hub connected — ' + GAME_NAME[game] + ', ' + effects.size + ' effects' +
                  (this.hub.proto < 2 ? ' (older Rando Hub: no per-effect answers, update it for those)' : ''));
      this._send({ type: 'status', text: 'JinxCast (Snack OS) connected' });
      if (typeof this.durations === 'function') {
        try { const secs = this.durations(); if (secs && Object.keys(secs).length) this._send({ type: 'durations', secs }); } catch (_) {}
      }
      if (!was && this.onStatusChange) this.onStatusChange(true);
      return;
    }

    if (m.type === 'result') {
      const id = m.id | 0;
      const waiter = this.pending.get(id);
      if (m.status === 'queued') {
        this.stats.queued++;
        if (waiter) {
          clearTimeout(waiter.timer); this.pending.delete(id);
          this.inFlight.set(id, { effect: m.effect, user: waiter.user, label: waiter.label, at: Date.now() });
          waiter.resolve({ ok: true, status: 'queued', queued: true, game: this.hub && this.hub.game });
        }
        return;
      }
      const landed = m.status === 'applied';
      if (landed) this.stats.landed++; else this.stats.refused++;
      const fl = this.inFlight.get(id); this.inFlight.delete(id);
      if (waiter) {
        // refused before it was ever queued (unknown effect, queue full)
        clearTimeout(waiter.timer); this.pending.delete(id);
        waiter.resolve({ ok: landed, status: m.status, reason: landed ? null : (m.reason || m.status) });
      }
      if (this.onLanded) {
        try { this.onLanded({ id, effect: m.effect, ok: landed, reason: m.reason || null, user: (fl && fl.user) || m.user || '', label: (fl && fl.label) || '' }); } catch (_) {}
      }
      return;
    }

    if (m.type === 'applied') {
      // Every hub sends this; a proto-2 hub sends "result" too, so only an
      // old hub's "applied" is counted here.
      if (this.hub && this.hub.proto >= 2) return;
      this.stats.landed++;
      if (this.onLanded) { try { this.onLanded({ effect: m.effect, ok: true, user: m.user || '' }); } catch (_) {} }
      return;
    }

    if (m.type === 'run') { this.run = m; return; }
    if (m.type === 'seed' && this.run) { this.run.seed = m.seed; return; }
    // reveal, detour, death, music, livegame, test: Crowd Control+ features
    // with no Snack OS equivalent yet. Ignored, not an error.
  }

  /** What the connected hub can do right now (ids), or null if nothing is connected. */
  liveIds() { return this.hub ? new Set(this.hub.effects.keys()) : null; }

  /**
   * Fire one effect.
   * Resolves { ok, status: 'queued' | 'applied' | 'refused', reason }.
   * `count` repeats it inside the hub (a combo), capped at 10 there.
   */
  fire(effectId, opts = {}) {
    if (!this.connected || !this.socket) {
      return Promise.resolve({
        ok: false,
        reason: this.bindError
          ? ('not listening: ' + this.bindError)
          : 'Rando Hub is not connected — open the game in Rando Hub, ⋯ menu → Crowd effects → JinxCast',
      });
    }
    const id = String(effectId);
    if (this.hub && this.hub.effects.size && !this.hub.effects.has(id)) {
      return Promise.resolve({ ok: false, status: 'unavailable', reason: 'not one of ' + GAME_NAME[this.hub.game] + '\'s effects in this Rando Hub' });
    }
    const rid = this.nextId++;
    const msg = {
      type: 'effect', id: rid, effect: id,
      user: String(opts.viewer || '').slice(0, 32),
      label: String(opts.label || '').slice(0, 40),
      count: Math.max(1, Math.min(10, parseInt(opts.count, 10) || 1)),
    };
    this.stats.sent++;
    if (!this._send(msg)) { this.stats.failed++; return Promise.resolve({ ok: false, reason: 'could not write to Rando Hub' }); }

    if (!this.hub || this.hub.proto < 2) {
      // Old hub: it never answers. Written is as good as queued.
      this.stats.queued++;
      return Promise.resolve({ ok: true, status: 'queued', queued: true, game: this.hub && this.hub.game });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(rid);
        this.stats.failed++;
        resolve({ ok: false, reason: 'Rando Hub did not answer in time (is the game tab asleep in the background?)' });
      }, 5000);
      this.pending.set(rid, { resolve, timer, effect: id, user: msg.user, label: msg.label });
    });
  }

  status() {
    return {
      connected: this.connected,
      listening: !!this.server && !this.bindError,
      port: this.port,
      reason: this.bindError,
      game: this.hub ? this.hub.game : null,
      gameName: this.hub ? GAME_NAME[this.hub.game] : null,
      app: this.hub ? this.hub.app : null,
      proto: this.hub ? this.hub.proto : null,
      hero: this.hub ? this.hub.hero : null,
      effects: this.hub ? this.hub.effects.size : 0,
      waiting: this.inFlight.size,
      seed: this.run && this.run.seed ? this.run.seed : null,
      stats: Object.assign({}, this.stats),
    };
  }
}

module.exports = { RandoHubConnector, GAME_NAME };
