@echo off
rem Double-click to play Rando Hub from this folder (no internet install needed).
title Rando Hub
cd /d "%~dp0"
where node >nul 2>nul && (node serve.mjs & pause & exit /b)
where py >nul 2>nul && (echo Starting Rando Hub at http://localhost:8067/ - keep this window open. & start "" http://localhost:8067/ & py -m http.server 8067 --bind 127.0.0.1 --directory app & pause & exit /b)
where python >nul 2>nul && (echo Starting Rando Hub at http://localhost:8067/ - keep this window open. & start "" http://localhost:8067/ & python -m http.server 8067 --bind 127.0.0.1 --directory app & pause & exit /b)
echo Rando Hub needs Node.js to run from this folder.
echo Get the LTS version from https://nodejs.org , install it, then double-click this file again.
echo (Or just play online: https://hugecrankhank.github.io/Rando-hub/ )
pause
