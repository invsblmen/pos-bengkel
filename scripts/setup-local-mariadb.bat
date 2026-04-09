@echo off
setlocal

set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
set MYSQL_USER=pos_bengkel
set MYSQL_PASSWORD=pos_bengkel_password

where mysql >nul 2>nul
if errorlevel 1 (
  echo mysql client not found in PATH. Install MariaDB/MySQL client first.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-local-mariadb.ps1" -MysqlHost %MYSQL_HOST% -MysqlPort %MYSQL_PORT% -MysqlUser %MYSQL_USER% -MysqlPassword "%MYSQL_PASSWORD%"

if errorlevel 1 (
  echo MariaDB local setup failed.
  exit /b 1
)

echo MariaDB local setup completed successfully.
endlocal
