/*
 * logic.js — the tracker's logic for Super Metroid: which item spots DASH's
 * own rules say Samus can reach with what she has now, so the map and the
 * spot list can show them green (there and back), orange (there, but no way
 * back to the ship yet) or red (not yet).
 *
 * It's DASH's generator doing the work (gen/dash-core.js in gen/seed-worker.js,
 * kept open): DASH writes the seed number and every setting into the ROM, so
 * the seed's graph is built again from the ROM being played, whoever made it
 * (here, dashrando.net, another copy of the hub), and checked against the
 * item bytes in the ROM. Race seeds hide their settings, so they get no logic.
 *
 *   SMRLogic.load(rom)                  the ROM being played (Uint8Array), once
 *   SMRLogic.update(inv)                what Samus has; answers come to onReach
 *   SMRLogic.onReach(fn)                fn(reach | null): { 'spot|Area': 'ok'|'back'|'no' }
 *   SMRLogic.onState(fn)                fn({ ok, error, seed, placed, spoiler })
 *   SMRLogic.state                      the last load's answer
 */
(function () {
  'use strict';
  let w = null, n = 0, pending = null, inflight = false, state = { ok: false, error: '' }, reach = null;
  const reachFns = [], stateFns = [];
  function worker() {
    if (w) return w;
    w = new Worker('gen/seed-worker.js', { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'logic-loaded') {
        state = m; stateFns.forEach((f) => { try { f(state); } catch (x) {} });
        if (!m.ok) { reach = null; reachFns.forEach((f) => { try { f(null); } catch (x) {} }); }
        else if (pending) { inflight = false; send(); }
      } else if (m.type === 'logic-reach') {
        inflight = false;
        if (m.n !== n) { if (pending) send(); return; }   // an older question
        reach = m.reach || null;
        reachFns.forEach((f) => { try { f(reach); } catch (x) {} });
        if (pending) send();
      }
    };
    w.onerror = (e) => { console.warn('[sm logic]', e.message || e); state = { ok: false, error: 'the logic failed to load' }; stateFns.forEach((f) => { try { f(state); } catch (x) {} }); };
    return w;
  }
  function send() {
    if (!state.ok || inflight || !pending) return;
    inflight = true; n++;
    worker().postMessage({ type: 'logic', inv: pending, n });
    pending = null;
  }
  window.SMRLogic = {
    load(rom) {
      if (!rom || rom.length < 0x300000) { state = { ok: false, error: 'not a Super Metroid ROM' }; stateFns.forEach((f) => { try { f(state); } catch (x) {} }); return; }
      state = { ok: false, error: '', loading: true }; reach = null;
      const bytes = new Uint8Array(rom).slice();
      worker().postMessage({ type: 'logic-load', rom: bytes }, [bytes.buffer]);
    },
    update(inv) { pending = inv; send(); },
    onReach(fn) { reachFns.push(fn); if (reach) fn(reach); },
    onState(fn) { stateFns.push(fn); },
    get state() { return state; },
    get reach() { return reach; },
  };
})();
