#!/usr/bin/env python3
"""
List the built-in item sound packs for addons/sound-packs.js.

  sounds/packs/<Pack name>/<item folder>/<sound files>

Item folders are named after items (hookshot, fire rod, master sword,
sword-2, bottle, go mode…); the app matches the names, so they don't have to
be exact. Every sound in an item's folder is a candidate; one is picked at
random on each pickup.

Writes sounds/packs/index.json. Run it after adding or removing sounds:

  python3 tools/build-sound-packs.py
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASE = os.path.join(ROOT, 'sounds', 'packs')
AUDIO = re.compile(r'\.(mp3|ogg|oga|wav|m4a|aac|flac|webm|opus)$', re.I)


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'pack'


def main():
    os.makedirs(BASE, exist_ok=True)
    packs = []
    for pack in sorted(os.listdir(BASE)):
        pdir = os.path.join(BASE, pack)
        if not os.path.isdir(pdir) or pack.startswith('.'):
            continue
        items = {}
        for folder in sorted(os.listdir(pdir)):
            fdir = os.path.join(pdir, folder)
            if not os.path.isdir(fdir):
                continue
            files = sorted(f for f in os.listdir(fdir) if AUDIO.search(f))
            if files:
                items[folder] = [pack + '/' + folder + '/' + f for f in files]
        if items:
            packs.append({'id': slug(pack), 'name': pack, 'items': items})
            print('%s: %d item folders, %d sounds' % (pack, len(items), sum(len(v) for v in items.values())))
    with open(os.path.join(BASE, 'index.json'), 'w') as f:
        json.dump({'packs': packs}, f, indent=1)
        f.write('\n')
    if not packs:
        print('No packs in sounds/packs/ (index.json lists none)')


if __name__ == '__main__':
    main()
