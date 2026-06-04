@echo off
:: WhipMarks Launcher
:: Starts the Vite dev server silently, then opens the desktop app

set "ROOT=D:\Claude Code\student-marker"
set "NODE=C:\Program Files\nodejs\node.exe"
set "VITE=%ROOT%\node_modules\vite\bin\vite.js"
set "APP=%ROOT%\src-tauri\target\debug\app.exe"

:: Kill any old Vite on 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1

:: Start Vite hidden
start "" /b "%NODE%" "%VITE%" --port 5173

:: Wait until Vite is ready (up to 10s)
set /a tries=0
:wait
ping -n 2 127.0.0.1 >nul
powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:5173 -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel%==0 goto launch
set /a tries+=1
if %tries% lss 10 goto wait

:launch
start "" "%APP%"
