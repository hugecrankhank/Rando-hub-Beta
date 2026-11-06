/*
 * z3pick.js — the Zelda tracker choice on the SMZ3 page, as the hub's Zelda 3
 * page has it: Mudora 2.0 (the default), Mudora, Hutch, or Rando Hub's own
 * SMZ3 tracker (both games, this page's js/tracker.js), or off.
 *
 * With a Zelda 3 tracker chosen, the column shows both games: the Zelda
 * tracker in z3host.html (it answers the tracker's reads from the Zelda half
 * of the combo, see there) and, under it, the Metroid part of Rando Hub's
 * tracker (Samus's items, the bosses, Zebes' map). For stream, four windows
 * (desktop): ⧉ Zelda items (Mudora's items and dungeons), ⧉ Zelda maps (both
 * worlds), ⧉ Metroid items, ⧉ Metroid map. On a phone the row of tabs picks
 * what shows: Mudora's items / Light World / Dark World / keys, or Samus.
 */
(function () {
  'use strict';
  var KEY = 'smz3r:z3tracker';
  var HOST = window.SMZ3_HOST || 'z3host.html';   // the four-game combo (../cross/) uses SMZ3's
  var OPTIONS = [['mudora2', 'Mudora 2.0 (Muffins logic)'], ['mudora', 'Mudora (Hutch logic)'], ['hutch', 'Hutch'], ['hub', 'Rando Hub (SMZ3, both games)'], ['off', 'Off (game full screen)']];
  var mode = 'mudora2';
  try { mode = localStorage.getItem(KEY) || 'mudora2'; } catch (e) {}
  if (!OPTIONS.some(function (o) { return o[0] === mode; })) mode = 'mudora2';
  var root, pick, frame, tabs, smPart, smMap, phoneTab = null, zWins = {};
  var frameOn = function () { return mode === 'mudora2' || mode === 'mudora' || mode === 'hutch'; };

  function css() {
    var s = document.createElement('style');
    s.textContent = '.t-pick{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin:0 0 4px;font-size:12px;color:var(--dim)}.t-pick select{background:var(--cell);color:var(--text);border:1px solid var(--cell-line);border-radius:4px;font:12px system-ui,sans-serif;padding:3px 4px;max-width:60%}' +
      '#z3-frame{display:none;border:2px solid var(--cell-line);border-radius:6px;background:#1b1b1b;width:100%;flex:1 1 0;min-height:0}.z3-tabs{display:none;gap:4px;margin:0 0 4px}.z3-tabs button{flex:1;background:none;border:1px solid var(--cell-line);border-radius:4px;color:var(--dim);font:400 12px/1 var(--px);padding:6px 2px;cursor:pointer}.z3-tabs button[aria-pressed="true"]{color:var(--gold);border-color:var(--gold)}' +
      '#sm-part{display:none;flex-direction:column;gap:6px}#sm-part .t-sec{margin:0}#g-smmap{display:flex;flex-direction:column;height:300px;min-height:0;border:2px solid var(--cell-line);border-radius:6px;overflow:hidden}' +
      'body.z3-frame #tracker{display:flex !important;flex-direction:column;grid-template-columns:none}body.z3-frame #tracker>*:not(.rh-pop-bar):not(.t-pick):not(#z3-frame):not(.z3-tabs):not(#sm-part):not(.rh-pop-ph){display:none !important}' +
      'body.z3-frame #z3-frame{display:block}body.z3-frame #sm-part{display:flex}body.z3-frame #tracker:not(.compact) #z3-frame{flex:0 0 auto;height:calc(100vh - 140px);min-height:520px}' +
      'body.z3-frame #tracker.compact .z3-tabs{display:flex}body.z3-frame #tracker.compact #z3-frame{flex:1 1 0}body.z3-frame #tracker.compact #sm-part{display:none;flex:1 1 0;min-height:0;overflow:auto}body.z3-frame #tracker.compact.ph-sm #sm-part,body.z3-frame #tracker.compact.ph-zebes #sm-part{display:flex}body.z3-frame #tracker.compact.ph-sm #z3-frame,body.z3-frame #tracker.compact.ph-zebes #z3-frame{display:none}' +
      'body.z3-frame #tracker.compact.ph-sm #g-smmap{display:none}body.z3-frame #tracker.compact.ph-zebes #sm-items{display:none}body.z3-frame #tracker.compact.ph-zebes #g-smmap{flex:1 1 0;height:auto}' +
      '.rh-pop-bar .z3-pop{display:none}body.z3-frame .rh-pop-bar .z3-pop,.rh-pop-bar .z3-pop[data-z=follow]{display:inline-block}body.z3-frame .rh-pop-bar [data-pop]{display:none}' +
      'body.z3-off main{grid-template-columns:minmax(0,1fr) !important}body.z3-off main>aside#tracker{display:none !important}body.z3-off.upright #game-wrap{flex:1 1 auto !important;height:auto !important}';
    document.head.appendChild(s);
  }
  function apply() {
    var on = frameOn();
    placeSections(on);
    document.body.classList.toggle('z3-frame', on);
    document.body.classList.toggle('z3-off', mode === 'off');
    var want = on ? HOST + '?t=' + mode : 'about:blank';
    if (frame.getAttribute('src') !== want) frame.src = want;
    pick.value = mode;
    if (on && !smMap && window.SMZ3Map && window.RHWorldMap) smMap = SMZ3Map.initSM(document.getElementById('g-smmap'));
    if (!on) ['side', 'maps'].forEach(function (k) { try { if (zWins[k]) zWins[k].close(); } catch (e) {} });   // (the follow window stays)
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    if (smMap) setTimeout(function () { SMZ3Map.redraw(); }, 50);
    var P = window.Snes9xPlayer; if (P && P.setTouchPlacement) P.setTouchPlacement(mode === 'off' ? 'outside' : 'overlay');
    popButtons();
  }
  function set(m) { mode = m; try { localStorage.setItem(KEY, m); } catch (e) {} apply(); }
  var lastGame = null, userTab = {};
  var gameOf = function (t) { return t === 'sm' || t === 'zebes' ? 'sm' : 'z3'; };
  function setPhone(t, auto) {
    phoneTab = t;
    if (!auto && t) userTab[gameOf(t)] = t;   // a tab picked by hand: that game's choice from now on
    tabs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'); });
    root.classList.toggle('ph-sm', t === 'sm'); root.classList.toggle('ph-zebes', t === 'zebes');
    try { frame.contentWindow.postMessage({ type: 'smz3-phone', tab: t === 'sm' || t === 'zebes' ? 'items' : t }, '*'); } catch (e) {}
    if (t === 'zebes') setTimeout(function () { if (window.SMZ3Map) SMZ3Map.redraw(); }, 50);
  }

  // ── the four windows ─────────────────────────────────────────────────────
  function popZelda(view) {   // Mudora / Hutch in a window of its own: its items and dungeons, or both maps
    var w = zWins[view];
    if (w && !w.closed) { w.focus(); return; }
    w = window.open(HOST + '?t=' + mode + '&phone=' + view, 'smz3-z3-' + view, 'popup=yes,resizable=yes,width=' + (view === 'maps' ? 1000 : 560) + ',height=' + (view === 'maps' ? 560 : 800));
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    zWins[view] = w;
  }
  function popFollow() {   // the stream's one map window (follow.html)
    var w = zWins.follow;
    if (w && !w.closed) { w.focus(); return; }
    w = window.open(HOST.replace(/z3host\.html$/, '') + 'follow.html', 'smz3-follow', 'popup=yes,resizable=yes,width=900,height=560');
    if (!w) { alert('The pop-out was blocked: allow pop-ups for this site.'); return; }
    zWins.follow = w;
  }
  function popButtons() {
    var bar = window.RHPopout && RHPopout.bar && RHPopout.bar(); if (!bar) return;
    if (!bar.querySelector('.z3-pop')) {
      var html = '<button type="button" class="z3-pop" data-z="side" title="The Zelda tracker’s items and dungeons in a window of their own (stream capture)">⧉ Zelda items</button>' +
        '<button type="button" class="z3-pop" data-z="maps" title="The Light and Dark World in a window of their own">⧉ Zelda maps</button>' +
        '<button type="button" class="z3-pop" data-z="smitems" title="Samus’s items and the Metroid bosses in a window of their own">⧉ Metroid items</button>' +
        '<button type="button" class="z3-pop" data-z="smmap" title="Zebes in a window of its own">⧉ Metroid map</button>' +
        '<button type="button" class="z3-pop" data-z="follow" title="One map window for the stream: it shows the map of the game being played and changes by itself at every warp">⧉ Map (follows)</button>';
      bar.insertAdjacentHTML('beforeend', html);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('.z3-pop'); if (!b) return;
        e.stopPropagation();
        var k = b.dataset.z;
        if (k === 'side' || k === 'maps') popZelda(k);
        else if (k === 'follow') popFollow();
        else if (k === 'smitems') RHPopout.pop('smitems', smPart.querySelector('#sm-items'), { title: 'Metroid items', label: 'Metroid tracker', width: 560, height: 520 });
        else if (k === 'smmap') RHPopout.pop('smmap', document.getElementById('g-smmap'), { title: 'Zebes', label: 'Zebes map', width: 760, height: 460, map: true });
      });
    }
    window.SMZ3Parts = [];   // the tracker looks in popped parts too
  }
  // keep the tracker's queries reaching the popped parts
  setInterval(function () {
    var it = smPart && smPart.querySelector('#sm-items');
    window.SMZ3Parts = it && root && !root.contains(it) ? [it] : [];
  }, 1000);
  // the Metroid sections: in the Metroid part with a Zelda 3 tracker, back in the Items tab with the hub's
  var homes = [];
  function placeSections(on) {
    var items = smPart.querySelector('#sm-items');
    if (on) {
      if (!homes.length) ['g-sm', 'g-smb'].forEach(function (id) { var el = document.getElementById(id), sec = el && el.closest('.t-sec'); if (sec) { homes.push({ sec: sec, parent: sec.parentNode, next: sec.nextSibling }); items.appendChild(sec); } });
    } else {
      homes.forEach(function (h) { h.parent.insertBefore(h.sec, h.next && h.next.parentNode === h.parent ? h.next : null); });
      homes = [];
    }
  }

  // The tracker follows the game being played: into Hyrule, the Zelda tracker (on a phone its Light or
  // Dark World map, or the tab last picked there); onto Zebes, Super Metroid's part (Zebes' map, or
  // Samus's items if that was picked). On a wide screen the column scrolls to that part.
  function follow() {
    if (!frameOn() || !root) return;
    var c = window.Snes9xPlayer && Snes9xPlayer.core, s = null, r = null;
    try { s = c && c.sram(); r = c && c.wram(); } catch (e) {}
    if (!s || s.length <= 0x33FE) return;
    var g = s[0x33FE] === 0 ? 'z3' : s[0x33FE] === 0xFF ? 'sm' : null;
    if (!g || g === lastGame) return;
    lastGame = g;
    if (root.classList.contains('compact')) {
      var t = userTab[g] || (g === 'sm' ? 'zebes' : r && r[0xF3CA] & 0x40 ? 'dw' : 'lw');
      setPhone(t, true);
    } else {
      var el = g === 'sm' ? smPart : frame;
      try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      if (g === 'sm' && window.SMZ3Map) setTimeout(function () { SMZ3Map.redraw(); }, 300);
    }
  }
  function init() {
    root = document.getElementById('tracker'); if (!root) return;
    css();
    pick = document.createElement('select'); pick.id = 'z3-tracker'; pick.title = 'Which tracker shows the Zelda side';
    OPTIONS.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; pick.appendChild(op); });
    pick.addEventListener('change', function () { set(pick.value); });
    var row = document.createElement('div'); row.className = 't-pick'; row.appendChild(document.createTextNode('Tracker')); row.appendChild(pick);
    tabs = document.createElement('div'); tabs.className = 'z3-tabs';
    tabs.innerHTML = '<button type="button" data-t="items">Items</button><button type="button" data-t="lw">Light</button><button type="button" data-t="dw">Dark</button><button type="button" data-t="keys">Keys</button><button type="button" data-t="sm">Samus</button><button type="button" data-t="zebes">Zebes</button>';
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setPhone(b.dataset.t); });
    setInterval(follow, 500);
    frame = document.createElement('iframe'); frame.id = 'z3-frame'; frame.title = 'Zelda tracker';
    frame.addEventListener('load', function () { if (root.classList.contains('compact')) setTimeout(function () { setPhone(phoneTab || 'items', true); }, 800); });
    // the Metroid part: Samus's items and the bosses (the tracker's own sections, moved), and Zebes
    smPart = document.createElement('div'); smPart.id = 'sm-part';
    var items = document.createElement('div'); items.id = 'sm-items';
    var mapHost = document.createElement('div'); mapHost.id = 'g-smmap';
    smPart.appendChild(items); smPart.appendChild(mapHost);
    root.insertBefore(row, root.firstChild); root.insertBefore(tabs, row.nextSibling); root.insertBefore(frame, tabs.nextSibling); root.insertBefore(smPart, frame.nextSibling);
    new MutationObserver(function () {
      if (root.classList.contains('compact') && document.body.classList.contains('z3-frame') && !phoneTab) { lastGame = null; setPhone('items', true); }
      if (!root.classList.contains('compact') && phoneTab) setPhone(null);
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
    apply();
    setTimeout(popButtons, 300); setTimeout(popButtons, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('pagehide', function () { Object.keys(zWins).forEach(function (k) { try { zWins[k].close(); } catch (e) {} }); });
  window.SMZ3Z3Pick = { mode: function () { return mode; }, set: set, options: OPTIONS };
})();
