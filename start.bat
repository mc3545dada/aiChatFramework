@echo off
cd /d "%~dp0"
echo ========================================
echo   aiChatFramework Launcher
echo ========================================
echo.

cd backend

:: Auto-create .env from template if missing
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo First time setup: .env file created from .env.example
        echo Please edit backend\.env to set your API_KEY before using.
        echo.
    )
)

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
start /MIN "aiChatFramework" node server.js

:: Wait for server to be ready
echo Waiting for server...
timeout /t 3

:: Open browser
start http://localhost:3001

exit
