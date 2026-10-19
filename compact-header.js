/*
 * iPad header: the same compact header as the phone (phone.js) while its
 * menu is closed. Title, the quick buttons (🎲 Reroll, Sprite, ★, Music, 🎲♪),
 * the Layout menu,
 * the controller / game status as dots, and a ⚙ that opens everything else
 * (Randomizer, Load ROM, layout, tracker settings, map key...).
 *
 * On in the Tablet and Stacked layouts on a touch screen (an iPad, with or
 * without a trackpad). The phone layout has its own ⚙ (phone.js); desktops
 * keep the full header. Loaded after phone.js and reroll.js.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var on = false, gear = null;

  function touchScreen() {
    try { return window.matchMedia('(any-pointer: coarse)').matches; } catch (e) { return false; }
  }
  function wanted() {
    var b = document.body;
    return b.classList.contains('tablet') && !b.classList.contains('phone') && touchScreen();
  }

  function closeRando() {
    // the Randomizer button lives behind ⚙, so an open randomizer bar would
    // have no way to close once the menu folds away
    if (!document.body.classList.contains('rando-open')) return;
    document.body.classList.remove('rando-open');
    var t = $('r-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('unified-kara-open', '0'); } catch (e) {}
  }
  function refit() { setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30); }

  function build() {
    if (gear) return;
    gear = document.createElement('button');
    gear.id = 'hdr-gear';
    gear.type = 'button';
    gear.title = 'Settings';
    gear.setAttribute('aria-label', 'Settings');
    gear.setAttribute('aria-expanded', 'false');
    gear.innerHTML = '&#9881;';
    gear.addEventListener('click', function () {
      autoOpened = false;
      var open = document.body.classList.toggle('hdr-menu');
      gear.setAttribute('aria-expanded', String(open));
      if (!open) closeRando();
      refit();
    });
    document.querySelector('header').appendChild(gear);
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function apply() {
    var want = wanted();
    if (want === on) return;
    on = want;
    if (on) build();
    document.body.classList.toggle('hdr-compact', on);
    document.body.classList.remove('hdr-menu');
    if (gear) gear.setAttribute('aria-expanded', 'false');
    refit();
  }

  var KEEP = ['#pad-status', '#link-status', '#hdr-gear', '#reroll-btn', '#sprite-btn', '#sprite-fav-btn', '#music-btn', '#music-roll-btn', '#layout-sel'];
  var CSS = [
    '#hdr-gear { display: none; }',
    // closed: title, the quick buttons, status dots and ⚙; the rest behind ⚙
    'body.hdr-compact:not(.hdr-menu) header > :not(h1)' + KEEP.map(function (s) { return ':not(' + s + ')'; }).join('') +
      ' { display: none !important; }',
    'body.hdr-compact:not(.hdr-menu) header { flex-wrap: nowrap; }',
    'body.hdr-compact #reroll-btn { margin-left: auto; min-height: 34px; }',
    'body.hdr-compact #reroll-btn ~ #hdr-gear { margin-left: 0; }',
    'body.hdr-compact:not(.hdr-menu) #pad-status span, body.hdr-compact:not(.hdr-menu) #link-status span { display: none; }',
    'body.hdr-compact #hdr-gear { display: inline-block; margin-left: auto; min-width: 44px; min-height: 34px; font-size: 18px; }',
    // ⚙ stays put when the menu opens: pinned to the header's top right, with
    // room kept for it, so the rest of the header wraps around it
    'body.hdr-compact header { position: relative; padding-right: 72px !important; }',
    'body.hdr-compact #hdr-gear { position: absolute; right: 16px; top: max(6px, env(safe-area-inset-top)); margin: 0; z-index: 1; }',
    'body.hdr-compact.hdr-menu #hdr-gear { border-color: var(--accent); }'
  ].join('\n');

  // The Randomizer bar can open without ⚙ (first visit, a shared seed link),
  // and its button is behind ⚙: so the menu opens with it, and folds away
  // again when the bar closes (Generate & Play closes it).
  var autoOpened = false;
  function followRando() {
    if (!on) return;
    var b = document.body, rando = b.classList.contains('rando-open'), menu = b.classList.contains('hdr-menu');
    if (rando && !menu) { autoOpened = true; b.classList.add('hdr-menu'); gear.setAttribute('aria-expanded', 'true'); refit(); }
    else if (!rando && menu && autoOpened) { autoOpened = false; b.classList.remove('hdr-menu'); gear.setAttribute('aria-expanded', 'false'); refit(); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(); followRando();
    // tablet.js and phone.js switch layouts by changing the body's classes
    if (window.MutationObserver) new MutationObserver(function () { apply(); followRando(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
  window.addEventListener('resize', function (e) { if (e.isTrusted !== false) apply(); });
  window.addEventListener('orientationchange', function () { setTimeout(apply, 300); });
})();
