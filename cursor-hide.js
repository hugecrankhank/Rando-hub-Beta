/*
 * The mouse pointer hides itself after two seconds without moving while it's
 * over the game, so it doesn't sit on the stream (Hank, Oct 2026). Moving
 * the mouse brings it straight back. Not while the emulator's menu is open, or
 * over its buttons. Hub and every game page (any player's .s9x box).
 */
(function () {
  'use strict';
  var IDLE_MS = 2000, t = null, hidden = null;
  var st = document.createElement('style');
  st.textContent = '.s9x.cursor-idle, .s9x.cursor-idle * { cursor: none !important; }';
  (document.head || document.documentElement).appendChild(st);
  function show() { if (hidden) { hidden.classList.remove('cursor-idle'); hidden = null; } }
  function over(target) {
    var box = target && target.closest && target.closest('.s9x');
    if (!box) return null;
    if (target.closest('.s9x-menu, .s9x-pill, button, select, input, a')) return null;   // its menu and buttons keep the pointer
    if (box.querySelector('.s9x-menu:not([hidden])') && getComputedStyle(box.querySelector('.s9x-menu')).display !== 'none') return null;
    return box;
  }
  document.addEventListener('mousemove', function (e) {
    show();
    clearTimeout(t);
    var box = over(e.target);
    if (box) t = setTimeout(function () { box.classList.add('cursor-idle'); hidden = box; }, IDLE_MS);
  }, { passive: true });
  document.addEventListener('mousedown', show, true);
  document.addEventListener('mouseleave', function () { clearTimeout(t); show(); });
})();
