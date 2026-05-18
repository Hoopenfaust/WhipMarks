@echo off
cd /d "D:\Claude Code\student-marker"
start "" "C:\Program Files\nodejs\npm.cmd" run dev
timeout /t 3 /nobreak >nul
start "" "chrome.exe" "http://localhost:5173"
