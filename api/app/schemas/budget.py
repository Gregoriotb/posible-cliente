from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

BudgetStatus = Literal[
    "recibido", "en_revision", "cotizado", "negociando",
    "aprobado", "en_proceso", "completado", "cancelado", "rechazado",
]
BudgetPriority = Literal["low", "medium", "high", "urgent"]
BudgetSource = Literal["whatsapp", "web", "messenger", "email"]


class BudgetCreate(BaseModel):
    """Payload que los chatbots de Artificialic envían a POST /v1/budgets."""

    external_id: str = Field(min_length=1, max_length=128, description="ID en el sistema de Artificialic (idempotencia)")
    client_name: str = Field(min_length=1, max_length=255)
    client_email: EmailStr
    client_phone: str | None = Field(default=None, max_length=64)
    client_company: str | None = Field(default=None, max_length=255)
    service_type: str = Field(min_length=1, max_length=128)
    description: str = Field(min_length=1)
    estimated_amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    priority: BudgetPriority = "medium"
    source: BudgetSource
    tags: list[str] = Field(default_factory=list, max_length=32)
    due_date: datetime | None = None

    @field_validator("currency")
    @classmethod
    def _uppercase_currency(cls, v: str) -> str:
        return v.upper()


class NoteOut(BaseModel):
    id: str
    author: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StatusChangeOut(BaseModel):
    id: str
    from_status: str | None
    to_status: str
    changed_by: str
    reason: str | None = None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetOut(BaseModel):
    id: str
    external_id: str
    client_name: str
    client_email: EmailStr
    client_phone: str | None = None
    client_company: str | None = None
    service_type: str
    description: str
    estimated_amount: Decimal
    currency: str
    status: BudgetStatus
    priority: BudgetPriority
    source: BudgetSource
    assigned_to: str | None = None
    tags: list[str]
    due_date: datetime | None = None
    created_at: datetime
    updated_at: datetime
    created_by_key_id: str | None = None
    notes: list[NoteOut] = []
    status_changes: list[StatusChangeOut] = []

    model_config = ConfigDict(from_attributes=True)


class BudgetListMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class BudgetListOut(BaseModel):
    data: list[BudgetOut]
    meta: BudgetListMeta


class NoteCreate(BaseModel):
    content: str = Field(min_length=1)
    author: str | None = Field(default=None, max_length=255)


class BudgetPatch(BaseModel):
    status: BudgetStatus | None = None
    priority: BudgetPriority | None = None
    assigned_to: str | None = None
    reason: str | None = Field(default=None, description="Obligatoria para status cancelado/rechazado")
