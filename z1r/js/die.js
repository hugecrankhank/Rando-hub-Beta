/*
 * ☠️ in the header: Link dies on the spot, for a room a randomizer bug has
 * locked him in (Hank, Oct 2026). It does exactly what the game does when
 * the last heart goes (Z_01.asm @HandleDied): no hearts left, Link's state
 * cleared and facing down, game mode $11. The game then plays its own death
 * and shows Continue / Save / Retry, so the death counts as any other.
 *
 * While the game is paused (Start: the item screen) the same button is 💾
 * Save & quit: the original's secret, Up + A on controller 2, which brings up
 * Continue / Save / Retry without dying. The page holds those two buttons on
 * controller 2 for half a second (EmuPlayer.pad2).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MENU = 0xE1, UP = 1 << 4, A = 1 << 8;   // MenuState: the item screen (Start) is open or opening
  var MODE = 0x12, SUBMODE = 0x13, UPDATING = 0x11, HEARTS = 0x66F, PARTIAL = 0x670, STATE = 0xAC, DIR = 0x98;
  function ram() { var p = window.EmuPlayer, c = p && p.core; return c && c.wram ? c.wram() : null; }
  // a file is being played (Zelda 1's "save slot in use" marks), out in the world, a dungeon or a cave
  function canDie(r) {
    if (!r || r.length < 0x800 || r[0xF5] !== 0x5A || r[0x528] !== 0x5A || r[0x16] > 2) return false;
    var m = r[MODE];
    return (m >= 0x04 && m <= 0x0C) || m === 0x10;
  }
  function die() {
    var r = ram();
    if (!canDie(r)) { alert('Link can only be knocked out while you’re playing (not on the title, file select, a menu or the death screen).'); return; }
    if (!confirm('Knock Link out now?\n\nFor a room you’re stuck in. He dies as if he’d lost his last heart: the death counts, and Continue takes you back to the start of the level or the overworld.')) return;
    r = ram(); if (!canDie(r)) return;
    r[HEARTS] &= 0xF0; r[PARTIAL] = 0;
    r[UPDATING] = 0; r[SUBMODE] = 0;
    r[STATE] = 0; r[DIR] = 0x04;
    r[MODE] = 0x11;
  }
  function paused(r) { return canDie(r) && r[MODE] === 0x05 && r[MENU] !== 0; }
  function saveQuit() {
    var p = window.EmuPlayer, r = ram();
    if (!p || !p.pad2) return;
    if (!paused(r)) { alert('Open the item screen first (Start), then Save & quit.'); return; }
    // Up + A on controller 2, held until the game takes it (it checks once the item
    // screen has finished sliding down: Z_05.asm UpdateMenuActive), at most 3 s
    p.pad2(UP | A, 180);
    var t0 = Date.now(), t = setInterval(function () { var w = ram(); if (!w || w[MODE] !== 0x05 || Date.now() - t0 > 3200) { clearInterval(t); p.pad2(0, 0); } }, 50);
  }
  function click() { if (paused(ram())) saveQuit(); else die(); }
  var btn = null, mode = '';
  function look(m) {
    if (!btn || mode === m) return;
    mode = m;
    if (m === 'save') { btn.textContent = '💾'; btn.title = 'Save & quit (the original\u2019s Up + A on controller 2): Continue / Save / Retry'; btn.setAttribute('aria-label', 'Save and quit'); }
    else { btn.textContent = '☠️'; btn.title = 'Stuck? Knock Link out (he dies as if he\u2019d lost his last heart)'; btn.setAttribute('aria-label', 'Knock Link out'); }
  }
  function build() {
    var header = document.querySelector('header'); if (!header || $('z1-die')) return;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'z1-die'; btn.className = 'btn';
    btn.textContent = '☠️';
    btn.title = 'Stuck? Knock Link out (he dies as if he’d lost his last heart)';
    btn.setAttribute('aria-label', 'Knock Link out');
    btn.style.cssText = 'font-size: 18px; padding-left: 8px; padding-right: 8px;';
    btn.hidden = true;
    btn.addEventListener('click', click);
    var anchor = $('game-settings') || $('pad-status') || $('link-status');
    if (anchor && anchor.parentNode === header) header.insertBefore(btn, anchor); else header.appendChild(btn);
  }
  setInterval(function () {
    if (!btn) build();
    if (btn) { var r = ram(), on = canDie(r); if (btn.hidden === on) btn.hidden = !on; if (on) look(paused(r) ? 'save' : 'die'); }
  }, 500);
  window.Z1Die = { die: die, saveQuit: saveQuit, can: function () { return canDie(ram()); }, paused: function () { return paused(ram()); } };
})();
