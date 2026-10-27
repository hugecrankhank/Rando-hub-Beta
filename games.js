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
  var FF6_URL = 'ff6wc/'; // FF6 Worlds Collide: the same
  var FFR_URLS = { ff1: 'ffr/ff1/', ff4: 'ffr/ff4/', ff5: 'ffr/ff5/' };   // FF1R, Free Enterprise, Career Day: played here, rolled on their own sites

  // Which games a reroll may land on: roll-games.js (RandoRoll), ticked in the Game row.
  var R = window.RandoRoll;
  function either() { return R ? R.others('z3').length > 0 : false; }
  // For a reroll from here: the id of another game to go to, or null to stay (mode 'same' always stays)
  function pickOther(mode) { return R ? R.pick('z3', mode) : null; }
  function goTo(id, by, mode) { if (R) R.go(id, { by: by, mode: mode }); }
  // kept for older add-ons
  function pickZ1() { return pickOther() === 'z1'; }
  function goZ1(by, mode) { goTo('z1', by, mode); }

  window.RandoGames = { either: either, pickOther: pickOther, goTo: goTo, pickZ1: pickZ1, goZ1: goZ1, Z1_URL: Z1_URL, GLR_URL: GLR_URL, FF6_URL: FF6_URL, FFR_URLS: FFR_URLS };

  // ── the 🎲 Reroll button: maybe Zelda 1 instead ───────────────────────────
  // Runs before reroll.js's own click handler (capture phase on the document).
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#reroll-btn') : null;
    if (!b || !either()) return;
    var id = pickOther();
    if (!id) return;                       // ALTTP this time: reroll.js carries on
    e.stopPropagation(); e.preventDefault();
    if (window.EJS_emulator && !confirm('Reroll landed on ' + R.name(id) + '!\n\nThe current game will be closed.')) return;
    goTo(id);
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
      '#game-row label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; margin-left: 6px; }' +
      '#roll-games { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; }';
    document.head.appendChild(css);
    var row = document.createElement('div');
    row.id = 'game-row';
    row.innerHTML = '<span>Game</span><span class="gm"><span aria-current="page">Zelda 3 · ALTTP</span>' +
      '<a href="' + Z1_URL + '" title="Zelda 1 randomizer (Z1R): roll, play and track Zelda 1 seeds">Zelda 1 ▸</a>' +
      '<a href="' + GLR_URL + '" title="The Guardian Legend randomizer (GLR): roll, play and track its seeds. Rerolls and Crowd Control never pick it.">Guardian Legend ▸</a>' +
      '<a href="' + FF6_URL + '" title="Final Fantasy VI: Worlds Collide: roll, play and track its seeds (characters, espers, checks). Rerolls and Crowd Control never pick it.">FF6 ▸</a>' +
      '<a href="' + FFR_URLS.ff1 + '" title="Final Fantasy Randomizer (FF1): roll on its site, play and track here">FF1 ▸</a>' +
      '<a href="' + FFR_URLS.ff4 + '" title="FF4 Free Enterprise: roll on its site, play and track here (key items, characters, bosses, objectives)">FF4 ▸</a>' +
      '<a href="' + FFR_URLS.ff5 + '" title="FF5 Career Day: roll on its site, play and track here (key items, jobs, checks)">FF5 ▸</a>' +
      '<a href="patched/" title="Patched games: NES and SNES ROM hacks (your ROM + the hack\u2019s patch)">Patched games ▸</a></span>' +
      '<span id="roll-games" title="The 🎲 Reroll button and Crowd Control’s Random preset and CHAOS seeds pick one of the ticked games at random (the game you’re playing counts too). Crowd Control’s New seed (same settings) always stays in the game you’re playing. FF1, FF4 and FF5 are rolled on their own sites, so rerolls can’t go there.">Rerolls can land on:</span>';
    var after = document.getElementById('r-shared');
    bar.insertBefore(row, after ? after.nextSibling : bar.firstChild);
    var holder = row.querySelector('#roll-games');
    function paintGames() {
      if (!R) return;
      var a = R.allowed();
      holder.innerHTML = 'Rerolls can land on: ' + R.GAMES.map(function (g) {
        return '<label><input type="checkbox" data-game="' + g.id + '"' + (g.id === 'z3' ? ' checked disabled title="This game"' : (a[g.id] ? ' checked' : '')) + '> ' + g.name + '</label>';
      }).join('');
    }
    paintGames();
    holder.addEventListener('change', function (e) {
      var cb = e.target; if (!cb || !cb.dataset.game) return;
      var a = R.allowed(); a[cb.dataset.game] = cb.checked; a.z3 = true; R.setAllowed(a);
    });
    window.addEventListener('storage', function (e) { if (e.key === R.KEY || e.key === EITHER_KEY) paintGames(); });
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
