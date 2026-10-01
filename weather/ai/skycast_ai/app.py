"""FastAPI application factory."""

from __future__ import annotations

import logging
import sys
import time
from datetime import UTC, datetime

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__
from .data.base import UpstreamError
from .predictor import Predictor
from .schemas import ApiError, HealthResponse, ModelInfoResponse, PredictResponse
from .settings import Settings, get_settings

log = logging.getLogger("skycast_ai")

HOURS_MIN, HOURS_MAX, HOURS_DEFAULT = 24, 168, 72


class BadRequest(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def configure_logging(level: str) -> None:
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                'ts=%(asctime)s level=%(levelname)s logger=%(name)s msg="%(message)s"',
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
        root.addHandler(handler)
    root.setLevel(level.upper())
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def _error(status: int, code: str, message: str) -> JSONResponse:
    body = ApiError(error={"code": code, "message": message})  # type: ignore[arg-type]
    return JSONResponse(status_code=status, content=body.model_dump())


def _validate_coords(lat: float, lon: float) -> None:
    if not (-90.0 <= lat <= 90.0):
        raise BadRequest(f"lat must be within [-90, 90], got {lat}")
    if not (-180.0 <= lon <= 180.0):
        raise BadRequest(f"lon must be within [-180, 180], got {lon}")


def create_app(settings: Settings | None = None, predictor: Predictor | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    predictor = predictor or Predictor(settings)

    app = FastAPI(
        title="Skycast AI prediction module",
        version=__version__,
        description=(
            "Statistical post-processing of NWP forecasts (bias correction, ensemble blending, "
            "calibrated uncertainty, hazard probabilities). Not a foundation weather model."
        ),
        responses={400: {"model": ApiError}, 500: {"model": ApiError}, 503: {"model": ApiError}},
    )
    app.state.settings = settings
    app.state.predictor = predictor

    origins = [o.strip() for o in settings.cors_origins.split(",")] if settings.cors_origins else ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - t0) * 1000
        response.headers["X-Response-Time-Ms"] = f"{ms:.1f}"
        log.info(
            "request method=%s path=%s query=%s status=%d duration_ms=%.1f",
            request.method,
            request.url.path,
            request.url.query,
            response.status_code,
            ms,
        )
        return response

    # ---------------------------------------------------------------- errors
    @app.exception_handler(BadRequest)
    async def bad_request_handler(_: Request, exc: BadRequest):
        return _error(400, "BAD_REQUEST", exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError):
        parts = []
        for e in exc.errors():
            loc = ".".join(str(x) for x in e.get("loc", []) if x not in ("query", "body"))
            parts.append(f"{loc}: {e.get('msg')}")
        return _error(400, "BAD_REQUEST", "; ".join(parts) or "invalid request")

    @app.exception_handler(UpstreamError)
    async def upstream_handler(_: Request, exc: UpstreamError):
        code = "RATE_LIMITED" if exc.status == 429 else "UPSTREAM_UNAVAILABLE"
        return _error(503, code, str(exc))

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_: Request, exc: StarletteHTTPException):
        code = (
            "NOT_FOUND" if exc.status_code == 404 else "BAD_REQUEST" if exc.status_code < 500 else "INTERNAL"
        )
        return _error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def generic_handler(_: Request, exc: Exception):
        log.exception("unhandled error: %s", exc)
        return _error(500, "INTERNAL", "internal error")

    # ---------------------------------------------------------------- routes
    @app.get("/health", response_model=HealthResponse, response_model_by_alias=True)
    def health():
        st = predictor.stats()
        return HealthResponse(
            version=__version__,
            uptime_seconds=st["uptime_seconds"],
            data_mode=st["data_mode"],
            models_loaded=st["models_loaded"],
        )

    @app.get("/predict", response_model=PredictResponse, response_model_by_alias=True)
    def predict(
        lat: float = Query(..., description="Latitude, -90..90"),
        lon: float = Query(..., description="Longitude, -180..180"),
        hours: int = Query(HOURS_DEFAULT, description=f"Horizon in hours, {HOURS_MIN}..{HOURS_MAX}"),
    ):
        _validate_coords(lat, lon)
        if not (HOURS_MIN <= hours <= HOURS_MAX):
            raise BadRequest(f"hours must be within [{HOURS_MIN}, {HOURS_MAX}], got {hours}")
        return predictor.predict(lat, lon, hours)

    @app.get("/model-info", response_model=ModelInfoResponse, response_model_by_alias=True)
    def model_info(lat: float = Query(...), lon: float = Query(...)):
        _validate_coords(lat, lon)
        return predictor.model_info(lat, lon)

    @app.post("/train", response_model=ModelInfoResponse, response_model_by_alias=True)
    def train(lat: float = Query(...), lon: float = Query(...)):
        _validate_coords(lat, lon)
        return predictor.model_info(lat, lon, force=True)

    @app.get("/", include_in_schema=False)
    def root():
        return {
            "service": "skycast-ai",
            "version": __version__,
            "time": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endpoints": ["/predict", "/model-info", "/train", "/health", "/openapi.json", "/docs"],
        }

    return app


app = create_app()
