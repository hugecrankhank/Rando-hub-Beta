/*
 * cpu6502.js — a small 6502 interpreter (official opcodes, no decimal mode,
 * no interrupts). GLR uses it to run the game's own room-building routines
 * against your ROM, so the map is drawn from the ROM exactly as the game
 * builds each screen, without re-implementing that code by hand.
 *
 *   const cpu = new CPU6502({ read(a), write(a, v) });
 *   cpu.call(addr, { a, x, y, maxSteps, stub: { addr: fn(cpu) } });
 */
(function (root) {
  'use strict';

  function CPU6502(bus) {
    this.bus = bus;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xFD; this.pc = 0;
    this.c = 0; this.z = 0; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
  }

  const P = CPU6502.prototype;
  P.rd = function (a) { return this.bus.read(a & 0xFFFF) & 0xFF; };
  P.wr = function (a, v) { this.bus.write(a & 0xFFFF, v & 0xFF); };
  P.push = function (v) { this.wr(0x100 | this.s, v); this.s = (this.s - 1) & 0xFF; };
  P.pop = function () { this.s = (this.s + 1) & 0xFF; return this.rd(0x100 | this.s); };
  P.getP = function () { return (this.n << 7) | (this.v << 6) | 0x20 | (this.d << 3) | (this.i << 2) | (this.z << 1) | this.c; };
  P.setP = function (p) { this.n = (p >> 7) & 1; this.v = (p >> 6) & 1; this.d = (p >> 3) & 1; this.i = (p >> 2) & 1; this.z = (p >> 1) & 1; this.c = p & 1; };
  P.nz = function (v) { v &= 0xFF; this.z = v === 0 ? 1 : 0; this.n = v >> 7; return v; };

  // Run the subroutine at addr until it returns. stub: { addr: fn(cpu) } —
  // a JSR to a stubbed address calls fn instead and returns at once.
  P.call = function (addr, o) {
    o = o || {};
    if (o.a != null) this.a = o.a & 0xFF;
    if (o.x != null) this.x = o.x & 0xFF;
    if (o.y != null) this.y = o.y & 0xFF;
    const stub = o.stub || {};
    const max = o.maxSteps || 2000000;
    // Return address sentinel: $FFFF-1 pushed, so RTS lands on $0000 marker.
    const base = this.s;
    this.push(0xFF); this.push(0xFE);   // RTS -> $FFFF
    this.pc = addr & 0xFFFF;
    for (let steps = 0; steps < max; steps++) {
      if (this.pc === 0xFFFF && this.s === base) return steps;
      this.step(stub);
    }
    throw new Error('6502 call $' + addr.toString(16) + ' did not return');
  };

  P.step = function (stub) {
    const op = this.rd(this.pc);
    const pc1 = (this.pc + 1) & 0xFFFF;
    const b1 = this.rd(pc1);
    const w = b1 | (this.rd(pc1 + 1) << 8);
    let addr = -1, len = 1;
    const mode = MODE[op];
    switch (mode) {
      case 0: len = 1; break;                                         // imp/acc
      case 1: len = 2; addr = -2; break;                              // imm
      case 2: len = 2; addr = b1; break;                              // zp
      case 3: len = 2; addr = (b1 + this.x) & 0xFF; break;            // zp,x
      case 4: len = 2; addr = (b1 + this.y) & 0xFF; break;            // zp,y
      case 5: len = 3; addr = w; break;                               // abs
      case 6: len = 3; addr = (w + this.x) & 0xFFFF; break;           // abs,x
      case 7: len = 3; addr = (w + this.y) & 0xFFFF; break;           // abs,y
      case 8: len = 2; { const z = (b1 + this.x) & 0xFF; addr = this.rd(z) | (this.rd((z + 1) & 0xFF) << 8); } break; // (zp,x)
      case 9: len = 2; addr = ((this.rd(b1) | (this.rd((b1 + 1) & 0xFF) << 8)) + this.y) & 0xFFFF; break;           // (zp),y
      case 10: len = 2; break;                                        // rel
      case 11: len = 3; addr = this.rd(w) | (this.rd((w & 0xFF00) | ((w + 1) & 0xFF)) << 8); break;                 // (abs)
      default: throw new Error('6502: illegal opcode $' + op.toString(16) + ' at $' + this.pc.toString(16));
    }
    const ld = () => (addr === -2 ? b1 : this.rd(addr));
    let next = (this.pc + len) & 0xFFFF;
    const br = (cond) => { if (cond) next = (next + ((b1 << 24) >> 24)) & 0xFFFF; };
    const cmp = (r, m) => { const t = r - m; this.c = t >= 0 ? 1 : 0; this.nz(t); };
    const adc = (m) => { const t = this.a + m + this.c; this.v = (~(this.a ^ m) & (this.a ^ t) & 0x80) ? 1 : 0; this.c = t > 0xFF ? 1 : 0; this.a = this.nz(t); };
    const rmw = (fn) => { if (mode === 0) this.a = fn(this.a); else this.wr(addr, fn(this.rd(addr))); };
    switch (OPS[op]) {
      case 'LDA': this.a = this.nz(ld()); break;
      case 'LDX': this.x = this.nz(ld()); break;
      case 'LDY': this.y = this.nz(ld()); break;
      case 'STA': this.wr(addr, this.a); break;
      case 'STX': this.wr(addr, this.x); break;
      case 'STY': this.wr(addr, this.y); break;
      case 'TAX': this.x = this.nz(this.a); break;
      case 'TAY': this.y = this.nz(this.a); break;
      case 'TXA': this.a = this.nz(this.x); break;
      case 'TYA': this.a = this.nz(this.y); break;
      case 'TSX': this.x = this.nz(this.s); break;
      case 'TXS': this.s = this.x; break;
      case 'PHA': this.push(this.a); break;
      case 'PHP': this.push(this.getP() | 0x10); break;
      case 'PLA': this.a = this.nz(this.pop()); break;
      case 'PLP': this.setP(this.pop()); break;
      case 'AND': this.a = this.nz(this.a & ld()); break;
      case 'ORA': this.a = this.nz(this.a | ld()); break;
      case 'EOR': this.a = this.nz(this.a ^ ld()); break;
      case 'ADC': adc(ld()); break;
      case 'SBC': adc(ld() ^ 0xFF); break;
      case 'CMP': cmp(this.a, ld()); break;
      case 'CPX': cmp(this.x, ld()); break;
      case 'CPY': cmp(this.y, ld()); break;
      case 'BIT': { const m = ld(); this.z = (this.a & m) ? 0 : 1; this.n = m >> 7; this.v = (m >> 6) & 1; } break;
      case 'INC': rmw((v) => this.nz(v + 1)); break;
      case 'DEC': rmw((v) => this.nz(v - 1)); break;
      case 'INX': this.x = this.nz(this.x + 1); break;
      case 'INY': this.y = this.nz(this.y + 1); break;
      case 'DEX': this.x = this.nz(this.x - 1); break;
      case 'DEY': this.y = this.nz(this.y - 1); break;
      case 'ASL': rmw((v) => { this.c = v >> 7; return this.nz(v << 1); }); break;
      case 'LSR': rmw((v) => { this.c = v & 1; return this.nz(v >> 1); }); break;
      case 'ROL': rmw((v) => { const c = this.c; this.c = v >> 7; return this.nz((v << 1) | c); }); break;
      case 'ROR': rmw((v) => { const c = this.c; this.c = v & 1; return this.nz((v >> 1) | (c << 7)); }); break;
      case 'BPL': br(!this.n); break;
      case 'BMI': br(this.n); break;
      case 'BVC': br(!this.v); break;
      case 'BVS': br(this.v); break;
      case 'BCC': br(!this.c); break;
      case 'BCS': br(this.c); break;
      case 'BNE': br(!this.z); break;
      case 'BEQ': br(this.z); break;
      case 'CLC': this.c = 0; break;
      case 'SEC': this.c = 1; break;
      case 'CLI': this.i = 0; break;
      case 'SEI': this.i = 1; break;
      case 'CLV': this.v = 0; break;
      case 'CLD': this.d = 0; break;
      case 'SED': this.d = 1; break;
      case 'NOP': break;
      case 'JMP': next = addr; break;
      case 'JSR':
        if (stub && stub[addr]) { stub[addr](this); break; }
        { const ret = (this.pc + 2) & 0xFFFF; this.push(ret >> 8); this.push(ret & 0xFF); next = addr; }
        break;
      case 'RTS': { const lo = this.pop(), hi = this.pop(); next = (((hi << 8) | lo) + 1) & 0xFFFF; } break;
      case 'RTI': { this.setP(this.pop()); const lo = this.pop(), hi = this.pop(); next = (hi << 8) | lo; } break;
      case 'BRK': throw new Error('6502: BRK at $' + this.pc.toString(16));
      default: throw new Error('6502: unhandled ' + OPS[op]);
    }
    this.pc = next;
  };

  // Opcode table: name and addressing mode.
  const OPS = new Array(256), MODE = new Array(256).fill(-1);
  const T = 'BRK0 ORA8 ORA2 ASL2 PHP0 ORA1 ASL0 ORA5 ASL5 BPL10 ORA9 ORA3 ASL3 CLC0 ORA7 ORA6 ASL6 ' +
    'JSR5 AND8 BIT2 AND2 ROL2 PLP0 AND1 ROL0 BIT5 AND5 ROL5 BMI10 AND9 AND3 ROL3 SEC0 AND7 AND6 ROL6 ' +
    'RTI0 EOR8 EOR2 LSR2 PHA0 EOR1 LSR0 JMP5 EOR5 LSR5 BVC10 EOR9 EOR3 LSR3 CLI0 EOR7 EOR6 LSR6 ' +
    'RTS0 ADC8 ADC2 ROR2 PLA0 ADC1 ROR0 JMP11 ADC5 ROR5 BVS10 ADC9 ADC3 ROR3 SEI0 ADC7 ADC6 ROR6 ' +
    'STA8 STY2 STA2 STX2 DEY0 TXA0 STY5 STA5 STX5 BCC10 STA9 STY3 STA3 STX4 TYA0 STA7 TXS0 STA6 ' +
    'LDY1 LDA8 LDX1 LDY2 LDA2 LDX2 TAY0 LDA1 TAX0 LDY5 LDA5 LDX5 BCS10 LDA9 LDY3 LDA3 LDX4 CLV0 LDA7 TSX0 LDY6 LDA6 LDX7 ' +
    'CPY1 CMP8 CPY2 CMP2 DEC2 INY0 CMP1 DEX0 CPY5 CMP5 DEC5 BNE10 CMP9 CMP3 DEC3 CLD0 CMP7 CMP6 DEC6 ' +
    'CPX1 SBC8 CPX2 SBC2 INC2 INX0 SBC1 NOP0 CPX5 SBC5 INC5 BEQ10 SBC9 SBC3 INC3 SED0 SBC7 SBC6 INC6';
  const CODES = [0x00, 0x01, 0x05, 0x06, 0x08, 0x09, 0x0A, 0x0D, 0x0E, 0x10, 0x11, 0x15, 0x16, 0x18, 0x19, 0x1D, 0x1E,
    0x20, 0x21, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2A, 0x2C, 0x2D, 0x2E, 0x30, 0x31, 0x35, 0x36, 0x38, 0x39, 0x3D, 0x3E,
    0x40, 0x41, 0x45, 0x46, 0x48, 0x49, 0x4A, 0x4C, 0x4D, 0x4E, 0x50, 0x51, 0x55, 0x56, 0x58, 0x59, 0x5D, 0x5E,
    0x60, 0x61, 0x65, 0x66, 0x68, 0x69, 0x6A, 0x6C, 0x6D, 0x6E, 0x70, 0x71, 0x75, 0x76, 0x78, 0x79, 0x7D, 0x7E,
    0x81, 0x84, 0x85, 0x86, 0x88, 0x8A, 0x8C, 0x8D, 0x8E, 0x90, 0x91, 0x94, 0x95, 0x96, 0x98, 0x99, 0x9A, 0x9D,
    0xA0, 0xA1, 0xA2, 0xA4, 0xA5, 0xA6, 0xA8, 0xA9, 0xAA, 0xAC, 0xAD, 0xAE, 0xB0, 0xB1, 0xB4, 0xB5, 0xB6, 0xB8, 0xB9, 0xBA, 0xBC, 0xBD, 0xBE,
    0xC0, 0xC1, 0xC4, 0xC5, 0xC6, 0xC8, 0xC9, 0xCA, 0xCC, 0xCD, 0xCE, 0xD0, 0xD1, 0xD5, 0xD6, 0xD8, 0xD9, 0xDD, 0xDE,
    0xE0, 0xE1, 0xE4, 0xE5, 0xE6, 0xE8, 0xE9, 0xEA, 0xEC, 0xED, 0xEE, 0xF0, 0xF1, 0xF5, 0xF6, 0xF8, 0xF9, 0xFD, 0xFE];
  T.split(' ').forEach((s, i) => { const m = /^([A-Z]{3})(\d+)$/.exec(s); OPS[CODES[i]] = m[1]; MODE[CODES[i]] = +m[2]; });
  if (T.split(' ').length !== CODES.length) throw new Error('cpu6502 table mismatch');

  if (typeof module !== 'undefined' && module.exports) module.exports = CPU6502;
  else root.CPU6502 = CPU6502;
})(typeof self !== 'undefined' ? self : this);
