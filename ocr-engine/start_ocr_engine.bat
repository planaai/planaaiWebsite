@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
set "PYTHONUTF8=1"
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] .venv\Scripts\python.exe not found. Run: py -3.14 -m venv .venv ^&^& .venv\Scripts\python.exe -m pip install -r requirements.txt
  exit /b 1
)

if not exist "models\korean_PP-OCRv3_rec_infer.onnx" (
  echo [ERROR] models\korean_PP-OCRv3_rec_infer.onnx not found.
  exit /b 1
)

set "PORT=8090"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="OCR_ENGINE_PORT" if not "%%B"=="" set "PORT=%%B"
  )
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port %PORT% --workers 1 --timeout-keep-alive 65
