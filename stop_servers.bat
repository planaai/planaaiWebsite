@echo off
title BA_Archive_Stopper
echo ===================================
echo Stopping BA Archive Servers...
echo ===================================

:: 1. Kill the main window if it exists
taskkill /FI "WINDOWTITLE eq BA_Archive_Servers*" /T /F >nul 2>&1

:: 2. Kill processes on specific ports
for %%P in (3000 3001 3002 5173 5555) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%P') do (
        if "%%a" NEQ "0" (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

:: 3. Kill any remaining node processes associated with the project
powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.Name -match 'node.exe' -and ($_.CommandLine -match 'ba_archive' -or $_.CommandLine -match 'prisma') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

:: 4. Kill lingering npm/npx processes
taskkill /F /IM npm.cmd >nul 2>&1
taskkill /F /IM npx.cmd >nul 2>&1
taskkill /F /IM npm.exe >nul 2>&1
taskkill /F /IM npx.exe >nul 2>&1

echo.
echo All BA Archive servers and associated background processes have been stopped!
echo ===================================
pause
