#!/usr/bin/env node
// CLI: node tools/glr.js <base.nes> [seed] [flags] [out.nes]
const fs = require('fs');
const G = require('../js/randomizer.js');
const [, , base, seed, flags, out] = process.argv;
if (!base) { console.error('usage: node tools/glr.js <base.nes> [seed] [flags] [out.nes]'); process.exit(1); }
const r = G.generate(fs.readFileSync(base), { seed, flags });
const file = out || ('GLR_' + r.seed + '_' + r.flags + '.nes');
fs.writeFileSync(file, r.rom);
fs.writeFileSync(file.replace(/\.nes$/, '') + '_spoiler.txt', r.text);
console.log('wrote', file, 'code', r.code);
