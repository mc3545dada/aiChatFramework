@echo off
cd /d "%~dp0"
echo ========================================
echo   AI Chat Launcher
echo ========================================
echo.

cd backend
echo [1/2] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies. Make sure Node.js is installed.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting server...
echo.

:: Start server in a new window
start /MIN "AI Chat Server" node server.js

:: Wait for server to be ready
echo Waiting for server...
timeout /t 3

:: Open browser
start http://localhost:3001

echo.
echo Server: http://localhost:3001
echo Close the server window to stop.
echo.
pause
