/*
 * tracker.js — the Worlds Collide tracker: characters, espers, checks,
 * dragons, bosses and the seed's objectives, read from the running game's
 * memory (autotracking) or ticked by hand.
 *
 *   FF6Tracker.init(el)
 *   FF6Tracker.setSession(id, label, meta)   meta: {seed, flags, hash:[4 names], objectives:[...]}
 *   FF6Tracker.ram = () => Uint8Array | null  (the app plugs the emulator in)
 *   FF6Tracker.onLink(fn)                     'manual' | 'waiting' | 'live'
 *
 * Live state comes from the game; anything you tick by hand is kept on top
 * of it (for things the game can't tell us), per seed, in this browser.
 */
(function () {
  'use strict';
  const D = window.FF6;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, manual = {}, link = 'manual';
  const linkFns = [];
  let live = null;      // last state read from RAM, or null
  let view = 'party';
  let compact = false;

  // ── state from RAM ───────────────────────────────────────────────────────
  function readRam() {
    const r = FF6Tracker.ram && FF6Tracker.ram();
    if (!r || r.length < 0x20000) return null;
    const chars = r[D.MEM.CHARACTERS] | (r[D.MEM.CHARACTERS + 1] << 8);
    const esp = r[D.MEM.ESPERS] | (r[D.MEM.ESPERS + 1] << 8) | (r[D.MEM.ESPERS + 2] << 16) | (r[D.MEM.ESPERS + 3] << 24);
    const s = {
      chars: D.CHARACTERS.map((_, i) => !!(chars & (1 << i))),
      espers: D.ESPERS.map((_, i) => !!(esp & (1 << i))),
      checks: D.CHECKS.map((c) => !!(r[c[1]] & c[2])),
      dragons: D.DRAGONS.map((c) => !!(r[c[2]] & c[3])),
      bosses: D.BOSSES.map((c) => !!(r[c[1]] & c[2])),
      counts: { checks: r[D.MEM.CHECK_COUNT], espers: r[D.MEM.ESPER_COUNT], dragons: r[D.MEM.DRAGON_COUNT], bosses: r[D.MEM.BOSS_COUNT] },
      gp: r[D.MEM.GP] | (r[D.MEM.GP + 1] << 8) | (r[D.MEM.GP + 2] << 16),
      ktOpen: !!(r[D.MEM.KT_UNLOCK[0]] & D.MEM.KT_UNLOCK[1]),
      ktSkip: !!(r[D.MEM.KT_SKIP[0]] & D.MEM.KT_SKIP[1]),
      started: false,
    };
    // Before a game is loaded (title screen, new game not begun) the RAM is
    // zero or junk: a character count over 14 or more checks than exist means
    // "not in a game yet". A started game has at least one character.
    s.started = s.chars.some(Boolean) && s.counts.checks <= D.CHECKS.length && s.counts.espers <= 27;
    return s;
  }

  // What's shown: the live state (if any) with the manual ticks on top
  function state() {
    const m = manual;
    const has = (k, i) => !!(live && live.started && live[k][i]) || !!(m[k] && m[k][i]);
    return {
      chars: D.CHARACTERS.map((_, i) => has('chars', i)),
      espers: D.ESPERS.map((_, i) => has('espers', i)),
      checks: D.CHECKS.map((_, i) => has('checks', i)),
      dragons: D.DRAGONS.map((_, i) => has('dragons', i)),
      bosses: D.BOSSES.map((_, i) => has('bosses', i)),
    };
  }
  function isLive(k, i) { return !!(live && live.started && live[k][i]); }

  // ── manual ticks ─────────────────────────────────────────────────────────
  function key() { return 'ff6wc:manual:' + sessionId; }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(k, i) {
    if (isLive(k, i)) return;             // the game says so: nothing to untick
    manual[k] = manual[k] || {};
    if (manual[k][i]) delete manual[k][i]; else manual[k][i] = 1;
    saveManual(); render();
  }

  // ── rendering ────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build() {
    root.innerHTML =
      '<div class="t-stats" id="t-stats"></div>' +
      '<div class="t-tabs" role="tablist">' +
        '<button type="button" role="tab" data-view="party">Party</button>' +
        '<button type="button" role="tab" data-view="checks">Checks</button>' +
        '<button type="button" role="tab" data-view="goals">Objectives</button>' +
      '</div>' +
      '<div class="t-view party"><div class="t-sec"><h4>Characters <span id="n-chars"></span></h4><div class="grid chars" id="g-chars"></div></div>' +
        '<div class="t-sec"><h4>Espers <span id="n-espers"></span></h4><div class="grid espers" id="g-espers"></div></div></div>' +
      '<div class="t-view checks"><div class="t-sec"><h4>Dragons <span id="n-dragons"></span></h4><div class="grid dragons" id="g-dragons"></div></div>' +
        '<div class="t-sec"><h4>Checks <span id="n-checks"></span></h4><div id="g-checks"></div></div></div>' +
      '<div class="t-view goals"><div class="t-sec" id="g-seed"></div><div class="t-sec"><h4>Objectives</h4><div id="g-goals"></div></div>' +
        '<details class="t-sec"><summary>Bosses <span id="n-bosses"></span></summary><div class="grid bosses" id="g-bosses"></div></details></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); render(); });
    // the grids (built once; render() updates classes)
    $('g-chars').innerHTML = D.CHARACTERS.map((n, i) => '<button type="button" class="cell char" data-k="chars" data-i="' + i + '" style="--c:' + D.CHAR_COLORS[i] + '" title="' + esc(n) + '"><i></i><b>' + esc(n) + '</b></button>').join('');
    $('g-espers').innerHTML = D.ESPERS.map((n, i) => '<button type="button" class="cell esper" data-k="espers" data-i="' + i + '" title="' + esc(n) + '"><b>' + esc(n) + '</b></button>').join('');
    $('g-dragons').innerHTML = D.DRAGONS.map((d, i) => '<button type="button" class="cell dragon" data-k="dragons" data-i="' + i + '" title="' + esc(d[0] + ' Dragon: ' + d[1]) + '"><b>' + esc(d[0]) + '</b><small>' + esc(d[1]) + '</small></button>').join('');
    $('g-bosses').innerHTML = D.BOSSES.map((b, i) => '<button type="button" class="cell boss" data-k="bosses" data-i="' + i + '" title="' + esc(b[0]) + '"><b>' + esc(b[0]) + '</b></button>').join('');
    const idx = {}; D.CHECKS.forEach((c, i) => { idx[c[0]] = i; });
    $('g-checks').innerHTML = D.AREAS.map((a) =>
      '<div class="area"><h5>' + esc(a[0]) + ' <span class="an" data-area="' + esc(a[0]) + '"></span></h5><div class="list">' +
      a[1].map((n) => '<button type="button" class="chk" data-k="checks" data-i="' + idx[n] + '"><i></i>' + esc(n) + '</button>').join('') + '</div></div>').join('');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) toggle(b.dataset.k, +b.dataset.i);
    });
    setView(view);
  }

  function setView(v) {
    view = v;
    root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    try { localStorage.setItem('ff6wc:view', v); } catch (e) {}
  }

  function render() {
    if (!root) return;
    const s = state();
    const count = (k) => s[k].filter(Boolean).length;
    const paint = (k) => root.querySelectorAll('[data-k="' + k + '"]').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('have', s[k][i]);
      b.classList.toggle('manual', !!(manual[k] && manual[k][i]) && !isLive(k, i));
    });
    ['chars', 'espers', 'checks', 'dragons', 'bosses'].forEach(paint);
    $('n-chars').textContent = count('chars') + '/' + D.CHARACTERS.length;
    $('n-espers').textContent = count('espers') + '/' + D.ESPERS.length;
    $('n-dragons').textContent = count('dragons') + '/8';
    $('n-checks').textContent = count('checks') + '/' + D.CHECKS.length;
    $('n-bosses').textContent = count('bosses') + '/' + D.BOSSES.length;
    const idx = {}; D.CHECKS.forEach((c, i) => { idx[c[0]] = i; });
    root.querySelectorAll('.an').forEach((el) => {
      const a = D.AREAS.find((x) => x[0] === el.dataset.area);
      const n = a[1].filter((nm) => s.checks[idx[nm]]).length;
      el.textContent = n + '/' + a[1].length;
      el.parentElement.parentElement.classList.toggle('done', n === a[1].length);
    });
    // the stats line: the game's own counters when it's running
    const lc = live && live.started ? live.counts : null;
    const stat = (ico, n, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + n + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML =
      stat('⚑', lc ? lc.checks : count('checks'), D.CHECKS.length, 'Checks done') +
      stat('👤', count('chars'), 14, 'Characters') +
      stat('✦', lc ? lc.espers : count('espers'), 27, 'Espers') +
      stat('🐉', lc ? lc.dragons : count('dragons'), 8, 'Dragons') +
      stat('☠', lc ? lc.bosses : count('bosses'), '', 'Bosses beaten') +
      (live && live.started ? '<span class="stat kt' + (live.ktOpen || live.ktSkip ? ' on' : '') + '" title="Kefka’s Tower">' + (live.ktSkip ? 'KT skip' : live.ktOpen ? 'KT open' : 'KT shut') + '</span>' : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    renderGoals();
  }

  function renderGoals() {
    const g = $('g-goals'), sd = $('g-seed');
    if (!g) return;
    const m = meta || {};
    sd.innerHTML = (m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span></div>' : '') +
      (m.hash && m.hash.length ? '<div class="seedline"><b>Hash</b> ' + esc(m.hash.join(', ')) + '</div>' : '') +
      (m.version ? '<div class="seedline fine">Worlds Collide ' + esc(m.version) + '</div>' : '');
    const list = m.objectives || [];
    if (!list.length) { g.innerHTML = '<p class="empty">' + (m.seed ? 'This seed’s log has no objectives section.' : 'Roll a seed here and its objectives show up in this list (they’re also in the game’s menu).') + '</p>'; return; }
    g.innerHTML = list.map((o) => '<div class="goal"><div class="goal-r"><span class="letter">' + esc(o.letter) + '</span> ' + esc(o.result) + '</div>' +
      '<div class="goal-c">' + o.conditions.map((c) => esc(c)).join('<br>') + (o.required ? '<br><small>' + esc(o.required) + '</small>' : '') + '</div></div>').join('');
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readRam();
    if (!s) { live = null; setLink(window.EJS_emulator ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    const sig = JSON.stringify([s.chars, s.espers, s.checks, s.dragons, s.bosses, s.counts, s.ktOpen, s.ktSkip, s.started]);
    if (sig !== last) { last = sig; render(); }
  }

  const FF6Tracker = {
    ram: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('ff6wc:view') || 'party'; } catch (e) {}
      build();
      loadManual();
      render();
      setInterval(poll, 500);
    },
    setSession(id, label, m) {
      sessionId = id || 'manual'; meta = m || {};
      loadManual(); render();
    },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
  };
  window.FF6Tracker = FF6Tracker;
})();
