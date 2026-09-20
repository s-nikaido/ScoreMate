@echo off
cd /d "%~dp0.."
call npm install jsdom fake-indexeddb --no-save
node test/data-tests.js
pause
