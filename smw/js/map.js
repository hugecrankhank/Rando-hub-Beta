/*
 * map.js — the Super Mario World overworld in the tracker: Dinosaur Land and
 * the six submaps, drawn from the ROM being played (owmap.js), as the game
 * shows them now: the paths and levels the events have opened so far (a new
 * game: just the start). A pin on every exit (two for a level with a secret
 * exit), the switch palaces, Bowser's front door; Mario where he is.
 *
 *   SMWMap.init(el, { onToggle(i), names })   i: 0..91 the tracker's exits, 92..95 palaces, 96 Bowser
 *   SMWMap.update({ have, liveHave })
 *   SMWMap.live(ram, rom, started)            every poll: redraws when the ROM or the events change
 *   SMWMap.redraw()
 *
 * The level spots come from the stage table (data.js, the randomizer's own
 * tile coordinates; on the submaps those are one tile right of the game's).
 * They are the same tiles the game numbers its levels by ($04:D7F2), so the
 * pins sit on the level tiles of any seed.
 */
(function () {
  'use strict';
  const D = window.SMWD, O = window.SMWOverworld;
  let viewer = null, names = null, built = null, sig = '', note = '';

  // the checks' places
  const PINS = [];
  function spot(tx, ty) {
    const half = ty >= 32 ? 1 : 0;
    if (half) tx -= 1;
    return O.place(half, tx * 16 + 8, (ty - half * 32) * 16 + 8);
  }
  let k = 0;
  D.STAGES.forEach((s) => {
    for (let e = 0; e < s[3]; e++) { const p = spot(s[7], s[8]); if (p) PINS.push({ world: p.world, x: p.x, y: p.y, i: k, boss: s[4] !== 0 }); k++; }
  });
  const PALACE_CODE = [1, 4, 3, 2];   // D.PALACES order (yellow, green, red, blue) → the stage table's palace code
  PALACE_CODE.forEach((c, p) => { const s = D.STAGES.find((r) => r[5] === c); const q = s && spot(s[7], s[8]); if (q) PINS.push({ world: q.world, x: q.x, y: q.y, i: k + p, boss: false }); });
  const BOWSER = k + 4;
  { const q = spot(0x18, 0x23); if (q) PINS.push({ world: q.world, x: q.x, y: q.y, i: BOWSER, boss: true }); }

  // short tab names (the tracker is narrow): Dinosaur Land, then the submaps
  const TABS = ['Main', 'Yoshi’s', 'Vanilla', 'Forest', 'Valley', 'Special', 'Star'];

  function picture(w) {
    if (!built) return null;
    const p = built.render(w), cv = document.createElement('canvas');
    cv.width = p.w; cv.height = p.h;
    cv.getContext('2d').putImageData(new ImageData(p.data, p.w, p.h), 0, 0);
    return cv;
  }

  const SMWMap = {
    PINS, BOWSER,
    init(host, opts) {
      opts = opts || {};
      names = opts.names || ((i) => 'Check ' + i);
      viewer = RHWorldMap.create(host, {
        key: 'smwr',
        worlds: O.WORLDS.map((w, i) => ({ name: TABS[i], width: w.w, height: w.h, picture: () => picture(i) })),
        pins: PINS,
        name: (i) => names(i),
        onToggle: opts.onToggle,
        counts: (i) => i !== BOWSER,
        empty: 'The overworld is drawn from the ROM being played: start a seed.',
      });
      return viewer;
    },
    update(s) { if (viewer) viewer.update(s); },
    redraw() { if (viewer) viewer.redraw(); },
    get note() { return note; },
    // the ROM (to draw) and the game's memory (its events, Mario)
    live(ram, rom, started) {
      if (!viewer) return;
      if (rom && rom.length % 1024 === 512) rom = rom.subarray(512);
      let s = 'none';
      if (rom && rom.length >= 0x80000) {
        const why = O.check(rom);
        if (why) s = 'bad:' + why;
        else {
          const ev = started && ram ? Array.from(ram.subarray(0x1F02, 0x1F11)) : null;
          const special = !!(started && ram && ram[0x1EEA] & 0x80);
          s = rom.length + ':' + rom[0x7FDC] + rom[0x7FDD] + rom[0x7FDE] + rom[0x7FDF] + ':' + (ev ? ev.join(',') : '-') + ':' + special;
          if (s !== sig) {
            const fresh = !built || sig.split(':')[1] !== s.split(':')[1] || sig.split(':')[0] !== s.split(':')[0];
            try { built = O.build(rom, { events: ev, special }); note = ''; } catch (e) { console.warn('[smw map]', e); built = null; note = 'The map couldn’t be drawn from this ROM.'; }
            sig = s;
            if (fresh) viewer.invalidate(); else viewer.repaint();
          }
        }
      }
      if (s === 'none' || s.startsWith('bad:')) {
        if (s !== sig) { built = null; note = s.startsWith('bad:') ? 'No map for this ROM: ' + s.slice(4) + '.' : ''; sig = s; viewer.invalidate(); }
        viewer.setPos(null);
        return;
      }
      // Mario: on the overworld ($0100 $0B–$0E), dimmed in a level
      const m = started && ram ? O.mario(ram) : null;
      if (m) m.dim = !(ram[0x100] >= 0x0B && ram[0x100] <= 0x0E);
      viewer.setPos(m);
    },
  };
  window.SMWMap = SMWMap;
})();
