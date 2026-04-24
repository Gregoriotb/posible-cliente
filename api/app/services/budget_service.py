"""Lógica de listado y búsqueda de presupuestos."""
import math
from typing import Literal

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.budget import Budget

SortOrder = Literal["asc", "desc"]
ALLOWED_SORT_BY = {"created_at", "updated_at", "estimated_amount", "status", "priority"}


def list_budgets(
    db: Session,
    *,
    status: str | None = None,
    priority: str | None = None,
    source: str | None = None,
    assigned_to: str | None = None,
    search: str | None = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "created_at",
    sort_order: SortOrder = "desc",
) -> tuple[list[Budget], int]:
    """Retorna (items_paginados, total_sin_paginar)."""
    if sort_by not in ALLOWED_SORT_BY:
        sort_by = "created_at"

    q = db.query(Budget)

    if status:
        q = q.filter(Budget.status == status)
    if priority:
        q = q.filter(Budget.priority == priority)
    if source:
        q = q.filter(Budget.source == source)
    if assigned_to:
        q = q.filter(Budget.assigned_to == assigned_to)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Budget.client_name.ilike(pattern),
                Budget.client_company.ilike(pattern),
                Budget.client_email.ilike(pattern),
                Budget.description.ilike(pattern),
                Budget.service_type.ilike(pattern),
            )
        )

    total = q.count()

    sort_column = getattr(Budget, sort_by)
    sort_expr = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    q = q.order_by(sort_expr)

    page = max(1, page)
    limit = max(1, min(100, limit))
    offset = (page - 1) * limit
    items = q.offset(offset).limit(limit).all()
    return items, total


def get_budget_with_relations(db: Session, budget_id: str) -> Budget | None:
    return (
        db.query(Budget)
        .options(selectinload(Budget.notes), selectinload(Budget.status_changes))
        .filter(Budget.id == budget_id)
        .first()
    )


def total_pages(total: int, limit: int) -> int:
    if total == 0:
        return 0
    return math.ceil(total / limit)
