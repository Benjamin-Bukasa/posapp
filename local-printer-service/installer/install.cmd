@echo off
setlocal

set "SOURCE_DIR=%~dp0"
set "BASE_DIR=%SOURCE_DIR%"
set "TARGET_DIR=%LOCALAPPDATA%\POSapp Local Printer Service"

if exist "%SOURCE_DIR%app\node.exe" set "BASE_DIR=%SOURCE_DIR%app\"

echo Installation de POSapp Local Printer Service...

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\src" mkdir "%TARGET_DIR%\src"
if not exist "%TARGET_DIR%\scripts" mkdir "%TARGET_DIR%\scripts"

copy /Y "%BASE_DIR%node.exe" "%TARGET_DIR%\node.exe" >nul
copy /Y "%BASE_DIR%src\server.js" "%TARGET_DIR%\src\server.js" >nul
copy /Y "%BASE_DIR%src\printerService.js" "%TARGET_DIR%\src\printerService.js" >nul
copy /Y "%BASE_DIR%scripts\list-printers.ps1" "%TARGET_DIR%\scripts\list-printers.ps1" >nul
copy /Y "%BASE_DIR%scripts\print-raw.ps1" "%TARGET_DIR%\scripts\print-raw.ps1" >nul
copy /Y "%BASE_DIR%.env.example" "%TARGET_DIR%\.env.example" >nul
copy /Y "%BASE_DIR%README.md" "%TARGET_DIR%\README.md" >nul
copy /Y "%BASE_DIR%run-service.cmd" "%TARGET_DIR%\run-service.cmd" >nul
copy /Y "%BASE_DIR%stop-service.cmd" "%TARGET_DIR%\stop-service.cmd" >nul

if errorlevel 1 (
  echo Echec de la copie des fichiers du service local.
  exit /b 1
)

echo.
echo Service installe dans:
echo %TARGET_DIR%
echo.
echo Demarrage du service local...

start "POSapp Local Printer Service" /min "%TARGET_DIR%\node.exe" "%TARGET_DIR%\src\server.js"

echo.
echo Installation terminee.
echo URL locale: http://127.0.0.1:3210
echo.
echo Tu peux maintenant choisir "Service local ESC/POS" dans POSapp.
exit /b 0
