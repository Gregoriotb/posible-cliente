from decimal import Decimal

from pydantic import BaseModel


class KpiCards(BaseModel):
    total_budgets: int
    conversion_rate: float                      # aprobados / total (0..1)
    avg_response_time_hours: float | None       # tiempo promedio recibido → primer cambio
    potential_revenue: Decimal                  # suma aprobado + en_proceso


class BreakdownEntry(BaseModel):
    key: str
    count: int


class TrendPoint(BaseModel):
    date: str          # ISO-date (YYYY-MM-DD)
    received: int
    approved: int


class TopServiceEntry(BaseModel):
    service_type: str
    count: int
    total_amount: Decimal


class AnalyticsStats(BaseModel):
    kpis: KpiCards
    by_status: list[BreakdownEntry]
    by_source: list[BreakdownEntry]
    by_priority: list[BreakdownEntry]
    by_assigned: list[BreakdownEntry]
    trend: list[TrendPoint]
    top_services: list[TopServiceEntry]
    range: str
