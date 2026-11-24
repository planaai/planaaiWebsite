# Plana.AI Self-Hosted OCR Engine (`ocr-engine`)

Self-hosted FastAPI OCR service (`127.0.0.1:8090`, `--workers 1`) replacing NVIDIA NIM for Blue Archive student screenshot extraction.

## Attribution & License

The OCR extraction core, coordinate presets, equipment/favorite readers, Korean PP-OCRv3 ONNX model (`models/korean_PP-OCRv3_rec_infer.onnx`, `models/korean_dict.txt`), and scene fixtures in `vendor/`, `config/`, `models/`, `students.json`, and `tests/fixtures/` are ported from:

- **Repository**: `https://github.com/planaai/screenshotMacro`
- **Commit**: `54b39947bd81d0ba9903bdbed9f55c9220cbd78f` (`54b3994`)
- **License**: **GPL-3.0**

Desktop GUI, macro automation, mouse/keyboard capture, NIM client, and unconditional disk logging modules are excluded. Uploaded images are decoded strictly in memory via `cv2.imdecode` and never written to disk unless `OCR_AUDIT_DIR` is explicitly set (24h TTL auto-purge).

## Windows 11 Setup (Python 3.14)

```powershell
cd ocr-engine
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
# Edit .env and set OCR_ENGINE_TOKEN
```

> `rapidocr-onnxruntime==1.2.3` is pinned for Python 3.14 compatibility. Keep `models/korean_PP-OCRv3_rec_infer.onnx` and `models/korean_dict.txt` inside `ocr-engine/models/` (`.onnx` is gitignored).

## Run

- PowerShell: `.\start_ocr_engine.ps1`
- CMD / Batch: `start_ocr_engine.bat`

Binds strictly to `127.0.0.1:8090` (`OCR_ENGINE_PORT`) with `--workers 1` and bounded concurrency (`OCR_ENGINE_CONCURRENCY=2`).

## Endpoints

- `GET /healthz` — `{ ok, version, modelsLoaded, studentNamesCount }`
- `POST /v1/recognize` (header `X-Engine-Token`) — multipart slots `main` (required), `equip1..3`, `favorite` -> `{ data, meta }` matching `contract/recognize.schema.json`
- `POST /v1/students/reload` (header `X-Engine-Token`) — refreshes student list from `BACKEND_INTERNAL_URL/api/students/names` with `students.json` fallback

## Test

```powershell
cd ocr-engine
.venv\Scripts\python.exe -m pytest -v
```

## Cloudflare Tunnel (`cloudflared`) & Zero Trust Access Setup (Windows 11)

1. **Create Tunnel**: In Cloudflare Zero Trust Dashboard → **Networks** → **Tunnels** → **Create a tunnel** (`Cloudflared`), name it `plana-win11-ocr`.
2. **Install Windows Service (Admin PowerShell)**:
   ```powershell
   winget install --id Cloudflare.cloudflared -e
   cloudflared.exe service install <DASHBOARD_TUNNEL_TOKEN>
   ```
3. **Public Hostname Mapping**:
   - Hostname: `ocr.plan4ai.fyi` → Service: `http://127.0.0.1:8090`
   - FastAPI stays bound strictly to `127.0.0.1:8090`; no router port-forwarding is required.
4. **Zero Trust Access Policy**:
   - Zero Trust → **Access** → **Applications** → **Add an application (Self-hosted)** for `ocr.plan4ai.fyi`.
   - Add a `Bypass` policy restricted to the Linux backend server public IP (`<BACKEND_SERVER_IP>/32`) or a `Service Auth` policy, in addition to the mandatory `X-Engine-Token` shared secret header.
5. **Backend `.env`**:
   ```ini
   OCR_ENGINE_URL="https://ocr.plan4ai.fyi"
   OCR_ENGINE_TOKEN="<same_secret_as_ocr_engine>"
   OCR_ENGINE_TIMEOUT_MS=20000
   OCR_MAX_CONCURRENT=2
   ```
