/*
 * Rain over A Link to the Past, like the storm on the night of the escape
 * (HydeOut, Oct 2026): streaks of rain falling at a slant, the world a little
 * darker, and now and then a soft flash of lightning. Drawn on a 256 x 224
 * canvas laid over the game picture; the rain moves with the camera ($E2 /
 * $E8) like the game's own rain overlay does. Nothing in the game changes.
 *
 * On while either asks for it:
 *   ⚙ Settings → "🌧️ Rain" (rhb-rain, off by default), next to 🌫️ Fog
 *   the crowd effect "rain" (crowd/effects.js): RandoRain.crowd(true / false)
 * Only while Link is playing (dungeon or overworld), not in menus or maps, and
 * not where the game already rains (the escape night, Misery Mire's swamp).
 */
(function () {
  'use strict';
  var KEY = 'rhb-rain';
  var setting = false, crowdOn = false;
  try { setting = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var W = 256, H = 224, T = 128;

  // A tileable 128 x 128 sheet of rain: short slanted streaks, a lighter head
  // and a fainter tail, two weights.
  function sheet(seed, n, len) {
    var cv = document.createElement('canvas'); cv.width = T; cv.height = T;
    var g = cv.getContext('2d');
    var s = seed;
    var rnd = function () { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    for (var i = 0; i < n; i++) {
      var x = Math.floor(rnd() * T), y = Math.floor(rnd() * T), l = len + Math.floor(rnd() * 4);
      for (var k = 0; k < l; k++) {
        var a = 0.25 + 0.65 * (k / l);                    // fainter at the top (the tail)
        g.fillStyle = 'rgba(200,214,255,' + a.toFixed(2) + ')';
        // one pixel left for every two down: the escape's slant
        var px = ((x - (k >> 1)) % T + T) % T, py = (y + k) % T;
        g.fillRect(px, py, 1, 1);
      }
    }
    return cv;
  }
  var near = null, far = null;

  function core() { var P = window.Snes9xPlayer; return P && P.core; }
  function host() { return document.querySelector('.s9x'); }
  var cv = null, ctx = null, fade = 0, t = 0, flash = 0, nextFlash = 600;
  function ensureCanvas() {
    var h = host(); if (!h) return null;
    if (!cv || !cv.isConnected || cv.parentNode !== h) {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'rh-rain';
      cv.style.cssText = 'position:absolute;z-index:24;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
      h.appendChild(cv); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    }
    var P = window.Snes9xPlayer, pr = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (pr && pr.w > 0) { cv.style.left = pr.x + 'px'; cv.style.top = pr.y + 'px'; cv.style.width = pr.w + 'px'; cv.style.height = pr.h + 'px'; }
    return ctx;
  }
  function hide() { if (cv) { cv.remove(); cv = null; ctx = null; } fade = 0; flash = 0; }
  function tile(g, img, ox, oy) {
    ox = ((Math.round(ox) % T) + T) % T; oy = ((Math.round(oy) % T) + T) % T;
    for (var y = -oy; y < H; y += T) for (var x = -ox; x < W; x += T) g.drawImage(img, x, y);
  }

  function draw() {
    requestAnimationFrame(draw);
    var want = setting || crowdOn;
    if (!want && !fade) { if (cv) hide(); return; }
    var c = core(), r = c && c.wram && c.wram();
    if (!r || r.length < 0x20000) { if (cv) hide(); return; }
    var mod = r[0x10];
    var indoors = mod === 0x07, playing = indoors || mod === 0x09 || mod === 0x0B;
    // the game's own rain: the escape night (Light World before Zelda is
    // rescued, $7EF3C5 < 2) and Misery Mire's swamp (area $70)
    var ownRain = !indoors && (r[0xF3C5] < 2 && r[0x8A] < 0x40 || r[0x8A] === 0x70);
    var g = ensureCanvas(); if (!g) return;
    fade = Math.max(0, Math.min(1, fade + (want && playing && !ownRain ? 0.03 : -0.05)));
    g.clearRect(0, 0, W, H);
    if (!fade) return;
    if (!near) { near = sheet(11, 70, 7); far = sheet(29, 110, 4); }
    t++;
    var camX = r[0xE2] | r[0xE3] << 8, camY = r[0xE8] | r[0xE9] << 8;
    // the storm: a darker, bluer world
    g.fillStyle = 'rgba(12,18,48,' + (0.28 * fade).toFixed(3) + ')';
    g.fillRect(0, 0, W, H);
    // the rain, the near streaks faster than the far ones
    g.globalAlpha = 0.55 * fade; tile(g, far, camX + t * 2, camY - t * 4);
    g.globalAlpha = 0.9 * fade; tile(g, near, camX + t * 3, camY - t * 6);
    g.globalAlpha = 1;
    // lightning now and then, outdoors: a soft double flash
    if (!indoors && --nextFlash <= 0) { flash = 22; nextFlash = 480 + Math.floor(Math.random() * 900); }
    if (flash > 0) {
      var f = flash > 16 ? (22 - flash) / 6 : flash > 12 ? 0.25 : flash > 8 ? 0.8 : flash / 8;
      g.fillStyle = 'rgba(235,240,255,' + (0.32 * f * fade).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      flash--;
    }
    // the hearts, items and rupees stay clear
    g.globalCompositeOperation = 'destination-out';
    var hud = g.createLinearGradient(0, 30, 0, 48); hud.addColorStop(0, 'rgba(0,0,0,1)'); hud.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hud; g.fillRect(0, 0, W, 48);
    g.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(draw);

  // ⚙ Settings: the switch, after Fog (or the Halloween decorations)
  function settings() {
    var panel = document.getElementById('trk-settings'); if (!panel || document.getElementById('rain-deco')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'Rain like the night of the escape: slanting rain, a darker world and lightning now and then. Nothing in the game changes.';
    lab.innerHTML = '🌧️ Rain <span><input type="checkbox" id="rain-deco"></span>';
    var after = document.getElementById('fog-deco') || document.getElementById('halloween-deco');
    after = after && after.closest('label');
    if (after && after.parentNode === panel) panel.insertBefore(lab, after.nextSibling); else panel.appendChild(lab);
    var cb = lab.querySelector('input'); cb.checked = setting;
    cb.addEventListener('change', function () { set(cb.checked); });
  }
  function set(v) { setting = !!v; try { localStorage.setItem(KEY, setting ? '1' : '0'); } catch (e) {} var cb = document.getElementById('rain-deco'); if (cb) cb.checked = setting; }
  function init() { settings(); var n = 0, iv = setInterval(function () { settings(); if (document.getElementById('rain-deco') || ++n > 50) clearInterval(iv); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RandoRain = { set: set, crowd: function (v) { crowdOn = !!v; }, get on() { return setting || crowdOn; } };
})();
