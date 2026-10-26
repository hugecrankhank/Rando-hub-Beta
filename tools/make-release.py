#!/usr/bin/env python3
"""Build the downloadable release zips: dist/Rando-Hub-v<version>.zip and
dist/Crowd-Control-Plus-v<version>.zip (crowd-plus/, if present)

    python3 tools/make-release.py            version from index.html
    python3 tools/make-release.py 1.0.0      check it matches index.html

The zip holds one folder, Rando-Hub-v<version>/, with:
    INSTRUCTIONS.txt, the Start files and serve.mjs   (release/)
    app/                 the whole site, as it's deployed
    Relays (optional)/   the Cloudflare Worker sources (relay/)
    README.md, CHANGELOG.md, LICENSE.md, NOTICE.md

Run it after the deploy steps (tools/update-hutch.py, tools/kara-bundle.py,
tools/fetch-pyodide.sh) so app/ matches the website; the release workflow does.
If Kara's generator or Pyodide is missing, it stops (use --allow-missing to
build anyway; Kara's branch then needs internet).
"""
import os, re, sys, json, zipfile, time

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
REL = os.path.join(ROOT, 'release')

# Not part of the app itself (they're placed elsewhere in the zip, or dev-only)
APP_SKIP_TOP = {'.git', '.github', '.gitignore', '.nojekyll', 'release', 'tools', 'relay', 'crowd-plus', 'archive',
                'dist', 'README.md', 'CHANGELOG.md', 'LICENSE.md', 'NOTICE.md', 'node_modules', 'desktop'}
APP_SKIP_PATHS = {'randomizer/test', 'randomizer/tools'}
SKIP_NAMES = {'__pycache__', '.DS_Store', 'Thumbs.db', 'timer-state.json', 'node_modules'}


def app_version():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<meta name="version" content="([^"]+)">', html)
    if not m:
        sys.exit('index.html has no <meta name="version"> (run tools/set-version.py)')
    return m.group(1)


def walk(base, rel_skip=lambda r: False):
    for d, dirs, files in os.walk(base):
        rd = os.path.relpath(d, base).replace(os.sep, '/')
        rd = '' if rd == '.' else rd
        dirs[:] = sorted(x for x in dirs if x not in SKIP_NAMES and not rel_skip((rd + '/' + x).lstrip('/')))
        for f in sorted(files):
            r = (rd + '/' + f).lstrip('/')
            if f in SKIP_NAMES or rel_skip(r):
                continue
            yield os.path.join(d, f), r


def app_skip(r):
    top = r.split('/', 1)[0]
    return top in APP_SKIP_TOP or any(r == p or r.startswith(p + '/') for p in APP_SKIP_PATHS)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ver = app_version()
    if args and args[0].lstrip('v') != ver:
        sys.exit(f'Version mismatch: asked for {args[0]}, index.html says {ver}. Run tools/set-version.py {args[0].lstrip("v")} first.')

    missing = [p for p in ('randomizer/kara/generator.zip', 'pyodide/pyodide.mjs')
               if not os.path.isfile(os.path.join(ROOT, p))]
    if missing and '--allow-missing' not in sys.argv:
        sys.exit('Missing ' + ', '.join(missing) + '. Run: python3 tools/kara-bundle.py && sh tools/fetch-pyodide.sh '
                 '(or add --allow-missing).')

    name = f'Rando-Hub-v{ver}'
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', name + '.zip')
    stamp = time.localtime()[:6]
    count = 0

    def add(z, src, arc, text_sub=False, exe=False):
        nonlocal count
        info = zipfile.ZipInfo(f'{name}/{arc}', date_time=stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o755 if exe else 0o644) << 16
        data = open(src, 'rb').read()
        if text_sub:
            data = data.replace(b'{{VERSION}}', ver.encode())
        z.writestr(info, data)
        count += 1

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        # top level: instructions, launchers, docs
        for f in sorted(os.listdir(REL)):
            p = os.path.join(REL, f)
            if os.path.isfile(p):
                add(z, p, f, text_sub=f.endswith('.txt'), exe=f.endswith(('.command', '.sh')))
        for f in ('README.md', 'CHANGELOG.md', 'LICENSE.md', 'NOTICE.md'):
            if os.path.isfile(os.path.join(ROOT, f)):
                add(z, os.path.join(ROOT, f), f)
        # the app
        for src, r in walk(ROOT, app_skip):
            add(z, src, 'app/' + r)
        # crowd control is the second download (Crowd Control+, below)
        # relays
        for src, r in walk(os.path.join(ROOT, 'relay')):
            add(z, src, 'Relays (optional)/' + r)

    mb = os.path.getsize(out) / 1e6
    print(f'{out}: {count} files, {mb:.1f} MB')

    # second download: Crowd Control+ (crowd-plus/), its own folder in its own zip
    plus = os.path.join(ROOT, 'crowd-plus')
    if os.path.isdir(plus):
        out2 = os.path.join(ROOT, 'dist', f'Crowd-Control-Plus-v{ver}.zip')
        n2 = 0
        skip2 = {'studio.json', 'stats.json', 'seen-gifts.json', 'timer-state.json', 'hall-of-fame.json', 'viewers.json', 'clips.json'}
        with zipfile.ZipFile(out2, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for src, r in walk(plus, lambda r: r in skip2 or r == 'tiktok-window' or r.startswith('tiktok-window/') or (r.startswith('profiles/') and r.endswith('.json'))):
                info = zipfile.ZipInfo('Crowd Control+/' + r, date_time=stamp)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o755 if r.endswith(('.command', '.sh')) else 0o644) << 16
                if r == 'EFFECTS-OVERVIEW.md':   # always the current list, never a stale copy
                    src = os.path.join(ROOT, 'crowd', 'README.md')
                z.writestr(info, open(src, 'rb').read()); n2 += 1
            for f in ('LICENSE.md', 'NOTICE.md'):   # the same license covers Crowd Control+
                info = zipfile.ZipInfo('Crowd Control+/' + f, date_time=stamp)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, open(os.path.join(ROOT, f), 'rb').read()); n2 += 1
        print(f'{out2}: {n2} files, {os.path.getsize(out2) / 1e6:.1f} MB')
    if missing:
        print('Note: built without ' + ', '.join(missing))


if __name__ == '__main__':
    main()
