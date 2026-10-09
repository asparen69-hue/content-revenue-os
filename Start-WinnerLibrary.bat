@echo off
title Content Revenue OS - Winner Library
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %*
echo.
pause
