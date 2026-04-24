import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging_filter import install_redaction
from app.db.base import Base
from app.db.session import engine

logging.basicConfig(
    level=logging.INFO if settings.is_production else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
install_redaction()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import all models so SQLAlchemy registers them before create_all
    from app.models import api_key, budget, note, status_change  # noqa: F401

    Base.metadata.create_all(bind=engine)

    if settings.bootstrap_admin_on_empty:
        from app.services.api_key_service import bootstrap_admin_if_empty
        from app.db.session import SessionLocal

        with SessionLocal() as db:
            bootstrap_admin_if_empty(db)

    logger.info("API started. Environment=%s", settings.environment)
    yield
    logger.info("API shutting down.")


app = FastAPI(
    title="Artificialic Budget Platform API",
    description="API REST provista por nosotros. Consumida por Artificialic (ingest) y dashboard interno.",
    version="1.0.0",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["X-API-Key", "Content-Type", "Accept"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit excedido. Intenta de nuevo en unos segundos."},
        headers={"Retry-After": "60"},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": "Validación fallida", "errors": exc.errors()}),
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


from app.routes import admin, analytics, auth, dashboard, ingest, meta

app.include_router(meta.router, prefix="/v1", tags=["meta"])
app.include_router(auth.router, prefix="/v1", tags=["auth"])
app.include_router(ingest.router, prefix="/v1", tags=["ingest"])
app.include_router(dashboard.router, prefix="/v1", tags=["dashboard"])
app.include_router(analytics.router, prefix="/v1", tags=["analytics"])
app.include_router(admin.router, prefix="/v1", tags=["admin"])
