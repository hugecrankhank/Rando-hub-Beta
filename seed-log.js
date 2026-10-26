/*
 * seed-log.js — every seed Rando Hub starts, kept in this browser.
 *
 * The randomizer (randomizer/app.js) adds an entry when it starts a seed it
 * made or loaded: when, which game, the seed (number / id), its code, a link
 * to play it again, and the preset. Who asked for it and how comes from
 * whoever pressed Generate just before (RandoSeedLog.next): Crowd Control
 * (same settings / random preset / CHAOS, and the viewer), the 🎲 Reroll
 * button, or a roll handed over from the other game. Zelda 1's rerolls are
 * added by z1r/hub.js (and glr/hub.js) into the same list (same site, same storage).
 *
 * ⚙ Settings → Seed history shows it, with Copy link and Download (CSV).
 * The newest 500 are kept.
 *
 *   RandoSeedLog.next({ kind, by, pick, from })   who/how for the next seed
 *   RandoSeedLog.add(entry) → entry                (the randomizer)
 *   RandoSeedLog.list() / latest() / clear() / open()
 */
(function () {
  'use strict';
  var KEY = 'rhb-seed-log', MAX = 500;
  var KIND = { manual: 'Generate & Play', reroll: '\ud83c\udfb2 Reroll', same: 'Crowd Control: new seed', preset: 'Crowd Control: random preset',
    chaos: 'Crowd Control: CHAOS seed', link: 'Seed link', loaded: 'Loaded' };
  var pending = null;

  function list() { try { var l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(-MAX))); } catch (e) {} }
  function next(ctx) { pending = Object.assign({ t: Date.now() }, ctx || {}); }
  function add(e) {
    var ctx = pending && Date.now() - pending.t < 20 * 60 * 1000 ? pending : null;
    pending = null;
    var entry = Object.assign({ at: Date.now(), game: 'Zelda 3', kind: 'manual' }, e || {});
    if (ctx) {
      if (ctx.kind) entry.kind = ctx.kind;
      if (ctx.by) entry.by = String(ctx.by).slice(0, 60);
      if (ctx.pick) entry.pick = String(ctx.pick).slice(0, 200);
      if (ctx.from) entry.from = ctx.from;
    }
    var l = list(); l.push(entry); save(l);
    try { window.dispatchEvent(new CustomEvent('seedlog', { detail: entry })); } catch (err) {}
    if (dlg && !dlg.hidden) paint();
    return entry;
  }
  function kindText(e) {
    return (KIND[e.kind] || e.kind || '') + (e.from ? ' (from ' + e.from + ')' : '');
  }

  // \u2500\u2500 the dialog \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var dlg = null;
  var CSS =
    '#seedlog { position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 16px; }' +
    '#seedlog[hidden] { display: none; }' +
    '#seedlog .box { background: #161b22; color: #e6edf3; border: 1px solid #30363d; border-radius: 10px; width: min(980px, 100%); max-height: 88vh; display: flex; flex-direction: column; font: 13px/1.4 system-ui, sans-serif; }' +
    '#seedlog .hd { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #30363d; flex-wrap: wrap; }' +
    '#seedlog .hd b { font-size: 15px; margin-right: auto; }' +
    '#seedlog button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; padding: 4px 10px; cursor: pointer; font: inherit; }' +
    '#seedlog button:hover { border-color: #8b949e; } #seedlog button.danger { color: #f85149; }' +
    '#seedlog .bd { overflow: auto; padding: 4px 0; }' +
    '#seedlog table { width: 100%; border-collapse: collapse; }' +
    '#seedlog th, #seedlog td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #21262d; vertical-align: top; }' +
    '#seedlog th { position: sticky; top: 0; background: #161b22; color: #8b949e; font-weight: 600; font-size: 12px; }' +
    '#seedlog .dim { color: #8b949e; font-size: 12px; } #seedlog .by { color: #e3b341; }' +
    '#seedlog .empty { padding: 24px; text-align: center; color: #8b949e; }' +
    '@media (max-width: 700px) { #seedlog .hide-sm { display: none; } }';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build() {
    if (dlg) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement('div'); dlg.id = 'seedlog'; dlg.hidden = true;
    dlg.innerHTML = '<div class="box" role="dialog" aria-label="Seed history"><div class="hd"><b>Seed history</b>' +
      '<span class="dim" id="sl-n"></span><button type="button" id="sl-csv">Download (CSV)</button>' +
      '<button type="button" class="danger" id="sl-clear">Clear</button><button type="button" id="sl-close">\u2715</button></div>' +
      '<div class="bd" id="sl-body"></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.querySelector('#sl-close').onclick = close;
    dlg.querySelector('#sl-clear').onclick = function () { if (confirm('Clear the whole seed history?')) { save([]); paint(); } };
    dlg.querySelector('#sl-csv').onclick = download;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dlg && !dlg.hidden) close(); });
  }
  function paint() {
    var l = list().slice().reverse(), body = dlg.querySelector('#sl-body');
    dlg.querySelector('#sl-n').textContent = l.length ? l.length + ' seed' + (l.length === 1 ? '' : 's') : '';
    if (!l.length) { body.innerHTML = '<div class="empty">No seeds yet. Every seed the hub starts shows up here.</div>'; return; }
    body.innerHTML = '<table><thead><tr><th>When</th><th>Game</th><th>Seed</th><th class="hide-sm">Code</th><th>How</th><th></th></tr></thead><tbody>' +
      l.map(function (e, i) {
        var d = new Date(e.at);
        return '<tr><td>' + esc(d.toLocaleDateString([], { month: 'short', day: 'numeric' })) + '<div class="dim">' + esc(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</div></td>' +
          '<td>' + esc(e.game) + '</td>' +
          '<td>' + esc(e.what || e.name) + (e.race ? ' <span class="dim">(race)</span>' : '') +
            (e.generator ? '<div class="dim">' + esc(e.generator) + (e.preset ? ' \u00b7 ' + esc(e.preset) : '') + '</div>' : e.preset ? '<div class="dim">' + esc(e.preset) + '</div>' : '') +
            (e.pick ? '<div class="dim">' + esc(e.pick) + '</div>' : '') + '</td>' +
          '<td class="hide-sm">' + esc(e.code || '') + '</td>' +
          '<td>' + esc(kindText(e)) + (e.by ? '<div class="by">' + esc(e.by) + '</div>' : '') + '</td>' +
          '<td>' + (e.link ? '<button type="button" data-copy="' + (l.length - 1 - i) + '">Copy link</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    body.querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () {
        var e = list()[+b.dataset.copy]; if (!e || !e.link) return;
        var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(e.link).then(done, function () { prompt('Seed link:', e.link); });
        else prompt('Seed link:', e.link);
      };
    });
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv() {
    var rows = [['When', 'Game', 'Seed', 'Generator', 'Preset', 'Picked', 'Code', 'How', 'Who', 'Race', 'Link', 'File']];
    list().forEach(function (e) {
      rows.push([new Date(e.at).toLocaleString(), e.game, e.what || '', e.generator || '', e.preset || '', e.pick || '', e.code || '',
        kindText(e), e.by || '', e.race ? 'yes' : '', e.link || '', e.name || '']);
    });
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function download() {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' }));
    a.download = 'rando-hub-seeds-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function open() { build(); paint(); dlg.hidden = false; }
  function close() { if (dlg) dlg.hidden = true; }

  window.RandoSeedLog = {
    next: next, add: add, list: list, latest: function () { var l = list(); return l[l.length - 1] || null; },
    clear: function () { save([]); }, open: open, csv: csv, kindText: kindText,
  };
})();
