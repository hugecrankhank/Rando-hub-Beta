/*
 * give.js — handing a Super Metroid item to Samus from outside the game:
 * written straight into her work RAM (equipment $7E:09A2/09A4, beams
 * 09A6/09A8, tanks and ammo 09C2..09D6), the way the game gives each one; her
 * next save keeps it. Used when Samus (Metroid's) picks up a Super Metroid item
 * on a Metroid spot (js/link.js).
 *
 *   GIVEABLE        the DASH item types (../sm/gen/dash-core.js Item) a Metroid spot may hold
 *   give(wram, type) → true when given
 */
const T = { EnergyTank: 61143, Missile: 61147, Super: 61151, PowerBomb: 61155, Bombs: 61159, Charge: 61163, Ice: 61167, HJB: 61171, Speed: 61175, Wave: 61179, Spazer: 61183,
  SpringBall: 61187, Varia: 61191, Plasma: 61203, Grapple: 61207, Morph: 61219, Reserve: 61223, Gravity: 61195, Xray: 61199, SpaceJump: 61211, ScrewAttack: 61215 };
// [word, bit]: equipment ($09A2 equipped / $09A4 collected), beams ($09A6 / $09A8)
const EQUIP = { [T.Varia]: 0x01, [T.SpringBall]: 0x02, [T.Morph]: 0x04, [T.ScrewAttack]: 0x08, [T.Gravity]: 0x20, [T.HJB]: 0x100, [T.SpaceJump]: 0x200, [T.Bombs]: 0x1000,
  [T.Speed]: 0x2000, [T.Grapple]: 0x4000, [T.Xray]: 0x8000 };
const BEAM = { [T.Wave]: 0x01, [T.Ice]: 0x02, [T.Spazer]: 0x04, [T.Plasma]: 0x08, [T.Charge]: 0x1000 };
const NAME = { [T.EnergyTank]: 'Energy Tank', [T.Missile]: 'Missiles', [T.Super]: 'Super Missiles', [T.PowerBomb]: 'Power Bombs', [T.Bombs]: 'Bombs', [T.Charge]: 'Charge Beam',
  [T.Ice]: 'Ice Beam', [T.HJB]: 'Hi-Jump Boots', [T.Speed]: 'Speed Booster', [T.Wave]: 'Wave Beam', [T.Spazer]: 'Spazer', [T.SpringBall]: 'Spring Ball', [T.Varia]: 'Varia Suit',
  [T.Plasma]: 'Plasma Beam', [T.Grapple]: 'Grapple Beam', [T.Morph]: 'Morph Ball', [T.Reserve]: 'Reserve Tank', [T.Gravity]: 'Gravity Suit', [T.Xray]: 'X-Ray Scope',
  [T.SpaceJump]: 'Space Jump', [T.ScrewAttack]: 'Screw Attack' };

export const GIVEABLE = new Set(Object.values(T));
export const smName = (type) => NAME[type] || 'a Super Metroid item';

export function give(w, type) {
  if (!w || w.length < 0x10000 || !GIVEABLE.has(type)) return false;
  const rd = (a) => w[a] | w[a + 1] << 8, wr = (a, v) => { w[a] = v & 0xFF; w[a + 1] = (v >> 8) & 0xFF; };
  if (EQUIP[type]) { wr(0x9A4, rd(0x9A4) | EQUIP[type]); wr(0x9A2, rd(0x9A2) | EQUIP[type]); return true; }
  if (BEAM[type]) {
    const b = BEAM[type];
    wr(0x9A8, rd(0x9A8) | b);
    let eq = rd(0x9A6) | b;
    if (type === T.Spazer && (eq & 0x08)) eq &= ~0x04;   // (Spazer and Plasma don't go together: Plasma stays)
    if (type === T.Plasma) eq &= ~0x04;
    wr(0x9A6, eq); return true;
  }
  const up = (max, cur, n) => { wr(max, rd(max) + n); wr(cur, rd(cur) + n); };
  switch (type) {
    case T.EnergyTank: wr(0x9C4, Math.min(1499, rd(0x9C4) + 100)); wr(0x9C2, rd(0x9C4)); return true;
    case T.Reserve: wr(0x9D4, Math.min(400, rd(0x9D4) + 100)); if (!rd(0x9C0)) wr(0x9C0, 1); return true;   // (reserve mode: auto)
    case T.Missile: up(0x9C8, 0x9C6, 5); return true;
    case T.Super: up(0x9CC, 0x9CA, 5); return true;
    case T.PowerBomb: up(0x9D0, 0x9CE, 5); return true;
  }
  return false;
}

window.M1SMGive = { GIVEABLE, give, smName };
