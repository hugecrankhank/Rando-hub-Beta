#!/usr/bin/env python3
"""
Refresh Hutch's tracker from his GitHub repositories.

  tracker/       his newest release      (github.com/hutchch/ALTTPR-Tracker, main)
  tracker-beta/  his beta, when he has one (github.com/hutchch/ALTTPR-Tracker-Beta)

His beta repository holds only the files the beta changes, so tracker-beta/
is the release with those files laid over it. When the beta repository has
no tracker files (between betas, e.g. after a beta became a release), there
is no tracker-beta/ and the app's "Beta" choice uses the release.

Kept from this app in both copies: the one <script> line that routes the
tracker's SNI connection to the built-in emulator (bridge/sni-shim.js), and
the bottle pictures his repository doesn't include (items/bottle_*.png).

Writes tracker/hutch-versions.js (which version each choice is) and adds or
removes the tracker-beta/ files in offline-files.json.

  python3 tools/update-hutch.py            # fetch from GitHub
  python3 tools/update-hutch.py --check    # say what would change, change nothing
  python3 tools/update-hutch.py --addons   # only re-add the addon <script> lines

Run by the deploy workflow too, so the site follows his updates; if GitHub
can't be reached the copies already in the repository are used.
"""
import json, os, re, shutil, subprocess, sys, tempfile, filecmp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RELEASE_REPO = os.environ.get('HUTCH_RELEASE_REPO', 'https://github.com/hutchch/ALTTPR-Tracker')
BETA_REPO = os.environ.get('HUTCH_BETA_REPO', 'https://github.com/hutchch/ALTTPR-Tracker-Beta')
SHIM = '<script src="../bridge/sni-shim.js"></script> <!-- unified-app: routes SNI WebSocket to built-in emulator -->'
SHIM_PAGES = ['itemtracker.html', 'map.html', 'timer.html', 'broadcast.html']
# Rando Hub's own additions to his pages (addons/). His files are replaced on
# every refresh, so instead of editing them each page gets these <script> lines
# just before </body>; the scripts wrap his functions at runtime.
ADDON_TAG = '<!-- rando-hub addon -->'
SOUND_PACKS = ['../addons/sound-packs.js', '../addons/sound-packs-ui.js']
ADDONS = {
    'broadcast.html': SOUND_PACKS,        # item sound packs
    'bcast-sounds.html': SOUND_PACKS,     # the pack picker in Item Sounds
    'itemtracker.html': ['../addons/key-display.js'],   # small keys in hand
}
# his desktop-app (Electron) files and downloads: not part of the web tracker
SKIP = {'.git', 'build', 'node_modules', 'main.js', 'preload.js', 'package.json', 'package-lock.json',
        'Racing_Overlay.zip', 'mobile.html', 'CHANGELOG.md'}
KEEP_LOCAL = re.compile(r'^items/bottle_[a-z]+\.png$')   # ours, not in his repository
CHECK = '--check' in sys.argv


def clone(url, into):
    subprocess.run(['git', 'clone', '-q', '--depth', '1', url, into], check=True, timeout=600,
                   env=dict(os.environ, GIT_TERMINAL_PROMPT='0'))
    rev = subprocess.run(['git', '-C', into, 'log', '-1', '--format=%h %cs'], capture_output=True, text=True).stdout.split()
    return {'commit': rev[0], 'date': rev[1]}


def files_in(d):
    out = []
    for base, dirs, names in os.walk(d):
        dirs[:] = [x for x in dirs if x not in SKIP]
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), d).replace(os.sep, '/')
            if rel.split('/')[0] in SKIP or n in SKIP:
                continue
            out.append(rel)
    return sorted(out)


def version_of(readme_path, fallback):
    try:
        txt = open(readme_path, encoding='utf-8', errors='replace').read()
    except OSError:
        return fallback
    m = re.search(r'\(v(\d+\.\d+\.\d+[a-z]?)[^)]*\)', txt) or re.search(r'v(\d+\.\d+\.\d+[a-z]?)', txt)
    return 'v' + m.group(1) if m else fallback


def add_shim(page):
    if not os.path.exists(page):
        return
    html = open(page, encoding='utf-8').read()
    if 'bridge/sni-shim.js' in html:
        return
    # right after <head> (as in the copies made by hand), else at the top
    m = re.search(r'<head[^>]*>\s*\n?', html, re.I)
    at = m.end() if m else 0
    html = html[:at] + SHIM + '\n' + html[at:]
    open(page, 'w', encoding='utf-8').write(html)


def add_addons(page, scripts):
    if not os.path.exists(page):
        return
    html = strip_addons(open(page, encoding='utf-8').read())
    lines = ''.join('<script src="%s"></script> %s\n' % (src, ADDON_TAG) for src in scripts)
    at = html.lower().rfind('</body>')
    if at == -1:
        at = len(html)
    html = html[:at] + lines + html[at:]
    open(page, 'w', encoding='utf-8').write(html)


def strip_addons(html):
    return ''.join(l for l in html.splitlines(True) if ADDON_TAG not in l)


def sync(src, dst, overlay=None):
    """Make dst = src (+ overlay files on top), keeping our local-only files."""
    changes = []
    want = {f: os.path.join(src, f) for f in files_in(src)}
    if overlay:
        for f in files_in(overlay):
            if f in ('README.md', 'LICENSE'):
                continue
            want[f] = os.path.join(overlay, f)
    have = files_in(dst) if os.path.isdir(dst) else []
    for f in have:
        if f not in want and not KEEP_LOCAL.match(f):
            changes.append('- ' + f)
            if not CHECK:
                os.remove(os.path.join(dst, f))
    for f, p in want.items():
        out = os.path.join(dst, f)
        same = os.path.exists(out) and (filecmp.cmp(p, out, shallow=False) or
                                         ((f in SHIM_PAGES or f in ADDONS) and strip_shim(out) == open(p, 'rb').read()))
        if not same:
            changes.append(('~ ' if os.path.exists(out) else '+ ') + f)
            if not CHECK:
                os.makedirs(os.path.dirname(out), exist_ok=True)
                shutil.copyfile(p, out)
    if not CHECK:
        for page in SHIM_PAGES:
            add_shim(os.path.join(dst, page))
        for page, scripts in ADDONS.items():
            add_addons(os.path.join(dst, page), scripts)
    return changes


def strip_shim(path):
    b = open(path, 'rb').read()
    b = b''.join(l for l in b.splitlines(True) if ADDON_TAG.encode() not in l)
    return b.replace((SHIM + '\n').encode(), b'', 1)


def copy_local_extras(dst):
    for f in files_in(os.path.join(ROOT, 'tracker')):
        if KEEP_LOCAL.match(f):
            out = os.path.join(dst, f)
            if not os.path.exists(out) and not CHECK:
                os.makedirs(os.path.dirname(out), exist_ok=True)
                shutil.copyfile(os.path.join(ROOT, 'tracker', f), out)


def main():
    if '--addons' in sys.argv:
        # just (re)apply the addon lines to the copies already here, no download
        for d in ('tracker', 'tracker-beta'):
            for page, scripts in ADDONS.items():
                add_addons(os.path.join(ROOT, d, page), scripts)
        return
    tmp = tempfile.mkdtemp(prefix='hutch-')
    rel_dir, beta_dir = os.path.join(tmp, 'release'), os.path.join(tmp, 'beta')
    rel = clone(RELEASE_REPO, rel_dir)
    beta = clone(BETA_REPO, beta_dir)
    rel['version'] = version_of(os.path.join(rel_dir, 'README.md'), 'release')

    print(f'Release {rel["version"]} ({rel["commit"]}, {rel["date"]})')
    ch = sync(rel_dir, os.path.join(ROOT, 'tracker'))
    print('  ' + ('\n  '.join(ch) if ch else 'tracker/ is up to date'))

    beta_files = [f for f in files_in(beta_dir) if f not in ('README.md', 'LICENSE')]
    beta_path = os.path.join(ROOT, 'tracker-beta')
    info = {'release': {'path': 'tracker/', 'version': rel['version'], 'date': rel['date'], 'commit': rel['commit']}}
    if beta_files:
        cl = os.path.join(beta_dir, 'CHANGELOG.md')
        bv = version_of(cl, '') if os.path.exists(cl) else ''
        print(f'Beta {bv or "(no version)"} ({beta["commit"]}, {beta["date"]}): {len(beta_files)} changed files')
        ch = sync(rel_dir, beta_path, overlay=beta_dir)
        if not CHECK:
            copy_local_extras(beta_path)
        print('  ' + ('\n  '.join(ch) if ch else 'tracker-beta/ is up to date'))
        info['beta'] = {'path': 'tracker-beta/', 'version': bv, 'date': beta['date'], 'commit': beta['commit']}
    else:
        print(f'Beta repository has no tracker files right now ({beta["commit"]}, {beta["date"]}): Beta uses the release')
        if os.path.isdir(beta_path):
            print('  - tracker-beta/')
            if not CHECK:
                shutil.rmtree(beta_path)
        info['beta'] = None

    if CHECK:
        return
    with open(os.path.join(ROOT, 'tracker', 'hutch-versions.js'), 'w') as f:
        f.write('// Written by tools/update-hutch.py: which Hutch tracker each "Tracker" choice uses.\n')
        f.write('window.HUTCH_TRACKERS = ' + json.dumps(info, indent=1) + ';\n')

    # offline copy: list exactly the tracker-beta files that exist now
    p = os.path.join(ROOT, 'offline-files.json')
    d = json.load(open(p))
    files = [x for x in d['files'] if not x.startswith('tracker-beta/')]
    if 'tracker/hutch-versions.js' not in files:
        files.append('tracker/hutch-versions.js')
    have_tracker = set(x for x in files if x.startswith('tracker/'))
    for f in files_in(os.path.join(ROOT, 'tracker')):
        if 'tracker/' + f not in have_tracker:
            files.append('tracker/' + f)
    files = [x for x in files if not x.startswith('tracker/') or os.path.exists(os.path.join(ROOT, x))]
    if os.path.isdir(beta_path):
        files += ['tracker-beta/' + f for f in files_in(beta_path)]
    d['files'] = files
    json.dump(d, open(p, 'w'), indent=1)
    open(p, 'a').write('\n')
    subprocess.run([sys.executable, os.path.join(ROOT, 'emu', 'build', 'offline-version.py')], check=True,
                   stdout=subprocess.DEVNULL)
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
