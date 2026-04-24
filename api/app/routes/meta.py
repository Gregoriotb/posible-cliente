from fastapi import APIRouter, Depends

from app.core.dependencies import get_api_key
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyOut

router = APIRouter()


@router.get("/ping")
async def ping() -> dict[str, str]:
    """Health check. No auth."""
    return {"status": "ok"}


@router.get("/me", response_model=ApiKeyOut)
async def me(key: ApiKey = Depends(get_api_key)) -> ApiKey:
    """Info de la API Key actual. Útil para debugging y para que el dashboard muestre scopes."""
    return key
