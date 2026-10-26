/*
 * Zelda Classic (ZQuest Classic) from Rando Hub.
 *
 * ZQuest Classic is Zelda Classic's engine, renamed and still developed
 * (zeldaclassic.com closed in October 2026; https://zquestclassic.com is its
 * home now). It has an official web player, web.zquestclassic.com/play/,
 * with its whole quest database. It needs a page of its own (it runs threads,
 * which only work in a "cross-origin isolated" page, so it can't sit inside
 * Rando Hub's page), so this opens it in its own window: a pop-up window in a
 * browser, a native window in the Windows app (desktop/src/main.js lets it in).
 *
 * Loaded by the hub (index.html), Zelda 1 (z1r/) and GLR (glr/). Adds a
 * "Zelda Classic" button to the header next to the other games.
 *
 *   window.RandoZC.open([quest])   open the player (quest: a path from its quest list)
 */
(function () {
  'use strict';
  var PLAYER = 'https://web.zquestclassic.com/play/';
  var NAME = 'zquest-classic';
  var win = null;

  function open(quest) {
    var url = PLAYER + (quest ? '?quest=' + encodeURIComponent(quest) : '');
    if (win && !win.closed && !quest) { try { win.focus(); return win; } catch (e) {} }
    var w = Math.min(1100, screen.availWidth - 40), h = Math.min(860, screen.availHeight - 60);
    win = window.open(url, NAME, 'popup=yes,width=' + w + ',height=' + h + ',left=' + Math.max(0, (screen.availWidth - w) / 2) + ',top=' + Math.max(0, (screen.availHeight - h) / 2));
    if (!win) location.assign(url);   // pop-ups blocked: go there in this tab
    return win;
  }

  var TITLE = 'Zelda Classic (ZQuest Classic): play the original Zelda and thousands of fan-made quests. Opens its official player in its own window.';

  // Header button: after the other games' buttons on each page
  function addButton() {
    if (document.getElementById('zc-btn')) return true;
    var anchor = document.getElementById('glr-btn')        // hub (tracker-settings.js)
      || document.getElementById('hub-glr')                // Zelda 1 (z1r/hub.js)
      || document.getElementById('hub-z1');                // GLR (glr/hub.js)
    if (!anchor) return false;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'zc-btn';
    b.className = anchor.className || '';
    b.textContent = 'Zelda Classic ↗';
    b.title = TITLE;
    b.style.whiteSpace = 'nowrap';
    b.addEventListener('click', function () { open(); });
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    return true;
  }
  function init() {
    var tries = 0;
    (function again() { if (!addButton() && ++tries < 40) setTimeout(again, 150); })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.RandoZC = { open: open, PLAYER: PLAYER, TITLE: TITLE };
})();
