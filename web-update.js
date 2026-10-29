/*
 * "Check for updates" in the header of the web version, on computers.
 *
 * The Windows app has its own button (desktop/src/preload.js); this is the
 * same idea for the site: ask the server for index.html afresh and compare
 * its version to the one running. A newer one: the button says so and a
 * click reloads (the service worker is network-first, so the reload gets
 * every new file). Checked once a few seconds after loading and every hour,
 * and whenever the button is clicked.
 *
 * The game pages (Zelda 1, GLR, the FF games, FF6, Patched) load it too, with
 * data-hub="../" (or "../../"): they ask for the hub's index.html, and their
 * own <meta name="version"> (tools/set-version.py stamps it) is what's running.
 *
 * Phones and tablets don't get the button: the home-screen app there picks
 * up a new version when it's closed fully and opened again (the start
 * screen says so, below Resume).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function coarse() { try { return window.matchMedia('(any-pointer: coarse)').matches; } catch (e) { return false; } }
  function inApp() { return /Electron/i.test(navigator.userAgent) || !!$('rh-update'); }
  var HUB = (document.currentScript && document.currentScript.dataset.hub) || '';
  var current = (document.querySelector('meta[name="version"]') || {}).content || '';
  var btn = null, latest = '', timer = null;

  function newer(a, b) {   // a newer than b?
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
    return false;
  }
  function show(cls, text, title) {
    if (!btn) return;
    btn.className = (HUB ? 'btn ' : '') + (cls || '');   // game pages: their own button look
    btn.lastChild.textContent = text;
    btn.title = title || '';
  }
  function idle() {
    if (latest && newer(latest, current)) show('available', 'Update v' + latest, 'Version ' + latest + ' is out (you have v' + current + '). Click to reload and update.');
    else show('', 'Check for updates', 'Version ' + current + '. Click to check for a newer version.');
  }
  function check(byClick) {
    if (byClick && latest && newer(latest, current)) { reload(); return; }
    show('checking', 'Checking…', 'Asking the server for the newest version');
    fetch(HUB + 'index.html', { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); })
      .then(function (html) {
        var m = /<meta name="version" content="([^"]+)"/.exec(html);
        latest = m ? m[1] : '';
        if (latest && newer(latest, current)) {
          idle();
          if (byClick && confirm('Version ' + latest + ' is out (you have v' + current + '). Reload now to update?' +
            (window.EJS_emulator ? '\n\nThe game will close. Save first if you want to keep where you are.' : ''))) reload();
        } else if (byClick) {
          show('current', 'Up to date', 'v' + current + ' is the newest version.');
          clearTimeout(timer); timer = setTimeout(idle, 4000);
        } else idle();
      })
      .catch(function (e) {
        if (!byClick) { idle(); return; }
        show('error', 'Couldn’t check', 'Couldn’t reach the server: ' + (e && e.message || e));
        clearTimeout(timer); timer = setTimeout(idle, 4000);
      });
  }
  function reload() {
    var p = Promise.resolve();
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      p = navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }).catch(function () {});
    }
    p.then(function () { location.reload(); });
  }

  function build() {
    if (btn || coarse() || inApp()) return;
    if (!current) return;   // a page set-version.py hasn't stamped: nothing to compare with
    var header = document.querySelector('header'), anchor = $('link-status');
    if (!header) return;
    var style = document.createElement('style');
    style.textContent =
      '#web-update { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font: inherit; font-size: 13px; }' +
      '#web-update .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dim, #8b95a3); display: inline-block; }' +
      '#web-update.available { border-color: var(--accent, #5fbf6f) !important; color: var(--accent, #5fbf6f); font-weight: 600; }' +
      '#web-update.available .dot { background: var(--accent, #5fbf6f); animation: web-upd-pulse 1.6s ease-in-out infinite; }' +
      '#web-update.checking .dot { background: var(--warn, #e3b341); }' +
      '#web-update.error .dot { background: var(--bad, #e5534b); }' +
      '#web-update.current .dot { background: var(--accent, #5fbf6f); }' +
      'body.phone #web-update, body.tablet #web-update { display: none; }' +
      '@keyframes web-upd-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(95,191,111,.7); } 50% { box-shadow: 0 0 0 5px rgba(95,191,111,0); } }';
    document.head.appendChild(style);
    btn = document.createElement('button');
    btn.id = 'web-update'; btn.type = 'button';
    btn.innerHTML = '<i class="dot"></i><span></span>';
    btn.addEventListener('click', function () { check(true); });
    if (anchor && anchor.parentNode === header) anchor.after(btn); else header.appendChild(btn);
    idle();
    setTimeout(function () { check(false); }, 8000);
    setInterval(function () { if (!document.hidden) check(false); }, 3600000);
  }

  // Phones and tablets: a line under the start screen's Resume button.
  function note() {
    if (!coarse() || inApp()) return;
    var ph = $('placeholder');
    if (!ph || $('update-note')) return;
    var p = document.createElement('p');
    p.id = 'update-note';
    p.style.cssText = 'font-size:12px;color:var(--dim);max-width:420px';
    p.textContent = 'v' + current + ' · To get the latest version on a phone or tablet, close the app fully and open it again.';
    ph.appendChild(p);
  }

  function init() { build(); note(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
  window.RandoWebUpdate = { check: function () { check(true); } };
})();
