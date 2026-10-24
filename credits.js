/*
 * credits.js — ⚙ Settings → Credits: who made Rando Hub, who tested it, and
 * whose work it builds on. The playtesters and shout-outs are also in the
 * game's own ending for seeds made here (randomizer/hub-credits.js: keep the
 * two in step).
 */
(function () {
  'use strict';
  var TIKTOK = 'https://www.tiktok.com/@';
  var PEOPLE = [
    { title: 'Rando Hub', rows: [['Robert', 'huge_crank_hank', 'Made Rando Hub, Crowd Control+, Mudora and the rest']] },
    { title: 'Playtesters', rows: [
      ['Gumby', 'gumby.oo7', 'Play testing, development ideas'],
      ['HydeOutGaming', 'jennkevden', 'Play testing, development ideas'],
      ["Heffie's Homies", 'heffie638', 'Play testing'],
    ] },
    { title: 'Shout-outs', rows: [
      ['Hutch', '', 'The Hutch tracker, and changes to fit tablet mode'],
      ['Kara', '', 'Kara’s randomizer branch, its settings and presets'],
      ['Muffins', '', 'Muffins’ Tracker 2.0, and Mudora 2.0’s logic'],
    ] },
  ];
  var BUILT_ON = [
    ['Hutch-ALTTPR Tracker', 'Hutch (MIT)', 'https://github.com/hutchch/ALTTPR-Tracker'],
    ['Muffins’ Tracker 2.0 (alttptracker)', 'Muffins / Kristofer Davie (MIT)', 'https://github.com/KrisDavie/alttptracker'],
    ['alttpr-python (Kara’s branch)', 'Kara, on Aerinon’s Door Randomizer and codemann8’s Overworld Shuffle (MIT)', 'https://alttpr.gwaa.kiwi'],
    ['alttp_vt_randomizer', 'sporchia (MIT), base patch from z3randomizer', 'https://github.com/sporchia/alttp_vt_randomizer'],
    ['EmoTracker and its ALTTPR pack', 'EmoTracker community, EmoSaru (MIT)', 'https://github.com/EmoTracker-Community/EmoTracker'],
    ['Snes9x', 'the Snes9x team (non-commercial license)', 'https://github.com/snes9xgit/snes9x'],
    ['AVIANART', 'avianart.games', 'https://avianart.games'],
    ['Link sprites', 'the alttpr.com sprite library and its artists', 'https://alttpr.com/en/sprites'],
    ['TikTok connection', 'TikFinity', 'https://tikfinity.zerody.one'],
    ['Press Start 2P (logo lettering)', 'CodeMan38 (SIL OFL)', 'https://fonts.google.com/specimen/Press+Start+2P'],
  ];

  var CSS =
    '#credits-dlg { position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 16px; }' +
    '#credits-dlg[hidden] { display: none; }' +
    '#credits-dlg .box { background: #161b22; color: #e6edf3; border: 1px solid #30363d; border-radius: 10px; width: min(640px, 100%); max-height: 88vh; display: flex; flex-direction: column; font: 14px/1.45 system-ui, sans-serif; }' +
    '#credits-dlg .hd { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #30363d; }' +
    '#credits-dlg .hd b { font-size: 16px; margin-right: auto; }' +
    '#credits-dlg button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; padding: 4px 10px; cursor: pointer; font: inherit; }' +
    '#credits-dlg .bd { overflow: auto; padding: 6px 16px 16px; }' +
    '#credits-dlg h4 { margin: 14px 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #e3b341; }' +
    '#credits-dlg .p { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding: 5px 0; border-bottom: 1px solid #21262d; }' +
    '#credits-dlg .p b { font-size: 15px; } #credits-dlg .p a { color: #58a6ff; text-decoration: none; } #credits-dlg .p a:hover { text-decoration: underline; }' +
    '#credits-dlg .p span { color: #8b949e; flex-basis: 100%; font-size: 13px; }' +
    '#credits-dlg .note { color: #8b949e; font-size: 12px; margin-top: 14px; }';
  var dlg = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build() {
    if (dlg) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement('div'); dlg.id = 'credits-dlg'; dlg.hidden = true;
    var h = PEOPLE.map(function (g) {
      return '<h4>' + esc(g.title) + '</h4>' + g.rows.map(function (r) {
        return '<div class="p"><b>' + esc(r[0]) + '</b>' + (r[1] ? '<a href="' + TIKTOK + encodeURIComponent(r[1]) + '" target="_blank" rel="noopener">@' + esc(r[1]) + '</a>' : '') +
          '<span>' + esc(r[2]) + '</span></div>';
      }).join('');
    }).join('');
    h += '<h4>Built on</h4>' + BUILT_ON.map(function (r) {
      return '<div class="p"><a href="' + esc(r[2]) + '" target="_blank" rel="noopener"><b>' + esc(r[0]) + '</b></a><span>' + esc(r[1]) + '</span></div>';
    }).join('');
    h += '<p class="note">The playtesters and shout-outs are in the game’s ending too, on every seed made here. No ROMs are included. Rando Hub is a fan project, not affiliated with or endorsed by Nintendo.</p>';
    dlg.innerHTML = '<div class="box" role="dialog" aria-label="Credits"><div class="hd"><b>Credits</b><button type="button" id="cr-close">✕</button></div><div class="bd">' + h + '</div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.hidden = true; });
    dlg.querySelector('#cr-close').onclick = function () { dlg.hidden = true; };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dlg && !dlg.hidden) dlg.hidden = true; });
  }
  window.RandoCredits = { open: function () { build(); dlg.hidden = false; }, people: PEOPLE };
})();
