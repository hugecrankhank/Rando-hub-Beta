/*
 * credits-splash.js — the credits screen shown over the emulator before every
 * game boots, in every game page (Zelda 3, Zelda 1, GLR, Super Metroid, Mario
 * RPG, the FF games, Patched): who made Rando Hub and who play tested it.
 *
 * Drawn like a console screen: a 256 x 224 picture (the SNES's own size, pixel
 * for pixel), scaled up sharp to fit the emulator, in the Press Start 2P pixel
 * font. It runs while the emulator loads and the game waits for it, so it is
 * always seen (about 4 seconds, no skip). It is part of how the emulators
 * boot, not a setting. Rando Hub's licence (LICENSE.md, PolyForm Strict) does
 * not allow changed copies, so removing it is not allowed either.
 *
 * The emulators load this file themselves (emu/player.js, glr/emu/player.js,
 * z1r/emu/player.js): RHSplash.show(playerRoot) → Promise, resolved when it's done.
 */
(function () {
  'use strict';
  if (window.RHSplash) return;
  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^/]*$/, '') : '';

  var CREDITS = {
    title: 'RANDO HUB',
    dev: ['DEVELOPED BY', 'HANK', '@HUGE_CRANK_HANK'],
    testers: ['PLAY TESTED BY', 'HEFFIE', 'HYDEOUT', 'GUMBY'],
  };
  var SHOW_MS = 4000, FADE_MS = 450;
  var W = 256, H = 224;

  var fontP = null;
  function font() {
    if (fontP) return fontP;
    fontP = new Promise(function (res) {
      try {
        if (!window.FontFace || !document.fonts) { res(); return; }
        var f = new FontFace('RHSplashPixel', 'url(' + BASE + 'fonts/PressStart2P-Regular.ttf)');
        var t = setTimeout(res, 1200);   // never hold the game up for the font
        f.load().then(function (ff) { document.fonts.add(ff); clearTimeout(t); res(); }, function () { clearTimeout(t); res(); });
      } catch (e) { res(); }
    });
    return fontP;
  }

  // the hub's die, in pixels (white face, red and navy pips), tilted a little like the app's
  function die(g, cx, cy, s, t) {
    g.save(); g.translate(cx, cy); g.rotate(-0.21 + Math.sin(t / 500) * 0.05);
    g.fillStyle = '#c8102e'; g.fillRect(-s / 2 - 2, -s / 2 - 2, s + 4, s + 4);
    g.fillStyle = '#ffffff'; g.fillRect(-s / 2, -s / 2, s, s);
    var p = Math.round(s / 5), o = Math.round(s / 4);
    [[-o, -o, '#c8102e'], [o, -o, '#14213d'], [0, 0, '#c8102e'], [-o, o, '#14213d'], [o, o, '#c8102e']].forEach(function (q) {
      g.fillStyle = q[2]; g.fillRect(q[0] - p / 2, q[1] - p / 2, p, p);
    });
    g.restore();
  }
  function text(g, s, x, y, size, color, shadow) {
    g.font = size + 'px RHSplashPixel, ui-monospace, monospace';
    g.textAlign = 'center'; g.textBaseline = 'top';
    if (shadow) { g.fillStyle = shadow; g.fillText(s, x + 1, y + 1); }
    g.fillStyle = color; g.fillText(s, x, y);
  }
  // a sky of slow stars behind it, like an attract screen
  var stars = [];
  for (var i = 0; i < 46; i++) stars.push([Math.random() * W, Math.random() * H, 0.2 + Math.random() * 0.8]);

  function frame(g, t) {
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#05070d'); grd.addColorStop(1, '#141c33');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    stars.forEach(function (s) {
      var x = (s[0] - t * 0.006 * s[2] + W * 4) % W;
      g.fillStyle = s[2] > 0.7 ? '#a9bddf' : '#3c4a6b'; g.fillRect(Math.round(x), Math.round(s[1]), 1, 1);
    });
    // top and bottom bars, as on a title card
    g.fillStyle = '#c8102e'; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3);
    die(g, W / 2, 30, 22, t);
    text(g, CREDITS.title, W / 2, 50, 16, '#ffffff', '#c8102e');
    g.fillStyle = '#2a3552'; g.fillRect(40, 74, W - 80, 1);
    text(g, CREDITS.dev[0], W / 2, 84, 8, '#ffd166');
    text(g, CREDITS.dev[1], W / 2, 98, 8, '#ffffff', '#000');
    text(g, CREDITS.dev[2], W / 2, 110, 8, '#a9bddf');
    text(g, CREDITS.testers[0], W / 2, 132, 8, '#ffd166');
    CREDITS.testers.slice(1).forEach(function (n, i) { text(g, n, W / 2, 146 + i * 12, 8, '#ffffff', '#000'); });
    // the loading bar: fills over the time it's shown
    var k = Math.min(1, t / SHOW_MS), bx = 64, by = H - 22, bw = W - 128;
    g.fillStyle = '#2a3552'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle = '#0b0f19'; g.fillRect(bx, by, bw, 4);
    g.fillStyle = '#3fb950'; g.fillRect(bx, by, Math.round(bw * k), 4);
    if (Math.floor(t / 400) % 2 === 0) text(g, 'LOADING', W / 2, by - 12, 8, '#8b95a3');
  }

  function show(root) {
    if (!root) return Promise.resolve();
    return font().then(function () {
      return new Promise(function (resolve) {
        var wrap = document.createElement('div');
        wrap.className = 'rh-splash';
        wrap.style.cssText = 'position:absolute;inset:0;z-index:60;background:#05070d;display:flex;align-items:center;justify-content:center;transition:opacity ' + FADE_MS + 'ms ease;pointer-events:auto;';
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', 'Rando Hub. Developed by Hank, @huge_crank_hank. Play tested by Heffie, HydeOut and Gumby.');
        cv.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;image-rendering:crisp-edges;';
        wrap.appendChild(cv); root.appendChild(wrap);
        var g = cv.getContext('2d'), t0 = performance.now(), done = false;
        g.imageSmoothingEnabled = false;
        (function tick(now) {
          if (done) return;
          var t = now - t0;
          frame(g, t);
          if (t >= SHOW_MS) {
            done = true;
            wrap.style.opacity = '0';
            setTimeout(function () { wrap.remove(); }, FADE_MS + 50);
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        })(t0);
        // a hidden tab doesn't run animation frames: still let the game start on time
        setTimeout(function () { if (!done) { done = true; wrap.remove(); resolve(); } }, SHOW_MS + 4000);
      });
    });
  }
  window.RHSplash = { show: show, credits: CREDITS };
})();
