@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo   Ganj4Craft Launcher - Сборка релиза клиента
echo ===================================================
echo.

set "USER_NOTE=%~1"
if "%USER_NOTE%"=="" (
    echo [?] Введите описание обновления лаунчера:
    echo     (или нажмите ENTER для автогенерации из Git коммитов)
    set /p "USER_NOTE=> "
)

echo.
echo Starting Build and Release Process...
cd client
if not "!USER_NOTE!"=="" (
    call node build-release.js "!USER_NOTE!"
) else (
    call node build-release.js
)
if %errorlevel% neq 0 (
    echo Error occurred during build/release.
    pause
    exit /b %errorlevel%
)
cd ..
echo Build and Release completed successfully.
echo Files ready in deploy_www folder.
if exist "%~dp0deploy_www" (
    explorer "%~dp0deploy_www"
)
pause
