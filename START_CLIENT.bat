@echo off
cd /d "%~dp0client"
echo Starting Ganj4Craft Launcher...
call npm start
if %errorlevel% neq 0 (
    echo.
    echo Launcher exited with error code %errorlevel%.
    pause
)
