@echo off
cd /d "%~dp0"
echo Starting Build and Release Process...
cd client
call node build-release.js
if %errorlevel% neq 0 (
    echo Error occurred during build/release.
    pause
    exit /b %errorlevel%
)
echo Build and Release completed successfully.
