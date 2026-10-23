#!/usr/bin/env python3
"""
Copy the Zelda 1 app (Z1R, github.com/hugecrankhank/Zelda-1-Rando) into z1r/.

The Z1R repository stays a standalone app; Rando Hub serves a copy of it at
z1r/ with one addition: z1r-hub/hub.js (back link, reroll, "either game"),
copied in as z1r/hub.js and loaded by one <script> line in z1r/index.html.

  python3 tools/update-z1r.py                 # clone the newest from GitHub
  python3 tools/update-z1r.py /path/to/clone  # copy from a local clone

Run by the deploy workflow too, so the site follows Z1R's updates; if GitHub
can't be reached the copy already in the repository is used.
"""
import os, shutil, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REPO = os.environ.get('Z1R_REPO', 'https://github.com/hugecrankhank/Zelda-1-Rando')
DST = os.path.join(ROOT, 'z1r')
SKIP = {'.git', '.github', '.gitignore', '.nojekyll'}
TAG = '<script src="hub.js"></script> <!-- rando-hub -->'


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    tmp = None
    if not src:
        tmp = tempfile.mkdtemp(prefix='z1r-')
        src = os.path.join(tmp, 'z1r')
        subprocess.run(['git', 'clone', '-q', '--depth', '1', REPO, src], check=True, timeout=600,
                       env=dict(os.environ, GIT_TERMINAL_PROMPT='0'))
    commit = subprocess.run(['git', '-C', src, 'log', '-1', '--format=%h %cs'],
                            capture_output=True, text=True).stdout.strip()

    if os.path.isdir(DST):
        shutil.rmtree(DST)
    shutil.copytree(src, DST, ignore=lambda d, names: [n for n in names if n in SKIP])

    shutil.copyfile(os.path.join(ROOT, 'z1r-hub', 'hub.js'), os.path.join(DST, 'hub.js'))
    page = os.path.join(DST, 'index.html')
    html = open(page, encoding='utf-8').read()
    # before the app's scripts, so the crowd settings are copied before js/crowd.js reads them
    anchor = '<script src="emu/core.js"></script>'
    if anchor not in html:
        sys.exit('z1r/index.html has no emu/core.js script tag: the hub line needs a new place')
    html = html.replace(anchor, TAG + '\n' + anchor, 1)
    open(page, 'w', encoding='utf-8').write(html)
    with open(os.path.join(DST, 'VERSION'), 'w') as f:
        f.write((commit or 'unknown') + '\n')
    print('z1r/ <- Zelda-1-Rando ' + (commit or '(unknown commit)'))
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
