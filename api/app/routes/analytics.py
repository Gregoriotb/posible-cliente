"""GET /v1/analytics/stats — KPIs y breakdowns del dashboard."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_scopes
from app.db.session import get_db
from app.schemas.analytics import AnalyticsStats
from app.services import analytics_service

router = APIRouter()


@router.get(
    "/analytics/stats",
    response_model=AnalyticsStats,
    summary="Métricas y KPIs del dashboard",
    dependencies=[Depends(require_scopes("budgets:read"))],
)
def get_stats(
    date_range: str = Query(default="30d", pattern="^(today|7d|30d|year|custom)$"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return analytics_service.compute_stats(db, date_range=date_range, start=start, end=end)
