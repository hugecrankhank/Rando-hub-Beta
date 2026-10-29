#!/usr/bin/env python3
"""Set Rando Hub's version number everywhere it appears.

    python3 tools/set-version.py 1.1.0

Updates index.html (the version meta tag and the header's "v1.1.0") and the
crowd bridge's package.json. Then add a section to CHANGELOG.md, commit and
push to main: the Release workflow publishes v1.1.0 (see README → Releasing).
"""
import re, sys, os, json

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

if len(sys.argv) != 2 or not re.fullmatch(r'v?\d+\.\d+\.\d+', sys.argv[1]):
    sys.exit('usage: python3 tools/set-version.py 1.2.3')
v = sys.argv[1].lstrip('v')

p = os.path.join(ROOT, 'index.html')
s = open(p, encoding='utf-8').read()
s, n1 = re.subn(r'<meta name="version" content="[^"]*">', f'<meta name="version" content="{v}">', s)
s, n2 = re.subn(r'<h1 title="Rando Hub v[^"]*">', f'<h1 title="Rando Hub v{v}">', s)
s, n3 = re.subn(r'<small class="app-ver">v[^<]*</small>', f'<small class="app-ver">v{v}</small>', s)
if not (n1 and n2 and n3):
    sys.exit('Could not find every version spot in index.html')
open(p, 'w', encoding='utf-8').write(s)

# the game pages: their "Check for updates" (web-update.js) compares this with the hub's
GAME_PAGES = ['z1r/index.html', 'glr/index.html', 'ff6wc/index.html', 'patched/index.html',
              'ffr/ff1/index.html', 'ffr/ff4/index.html', 'ffr/ff5/index.html', 'ffr/common/page.tpl.html']
for rel in GAME_PAGES:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p): continue
    s = open(p, encoding='utf-8').read()
    tag = f'<meta name="version" content="{v}">'
    s, n = re.subn(r'<meta name="version" content="[^"]*">', tag, s)
    if not n: s = s.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + tag, 1) if '<meta charset="UTF-8">' in s else s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + tag, 1)
    open(p, 'w', encoding='utf-8').write(s)

p = os.path.join(ROOT, 'crowd-plus', 'package.json')
s = open(p, encoding='utf-8').read()
s = re.sub(r'"version": "[^"]*"', f'"version": "{v}"', s, count=1)
open(p, 'w', encoding='utf-8').write(s)

print(f'Version set to {v}. Next: add "## {v}" to CHANGELOG.md, commit and push to main; the Release workflow publishes v{v}.')
