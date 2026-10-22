/*
 * Rando Hub — small keys in hand (addon for Hutch's item tracker).
 *
 * Hutch's tracker counts small keys COLLECTED ($7EF4E0+, a tally that only
 * rises). This adds the keys you're HOLDING right now, which drops as doors
 * are opened, and a setting for what the dungeon key row shows:
 *
 *   Found   1/6       (unchanged, the default)
 *   Held    0/6
 *   Both    1(0)/6    found, (in hand), dungeon total
 *
 * Keys in hand live in SRAM $7EF37C + dungeon index for every dungeon Link
 * is not in, and in $7EF36F for the one he is in. Both are inside the block
 * the tracker already reads ($7EF340, 0x1AE bytes), so this only wraps
 * processInventoryData to look at the same bytes — no extra reads.
 *
 * tracker/ is replaced from Hutch's repository on every deploy; this file is
 * added to itemtracker.html by tools/update-hutch.py.
 */
(function () {
  'use strict';
  var KEY = 'rando-hub-key-display';
  var MODES = { found: 'Found', held: 'In hand', both: 'Both' };

  function mode() {
    try { var m = localStorage.getItem(KEY); return MODES[m] ? m : 'found'; } catch (e) { return 'found'; }
  }

  // ── reading keys in hand ──────────────────────────────────────────────────
  var held = {};          // dungeon key → keys in hand, once read
  function readHeld(data) {
    var ds = window.dungeons;
    if (!ds || !data || data.length < 0x4E) return false;
    // A save & quit blanks the block for a poll or two; a wholly empty
    // inventory is never a real reading mid-run, so don't believe it.
    var any = false;
    for (var i = 0; i < 0x4E && !any; i++) if (data[i]) any = true;
    if (!any) return false;

    var inside = window._currentDungeon || null;
    var cur = data[0x2F];                       // $7EF36F, 0xFF outside dungeons
    var moved = false;
    Object.keys(ds).forEach(function (k) {
      var d = ds[k];
      if (!d || !d.smallKeyAddr) return;
      var idx = d.smallKeyAddr - 0x4E0;
      if (idx < 0 || idx > 0x0F) return;
      var n = data[0x3C + idx];
      // Hyrule Castle and the Sewers are one dungeon in the randomizer; the
      // game keeps a slot for each, so take whichever is set.
      if (k === 'hc') n = Math.max(n, data[0x3D]);
      if (k === inside && cur !== 0xFF && cur !== undefined) n = cur;
      if (n === 0xFF) n = 0;
      if (held[k] !== n) { held[k] = n; moved = true; }
    });
    return moved;
  }

  function refreshAll() {
    var ds = window.dungeons;
    if (!ds || typeof window.updateDungeonCountDisplay !== 'function') return;
    Object.keys(ds).forEach(function (k) { try { window.updateDungeonCountDisplay(k); } catch (e) {} });
  }

  if (typeof window.processInventoryData === 'function') {
    var orig = window.processInventoryData;
    window.processInventoryData = function (data) {
      var r = orig.apply(this, arguments);
      try { if (readHeld(data) && mode() !== 'found') refreshAll(); } catch (e) {}
      return r;
    };
  }

  // ── the label ─────────────────────────────────────────────────────────────
  if (typeof window.smallKeyLabel === 'function') {
    var origLabel = window.smallKeyLabel;
    window.smallKeyLabel = function (d) {
      var m = mode();
      if (m === 'found' || !d) return origLabel.apply(this, arguments);
      // Universal keys / Retro: the row is just "how many doors"; leave it.
      try { if (window.keysAreUniversal && window.keysAreUniversal()) return origLabel.apply(this, arguments); } catch (e) {}
      var key = null, ds = window.dungeons || {};
      Object.keys(ds).forEach(function (k) { if (ds[k] === d) key = k; });
      // Not read from the game yet (manual tracking, or before the first
      // poll): there is no "in hand" to show, so keep Hutch's own text.
      if (!key || held[key] === undefined) return origLabel.apply(this, arguments);
      var max = d.keysUnknown ? '?' : (d.maxSmallKeys || 0);
      var found = d.smallKeyCount || 0;
      return m === 'held' ? held[key] + '/' + max : found + '(' + held[key] + ')/' + max;
    };
  }

  // ── setting, beside "Show Dungeon Chests" ─────────────────────────────────
  function addSetting() {
    var anchor = document.getElementById('item-opt-dungeon-chests');
    var row = anchor && anchor.closest ? anchor.closest('.its-row') : null;
    if (!row || document.getElementById('rh-key-display')) return;
    var wrap = document.createElement('div');
    wrap.className = 'its-row';
    wrap.style.marginTop = '6px';
    wrap.id = 'rh-key-display';
    var lab = document.createElement('label');
    lab.textContent = 'Small keys: ';
    lab.title = 'Found = collected in total. In hand = not yet used on a door. Both = found(in hand)/total';
    var sel = document.createElement('select');
    Object.keys(MODES).forEach(function (m) {
      var o = document.createElement('option');
      o.value = m; o.textContent = MODES[m] + (m === 'both' ? '  1(0)/6' : m === 'held' ? '  0/6' : '  1/6');
      sel.appendChild(o);
    });
    sel.value = mode();
    sel.onchange = function () {
      try { localStorage.setItem(KEY, sel.value); } catch (e) {}
      refreshAll();
    };
    lab.appendChild(sel);
    wrap.appendChild(lab);
    row.parentNode.insertBefore(wrap, row.nextSibling);
  }
  // Another tracker window (or the map) changing it
  window.addEventListener('storage', function (e) { if (e.key === KEY) { var s = document.querySelector('#rh-key-display select'); if (s) s.value = mode(); refreshAll(); } });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addSetting);
  else addSetting();
})();
