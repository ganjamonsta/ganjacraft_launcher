@echo off
cd /d "%~dp0"
echo ===================================================
echo   GanjaCraft Launcher - Сборка и деплой
echo ===================================================
echo.

echo --- Сборка Клиента (Electron NSIS Установщик) ---
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
echo   Файлы установщика лежат в deploy_www/api/launcher/files/
echo ===================================================
echo.
pause
