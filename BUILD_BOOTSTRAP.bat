@echo off
cd /d "%~dp0"
echo Starting Bootstrap Auto-Build...
python bootstrap/build.py
pause
