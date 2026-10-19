@echo off
rem Double-click to start Crowd Control+ (the bridge, the control panel and the overlays).
title Crowd Control+
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again. & pause & exit /b 1)
node bridge.mjs
pause
