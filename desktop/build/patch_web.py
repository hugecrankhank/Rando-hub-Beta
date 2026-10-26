#!/usr/bin/env python3
"""Small changes to the web app for the desktop build.

Seed links ("Share" in the randomizer) are made from the page's own address.
In the desktop app that's http://127.0.0.1:47067/, which means nothing to a
friend, so links made there point at the website instead (the same seed and
settings open the same game there).

    python3 patch_web.py path/to/web https://hugecrankhank.github.io/Rando-hub/
"""
import pathlib, sys

web = pathlib.Path(sys.argv[1])
site = (sys.argv[2] if len(sys.argv) > 2 else 'https://hugecrankhank.github.io/Rando-hub/').rstrip('/')
OLD = 'const u = new URL(location.pathname, location.origin);'
NEW = ("const u = /\\bElectron\\//.test(navigator.userAgent) && location.hostname === '127.0.0.1'\n"
       f"    ? new URL('{site}' + location.pathname)   // desktop app: share the website's address\n"
       "    : new URL(location.pathname, location.origin);")
for rel in ['randomizer/share.js', 'randomizer/kara/index.js']:
    f = web / rel
    s = f.read_text(encoding='utf-8')
    if NEW in s:
        continue
    if s.count(OLD) != 1:
        sys.exit(f'{rel}: expected one "{OLD}", found {s.count(OLD)} (the app changed: update patch_web.py)')
    f.write_text(s.replace(OLD, NEW), encoding='utf-8')
    print('patched', rel)
