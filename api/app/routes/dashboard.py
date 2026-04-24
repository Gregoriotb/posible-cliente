"""Endpoints del dashboard interno: lectura (fase 4) y escritura (fase 5).

Requiere scope `budgets:read` para listar/ver detalle.
Requiere scope `budgets:update` para PATCH y notes (fase 5).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_scopes
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.note import Note
from app.models.status_change import StatusChange
from app.schemas.budget import (
    BudgetListMeta,
    BudgetListOut,
    BudgetOut,
    BudgetPatch,
    NoteCreate,
    NoteOut,
)
from app.services import budget_service
from app.services.status_machine import (
    is_transition_allowed,
    requires_reason,
    valid_next_statuses,
)

router = APIRouter()


@router.get(
    "/budgets",
    response_model=BudgetListOut,
    summary="Listar presupuestos (paginado + filtros)",
    dependencies=[Depends(require_scopes("budgets:read"))],
)
def list_budgets(
    status_: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    source: str | None = Query(default=None),
    assigned_to: str | None = Query(default=None),
    search: str | None = Query(default=None, min_length=1),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
) -> BudgetListOut:
    items, total = budget_service.list_budgets(
        db,
        status=status_,
        priority=priority,
        source=source,
        assigned_to=assigned_to,
        search=search,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,  # type: ignore[arg-type]
    )
    return BudgetListOut(
        data=[BudgetOut.model_validate(b) for b in items],
        meta=BudgetListMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=budget_service.total_pages(total, limit),
        ),
    )


@router.get(
    "/budgets/{budget_id}",
    response_model=BudgetOut,
    summary="Detalle de presupuesto (incluye notas y history)",
    dependencies=[Depends(require_scopes("budgets:read"))],
)
def get_budget(budget_id: str, db: Session = Depends(get_db)) -> BudgetOut:
    budget = budget_service.get_budget_with_relations(db, budget_id)
    if budget is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presupuesto no encontrado")
    return BudgetOut.model_validate(budget)


@router.patch(
    "/budgets/{budget_id}",
    response_model=BudgetOut,
    summary="Actualizar estado, prioridad o asignado",
    description=(
        "Requiere scope `budgets:update`. Valida la transición de estado contra la máquina "
        "de estados del proyecto; si la transición va a `cancelado` o `rechazado`, `reason` es obligatorio."
    ),
)
def patch_budget(
    budget_id: str,
    patch: BudgetPatch,
    db: Session = Depends(get_db),
    key: ApiKey = Depends(require_scopes("budgets:update")),
) -> BudgetOut:
    budget = budget_service.get_budget_with_relations(db, budget_id)
    if budget is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presupuesto no encontrado")

    changed_fields: list[str] = []

    if patch.priority is not None and patch.priority != budget.priority:
        budget.priority = patch.priority
        changed_fields.append("priority")

    if patch.assigned_to is not None and patch.assigned_to != budget.assigned_to:
        budget.assigned_to = patch.assigned_to
        changed_fields.append("assigned_to")

    if patch.status is not None and patch.status != budget.status:
        if not is_transition_allowed(budget.status, patch.status):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "invalid_status_transition",
                    "from": budget.status,
                    "to": patch.status,
                    "allowed_next": sorted(valid_next_statuses(budget.status)),
                },
            )
        if requires_reason(patch.status) and not patch.reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El estado '{patch.status}' requiere una razón.",
            )
        db.add(
            StatusChange(
                budget_id=budget.id,
                from_status=budget.status,
                to_status=patch.status,
                changed_by=f"dashboard:{key.name}",
                reason=patch.reason,
            )
        )
        budget.status = patch.status
        changed_fields.append("status")

    if not changed_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios: envía al menos uno de status / priority / assigned_to distinto al actual.",
        )

    db.commit()
    db.refresh(budget)
    return BudgetOut.model_validate(budget)


@router.post(
    "/budgets/{budget_id}/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar nota interna al presupuesto",
)
def add_note(
    budget_id: str,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    key: ApiKey = Depends(require_scopes("budgets:update")),
) -> NoteOut:
    budget = budget_service.get_budget_with_relations(db, budget_id)
    if budget is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presupuesto no encontrado")

    note = Note(
        budget_id=budget.id,
        author=payload.author or key.name,
        content=payload.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut.model_validate(note)
