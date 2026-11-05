/*
 * icons.js — original 16×16 pixel-art icons for Samus's gear (Metroid), drawn
 * as SVG the way ../z1r/js/icons.js draws Link's: 16 rows of 16 characters,
 * '.' transparent, every other letter a palette entry (the Zelda 1 palette).
 *
 *   M1Icons.svg(name)   name: mm, b, hj, lb, sa, va, wb, ib, tank, missile, kraid, ridley
 */
(function () {
  'use strict';
  const PAL = {
    W: '#FCFCFC', G: '#BCBCBC', D: '#7C7C7C', Y: '#F8B800', O: '#E45C10', R: '#D82800',
    B: '#0058F8', C: '#3CBCFC', N: '#AC7C00', T: '#FCD8A8', E: '#00A800', L: '#B8F818',
    P: '#F878F8', K: '#000000', V: '#6844FC', I: '#A8E4FC', M: '#F83800',
  };
  const ART = {
    // Maru Mari: Samus curled up, an orange ball with its band
    mm: [
      '................', '.....KKKKKK.....', '....KOOOOOOK....', '...KOOTTOOOOK...',
      '..KOOTTOOOOOOK..', '..KOOTOOOOOOOK..', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.',
      '.KYYYYYYYYYYYYK.', '.KOOOOOOOOOOOOK.', '..KOOOOOOOOOOK..', '..KOOOOOOOONNK..',
      '...KOOOOOONNK...', '....KNNNNNNK....', '.....KKKKKK.....', '................'],
    // Bombs: a round bomb, its fuse lit
    b: [
      '..........KK....', '.........KYYK...', '..........KK....', '.........KK.....',
      '......KKKKK.....', '.....KBBBBBK....', '....KBBCCBBBK...', '...KBBCCBBBBBK..',
      '...KBBCBBBBBBK..', '...KBBBBBBBBBK..', '...KBBBBBBBBBK..', '....KBBBBBBBK...',
      '.....KBBBBBK....', '......KKKKK.....', '................', '................'],
    // High Jump: the red boots
    hj: [
      '................', '....KKKK........', '....KRRRK.......', '....KRRRK.......',
      '....KRRRK.......', '....KRRRK.......', '....KRRRK.......', '....KRRRK.......',
      '....KRRRKKKK....', '....KRRRRRRRK...', '....KRRRRRRRRK..', '....KMMMMMMMMK..',
      '...KWWWWWWWWWK..', '...KDDDDDDDDDK..', '....KKKKKKKKK...', '................'],
    // Long Beam: a long shot, its glow
    lb: [
      '................', '................', '................', '................',
      '......YY........', '.....YYYY.......', '.KYYYYYYYYYYYYK.', 'KYYWWWWWWWWWWYYK',
      'KYYWWWWWWWWWWYYK', '.KYYYYYYYYYYYYK.', '.....YYYY.......', '......YY........',
      '................', '................', '................', '................'],
    // Screw Attack: the spinning green shield
    sa: [
      '.......LL.......', '......LLLL......', '..L...LEEL...L..', '..LL.LEEEEL.LL..',
      '...LLEEEEEELL...', '....LEEEEEEL....', '..LLEEEEEEEELL..', 'LLLEEEEWWEEEELLL',
      'LLLEEEEWWEEEELLL', '..LLEEEEEEEELL..', '....LEEEEEEL....', '...LLEEEEEELL...',
      '..LL.LEEEEL.LL..', '..L...LEEL...L..', '......LLLL......', '.......LL.......'],
    // Varia: the suit's shoulders (the orange ring)
    va: [
      '................', '.....KKKKKK.....', '...KKOOOOOOKK...', '..KOOTTOOOOOOK..',
      '.KOOTOOKKKKOOOK.', '.KOOOOK....KOOK.', '.KOOOK......KOOK', '.KOOOK......KOOK',
      '.KOOOK......KOOK', '.KOOOOK....KOOK.', '.KOOOOOKKKKOOOK.', '..KOOOOOOOOONK..',
      '...KKOOOOONNKK..', '.....KKKKKK.....', '................', '................'],
    // Wave Beam: the purple wave
    wb: [
      '................', '................', '................', '.VV.........VV..',
      'VPPV.......VPPV.', 'VPPVV.....VVPPV.', 'VPPPV.....VPPPV.', '.VPPV.....VPPV..',
      '.VPPVV...VVPPV..', '..VPPV...VPPV...', '..VPPVVVVVPPV...', '...VPPPPPPPV....',
      '....VVPPPVV.....', '......VVV.......', '................', '................'],
    // Ice Beam: a snowflake
    ib: [
      '.......CC.......', '...I...CC...I...', '..II..ICCI..II..', '...II.ICCI.II...',
      '....IIICCIII....', '.....CICCIC.....', '.CCCCCCIICCCCCC.', 'CCCIIIIWWIIIICCC',
      'CCCIIIIWWIIIICCC', '.CCCCCCIICCCCCC.', '.....CICCIC.....', '....IIICCIII....',
      '...II.ICCI.II...', '..II..ICCI..II..', '...I...CC...I...', '.......CC.......'],
    // Energy Tank
    tank: [
      '................', '....KKKKKKKK....', '...KOOOOOOOOK...', '..KOOOOOOOOOOK..',
      '..KOOWWWWWWOOK..', '..KOOWWOOOOOOK..', '..KOOWWOOOOOOK..', '..KOOWWWWWOOOK..',
      '..KOOWWOOOOOOK..', '..KOOWWOOOOOOK..', '..KOOWWWWWWOOK..', '..KOOOOOOOOOOK..',
      '...KOOOOOOOOK...', '....KKKKKKKK....', '................', '................'],
    // Missile
    missile: [
      '.......KK.......', '......KRRK......', '......KRRK......', '.....KRRRRK.....',
      '.....KRRRRK.....', '.....KGGGGK.....', '.....KGGGGK.....', '.....KGGGGK.....',
      '.....KGGGGK.....', '.....KGGGGK.....', '.....KGGGGK.....', '...KKKGGGGKKK...',
      '...KRRKGGKRRK...', '...KRRKKKKRRK...', '...KKK.YY.KKK...', '.......YY.......'],
    // Kraid: the green bulk, three spikes
    kraid: [
      '................', '....EE..EE..EE..', '...EEE.EEE.EEE..', '..EEEEEEEEEEEE..',
      '..EEEEEEEEEEEE..', '.EEEKKEEEEKKEEE.', '.EEEKWEEEEKWEEE.', '.EEEEEEEEEEEEEE.',
      '.EEEEEEEEEEEEEE.', '.EEYYYYYYYYYYEE.', '.EEEEEEEEEEEEEE.', '..EEEEEEEEEEEE..',
      '..EEEEEEEEEEEE..', '...EEE....EEE...', '...EEE....EEE...', '................'],
    // Ridley: the purple dragon, its wings
    ridley: [
      '................', '.V............V.', '.VV..........VV.', '.VVV...VVV..VVV.',
      '.VVVV.VPPPV.VVV.', '..VVVVPPKPPVVV..', '...VVPPPPPPVV...', '....VPPPPPPV....',
      '.....VPPPPV.....', '....VVPPPPVV....', '...VV.VPPV.VV...', '..VV..VPPV..VV..',
      '......VPPV......', '.....VV..VV.....', '.....V....V.....', '................'],
  };
  Object.keys(ART).forEach((k) => { const a = ART[k]; if (a.length !== 16 || a.some((r) => r.length !== 16)) console.warn('[icons] bad shape:', k); });

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
  window.M1Icons = { svg, names: Object.keys(ART), PAL };
})();
