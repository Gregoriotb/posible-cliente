"""POST /v1/auth/login — login tradicional del dashboard.

Valida usuario/password contra env vars (ADMIN_USERNAME / ADMIN_PASSWORD)
y, si coinciden, devuelve la admin API key (ADMIN_API_KEY) que el frontend
guardará en localStorage y usará como X-API-Key en todas las requests
subsecuentes al backend.

El sistema de API Keys del backend no cambia — este endpoint solo
sustituye el paso "pega la key en el input" por un formulario user/pass
tradicional, sin exponer la key al usuario final del dashboard.
"""
import hmac

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter()


def _timing_safe_equal(a: str | None, b: str) -> bool:
    if a is None:
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


@router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest) -> LoginResponse:
    if not settings.dashboard_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login de dashboard no configurado en el backend (faltan env vars ADMIN_USERNAME/ADMIN_PASSWORD/ADMIN_API_KEY).",
        )

    username_ok = _timing_safe_equal(settings.admin_username, payload.username)
    password_ok = _timing_safe_equal(settings.admin_password, payload.password)

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
        )

    return LoginResponse(api_key=settings.admin_api_key or "", username=payload.username)
