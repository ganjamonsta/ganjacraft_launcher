@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo   GanjaCraft Launcher - Сборка и публикация на GitHub
echo ===================================================
echo.

set "USER_NOTE=%~1"
if "%USER_NOTE%"=="" (
    echo [?] Введите описание обновления лаунчера:
    echo     (или нажмите ENTER для автогенерации из Git коммитов)
    set /p "USER_NOTE=> "
)

echo.
echo --- Сборка Клиента (Electron NSIS Установщик) ---
cd client
if not "!USER_NOTE!"=="" (
    call node build-release.js "!USER_NOTE!"
) else (
    call node build-release.js
)
set BUILD_ERR=%errorlevel%
cd ..
if %BUILD_ERR% neq 0 (
    echo.
    echo [ОШИБКА] Ошибка при сборке Клиента!
    pause
    exit /b %BUILD_ERR%
)

echo.
echo ===================================================
echo   [ГОТОВО] Сборка и публикация лаунчера завершена!
echo   Новый релиз загружен на GitHub.
echo ===================================================
echo.
pause
