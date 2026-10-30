// Rewrites the PRESETS and ENUMS lines of sm/js/data.js from the bundle.
import fs from 'node:fs';
const root = process.argv[2];
const m = await import(root + '/sm/gen/dash-core.js');
const presets = m.getAllPresets().map((p) => ({ id: p.fileName, name: p.title, tags: p.tags, settings: p.settings, options: p.options }));
const E = { MapLayout: m.MapLayout, MajorDistributionMode: m.MajorDistributionMode, MinorDistributionMode: m.MinorDistributionMode, BeamMode: m.BeamMode, SuitMode: m.SuitMode, GravityHeatReduction: m.GravityHeatReduction, BossMode: m.BossMode, Item: { DoubleJump: m.Item.DoubleJump, HeatShield: m.Item.HeatShield, PressureValve: m.Item.PressureValve } };
const p = root + '/sm/js/data.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/const PRESETS = .*?;\n/s, 'const PRESETS = ' + JSON.stringify(presets) + ';\n');
s = s.replace(/const ENUMS = .*?;\n/s, 'const ENUMS = ' + JSON.stringify(E) + ';\n');
fs.writeFileSync(p, s);
console.log('data.js: ' + presets.length + ' presets');
