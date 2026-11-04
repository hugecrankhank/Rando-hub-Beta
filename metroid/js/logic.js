/*
 * logic.js — what Samus can reach with what she has (data.js SPOTS' rules).
 * Used by the randomizer to place items so every seed can be finished, and by
 * the tracker to colour the spots.
 *
 *   M1Logic.has(req, inv)                 inv: a Set of keys (MM, B, HJ, IB, MI, ST, ...)
 *   M1Logic.collect(inv, at)              at[i] = item type at spot i (or -1 unknown);
 *                                         walks the spheres: everything reachable, taking what's there
 *   M1Logic.reach(inv)                    → array per spot: 'ok' | 'no'
 *   M1Logic.KEY[type]                     item type → inventory key
 */
(function () {
  'use strict';
  const D = window.M1;
  const KEY = ['B', 'HJ', 'LB', 'SA', 'MM', 'VA', 'WB', 'IB', 'ET', 'MI'];

  function has(req, inv) {
    for (const r of req) {
      if (Array.isArray(r)) { if (!r.some((k) => inv.has(k))) return false; }
      else if (!inv.has(r)) return false;
    }
    return true;
  }
  // the statues: both bosses beatable (Tourian's door)
  function withBosses(inv) {
    if (has(D.GOALS[0][1], inv) && has(D.GOALS[1][1], inv)) { const s = new Set(inv); s.add('ST'); return s; }
    return inv;
  }
  function collect(start, at) {
    let inv = new Set(start), taken = new Set(), changed = true;
    while (changed) {
      changed = false;
      inv = withBosses(inv);
      D.SPOTS.forEach((s, i) => {
        if (taken.has(i) || !has(s[7], inv)) return;
        taken.add(i);
        const t = at ? at[i] : -1;
        if (t >= 0 && !inv.has(KEY[t])) { inv.add(KEY[t]); changed = true; }
      });
    }
    return { inv: withBosses(inv), taken };
  }
  function reach(inv) {
    const v = withBosses(inv);
    return D.SPOTS.map((s) => has(s[7], v) ? 'ok' : 'no');
  }
  window.M1Logic = { has, collect, reach, KEY };
})();
