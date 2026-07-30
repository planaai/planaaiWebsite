@echo off
title BA_Archive_Servers
echo ===================================
echo Starting BA Archive Servers in this window...
echo ===================================

echo [1/3] Starting Frontend Server (Vite)...
start /b cmd /c "cd frontend && set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev -- --host"

echo [2/3] Starting Client Server (Next.js Port 3001)...
start /b cmd /c "cd client && set NODE_OPTIONS=--max-old-space-size=8192 && npm run dev -- -H 0.0.0.0"

echo [3/3] Starting PvP Server (Next.js Port 3002)...
start /b cmd /c "cd client-pvp && set NODE_OPTIONS=--max-old-space-size=4096 && npm run dev -- -p 3002 -H 0.0.0.0"

echo.
echo ===================================
echo All servers are running in this single window!
echo (Outputs from all servers will be mixed here)
echo.
echo To safely stop all servers:
echo Double-click 'stop_servers.bat' in the folder.
echo ===================================
:: Keep the window open so we can see the logs
cmd /k

