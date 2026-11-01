/*
 * hackmap.js — the hub (Zelda 3): when the ROM loaded is a Link to the Past
 * hack (its world map isn't vanilla's: Allhallows Eve, Parallel Worlds, any
 * ZScream hack), a 🗺 button appears and opens the hack's own world map, drawn
 * from the ROM (z3map.js), with Link on it and pins of your own. ⧉ puts it in
 * a window of its own (hackmap.html) for a stream capture. Vanilla and
 * randomizer seeds have Mudora's map already, so nothing shows for them.
 *
 * With the tracker on, the map takes the tracker's place by itself (same spot,
 * same size). On a phone the tracker's Light World / Dark World tabs show the
 * hack's maps and one button where − / + sit swaps them back to the tracker's;
 * on a computer "Tracker ⇄" on the map's row swaps back and the 🗺 button
 * swaps to the map again. With the tracker off it opens in a panel over the game.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var btn = null, panel = null, popup = null, dock = null, wantDock = true, isOn = false, swap = null;
  function phone() { return document.body.classList.contains('phone'); }
  function curTab() { var b = document.querySelector('#phone-tabs button.on'); return b ? b.dataset.tab : ''; }
  function mapTab() { var t = curTab(); return t === 'lw' || t === 'dw' || t === 'keys'; }
  var keysView = false, keysEl = null;
  // The hack's own dungeons (the tracker's Keys list is the original game's):
  // map, compass, big key, small keys held, and how much of each Link has seen.
  function keysPanel() {
    if (!keysEl) {
      keysEl = document.createElement('div'); keysEl.id = 'hm-keys';
      keysEl.addEventListener('click', function (e) {
        var r = e.target.closest('[data-d]'); if (!r) return;
        var d = +r.dataset.d;
        if (phone()) { var b = document.querySelector('#phone-tabs button[data-tab="lw"]'); if (b) b.click(); } else { keysView = false; place(); }
        setTimeout(function () { window.Z3Map.showDungeon(d); }, 60);   // after the tab has picked its world
      });
    }
    var L = window.Z3Map.dungeonStatus();
    keysEl.innerHTML = '<div class="hk-h">Dungeons <small>this hack\u2019s own, from its ROM \u00B7 tap one for its map</small></div>' + (L.length ? L.map(function (x) {
      var k = x.keys > 99 ? 0 : x.keys, pct = x.total ? Math.round(x.seen / x.total * 100) : 0;
      return '<button type="button" class="hk-row' + (x.here ? ' here' : '') + (pct === 100 ? ' done' : '') + '" data-d="' + x.d + '">' +
        '<span class="hk-n"><b>' + x.name + (x.here ? ' \u2022' : '') + '</b><small>' + x.floors + '</small></span>' +
        '<span class="hk-i' + (x.map ? ' on' : '') + '" title="Map">\uD83D\uDDFA</span><span class="hk-i' + (x.compass ? ' on' : '') + '" title="Compass">\uD83E\uDDED</span><span class="hk-i' + (x.bigkey ? ' on' : '') + '" title="Big key">\uD83D\uDDDD</span>' +
        '<span class="hk-k' + (k ? ' on' : '') + '" title="Small keys held">\uD83D\uDD11 ' + k + '</span><span class="hk-p" title="Rooms seen">' + pct + '%</span></button>';
    }).join('') : '<p class="hk-none">No dungeon maps in this ROM.</p>');
    return keysEl;
  }
  function frames() { var f = $('frames'); return f && f.offsetParent !== null && f.getBoundingClientRect().height > 80 ? f : null; }
  function host() { return $('hm-host'); }
  // Phones: the tracker's Light World / Dark World tabs show the hack's maps, Items / Keys the tracker,
  // and one button (where − / + sit) swaps the map tabs between the hack map and the tracker's map.
  function place() {
    var f = isOn && wantDock ? frames() : null, onPhone = phone();
    var showDock = !!f && (!onPhone || mapTab());
    document.body.classList.toggle('hm-on', isOn);
    document.body.classList.toggle('hm-docked', isOn && wantDock);
    if (swap) swap.textContent = wantDock ? 'Tracker \u21C4' : '\uD83D\uDDFA Map \u21C4';
    if (f) {
      if (!dock) { dock = document.createElement('div'); dock.id = 'hm-dock'; }
      if (getComputedStyle(f).position === 'static') f.style.position = 'relative';
      if (dock.parentNode !== f) f.appendChild(dock);
      if (host().parentNode !== dock) dock.appendChild(host());
      var kp = keysPanel(); if (kp.parentNode !== dock) dock.appendChild(kp);
      var showKeys = onPhone ? curTab() === 'keys' : keysView;
      kp.hidden = !showKeys; host().style.display = showKeys ? 'none' : '';
      window.Z3Map.setCompact(onPhone);
      dock.hidden = !showDock; panel.hidden = true;
      if (!showKeys) window.Z3Map.fit();
      btn.classList.remove('show');
      if (onPhone && showDock) syncTab();
    } else {
      if (dock) dock.hidden = true;
      window.Z3Map.setCompact(false);
      var pb = panel.querySelector('.hm-body'); if (host().parentNode !== pb) pb.appendChild(host());
      btn.classList.toggle('show', isOn && !(onPhone && frames()));
      if (!isOn) { panel.hidden = true; btn.classList.remove('on'); }
    }
    window.dispatchEvent(new Event('resize'));
  }
  // the phone tab the user is on picks the world
  function syncTab() {
    var on = document.querySelector('#phone-tabs button.on');
    if (on && (on.dataset.tab === 'lw' || on.dataset.tab === 'dw') && window.Z3Map.world !== 2) window.Z3Map.view(on.dataset.tab === 'dw' ? 1 : 0);
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
      '#hm-dock > div { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }' +
      '#hm-keys { overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 4px 6px 10px; font: 14px system-ui, sans-serif; color: #c9d1d9; } #hm-keys[hidden] { display: none !important; }' +
      '#hm-keys .hk-h { padding: 8px 6px; font: 600 12px system-ui, sans-serif; color: #8b95a3; text-transform: uppercase; letter-spacing: .05em; } #hm-keys .hk-h small { text-transform: none; letter-spacing: 0; font-weight: 400; margin-left: 6px; }' +
      '#hm-keys .hk-row { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; margin: 0 0 6px; background: #161b22; border-left: 4px solid #e5534b; border-radius: 6px; cursor: pointer; }' +
      '#hm-keys .hk-row.done { border-left-color: #3fb950; } #hm-keys .hk-row.here { background: #1d2636; }' +
      '#hm-keys .hk-n { flex: 1; min-width: 0; } #hm-keys .hk-n b { display: block; font-weight: 650; color: #e6edf3; } #hm-keys .hk-n small { display: block; color: #8b95a3; font-size: 12px; }' +
      '#hm-keys .hk-i { font-size: 20px; opacity: .22; filter: grayscale(1); } #hm-keys .hk-i.on { opacity: 1; filter: none; }' +
      '#hm-keys .hk-k { color: #8b95a3; white-space: nowrap; opacity: .45; } #hm-keys .hk-k.on { color: #ffd166; opacity: 1; } #hm-keys .hk-p { min-width: 3em; text-align: right; color: #e6edf3; font-weight: 600; }' +
      '#hm-keys .hk-none { color: #8b95a3; padding: 10px; }' +
      // phones: the swap button sits where − / + are; − / + only for the tracker's own map
      '#hm-swap { display: none; min-height: 36px; padding: 0 10px; font-size: 13px; white-space: nowrap; }' +
      'body.hm-on #phone-zoom { display: flex; } body.hm-on #hm-swap { display: inline-flex; align-items: center; } body.hm-on.hm-docked #phone-zoom > button:not(#hm-swap) { display: none; }' +
      '#hm-dock .z3m-tabs .hm-ctl { color: #c9d1d9; }' +
      '#hm-dock .z3m { flex: 1 1 0 !important; height: auto !important; border: 0 !important; border-radius: 0 !important; } #hm-dock .z3m-about { display: none; }' +
      'body.phone #hm-dock .hm-pop, body.phone #hm-dock .hm-trk, body.phone #hm-dock .hm-keysbtn { display: none; }' +
      'body.phone #hm-panel { right: 0; left: 0; bottom: 0; width: auto; height: 58vh; border-radius: 12px 12px 0 0; } body.phone #hm-panel .hm-pop { display: none; }';
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.id = 'hm-btn'; btn.type = 'button';
    btn.innerHTML = '🗺 Hack map'; btn.title = 'This hack’s world map, from its ROM, with Link on it';
    panel = document.createElement('div'); panel.id = 'hm-panel'; panel.hidden = true;
    panel.innerHTML = '<div class="hm-head"><span>Hack map</span><button type="button" class="hm-pop" title="The map in a window of its own (for a stream capture)">⧉ Pop out</button><button type="button" class="hm-close" aria-label="Close">✕</button></div><div class="hm-body"><div id="hm-host" hidden></div></div>';
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.addEventListener('click', function () {
      if (frames()) { wantDock = true; place(); return; }   // (phones use the swap button instead)   // back in the tracker's place
      panel.hidden = !panel.hidden; btn.classList.toggle('on', !panel.hidden); if (!panel.hidden) window.dispatchEvent(new Event('resize'));
    });
    panel.querySelector('.hm-close').addEventListener('click', function () { panel.hidden = true; btn.classList.remove('on'); });
    panel.querySelector('.hm-pop').addEventListener('click', popOut);
    window.Z3Map.attach({ player: function () { return window.Snes9xPlayer; }, host: $('hm-host'), hackOnly: true,
      onShow: function (on) { isOn = on; if (on) wantDock = true; place(); },
      // Follow moved to the other world: the phone's tab follows (its click comes back here as a no-op)
      onWorld: function (w) {
        if (!phone() || w === 2 || !isOn || !wantDock || !mapTab()) return;
        var b = document.querySelector('#phone-tabs button[data-tab="' + (w ? 'dw' : 'lw') + '"]');
        if (b && !b.classList.contains('on')) b.click();
      } });
    // computers: Pop out and Tracker ⇄ on the map's own row (one row, no extra bar)
    [['\uD83D\uDD11 Keys', 'hm-keysbtn', function () { keysView = !keysView; place(); }, 'This hack\u2019s dungeons: map, compass, big key, small keys'], ['\u29C9 Pop out', 'hm-pop', popOut, 'The map in a window of its own (for a stream capture)'], ['Tracker \u21C4', 'hm-trk', function () { wantDock = false; place(); }, 'Back to the tracker (the \uD83D\uDDFA button brings the map back)']].forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hm-ctl ' + c[1]; b.textContent = c[0]; b.title = c[3]; b.addEventListener('click', c[2]);
      window.Z3Map.addControl(b);
    });
    // phones: the tabs and the swap button
    function phoneBits() {
      var z = $('phone-zoom'), tb = $('phone-tabs');
      if (z && !swap) {
        swap = document.createElement('button'); swap.type = 'button'; swap.id = 'hm-swap'; swap.title = 'Swap the map tabs between the hack\u2019s map and the tracker\u2019s';
        swap.addEventListener('click', function () { wantDock = !wantDock; place(); });
        z.insertBefore(swap, z.firstChild);
      }
      if (tb && !tb.dataset.hm) {
        tb.dataset.hm = '1';
        tb.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-tab]'); if (!b || !isOn) return;
          setTimeout(place, 0);
          if (!wantDock) return;
          if (b.dataset.tab === 'lw') window.Z3Map.view(0); else if (b.dataset.tab === 'dw') window.Z3Map.view(1);
          setTimeout(place, 0);
        });
      }
    }
    phoneBits();
    // the layout can change (the tracker turned on or off, a phone turned): follow it
    var lastK = '';
    setInterval(function () {
      phoneBits();
      var k = [!!frames(), phone(), curTab()].join();
      if (isOn && k !== lastK) { lastK = k; place(); }
      if (isOn && keysEl && !keysEl.hidden) keysPanel();   // keep the list live
    }, 500);
  }
  function init() { if (window.Z3Map) build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
