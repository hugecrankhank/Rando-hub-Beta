/*
 * z3pick.js — the Zelda tracker choice on the SMZ3 page, as the hub's Zelda 3
 * page has it: Mudora 2.0 (the default), Mudora, Hutch, or Rando Hub's own
 * SMZ3 tracker (both games, this page's js/tracker.js), or off.
 *
 * The Zelda 3 trackers run in z3host.html, inside the tracker column: it
 * answers their reads from the Zelda half of the combo (see there), so they
 * follow the Zelda side as they would a plain Zelda 3; the Metroid side is
 * Rando Hub's tracker's (pick it from the same menu). On a phone the row of
 * tabs above the frame picks Mudora's view (items, Light World, Dark World,
 * keys).
 */
(function () {
  'use strict';
  var KEY = 'smz3r:z3tracker';
  var OPTIONS = [['mudora2', 'Mudora 2.0 (Muffins logic)'], ['mudora', 'Mudora (Hutch logic)'], ['hutch', 'Hutch'], ['hub', 'Rando Hub (SMZ3, both games)'], ['off', 'Off (game full screen)']];
  var mode = 'mudora2';
  try { mode = localStorage.getItem(KEY) || 'mudora2'; } catch (e) {}
  if (!OPTIONS.some(function (o) { return o[0] === mode; })) mode = 'mudora2';
  var root, pick, frame, tabs, phoneTab = null;

  function css() {
    var s = document.createElement('style');
    s.textContent = '.t-pick{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin:0 0 4px;font-size:12px;color:var(--dim)}.t-pick select{background:var(--cell);color:var(--text);border:1px solid var(--cell-line);border-radius:4px;font:12px system-ui,sans-serif;padding:3px 4px;max-width:60%}' +
      '#z3-frame{display:none;border:2px solid var(--cell-line);border-radius:6px;background:#1b1b1b;width:100%;flex:1 1 0;min-height:0}.z3-tabs{display:none;gap:4px;margin:0 0 4px}.z3-tabs button{flex:1;background:none;border:1px solid var(--cell-line);border-radius:4px;color:var(--dim);font:400 12px/1 var(--px);padding:6px 2px;cursor:pointer}.z3-tabs button[aria-pressed="true"]{color:var(--gold);border-color:var(--gold)}' +
      'body.z3-frame #tracker{display:flex !important;flex-direction:column;grid-template-columns:none}body.z3-frame #tracker>*:not(.rh-pop-bar):not(.t-pick):not(#z3-frame):not(.z3-tabs){display:none !important}body.z3-frame #z3-frame{display:block}body.z3-frame #tracker:not(.compact) #z3-frame{min-height:calc(100vh - 120px)}body.z3-frame #tracker.compact .z3-tabs{display:flex}' +
      'body.z3-off main{grid-template-columns:minmax(0,1fr) !important}body.z3-off main>aside#tracker{display:none !important}body.z3-off.upright #game-wrap{flex:1 1 auto !important;height:auto !important}';
    document.head.appendChild(s);
  }
  function apply() {
    document.body.classList.toggle('z3-frame', mode === 'mudora2' || mode === 'mudora' || mode === 'hutch');
    document.body.classList.toggle('z3-off', mode === 'off');
    var want = mode === 'hub' || mode === 'off' ? 'about:blank' : 'z3host.html?t=' + mode;
    if (frame.getAttribute('src') !== want) frame.src = want;
    pick.value = mode;
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    var P = window.Snes9xPlayer; if (P && P.setTouchPlacement) P.setTouchPlacement(mode === 'off' ? 'outside' : 'overlay');
  }
  function set(m) { mode = m; try { localStorage.setItem(KEY, m); } catch (e) {} apply(); }
  function setPhone(t) {
    phoneTab = t;
    tabs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'); });
    try { frame.contentWindow.postMessage({ type: 'smz3-phone', tab: t }, '*'); } catch (e) {}
  }
  function init() {
    root = document.getElementById('tracker'); if (!root) return;
    css();
    pick = document.createElement('select'); pick.id = 'z3-tracker'; pick.title = 'Which tracker shows the Zelda side';
    OPTIONS.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; pick.appendChild(op); });
    pick.addEventListener('change', function () { set(pick.value); });
    var row = document.createElement('div'); row.className = 't-pick'; row.appendChild(document.createTextNode('Tracker')); row.appendChild(pick);
    tabs = document.createElement('div'); tabs.className = 'z3-tabs';
    tabs.innerHTML = '<button type="button" data-t="items">Items</button><button type="button" data-t="lw">Light</button><button type="button" data-t="dw">Dark</button><button type="button" data-t="keys">Keys</button>';
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setPhone(b.dataset.t); });
    frame = document.createElement('iframe'); frame.id = 'z3-frame'; frame.title = 'Zelda tracker';
    frame.addEventListener('load', function () { if (root.classList.contains('compact')) setTimeout(function () { setPhone(phoneTab || 'items'); }, 800); });
    root.insertBefore(row, root.firstChild); root.insertBefore(tabs, row.nextSibling); root.insertBefore(frame, tabs.nextSibling);
    // a pop-out moves the tracker to another document: the frame reloads there, fine
    new MutationObserver(function () { if (root.classList.contains('compact') && document.body.classList.contains('z3-frame') && !phoneTab) setPhone('items'); if (!root.classList.contains('compact') && phoneTab) setPhone(null); }).observe(root, { attributes: true, attributeFilter: ['class'] });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SMZ3Z3Pick = { mode: function () { return mode; }, set: set, options: OPTIONS };
})();
