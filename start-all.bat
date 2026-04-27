@echo off
setlocal
cd /d "%~dp0"

echo Running start-all.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo start-all failed with exit code %EXIT_CODE%.
  echo Please review the error output above.
  echo Common causes on a new device:
  echo 1. Node.js is not installed or npm is not in PATH
  echo 2. Maven is not installed or mvn is not in PATH
  echo 3. Java 17+ is not installed or java is not in PATH
  echo 4. Frontend dependency install/build was blocked by permissions or security software
  echo.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Startup completed successfully.
exit /b 0
