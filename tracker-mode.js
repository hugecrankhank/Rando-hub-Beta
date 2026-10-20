/*
 * Tracker choice: Hutch's newest release, his beta, EmoTracker (beta, see
 * emo-host.js), or no tracker at all.
 *
 *   release  tracker/       (tools/update-hutch.py keeps it at his latest)
 *   beta     tracker-beta/  (his beta files over the release; the release
 *                            itself when he has no beta out)
 *   off      no tracker: the game fills the screen under the header. With
 *            the on-screen controller showing, the controller moves off the
 *            picture: below it when the phone is upright, on both sides of
 *            it when sideways. (With a tracker it overlays the game, as before.)
 *
 * Loaded before tablet.js and the main script, which ask it for the folder
 * (base()) and whether the tracker is off (off()). The menu is the "Tracker"
 * choice in the header (behind ⚙ on phones).
 */
(function () {
  'use strict';
  var KEY = 'rhb-tracker';   // (this beta's own key: the main app's choice is left alone)
  var V = window.HUTCH_TRACKERS || { release: { path: 'tracker/', version: '' }, beta: null };
  // Mudora is the starting choice; after that, whatever was picked last (saved by set())
  var mode = 'mudora';
  try { mode = localStorage.getItem(KEY) || 'mudora'; } catch (e) {}
  if (mode !== 'release' && mode !== 'beta' && mode !== 'off' && mode !== 'emo' && mode !== 'mudora') mode = 'mudora';

  function off() { return mode === 'off'; }
  // emo(): a tracker in its own frame (emo-host.js) — EmoTracker, or Mudora
  function emo() { return mode === 'emo' || mode === 'mudora'; }
  // Mudora (mudora/): Rando Hub's own tracker. Hutch's release still runs,
  // out of sight, for its logic; Mudora shows the answers.
  function mudora() { return mode === 'mudora'; }
  function base() { return mode === 'beta' && V.beta ? V.beta.path : V.release.path; }
  function options() {
    var rv = V.release.version ? ' ' + V.release.version : '';
    return [['release', 'Hutch' + rv], ['beta', 'Hutch Beta'], ['mudora', 'Mudora (beta)'], ['emo', 'EmoTracker (beta)'], ['off', 'Off (game full screen)']];
  }
  function applyBody() {
    if (!document.body) return;
    document.body.classList.toggle('tracker-off', off());
    document.body.classList.toggle('tracker-emo', emo());
    document.body.classList.toggle('tracker-mudora', mudora());
  }
  function applyController() {
    var P = window.Snes9xPlayer;
    if (P && P.setTouchPlacement) P.setTouchPlacement(off() ? 'outside' : 'overlay');
  }
  function set(m) {
    if (m === mode) return;
    mode = m;
    try { localStorage.setItem(KEY, m); } catch (e) {}
    applyBody();
    applyController();
    window.dispatchEvent(new CustomEvent('trackermode', { detail: { mode: m } }));
  }

  applyController();
  if (document.body) applyBody();
  else document.addEventListener('DOMContentLoaded', applyBody);

  window.UnifiedTracker = {
    mode: function () { return mode; },
    off: off, emo: emo, mudora: mudora, base: base, set: set, options: options, versions: V,
  };
})();
