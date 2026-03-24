@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_EXE=powershell.exe"

"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\deploy-ftp.ps1" -Mode Changed -IncludeUntracked -DryRun %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo FTP dry-run failed with exit code %EXIT_CODE%.
  exit /b %EXIT_CODE%
)

echo.
echo FTP dry-run finished successfully.
exit /b 0