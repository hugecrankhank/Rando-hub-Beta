@echo off
rem Double-click to start Crowd Control+ (the bridge, the control panel and the overlays).
title Crowd Control+
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again. & pause & exit /b 1)
rem First time only: the Direct TikTok connection needs one package (about a minute).
if not exist "node_modules\tiktok-live-connector\package.json" (
  where npm >nul 2>nul && (
    echo Setting up the TikTok connection ^(first time only, about a minute^)...
    call npm install --omit=dev --no-audit --no-fund --loglevel=error
  )
)
node bridge.mjs
pause
