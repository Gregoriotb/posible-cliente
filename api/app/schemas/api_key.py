from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Scope = Literal["budgets:write", "budgets:read", "budgets:update", "admin"]


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, examples=["Artificialic Production"])
    scopes: list[Scope] = Field(min_length=1, examples=[["budgets:write"]])
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10_000)
    expires_at: datetime | None = None


class ApiKeyOut(BaseModel):
    id: str
    name: str
    prefix: str
    scopes: list[str]
    rate_limit_per_minute: int
    status: str
    last_used_at: datetime | None = None
    created_at: datetime
    created_by: str
    expires_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyOut):
    """Respuesta del POST de creación. El campo `key` solo aparece aquí (y en rotate)."""

    key: str = Field(description="Plaintext. NO se puede recuperar después. Guárdelo ahora.")


class ApiKeyList(BaseModel):
    data: list[ApiKeyOut]
