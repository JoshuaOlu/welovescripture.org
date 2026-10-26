@echo off
rem Double-click this file on Windows to open the We Love Scripture console.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo The console needs Node.js, a free helper program.
  echo Opening the download page. Install the LTS version, then double-click this file again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
:again
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 ( echo Something went wrong. & pause & exit /b 1 )
node console\server.mjs
if %errorlevel%==75 ( echo Restarting after an update... & goto again )
echo.
echo The console has stopped.
pause
