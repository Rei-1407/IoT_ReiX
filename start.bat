@echo off
title IoT ReiX - SmartHome
echo ========================================
echo   IoT ReiX SmartHome - Starting...
echo ========================================
echo.

echo [1/3] Starting Mosquitto (port 1407)...
pushd "C:\Program Files\Mosquitto"
start /B mosquitto.exe -c mosquitto.conf -v
popd
timeout /t 2 /nobreak >nul

echo [2/3] Starting Backend (port 5000)...
start /B cmd /c "cd /d %~dp0backend && node server.js"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend (port 3000)...
start /B cmd /c "cd /d %~dp0frontend && npm start"

echo.
echo ========================================
echo   All services running!
echo   Mosquitto: localhost:1407
echo   Backend:   http://localhost:5000
echo   Frontend:  http://localhost:3000
echo   API Docs:  http://localhost:5000/api-docs
echo ========================================
echo.
echo Close this window to stop all services.
echo.

:loop
timeout /t 1 /nobreak >nul
goto loop
