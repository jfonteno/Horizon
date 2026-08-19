@echo off
setlocal
title Horizon - Shattered Reach
cd /d "%~dp0"

echo ========================================
echo       HORIZON: SHATTERED REACH
echo ========================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo.
  echo Install the current LTS version from https://nodejs.org
  echo Then close this window and run START_HORIZON.bat again.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if %NODE_MAJOR% LSS 22 (
  echo ERROR: Horizon requires Node.js 22 or newer.
  echo Your installed version is:
  node --version
  echo.
  echo Update Node.js from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo First launch: installing Horizon components.
  echo This may take several minutes. Do not close this window.
  echo.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: Horizon could not install its components.
    echo Check the messages above and your internet connection.
    echo.
    pause
    exit /b 1
  )
)

echo Starting the local Horizon server...
echo The game will open at http://localhost:3000
echo Keep this window open while playing.
echo.

set HORIZON_STANDALONE=1
start "Horizon Browser Launcher" /b node.exe "%~dp0scripts\open-horizon-when-ready.mjs"
call npm.cmd run dev -- --host 127.0.0.1 --port 3000

set HORIZON_EXIT=%ERRORLEVEL%
echo.
if not "%HORIZON_EXIT%"=="0" (
  echo ERROR: The Horizon server stopped with error code %HORIZON_EXIT%.
  echo The useful error message should appear above this line.
) else (
  echo The Horizon server has stopped.
)
echo.
pause
exit /b %HORIZON_EXIT%
