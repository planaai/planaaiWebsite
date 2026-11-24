from __future__ import annotations

import hmac
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, load_settings
from app.pipeline import ALLOWED_SLOTS, MAX_FILE_BYTES, ApiError, OcrPipeline


def _error_payload(code: str, message: str, detail: dict | None = None) -> dict:
    body: dict = {"code": code, "message": message}
    if detail is not None:
        body["detail"] = detail
    return body


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or load_settings()
    pipeline = OcrPipeline(cfg)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        pipeline.startup()
        app.state.settings = cfg
        app.state.pipeline = pipeline
        try:
            yield
        finally:
            pipeline.shutdown()

    app = FastAPI(title="Plana.AI Self-Hosted OCR Engine", version=cfg.ENGINE_VERSION, lifespan=lifespan)
    app.state.settings = cfg
    app.state.pipeline = pipeline

    @app.exception_handler(ApiError)
    async def handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.code, exc.message, exc.detail),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload("HTTP_ERROR", str(exc.detail or "Request failed.")),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=_error_payload("BAD_REQUEST", str(exc)),
        )

    def require_engine_token(request: Request) -> None:
        token = request.headers.get("X-Engine-Token", "")
        if not token:
            raise ApiError(401, "UNAUTHORIZED", "Missing X-Engine-Token header.")
        expected = app.state.settings.OCR_ENGINE_TOKEN
        if not expected or not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
            raise ApiError(403, "FORBIDDEN", "Invalid X-Engine-Token header.")

    api_router = APIRouter()

    @api_router.get("/healthz")
    async def healthz() -> dict:
        return {
            "ok": pipeline.models_loaded,
            "version": cfg.ENGINE_VERSION,
            "modelsLoaded": pipeline.models_loaded,
            "studentNamesCount": pipeline.student_names_count,
        }

    @api_router.post("/v1/students/reload", dependencies=[Depends(require_engine_token)])
    async def reload_students() -> dict:
        return await pipeline.reload_students()

    @api_router.post("/v1/recognize", dependencies=[Depends(require_engine_token)])
    async def recognize(request: Request) -> dict:
        form = await request.form()
        slot_bytes: dict[str, bytes] = {}
        try:
            for field_name, value in form.multi_items():
                if field_name not in ALLOWED_SLOTS:
                    raise ApiError(400, "INVALID_SLOT", f"Unknown upload slot: {field_name}")
                if not isinstance(value, UploadFile):
                    raise ApiError(400, "INVALID_SLOT", f"Slot {field_name} must be a file upload.")
                if field_name in slot_bytes:
                    raise ApiError(400, "INVALID_SLOT", f"Duplicate upload slot: {field_name}")
                raw = await value.read()
                if len(raw) > MAX_FILE_BYTES:
                    raise ApiError(400, "FILE_TOO_LARGE", f"{field_name} exceeds 8MB limit.")
                slot_bytes[field_name] = raw
        finally:
            await form.close()

        if "main" not in slot_bytes:
            raise ApiError(400, "MISSING_MAIN", "Required 'main' screenshot slot is missing.")

        return await pipeline.recognize(slot_bytes)

    app.include_router(api_router)
    app.include_router(api_router, prefix="/ocr")

    return app


app = create_app()
