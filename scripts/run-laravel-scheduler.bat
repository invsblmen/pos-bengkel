@echo off
setlocal
cd /d "%~dp0.."
set "PHP_BIN=%USERPROFILE%\.config\herd\bin\php.bat"
if exist "%PHP_BIN%" (
	call "%PHP_BIN%" artisan schedule:run
) else (
	php artisan schedule:run
)
endlocal
