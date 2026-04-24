"""FastAPI dependencies: autenticación por API Key y verificación de scopes."""
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import hash_token, is_valid_format
from app.db.session import get_db
from app.models.api_key import ApiKey


def get_api_key(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> ApiKey:
    """Resuelve y valida la API Key del header. Actualiza last_used_at."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta header X-API-Key",
        )

    if not is_valid_format(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de API Key inválido",
        )

    token_hash = hash_token(x_api_key)
    key = db.query(ApiKey).filter(ApiKey.hash == token_hash).first()

    if key is None or key.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida o revocada",
        )

    if key.is_expired():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key expirada",
        )

    key.last_used_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()

    # Expose to rate limiter key_func
    request.state.api_key = key
    return key


def require_scopes(*required_scopes: str):
    """Dependency factory. 403 si la key no tiene TODOS los scopes requeridos."""

    def _check(key: ApiKey = Depends(get_api_key)) -> ApiKey:
        missing = [s for s in required_scopes if not key.has_scope(s)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope insuficiente. Requeridos: {list(required_scopes)}. Faltan: {missing}",
            )
        return key

    return _check
