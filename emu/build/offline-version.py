#!/usr/bin/env python3
"""Recompute offline-files.json "version" so offline copies refresh after an update."""
import json, hashlib, os
os.chdir(os.path.join(os.path.dirname(__file__), '..', '..'))
d = json.load(open('offline-files.json'))
h = hashlib.sha1()
for f in sorted(set(d['files'])):
    fp = 'index.html' if f == './' else f
    if os.path.isfile(fp): h.update(open(fp, 'rb').read())
d['version'] = h.hexdigest()[:12]
json.dump(d, open('offline-files.json', 'w'), indent=1); open('offline-files.json', 'a').write('\n')
print(d['version'])
