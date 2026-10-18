@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================================
echo  SquadLink - Windows Native Desktop Packager (Electron)
echo ========================================================

cd /d "%~dp0\..\desktop"

echo [1/3] Installing Electron dependencies...
call npm install

echo [2/3] Building Windows Desktop Executable...
call npm run build

echo [3/3] Windows Desktop packaging complete!
echo Output located at: desktop\dist\SquadLink Setup 1.0.0.exe
pause
