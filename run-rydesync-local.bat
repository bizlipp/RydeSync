@echo off
set PORT=3000

:: Get local IP address
for /f "tokens=2 delims=:" %%f in ('ipconfig ^| findstr /C:"IPv4 Address"') do set LOCAL_IP=%%f
set LOCAL_IP=%LOCAL_IP:~1%

:: Start the server
echo 🚀 Starting RydeSync on port %PORT%...
start cmd /k "node server.js"

:: Open browser to local IP
echo 🌐 Opening http://%LOCAL_IP%:%PORT%
start http://%LOCAL_IP%:%PORT%

:: Friendly reminder
echo.
echo ⚠️  If it doesn’t load on other devices:
echo   - Allow Node.js and port %PORT% through Windows Firewall
echo   - Make sure you're on the same network
echo   - Check if server.js is bound to 0.0.0.0 or localhost
echo.

pause
