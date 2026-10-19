@echo off
rem Double-click to start the Rando Hub crowd-control bridge.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and try again. & pause & exit /b 1)
node bridge.mjs
pause
