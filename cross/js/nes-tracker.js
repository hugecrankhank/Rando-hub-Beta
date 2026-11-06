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
  const host = () => { try { if (parent !== window && parent.QuadApp) return parent; } catch (e) {} try { return opener && opener.QuadApp ? opener : null; } catch (e) { return null; } };
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'map' || view === 'items') document.body.classList.add('pop-' + view);

  // an SNES item on a NES spot: its SMZ3 name
  const zmName = ZMGen.itemName;
  ZMGen.itemName = (it) => {
    if (it && it.game === 'snes') { const h = host(), G = h && h.SMZ3Gen; return G ? (G.IT_DESC[G.IT_NAME[it.type]] || 'SNES item') + ' (SNES)' : 'SNES item'; }
    return zmName(it);
  };
  const NAME = { z1: 'Zelda 1', m1: 'Metroid' };
  const way = (n) => (n.link === 'linked' ? 'Zelda 1 ⇄ Zebes: a “take any road” cave ⇄ an elevator room. ' : '') +
    'Back to Hyrule (ALttP): ' + (n.exits === 'exits' ? 'at a “take any road” cave or an elevator room.' : (n.link === 'linked' ? '⇄ / P anywhere.' : 'a “take any road” cave in Zelda 1, or ⇄ / P anywhere.')) +
    (n.items === 'apart' ? ' NES items stay on the NES.' : '');
  window.ZMWay = (st) => {
    const h = host(), A = h && h.QuadApp, m = A && A.meta || {}, L = h && h.QuadLink;
    const where = L ? L.where : 'snes';
    const playing = where === 'snes' ? 'the SNES game (ALttP / Super Metroid)' : NAME[where];
    const waiting = (g) => st.pending[g] && st.pending[g].length ? ' · ' + st.pending[g].map(ZMGen.itemName).join(', ') + ' waiting for ' + (g === 'z1' ? 'Link' : 'Samus') : '';
    const portals = (m.portals || []).map((p) => '<b>' + p.name + '</b> → ' + NAME[p.to]).join(' · ');
    const won = L && L.record ? L.record.won : {};
    const goal = { all: 'all four final bosses', snes: 'Ganon and Mother Brain (SNES)', nes: 'Zelda 1’s Ganon and Metroid’s Mother Brain' }[m.goal || 'all'];
    return '<span class="goal-r">Playing: ' + playing + '</span>' +
      '<span class="goal-c">Portals (ALttP caves): ' + (portals || '…') + '. ' + way(m.nes || {}) + waiting('z1') + waiting('m1') + '</span>' +
      '<span class="goal-c">Goal: ' + goal + ' · SNES ' + (won.snes ? '✓' : '·') + ' · Zelda 1 ' + (won.z1 ? '✓' : '·') + ' · Metroid ' + (won.m1 ? '✓' : '·') + '</span>';
  };

  ZMTracker.init($('tracker'));
  let sid = null;
  function session() {
    const h = host(), A = h && h.QuadApp; if (!A || !A.meta || A.id === sid) return;
    sid = A.id;
    const m = A.meta;
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
