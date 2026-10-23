/*
 * Rando Hub — small keys in hand, for a tracker page (Mudora, Mudora 2.0,
 * EmoTracker). The hub page reads them from the game (addons/hub-items.js)
 * and sends them here; this works in the hub's tracker frame and in a
 * popped-out tracker window alike.
 *
 *   RandoKeysClient.mode()              'found' | 'held' | 'both'
 *   RandoKeysClient.held('pod')         keys in hand, or null if not known
 *   RandoKeysClient.text(found, k, max) "1/6", "0/6" or "1(0)/6" for the mode
 *   RandoKeysClient.onChange(fn)        repaint when they change
 */
(function () {
  'use strict';
  if (window.RandoKeysClient) return;
  var KEY = 'rando-hub-key-display';
  var data = null, subs = [];
  function notify() { subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function latest() {
    try { if (window.parent !== window && window.parent.RandoKeys) return window.parent.RandoKeys; } catch (e) {}
    try { if (window.opener && window.opener.RandoKeys) return window.opener.RandoKeys; } catch (e) {}
    return data;
  }
  function mode() {
    try { var m = localStorage.getItem(KEY); return m === 'held' || m === 'both' ? m : 'found'; } catch (e) { return 'found'; }
  }
  function held(k) {
    var d = latest();
    if (!d || !d.live || !d.held || d.held[k] === undefined) return null;
    return d.held[k];
  }
  function text(found, k, max) {
    var m = mode(), h = held(k);
    if (m === 'found' || h === null) return found + '/' + max;
    return m === 'held' ? h + '/' + max : found + '(' + h + ')/' + max;
  }
  try {
    var bc = new BroadcastChannel('rando-hub-keys');
    bc.onmessage = function (e) { if (e.data && e.data.type === 'keys') { data = e.data; notify(); } };
    bc.postMessage({ type: 'ask' });
  } catch (e) {}
  window.addEventListener('storage', function (e) { if (e.key === KEY) notify(); });
  window.RandoKeysClient = { mode: mode, held: held, text: text, onChange: function (fn) { subs.push(fn); } };
})();
