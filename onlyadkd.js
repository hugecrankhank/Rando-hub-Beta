/*
 * OnlyADKD, built in.
 *
 * Hutch's tracker already knows the OnlyADKD mode: map.html reads the
 * `alttp-preset` marker, hides every overworld check but the few the mode
 * keeps, and loads its prebuilt entrance map (tracker/onlyadkd.json). The only
 * way to switch it on in his tracker is the OnlyADKD button on his launcher
 * page, which this app skips, so this file is that button.
 *
 * Loaded in two places:
 *   - the app page (index.html): holds the on/off choice, rewrites the
 *     tracker URLs to the mode's settings, and reloads the trackers.
 *   - inside the tracker's map page (pulled in by bridge/sni-shim.js, which
 *     tools/update-hutch.py keeps in his pages): adds an "OnlyADKD" button
 *     next to New Game in the map's top bar.
 * Nothing in tracker/ is edited, so his updates never undo it.
 */
(function () {
  'use strict';
  var KEY = 'unified-onlyadkd';

  // His launcher's OnlyADKD preset, as the URL flags it would send.
  var BOTH = {
    gamemode: 'open', dungeonitems: 'keysanity', dungeonshuffle: 'mcbk',
    universalkeys: 'no', keydropall: 'no', keydrop: 'yes', enemykeydrop: 'yes',
    bossshuffle: 'no', swordless: 'no', potdrops: 'no', enemydrops: 'no',
    potsbones: 'no', pottery: 'keys',
  };
  var MAP = {
    enemizer: 'no', gtcrystals: '7', entranceshuffle: 'yes', entrancemode: 'on',
    shopsanity: 'no', bonkshuffle: 'no', logic: 'noglitches', doorshuffle: 'none',
    preset: 'onlyadkd',
  };
  var ITEMS = { pseudoboots: 'yes', mirrorscroll: 'yes' };

  function isOn() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  // The marker map.html looks for. Turning on clears "map already loaded" so
  // the prebuilt entrance map goes in once; reloads after that keep progress.
  function syncMarker(fresh) {
    try {
      if (isOn()) {
        localStorage.setItem('alttp-preset', 'onlyadkd');
        if (fresh) localStorage.removeItem('alttp-preset-map-loaded');
      } else if (localStorage.getItem('alttp-preset') === 'onlyadkd') {
        localStorage.removeItem('alttp-preset');
        localStorage.removeItem('alttp-preset-map-loaded');
      }
    } catch (e) {}
  }

  function rewrite(url, extra) {
    if (!url || !isOn()) return url;
    var q = url.indexOf('?');
    var path = q < 0 ? url : url.slice(0, q);
    var p = new URLSearchParams(q < 0 ? '' : url.slice(q + 1));
    [BOTH, extra].forEach(function (o) { Object.keys(o).forEach(function (k) { p.set(k, o[k]); }); });
    return path + '?' + p.toString();
  }

  var tracker = /\/(map|itemtracker)\.html$/.test(location.pathname);

  if (!tracker) {
    // ── the app page ──
    syncMarker(false);
    window.UnifiedOnlyAdkd = {
      app: true,
      on: isOn,
      urls: function (u) { return { items: rewrite(u.items, ITEMS), map: rewrite(u.map, MAP) }; },
      set: function (v) {
        v = !!v;
        if (v === isOn()) return;
        try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
        syncMarker(true);
        // index.html reloads the trackers on this (same as the Tracker choice)
        window.dispatchEvent(new CustomEvent('trackermode', { detail: { onlyadkd: v } }));
      },
    };
    return;
  }

  // ── inside the tracker ──
  if (!/\/map\.html$/.test(location.pathname)) return;

  function findApp() {
    var seen = [], w = window;
    for (var d = 0; d < 6 && w && seen.indexOf(w) < 0; d++) {
      seen.push(w);
      try { if (w.UnifiedOnlyAdkd && w.UnifiedOnlyAdkd.app) return w.UnifiedOnlyAdkd; } catch (e) {}
      try { w = (w.parent && w.parent !== w) ? w.parent : w.opener; } catch (e) { w = null; }
    }
    return null;
  }

  function addButton() {
    if (document.getElementById('onlyadkd-btn')) return;
    var reset = document.getElementById('reset-btn');
    if (!reset || !reset.parentNode) return;
    var on = isOn();
    var b = document.createElement('button');
    b.id = 'onlyadkd-btn';
    b.type = 'button';
    b.textContent = 'OnlyADKD';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on
      ? 'OnlyADKD is on: its settings and prebuilt entrance map are loaded. Click to turn it off.'
      : 'Turn on OnlyADKD: sets every OnlyADKD option and loads its prebuilt entrance map';
    b.style.cssText = 'margin-right:4px;border-radius:3px;padding:0 7px;font-size:11px;line-height:1.7;cursor:pointer;font-weight:600;' +
      (on ? 'background:#0f5f73;color:#bff6ff;border:1px solid #39d0f0;box-shadow:0 0 6px #39d0f0;'
          : 'background:#0c1a1f;color:#7fd8ea;border:1px solid #1f4f5c;');
    b.addEventListener('click', function () {
      var app = findApp();
      if (app) { app.set(!isOn()); return; }
      // tracker opened on its own: switch here and reload this page
      try { localStorage.setItem(KEY, isOn() ? '0' : '1'); } catch (e) {}
      syncMarker(true);
      var p = new URLSearchParams(location.search);
      if (isOn()) p.set('preset', 'onlyadkd'); else p.delete('preset');
      location.search = p.toString();
    });
    // before New Game: the bar's far end gets cut off in narrow map panels
    reset.parentNode.insertBefore(b, reset);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
