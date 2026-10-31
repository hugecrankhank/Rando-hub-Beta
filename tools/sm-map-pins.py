#!/usr/bin/env python3
"""Writes MAP_PINS in sm/js/data.js: where each DASH item spot sits on the game's
own area maps, read from a vanilla Super Metroid (JU) ROM.

    python3 tools/sm-map-pins.py /path/to/sm.sfc

The pause-screen map of an area is a 64x32 grid of 8x8 tiles (bank $B5), one tile
per room screen. A room header (bank $8F) says which area it's in and where it sits
on that grid (map X/Y); an item is a PLM in the room's PLM list (id, x, y in 16px
blocks, argument). So the item's map pixel is
    x: (mapX + x // 16) * 8 + (x % 16) // 2
    y: (mapY + y // 16 + 1) * 8 + (y % 16) // 2      (the tilemap sits one row down)
DASH's location list gives each spot's PLM address. Its boss-shuffle copies of Varia
/ Space Jump / Ridley's E-tank live in rooms DASH adds; they're pinned on the boss
room of their area instead (the item comes right after that boss).
The room list comes from the door table (bank $83): every door names its room.
Nothing of the ROM is written out but numbers."""
import json, subprocess, sys, re, os
rom = open(sys.argv[1], 'rb').read()
if len(rom) % 0x8000 == 0x200: rom = rom[0x200:]
assert len(rom) == 0x300000, 'not the 3 MB Super Metroid ROM'
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
def lorom(bank, addr): return ((bank & 0x7F) << 15) | (addr & 0x7FFF)

B83 = lorom(0x83, 0x8000); rooms = set()
for a in range(B83, B83 + 0x8000, 2):
    rp = rom[a] | rom[a + 1] << 8
    if not (0x91F8 <= rp <= 0xFFFF) or rom[a + 3] & 0xBF > 7: continue
    r = lorom(0x8F, rp)
    if rom[r + 1] > 7 or rom[r + 2] >= 64 or rom[r + 3] >= 32 or not (1 <= rom[r + 4] <= 16) or not (1 <= rom[r + 5] <= 16): continue
    rooms.add(rp)
COND = {0xE5E6: 0, 0xE5EB: 4, 0xE5FF: 2, 0xE612: 3, 0xE629: 3, 0xE640: 2, 0xE652: 2, 0xE669: 2, 0xE678: 2}
byaddr, byptr = {}, {}
for rp in sorted(rooms):
    r = lorom(0x8F, rp); info = {'area': rom[r + 1], 'mx': rom[r + 2], 'my': rom[r + 3], 'w': rom[r + 4], 'h': rom[r + 5]}
    byptr[rp] = info
    p = r + 11; states = []; ok = True
    while True:
        c = rom[p] | rom[p + 1] << 8
        if c not in COND: ok = False; break
        if c == 0xE5E6: states.append(p + 2); break
        n = COND[c]; states.append(lorom(0x8F, rom[p + n] | rom[p + n + 1] << 8)); p += 2 + n
    if not ok: continue
    for s in states:
        pp = rom[s + 20] | rom[s + 21] << 8
        if pp < 0x8000: continue
        q = lorom(0x8F, pp)
        while rom[q] | rom[q + 1] << 8:
            byaddr.setdefault(q, (info, rom[q + 2], rom[q + 3])); q += 6

locs = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "const m=await import(process.argv[1]);console.log(JSON.stringify(m.getLocations()))", os.path.join(root, 'sm/gen/dash-core.js')]))
BOSS_ROOM = {3: 0xA59F, 5: 0xCD13, 6: 0xDA60, 9: 0xB32E}   # DASH area -> Kraid, Phantoon, Draygon, Ridley
pins = []
for l in locs:
    hit = byaddr.get(l['address'])
    if hit:
        info, x, y = hit
        pins.append([info['area'], (info['mx'] + (x >> 4)) * 8 + ((x & 15) >> 1), (info['my'] + (y >> 4) + 1) * 8 + ((y & 15) >> 1)])
    else:
        info = byptr[BOSS_ROOM[l['area']]]
        pins.append([info['area'], info['mx'] * 8 + info['w'] * 4, (info['my'] + 1) * 8 + info['h'] * 4, 1])
p = os.path.join(root, 'sm/js/data.js'); s = open(p).read()
line = '  const MAP_PINS = ' + json.dumps(pins, separators=(',', ':')) + ';\n'
s = re.sub(r'  const MAP_PINS = .*?;\n', line, s) if 'const MAP_PINS' in s else s.replace('  const LOCATIONS = ', line + '  const LOCATIONS = ', 1)
open(p, 'w').write(s)
print('MAP_PINS:', len(pins), 'spots,', sum(1 for q in pins if len(q) > 3), 'after a shuffled boss')
