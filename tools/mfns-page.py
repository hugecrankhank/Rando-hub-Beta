#!/usr/bin/env python3
"""Write mfns-tracker/index.html: Muffins' Tracker 2.0 page (app/index.html,
built unchanged from his source) with Rando Hub's two loaders in front of it:
../bridge/sni-shim.js (autotracking from the built-in emulator) and embed.js
(runs it from this subfolder). Run after the build puts it in mfns-tracker/app/."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'mfns-tracker', 'app', 'index.html'), encoding='utf-8').read()
commit = ''
try: commit = open(os.path.join(ROOT, 'mfns-tracker', 'app', 'SOURCE_COMMIT')).read().strip()
except OSError: pass
inject = ('\n    <!-- Rando Hub: Muffins\' Tracker 2.0 (github.com/KrisDavie/alttptracker, react_rewrite @ ' + commit[:7] +
          '), built unchanged. These two loaders run it inside Rando Hub. -->\n'
          '    <script src="../bridge/sni-shim.js"></script>\n'
          '    <script src="embed.js"></script>\n')
out, n = re.subn(r'(\s*<script type="module")', inject + r'\1', src, count=1)
assert n == 1, 'no module script in app/index.html'
open(os.path.join(ROOT, 'mfns-tracker', 'index.html'), 'w', encoding='utf-8').write(out)
print('wrote mfns-tracker/index.html')
