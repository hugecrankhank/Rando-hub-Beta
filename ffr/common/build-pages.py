#!/usr/bin/env python3
"""Writes ffr/<game>/index.html from common/page.tpl.html and each game's page.json."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, 'page.tpl.html'), encoding='utf-8').read()
EMU = {
    'nes': ("../../z1r/emu/", ['core.js', 'palettes.js', 'video.js', 'audio.js', 'input.js', 'player.js']),
    'snes': ("../../emu/", ['core.js', 'video.js', 'audio.js', 'input.js', 'player.js']),
}
for g in ['ff1', 'ff4', 'ff5']:
    d = os.path.join(here, '..', g)
    cfg = json.load(open(os.path.join(d, 'page.json'), encoding='utf-8'))
    base, files = EMU[cfg['system']]
    out = tpl
    cfg['EMU'] = base
    cfg['EMU_SCRIPTS'] = '\n'.join('<script src="%s%s"></script>' % (base, f) for f in files)
    for k, v in cfg.items():
        out = out.replace('{{%s}}' % k, v)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(out)
    print('wrote', g)
