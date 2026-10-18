@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================================
echo  SquadLink - Android Release APK Direct Builder
echo ========================================================

cd /d "%~dp0\..\mobile"

echo [1/3] Installing Expo and mobile dependencies...
call npm install

echo [2/3] Configuring standalone APK build configuration...
echo Using expo-location, background tasks (10-min radar) and LiveKit voice.

echo [3/3] To compile the standalone release .apk file directly for $0 budget (bypassing Google Play):
echo Run:
echo   npx eas-cli build --platform android --profile preview --local
echo Or:
echo   npx expo run:android --variant release
echo.
echo The resulting APK can be transferred and installed directly via sideloading on any Android phone!
pause
