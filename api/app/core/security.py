"""Generación, hashing y verificación de API Keys.

Formato: `artf_live_<48 chars url-safe random>` generado con `secrets.token_urlsafe(48)`.
Almacenamiento: solo SHA-256 hash en DB. El plaintext aparece únicamente una vez
en el response de create/rotate — jamás persistido ni logueado.
"""
import hashlib
import hmac
import secrets

DEFAULT_PREFIX = "artf_live_"
VISIBLE_PREFIX_LENGTH = 16  # primeros 16 chars para mostrar en UI admin


def generate_token(prefix: str = DEFAULT_PREFIX) -> tuple[str, str, str]:
    """Genera un nuevo token.

    Returns:
        (plaintext, sha256_hash, visible_prefix)
    """
    random_part = secrets.token_urlsafe(48)
    plaintext = f"{prefix}{random_part}"
    hashed = hash_token(plaintext)
    visible = plaintext[:VISIBLE_PREFIX_LENGTH]
    return plaintext, hashed, visible


def hash_token(plaintext: str) -> str:
    """SHA-256 hex digest del token. Usado para lookup y verificación."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def verify_token(plaintext: str, stored_hash: str) -> bool:
    """Comparación timing-safe para mitigar timing attacks."""
    computed = hash_token(plaintext)
    return hmac.compare_digest(computed, stored_hash)


def is_valid_format(token: str) -> bool:
    """Verificación barata previa al hashing: evita trabajo en tokens obviamente inválidos."""
    return token.startswith(("artf_live_", "artf_test_")) and len(token) > 20
