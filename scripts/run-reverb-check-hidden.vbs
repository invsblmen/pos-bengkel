Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""c:\Developments\Laravel\Laravel 12\POS\pos_bengkel\scripts\ensure-reverb-running.ps1""", 0, False
