@echo off
setlocal
set "APP_DIR=%~dp0"
start "POSapp Local Printer Service" /min "%APP_DIR%node.exe" "%APP_DIR%src\server.js"
exit /b 0
