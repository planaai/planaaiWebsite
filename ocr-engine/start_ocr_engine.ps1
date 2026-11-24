$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = "1"
Set-Location -LiteralPath $PSScriptRoot

$pythonExe = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$modelFile = Join-Path $PSScriptRoot "models\korean_PP-OCRv3_rec_infer.onnx"

if (-not (Test-Path -LiteralPath $pythonExe)) {
    Write-Error ".venv\Scripts\python.exe not found. Create venv with Python 3.14 and install requirements.txt."
    exit 1
}
if (-not (Test-Path -LiteralPath $modelFile)) {
    Write-Error "models\korean_PP-OCRv3_rec_infer.onnx not found."
    exit 1
}

$port = if ($env:OCR_ENGINE_PORT) { $env:OCR_ENGINE_PORT } else { "8090" }
$envPath = Join-Path $PSScriptRoot ".env"
if ((Test-Path -LiteralPath $envPath) -and (-not $env:OCR_ENGINE_PORT)) {
    foreach ($line in Get-Content -LiteralPath $envPath -Encoding UTF8) {
        if ($line -match '^\s*OCR_ENGINE_PORT\s*=\s*(.+?)\s*$') {
            $val = $matches[1].Trim('"', "'")
            if ($val) { $port = $val }
        }
    }
}

& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $port --workers 1 --timeout-keep-alive 65
