/*
 * ☠️ in the header: Link dies on the spot, for a room a randomizer bug has
 * locked him in (Hank, Oct 2026). It does exactly what the game does when
 * the last heart goes (Z_01.asm @HandleDied): no hearts left, Link's state
 * cleared and facing down, game mode $11. The game then plays its own death
 * and shows Continue / Save / Retry, so the death counts as any other.
 *
 * While the game is paused (Start: the item screen) the same button is 💾
 * Save & quit: the original's secret, Up + A on controller 2, which brings up
 * Continue / Save / Retry without dying.
 *
 * ☠️P2 next to it does it in one tap, item screen open or not (Hank, Oct 2026).
 * Both put the game straight where Up + A on controller 2 would (quitNow).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MENU = 0xE1;   // MenuState: the item screen (Start) is open or opening
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
  // Save & quit: what the game itself does on Up + A on controller 2 with the item
  // screen open (Z_05.asm UpdateMenuActive): end the mode, close the item screen,
  // game mode 8 (Continue / Save / Retry), music off. Done straight in memory: holding
  // the buttons for the game worked on a computer but not on Hank's iPhone, and the
  // game's own code takes it from there either way (it redraws the whole screen).
  function quitNow() {
    var r = ram();
    // out in the world or a dungeon (5), an underground passage (9) or a cave (B: the
    // wooden sword cave too, HydeOut). Not mid screen-change, stairs or a menu.
    if (!canDie(r) || [0x05, 0x09, 0x0B].indexOf(r[MODE]) < 0) { alert('Save & quit works while Link is in the world, a dungeon or a cave (not mid screen-change or on the stairs).'); return false; }
    r[UPDATING] = 0; r[SUBMODE] = 0;     // EndGameMode
    r[MENU] = 0;                          // the item screen
    r[0x619] = 0;                         // SongEnvelopeSelector
    r[0x604] = 0x80; r[0x603] = 0x80;     // SilenceSound: Tune0Request, EffectRequest
    r[MODE] = 0x08;
    return true;
  }
  function saveQuit() { quitNow(); }
  function p2Quit() { quitNow(); }
  function click() { if (paused(ram())) saveQuit(); else die(); }
  var btn = null, btn2 = null, mode = '';
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
    btn2 = document.createElement('button');
    btn2.type = 'button'; btn2.id = 'z1-p2'; btn2.className = 'btn';
    btn2.innerHTML = '☠️<small style="font-size:11px;margin-left:2px">P2</small>';
    btn2.title = 'Save & quit in one tap (the original\u2019s Up + A on controller 2): Continue / Save / Retry, no death. In the world, dungeons and caves.';
    btn2.setAttribute('aria-label', 'Save and quit (controller 2)');
    btn2.style.cssText = 'font-size: 18px; padding-left: 7px; padding-right: 7px; white-space: nowrap;';
    btn2.hidden = true;
    btn2.addEventListener('click', p2Quit);
    header.insertBefore(btn2, btn.nextSibling);
    var st = document.createElement('style');
    st.textContent = '@media (max-width: 440px) { #z1-die, #z1-p2 { font-size: 15px !important; padding-left: 5px !important; padding-right: 5px !important; } }';
    document.head.appendChild(st);
  }
  setInterval(function () {
    if (!btn) build();
    if (btn) { var r = ram(), on = canDie(r); if (btn.hidden === on) btn.hidden = !on; if (on) look(paused(r) ? 'save' : 'die'); if (btn2 && btn2.hidden === on) btn2.hidden = !on; }
  }, 500);
  window.Z1Die = { die: die, saveQuit: saveQuit, p2Quit: p2Quit, can: function () { return canDie(ram()); }, paused: function () { return paused(ram()); } };
})();
