/*
 * emo-host.js — EmoTracker (beta) in Rando Hub.
 *
 * When the Tracker choice is EmoTracker (tracker-mode.js), Hutch's frames
 * stay empty and emotracker/index.html runs in #emo-frame instead. It reads
 * the game through window.AlttpBridge, like Hutch's tracker does.
 *
 * Which of the pack's trackers it shows follows the app's tracker settings:
 * Inverted → the inverted trackers; Key Sanity or Map/Compass/Small Keys →
 * the keysanity ones. The tracker's own menu can pick another.
 *
 * Desktop layout: "⧉ EmoTracker" moves it to its own window (the game then
 * takes the whole width); closing that window brings it back.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var last = null, win = null;

  function on() { return !!(window.UnifiedTracker && window.UnifiedTracker.emo && window.UnifiedTracker.emo()); }
  function variantFor(gm, di) {
    var inv = /^inverted/.test(gm || ''), keys = di === 'keysanity' || di === 'mapcompasskeys';
    if (inv) return keys ? 'inverted_keysanity' : 'inverted';
    return keys ? 'keysanity' : 'standard';
  }
  function url(v) { return 'emotracker/index.html?variant=' + encodeURIComponent(v); }
  function away() { try { return !!(win && !win.closed); } catch (e) { return false; } }

  function sync(gm, di) {
    var f = $('emo-frame');
    if (!f) return;
    if (!on()) {
      if (away()) { try { win.close(); } catch (e) {} }
      win = null; last = null;
      document.body.classList.remove('emo-away');
      if (f.getAttribute('src') && f.getAttribute('src') !== 'about:blank') f.src = 'about:blank';
      return;
    }
    var v = variantFor(gm, di);
    if (v === last && f.getAttribute('src') && f.getAttribute('src') !== 'about:blank') return;
    // a new choice in the app's settings wins over one picked in the tracker
    if (last !== null && v !== last) { try { localStorage.removeItem('rhb-emo-variant'); } catch (e) {} }
    last = v;
    if (away()) { try { win.location.href = url(v); } catch (e) {} return; }
    f.src = url(v);
  }

  function popOut() {
    var f = $('emo-frame');
    if (away()) { try { win.close(); } catch (e) {} return; }
    var v = last || 'standard';
    win = window.open(url(v), 'rh-emotracker', 'popup=yes,resizable=yes,width=1000,height=720');
    if (!win) { var n = $('popup-note'); if (n) { n.hidden = false; setTimeout(function () { n.hidden = true; }, 9000); } return; }
    f.src = 'about:blank';          // one copy at a time
    document.body.classList.add('emo-away');
    paint();
    var t = setInterval(function () {
      if (away()) return;
      clearInterval(t);
      win = null;
      document.body.classList.remove('emo-away');
      if (on()) f.src = url(last || v);
      paint();
      window.dispatchEvent(new Event('resize'));
    }, 500);
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
  }
  function paint() {
    var b = $('pop-emo');
    if (b) b.classList.toggle('on', away());
  }

  document.addEventListener('DOMContentLoaded', function () {
    var b = $('pop-emo');
    if (b) b.addEventListener('click', popOut);
  });
  window.addEventListener('pagehide', function () { if (away()) { try { win.close(); } catch (e) {} } });

  window.UnifiedEmo = { sync: sync, variantFor: variantFor, popOut: popOut };
})();
