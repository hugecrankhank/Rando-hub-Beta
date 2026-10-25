#!/usr/bin/env python3
"""Read the settings Muffins' launch page offers, from his source, for Mudora 2.0.

Usage: python3 tools/mfns-settings.py <his source folder> > mfns-tracker/settings.json

Mudora 2.0 lets the settings be changed mid-game. Rather than keep its own copy
of his choices (which would drift as he adds things), this reads them out of his
launch page's settings tabs: each <SettingSelect> / <SettingSwitch> (its label,
the setting it changes, its options and help text) and the logic breaks list.
Choices he has commented out are left out, as on his page. Nothing of his is
changed; Mudora 2.0 sends the result back with his own setSettings action.
"""
import json
import re
import sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else '.') / 'src/components/launch/settings'

# His tabs, and which of their settings Mudora 2.0 shows (the rest only change
# how his own tracker looks).
TABS = [
    ('RandomizerTab.tsx', 'Randomizer', None),
    ('AdvancedTab.tsx', 'Dungeons, entrances and more', None),
    ('TrackerSettingsTab.tsx', 'Tracker', {'autotracking', 'includeDungeonItemsInCounter', 'assumeOldManOnCollect'}),
]


def uncomment(text):
    text = re.sub(r'\{/\*.*?\*/\}', '', text, flags=re.S)       # {/* ... */} in JSX
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    return '\n'.join(l for l in text.split('\n') if not l.strip().startswith('//'))


def attr(block, name):
    m = re.search(name + r'=\s*"((?:[^"\\]|\\.)*)"', block)
    if m:
        return m.group(1)
    m = re.search(name + r'=\{\s*"((?:[^"\\]|\\.)*)"\s*\}', block)
    return m.group(1) if m else None


def controls(text):
    out = []
    # a heading (card title or small label) names the controls after it
    pat = re.compile(r'<(?:CardTitle|h3)[^>]*>([^<]+)</(?:CardTitle|h3)>|<Label className="text-xs font-medium">([^<]+)</Label>|<(SettingSelect|SettingSwitch)\b(.*?)/>\s*', re.S)
    heading = None
    for m in pat.finditer(text):
        if m.group(1) or m.group(2):
            heading = (m.group(1) or m.group(2)).strip().replace('&amp;', '&')
            continue
        kind, block = m.group(3), m.group(4)
        key = re.search(r'updateSetting\(\s*"(\w+)"', block)
        if not key:
            continue
        item = {'key': key.group(1), 'label': attr(block, 'label') or key.group(1),
                'type': 'select' if kind == 'SettingSelect' else 'switch', 'group': heading}
        desc = attr(block, 'description')
        if desc:
            item['desc'] = desc
        if kind == 'SettingSelect':
            item['options'] = [{'value': v, 'label': l} for v, l in
                               re.findall(r'\{\s*value:\s*"([^"]*)",\s*label:\s*"([^"]*)"\s*\}', block)]
            if not item['options']:
                continue
        out.append(item)
    return out


sections = []
for fn, title, only in TABS:
    items = controls(uncomment((src / fn).read_text()))
    if only:
        items = [i for i in items if i['key'] in only]
    sections.append({'title': title, 'items': items})

lb = uncomment((src / 'LogicBreaksTab.tsx').read_text())
breaks = []
for const, group in (('DUNGEON_LOGIC', 'Dungeon logic'), ('OVERWORLD_LOGIC', 'Overworld logic'), ('GLITCH_LOGIC', 'Glitch logic (glitched modes only)')):
    m = re.search(r'const ' + const + r'[^=]*=\s*\[(.*?)\];', lb, re.S)
    if not m:
        continue
    for i, l, t in re.findall(r'\{\s*id:\s*"(\w+)",\s*label:\s*"([^"]*)",\s*tooltip:\s*"([^"]*)"\s*\}', m.group(1)):
        breaks.append({'id': i, 'label': l, 'desc': t, 'group': group})

# settings his launcher remembers for every game (kept in his launcher prefs,
# put back on each load), as opposed to ones kept with each game
up = uncomment((src.parents[2] / 'data/userPreferences.ts').read_text())
m = re.search(r'REMEMBERED_SETTINGS\s*=\s*\[(.*?)\]', up, re.S)
remembered = re.findall(r'"(\w+)"', m.group(1)) if m else []

# his entrance menu: its sections and the destinations on each
menu = []
md = uncomment((src.parents[1] / 'tracker/EntranceSelectionModal.tsx').read_text())
for m in re.finditer(r'<span[^>]*>([^<]+?):?</span>|getEntranceButton\(\s*"([^"]+)"\s*\)', md):
    if m.group(1):
        menu.append({'title': m.group(1).strip().rstrip(':'), 'to': []})
    elif menu:
        menu[-1]['to'].append(m.group(2))
menu = [g for g in menu if g['to']]

# his presets: the ones his launch page shows as buttons, by section
lp = uncomment((src.parents[2] / 'data/launcherPresets.ts').read_text())
names = {i: (n, d) for i, n, d in re.findall(r'id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]*)"', lp)}
presets = []
cm = re.search(r'presetCategories[^=]*=\s*\[(.*?)\n\];', lp, re.S)
for title, ids in re.findall(r'title:\s*"([^"]+)".*?presetIds:\s*\[([^\]]*)\]', cm.group(1) if cm else '', re.S):
    presets.append({'title': title, 'presets': [{'id': i, 'name': names[i][0], 'desc': names[i][1]} for i in re.findall(r'"([^"]+)"', ids) if i in names]})

# and every preset he has (his "Browse all presets…" list), in his order
allp = [{'id': i, 'name': n, 'desc': d} for i, (n, d) in names.items()]
json.dump({'sections': sections, 'breaks': breaks, 'remembered': remembered, 'entranceMenu': menu, 'presets': presets, 'allPresets': allp}, sys.stdout, indent=1, ensure_ascii=False)
print()
