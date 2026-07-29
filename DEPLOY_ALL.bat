@echo off
cd /d "%~dp0"
echo ===================================================
echo   GanjaCraft Launcher - Сборка и деплой
echo ===================================================
echo.

echo --- 1/3 Сборка Bootstrap (GanjaCraft.exe) ---
call BUILD_BOOTSTRAP.bat
if %errorlevel% neq 0 (
    echo [ОШИБКА] Ошибка при сборке Bootstrap!
    pause
    exit /b %errorlevel%
)

echo.
echo --- 2/3 Сборка Клиента (Electron + ZIP обновление) ---
cd client
call node build-release.js
set BUILD_ERR=%errorlevel%
cd ..
if %BUILD_ERR% neq 0 (
    echo [ОШИБКА] Ошибка при сборке Клиента!
    pause
    exit /b %BUILD_ERR%
)

echo ===================================================
echo   [ГОТОВО] Сборка лаунчера завершена!
echo ===================================================
echo.
pause
