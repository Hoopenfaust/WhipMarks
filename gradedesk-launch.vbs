' GradeDesk Launcher
' Starts Vite as a fully detached hidden process, then opens the app.
' Run via: wscript.exe gradedesk-launch.vbs  (no console window shown)
Option Explicit

Dim shell, root, node, vite, appExe
Set shell = CreateObject("WScript.Shell")

root    = "D:\Claude Code\student-marker"
node    = "C:\Program Files\nodejs\node.exe"
vite    = root & "\node_modules\vite\bin\vite.js"
appExe  = root & "\src-tauri\target\debug\app.exe"

' Kill any existing process on port 5173
shell.Run "cmd.exe /c for /f ""tokens=5"" %a in ('netstat -ano 2>nul ^| findstr "":5173 ""') do taskkill /PID %a /F >nul 2>nul", 0, True

' Launch Vite completely hidden and detached (windowStyle=0, bWaitOnReturn=False)
' windowStyle 0 = SW_HIDE — no console window allocated for this process.
' bWaitOnReturn False = fire-and-forget; the node.exe process is independent and
' survives after this script (and wscript.exe) exits.
shell.Run """" & node & """ """ & vite & """ --port 5173", 0, False

' Poll until Vite is ready (up to 15 seconds)
Dim i, ready
ready = False
For i = 1 To 15
    WScript.Sleep 1000
    On Error Resume Next
    Dim http
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", "http://localhost:5173", False
    http.SetTimeouts 500, 500, 500, 500
    http.Send
    If Err.Number = 0 Then
        If http.Status = 200 Then
            ready = True
            i = 15  ' break
        End If
    End If
    On Error GoTo 0
    Set http = Nothing
Next

' Open GradeDesk (normal window)
shell.Run """" & appExe & """", 1, False

Set shell = Nothing
