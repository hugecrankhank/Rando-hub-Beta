#!/usr/bin/env python3
"""Make mudora/entrances.json: every overworld door and hole, by its usual
entrance-randomizer name, with where it is in the game and how the game knows
it. Used by both Mudoras to draw entrances and to notice, from the emulator,
where a door led.

Usage: python3 tools/entrances.py <ALTTP JP 1.0 ROM> > mudora/entrances.json

From the ROM (the unrandomized game): each door's and hole's slot in the
game's own entrance tables (where it is on the map, and the entrance number it
leads to), and each exit's room. From Kara's generator
(randomizer/kara/alttpr-python, MIT): the names, which slot each name is, and
which entrance number / exit each interior has. Entrance randomizers rewrite
those same tables, so on a shuffled ROM Mudora reads, for the one door Link
just used, where the table now points.
"""
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rom = open(sys.argv[1], 'rb').read()
w = lambda o: struct.unpack_from('<H', rom, o)[0]

ns = {}
exec((ROOT / 'randomizer/kara/alttpr-python/source/overworld/EntranceData.py').read_text(), ns)
door_addresses = ns['door_addresses']
src = (ROOT / 'randomizer/kara/alttpr-python/source/overworld/EntranceShuffle2.py').read_text()
start = src.index('exit_ids = {')
depth, i = 0, src.index('{', start)
for j in range(i, len(src)):
    if src[j] == '{': depth += 1
    elif src[j] == '}':
        depth -= 1
        if not depth: break
exit_ids = eval(src[i:j + 1])

DOOR_N, HOLE_N = 129, 19


def where(area, pos):
    """A slot's tile, in world pixels (0..4095), and which world."""
    tx, ty = (pos >> 1) & 0x3f, (pos >> 7) & 0x3f
    a = area & 63
    # the door's tile centre, a little low: the pin sits on the doorway
    return (a & 7) * 512 + tx * 16 + 8, (a >> 3) * 512 + ty * 16 + 12, 'dw' if area >= 64 else 'lw'


doors = {}
for name, v in door_addresses.items():
    if isinstance(v[0], list):          # a hole: its byte(s) in the hole table
        slots = [a - 0xDB84C for a in v[0]]
        s = slots[0]
        area, pos = w(0xDB826 + s * 2), w(0xDB800 + s * 2) + 0x400
        x, y, world = where(area, pos)
        doors[name] = {'kind': 'hole', 'slots': slots, 'area': area, 'x': x, 'y': y, 'world': world, 'id': rom[0xDB84C + s]}
    else:
        s = v[0]
        area, pos = w(0xDB96F + s * 2), w(0xDBA71 + s * 2)
        x, y, world = where(area, pos)
        d = {'kind': 'door', 'slot': s, 'area': area, 'x': x, 'y': y, 'world': world, 'id': rom[0xDBB73 + s]}
        ex = v[1]
        if ex:  # where an exit leaving into this door puts Link
            d['land'] = [ex[1], ex[6], ex[5]]      # area, link x, link y
        doors[name] = d

# entrance number -> the door (or hole) whose inside it is, in the unshuffled game
by_id = {'door': {}, 'hole': {}}
for name, d in doors.items():
    by_id[d['kind']].setdefault(str(d['id']), []).append(name)

# exits: which room each leaves from, and whose inside that is
exits = {}
for ename, v in exit_ids.items():
    eid, off = v if isinstance(v, tuple) else (v, None)   # one-door insides: an entrance number only
    if off is None or eid is None:
        continue
    inside = by_id['door'].get(str(eid), [None])[0]
    exits[str(off)] = {'name': ename, 'room': w(0x15AEE + off * 2), 'id': eid, 'door': inside}

# what each inside is, for Hutch's tracker, which marks a door with a code
# for what it leads to (the codes of his entrance menu) and joins the doors
# of one cave with a connector line
HUTCH = {
    'Hyrule Castle Entrance (South)': 'HCM', 'Hyrule Castle Entrance (West)': 'HCW', 'Hyrule Castle Entrance (East)': 'HCE',
    'Agahnims Tower': 'CT', 'Eastern Palace': 'EP', 'Desert Palace Entrance (South)': 'DPM', 'Desert Palace Entrance (West)': 'DPW',
    'Desert Palace Entrance (East)': 'DPE', 'Desert Palace Entrance (North)': 'DPN', 'Tower of Hera': 'TOH', 'Palace of Darkness': 'POD',
    'Swamp Palace': 'SP', 'Skull Woods First Section Door': 'SWM', 'Skull Woods Second Section Door (West)': 'SWW',
    'Skull Woods Second Section Door (East)': 'SWE', 'Skull Woods Final Section': 'SW', 'Thieves Town': 'TT', 'Ice Palace': 'IP',
    'Misery Mire': 'MM', 'Turtle Rock': 'TRM', 'Dark Death Mountain Ledge (West)': 'TRW', 'Dark Death Mountain Ledge (East)': 'TRE',
    'Turtle Rock Isolated Ledge Entrance': 'TRB', 'Ganons Tower': 'GT', 'Pyramid Hole': 'GANON', 'Inverted Pyramid Hole': 'GANON',
    'Potion Shop': 'MAGIC', 'Sahasrahlas Hut': 'SAHAS', 'Sick Kids House': 'KID', 'Mimic Cave': 'MIMIC', 'Blacksmiths Hut': 'SMITH',
    'Bat Cave Drop': 'BAT', 'Bat Cave Cave': 'BAT', 'Library': 'LIBRARY', 'Dam': 'DAM', 'Big Bomb Shop': 'BOMB',
    'Bumper Cave (Bottom)': 'BUMPER', 'Bumper Cave (Top)': 'BUMPER', 'Spike Cave': 'SPIKE', 'Hookshot Cave': 'HOOK',
    'Links House': 'LINK', 'Sanctuary': 'SANC',
}
mf = {}
try:
    mf = json.load(open(ROOT / 'mfns-tracker/data.json'))['entries']
except Exception:
    pass
cave_of = {}
for ex in exits.values():
    if not ex['door']:
        continue
    key = ex['name'].split(' Exit')[0]
    cave_of[ex['door']] = key
counts = {}
for k in cave_of.values():
    counts[k] = counts.get(k, 0) + 1
insides = {}
for name, d in doors.items():
    info = {}
    code = HUTCH.get(name)
    if not code:
        if 'Shop' in name: code = 'SHOP'
        elif 'Fairy' in name: code = 'FAIRY'
        elif 'Rupee' in name: code = 'RUPEE'
        elif any(l.get('category') == 'chest' for l in mf.get(name, {}).get('locs', [])): code = 'ITEM'
    if code: info['hutch'] = code
    cave = cave_of.get(name)
    if cave and counts.get(cave, 0) > 1: info['cave'] = cave
    if info: insides[name] = info

# tracker names that differ
aliases = {'Pyramid Exit': 'Pyramid Entrance'}

json.dump({'doors': doors, 'byId': by_id, 'exits': exits, 'insides': insides, 'aliases': aliases,
           'tables': {'doorArea': 0xDB96F, 'doorPos': 0xDBA71, 'doorId': 0xDBB73, 'doorN': DOOR_N,
                      'holePos': 0xDB800, 'holeArea': 0xDB826, 'holeId': 0xDB84C, 'holeN': HOLE_N,
                      'exitRoom': 0x15AEE, 'exitArea': 0x15B8C, 'exitY': 0x15DB5, 'exitX': 0x15E53, 'exitN': 0x4F}},
          sys.stdout, separators=(',', ':'))
print()
