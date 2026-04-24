"""CRUD de API Keys (scope requerido: admin)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_scopes
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyList, ApiKeyOut
from app.services import api_key_service

router = APIRouter(prefix="/admin/api-keys", dependencies=[Depends(require_scopes("admin"))])


@router.get("", response_model=ApiKeyList)
def list_keys(db: Session = Depends(get_db)) -> ApiKeyList:
    keys = api_key_service.list_api_keys(db)
    return ApiKeyList(data=[ApiKeyOut.model_validate(k) for k in keys])


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    current: ApiKey = Depends(require_scopes("admin")),
) -> ApiKeyCreated:
    key, plaintext = api_key_service.create_api_key(db, payload, created_by=current.name)
    return ApiKeyCreated(
        **ApiKeyOut.model_validate(key).model_dump(),
        key=plaintext,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_key(key_id: str, db: Session = Depends(get_db)) -> None:
    key = api_key_service.revoke_api_key(db, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="API Key no encontrada")
    return None


@router.post("/{key_id}/rotate", response_model=ApiKeyCreated)
def rotate_key(key_id: str, db: Session = Depends(get_db)) -> ApiKeyCreated:
    result = api_key_service.rotate_api_key(db, key_id)
    if result is None:
        raise HTTPException(status_code=404, detail="API Key no encontrada")
    new_key, plaintext, _old = result
    return ApiKeyCreated(
        **ApiKeyOut.model_validate(new_key).model_dump(),
        key=plaintext,
    )
