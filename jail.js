/*
 * Jail (crowd effect, from Kuba's OoT stream; Oct 2026): Link is locked in a
 * cell of iron bars where he stands. The bars are drawn here, over the game
 * picture (256 x 224 canvas, pixel for pixel with the console), around Link
 * and moving with him; the crowd effect itself (crowd/effects.js for Zelda 3,
 * z1r/js/crowd.js for Zelda 1) takes away walking (and dashing) while it runs.
 *
 *   RandoJail.show(true / false, secs)   the effects call this
 * Where Link is on screen:
 *   Zelda 3  $22 / $20 (x / y in the world) - camera $E2 / $E8
 *   Zelda 1  $70 / $84 (x / y on the NES screen; the picture starts 8 lines down)
 */
(function () {
  'use strict';
  var W = 256, H = 224;
  var on = false, until = 0, slam = 0, cv = null, ctx = null;

  function player() { return window.Snes9xPlayer || window.EmuPlayer || null; }
  function linkAt() {
    var P = player(), c = P && P.core, r = c && c.wram && c.wram();
    if (!r) return null;
    if (window.Snes9xPlayer && r.length >= 0x20000) {
      var x = (r[0x22] | r[0x23] << 8) - (r[0xE2] | r[0xE3] << 8), y = (r[0x20] | r[0x21] << 8) - (r[0xE8] | r[0xE9] << 8);
      return { x: x, y: y, w: 16, h: 24 };              // his position is the top of his head (OAM)
    }
    if (r.length >= 0x800) return { x: r[0x70], y: r[0x84] - 8, w: 16, h: 16 };
    return null;
  }
  function host() { return document.querySelector('.s9x'); }
  function ensureCanvas() {
    var h = host(); if (!h) return null;
    if (!cv || !cv.isConnected || cv.parentNode !== h) {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'rh-jail';
      cv.style.cssText = 'position:absolute;z-index:25;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
      h.appendChild(cv); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    }
    var P = player(), pr = P && P.fx && P.fx.pictureRect && P.fx.pictureRect();
    if (pr && pr.w > 0) { cv.style.left = pr.x + 'px'; cv.style.top = pr.y + 'px'; cv.style.width = pr.w + 'px'; cv.style.height = pr.h + 'px'; }
    return ctx;
  }
  function hide() { if (cv) { cv.remove(); cv = null; ctx = null; } }

  function cell(g, l) {
    var pad = 5, x0 = Math.round(l.x - pad), y0 = Math.round(l.y - pad - 2), w = l.w + pad * 2, h = l.h + pad * 2 + 2;
    // the bars drop in from above when the cell closes
    if (slam > 0) { y0 -= slam * 3; slam--; }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 1, y0 + h, w, 2);            // shadow
    var bar = function (x, y, ww, hh) {
      g.fillStyle = '#20232a'; g.fillRect(x, y, ww, hh);
      g.fillStyle = '#8a93a3'; g.fillRect(x + 1, y + 1, Math.max(1, ww - 2), hh - 2);
      g.fillStyle = '#d5dbe6'; g.fillRect(x + 1, y + 1, 1, hh - 2);
    };
    for (var x = x0; x <= x0 + w - 3; x += 5) bar(x, y0, 3, h);                    // uprights
    bar(x0 - 1, y0 - 1, w + 1, 4); bar(x0 - 1, y0 + h - 3, w + 1, 4);              // top and bottom rails
    bar(x0 - 1, y0 + Math.round(h / 2) - 1, w + 1, 3);                             // middle rail
    // a padlock on the front
    var lx = x0 + Math.round(w / 2) - 3, ly = y0 + Math.round(h / 2) - 1;
    g.fillStyle = '#20232a'; g.fillRect(lx, ly, 7, 7);
    g.fillStyle = '#e0b43a'; g.fillRect(lx + 1, ly + 2, 5, 4);
    g.strokeStyle = '#20232a'; g.lineWidth = 1; g.strokeRect(lx + 1.5, ly - 1.5, 4, 3);
    g.fillStyle = '#20232a'; g.fillRect(lx + 3, ly + 3, 1, 2);
  }
  function draw() {
    requestAnimationFrame(draw);
    if (!on) { if (cv) hide(); return; }
    if (until && Date.now() > until) { on = false; hide(); return; }      // never left behind
    var g = ensureCanvas(); if (!g) return;
    g.clearRect(0, 0, W, H);
    var l = linkAt(); if (!l) return;
    cell(g, l);
  }
  requestAnimationFrame(draw);
  window.RandoJail = {
    show: function (v, secs) { var was = on; on = !!v; until = on && secs ? Date.now() + (secs + 5) * 1000 : 0; if (on && !was) slam = 8; if (!on) hide(); },
    get on() { return on; },
  };
})();
