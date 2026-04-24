"""Cálculo de métricas y KPIs del dashboard.

Usa SQL portable entre SQLite y Postgres (CASE WHEN en vez de IIF/JULIANDAY).
Cálculos ligeros se hacen en Python para mantener compatibilidad.
"""
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.status_change import StatusChange

REVENUE_STATUSES = ("aprobado", "en_proceso", "completado")


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def resolve_range(date_range: str, start: date | None, end: date | None) -> tuple[datetime, datetime]:
    now = _utcnow()
    end_dt = datetime.combine(end, datetime.min.time()) + timedelta(days=1) if end else now
    if date_range == "custom" and start:
        start_dt = datetime.combine(start, datetime.min.time())
        return start_dt, end_dt
    if date_range == "today":
        start_dt = datetime.combine(now.date(), datetime.min.time())
    elif date_range == "7d":
        start_dt = now - timedelta(days=7)
    elif date_range == "30d":
        start_dt = now - timedelta(days=30)
    elif date_range == "year":
        start_dt = datetime(now.year, 1, 1)
    else:
        start_dt = now - timedelta(days=30)
    return start_dt, end_dt


def _group_counts(db: Session, column, start: datetime, end: datetime) -> list[dict]:
    rows = db.execute(
        select(column, func.count(Budget.id))
        .where(Budget.created_at >= start, Budget.created_at < end)
        .group_by(column)
        .order_by(func.count(Budget.id).desc())
    ).all()
    return [{"key": (r[0] or "(sin asignar)"), "count": r[1]} for r in rows]


def compute_stats(
    db: Session,
    date_range: str = "30d",
    start: date | None = None,
    end: date | None = None,
) -> dict:
    start_dt, end_dt = resolve_range(date_range, start, end)
    window = (Budget.created_at >= start_dt, Budget.created_at < end_dt)

    total = db.execute(select(func.count(Budget.id)).where(*window)).scalar() or 0
    approved = (
        db.execute(select(func.count(Budget.id)).where(*window, Budget.status == "aprobado")).scalar() or 0
    )
    potential_revenue = (
        db.execute(
            select(func.coalesce(func.sum(Budget.estimated_amount), 0)).where(
                *window, Budget.status.in_(REVENUE_STATUSES)
            )
        ).scalar()
        or Decimal("0")
    )

    # Tiempo promedio de respuesta (horas): calcular en Python con los timestamps
    # del primer cambio desde "recibido". Portable entre DBs.
    first_moves = db.execute(
        select(Budget.created_at, StatusChange.changed_at)
        .join(StatusChange, StatusChange.budget_id == Budget.id)
        .where(*window, StatusChange.from_status == "recibido")
    ).all()
    if first_moves:
        seen: dict = {}
        # Solo el PRIMER cambio post-recibido por budget (la query no agrupa, lo hacemos aquí)
        for created_at, changed_at in first_moves:
            key = id(created_at)  # marker — cada row trae su created_at/changed_at distintos
            if key not in seen:
                seen[key] = (created_at, changed_at)
        hours = [
            (changed_at - created_at).total_seconds() / 3600.0
            for created_at, changed_at in seen.values()
        ]
        avg_response = sum(hours) / len(hours) if hours else None
    else:
        avg_response = None

    kpis = {
        "total_budgets": total,
        "conversion_rate": float(approved / total) if total else 0.0,
        "avg_response_time_hours": avg_response,
        "potential_revenue": Decimal(str(potential_revenue)),
    }

    by_status = _group_counts(db, Budget.status, start_dt, end_dt)
    by_source = _group_counts(db, Budget.source, start_dt, end_dt)
    by_priority = _group_counts(db, Budget.priority, start_dt, end_dt)
    by_assigned = _group_counts(db, Budget.assigned_to, start_dt, end_dt)

    # Trend: por día (recibidos vs aprobados). CASE WHEN es portable.
    approved_case = case((Budget.status == "aprobado", 1), else_=0)
    trend_rows = db.execute(
        select(
            func.date(Budget.created_at).label("d"),
            func.count(Budget.id),
            func.coalesce(func.sum(approved_case), 0),
        )
        .where(*window)
        .group_by(func.date(Budget.created_at))
        .order_by(func.date(Budget.created_at))
    ).all()
    trend = [
        {"date": str(r[0]), "received": int(r[1]), "approved": int(r[2] or 0)}
        for r in trend_rows
    ]

    top_rows = db.execute(
        select(
            Budget.service_type,
            func.count(Budget.id),
            func.coalesce(func.sum(Budget.estimated_amount), 0),
        )
        .where(*window)
        .group_by(Budget.service_type)
        .order_by(func.count(Budget.id).desc())
        .limit(10)
    ).all()
    top_services = [
        {"service_type": r[0], "count": int(r[1]), "total_amount": Decimal(str(r[2]))}
        for r in top_rows
    ]

    return {
        "kpis": kpis,
        "by_status": by_status,
        "by_source": by_source,
        "by_priority": by_priority,
        "by_assigned": by_assigned,
        "trend": trend,
        "top_services": top_services,
        "range": date_range,
    }
