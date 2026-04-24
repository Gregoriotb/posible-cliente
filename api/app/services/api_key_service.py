"""Lógica de negocio para la gestión de API Keys.

Responsable de: creación, listado, revocación, rotación y bootstrap automático.
El plaintext se devuelve únicamente por create/rotate — nunca se persiste.
"""
import logging
import os
import stat
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import generate_token
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate

logger = logging.getLogger(__name__)

ADMIN_KEY_FILE = "ADMIN_KEY.txt"


def create_api_key(db: Session, payload: ApiKeyCreate, created_by: str = "admin") -> tuple[ApiKey, str]:
    """Crea una API Key. Retorna (modelo, plaintext) — el plaintext debe ser devuelto una vez y olvidado."""
    plaintext, hashed, prefix = generate_token()
    key = ApiKey(
        name=payload.name,
        hash=hashed,
        prefix=prefix,
        scopes=list(payload.scopes),
        rate_limit_per_minute=payload.rate_limit_per_minute,
        expires_at=payload.expires_at,
        created_by=created_by,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    logger.info("API Key created: id=%s name=%s scopes=%s", key.id, key.name, key.scopes)
    return key, plaintext


def list_api_keys(db: Session) -> list[ApiKey]:
    return db.query(ApiKey).order_by(ApiKey.created_at.desc()).all()


def get_api_key(db: Session, key_id: str) -> ApiKey | None:
    return db.query(ApiKey).filter(ApiKey.id == key_id).first()


def revoke_api_key(db: Session, key_id: str) -> ApiKey | None:
    key = get_api_key(db, key_id)
    if key is None:
        return None
    key.status = "revoked"
    db.commit()
    db.refresh(key)
    logger.info("API Key revoked: id=%s", key.id)
    return key


def rotate_api_key(db: Session, key_id: str, grace_days: int = 7) -> tuple[ApiKey, str, ApiKey] | None:
    """Genera nueva key con los mismos scopes; la vieja expira en `grace_days` para permitir
    migración del consumer sin downtime.

    Returns: (new_key, new_plaintext, old_key) o None si la key no existe.
    """
    old = get_api_key(db, key_id)
    if old is None:
        return None

    new_payload = ApiKeyCreate(
        name=f"{old.name} (rotated)",
        scopes=old.scopes,
        rate_limit_per_minute=old.rate_limit_per_minute,
        expires_at=old.expires_at,
    )
    new_key, plaintext = create_api_key(db, new_payload, created_by=f"rotation:{old.id}")

    # La vieja sigue activa pero con expiración corta
    old.expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=grace_days)
    db.commit()
    db.refresh(old)
    logger.info("API Key rotated: old=%s new=%s grace_days=%d", old.id, new_key.id, grace_days)
    return new_key, plaintext, old


def bootstrap_admin_if_empty(db: Session) -> None:
    """Si no existe ningún admin key activo, crea uno y persiste el plaintext en ADMIN_KEY.txt."""
    existing = (
        db.query(ApiKey)
        .filter(ApiKey.status == "active")
        .all()
    )
    has_admin = any("admin" in (k.scopes or []) for k in existing)
    if has_admin:
        return

    payload = ApiKeyCreate(
        name="Bootstrap Admin",
        scopes=["admin", "budgets:read", "budgets:update"],
        rate_limit_per_minute=120,
    )
    key, plaintext = create_api_key(db, payload, created_by="bootstrap")

    banner = (
        "\n" + "=" * 70 + "\n"
        "  ADMIN API KEY CREADA (bootstrap)\n"
        "  Guárdela AHORA: no se podrá recuperar.\n"
        f"  {plaintext}\n"
        f"  Persistida en: {ADMIN_KEY_FILE} (chmod 600)\n"
        "=" * 70 + "\n"
    )
    # stdout directo — no pasa por logging (que redacta)
    print(banner, flush=True)

    try:
        with open(ADMIN_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(plaintext + "\n")
        os.chmod(ADMIN_KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 600
    except OSError as e:
        logger.warning("No se pudo escribir ADMIN_KEY.txt: %s", e)
