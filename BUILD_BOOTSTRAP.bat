@echo off
cd /d "%~dp0"
echo [1/3] Building Bootstrap...
cd bootstrap
python -m PyInstaller --clean --noconfirm --onefile --windowed --icon "assets/icon.ico" --add-data "assets/logo.png;assets" --name "GanjaCraft" main.py

echo.
echo [2/3] Copying to Server Storage...
copy /Y dist\GanjaCraft.exe ..\..\ganjacrafter_bot\storage\launcher\GanjaCraft.exe

echo.
echo [3/3] Done! Don't forget to update bootstrap.json if you want to force update for everyone.