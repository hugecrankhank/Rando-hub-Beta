/*
 * icons.js — original 16×16 pixel-art icons for Samus's gear in SMZ3 (Super
 * Metroid), drawn as SVG the way ../z1r/js/icons.js and ../zm/js/icons.js do:
 * 16 rows of 16 characters, '.' transparent, every other letter a palette
 * entry. (Link's items are the hub's Zelda 3 tracker's own pictures.)
 *
 *   SMIcons.svg(name)   charge, smice, wave, spazer, plasma, varia, gravity, morph, bombs, spring, screw,
 *                       hijump, space, speed, grapple, xray, etank, reserve, missile, super, pb,
 *                       kraid, phantoon, draygon, ridley
 */
(function () {
  'use strict';
  const PAL = {
    W: '#FCFCFC', G: '#BCBCBC', D: '#7C7C7C', Y: '#F8B800', O: '#E45C10', R: '#D82800',
    B: '#0058F8', C: '#3CBCFC', N: '#AC7C00', T: '#FCD8A8', E: '#00A800', L: '#B8F818',
    P: '#F878F8', K: '#000000', V: '#6844FC', I: '#A8E4FC', M: '#F83800', S: '#2050A0',
  };
  const ball = (a, b, c) => [   // a suit-coloured sphere: a highlight, b body, c shade
    '................', '.....KKKKKK.....', '....K' + b + b + b + b + b + b + 'K....', '...K' + b + a + a + b + b + b + b + b + 'K...',
    '..K' + b + a + a + b + b + b + b + b + b + b + 'K..', '..K' + b + a + b + b + b + b + b + b + b + b + 'K..', '.K' + b + b + b + b + b + b + b + b + b + b + b + b + 'K.', '.K' + b + b + b + b + b + b + b + b + b + b + b + b + 'K.',
    '.K' + b + b + b + b + b + b + b + b + b + b + b + c + 'K.', '.K' + b + b + b + b + b + b + b + b + b + b + c + c + 'K.', '..K' + b + b + b + b + b + b + b + b + c + c + 'K..', '..K' + b + b + b + b + b + b + b + c + c + c + 'K..',
    '...K' + b + b + b + b + b + c + c + c + 'K...', '....K' + c + c + c + c + c + c + 'K....', '.....KKKKKK.....', '................'];
  const beam = (a, b) => [        // a beam shot going right
    '................', '................', '................', '................',
    '......' + a + a + '........', '.....' + a + a + a + a + '.......', '.K' + a + a + a + a + a + a + a + a + a + a + a + a + 'K.', 'K' + a + a + b + b + b + b + b + b + b + b + b + b + a + a + 'K',
    'K' + a + a + b + b + b + b + b + b + b + b + b + b + a + a + 'K', '.K' + a + a + a + a + a + a + a + a + a + a + a + a + 'K.', '.....' + a + a + a + a + '.......', '......' + a + a + '........',
    '................', '................', '................', '................'];
  const ART = {
    charge: [
      '................', '................', '.......YY.......', '.....YYOOYY.....', '....YOOOOOOY....', '...YOOWWWWOOY...', '...YOWWWWWWOY...', '..YOOWWWWWWOOY..',
      '..YOOWWWWWWOOY..', '...YOWWWWWWOY...', '...YOOWWWWOOY...', '....YOOOOOOY....', '.....YYOOYY.....', '.......YY.......', '................', '................'],
    smice: [
      '.......CC.......', '...I...CC...I...', '..II..ICCI..II..', '...II.ICCI.II...', '....IIICCIII....', '.....CICCIC.....', '.CCCCCCIICCCCCC.', 'CCCIIIIWWIIIICCC',
      'CCCIIIIWWIIIICCC', '.CCCCCCIICCCCCC.', '.....CICCIC.....', '....IIICCIII....', '...II.ICCI.II...', '..II..ICCI..II..', '...I...CC...I...', '.......CC.......'],
    wave: [
      '................', '................', '................', '.VV.........VV..', 'VPPV.......VPPV.', 'VPPVV.....VVPPV.', 'VPPPV.....VPPPV.', '.VPPV.....VPPV..',
      '.VPPVV...VVPPV..', '..VPPV...VPPV...', '..VPPVVVVVPPV...', '...VPPPPPPPV....', '....VVPPPVV.....', '......VVV.......', '................', '................'],
    spazer: [
      '................', '................', '.KYYYYYYYYYYYYK.', 'KYYWWWWWWWWWWYYK', '.KYYYYYYYYYYYYK.', '................', '.KYYYYYYYYYYYYK.', 'KYYWWWWWWWWWWYYK',
      '.KYYYYYYYYYYYYK.', '................', '.KYYYYYYYYYYYYK.', 'KYYWWWWWWWWWWYYK', '.KYYYYYYYYYYYYK.', '................', '................', '................'],
    plasma: beam('E', 'L'),
    varia: ball('T', 'O', 'N'),
    gravity: ball('P', 'V', 'S'),
    morph: ball('T', 'O', 'N').map((r, y) => y === 8 ? '.KYYYYYYYYYYYYK.' : r),
    bombs: [
      '..........KK....', '.........KYYK...', '..........KK....', '.........KK.....', '......KKKKK.....', '.....KBBBBBK....', '....KBBCCBBBK...', '...KBBCCBBBBBK..',
      '...KBBCBBBBBBK..', '...KBBBBBBBBBK..', '...KBBBBBBBBBK..', '....KBBBBBBBK...', '.....KBBBBBK....', '......KKKKK.....', '................', '................'],
    spring: [
      '................', '......KKKK......', '.....KLLLLK.....', '....KLWWLLLK....', '....KLWLLLLK....', '....KLLLLLEK....', '.....KLLLEK.....', '......KKKK......',
      '....GGGGGGGG....', '........GGGG....', '....GGGGGGGG....', '....GGGG........', '....GGGGGGGG....', '........GGGG....', '....GGGGGGGG....', '................'],
    screw: [
      '.......LL.......', '......LLLL......', '..L...LEEL...L..', '..LL.LEEEEL.LL..', '...LLEEEEEELL...', '....LEEEEEEL....', '..LLEEEEEEEELL..', 'LLLEEEEWWEEEELLL',
      'LLLEEEEWWEEEELLL', '..LLEEEEEEEELL..', '....LEEEEEEL....', '...LLEEEEEELL...', '..LL.LEEEEL.LL..', '..L...LEEL...L..', '......LLLL......', '.......LL.......'],
    hijump: [
      '................', '....KKKK........', '....KRRRK.......', '....KRRRK.......', '....KRRRK.......', '....KRRRK.......', '....KRRRK.......', '....KRRRK.......',
      '....KRRRKKKK....', '....KRRRRRRRK...', '....KRRRRRRRRK..', '....KMMMMMMMMK..', '...KWWWWWWWWWK..', '...KDDDDDDDDDK..', '....KKKKKKKKK...', '................'],
    space: [
      '................', '.W..KKKK..W.....', 'WW..KEEEK.WW....', '.WW.KEEEK.WW....', '..WWKEEEKWW.....', '...WKEEEKW......', '....KEEEK.......', '....KEEEK.......',
      '....KEEEKKKK....', '....KEEEEEEEK...', '....KEEEEEEEEK..', '....KLLLLLLLLK..', '...KWWWWWWWWWK..', '...KDDDDDDDDDK..', '....KKKKKKKKK...', '................'],
    speed: [
      '................', '....KKKK........', '....KCCCK.......', '....KCCCK..YY...', '....KCCCK.YY....', '....KCCCKYYYY...', '....KCCCK..YY...', '....KCCCK.YY....',
      '....KCCCKKKK....', '....KCCCCCCCK...', '....KCCCCCCCCK..', '....KBBBBBBBBK..', '...KWWWWWWWWWK..', '...KDDDDDDDDDK..', '....KKKKKKKKK...', '................'],
    grapple: [
      '......KK........', '.....KCCK.......', '.....KCCK.......', '.....KCCK.......', '.....KCCK.......', '.....KCCK.......', '....KKCCKK......', '...KCCCCCCK.....',
      '..KCCKKKKCCK....', '..KCK....KCK....', '..KCK....KCK....', '..KCCK..KCCK....', '...KCK..KCK.....', '...KK....KK.....', '................', '................'],
    xray: [
      '................', '................', '....KKKKKKKK....', '..KKGGGGGGGGKK..', '.KGGGGKKKKGGGGK.', 'KGGGKKCCCCKKGGGK', 'KGGKCCKKKKCCKGGK', 'KGGKCKWWKKKCKGGK',
      'KGGKCKWWKKKCKGGK', 'KGGKCCKKKKCCKGGK', 'KGGGKKCCCCKKGGGK', '.KGGGGKKKKGGGGK.', '..KKGGGGGGGGKK..', '....KKKKKKKK....', '................', '................'],
    etank: [
      '................', '....KKKKKKKK....', '...KOOOOOOOOK...', '..KOOOOOOOOOOK..', '..KOOWWWWWWOOK..', '..KOOWWOOOOOOK..', '..KOOWWOOOOOOK..', '..KOOWWWWWOOOK..',
      '..KOOWWOOOOOOK..', '..KOOWWOOOOOOK..', '..KOOWWWWWWOOK..', '..KOOOOOOOOOOK..', '...KOOOOOOOOK...', '....KKKKKKKK....', '................', '................'],
    reserve: [
      '................', '....KKKKKKKK....', '...KCCCCCCCCK...', '..KCCCCCCCCCCK..', '..KCCWWWWWCCCK..', '..KCCWWCCWWCCK..', '..KCCWWCCWWCCK..', '..KCCWWWWWCCCK..',
      '..KCCWWCWWCCCK..', '..KCCWWCCWWCCK..', '..KCCWWCCWWCCK..', '..KCCCCCCCCCCK..', '...KCCCCCCCCK...', '....KKKKKKKK....', '................', '................'],
    missile: [
      '.......KK.......', '......KRRK......', '......KRRK......', '.....KRRRRK.....', '.....KRRRRK.....', '.....KGGGGK.....', '.....KGGGGK.....', '.....KGGGGK.....',
      '.....KGGGGK.....', '.....KGGGGK.....', '.....KGGGGK.....', '...KKKGGGGKKK...', '...KRRKGGKRRK...', '...KRRKKKKRRK...', '...KKK.YY.KKK...', '.......YY.......'],
    super: [
      '.......KK.......', '......KEEK......', '......KEEK......', '.....KEEEEK.....', '.....KEEEEK.....', '.....KLLLLK.....', '.....KLLLLK.....', '.....KLLLLK.....',
      '.....KLLLLK.....', '.....KLLLLK.....', '.....KLLLLK.....', '...KKKLLLLKKK...', '...KEEKLLKEEK...', '...KEEKKKKEEK...', '...KKK.YY.KKK...', '.......YY.......'],
    pb: [
      '..........KK....', '.........KYYK...', '..........KK....', '.........KK.....', '......KKKKK.....', '.....KYYYYYK....', '....KYYWWYYYK...', '...KYYWWYYYYYK..',
      '...KYYWYYYYYYK..', '...KYYYYYYYYYK..', '...KYYYYYYOOYK..', '....KYYYYOOOK...', '.....KYOOOOK....', '......KKKKK.....', '................', '................'],
    kraid: [
      '................', '....EE..EE..EE..', '...EEE.EEE.EEE..', '..EEEEEEEEEEEE..', '..EEEEEEEEEEEE..', '.EEEKKEEEEKKEEE.', '.EEEKWEEEEKWEEE.', '.EEEEEEEEEEEEEE.',
      '.EEEEEEEEEEEEEE.', '.EEYYYYYYYYYYEE.', '.EEEEEEEEEEEEEE.', '..EEEEEEEEEEEE..', '..EEEEEEEEEEEE..', '...EEE....EEE...', '...EEE....EEE...', '................'],
    phantoon: [
      '................', '.....CCCCCC.....', '...CCIIIIIICC...', '..CIIIIIIIIIIC..', '..CIIKKIIKKIIC..', '.CIIIKWIIKWIIIC.', '.CIIIIIIIIIIIIC.', '.CIIIIIIIIIIIIC.',
      '..CIIIIIIIIIIC..', '..CCIIIIIIIICC..', '...C.CIIIIC.C...', '....C..CC..C....', '...C...CC...C...', '........CC......', '.......C........', '................'],
    draygon: [
      '................', '..KK........KK..', '.KPPK......KPPK.', '.KPPPKKKKKKPPPK.', '..KPPPPPPPPPPK..', '..KPPKKPPPPKKPK.', '.KPPPKWPPPPKWPPK', '.KPPPPPPPPPPPPPK',
      '.KPPPPPPPPPPPPK.', '..KPPPPPPPPPPK..', '...KPPPPPPPPK...', '....KPPPPPPK....', '.....KPPPPK.....', '......KPPK......', '.......KK.......', '................'],
    ridley: [
      '................', '.V............V.', '.VV..........VV.', '.VVV...VVV..VVV.', '.VVVV.VPPPV.VVV.', '..VVVVPPKPPVVV..', '...VVPPPPPPVV...', '....VPPPPPPV....',
      '.....VPPPPV.....', '....VVPPPPVV....', '...VV.VPPV.VV...', '..VV..VPPV..VV..', '......VPPV......', '.....VV..VV.....', '.....V....V.....', '................'],
  };
  Object.keys(ART).forEach((k) => { const a = ART[k]; if (a.length !== 16 || a.some((r) => r.length !== 16)) console.warn('[icons] bad shape:', k, a.map((r) => r.length)); });

  const cache = new Map();
  function svg(name) {
    if (cache.has(name)) return cache.get(name);
    const art = ART[name]; if (!art) return '';
    let rects = '';
    for (let y = 0; y < 16; y++) {
      const row = art[y]; let x = 0;
      while (x < 16) {
        const c = row[x]; if (c === '.') { x++; continue; }
        let w = 1; while (x + w < 16 && row[x + w] === c) w++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + (PAL[c] || '#fff') + '"/>';
        x += w;
      }
    }
    const out = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
    cache.set(name, out);
    return out;
  }
  window.SMIcons = { svg, names: Object.keys(ART), PAL };
})();
