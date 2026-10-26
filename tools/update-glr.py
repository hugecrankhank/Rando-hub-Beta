#!/usr/bin/env python3
"""
Copy The Guardian Legend randomizer (GLR, github.com/hugecrankhank/GLR) into glr/.

The GLR repository stays a standalone app; Rando Hub serves a copy of it at
glr/ with one addition: glr-hub/hub.js (links back to the other games),
copied in as glr/hub.js and loaded by one <script> line in glr/index.html.
GLR is only picked by hand: rerolls and Crowd Control never roll it.

  python3 tools/update-glr.py                 # clone the newest from GitHub
  python3 tools/update-glr.py /path/to/clone  # copy from a local clone

Run by the deploy workflow too, so the site follows GLR's updates; if GitHub
can't be reached the copy already in the repository is used.
"""
import os, shutil, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REPO = os.environ.get('GLR_REPO', 'https://github.com/hugecrankhank/GLR')
DST = os.path.join(ROOT, 'glr')
SKIP = {'.git', '.github', '.gitignore', '.nojekyll'}
TAG = '<script src="hub.js"></script> <!-- rando-hub -->'


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    tmp = None
    if not src:
        tmp = tempfile.mkdtemp(prefix='glr-')
        src = os.path.join(tmp, 'glr')
        subprocess.run(['git', 'clone', '-q', '--depth', '1', REPO, src], check=True, timeout=600,
                       env=dict(os.environ, GIT_TERMINAL_PROMPT='0'))
    commit = subprocess.run(['git', '-C', src, 'log', '-1', '--format=%h %cs'],
                            capture_output=True, text=True).stdout.strip()

    if os.path.isdir(DST):
        shutil.rmtree(DST)
    shutil.copytree(src, DST, ignore=lambda d, names: [n for n in names if n in SKIP])

    shutil.copyfile(os.path.join(ROOT, 'glr-hub', 'hub.js'), os.path.join(DST, 'hub.js'))
    page = os.path.join(DST, 'index.html')
    html = open(page, encoding='utf-8').read()
    # before the app's scripts
    anchor = '<script src="emu/core.js"></script>'
    if anchor not in html:
        sys.exit('glr/index.html has no emu/core.js script tag: the hub line needs a new place')
    html = html.replace(anchor, TAG + '\n' + anchor, 1)
    open(page, 'w', encoding='utf-8').write(html)
    with open(os.path.join(DST, 'VERSION'), 'w') as f:
        f.write((commit or 'unknown') + '\n')
    print('glr/ <- GLR ' + (commit or '(unknown commit)'))
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
