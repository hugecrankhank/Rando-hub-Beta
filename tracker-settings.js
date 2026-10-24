/*
 * Header tidy-up:
 *
 *  - ⚙ Settings: the tracker settings live in one menu instead of across the
 *    header: Tracker world and Tracker dungeon items (Hutch's logic: his
 *    tracker, Mudora and EmoTracker use them), Tracker keys and Item sounds.
 *    Hutch's two only show while a tracker that uses them is picked; Tracker
 *    keys hides for Muffins' own tracker, which keeps its own count.
 *    In the iPad and phone headers (everything already behind their ⚙) the
 *    same settings simply sit in that menu.
 *  - Zelda 1 ▸ next to 🎲 Reroll: switch to the Zelda 1 randomizer (z1r/).
 *
 * Loaded after reroll.js and addons/hub-items.js (which add the buttons and
 * menus moved here). The controls keep their ids, so nothing that uses them
 * changes.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var CSS = [
    '#trk-settings-wrap { position: relative; display: inline-flex; }',
    '#trk-settings { display: none; position: absolute; top: calc(100% + 6px); right: 0; z-index: 60; min-width: 360px;',
    '  flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 10px;',
    '  background: var(--panel, #161b22); border: 1px solid var(--line, #30363d); box-shadow: 0 10px 30px rgba(0,0,0,.5); }',
    '#trk-settings.open { display: flex; }',
    '#trk-settings > label.ctl { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0; }',
    '#trk-settings .trk-note { font-size: 11px; color: var(--dim, #8b95a3); line-height: 1.4; margin: 0; }',
    '#trk-settings-btn.on { border-color: var(--accent, #1f6feb); }',
    // the settings only some trackers use
    'body.tracker-mudora2 #trk-settings .hutch-only, body.tracker-mfns #trk-settings .hutch-only, body.tracker-off #trk-settings .hutch-only { display: none !important; }',
    'body.tracker-mfns #trk-settings .keys-only, body.tracker-off #trk-settings .keys-only { display: none !important; }',
    'body:not(.tracker-mudora2):not(.tracker-mfns):not(.tracker-off) #trk-settings .no-hutch { display: none; }',
    // iPad / phone headers: shown in their ⚙ menu, no second menu
    'body.hdr-compact #trk-settings-btn, body.phone #trk-settings-btn { display: none !important; }',
    'body.hdr-compact #trk-settings, body.phone #trk-settings { display: flex; position: static; box-shadow: none; border: 0; padding: 0; background: none;',
    '  flex-direction: row; flex-wrap: wrap; min-width: 0; }',
    '#z1-btn { white-space: nowrap; }',
  ].join('\n');

  function build() {
    var header = document.querySelector('header');
    var gm = $('gamemode'), di = $('dungeonitems');
    if (!header || !gm || !di || $('trk-settings')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    var wrap = document.createElement('span'); wrap.id = 'trk-settings-wrap';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'trk-settings-btn';
    btn.textContent = '⚙ Settings'; btn.title = 'Tracker settings: world, dungeon items, keys, item sounds';
    btn.setAttribute('aria-expanded', 'false');
    var panel = document.createElement('div'); panel.id = 'trk-settings'; panel.setAttribute('role', 'dialog');
    wrap.appendChild(btn); wrap.appendChild(panel);

    function row(sel, cls) {
      var lab = sel && sel.closest ? sel.closest('label') : null;
      if (!lab) return;
      if (cls) lab.classList.add(cls);
      panel.appendChild(lab);
    }
    // where the first of them was, the button goes
    var first = gm.closest('label');
    first.parentNode.insertBefore(wrap, first);
    row(gm, 'hutch-only'); row(di, 'hutch-only');
    row($('key-display'), 'keys-only'); row($('sound-pack-sel'));
    var note = document.createElement('p'); note.className = 'trk-note no-hutch';
    note.textContent = 'Tracker world and dungeon items follow each seed rolled here; change them in this tracker’s own Settings (Muffins’ logic).';
    panel.appendChild(note);
    // every seed started here (seed-log.js)
    if (window.RandoSeedLog) {
      var hist = document.createElement('button');
      hist.type = 'button'; hist.id = 'seed-history-btn'; hist.textContent = '📜 Seed history';
      hist.title = 'Every seed started here: when, the seed, its code, who rolled it and how, with links to play it again';
      hist.addEventListener('click', function () { setOpen(false); window.RandoSeedLog.open(); });
      panel.appendChild(hist);
    }

    function setOpen(on) { panel.classList.toggle('open', on); btn.classList.toggle('on', on); btn.setAttribute('aria-expanded', String(on)); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!panel.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (panel.classList.contains('open') && !wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  function z1Button() {
    if ($('z1-btn') || !window.RandoGames) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'z1-btn';
    b.textContent = 'Zelda 1 ▸';
    b.title = 'Switch to the Zelda 1 randomizer (Z1R)';
    b.addEventListener('click', function () {
      if (window.EJS_emulator && !confirm('Switch to Zelda 1?\n\nThe current game will be closed.')) return;
      location.href = window.RandoGames.Z1_URL;
    });
    var after = $('reroll-btn') || $('rando-split');
    if (after) after.parentNode.insertBefore(b, after.nextSibling);
  }

  function init() { build(); z1Button(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
