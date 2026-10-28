/*
 * Go-mode alert: a green frame around the game, for the stream, the moment
 * the tracker says Link can go beat Ganon (Hank, Oct 2026).
 *
 * Where "go mode" comes from:
 *   Mudora 2.0   Muffins' logic says the Ganon check is available
 *                (mudora2.js Mudora2.goMode)
 *   Hutch's      his GO tile set to "Go Mode On" (green); "Feeling" doesn't count
 * It's checked twice a second. When it turns on: "GO MODE!" over the game for
 * a few seconds, and the frame stays on while it's true (so a stream capture
 * shows it), drawn inside the game box over the picture. Off again when the
 * tracker says so (a new seed, say).
 *
 * ⚙ Settings → "Go-mode alert" turns it on or off (on by default), with a
 * Test button that shows it for eight seconds.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rhb-go-alert';
  var on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var CSS =
    '@font-face { font-family: "Rando Pixel"; src: url(fonts/PressStart2P-Regular.ttf) format("truetype"); font-display: swap; }' +
    '.go-ring { position: absolute; left: 0; top: 0; width: 100%; height: 100%; box-sizing: border-box; z-index: 24; pointer-events: none; border: 6px solid #2ecc71; border-radius: 4px;' +
    ' box-shadow: inset 0 0 22px rgba(46,204,113,.75), 0 0 18px rgba(46,204,113,.6); animation: go-ring 1.4s ease-in-out infinite; }' +
    '@keyframes go-ring { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }' +
    '.go-burst { position: absolute; left: 50%; top: 0; transform: translate(-50%, 0) scale(.6); z-index: 27; pointer-events: none; text-align: center;' +
    ' font: 700 clamp(14px, 2.6vw, 26px)/1 "Rando Pixel", "Press Start 2P", system-ui, sans-serif; color: #2ecc71; letter-spacing: .06em;' +
    ' padding: 6px 14px 7px; border-radius: 0 0 10px 10px; background: rgba(10,12,16,.82); border: 2px solid #2ecc71; border-top: 0;' +
    ' text-shadow: 0 0 10px rgba(46,204,113,.9), 0 2px 0 #0a3d1f; opacity: 0; transition: opacity .25s, transform .35s cubic-bezier(.2,1.4,.4,1); }' +
    '.go-burst.show { opacity: 1; transform: translate(-50%, 0) scale(1); }' +
    '.go-burst small { display: block; margin-top: 5px; font-size: .42em; color: #fff; letter-spacing: .1em; }';
  var ring = null, burst = null, burstT = null, was = false, test = 0;

  function host() { return document.querySelector('.s9x'); }
  function style() { if ($('go-mode-css')) return; var st = document.createElement('style'); st.id = 'go-mode-css'; st.textContent = CSS; document.head.appendChild(st); }
  // the ring and the words sit on the picture itself, not the black bars beside it
  function place() {
    var P = window.Snes9xPlayer, r = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (!(r && r.w > 0)) return;
    if (ring) { ring.style.left = Math.round(r.x) + 'px'; ring.style.top = Math.round(r.y) + 'px'; ring.style.width = Math.round(r.w) + 'px'; ring.style.height = Math.round(r.h) + 'px'; }
    if (burst) { burst.style.left = Math.round(r.x + r.w / 2) + 'px'; burst.style.top = Math.round(r.y) + 'px'; }
  }
  function show(now) {
    var h = host(); if (!h) return;
    style();
    if (!ring || !ring.isConnected) { ring = document.createElement('div'); ring.className = 'go-ring'; h.appendChild(ring); }
    place();
    if (now) {
      if (!burst || !burst.isConnected) { burst = document.createElement('div'); burst.className = 'go-burst'; h.appendChild(burst); }
      burst.innerHTML = 'GO MODE!<small>LINK CAN BEAT GANON</small>';
      place();
      burst.classList.remove('show'); void burst.offsetWidth; burst.classList.add('show');
      clearTimeout(burstT); burstT = setTimeout(function () { if (burst) burst.classList.remove('show'); }, 4500);
    }
  }
  function hide() { if (ring) { ring.remove(); ring = null; } if (burst) { burst.classList.remove('show'); } }

  // what the tracker in use says
  function goNow() {
    var b = document.body;
    if (b.classList.contains('tracker-off')) return false;
    if (b.classList.contains('tracker-emo')) {   // Mudora / Mudora 2.0 in #emo-frame
      try { var w = $('emo-frame').contentWindow; return !!(w && w.Mudora2 && w.Mudora2.goMode && w.Mudora2.goMode()); } catch (e) { return false; }
    }
    try {   // Hutch's tracker: his GO tile, green when on
      var f = $('items-frame'), d = f && f.contentDocument, go = d && d.querySelector('.item-slot.go-mode');
      if (!go) return false;
      var bg = (go.style.background || go.style.backgroundColor || '').replace(/\s/g, '').toLowerCase();
      return bg === '#2ecc71' || bg === 'rgb(46,204,113)';
    } catch (e) { return false; }
  }
  function tick() {
    var now = test > Date.now() ? true : on && goNow();
    if (now && !was) show(true);
    else if (now && (!ring || !ring.isConnected)) show(false);   // the game box was rebuilt (new ROM)
    else if (now) place();                                          // the box may have been resized
    else if (!now && was) hide();
    was = now;
  }
  setInterval(tick, 500);

  // ⚙ Settings: the switch and a Test button
  function settings() {
    var panel = $('trk-settings'); if (!panel || $('go-alert')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'When the tracker says Link can go beat Ganon: "GO MODE!" over the game and a green frame around it that stays until the tracker says otherwise. For the stream.';
    lab.innerHTML = 'Go-mode alert (green frame on the game) <span><input type="checkbox" id="go-alert"> <button type="button" id="go-alert-test" title="Show it for eight seconds">Test</button></span>';
    panel.appendChild(lab);
    var cb = lab.querySelector('#go-alert'); cb.checked = on;
    cb.addEventListener('change', function () { on = cb.checked; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} if (!on) { test = 0; hide(); was = false; } });
    lab.querySelector('#go-alert-test').addEventListener('click', function (e) { e.stopPropagation(); test = Date.now() + 8000; was = false; tick(); });
  }
  function init() { settings(); var tries = 0; var t = setInterval(function () { settings(); if ($('go-alert') || ++tries > 50) clearInterval(t); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RandoGoMode = { test: function () { test = Date.now() + 8000; was = false; tick(); }, now: goNow };
})();
