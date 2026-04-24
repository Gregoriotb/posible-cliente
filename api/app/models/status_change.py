import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class StatusChange(Base):
    __tablename__ = "status_changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    budget_id: Mapped[str] = mapped_column(String(36), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="status_changes")
