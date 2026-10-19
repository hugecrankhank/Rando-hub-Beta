#!/usr/bin/env python3
"""Rebuild randomizer/avianart-settings.js from a Door Randomizer checkout.

AVIANART's customizer shows the Door Randomizer's own GUI tabs. This reads them
the way AVIANART's server does (AVIANART/api, src/Actions/Tabs.php):

    git clone --depth 1 https://github.com/aerinon/ALttPDoorRandomizer dr
    python3 tools/avianart-settings.py dr > randomizer/avianart-settings.js
"""
import glob
import json
import os
import re
import sys

src = sys.argv[1] if len(sys.argv) > 1 else 'dr'
os.chdir(src)
sys.path.insert(0, os.getcwd())
sys.argv = ['x']
from CLI import parse_settings  # noqa: E402

defaults = parse_settings()
raw = open('source/classes/constants.py').read().split('SETTINGSTOPROCESS = ')[1]
depth = end = 0
for i, c in enumerate(raw):
    if c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
table = eval(raw[:end])['randomizer']  # a plain dict literal
gui = json.load(open('resources/app/gui/lang/en.json'))['gui']
helpt = json.load(open('resources/app/cli/lang/en.json'))['help']
main = open('Main.py').read()
ver = re.search(r"version_number = '([^']+)'", main).group(1) + re.search(r"version_branch = '([^']*)'", main).group(1)

tabs = []
for tab, label in [('item', 'Items'), ('entrando', 'Entrances'), ('dungeon', 'Dungeons'), ('enemizer', 'Enemizer')]:
    tname = tab.replace('entrando', 'entrance')
    groups = []
    for f in sorted(glob.glob(f'resources/app/gui/randomize/{tab}/*.json'), key=lambda p: 0 if 'keysanity' in p else 1):
        for g, fields in json.load(open(f)).items():
            items = []
            for k, v in fields.items():
                if v.get('type') == 'button':
                    continue
                y = table.get(tname, {}).get(k)
                dv = defaults.get(y) if y else None
                h = helpt.get(y)
                if isinstance(h, list):
                    h = ' '.join(h)
                if h:
                    h = h.replace('%(default)s', str(dv).lower() if isinstance(dv, bool) else str(dv))
                it = {'id': k, 'yaml': y, 'type': v['type'], 'label': gui.get(f'randomizer.{tname}.{k}', k), 'default': dv}
                if h:
                    it['help'] = re.sub(r'\s+', ' ', h).strip()[:400]
                if 'options' in v:
                    it['options'] = [[o, gui.get(f'randomizer.{tname}.{k}.{o}', str(o))] for o in v['options']]
                items.append(it)
            groups.append({'group': g, 'items': items})
    tabs.append({'tab': tab, 'label': label, 'groups': groups})

data = {'meta': {'source': 'aerinon/ALttPDoorRandomizer (DoorDev)', 'version': ver}, 'tabs': tabs}
print("""// AVIANART's customizer settings: the Door Randomizer's own GUI tabs (Items,
// Entrances, Dungeons, Enemizer), with their labels, choices, defaults, help
// text and YAML setting names, as avianart.games builds them (AVIANART/api,
// src/Actions/Tabs.php) from aerinon/ALttPDoorRandomizer. Made by reading
// resources/app/gui/randomize/*.json, gui/lang/en.json, cli/lang/en.json,
// source/classes/constants.py (SETTINGSTOPROCESS) and CLI.parse_settings().
// Regenerate with tools/avianart-settings.py when AVIANART's build changes.
""")
print('export const AVIAN_SETTINGS = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';')
