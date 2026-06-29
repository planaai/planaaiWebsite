@echo off
title BA_Archive_Servers
echo ===================================
echo Starting BA Archive Servers in this window...
echo ===================================

echo [1/4] Starting Prisma Dev (Local PostgreSQL)...
start /b cmd /c "cd backend && set NODE_OPTIONS=--max-old-space-size=512 && npx prisma dev"

echo Waiting 5 seconds for DB engine to start...
timeout /t 5 /nobreak >nul

echo [2/4] Starting Backend Server (Port 3000)...
start /b cmd /c "cd backend && set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev"

echo [3/4] Starting Frontend Server (Vite)...
start /b cmd /c "cd frontend && set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev"

echo [4/4] Starting Client Server (Next.js Port 3001)...
start /b cmd /c "cd client && set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev"

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

