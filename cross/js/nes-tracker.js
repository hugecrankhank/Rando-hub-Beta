/*
 * nes-tracker.js — nes-tracker.html's own part: the Zelda 1 + Metroid tracker
 * (../zm/js/tracker.js) set up for the four-game combo: the seed from the quad
 * page, its portals and goal in "The way", the SNES items on NES spots named,
 * the colours following the page's Zelda / Metroid switch, and the window's
 * size picking the layout (?view=items / ?view=map: a window of its own).
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const host = () => {
    try { if (parent !== window && parent.QuadApp) return parent; } catch (e) {}
    try { if (opener && opener.QuadApp) return opener; } catch (e) {}
    try { if (parent !== window && parent.opener && parent.opener.QuadApp) return parent.opener; } catch (e) {}   // (moved into a pop-out window)
    return null;
  };
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'map' || view === 'items') document.body.classList.add('pop-' + view);

  // an SNES item on a NES spot: its SMZ3 name
  const zmName = ZMGen.itemName;
  ZMGen.itemName = (it) => {
    if (it && it.game === 'snes' && (it.nice || typeof it.type === 'string')) return (it.nice || it.type) + ' (ALttP)';   // (Z1Z3: an A Link to the Past item)
    if (it && it.game === 'sm') return (it.name || (typeof it.type === 'string' ? it.type : 'Super Metroid item')) + ' (Super Metroid)';   // (M1SM)
    if (it && it.game === 'snes') { const h = host(), G = h && h.SMZ3Gen; return G ? (G.IT_DESC[G.IT_NAME[it.type]] || 'SNES item') + ' (SNES)' : 'SNES item'; }
    return zmName(it);
  };
  const NAME = { z1: 'Zelda 1', m1: 'Metroid' };
  const way = (n) => (n.link === 'linked' ? 'Zelda 1 ⇄ Zebes: a “take any road” cave ⇄ an elevator room. ' : '') +
    'Back to ' + (n.portals === 'kakariko' ? 'Kakariko' : 'Hyrule (ALttP)') + ': ' + (n.exits === 'exits' ? 'at a “take any road” cave or an elevator room.' : (n.link === 'linked' ? '⇄ / P anywhere.' : 'a “take any road” cave in Zelda 1, or ⇄ / P anywhere.')) +
    (n.items === 'apart' ? ' NES items stay on the NES.' : '');
  // Z1Z3 (../z1z3/): one way in (Kakariko's Elder's House), A Link to the Past's items on some spots
  const z1z3Way = (st, m, L) => {
    const where = L ? L.where : 'snes', won = L && L.record ? L.record.won : {}, o = m.options || {};
    const waiting = st.pending.z1 && st.pending.z1.length ? ' · ' + st.pending.z1.map(ZMGen.itemName).join(', ') + ' waiting for Link' : '';
    const goal = { both: 'both Ganons', z3: 'A Link to the Past’s Ganon', z1: 'Zelda 1’s Ganon' }[o.goal || 'both'];
    return '<span class="goal-r">Playing: ' + (where === 'snes' ? 'A Link to the Past' : 'Zelda 1') + '</span>' +
      '<span class="goal-c">The way in: <b>' + ((m.portal && m.portal.name) || 'the Elder’s House') + '</b> in Kakariko. Back to Kakariko: ' + (o.exits === 'exits' ? 'a “take any road” cave.' : 'a “take any road” cave, or ⇄ / P anywhere.') + waiting + '</span>' +
      '<span class="goal-c">Goal: ' + goal + ' · ALttP ' + (won.snes ? '✓' : '·') + ' · Zelda 1 ' + (won.z1 ? '✓' : '·') + '</span>';
  };
  // M1SM (../m1sm/): one way in (Crateria's Map Station), Super Metroid's items on some spots
  const m1smWay = (st, m, L) => {
    const where = L ? L.where : 'snes', won = L && L.record ? L.record.won : {};
    const waiting = st.pending.m1 && st.pending.m1.length ? ' · ' + st.pending.m1.map(ZMGen.itemName).join(', ') + ' waiting for Samus' : '';
    const goal = { both: 'both Mother Brains', sm: 'Super Metroid’s Mother Brain', m1: 'Metroid’s Mother Brain' }[m.goal || 'both'];
    return '<span class="goal-r">Playing: ' + (where === 'snes' ? 'Super Metroid' : 'Metroid') + '</span>' +
      '<span class="goal-c">The way in: <b>' + ((m.portal && m.portal.name) || 'Crateria’s Map Station') + '</b> (' + ((m.portal && m.portal.how) || '') + '). Back to Crateria: ' + (m.exits === 'exits' ? 'one of Metroid’s elevator rooms.' : 'an elevator room, or ⇄ / P anywhere.') + waiting + '</span>' +
      '<span class="goal-c">Goal: ' + goal + ' · Super Metroid ' + (won.snes ? '✓' : '·') + ' · Metroid ' + (won.m1 ? '✓' : '·') + '</span>';
  };
  window.ZMWay = (st) => {
    const h = host(), A = h && h.QuadApp, m = A && A.meta || {}, L = h && h.QuadLink;
    if (m.generator === 'Z1Z3') return z1z3Way(st, m, L);
    if (m.generator === 'M1SM') return m1smWay(st, m, L);
    const where = L ? L.where : 'snes';
    const playing = where === 'snes' ? 'the SNES game (ALttP / Super Metroid)' : NAME[where];
    const waiting = (g) => st.pending[g] && st.pending[g].length ? ' · ' + st.pending[g].map(ZMGen.itemName).join(', ') + ' waiting for ' + (g === 'z1' ? 'Link' : 'Samus') : '';
    const portals = (m.portals || []).filter((p, i, a) => !p.group || a.findIndex((q) => q.group === p.group) === i).map((p) => '<b>' + (p.group || p.name) + '</b> → ' + NAME[p.to]).concat(m.smPortal ? ['<b>' + m.smPortal.name + '</b> → Super Metroid'] : []).join(' · ');
    const won = L && L.record ? L.record.won : {};
    const goal = { all: 'all four final bosses', snes: 'Ganon and Mother Brain (SNES)', nes: 'Zelda 1’s Ganon and Metroid’s Mother Brain' }[m.goal || 'all'];
    return '<span class="goal-r">Playing: ' + playing + '</span>' +
      '<span class="goal-c">Portals (Hyrule, ALttP): ' + (portals || '…') + '. ' + way(m.nes || {}) + waiting('z1') + waiting('m1') + '</span>' +
      '<span class="goal-c">Goal: ' + goal + ' · SNES ' + (won.snes ? '✓' : '·') + ' · Zelda 1 ' + (won.z1 ? '✓' : '·') + ' · Metroid ' + (won.m1 ? '✓' : '·') + '</span>';
  };

  ZMTracker.init($('tracker'));
  let sid = null;
  function session() {
    const h = host(), A = h && h.QuadApp; if (!A || !A.meta || A.id === sid) return;
    sid = A.id;
    const m = A.meta;
    if (m.generator === 'M1SM') { ZMTracker.setSession('m1sm-' + A.id, 'Seed ' + m.seed, { seed: m.seed, generator: 'M1SM (Metroid’s half)', spoiler: m.spoiler, items: (m.at || []).map((a) => (!a ? ['z1', 0x0F] : a.game === 'm1' ? ['m1', a.type] : ['sm', a.name])) }); return; }
    if (m.generator === 'Z1Z3') { ZMTracker.setSession('z1z3-' + A.id, 'Seed ' + m.seed, { seed: m.seed, generator: 'Z1Z3 (Zelda 1’s half)', spoiler: m.spoiler, items: (m.at || []).map((a) => (a.game === 'z1' ? ['z1', a.type] : ['snes', a.nice || a.name])) }); return; }
    ZMTracker.setSession('quad-' + A.id, 'Seed ' + m.seed, { seed: m.seed, generator: 'Rando Cross (the NES half)', spoiler: m.spoiler, items: m.at });
  }
  function fit() {
    if (view === 'map') { ZMTracker.setCompact(false); return; }
    ZMTracker.setCompact(innerWidth < 330 || innerHeight < 520);
  }
  session(); fit();
  // a re-draw when the game being played changes (the tracker redraws on its own reads only)
  let where = null;
  setInterval(() => {
    session();
    const h = host(), w = h && h.QuadLink ? h.QuadLink.where + (h.QuadLink.done ? '+' : '') : null;
    if (w !== where) { where = w; (window.ZMLinkFns || []).forEach((f) => { try { f(); } catch (e) {} }); }
  }, 1000);
  addEventListener('resize', () => { fit(); if (window.ZMMap) ZMMap.redraw(); });
  if (view === 'map') setTimeout(() => { if (window.ZMMap) ZMMap.redraw(); }, 300);
  // the colours: the quad page's switch
  addEventListener('storage', (e) => { if (e.key === 'rh-combo-theme' && window.RHComboTheme && e.newValue) RHComboTheme.set(e.newValue); });
})();
