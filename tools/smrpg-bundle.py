#!/usr/bin/env python3
"""
Bundle the Super Mario RPG Open World Randomizer's generator for the SMRPG
page (smrpg/gen/smrpg_randomizer.zip), from a checkout of
https://github.com/Super-Mario-RPG-Randomizer/smrpg_web_randomizer (MIT).

  python3 tools/smrpg-bundle.py /path/to/smrpg_web_randomizer

What goes in: randomizer/logic and randomizer/data (the generator itself,
unchanged), the two base-mode patches (open_mode.json / linear_mode.json, the
site's static copies), the licence, and two tiny stand-ins for the Django and
Markdown imports the flag definitions make (the page never renders Django
templates). The page's flag UI data (smrpg/js/data.js) is rebuilt from the
same checkout, so the two stay in step.
"""
import io, json, os, re, sys, zipfile, inspect

if len(sys.argv) < 2 or not os.path.isdir(sys.argv[1]):
    sys.exit(__doc__)
SRC = os.path.abspath(sys.argv[1])
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'smrpg', 'gen', 'smrpg_randomizer.zip')

STUBS = {
    'django/__init__.py': '',
    'django/utils/__init__.py': '',
    'django/utils/html.py': 'def mark_safe(s):\n    return s\n',
    'django/core/__init__.py': '',
    'django/core/serializers/__init__.py': '',
    'django/core/serializers/json.py': 'import json\n\nclass DjangoJSONEncoder(json.JSONEncoder):\n    pass\n',
    'markdown.py': 'def markdown(s, **kw):\n    return s\n',
}

zf = zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED)
n = 0
for sub in ('randomizer/logic', 'randomizer/data'):
    for dp, dn, fn in os.walk(os.path.join(SRC, sub)):
        dn[:] = [d for d in dn if d != '__pycache__']
        for f in fn:
            if f.endswith('.py'):
                p = os.path.join(dp, f)
                zf.write(p, os.path.relpath(p, SRC)); n += 1
zf.writestr('randomizer/__init__.py', '')
for f in ('open_mode.json', 'linear_mode.json'):
    zf.write(os.path.join(SRC, 'randomizer/static/randomizer/patches', f), 'patches/' + f); n += 1
zf.write(os.path.join(SRC, 'LICENSE'), 'LICENSE'); n += 1
for p, s in STUBS.items():
    zf.writestr(p, s)
zf.close()
print('wrote', OUT, n, 'files', os.path.getsize(OUT), 'bytes')

# ── the page's data: version, presets, the flag tree ─────────────────────
sys.path.insert(0, os.path.join(HERE, '_smrpg_stubs'))
os.makedirs(os.path.join(HERE, '_smrpg_stubs'), exist_ok=True)
for p, s in STUBS.items():
    fp = os.path.join(HERE, '_smrpg_stubs', p); os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, 'w').write(s)
sys.path.insert(0, SRC)
from randomizer.logic import flags as F
from randomizer.logic.main import VERSION

def md(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s or ''); s = re.sub(r'\*(.+?)\*', r'\1', s)
    s = re.sub(r'\[(.+?)\]\((.+?)\)', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()
def flag(f):
    return {'name': f.name, 'desc': md(f.description), 'inv': md(f.inverse_description), 'value': f.value, 'hard': bool(f.hard),
            'modes': list(f.modes), 'choices': [flag(c) for c in f.choices], 'options': [flag(o) for o in f.options]}
cats = [{'name': c.name, 'flags': [flag(f) for f in c.flags]} for c in F.CATEGORIES]
presets = [{'id': re.sub(r'[^a-z0-9]+', '-', p.name.lower()).strip('-'), 'name': p.name, 'about': md(p.description), 'flags': p.flags} for p in F.PRESETS]

data = os.path.join(ROOT, 'smrpg', 'js', 'data.js')
s = open(data).read()
s = re.sub(r"VERSION = '[^']*'", "VERSION = '%s'" % VERSION, s)
s = re.sub(r"const PRESETS = \[.*?\];\n", "const PRESETS = %s;\n" % json.dumps(presets), s, flags=re.S)
s = re.sub(r"const CATEGORIES = \[.*?\];\n", "const CATEGORIES = %s;\n" % json.dumps(cats), s, flags=re.S)
open(data, 'w').write(s)
print('updated', data, 'version', VERSION)
import shutil; shutil.rmtree(os.path.join(HERE, '_smrpg_stubs'))
