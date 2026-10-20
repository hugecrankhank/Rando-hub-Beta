# Muffins' Tracker 2.0 in Rando Hub

**The tracker is Muffins' (MFNS / KrisDavie):** https://github.com/KrisDavie/alttptracker
(`react_rewrite` branch), also at https://volatile.alttprtracker.mfns.dev/. Used with
his permission and under his MIT license (`LICENSE`, copied from his repo). Bugs in the tracker itself → his Discord. Bugs in running it inside
Rando Hub → Rando Hub.

- `app/` is his source **built unchanged** (by `.github/workflows/mfns-build.yml`,
  from the commit in `COMMIT`; the build's own commit is in `app/SOURCE_COMMIT`). The only
  build option is where it's served from (Vite `--base`).
- `index.html` is his page with two Rando Hub loaders in front (made by
  `tools/mfns-page.py`):
  - `../bridge/sni-shim.js`: answers his QUsb2snes autotracking from Rando Hub's
    built-in emulator (the same as for Hutch's tracker).
  - `embed.js`: lets it run from this subfolder without changing his code. It
    gives him his routes as the page path, points his pictures at `app/`, opens
    his tracker in Rando Hub's panel instead of a new window, and the first time
    sets autotracking to QUsb2snes on localhost:23074.
- To update: put his newer commit in `COMMIT` and push; the workflow rebuilds.
