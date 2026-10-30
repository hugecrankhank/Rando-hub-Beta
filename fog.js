/*
 * Fog over A Link to the Past, like the mist in the Lost Woods (HydeOut's
 * idea, Oct 2026). Two veils of soft white mist, drawn on a 256 x 224 canvas
 * laid over the game picture: they drift slowly and move with the camera
 * ($E2 / $E8) at a different rate from the world, so the world scrolls under
 * them the way it does under the game's own fog. Nothing in the game changes.
 *
 * On while either asks for it:
 *   ⚙ Settings → "🌫️ Fog" (rhb-fog, off by default), next to the Halloween
 *     decorations
 *   the crowd effect "fog" (crowd/effects.js): RandoFog.crowd(true / false)
 * Only while Link is playing (dungeon or overworld), not in menus or maps,
 * and not in the Lost Woods or Skull Woods, which have their own.
 */
(function () {
  'use strict';
  var KEY = 'rhb-fog';
  var setting = false, crowdOn = false;
  try { setting = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var W = 256, H = 224, T = 256;

  // A tileable 256 x 256 mist texture: periodic value noise, a few octaves,
  // shaped into wisps and stepped into a few alpha levels for the SNES look.
  function mist(seed) {
    var rnd = function (x, y, o) { var h = (x * 374761393 + y * 668265263 + (o + seed) * 2246822519) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    var smooth = function (t) { return t * t * (3 - 2 * t); };
    function noise(x, y, cells, o) {
      var s = T / cells, gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = smooth(gx - x0), fy = smooth(gy - y0);
      var a = rnd(x0 % cells, y0 % cells, o), b = rnd((x0 + 1) % cells, y0 % cells, o), c = rnd(x0 % cells, (y0 + 1) % cells, o), d = rnd((x0 + 1) % cells, (y0 + 1) % cells, o);
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
    var cv = document.createElement('canvas'); cv.width = T; cv.height = T;
    var g = cv.getContext('2d'), img = g.createImageData(T, T);
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      var n = noise(x, y, 4, 1) * 0.5 + noise(x, y, 8, 2) * 0.25 + noise(x, y, 16, 3) * 0.15 + noise(x, y, 32, 4) * 0.1;
      var a = Math.max(0, Math.min(1, (n - 0.38) / 0.4));
      a = Math.round(a * 6) / 6;                    // a few steps, like the game's
      var i = (y * T + x) * 4;
      img.data[i] = 236; img.data[i + 1] = 240; img.data[i + 2] = 248; img.data[i + 3] = Math.round(a * 200);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  var veilA = null, veilB = null;

  function core() { var P = window.Snes9xPlayer; return P && P.core; }
  function host() { return document.querySelector('.s9x'); }
  var cv = null, ctx = null, fade = 0, t = 0;
  function ensureCanvas() {
    var h = host(); if (!h) return null;
    if (!cv || !cv.isConnected || cv.parentNode !== h) {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'rh-fog';
      cv.style.cssText = 'position:absolute;z-index:24;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
      h.appendChild(cv); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    }
    var P = window.Snes9xPlayer, pr = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (pr && pr.w > 0) { cv.style.left = pr.x + 'px'; cv.style.top = pr.y + 'px'; cv.style.width = pr.w + 'px'; cv.style.height = pr.h + 'px'; }
    return ctx;
  }
  function hide() { if (cv) { cv.remove(); cv = null; ctx = null; } fade = 0; }
  // the texture, repeated, its top-left at (ox, oy)
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
    var ownFog = !indoors && (r[0x8A] & 0x3F) === 0x00;          // Lost Woods ($00) / Skull Woods ($40)
    var g = ensureCanvas(); if (!g) return;
    fade = Math.max(0, Math.min(1, fade + (want && playing && !ownFog ? 0.02 : -0.04)));
    g.clearRect(0, 0, W, H);
    if (!fade) return;
    if (!veilA) { veilA = mist(7); veilB = mist(23); }
    t++;
    var camX = r[0xE2] | r[0xE3] << 8, camY = r[0xE8] | r[0xE9] << 8;
    g.globalAlpha = 0.75 * fade;
    tile(g, veilA, camX * 1.25 + t * 0.25, camY * 1.25 + t * 0.08);
    g.globalAlpha = 0.45 * fade;
    tile(g, veilB, camX * 0.8 - t * 0.15, camY * 0.8 + t * 0.12);
    g.globalAlpha = 1;
    // the hearts, items and rupees stay clear, as under the game's own fog
    g.globalCompositeOperation = 'destination-out';
    var hud = g.createLinearGradient(0, 30, 0, 48); hud.addColorStop(0, 'rgba(0,0,0,1)'); hud.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hud; g.fillRect(0, 0, W, 48);
    g.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(draw);

  // ⚙ Settings: the switch, after the Halloween decorations'
  function settings() {
    var panel = document.getElementById('trk-settings'); if (!panel || document.getElementById('fog-deco')) return;
    var lab = document.createElement('label'); lab.className = 'ctl';
    lab.title = 'Mist like the Lost Woods’, drifting over the whole game and moving with it. Nothing in the game changes.';
    lab.innerHTML = '🌫️ Fog <span><input type="checkbox" id="fog-deco"></span>';
    var after = document.getElementById('halloween-deco');
    after = after && after.closest('label');
    if (after && after.parentNode === panel) panel.insertBefore(lab, after.nextSibling); else panel.appendChild(lab);
    var cb = lab.querySelector('input'); cb.checked = setting;
    cb.addEventListener('change', function () { set(cb.checked); });
  }
  function set(v) { setting = !!v; try { localStorage.setItem(KEY, setting ? '1' : '0'); } catch (e) {} var cb = document.getElementById('fog-deco'); if (cb) cb.checked = setting; }
  function init() { settings(); var n = 0, iv = setInterval(function () { settings(); if (document.getElementById('fog-deco') || ++n > 50) clearInterval(iv); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RandoFog = { set: set, crowd: function (v) { crowdOn = !!v; }, get on() { return setting || crowdOn; } };
})();
