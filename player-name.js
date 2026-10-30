/*
 * ⚙ Settings → "Player name": what the alerts call the player instead of
 * "Link" (boss detours over the game, Crowd Control+'s stream alerts). Blank:
 * the sprite picked in the Randomizer bar, else Link (crowd/effects.js hero).
 */
(function () {
  'use strict';
  var KEY = 'rhb-player-name';
  function build() {
    var panel = document.getElementById('trk-settings'); if (!panel || document.getElementById('player-name')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'The name alerts use instead of Link (boss detours, death tax, boss beaten…). Leave it blank to use the sprite’s name, or Link.';
    lab.innerHTML = 'Player name in alerts <span><input type="text" id="player-name" maxlength="20" placeholder="sprite name or Link" style="width:150px"></span>';
    panel.appendChild(lab);
    var inp = lab.querySelector('input');
    try { inp.value = localStorage.getItem(KEY) || ''; } catch (e) {}
    inp.addEventListener('input', function () { try { localStorage.setItem(KEY, inp.value.trim().slice(0, 20)); } catch (e) {} });
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { inp.addEventListener(t, function (e) { e.stopPropagation(); }); });   // typing isn't game input
  }
  function init() { build(); var n = 0, t = setInterval(function () { build(); if (document.getElementById('player-name') || ++n > 50) clearInterval(t); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
