/*
 * Rando Hub's games: A Link to the Past (this page), Zelda 1 (z1r/, the
 * Z1R app, which lives in this repository now).
 *
 *  - A "Game" row at the top of the Randomizer bar switches between them,
 *    and to The Guardian Legend (glr/), which is only
 *    ever picked by hand: rerolls and Crowd Control never go there.
 *  - "Rerolls can land on either game": the 🎲 Reroll button and Crowd
 *    Control's "Random preset seed" and "CHAOS seed" pick a game at random;
 *    Zelda 1 opens z1r/ and rolls a seed there (the button: the flags last
 *    used in its New seed dialog; a random preset or CHAOS seed: a random
 *    Zelda 1 preset). Crowd Control's "New seed (same settings)" never
 *    switches games. Zelda 1 does the same in the other direction.
 *  - Arriving with ?roll=1 (from Zelda 1) rolls a new ALTTP seed with the
 *    Randomizer bar's current settings, without asking (&mode=preset or
 *    &mode=chaos: a random preset or a CHAOS seed instead).
 *
 * The setting is shared with z1r/ through localStorage (same site).
 */
(function () {
  'use strict';
  var EITHER_KEY = 'rando-hub-either-game';
  var Z1_URL = 'z1r/';
  var GLR_URL = 'glr/';   // The Guardian Legend: picked by hand only, never by a reroll or Crowd Control

  function either() { try { return localStorage.getItem(EITHER_KEY) === '1'; } catch (e) { return false; } }
  function setEither(on) { try { localStorage.setItem(EITHER_KEY, on ? '1' : '0'); } catch (e) {} }
  // For a reroll: true = this one goes to Zelda 1.
  function pickZ1() { return either() && Math.random() < 0.5; }
  // mode: 'preset' or 'chaos' from Crowd Control (Zelda 1 then rolls a random preset)
  function goZ1(by, mode) {
    location.href = Z1_URL + '?roll=1' + (mode && mode !== 'same' ? '&mode=' + mode : '') + (by ? '&by=' + encodeURIComponent(by) : '');
  }

  window.RandoGames = { either: either, setEither: setEither, pickZ1: pickZ1, goZ1: goZ1, Z1_URL: Z1_URL, GLR_URL: GLR_URL };

  // ── the 🎲 Reroll button: maybe Zelda 1 instead ───────────────────────────
  // Runs before reroll.js's own click handler (capture phase on the document).
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#reroll-btn') : null;
    if (!b || !either()) return;
    if (!pickZ1()) return;                 // ALTTP this time: reroll.js carries on
    e.stopPropagation(); e.preventDefault();
    if (window.EJS_emulator && !confirm('Reroll landed on Zelda 1!\n\nThe current game will be closed.')) return;
    goZ1();
  }, true);

  // ── the Game row ──────────────────────────────────────────────────────────
  function addRow() {
    var bar = document.getElementById('rando-bar');
    if (!bar || document.getElementById('game-row')) return;
    var css = document.createElement('style');
    css.textContent =
      '#game-row { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12px; color: var(--dim, #8b95a3); }' +
      '#game-row .gm { display: inline-flex; border: 1px solid var(--line, #30363d); border-radius: 8px; overflow: hidden; }' +
      '#game-row .gm a, #game-row .gm span { padding: 4px 10px; color: var(--text, #e6edf3); text-decoration: none; font-weight: 600; }' +
      '#game-row .gm span { background: #1f6feb; color: #fff; }' +
      '#game-row .gm a:hover { background: rgba(255,255,255,.06); }' +
      '#game-row label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }';
    document.head.appendChild(css);
    var row = document.createElement('div');
    row.id = 'game-row';
    row.innerHTML = '<span>Game</span><span class="gm"><span aria-current="page">Zelda 3 · ALTTP</span>' +
      '<a href="' + Z1_URL + '" title="Zelda 1 randomizer (Z1R): roll, play and track Zelda 1 seeds">Zelda 1 ▸</a>' +
      '<a href="' + GLR_URL + '" title="The Guardian Legend randomizer (GLR): roll, play and track its seeds. Rerolls and Crowd Control never pick it.">Guardian Legend ▸</a>' +
      '<a href="https://web.zquestclassic.com/play/" id="zc-row" target="_blank" rel="noopener">Zelda Classic ↗</a></span>' +
      '<label title="The 🎲 Reroll button and Crowd Control’s Random preset and CHAOS seeds pick Zelda 3 or Zelda 1 at random. Crowd Control’s New seed (same settings) stays in the game you’re playing.">' +
      '<input type="checkbox" id="either-game"> Rerolls can land on either game</label>';
    var after = document.getElementById('r-shared');
    bar.insertBefore(row, after ? after.nextSibling : bar.firstChild);
    var zc = row.querySelector('#zc-row');
    if (window.RandoZC) zc.title = window.RandoZC.TITLE;
    zc.addEventListener('click', function (e) { if (window.RandoZC) { e.preventDefault(); window.RandoZC.open(); } });
    var cb = row.querySelector('#either-game');
    cb.checked = either();
    cb.addEventListener('change', function () { setEither(cb.checked); });
    window.addEventListener('storage', function (e) { if (e.key === EITHER_KEY) cb.checked = either(); });
  }

  // ── ?roll=1: arrived from Zelda 1's reroll ────────────────────────────────
  function autoRoll() {
    var q = new URLSearchParams(location.search);
    if (q.get('roll') !== '1') return;
    var mode = q.get('mode'), by = q.get('by') || '';
    q.delete('roll'); q.delete('by'); q.delete('mode');
    try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
    var tries = 0;
    var t = setInterval(function () {
      var gen = document.getElementById('r-generate'), seed = document.getElementById('r-seed');
      if (++tries > 120) { clearInterval(t); return; }          // ~60 s: give up quietly
      if (!gen || !seed || gen.disabled) return;
      // a random preset or CHAOS seed from Zelda 1's Crowd Control stays that kind here
      var api = window.UnifiedRando && window.UnifiedRando.crowd;
      if ((mode === 'preset' || mode === 'chaos') && !api) return;   // wait for the randomizer
      clearInterval(t);
      var setup = Promise.resolve();
      try {
        if (mode === 'preset') {
          var list = api.pool ? api.pool() : api.presets();
          if (list.length) setup = api.usePreset(list[Math.floor(Math.random() * list.length)].value);
        } else if (mode === 'chaos') setup = api.chaos();
      } catch (e) {}
      setup.catch(function (e) { return ''; }).then(function (pick) {
        if (gen.disabled) return;
        if (window.RandoSeedLog) window.RandoSeedLog.next({ kind: mode === 'preset' || mode === 'chaos' ? mode : 'reroll', by: by, from: 'Zelda 1', pick: typeof pick === 'string' ? pick : '' });
        seed.value = '';
        seed.dispatchEvent(new Event('input', { bubbles: true }));
        seed.dispatchEvent(new Event('change', { bubbles: true }));
        gen.click();
      });
    }, 500);
  }

  function init() { addRow(); setTimeout(autoRoll, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
