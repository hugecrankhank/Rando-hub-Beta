/*
 * game.js — Final Fantasy V: Career Day (SNES): what the tracker shows and
 * where it reads it. Seeds come from bigbridge.studio/careerday; the ROM is
 * played here on the hub's Snes9x.
 *
 * Memory (WRAM, from Career Day's own source): key items are one bit each at
 * $7E:0A4A + id/8 (bit id%8; its reward_manager.asm sets them); jobs unlocked
 * are bits at $7E:0840-$0842 (Knight is $0840 bit $80, then down the byte);
 * each reward check sets (or, for a few, clears) an event flag, listed in its
 * tables/arch_event.csv: event rewards (crystals, espers, songs, NPCs) and
 * the boss checks that hand out key items.
 */
(function () {
  'use strict';
  const KEY = [[0, 'Walse Tower Key'], [1, 'Steamship Key'], [2, "Ifrit's Fire"], [3, 'Sandworm Bait'], [4, 'Big Bridge Key'], [5, 'Hiryuu Call'], [6, 'Submarine Key'], [7, 'Anti Barrier'], [8, 'Bracelet'],
    [11, 'Pyramid Page'], [12, 'Shrine Page'], [13, 'Trench Page'], [14, 'Falls Page'], [18, 'Mirage Radar'], [21, 'Adamantite'], [22, 'Moogle Suit'], [24, 'Elder Branch'],
    [26, '1st Tablet'], [27, '2nd Tablet'], [28, '3rd Tablet'], [29, '4th Tablet']];
  const JOBS = ['Knight', 'Monk', 'Thief', 'Dragoon', 'Ninja', 'Samurai', 'Berserker', 'Hunter', 'Mystic Knight', 'White Mage', 'Black Mage', 'Time Mage', 'Summoner', 'Blue Mage', 'Red Mage', 'Trainer', 'Chemist', 'Geomancer', 'Bard', 'Dancer', 'Mimic', 'Freelancer'];
  // [name, area, WRAM address, mask, cleared-when-done]
  const EVENTS = [["Wind Crystal", "Wind Shrine", 2582, 128, false], ["Fire Crystal", "Karnak", 2639, 8, false], ["Black Choco Crystals", "Crescent Island", 2601, 1, false], ["Earth Crystal", "Flying Lonka Ruins", 2639, 64, false], ["Leviathan Esper", "Istory Falls", 2581, 64, false], ["Titan", "Karnak", 2590, 1, false], ["Carbuncle", "Exdeath's Castle", 2692, 128, true], ["Syldra", "Pirate's Cave", 2621, 128, false], ["Odin", "Bal Castle", 2649, 128, true], ["Phoenix", "Phoenix Tower", 2598, 64, false], ["Bahamut", "Hiryuu Valley", 2606, 16, false], ["Life Song", "Crescent Island", 2606, 1, false], ["Temptation Song at Lix", "Lix", 2606, 8, false], ["Love Song at Istory", "Istory Falls", 2614, 2, false], ["Requiem Song at Kelb", "Kelb", 2606, 2, false], ["Speed Song at Surgate", "Surgate Castle", 2608, 64, false], ["Magic Song at Ancient Library", "Ancient Library", 2622, 2, false], ["Power Song from Crescent Town", "Crescent Island", 2605, 128, false], ["Hero Song from Crescent Town", "Crescent Island", 2605, 64, false], ["Fork Tower, two Magics", "Fork Tower", 2642, 4, false], ["5 potions (from NPC)", "Wind Shrine", 2616, 64, false], ["8 potions (from NPC)", "Pirate's Cave", 2621, 64, false], ["Chancellor at Tycoon", "Tycoon Castle", 2585, 16, false], ["Magisa & Forza", "North Mountain", 2584, 8, false], ["CornaJar at Kelb", "Kelb", 2581, 16, false], ["Ribbon from girl in Rugor", "Rugor", 2625, 8, false], ["Shiva", "Walse", 2584, 32, false], ["Ifrit", "Ancient Library", 2694, 128, true], ["Water Crystal", "Walse", 2584, 128, false], ["Brave Blade", "Mua", 5187, 2, true], ["Tycoon Castle Cabin", "Tycoon Castle", 2580, 4, false], ["Tycoon Castle Cabin (2)", "Tycoon Castle", 2580, 8, false], ["Walse Tower Chest", "Walse", 2673, 8, true], ["Pyramid Top", "Pyramid", 2595, 1, false], ["Toad Event", "Istory Falls", 2614, 64, false], ["Aegis Shield Chest", "Mua", 2594, 8, false], ["Lone Wolf Barrel", "Carwen", 2596, 32, false], ["Lone Wolf Chest", "Bal Castle", 2581, 8, false], ["Moat Item", "Bal Castle", 2631, 1, false], ["Shop Backdoor", "Bal Castle", 2614, 128, false], ["Top of the Falls", "Istory Falls", 2630, 64, false]];
  const KUZAR = [[2680, 16], [2680, 32], [2680, 64], [2680, 128], [2681, 1], [2681, 2], [2681, 4], [2681, 8], [2681, 16], [2681, 32], [2681, 64], [2681, 128]];
  const BOSSES = [["Byblos", "Ancient Library", 2617, 4, false], ["WingRaptor", "Wind Shrine", 2616, 1, false], ["Karlabos", "Torna Canal", 2616, 4, false], ["Siren", "Ship Graveyard", 2584, 2, false], ["LiquiFlame", "Steamship", 2585, 128, false], ["Sergeant & DeathClaw", "Karnak", 2586, 2, false], ["Sandworm", "Desert of Shifting Sands", 2587, 16, false], ["AdamanTiMi", "Tycoon Meteor", 2589, 1, false], ["Sol Cannon", "Flying Lonka Ruins", 2602, 128, false], ["ArchaeAvis", "Flying Lonka Ruins", 2669, 32, true], ["Chim.Brain", "Lonka Meteor", 2590, 16, false], ["Puroboros", "Walse Meteor", 2590, 8, false], ["Crayclaw", "Catapult", 2588, 16, false], ["Gilgamesh 1", "Exdeath's Castle", 2591, 1, false], ["Gilgamesh 2", "Big Bridge", 2588, 32, false], ["Tyrasaurus", "Moogle Waterway", 2619, 16, false], ["Abductor", "Bal Castle", 2592, 2, false], ["HiryuuPlant", "Hiryuu Valley", 2592, 64, false], ["Gilgamesh 3 & Enkidou", "Zeza Fleet", 2601, 4, false], ["Atmos", "Barrier Tower", 2594, 128, false], ["Guardians", "Mua Forest", 2594, 32, false], ["Gilgamesh 4", "Exdeath's Castle", 2621, 8, false], ["Antlion", "Tule Pass", 2595, 128, false], ["Stalker", "Solitary Island", 2622, 8, false]];
  const flag = (m, a, mask, off) => { const on = !!(m.wram[a] & mask); return off ? !on : on; };
  const byArea = (list) => list.slice().sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);

  window.FFGame = {
    id: 'ff5', short: 'FF5', system: 'snes',
    name: 'FF5 Career Day',
    generator: { name: 'Career Day', url: 'https://www.bigbridge.studio/careerday/',
      steps: ['Open the site, choose your settings and your <b>Final Fantasy V</b> ROM (the Japanese SNES ROM or the RPGe English one; it tells you which it got).',
        'Generate, and download the Career Day ROM.', 'Back here: <b>Play ROM file</b> and choose that ROM. Key items, jobs and checks follow the game.'] },
    checkRom(bytes, name) {
      let b = bytes;
      if (b.length % 1024 === 512) b = b.slice(512);
      if (b.length < 0x200000) return { warn: '"' + name + '" is smaller than Final Fantasy V (' + (b.length / 1048576).toFixed(2) + ' MB).' };
      return { bytes: b };
    },
    tabs: [['items', 'Items'], ['checks', 'Checks']],
    sections: [
      { id: 'key', title: 'Key items', tab: 'items', kind: 'grid', cls: 'keys', cellCls: 'key',
        items: KEY.map((k) => ({ name: k[1], read: (m) => !!(m.wram[0x0A4A + (k[0] >> 3)] & (1 << (k[0] & 7))) })) },
      { id: 'jobs', title: 'Jobs', tab: 'items', kind: 'grid', cls: 'espers',
        items: JOBS.map((n, i) => ({ name: n, read: (m) => !!(m.wram[0x0840 + (i >> 3)] & (0x80 >> (i & 7))) })) },
      { id: 'bosses', title: 'Key item bosses', tab: 'checks', kind: 'list',
        items: byArea(BOSSES).map((b) => ({ name: b[0], sub: b[1], read: (m) => flag(m, b[2], b[3], b[4]) })) },
      { id: 'events', title: 'Event rewards', tab: 'checks', kind: 'list',
        items: byArea(EVENTS).map((e) => ({ name: e[0], sub: e[1], read: (m) => flag(m, e[2], e[3], e[4]) }))
          .concat([{ name: 'Kuzar tablet events (all 12)', sub: 'Kuzar', read: (m) => KUZAR.every((k) => !(m.wram[k[0]] & k[1])) }]) },
    ],
    stats(m, s) {
      return [
        { ico: '🗝', n: s.key.filter(Boolean).length, of: KEY.length, title: 'Key items' },
        { ico: '✦', n: s.jobs.filter(Boolean).length, of: JOBS.length, title: 'Jobs' },
        { ico: '⚑', n: s.bosses.filter(Boolean).length + s.events.filter(Boolean).length, of: BOSSES.length + EVENTS.length + 1, title: 'Checks done' },
      ];
    },
    started(m) { for (let a = 0x0840; a < 0x0843; a++) if (m.wram[a]) return true; for (let a = 0x0A4A; a < 0x0A4E; a++) if (m.wram[a]) return true; return false; },
  };
})();
