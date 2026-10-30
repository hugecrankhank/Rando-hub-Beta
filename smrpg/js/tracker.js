/*
 * tracker.js — the Open World Randomizer tracker: Star Pieces, key items,
 * the party and its levels, bosses and where the seed put things, read from
 * the running game's memory (autotracking) or ticked by hand.
 *
 *   SMRPGTracker.init(el)
 *   SMRPGTracker.setSession(id, label, meta, spoiler)
 *   SMRPGTracker.ram = () => Uint8Array | null     the SNES's WRAM
 *   SMRPGTracker.bwram = () => Uint8Array | null   the SA-1's BW-RAM (the core's "SRAM")
 *   SMRPGTracker.iram = () => Uint8Array | null    the SA-1's I-RAM (core.iram())
 *   SMRPGTracker.onLink(fn)                        'manual' | 'waiting' | 'live'
 *
 * Live state comes from the game: the Star Piece count, the key items in the
 * special items list, who is in the party, levels and coins. Bosses: every
 * boss fight is its own formation pack, so when a battle with a boss pack ends
 * with the party standing, that boss is beaten; the seed's spoiler says which
 * spot it was in (the shuffle moves bosses around), so that spot is ticked.
 * Without a spoiler the boss is listed as beaten and the spot is yours to tap. The seed's spoiler (which boss sits where, which have stars,
 * where the key items are) is behind a "Reveal" switch, off by default, so
 * a stream doesn't give it away.
 */
(function () {
  'use strict';
  const D = window.SMRPG;
  const $ = (id) => document.getElementById(id);
  let root = null, sessionId = 'manual', meta = {}, spoiler = {}, manual = {}, link = 'manual';
  const linkFns = [];
  let live = null, view = 'party', compact = false, reveal = false;
  let beaten = { spots: {}, bosses: [] };   // from battles seen: spot index → 1, and the bosses' names
  let inBattle = false;

  // ── state from RAM ───────────────────────────────────────────────────────
  function readRam() {
    const r = SMRPGTracker.ram && SMRPGTracker.ram();
    const b = SMRPGTracker.bwram && SMRPGTracker.bwram();
    const ir = SMRPGTracker.iram && SMRPGTracker.iram();
    if (!r || r.length < 0x20000 || !b || b.length < 0x4000 || !ir || ir.length < 0x800) return null;
    const M = D.MEM;
    const n = Math.min(5, ir[M.IRAM_PARTY_N]), party = Array.from(ir.subarray(M.IRAM_PARTY, M.IRAM_PARTY + n));
    const chars = D.CHARACTERS.map((_, c) => {
      const o = M.SAVE + c * M.CHAR_STRIDE;
      return { level: r[o], hp: r[o + 1] | r[o + 2] << 8, maxHp: r[o + 3] | r[o + 4] << 8, in: party.includes(c) };
    });
    const special = Array.from(r.subarray(M.SPECIAL, M.SPECIAL + 15)).filter((x) => x !== 0xFF);
    const s = {
      stars: b[M.BW_STARS],
      keys: D.KEY_ITEMS.map((k) => special.includes(k[1])),
      chars,
      coins: r[M.COINS] | r[M.COINS + 1] << 8, frog: r[M.FROG] | r[M.FROG + 1] << 8,
      fp: r[M.FP], maxFp: r[M.FP + 1], area: ir[M.IRAM_AREA],
      battle: ir[M.IRAM_BATTLE] === 1, pack: r[M.PACK],
      started: false,
    };
    // Before a file is started the save block is unset (levels 0 / $FF, no one
    // in the party). A started game has Mario in the party at level 1-30.
    s.started = n >= 1 && party.every((x) => x <= 4) && chars[0].level >= 1 && chars[0].level <= 30 && s.stars <= 7 && s.maxFp > 0 && s.maxFp <= 99;
    return s;
  }
  function isLive(k, i) { return !!(live && live.started && (k === 'keys' ? live.keys[i] : k === 'chars' ? live.chars[i].in : k === 'bosses' ? !!(beaten.spots[i]) : false)); }
  function state() {
    const m = manual;
    const has = (k, i) => isLive(k, i) || !!(m[k] && m[k][i]);
    return {
      keys: D.KEY_ITEMS.map((_, i) => has('keys', i)),
      chars: D.CHARACTERS.map((_, i) => has('chars', i)),
      bosses: D.BOSS_LOCATIONS.map((_, i) => has('bosses', i)),
      stars: live && live.started ? live.stars : (m.stars | 0),
    };
  }

  // ── manual ticks ─────────────────────────────────────────────────────────
  function key() { return 'smrpg:manual:' + sessionId; }
  function bkey() { return 'smrpg:beaten:' + sessionId; }
  function loadBeaten() { try { beaten = JSON.parse(localStorage.getItem(bkey()) || 'null') || { spots: {}, bosses: [] }; } catch (e) { beaten = { spots: {}, bosses: [] }; } }
  function saveBeaten() { try { localStorage.setItem(bkey(), JSON.stringify(beaten)); } catch (e) {} }
  // a battle just ended: was it a boss, and is everyone still standing?
  function battleOver(s, pack) {
    const name = D.PACK_BOSS[pack];
    if (!name || !s.chars.some((c) => c.in && c.hp > 0)) return;
    const sp = (spoiler && spoiler['Boss Locations']) || {};
    const spots = Object.keys(sp).filter((loc) => sp[loc] && sp[loc].Boss === name);
    if (!spots.length && !Object.keys(sp).length) spots.push(name);   // no spoiler: the boss's own spot, as a guess
    let changed = false;
    spots.forEach((loc) => { const i = D.BOSS_LOCATIONS.findIndex((b) => b[0] === loc); if (i >= 0 && !beaten.spots[i]) { beaten.spots[i] = 1; changed = true; } });
    if (!beaten.bosses.includes(name)) { beaten.bosses.push(name); changed = true; }
    if (changed) { saveBeaten(); render(); }
  }
  function loadManual() { try { manual = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { manual = {}; } }
  function saveManual() { try { localStorage.setItem(key(), JSON.stringify(manual)); } catch (e) {} }
  function toggle(k, i) {
    if (isLive(k, i)) return;
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
        '<button type="button" role="tab" data-view="bosses">Bosses</button>' +
        '<button type="button" role="tab" data-view="seed">Seed</button>' +
      '</div>' +
      '<div class="t-view party"><div class="t-sec"><h4>Star Pieces <span id="n-stars"></span></h4><div class="stars" id="g-stars"></div></div>' +
        '<div class="t-sec"><h4>Party <span id="n-chars"></span></h4><div class="grid chars" id="g-chars"></div></div>' +
        '<div class="t-sec"><h4>Key items <span id="n-keys"></span></h4><div class="grid keys" id="g-keys"></div></div></div>' +
      '<div class="t-view bosses"><div class="t-sec"><h4>Bosses <span id="n-bosses"></span></h4><p class="fine">Won boss fights are ticked on their own (the game says which boss, the seed says where it sat); tap a spot to tick it by hand. With Reveal on, each spot shows who’s really there and ★ where a Star Piece is.</p><p class="fine" id="g-beaten"></p><div id="g-bosses"></div></div></div>' +
      '<div class="t-view seed"><div class="t-sec" id="g-seed"></div>' +
        '<div class="t-sec"><h4>Spoiler <label class="reveal"><input type="checkbox" id="t-reveal"> Reveal</label></h4><div id="g-spoiler"></div></div></div>' +
      '<div class="t-foot"><span id="t-link"></span><button type="button" class="linkish" id="t-clear">Clear manual ticks</button></div>';
    root.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('t-clear').addEventListener('click', () => { manual = {}; saveManual(); beaten = { spots: {}, bosses: [] }; saveBeaten(); render(); });
    $('t-reveal').addEventListener('change', () => { reveal = $('t-reveal').checked; render(); });
    $('g-stars').innerHTML = [1, 2, 3, 4, 5, 6, 7].map((n) => '<button type="button" class="star" data-star="' + n + '" title="Star Piece ' + n + '">★</button>').join('');
    $('g-chars').innerHTML = D.CHARACTERS.map((n, i) => '<button type="button" class="cell char" data-k="chars" data-i="' + i + '" style="--c:' + D.CHAR_COLORS[i] + '" title="' + esc(n) + '"><i></i><b>' + esc(n) + '</b><small class="lv"></small></button>').join('');
    $('g-keys').innerHTML = D.KEY_ITEMS.map((k, i) => '<button type="button" class="cell key" data-k="keys" data-i="' + i + '" title="' + esc(k[2]) + '"><b>' + esc(k[2]) + '</b><small class="where"></small></button>').join('');
    $('g-bosses').innerHTML = D.BOSS_LOCATIONS.map((b, i) => '<button type="button" class="chk boss" data-k="bosses" data-i="' + i + '"><i></i><span class="bn">' + esc(b[0]) + '</span><small>' + esc(b[1]) + '</small><span class="who"></span></button>').join('');
    root.addEventListener('click', (e) => {
      const st = e.target.closest('[data-star]');
      if (st) { if (!(live && live.started)) { manual.stars = (manual.stars | 0) === +st.dataset.star ? +st.dataset.star - 1 : +st.dataset.star; saveManual(); render(); } return; }
      const b = e.target.closest('[data-k]');
      if (b) toggle(b.dataset.k, +b.dataset.i);
    });
    setView(view);
  }

  function setView(v) {
    view = v;
    root.dataset.view = v;
    root.querySelectorAll('.t-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    try { localStorage.setItem('smrpg:view', v); } catch (e) {}
  }

  function render() {
    if (!root) return;
    const s = state();
    const count = (k) => s[k].filter(Boolean).length;
    const sp = spoiler || {}, bossSp = sp['Boss Locations'] || {}, itemSp = sp['Item Locations'] || {};
    const seven = /\bR7|\bR[a-z]*7/.test(meta.flags || '');
    const need = seven ? 7 : 6;
    root.querySelectorAll('[data-star]').forEach((el) => { el.classList.toggle('have', +el.dataset.star <= s.stars); el.hidden = +el.dataset.star > (seven ? 7 : 7); });
    $('n-stars').textContent = s.stars + '/' + need;
    root.querySelectorAll('[data-k="chars"]').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('have', s.chars[i]);
      b.classList.toggle('manual', !!(manual.chars && manual.chars[i]) && !isLive('chars', i));
      const lv = b.querySelector('.lv');
      const c = live && live.started ? live.chars[i] : null;
      lv.textContent = c && s.chars[i] ? 'Lv ' + c.level + ' · ' + c.hp + '/' + c.maxHp : '';
    });
    // where each key item is, from the spoiler (Reveal on)
    const whereOf = {};
    for (const loc of Object.keys(itemSp)) { const l = D.KEY_LOCATIONS.find((x) => x[0] === loc); whereOf[itemSp[loc]] = l ? l[1] + ': ' + l[2] : loc; }
    root.querySelectorAll('[data-k="keys"]').forEach((b) => {
      const i = +b.dataset.i, k = D.KEY_ITEMS[i];
      b.classList.toggle('have', s.keys[i]);
      b.classList.toggle('manual', !!(manual.keys && manual.keys[i]) && !isLive('keys', i));
      b.querySelector('.where').textContent = reveal && whereOf[k[0]] ? whereOf[k[0]] : '';
    });
    root.querySelectorAll('[data-k="bosses"]').forEach((b) => {
      const i = +b.dataset.i, loc = D.BOSS_LOCATIONS[i][0], x = bossSp[loc];
      b.classList.toggle('have', s.bosses[i]);
      b.classList.toggle('manual', !!(manual.bosses && manual.bosses[i]) && !beaten.spots[i]);
      b.querySelector('.who').textContent = reveal && x ? ((x['Star Piece'] === 'Yes' ? '★ ' : '') + (x.Boss && x.Boss !== loc ? x.Boss : x.Boss ? '' : '')) : '';
      b.classList.toggle('star', reveal && !!(x && x['Star Piece'] === 'Yes'));
    });
    $('n-chars').textContent = count('chars') + '/5';
    $('n-keys').textContent = count('keys') + '/' + D.KEY_ITEMS.length;
    $('n-bosses').textContent = count('bosses') + '/' + D.BOSS_LOCATIONS.length;
    const bl = $('g-beaten'); if (bl) bl.textContent = beaten.bosses.length ? 'Beaten (from the game): ' + beaten.bosses.join(', ') : '';
    const l = live && live.started ? live : null;
    const stat = (ico, n, of, title) => '<span class="stat" title="' + esc(title) + '"><span class="ico">' + ico + '</span>' + n + (of ? '<small>/' + of + '</small>' : '') + '</span>';
    $('t-stats').innerHTML =
      stat('★', s.stars, need, 'Star Pieces') +
      stat('🔑', count('keys'), D.KEY_ITEMS.length, 'Key items') +
      stat('👤', count('chars'), 5, 'Party') +
      stat('☠', count('bosses'), '', 'Bosses beaten (ticked by hand)') +
      (l ? stat('🪙', l.coins, '', 'Coins') + stat('🐸', l.frog, '', 'Frog Coins') : '');
    $('t-link').textContent = link === 'live' ? 'Autotracking' : link === 'waiting' ? 'Waiting for the game' : 'Tap to track by hand';
    renderSeed();
  }

  function renderSeed() {
    const sd = $('g-seed'), g = $('g-spoiler');
    if (!sd) return;
    const m = meta || {};
    sd.innerHTML = (m.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(m.seed) + '</span>' + (m.mode ? ' <small>' + esc(m.mode) + '</small>' : '') + '</div>' : '') +
      (m.fileHash ? '<div class="seedline"><b>File select</b> ' + esc(m.fileHash) + (m.character ? ' · ' + esc(m.character) : '') + '</div>' : '') +
      (m.flags ? '<div class="seedline"><b>Flags</b> <span class="selectable">' + esc(m.flags) + '</span></div>' : '') +
      (m.version ? '<div class="seedline fine">Open World Randomizer ' + esc(m.version) + (m.preset ? ' · ' + esc(m.preset) : '') + '</div>' : '');
    const sp = spoiler || {};
    if (!Object.keys(sp).length) { g.innerHTML = '<p class="empty">' + (m.seed ? 'This seed has no spoiler (a race seed).' : 'Roll a seed here and its spoiler is kept behind this switch: where the Star Pieces and key items went.') + '</p>'; return; }
    if (!reveal) { g.innerHTML = '<p class="empty">Hidden. Turn Reveal on to see where the Star Pieces, bosses and key items are.</p>'; return; }
    const bs = sp['Boss Locations'] || {}, it = sp['Item Locations'] || {};
    const stars = Object.keys(bs).filter((k) => bs[k] && bs[k]['Star Piece'] === 'Yes');
    const kname = (cls) => { const k = D.KEY_ITEMS.find((x) => x[0] === cls); return k ? k[2] : cls; };
    g.innerHTML = '<h5>Star Pieces</h5><ul>' + stars.map((k) => '<li>' + esc(k) + '</li>').join('') + '</ul>' +
      '<h5>Key items</h5><ul>' + Object.keys(it).map((loc) => { const l = D.KEY_LOCATIONS.find((x) => x[0] === loc); return '<li><b>' + esc(kname(it[loc])) + '</b> — ' + esc(l ? l[1] + ', ' + l[2] : loc) + '</li>'; }).join('') + '</ul>' +
      '<h5>Bosses</h5><ul>' + Object.keys(bs).map((loc) => '<li>' + esc(loc) + ': ' + esc(bs[loc].Boss || '—') + '</li>').join('') + '</ul>';
  }

  // ── polling the game ─────────────────────────────────────────────────────
  function setLink(v) { if (v === link) return; link = v; linkFns.forEach((f) => { try { f(v); } catch (e) {} }); }
  let last = '';
  function poll() {
    const s = readRam();
    if (!s) { live = null; setLink(window.Snes9xPlayer && Snes9xPlayer.ready ? 'waiting' : 'manual'); if (last !== 'none') { last = 'none'; render(); } return; }
    live = s;
    setLink(s.started ? 'live' : 'waiting');
    if (s.started) {
      if (!s.battle && inBattle) battleOver(s, s.pack);         // the pack stays put through the fight and after it
      inBattle = s.battle;
    } else inBattle = false;
    const sig = JSON.stringify([s.stars, s.keys, s.chars, s.coins, s.frog, s.started]);
    if (sig !== last) { last = sig; render(); }
  }

  const SMRPGTracker = {
    ram: null, bwram: null, iram: null,
    init(el) {
      root = el;
      try { view = localStorage.getItem('smrpg:view') || 'party'; } catch (e) {}
      build(); loadManual(); loadBeaten(); render();
      setInterval(poll, 500);
    },
    setSession(id, label, m, sp) {
      sessionId = id || 'manual'; meta = m || {}; spoiler = sp || {};
      reveal = false; const cb = $('t-reveal'); if (cb) cb.checked = false;
      loadManual(); loadBeaten(); render();
    },
    setCompact(on) { compact = !!on; root.classList.toggle('compact', compact); },
    onLink(fn) { linkFns.push(fn); fn(link); },
    get state() { return state(); },
    get live() { return live; },
  };
  window.SMRPGTracker = SMRPGTracker;
})();
