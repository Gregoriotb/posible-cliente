"""POST /v1/budgets — Ingest de presupuestos desde los chatbots de Artificialic.

Requiere scope `budgets:write`. Idempotente por `external_id`: si llega uno duplicado
devolvemos 409 con referencia al budget existente.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_scopes
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.budget import Budget
from app.models.status_change import StatusChange
from app.schemas.budget import BudgetCreate, BudgetOut

router = APIRouter()


@router.post(
    "/budgets",
    response_model=BudgetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest de presupuesto (desde chatbot)",
    description="Endpoint público consumido por los chatbots de Artificialic. Requiere API Key con scope `budgets:write`.",
)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    key: ApiKey = Depends(require_scopes("budgets:write")),
) -> Budget:
    existing = db.query(Budget).filter(Budget.external_id == payload.external_id).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"external_id ya existe (id={existing.id}). Usa PATCH /v1/budgets/{existing.id} para actualizar.",
        )

    budget = Budget(
        external_id=payload.external_id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_phone=payload.client_phone,
        client_company=payload.client_company,
        service_type=payload.service_type,
        description=payload.description,
        estimated_amount=payload.estimated_amount,
        currency=payload.currency,
        priority=payload.priority,
        source=payload.source,
        tags=payload.tags,
        due_date=payload.due_date,
        created_by_key_id=key.id,
    )
    db.add(budget)
    db.flush()

    # Registrar el estado inicial en el historial
    initial = StatusChange(
        budget_id=budget.id,
        from_status=None,
        to_status=budget.status,
        changed_by=f"ingest:{key.name}",
        reason="Creado desde chatbot",
    )
    db.add(initial)
    db.commit()
    db.refresh(budget)
    return budget
