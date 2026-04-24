"""Limiter slowapi compartido entre main y routes individuales.

Se extrae a un módulo propio para evitar imports circulares cuando un
route module necesita aplicar un rate limit específico (ej: auth/login)
con el decorador @limiter.limit("N/period").
"""
from fastapi import Request
from slowapi import Limiter


def _rate_limit_key(request: Request) -> str:
    """Prefer API key id cuando existe; fallback a IP del cliente."""
    api_key = getattr(request.state, "api_key", None)
    if api_key is not None:
        return f"key:{api_key.id}"
    client = request.client
    return f"ip:{client.host}" if client else "ip:unknown"


limiter = Limiter(key_func=_rate_limit_key, default_limits=[])
