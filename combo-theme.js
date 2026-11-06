/*
 * combo-theme.js — the Zelda / Metroid colour switch on the combo pages (SMZ3,
 * Zelda 1 + Metroid): the menus, header, buttons and tracker take Hyrule's
 * greens and gold or Zebes' navy and Samus's orange. One choice for both pages
 * (localStorage 'rh-combo-theme'), Metroid by default.
 *
 * The colours are a <style> rewritten in place (not an attribute on <html>),
 * so a popped-out tracker window, which copies the page's styles, gets them
 * too. The switch sits in the tracker column's top row: beside SMZ3's Tracker
 * menu, or a row of its own.
 *
 *   <script src="../combo-theme.js"></script>   after the page's own scripts
 */
(function () {
  'use strict';
  var KEY = 'rh-combo-theme';
  var THEMES = {
    metroid: {
      label: 'Metroid', icon: '◉',
      vars: '--bg:#0a0d1c;--win:#1a2242;--win2:#111834;--line:#e8752a;--text:#eef2fa;--dim:#9aa6c6;--gold:#ffb22e;--cell:#141b38;--cell-line:#2a3868;',
      head: ['#1d2a58', '#0a1028'], primary: ['#c85a14', '#e06a20', '#ffd05a'], have: '#2a3a70', meta: '#0a0d1c',
    },
    zelda: {
      label: 'Zelda', icon: '▲',
      vars: '--bg:#0b130c;--win:#1b3020;--win2:#122016;--line:#48b048;--text:#f6f2e2;--dim:#b0b89a;--gold:#f4cc3c;--cell:#152618;--cell-line:#2c4a30;',
      head: ['#1e3a22', '#0c1a0e'], primary: ['#2e7d32', '#3a9a3e', '#f4cc3c'], have: '#2a4a2e', meta: '#0b130c',
    },
  };
  var theme = 'metroid';
  try { theme = localStorage.getItem(KEY) || 'metroid'; } catch (e) {}
  if (!THEMES[theme]) theme = 'metroid';

  var st = document.createElement('style'); st.id = 'combo-theme-css';
  function css(t) {
    var T = THEMES[t];
    return ':root{' + T.vars + '}' +
      'header{background:linear-gradient(' + T.head[0] + ',' + T.head[1] + ') !important}' +
      '.btn.primary{background:' + T.primary[0] + ' !important;border-color:' + T.primary[2] + ' !important}.btn.primary:hover{background:' + T.primary[1] + ' !important}' +
      '.cell.have{background:' + T.have + ' !important}' +
      '.combo-theme{display:inline-flex;flex:none;border:1px solid var(--cell-line);border-radius:4px;overflow:hidden;margin-right:auto}' +
      '.t-pick select{flex:0 1 auto;min-width:0;max-width:none !important}' +   // (SMZ3's Tracker menu gives way, the switch keeps its words)
      '.combo-theme button{background:none;border:0;color:var(--dim);font:400 12px/1 var(--px);padding:5px 8px;cursor:pointer;white-space:nowrap}' +
      '.combo-theme button[aria-pressed="true"]{background:var(--win);color:var(--gold)}' +
      '.combo-theme-row{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-size:12px;color:var(--dim)}';
  }
  function apply() {
    st.textContent = css(theme);
    if (!st.parentNode) document.head.appendChild(st);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = THEMES[theme].meta;
    document.querySelectorAll('.combo-theme button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.theme === theme ? 'true' : 'false'); });
    try { window.dispatchEvent(new CustomEvent('combotheme', { detail: theme })); } catch (e) {}
  }
  function set(t) { if (!THEMES[t]) return; theme = t; try { localStorage.setItem(KEY, t); } catch (e) {} apply(); }
  apply();

  function control() {
    var box = document.createElement('div'); box.className = 'combo-theme'; box.title = 'Menu colours';
    Object.keys(THEMES).reverse().forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.theme = k;
      b.textContent = THEMES[k].icon + ' ' + THEMES[k].label;
      b.setAttribute('aria-pressed', k === theme ? 'true' : 'false');
      b.addEventListener('click', function () { set(k); });
      box.appendChild(b);
    });
    return box;
  }
  // the switch: beside SMZ3's Tracker menu (z3pick.js builds that row), or a row of its own at the top of the tracker
  var tries = 0;
  (function place() {
    if (document.querySelector('.combo-theme')) return;
    var row = document.querySelector('#tracker .t-pick'), tracker = document.getElementById('tracker');
    if (row) { row.insertBefore(control(), row.firstChild); return; }
    if (!tracker || tries++ < 8) { setTimeout(place, 250); return; }
    var own = document.createElement('div'); own.className = 'combo-theme-row'; own.appendChild(control());
    var bar = tracker.querySelector('.rh-pop-bar');
    tracker.insertBefore(own, bar ? bar.nextSibling : tracker.firstChild);
  })();
  window.RHComboTheme = { get: function () { return theme; }, set: set };
})();
