@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Alpha Radar - Windows One-Click Launcher
echo ============================================
echo.
echo Starting local dashboard at http://127.0.0.1:4173
echo Keep this window open while using Alpha Radar.
echo Press Ctrl+C in this window to stop the local server.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173"
  py -3 -m http.server 4173 --directory "%~dp0dist"
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173"
  python -m http.server 4173 --directory "%~dp0dist"
  goto :eof
)

echo Python was not found.
echo Install Python 3 from https://www.python.org/downloads/windows/
echo During installation, enable "Add python.exe to PATH".
pause
