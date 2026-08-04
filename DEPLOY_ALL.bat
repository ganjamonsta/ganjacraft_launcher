@echo off
cd /d "%~dp0"
echo ===================================================
echo   GanjaCraft Launcher - Сборка и публикация на GitHub
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
echo   [ГОТОВО] Сборка и публикация лаунчера завершена!
echo   Новый релиз загружен на GitHub.
echo ===================================================
echo.
pause
