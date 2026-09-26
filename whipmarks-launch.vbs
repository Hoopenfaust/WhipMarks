' WhipMarks Launcher
' Opens WhipMarks, starting Vite first if it isn't already running.
' Run via: wscript.exe whipmarks-launch.vbs  (no console window shown)
'
' Never kills anything by port: while WhipMarks is open its own WebView holds
' connections to :5173, so a port-based kill takes down the running app's
' storage and the new window opens signed out with no classes.
Option Explicit

Dim shell, wmi, root, node, vite, appExe, running, proc
Set shell = CreateObject("WScript.Shell")
Set wmi = GetObject("winmgmts:\\.\root\cimv2")

root    = "D:\Claude Code\student-marker"
node    = "C:\Program Files\nodejs\node.exe"
vite    = root & "\node_modules\vite\bin\vite.js"
appExe  = root & "\src-tauri\target\debug\app.exe"

' Already open? Bring that window to the front instead of starting a second copy.
Set running = wmi.ExecQuery("SELECT ProcessId, ExecutablePath FROM Win32_Process WHERE Name = 'app.exe'")
For Each proc In running
    If LCase(proc.ExecutablePath & "") = LCase(appExe) Then
        shell.AppActivate proc.ProcessId
        WScript.Quit
    End If
Next

Function ViteUp()
    Dim http
    ViteUp = False
    On Error Resume Next
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", "http://localhost:5173", False
    http.SetTimeouts 500, 500, 500, 500
    http.Send
    If Err.Number = 0 Then ViteUp = (http.Status = 200)
    On Error GoTo 0
End Function

If Not ViteUp() Then
    ' Hidden, detached Vite. --strictPort: fail rather than drift to 5174+, since the app only loads :5173.
    shell.CurrentDirectory = root
    shell.Run """" & node & """ """ & vite & """ --port 5173 --strictPort", 0, False
    Dim i
    For i = 1 To 20
        WScript.Sleep 1000
        If ViteUp() Then Exit For
    Next
End If

shell.Run """" & appExe & """", 1, False
