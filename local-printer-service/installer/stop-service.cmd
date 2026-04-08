@echo off
taskkill /F /IM node.exe /FI "WINDOWTITLE eq POSapp Local Printer Service*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq POSapp Local Printer Service" >nul 2>&1
exit /b 0
