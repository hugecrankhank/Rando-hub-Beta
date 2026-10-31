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
 *  - Games ▾ next to 🎲 Reroll: switch to another game, add or manage games
 *    (z1r/) or The Guardian Legend randomizer (glr/).
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
    '#z1-btn, #glr-btn { white-space: nowrap; }',
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
    // Home Screen icon (iPhone / iPad: read when you tap Share → Add to Home Screen)
    var hi = document.createElement('label'); hi.className = 'ctl';
    hi.innerHTML = 'Home Screen icon <select id="home-icon-sel">' +
      '<option value="auto">Auto (black &amp; white on iPhone)</option>' +
      '<option value="color">Colour</option><option value="mono">Black &amp; white</option></select>';
    hi.title = 'The icon iPhone / iPad use when you Add to Home Screen. Already added? Remove it and add it again to change it.';
    panel.appendChild(hi);
    var his = hi.querySelector('select');
    try { his.value = localStorage.getItem('rhb-home-icon') || 'auto'; } catch (e) {}
    his.addEventListener('change', function () {
      try { localStorage.setItem('rhb-home-icon', his.value); } catch (e) {}
      var mono = his.value === 'mono' || (his.value === 'auto' && /iPhone|iPod/.test(navigator.userAgent));
      var l = $('touch-icon'); if (l) l.href = mono ? 'icons/apple-touch-icon-mono.png' : 'icons/apple-touch-icon.png';
    });
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
    // who made it, the playtesters and shout-outs (credits.js)
    if (window.RandoCredits) {
      var cr = document.createElement('button');
      cr.type = 'button'; cr.id = 'credits-btn'; cr.textContent = '\u2B50 Credits';
      cr.title = 'Who made Rando Hub, its playtesters, shout-outs, and what it builds on';
      cr.addEventListener('click', function () { setOpen(false); window.RandoCredits.open(); });
      panel.appendChild(cr);
    }

    function setOpen(on) { panel.classList.toggle('open', on); btn.classList.toggle('on', on); btn.setAttribute('aria-expanded', String(on)); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!panel.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (panel.classList.contains('open') && !wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  // Games ▾ next to 🎲 Reroll: every other game (the ones ticked in "Games
  // shown"; the rest under "Add a game"), and Manage games… (show / hide,
  // Offload a game's stored ROM and seed). The same menu the game pages have.
  function gamesButton() {
    if ($('hub-games') || !window.RandoRoll) return;
    var sel = window.RandoRoll.gamesMenu('', [], [], {
      always: true, shortLabel: '\uD83C\uDFAE\u25BE',
      confirm: function (name) { return !(window.EJS_emulator && !confirm('Switch to ' + (name || 'another game') + '?\n\nThe current game will be closed.')); },
    });
    sel.title = 'Games: switch to another game, add one, or manage them (show, hide, offload)';
    sel.className = '';
    var after = $('reroll-btn') || $('rando-split');
    if (after) after.parentNode.insertBefore(sel, after); else document.querySelector('header').appendChild(sel);
  }

  function init() { build(); gamesButton(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
