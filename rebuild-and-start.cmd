@echo off
setlocal
cd /d "%~dp0"
echo === RealityWarden: rebuilding Next production bundle ===
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED - leave this window open and tell Claude.
  pause
  exit /b 1
)
echo === Build OK. Starting desktop app ===
call npm run desktop:start
pause
