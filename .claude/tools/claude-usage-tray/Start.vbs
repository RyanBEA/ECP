' Launch the tray with no console window.
'
' Optional: ALSO read credentials from a machine where Claude Code runs over
' SSH. The tray checks both the local file and the server's, and uses whichever
' token expires later - so it stays fresh whether you worked here or there.
' Requires non-interactive key auth (ssh user@host must not prompt).
' Leave empty to read only the local ~/.claude/.credentials.json.
Const SSH_SOURCE = "ryan@bae"

Dim shell, here, env
Set shell = CreateObject("WScript.Shell")
Set env = shell.Environment("Process")
If SSH_SOURCE <> "" Then env("CLAUDE_USAGE_TRAY_SSH") = SSH_SOURCE
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "pwsh.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & here & "claude-usage-tray.ps1""", 0, False
