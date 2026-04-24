import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


VALID_STATUSES = (
    "recibido",
    "en_revision",
    "cotizado",
    "negociando",
    "aprobado",
    "en_proceso",
    "completado",
    "cancelado",
    "rechazado",
)

VALID_PRIORITIES = ("low", "medium", "high", "urgent")


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        Index("ix_budgets_external_id_unique", "external_id", unique=True),
        Index("ix_budgets_status_created_at", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False)
    client_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    service_type: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="recibido", index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
    created_by_key_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("api_keys.id"), nullable=True)

    notes: Mapped[list["Note"]] = relationship(
        "Note", back_populates="budget", cascade="all, delete-orphan", order_by="Note.created_at"
    )
    status_changes: Mapped[list["StatusChange"]] = relationship(
        "StatusChange", back_populates="budget", cascade="all, delete-orphan", order_by="StatusChange.changed_at"
    )
