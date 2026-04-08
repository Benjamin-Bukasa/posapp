@echo off
setlocal
cd /d %~dp0

if exist ".\dist\posapp-local-printer-service.exe" (
  start "POSapp Local Printer Service" ".\dist\posapp-local-printer-service.exe"
  goto :eof
)

if exist ".\src\server.js" (
  start "POSapp Local Printer Service" cmd /k "node src/server.js"
  goto :eof
)

echo Impossible de trouver l'executable ou le service Node.
pause
