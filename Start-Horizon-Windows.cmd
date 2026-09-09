@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Horizon Windows Launcher

rem Keep this launcher beside package.json in the Horizon project folder.
cd /d "%~dp0"

echo.
echo ============================================================
echo   Horizon: Shattered Reach - Windows Launcher
echo ============================================================
echo.

if not exist "package.json" (
  echo ERROR: package.json was not found.
  echo Place this launcher in the main Horizon folder and try again.
  goto :failure
)

where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22.13.0 or newer and try again.
  goto :failure
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm included.
  goto :failure
)

for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "HORIZON_VERSION=%%V"
for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"

node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0] < 22 || (v[0] === 22 && v[1] < 13) ? 1 : 0)" 2>nul
if errorlevel 1 (
  echo ERROR: Node.js %NODE_VERSION% is too old.
  echo Horizon requires Node.js 22.13.0 or newer.
  goto :failure
)

echo Horizon version: %HORIZON_VERSION%
echo Node.js version:  %NODE_VERSION%
echo.

if not exist "data\rooms" mkdir "data\rooms"
if not exist "data\content" mkdir "data\content"
if not exist "backups" mkdir "backups"

set "NEEDS_SETUP=0"
if /I "%~1"=="--rebuild" set "NEEDS_SETUP=1"
if not exist "node_modules\.package-lock.json" set "NEEDS_SETUP=1"
if not exist "dist\client\assets" set "NEEDS_SETUP=1"
if not exist ".horizon-windows-build" set "NEEDS_SETUP=1"

if exist ".horizon-windows-build" (
  set /p BUILT_VERSION=<".horizon-windows-build"
  if not "!BUILT_VERSION!"=="%HORIZON_VERSION%" set "NEEDS_SETUP=1"
)

if "%NEEDS_SETUP%"=="1" (
  echo Preparing Horizon. The first run may take several minutes.
  echo.
  call npm.cmd ci
  if errorlevel 1 (
    echo.
    echo ERROR: Horizon dependencies could not be installed.
    goto :failure
  )

  call npm.cmd run build:self-hosted
  if errorlevel 1 (
    echo.
    echo ERROR: Horizon could not be built.
    goto :failure
  )

  >".horizon-windows-build" echo %HORIZON_VERSION%
  echo.
  echo Horizon is prepared.
  echo.
)

set "NODE_ENV=production"
set "HOST=127.0.0.1"
set "PORT=3000"
set "HORIZON_DATA_DIR=%CD%\data\rooms"
set "HORIZON_CONTENT_DIR=%CD%\data\content"

node scripts\open-horizon-when-ready.mjs --check-once >nul 2>&1
if not errorlevel 1 goto :already_running

node scripts\open-horizon-when-ready.mjs --health-once >nul 2>&1
if not errorlevel 1 (
  echo ERROR: An older or incomplete Horizon server is already using port 3000.
  echo Stop its Horizon Server window with Ctrl+C, then run this launcher again.
  goto :failure
)

echo Starting Horizon in a separate server window...
start "Horizon Server - Keep This Window Open" cmd.exe /k "npm.cmd run start:self-hosted"

echo Waiting for Horizon and its compiled assets...
set "HORIZON_OPEN_URL=http://127.0.0.1:3000"
sc.exe query cloudflared >nul 2>&1
if errorlevel 1 (
  echo.
  echo NOTICE: The Cloudflare connector service is not installed yet.
  echo Complete Cloudflare's one-time Windows connector command as Administrator.
) else (
  sc.exe query cloudflared | findstr /I "RUNNING" >nul 2>&1
  if errorlevel 1 (
    echo.
    echo NOTICE: The Cloudflare connector is installed but is not running.
    echo Start the cloudflared Windows service as Administrator.
  ) else (
    echo Cloudflare connector: running
    set "HORIZON_OPEN_URL=https://play.horizongame.us"
  )
)

node scripts\open-horizon-when-ready.mjs --wait-open
if errorlevel 1 (
  echo.
  echo ERROR: Horizon or its visual assets did not become healthy.
  echo Review the separate Horizon Server window for the error message.
  goto :failure
)

goto :healthy

:already_running
echo Horizon is already running on this computer.
set "HORIZON_OPEN_URL=http://127.0.0.1:3000"
sc.exe query cloudflared | findstr /I "RUNNING" >nul 2>&1
if not errorlevel 1 set "HORIZON_OPEN_URL=https://play.horizongame.us"
node scripts\open-horizon-when-ready.mjs --wait-open

:healthy
echo.
echo Horizon and its visual assets are healthy.
echo Local address: http://127.0.0.1:3000
if "%HORIZON_OPEN_URL%"=="https://play.horizongame.us" echo Public address: https://play.horizongame.us

echo.
echo Keep the separate Horizon Server window open during play.
echo To stop Horizon safely, click that window and press Ctrl+C once.
echo.
pause
exit /b 0

:failure
echo.
echo Horizon was not started. No room data was deleted or replaced.
echo.
pause
exit /b 1
