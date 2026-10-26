{{NAME}} FOR WINDOWS  v{{VERSION}}
A Link to the Past Randomizer + Snes9x emulator + trackers, as a Windows app.
=========================================================================

START
  Double-click "{{NAME}}.exe" in this folder. Nothing to install: no
  Node.js, no browser needed.

  First time only: Windows may say "Windows protected your PC" because the
  app isn't code-signed. Click "More info" -> "Run anyway".

  Keep the whole folder together (the .exe needs the files next to it).
  Put it anywhere you like, e.g. C:\Games\{{NAME}}, then right-click
  "{{NAME}}.exe" -> "Pin to Start", or "Send to -> Desktop (create
  shortcut)".

WHAT YOU NEED
  Your own Japanese 1.0 ALttP ROM (.sfc), the same as on the website.
  It never leaves your computer.

HOW IT DIFFERS FROM THE WEBSITE
  - It's the same app (the same files as the website, v{{VERSION}}), in its
    own window. Everything works offline except what needs the internet
    anyway (alttpr.com / AVIANART seeds, the sprite library). Kara's
    generator and the Python it runs on are built in.
  - Pop-out tracker windows, Stream windows, Timer and Broadcast open as
    real windows you can move, resize and capture in OBS (Window Capture).
  - The game keeps running at full speed when another window is in front.
  - Links to other sites open in your normal browser.
  - Seed links you share point at the website, so friends can open them.
  - Saves, presets and settings live in %APPDATA%\{{NAME}} and are kept
    when you replace the folder with a newer version. They're separate
    from the website's saves in your browser.

UPDATES
  {{NAME}} checks for updates when it starts and every few hours. When a
  new version is out it tells you once, and the button at the top right of
  the screen turns green ("Update vX.Y.Z"). Click it any time:
    - Download update: saves the new version to your Downloads folder.
      Close {{NAME}}, unzip it and replace this folder with the new one.
      Your saves and settings are kept.
    - Play the website version: switches to the live site right away.
  When there's nothing new, the same button says "Check for updates".

MENU (press Alt if the menu bar is hidden)
  File     -> Open data folder, Exit
  View     -> Reload, Zoom, Full screen (F11), Developer tools
  Version  -> Built-in v{{VERSION}} (works offline), or
              Website (always the newest version; separate saves)
              Check for updates... (also the button at the top right)
  Help     -> Manual, changelog, About

PORTABLE MODE (USB stick)
  Make an empty folder called "data" next to "{{NAME}}.exe". From then on
  all saves and settings are kept in that folder instead of %APPDATA%.

TROUBLESHOOTING
  - Black or blank window: View -> Force reload. Still blank? Close the app,
    delete %APPDATA%\{{NAME}}\Cache and start again.
  - Controller not detected: press a button on it once with the game window
    focused (the app only sees a pad after a button press).
  - Crowd Control+ (TikTok gifts) is a separate download, as before: run its
    bridge, then Crowd effects in the app connects to ws://localhost:21214.

LICENSES
  Rando Hub: LICENSE.md and NOTICE.md (and Credits inside the app).
  Electron: LICENSE.electron.txt. Chromium: LICENSES.chromium.html.
