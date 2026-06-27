@echo off
:: WhipMarks Launcher

set "ROOT=D:\Claude Code\student-marker"
set "APP=%ROOT%\src-tauri\target\debug\app.exe"

:: If Vite is already up, just open the app
powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:5173 -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel%==0 goto launch

:: Kill anything stale on 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1

:: Start Vite as a fully hidden detached process using a helper ps1
powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile','-WindowStyle','Hidden','-Command','cd ''D:\Claude Code\student-marker''; & ''C:\Program Files\nodejs\node.exe'' ''D:\Claude Code\student-marker\node_modules\vite\bin\vite.js'' --port 5173' -WindowStyle Hidden"

:: Wait up to 20s for Vite to be ready
set /a tries=0
:wait
ping -n 2 127.0.0.1 >nul
powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:5173 -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel%==0 goto launch
set /a tries+=1
if %tries% lss 20 goto wait

:launch
start "" "%APP%"
