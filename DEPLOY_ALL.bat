@echo off
cd /d %~dp0
echo --- Building and Deploying Bootstrap ---
call BUILD_BOOTSTRAP.bat
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo --- Building and Deploying Client ---
cd client
call npm run release
cd ..

echo.
echo --- All Done! ---
pause
