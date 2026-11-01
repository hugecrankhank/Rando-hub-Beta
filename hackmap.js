/*
 * hackmap.js — the hub (Zelda 3): when the ROM loaded is a Link to the Past
 * hack (its world map isn't vanilla's: Allhallows Eve, Parallel Worlds, any
 * ZScream hack), a 🗺 button appears and opens the hack's own world map, drawn
 * from the ROM (z3map.js), with Link on it and pins of your own. ⧉ puts it in
 * a window of its own (hackmap.html) for a stream capture. Vanilla and
 * randomizer seeds have Mudora's map already, so nothing shows for them.
 *
 * With the tracker on, the map takes the tracker's place by itself (same spot,
 * same size), with "Tracker" to swap back; the 🗺 button swaps to the map again.
 * With the tracker off it opens in a panel over the game.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var btn = null, panel = null, popup = null, dock = null, docked = false, wantDock = true, isOn = false;
  function frames() { var f = $('frames'); return f && f.offsetParent !== null && f.getBoundingClientRect().height > 80 ? f : null; }
  function host() { return $('hm-host'); }
  function place() {
    var f = isOn && wantDock ? frames() : null;
    if (f) {
      if (!dock) {
        dock = document.createElement('div'); dock.id = 'hm-dock';
        dock.innerHTML = '<div class="hm-dbar"><span>\uD83D\uDDFA Hack map</span><button type="button" class="hm-pop" title="The map in a window of its own (for a stream capture)">\u29C9 Pop out</button><button type="button" class="hm-trk" title="Back to the tracker (the 🗺 button brings the map back)">Tracker \u21C4</button></div><div class="hm-dbody"></div>';
        dock.querySelector('.hm-pop').addEventListener('click', popOut);
        dock.querySelector('.hm-trk').addEventListener('click', function () { wantDock = false; place(); });
      }
      if (getComputedStyle(f).position === 'static') f.style.position = 'relative';
      if (dock.parentNode !== f) f.appendChild(dock);
      var hb = dock.querySelector('.hm-dbody'); if (host().parentNode !== hb) hb.appendChild(host());
      dock.hidden = false; docked = true; panel.hidden = true;
      btn.classList.remove('show');
    } else {
      if (dock) dock.hidden = true;
      docked = false;
      var pb = panel.querySelector('.hm-body'); if (host().parentNode !== pb) pb.appendChild(host());
      btn.classList.toggle('show', isOn);
      if (!isOn) { panel.hidden = true; btn.classList.remove('on'); }
    }
    window.dispatchEvent(new Event('resize'));
  }
  function popOut() {
    if (popup && !popup.closed) { popup.focus(); return; }
    popup = window.open('hackmap.html', 'rhb-hackmap', 'popup=yes,width=560,height=600,resizable=yes');
    if (!popup) alert('The browser blocked the window. Allow pop-ups for this site and try again.');
  }
  function build() {
    if (btn) return;
    var st = document.createElement('style');
    st.textContent =
      '#hm-btn { position: fixed; z-index: 79; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom)); display: none; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px;' +
      '  background: #161b22; color: #e6e9ee; border: 1px solid #ffd166; box-shadow: 0 4px 16px rgba(0,0,0,.5); font: 600 13px system-ui, sans-serif; cursor: pointer; }' +
      '#hm-btn.show { display: inline-flex; } #hm-btn.on { background: #2a2410; }' +
      'body.phone #hm-btn { bottom: auto; top: calc(54px + env(safe-area-inset-top)); right: 8px; padding: 6px 10px; }' +
      '#hm-panel { position: fixed; z-index: 80; right: 12px; bottom: calc(56px + env(safe-area-inset-bottom)); width: min(460px, calc(100vw - 24px)); height: min(520px, calc(100vh - 120px));' +
      '  display: flex; flex-direction: column; background: #0e1116; border: 1px solid #2a313c; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.6); overflow: hidden; }' +
      '#hm-panel[hidden] { display: none; }' +
      '#hm-panel .hm-head { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; border-bottom: 1px solid #2a313c; font: 600 13px system-ui, sans-serif; color: #e6e9ee; }' +
      '#hm-panel .hm-head span { flex: 1; } #hm-panel .hm-head button { background: #161b22; color: #e6e9ee; border: 1px solid #2a313c; border-radius: 6px; padding: 4px 8px; font: 12px system-ui, sans-serif; cursor: pointer; }' +
      '#hm-panel .hm-body { flex: 1 1 0; min-height: 0; padding: 8px; display: flex; flex-direction: column; } #hm-panel .hm-body > div { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }' +
      '#hm-panel .z3m { flex: 1 1 0 !important; height: auto !important; } #hm-panel .z3m-about { display: none; }' +
      '#hm-dock { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: #0b0f16; }' +
      '#hm-dock[hidden] { display: none; }' +
      '#hm-dock .hm-dbar { flex: none; display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; background: #11161f; border-bottom: 1px solid #2a313c; font: 600 12.5px system-ui, sans-serif; color: #c9d1d9; }' +
      '#hm-dock .hm-dbar span { flex: 1; } #hm-dock .hm-dbar button { background: #161b22; color: #e6e9ee; border: 1px solid #2a313c; border-radius: 6px; padding: 4px 8px; font: 12px system-ui, sans-serif; cursor: pointer; }' +
      '#hm-dock .hm-dbody { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; } #hm-dock .hm-dbody > div { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }' +
      '#hm-dock .z3m { flex: 1 1 0 !important; height: auto !important; border: 0 !important; border-radius: 0 !important; } #hm-dock .z3m-about { display: none; }' +
      'body.phone #hm-dock .hm-pop { display: none; }' +
      'body.phone #hm-panel { right: 0; left: 0; bottom: 0; width: auto; height: 58vh; border-radius: 12px 12px 0 0; } body.phone #hm-panel .hm-pop { display: none; }';
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.id = 'hm-btn'; btn.type = 'button';
    btn.innerHTML = '🗺 Hack map'; btn.title = 'This hack’s world map, from its ROM, with Link on it';
    panel = document.createElement('div'); panel.id = 'hm-panel'; panel.hidden = true;
    panel.innerHTML = '<div class="hm-head"><span>Hack map</span><button type="button" class="hm-pop" title="The map in a window of its own (for a stream capture)">⧉ Pop out</button><button type="button" class="hm-close" aria-label="Close">✕</button></div><div class="hm-body"><div id="hm-host" hidden></div></div>';
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.addEventListener('click', function () {
      if (frames()) { wantDock = true; place(); return; }   // back in the tracker's place
      panel.hidden = !panel.hidden; btn.classList.toggle('on', !panel.hidden); if (!panel.hidden) window.dispatchEvent(new Event('resize'));
    });
    panel.querySelector('.hm-close').addEventListener('click', function () { panel.hidden = true; btn.classList.remove('on'); });
    panel.querySelector('.hm-pop').addEventListener('click', popOut);
    window.Z3Map.attach({ player: function () { return window.Snes9xPlayer; }, host: $('hm-host'), hackOnly: true,
      onShow: function (on) { isOn = on; if (on) wantDock = true; place(); } });
    // the layout can change (the tracker turned on or off, a phone turned): follow it
    var lastF = null;
    setInterval(function () { var f = !!frames(); if (isOn && f !== lastF) { lastF = f; place(); } }, 1000);
  }
  function init() { if (window.Z3Map) build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
