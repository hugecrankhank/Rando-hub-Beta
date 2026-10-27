/*
 * game.js — Final Fantasy IV: Free Enterprise (SNES): what the tracker shows
 * and where it reads it. Seeds come from ff4fe.com; the ROM is played here on
 * the hub's Snes9x.
 *
 * Memory (WRAM, the layout Free Enterprise 5 writes for trackers, as read by
 * Kyuuden's Rando Companion): a block at $7E:1500: key items found (18 bits
 * at +$00), key items used (+$03), bosses defeated by boss id (+$06),
 * characters found by actor id (+$10), objective task progress (one byte per
 * task, +$30) and objective group progress (+$50), key item check count
 * (+$76). The party is at $7E:1000 (5 × 64 bytes). Treasure chest bits at
 * $7E:12A0-$12DF. The seed's flags, seed and objectives are JSON the
 * generator writes into the ROM at $1FF000 (length) / $1FF004 (text; FE 5
 * points from there at a zipped copy).
 */
(function () {
  'use strict';
  const W = 0x1500;
  const bit = (m, a, i) => !!(m.wram[a + (i >> 3)] & (1 << (i & 7)));
  const KEY = ['Package', 'SandRuby', 'Legend Sword', 'Baron Key', 'TwinHarp', 'Earth Crystal', 'Magma Key', 'Tower Key', 'Hook', 'Luca Key',
    'Darkness Crystal', 'Rat Tail', 'Adamant', 'Pan', 'Spoon', 'Pink Tail', 'Crystal', 'Pass'];
  // [name, actor ids in the game's party data, colour]
  const CHARS = [['Cecil', [1, 12], '#8fb4ff'], ['Kain', [2, 13, 16], '#6f7fd8'], ['Rydia', [3, 15], '#7ad67a'], ['Tellah', [4, 8, 11], '#c0c0c0'], ['Edward', [5], '#e8d070'],
    ['Rosa', [6], '#f0a0c0'], ['Yang', [7], '#e08840'], ['Palom', [9], '#b080d8'], ['Porom', [10], '#f0f0f0'], ['Cid', [14], '#d0a060'], ['Edge', [17], '#8a8a9a'], ['FuSoYa', [18], '#a0e8f8']];
  const BOSSES = [['D.Mist', 0], ['Officer', 1], ['Octomamm', 2], ['Antlion', 3], ['Waterhag', 4], ['MomBomb', 5], ['Fabul Gauntlet', 6], ['Milon', 7], ['Milon Z.', 8], ['D.Knight', 9],
    ['Guards', 10], ['Karate', 11], ['Baigan', 12], ['Kainazzo', 13], ['Dark Elf', 14], ['Magus Sisters', 15], ['Valvalis', 16], ['Calbrena', 17], ['Golbez', 18], ['Dr. Lugae', 19],
    ['Dark Imps', 20], ['K.Eblan & Q.Eblan', 21], ['Rubicant', 22], ['EvilWall', 23], ['Asura', 24], ['Leviatan', 25], ['Odin', 26], ['Bahamut', 27], ['Elements', 28], ['CPU', 29],
    ['Pale Dim', 30], ['Wyvern', 31], ['Plague', 32], ['D.Lunars', 33], ['Ogopogo', 34]];
  const DESC = {"char_cecil": "Find Cecil", "char_kain": "Find Kain", "char_rydia": "Find Rydia", "char_tellah": "Find Tellah", "char_edward": "Find Edward", "char_rosa": "Find Rosa", "char_yang": "Find Yang", "char_palom": "Find Palom", "char_porom": "Find Porom", "char_cid": "Find Cid", "char_edge": "Find Edge", "char_fusoya": "Find FuSoYa", "boss_dmist": "Defeat D.Mist", "boss_officer": "Defeat Officer", "boss_octomamm": "Defeat Octomamm", "boss_antlion": "Defeat Antlion", "boss_waterhag": "Defeat Waterhag (boss version)", "boss_mombomb": "Defeat MomBomb", "boss_fabulgauntlet": "Defeat the Fabul Gauntlet", "boss_milon": "Defeat Milon", "boss_milonz": "Defeat Milon Z.", "boss_mirrorcecil": "Defeat D.Knight", "boss_guard": "Defeat the Guards (boss)", "boss_karate": "Defeat Karate", "boss_baigan": "Defeat Baigan", "boss_kainazzo": "Defeat Kainazzo", "boss_darkelf": "Defeat the Dark Elf (dragon form)", "boss_magus": "Defeat the Magus Sisters", "boss_valvalis": "Defeat Valvalis", "boss_calbrena": "Defeat Calbrena", "boss_golbez": "Defeat Golbez", "boss_lugae": "Defeat Dr. Lugae", "boss_darkimp": "Defeat the Dark Imps (boss)", "boss_kingqueen": "Defeat K.Eblan and Q.Eblan", "boss_rubicant": "Defeat Rubicant", "boss_evilwall": "Defeat EvilWall", "boss_asura": "Defeat Asura", "boss_leviatan": "Defeat Leviatan", "boss_odin": "Defeat Odin", "boss_bahamut": "Defeat Bahamut", "boss_elements": "Defeat Elements", "boss_cpu": "Defeat CPU", "boss_paledim": "Defeat Pale Dim", "boss_wyvern": "Defeat Wyvern", "boss_plague": "Defeat Plague", "boss_dlunar": "Defeat the D.Lunars", "boss_ogopogo": "Defeat Ogopogo", "quest_mistcave": "Defeat the boss of the Mist Cave", "quest_waterfall": "Defeat the boss of the Waterfall", "quest_antlionnest": "Complete the Antlion Nest", "quest_hobs": "Rescue the hostage on Mt. Hobs", "quest_fabul": "Defend Fabul", "quest_ordeals": "Complete Mt. Ordeals", "quest_baroninn": "Defeat the bosses of Baron Inn", "quest_baroncastle": "Liberate Baron Castle", "quest_magnes": "Complete Cave Magnes", "quest_zot": "Complete the Tower of Zot", "quest_dwarfcastle": "Defeat the bosses of Dwarf Castle", "quest_lowerbabil": "Defeat the boss of Lower Bab-il", "quest_falcon": "Launch the Falcon", "quest_sealedcave": "Complete the Sealed Cave", "quest_monsterqueen": "Defeat the queen at the Town of Monsters", "quest_monsterking": "Defeat the king at the Town of Monsters", "quest_baronbasement": "Defeat the Baron Castle basement throne", "quest_giant": "Complete the Giant of Bab-il", "quest_cavebahamut": "Complete Cave Bahamut", "quest_murasamealtar": "Conquer the vanilla Murasame altar", "quest_crystalaltar": "Conquer the vanilla Crystal Sword altar", "quest_whitealtar": "Conquer the vanilla White Spear altar", "quest_ribbonaltar": "Conquer the vanilla Ribbon room", "quest_masamunealtar": "Conquer the vanilla Masamune altar", "quest_burnmist": "Burn village Mist with the Package", "quest_curefever": "Cure the fever with the SandRuby", "quest_unlocksewer": "Unlock the sewer with the Baron Key", "quest_music": "Break the Dark Elf's spell with the TwinHarp", "quest_toroiatreasury": "Open the Toroia treasury with the Earth Crystal", "quest_magma": "Drop the Magma Key into the Agart well", "quest_supercannon": "Destroy the Super Cannon", "quest_unlocksealedcave": "Unlock the Sealed Cave", "quest_bigwhale": "Raise the Big Whale", "quest_traderat": "Trade away the Rat Tail", "quest_forge": "Have Kokkol forge Legend Sword with Adamant", "quest_wakeyang": "Wake Yang with the Pan", "quest_tradepan": "Return the Pan to Yang's wife", "quest_tradepink": "Trade away the Pink Tail", "quest_pass": "Unlock the Pass door in Toroia", "quest_kaipoinn": "Bring the Mist Village survivor to Kaipo"};
  const PLURAL = { internal_dkmatter: (n) => 'Bring ' + n + ' DkMatter' + (n > 1 ? 's' : '') + ' to Kory in Agart', internal_keyitem: (n) => 'Obtain ' + n + ' key item' + (n > 1 ? 's' : ''),
    internal_bossfight: (n) => 'Defeat ' + n + ' boss' + (n > 1 ? 'es' : ''), internal_character: (n) => 'Find ' + n + ' character' + (n > 1 ? 's' : ''),
    internal_chest: (n) => 'Open ' + n + ' chest' + (n > 1 ? 's' : ''), internal_gp: (n) => 'Bring ' + n + ' GP to Tory in Agart' };

  function partyStarted(m) { for (let s = 0; s < 5; s++) if (m.wram[0x1000 + s * 64 + 2]) return true; return false; }
  function chests(m) { let n = 0; for (let a = 0x12A0; a < 0x12E0; a++) { let b = m.wram[a]; while (b) { n += b & 1; b >>= 1; } } return n; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The seed's objectives from the ROM's metadata
  async function readMeta(rom) {
    const r = rom.length % 1024 === 512 ? rom.subarray(512) : rom;
    const len = r[0x1FF000] | (r[0x1FF001] << 8) | (r[0x1FF002] << 16) | (r[0x1FF003] << 24);
    if (!len || len > 0x100000 || 0x1FF004 + len > r.length) return null;
    let j = JSON.parse(new TextDecoder().decode(r.subarray(0x1FF004, 0x1FF004 + len)));
    if (j.metadata_addr && j.metadata_len) {
      const addr = parseInt(String(j.metadata_addr).replace(/^0x/i, ''), 16), n = parseInt(String(j.metadata_len).replace(/^0x/i, ''), 16);
      const zip = await import('../../randomizer/zip.js');
      const blob = new Blob([r.subarray(addr, addr + n)]);
      const files = await zip.listZip(blob);
      const text = await (await zip.zipEntryBlob(blob, files[0])).text();
      const inner = JSON.parse(text);
      j = Object.assign({ version: j.version }, inner);
    }
    const groups = [];
    let taskIndex = 0;
    for (const o of (j.objectives || [])) {
      if (typeof o === 'string') { groups.push({ name: '', tasks: [{ desc: DESC[o.toLowerCase()] || o, req: 1, i: taskIndex++ }] }); continue; }
      const g = { name: o.name || o.key || '', tasks: [] };
      for (const t of (o.tasks || [])) {
        if (typeof t === 'string') g.tasks.push({ desc: DESC[t.toLowerCase()] || t, req: 1, i: taskIndex++ });
        else if (t.objective != null && t.threshold != null) g.tasks.push({ desc: (PLURAL[t.objective] || ((n) => 'Do ' + t.objective + ' ' + n + ' times'))(+t.threshold), req: +t.threshold, i: taskIndex++ });
        else if (t.group != null) g.tasks.push({ desc: 'Complete ' + (t.req || '?') + ' objective' + (t.req !== '1' ? 's' : '') + ' in Objective Group ' + String(t.group).replace('objectives_', '').toUpperCase(), req: +t.req || 1, i: taskIndex++, group: String(t.group).replace('objectives_', '') });
      }
      groups.push(g);
    }
    return { version: j.version, flags: j.flags, seed: j.seed, groups };
  }

  window.FFGame = {
    id: 'ff4', short: 'FF4', system: 'snes',
    name: 'FF4 Free Enterprise',
    generator: { name: 'Free Enterprise', url: 'https://ff4fe.com/',
      steps: ['Open the site, pick a flagset (or a preset) and your <b>Final Fantasy II (USA)</b> ROM (v1.1, 1 MB; it patches in your browser).',
        'Generate, and download the randomized ROM.', 'Back here: <b>Play ROM file</b> and choose that ROM. The seed’s objectives, flags and progress show in the tracker.'] },
    checkRom(bytes, name) {
      let b = bytes;
      if (b.length % 1024 === 512) b = b.slice(512);
      if (b.length < 0x100000) return { warn: '"' + name + '" is smaller than Final Fantasy IV (' + (b.length / 1048576).toFixed(2) + ' MB).' };
      return { bytes: b };
    },
    readMeta,
    tabs: [['items', 'Items'], ['goals', 'Objectives'], ['bosses', 'Bosses']],
    sections: [
      { id: 'key', title: 'Key items', tab: 'items', kind: 'grid', cls: 'keys', cellCls: 'key',
        items: KEY.map((n, i) => ({ name: n, read: (m) => bit(m, W + 0x00, i), mark: (m) => (bit(m, W + 0x03, i) ? 'used' : '') })) },
      { id: 'chars', title: 'Characters', tab: 'items', kind: 'grid', cls: 'chars', cellCls: 'char',
        items: CHARS.map((c) => ({ name: c[0], color: c[2], read: (m) => c[1].some((id) => bit(m, W + 0x10, id)) })) },
      { id: 'bosses', title: 'Bosses', tab: 'bosses', kind: 'grid', cls: 'bosses', cellCls: 'boss',
        items: BOSSES.map((b) => ({ name: b[0], read: (m) => bit(m, W + 0x06, b[1]) })) },
    ],
    goals: { tab: 'goals', title: 'Objectives',
      render(el, m, meta, countEl) {
        const g = meta && meta.groups;
        if (!g || !g.length) { el.innerHTML = '<p class="empty">' + (meta && meta.seed ? 'This seed has no objectives.' : 'Play a Free Enterprise ROM and its objectives show up here (read from the ROM).') + '</p>'; if (countEl) countEl.textContent = ''; return; }
        let done = 0, total = 0;
        el.innerHTML = (meta.seed ? '<div class="seedline"><b>Seed</b> <span class="selectable">' + esc(meta.seed) + '</span></div>' : '') +
          (meta.flags ? '<div class="seedline fine selectable">' + esc(meta.flags) + '</div>' : '') +
          g.map((grp, gi) => '<div class="area"><h5>' + esc(grp.name || 'Objectives') + (m && g.length > 1 ? ' <span>' + m.wram[W + 0x50 + gi] + ' done</span>' : '') + '</h5>' +
            grp.tasks.map((t) => {
              const cur = m ? m.wram[W + 0x30 + t.i] : 0;
              const ok = m && cur >= t.req;
              total++; if (ok) done++;
              return '<div class="goal' + (ok ? ' done' : '') + '"><div class="goal-r">' + (ok ? '✓ ' : '') + esc(t.desc) + (t.req > 1 && m ? ' <span class="prog">(' + Math.min(cur, t.req) + '/' + t.req + ')</span>' : '') + '</div></div>';
            }).join('') + '</div>').join('');
        if (countEl) countEl.textContent = done + '/' + total;
      } },
    stats(m, s) {
      const out = [
        { ico: '🗝', n: s.key.filter(Boolean).length, of: KEY.length, title: 'Key items found' },
        { ico: '👤', n: s.chars.filter(Boolean).length, of: CHARS.length, title: 'Characters found' },
        { ico: '☠', n: s.bosses.filter(Boolean).length, of: BOSSES.length, title: 'Bosses beaten' },
      ];
      if (m) {
        out.push({ ico: '⚑', n: m.wram[W + 0x76], title: 'Key item checks done (the game’s count)' });
        out.push({ ico: '▣', n: chests(m), title: 'Chests opened' });
        if (m.wram[W + 0x1F] === 1) out.push({ n: 'Victory!', cls: 'kt on', title: 'The game is won' });
      }
      return out;
    },
    started(m) { return partyStarted(m); },
    signature(m) { let s = ''; for (let a = W + 0x30; a < W + 0x60; a++) s += m.wram[a] + ','; return s + m.wram[W + 0x76] + ',' + chests(m) + ',' + m.wram[W + 0x1F] + ',' + Array.from(m.wram.subarray(W + 3, W + 6)).join(','); },
  };
})();
