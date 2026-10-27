/*
 * data.js — Final Fantasy VI: Worlds Collide tables the page needs.
 *
 * The memory addresses are WRAM offsets ($7E:xxxx → xxxx) in the SNES's 128 KB
 * work RAM, as the Snes9x core exposes it. The check, dragon and boss bits are
 * Worlds Collide's own (constants/objectives/condition_bits.py: event bits
 * live at $1E80, battle bits at $1DC9); the counters and the character and
 * esper bytes are the ones Stats Companion (FF6WCTools) reads.
 */
(function () {
  'use strict';

  const CHARACTERS = ['Terra', 'Locke', 'Cyan', 'Shadow', 'Edgar', 'Sabin', 'Celes', 'Strago', 'Relm', 'Setzer', 'Mog', 'Gau', 'Gogo', 'Umaro'];
  // Each character's colour on the tracker (roughly their sprite's palette)
  const CHAR_COLORS = ['#7ad67a', '#5fa8ff', '#6f7fd8', '#8a8a9a', '#5fd0e0', '#e0b050', '#d8d070', '#c070d0', '#f0a0c0', '#c0c0c0', '#f0f0f0', '#e08840', '#ff9050', '#a0e8f8'];
  const ESPERS = ['Ramuh', 'Ifrit', 'Shiva', 'Siren', 'Terrato', 'Shoat', 'Maduin', 'Bismark', 'Stray', 'Palidor', 'Tritoch',
    'Odin', 'Raiden', 'Bahamut', 'Alexandr', 'Crusader', 'Ragnarok', 'Kirin', 'ZoneSeek', 'Carbunkl', 'Phantom',
    'Sraphim', 'Golem', 'Unicorn', 'Fenrir', 'Starlet', 'Phoenix'];

  // [name, WRAM address, bit mask]
  const CHECKS = [['Ancient Castle', 7899, 32], ['Ancient Castle Dragon', 7843, 128], ['Baren Falls', 7815, 128], ['Burning House', 7826, 1], ['Collapsing House', 7889, 4], ["Daryl's Tomb", 7894, 4], ['Doma Siege', 7816, 1], ['Doma Dream Door', 7835, 1], ['Doma Dream Awaken', 7835, 4], ['Doma Dream Throne', 7835, 8], ["Ebot's Rock", 7859, 16], ['Esper Mountain', 7826, 32], ["Fanatic's Tower Dragon", 7844, 2], ["Fanatic's Tower Leader", 7899, 8], ["Fanatic's Tower Follower", 7831, 4], ['Figaro Castle Throne', 7808, 16], ['Figaro Castle Engine', 7832, 64], ['Floating Cont. Arrive', 7813, 4], ['Floating Cont. Beast', 7828, 2], ['Floating Cont. Escape', 7828, 32], ["Gau's Father's House", 7852, 4], ['Imperial Camp', 7814, 128], ["Kefka's Tower Cell Beast", 7828, 4], ["Kefka's Tower Dragon G", 7843, 32], ["Kefka's Tower Dragon S", 7843, 64], ['Kohlingen Cafe', 7857, 64], ['Lete River', 7882, 128], ['Lone Wolf Chase', 7879, 128], ['Lone Wolf Moogle Room', 7880, 2], ['Magitek Factory Trash', 7820, 2], ['Magitek Factory Guard', 7819, 128], ['Magitek Factory Finish', 7821, 8], ['Mobliz Attack', 7831, 128], ['Mt. Kolts', 7810, 1], ['Mt. Zozo', 7834, 4], ['Mt. Zozo Dragon', 7843, 8], ['Narshe Battle', 7816, 64], ['Narshe Dragon', 7843, 4], ['Narshe Weapon Shop', 7830, 64], ['Narshe Weapon Shop Mines', 7830, 128], ['Opera House Disruption', 7819, 8], ['Opera House Dragon', 7843, 16], ["Owzer's Mansion", 7882, 8], ['Phantom Train', 7858, 4], ['Phoenix Cave', 7834, 128], ['Phoenix Cave Dragon', 7844, 1], ['Sealed Gate', 7950, 2], ['Search The Skies', 7892, 2], ['Serpent Trench', 7818, 1], ['South Figaro Prisoner', 7811, 32], ['South Figaro Cave', 7830, 2], ['Tritoch Cliff', 7891, 64], ['Tzen Thief', 7887, 16], ["Umaro's Cave", 7823, 64], ['Veldt', 7863, 16], ['Veldt Cave', 7859, 2], ['Whelk Gate', 7846, 32], ['Zone Eater', 7834, 16], ['Zozo Tower', 7818, 4], ['Narshe Moogle Defense', 7845, 64], ['Auction 1', 7853, 16], ['Auction 2', 7853, 32]];

  // Where each check is, for the list
  const AREAS = [
    ['Narshe', ['Whelk Gate', 'Narshe Battle', 'Narshe Moogle Defense', 'Narshe Dragon', 'Narshe Weapon Shop', 'Narshe Weapon Shop Mines', 'Tritoch Cliff', 'Lone Wolf Chase', 'Lone Wolf Moogle Room']],
    ['Figaro', ['Figaro Castle Throne', 'Figaro Castle Engine', 'South Figaro Cave', 'South Figaro Prisoner', 'Mt. Kolts', 'Lete River']],
    ['Doma and the Veldt', ['Imperial Camp', 'Doma Siege', 'Doma Dream Door', 'Doma Dream Awaken', 'Doma Dream Throne', 'Phantom Train', 'Baren Falls', 'Veldt', 'Veldt Cave', 'Serpent Trench', "Gau's Father's House", 'Mobliz Attack']],
    ['Zozo and Jidoor', ['Zozo Tower', 'Mt. Zozo', 'Mt. Zozo Dragon', 'Opera House Disruption', 'Opera House Dragon', "Owzer's Mansion", 'Auction 1', 'Auction 2']],
    ['The Empire', ['Magitek Factory Trash', 'Magitek Factory Guard', 'Magitek Factory Finish', 'Sealed Gate', 'Search The Skies', 'Tzen Thief', 'Collapsing House']],
    ['Thamasa and the islands', ['Esper Mountain', 'Burning House', "Ebot's Rock", 'Floating Cont. Arrive', 'Floating Cont. Beast', 'Floating Cont. Escape', "Fanatic's Tower Follower", "Fanatic's Tower Leader", "Fanatic's Tower Dragon"]],
    ['Kohlingen and beyond', ['Kohlingen Cafe', "Daryl's Tomb", 'Phoenix Cave', 'Phoenix Cave Dragon', 'Ancient Castle', 'Ancient Castle Dragon', "Umaro's Cave", 'Zone Eater']],
    ["Kefka's Tower", ["Kefka's Tower Cell Beast", "Kefka's Tower Dragon G", "Kefka's Tower Dragon S"]],
  ];

  // [name, where, WRAM address, mask]
  const DRAGONS = [['Ice', 'Narshe', 7843, 4], ['Storm', 'Mt. Zozo', 7843, 8], ['Dirt', 'Opera House', 7843, 16], ['Gold', "Kefka's Tower", 7843, 32],
    ['Skull', "Kefka's Tower", 7843, 64], ['Blue', 'Ancient Castle', 7843, 128], ['Red', 'Phoenix Cave', 7844, 1], ['White', "Fanatic's Tower", 7844, 2]];

  const BOSSES = [['Air Force', 7641, 2], ['Atma', 7642, 16], ['AtmaWeapon', 7640, 8], ['Chadarnook', 7641, 1], ['Cranes', 7639, 32], ['Dadaluma', 7639, 8], ['Doom', 7641, 64], ['Doom Gaze', 7641, 16], ['Dullahan', 7640, 128], ['FlameEater', 7640, 4], ['GhostTrain', 7639, 4], ['Goddess', 7641, 128], ['Guardian', 7640, 2], ['Hidon', 7641, 32], ['Ifrit/Shiva', 7639, 16], ['Inferno', 7642, 32], ['Kefka (Narshe)', 7642, 128], ['Leader', 7638, 16], ['MagiMaster', 7638, 4], ['Nerapa', 7640, 16], ['Number 024', 7639, 64], ['Number 128', 7639, 128], ['Phunbaba 3', 7638, 32], ['Phunbaba 4', 7638, 64], ['Poltrgeist', 7642, 1], ['Rizopas', 7638, 2], ['SrBehemoth', 7640, 32], ['Stooges', 7641, 4], ['Tentacles', 7640, 64], ['Tritoch', 7642, 64], ['TunnelArmr', 7639, 2], ['Ultros 1', 7642, 2], ['Ultros 2', 7642, 4], ['Ultros 3', 7638, 8], ['Ultros/Chupon', 7642, 8], ['Umaro', 7640, 1], ['Vargas', 7639, 1], ['Whelk', 7638, 128], ['Wrexsoul', 7641, 8], ['Marshal', 7638, 1]];

  const MEM = {
    CHARACTERS: 0x1EDE,      // 2 bytes, bit i = character i recruited
    ESPERS: 0x1A69,          // 4 bytes, bit i = esper i found
    CHECK_COUNT: 0x1FCA, ESPER_COUNT: 0x1FC8, DRAGON_COUNT: 0x1FCE, BOSS_COUNT: 0x1FF8,
    GP: 0x1860,              // 3 bytes
    STEPS: 0x1866,           // 3 bytes
    MAP: 0x1F64,             // 2 bytes (low 9 bits)
    SAVE_COUNT: 0x1DC7,      // 2 bytes
    KT_UNLOCK: [0x1E80 + (0x094 >> 3), 1 << (0x094 & 7)],
    KT_SKIP: [0x1E80 + (0x093 >> 3), 1 << (0x093 & 7)],
    IN_WOR: [0x1E80 + (0x0a4 >> 3), 1 << (0x0a4 & 7)],
  };

  // The ROM Worlds Collide wants: Final Fantasy III (USA) v1.0, 3 MB, no copier header
  const ROM = { size: 3145728, sha256: '0f51b4fca41b7fd509e4b8f9d543151f68efa5e97b08493e4b2a0c06f5d8d5e2' };

  // Presets. Ultros League's flags are the league's standing set
  // (ultrosleague.com/info-and-rules, for Worlds Collide 1.4.0+).
  const UL = '-cg -oa 2.2.2.2.6.6.4.9.9 -ob 3.1.1.2.9.9.4.12.12.10.22.22 -oc 30.8.8.1.1.11.8 -od 59.1.1.11.31 -sc1 random -sc2 random -sc3 random -sal -eu -csrp 80 125 -fst -brl -slr 6 10 -lmprp 75 125 -lel -srr 25 35 -rnl -rnc -sdr 3 4 -das -dda -dns -sch -scis -com 98989898989898989898989898 -rec1 28 -rec2 27 -xpm 3 -mpm 5 -gpm 5 -nxppd -lsced 2 -hmced 2 -xgced 2 -ase 2 -msl 40 -sed -bbs -drloc shuffle -stloc mix -be -bnu -res -fer 0 -escr 100 -dgne -wnz -mmnu -cmd -esr 2 5 -elrt -ebr 82 -emprp 75 125 -nm1 random -rnl1 -rns1 -nm2 random -rnl2 -rns2 -nmmi -mmprp 75 125 -gp 5000 -smc 3 -sto 1 -ieor 33 -ieror 33 -ir stronger -csb 7 15 -mca -stra -saw -sisr 20 -sprp 75 125 -sdm 5 -npi -sebr -snsb -snee -snil -ccsr 20 -chrm 0 0 -cms -frw -wmhc -cor 100 -crr 100 -crvr 100 120 -crm -ari -anca -adeh -ame 1 -nmc -noshoes -u254 -nfps -fs -fe -fvd -fr -fj -fbs -fedc -fc -ond -rr -etn';
  const PRESETS = [
    { id: 'ul', name: 'Ultros League (character gating)', flags: UL,
      about: 'The Ultros League race set: 4 objectives, 3 random starting characters, Kefka’s Tower opens with enough characters and espers. Character gating: some checks need a particular character.' },
    { id: 'ul-open', name: 'Ultros League · Open world', flags: UL.replace(/^-cg\b/, '-open'),
      about: 'The same flags with character gating off: every check is open from the start.' },
    { id: 'custom', name: 'Custom flag string', flags: '',
      about: 'Paste a flag string from ff6worldscollide.com (its flag page builds one), a race, or a friend.' },
  ];

  window.FF6 = { CHARACTERS, CHAR_COLORS, ESPERS, CHECKS, AREAS, DRAGONS, BOSSES, MEM, ROM, PRESETS };
})();
