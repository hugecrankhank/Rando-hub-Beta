/*
 * ⚙ Settings in the header of the game pages (Zelda 1, GLR, the FF games,
 * FF6, Patched): opens the emulator's own menu (volume, filter, colours,
 * performance, controller, keys), which otherwise is only the ⋯ button on
 * the game. Shown while a game is running.
 *
 * Loaded with data-hub="../" (or "../../"); the page's other header buttons
 * stay where they are, this goes just before the status pills.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function player() {
    var p = window.EmuPlayer && window.EmuPlayer.openMenu ? window.EmuPlayer : null;
    if (!p && window.Snes9xPlayer && window.Snes9xPlayer.openMenu) p = window.Snes9xPlayer;
    return p;
  }
  var btn = null;
  function build() {
    var header = document.querySelector('header'); if (!header || $('game-settings')) return;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'game-settings'; btn.className = 'btn';
    btn.innerHTML = '<span aria-hidden="true">⚙</span><span class="gs-text"> Settings</span>';
    btn.title = 'Emulator settings: sound, picture, performance, on-screen controller, keys and buttons';
    btn.hidden = true;
    btn.addEventListener('click', function () { var p = player(); if (p) p.openMenu(); });
    var st = document.createElement('style');
    st.textContent = '#game-settings { white-space: nowrap; }' +
      '@media (max-width: 900px) and (orientation: portrait), (orientation: landscape) and (max-height: 560px) { #game-settings .gs-text { display: none; } }' +
      // narrow phones upright: tighter buttons so the whole row fits (Hank's iPhone, Oct 2026)
      '@media (max-width: 440px) { header { gap: 5px !important; padding-left: max(6px, env(safe-area-inset-left)) !important; padding-right: max(6px, env(safe-area-inset-right)) !important; }' +
      ' header .btn { padding-left: 7px !important; padding-right: 7px !important; } #hub-games { max-width: 75px !important; padding-left: 5px !important; padding-right: 5px !important; text-overflow: clip !important; } header .pill { min-width: 16px !important; padding-left: 0 !important; padding-right: 0 !important; } }';
    document.head.appendChild(st);
    var anchor = $('pad-status') || $('link-status');
    if (anchor && anchor.parentNode === header) header.insertBefore(btn, anchor); else header.appendChild(btn);
  }
  function tick() {
    if (!btn) build();
    if (!btn) return;
    var p = player(), on = !!(p && p.ready);
    if (btn.hidden === on) btn.hidden = !on;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1000);
})();
