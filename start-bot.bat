@echo off
echo ==============================================
echo 🚀 Starting DK Clim WhatsApp Bot & Tunnel...
echo ==============================================
echo.

cd /d "%~dp0"
pm2 start index.js --name "dk-clim-bot"
pm2 start tunnel.js --name "localtunnel"
pm2 save

echo.
echo ✅ Bot and Tunnel are now running in the background!
echo You can safely close this window.
pause
