@echo off
rem Practice mode: no TikTok needed. Type commands in this window (gift Rose 3, chat !rules ...)
rem or use the Test buttons on the control panel.
title Crowd Control+ (test mode)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again. & pause & exit /b 1)
node bridge.mjs --test
pause
