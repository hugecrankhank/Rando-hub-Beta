/*
 * tracker.js — a data-driven tracker shared by the Final Fantasy pages
 * (ffr/ff1, ff4, ff5). The game's config (window.FFGame, from its game.js)
 * says what to show and how to read it from the running game's memory:
 *
 *   sections: [{ id, title, tab, kind: 'grid' | 'list', cls, items: [
 *       { name, sub, color, read(mem) -> bool }  // read: live state from memory
 *   ]}]
 *   tabs:   [[id, label], ...]                 // phone view: one tab at a time
 *   stats(mem, state) -> [{ ico, n, of, title, cls }]
 *   started(mem) -> bool                       // memory holds a real game (not the title screen)
 *   goals: optional { render(el, mem) }        // a custom section (FE's objectives)
 *
 * mem = { wram, sram } (Uint8Array views, or null when no game is running).
 * Live state comes from the game; anything you tick by hand is kept on top
 * of it, per seed, in this browser.
 *
 *   FFTracker.init(el); FFTracker.setSession(id, label, meta); FFTracker.onLink(fn)
 *   FFTracker.mem = () => mem
 */
(function () {
  'use strict';
  const G = window.FFGame;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, manual = {}, link = 'manual';
  const linkFns = [];
  let live = null;        // { started, items: { sectionId: [bool] } }
  let lastMem = null;
  let view = (G.tabs[0] || ['party'])[0];

  function readMem() {
    const m = FFTracker.mem && FFTracker.mem();
    if (!m || !m.wram) return null;
    const items = {};
    for (const s of G.sections) items[s.id] = s.items.map((it) => { try { return !!it.read(m); } catch (e) { return false; } });
    let started = false;
    try { started = !!G.started(m); } catch (e) {}
    return { started, items };
  }
  function has(sid, i) { return !!(live && live.started && live.items[sid][i]) || !!(manual[sid] && manual[sid][i]); }
  function isLive(sid, i) { return !!(live && live.started && live.items[sid][i]); }
  function state() {
    const s = {};
    for (const sec of G.sections) s[sec.id] = sec.items.map((_, i) => has(sec.id, i));
    return s;
  }

  // ── manual ticks ─────────────────────────────────────────────────────────
  const key = () => 'ffr:' + G.id + ':manual:' + sessionId;
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(sid, i) {
    if (isLive(sid, i)) return;
    manual[sid] = manual[sid] || {};
    if (manual[sid][i]) delete manual[sid][i]; else manual[sid][i] = 1;
    saveManual(); render();
  }

  // ── rendering ────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build() {
    const tabs = G.tabs.map(([id, label]) => '<button type="button" role="tab" data-view="' + id + '">' + esc(label) + '</button>').join('');
    const views = G.tabs.map(([id]) => '<div class="t-view" data-tab="' + id + '">' +
      G.sections.filter((s) => s.tab === id).map((s) => sectionHtml(s)).join('') +
      (G.goals && G.goals.tab === id ? '<div class="t-sec" id="g-goals-wrap"><h4>' + esc(G.goals.title) + ' <span id="n-goals"></span></h4><div id="g-goals"></div></div>' : '') +
      '</div>').join('');
    root.innerHTML = '<div class="t-stats" id="t-stats"></div><div class="t-tabs" role="tablist">' + tabs + '</div>' + views +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) toggle(b.dataset.k, +b.dataset.i);
    });
    setView(view);
  }
  function sectionHtml(s) {
    const head = '<h4>' + esc(s.title) + ' <span id="n-' + s.id + '"></span></h4>';
    if (s.kind === 'list') {
      // grouped by `sub` (the area)
      const groups = [];
      s.items.forEach((it, i) => { let g = groups.find((x) => x.name === it.sub); if (!g) { g = { name: it.sub, idx: [] }; groups.push(g); } g.idx.push(i); });
      return '<div class="t-sec">' + head + groups.map((g) => '<div class="area"><h5>' + esc(g.name || '') + ' <span class="an" data-sec="' + s.id + '" data-area="' + esc(g.name || '') + '"></span></h5><div class="list">' +
        g.idx.map((i) => '<button type="button" class="chk" data-k="' + s.id + '" data-i="' + i + '"><i></i>' + esc(s.items[i].name) + '</button>').join('') + '</div></div>').join('') + '</div>';
    }
    return '<div class="t-sec">' + head + '<div class="grid ' + (s.cls || '') + '">' +
      s.items.map((it, i) => '<button type="button" class="cell ' + (s.cellCls || '') + '" data-k="' + s.id + '" data-i="' + i + '" title="' + esc(it.title || it.name) + '"' + (it.color ? ' style="--c:' + it.color + '"' : '') + '>' +
        (it.color ? '<i></i>' : '') + '<b>' + esc(it.name) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</button>').join('') + '</div></div>';
  }
  function setView(v) {
    view = v;
    root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    root.querySelectorAll('.t-view').forEach((el) => el.classList.toggle('on', el.dataset.tab === v));
    try { localStorage.setItem('ffr:' + G.id + ':view', v); } catch (e) {}
  }

  function render() {
    if (!root) return;
    const s = state();
    for (const sec of G.sections) {
      root.querySelectorAll('[data-k="' + sec.id + '"]').forEach((b) => {
        const i = +b.dataset.i;
        b.classList.toggle('have', s[sec.id][i]);
        b.classList.toggle('manual', !!(manual[sec.id] && manual[sec.id][i]) && !isLive(sec.id, i));
        if (sec.items[i].mark) { let mk = ''; try { mk = (live && live.started && lastMem) ? (sec.items[i].mark(lastMem) || '') : ''; } catch (e) {} b.classList.toggle('used', mk === 'used'); }
      });
      const n = s[sec.id].filter(Boolean).length;
      const el = $('n-' + sec.id); if (el) el.textContent = n + '/' + sec.items.length;
    }
    root.querySelectorAll('.an').forEach((el) => {
      const sec = G.sections.find((x) => x.id === el.dataset.sec);
      const idx = sec.items.map((it, i) => it.sub === el.dataset.area || (!it.sub && !el.dataset.area) ? i : -1).filter((i) => i >= 0);
      const n = idx.filter((i) => s[sec.id][i]).length;
      el.textContent = n + '/' + idx.length;
      el.parentElement.parentElement.classList.toggle('done', n === idx.length);
    });
    let stats = [];
    try { stats = G.stats(live && live.started ? lastMem : null, s) || []; } catch (e) {}
    $('t-stats').innerHTML = stats.map((st) => '<span class="stat ' + (st.cls || '') + '" title="' + esc(st.title || '') + '">' + (st.ico ? '<span class="ico">' + st.ico + '</span>' : '') + esc(st.n) + (st.of ? '<small>/' + st.of + '</small>' : '') + '</span>').join('');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    if (G.goals) { try { G.goals.render($('g-goals'), live && live.started ? lastMem : null, meta, $('n-goals')); } catch (e) { console.warn('[ffr] goals', e); } }
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    lastMem = FFTracker.mem && FFTracker.mem();
    const s = readMem();
    if (!s) { live = null; setLink(window.EJS_emulator ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    let extra = '';
    try { extra = G.signature ? G.signature(lastMem) : ''; } catch (e) {}
    const sig = JSON.stringify([s.started, s.items, extra]);
    if (sig !== last) { last = sig; render(); }
  }

  const FFTracker = {
    mem: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('ffr:' + G.id + ':view') || view; } catch (e) {}
      if (!G.tabs.some((t) => t[0] === view)) view = G.tabs[0][0];
      build(); loadManual(); render();
      setInterval(poll, 500);
    },
    setSession(id, label, m) { sessionId = id || 'manual'; meta = m || {}; loadManual(); render(); },
    setCompact(on) { root.classList.toggle('compact', !!on); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    render,
    get state() { return state(); },
    get live() { return live; },
  };
  window.FFTracker = FFTracker;
})();
