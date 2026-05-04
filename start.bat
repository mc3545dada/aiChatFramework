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
echo Open http://localhost:3001 in your browser
echo Press Ctrl+C to stop the server
echo.
call npm start

pause
