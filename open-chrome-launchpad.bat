@echo off
title QiPlus Onboarding Launchpad
cd /d "C:\Users\Kiran\.gemini\antigravity\scratch\qiplus-e2e"

:: Check if Launchpad server is already running on port 4500
netstat -ano | findstr /R /C:":4500 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Starting QiPlus Launchpad Server on port 4500...
    start "" /b node launchpad-server.js
    timeout /t 2 /nobreak >nul 2>&1
)

:: Open directly in Google Chrome (or default browser)
start "" "http://localhost:4500"
exit
