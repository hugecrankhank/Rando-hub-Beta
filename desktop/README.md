# Windows app

`desktop/` turns a Rando Hub release into a Windows program: a folder with
`Rando Hub Beta.exe` (its own icon, its own windows, no browser or Node.js), zipped
as `Rando-Hub-Beta-Windows-v<version>.zip` and attached to every GitHub Release by
the Release workflow. Nothing to do by hand: bump the version as usual
(`tools/set-version.py`), push, and the release gets the Windows zip too.

It's Electron around the exact `app/` folder of that release, served from a
built-in web server on `http://127.0.0.1:<port>` (loopback only; the seed
relays accept that address, service workers and saves work as on the site).

```
desktop/
  config.json            which app this is: name, app id, repo, website, port, zip name
  src/main.js            the program: server, windows, menu, update checks
  src/preload.js         the update button in the header (top right)
  src/icon.png           window icon
  build/build-win.sh     builds the zip on Linux/macOS (no Wine): Electron's official
                         Windows build + the app + a renamed, re-iconed .exe
  build/pe_resources.py  sets the .exe's icon and version info (pure Python + pefile)
  build/patch_web.py     seed share links made in the app point at the website
  build/make_ico.py      build/icon.ico from icons/icon-512.png
  build/README-Desktop.txt   the README.txt inside the zip
```

## Build it yourself

```
python3 tools/make-release.py                 # dist/Rando-Hub-v<version>.zip
unzip dist/Rando-Hub-v*.zip -d /tmp/rh
pip install pefile
desktop/build/build-win.sh /tmp/rh/Rando-Hub-v*/app dist
```

The Electron version is the third argument (default 44.9.3); its download is
checked against Electron's published SHA-256 sums.

## What the program does

- Pop-outs (`window.open` to the app's own pages) become native windows; any
  other site opens in the default browser.
- No background throttling or occlusion pausing: the emulator keeps full speed
  when a pop-out or another app is in front. Audio autoplays.
- Remembers its window; one instance at a time; a `data` folder next to the
  .exe makes it portable (saves kept there instead of `%APPDATA%`).
- **Updates:** checks at start and every 4 hours against the latest GitHub
  Release (its Windows zip) and the website's `<meta name="version">`. The
  header gets a button (top right): *Check for updates*, *Update vX.Y.Z*
  (green), download progress, or *Up to date*. A new version is announced once.
  *Download update* saves the zip to Downloads; *Play the website version*
  switches to the live site.
- **Menu → Version:** the built-in copy (offline) or the live website (separate
  saves).
- The main repository (Rando-hub) has its own `config.json` (Rando Hub, port 47067,
  its own releases), so both apps can be installed side by side.
