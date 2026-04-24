from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _normalize_db_url(url: str) -> str:
    """Permite pegar la URL de Neon/Heroku/etc sin modificaciones: añadimos
    automáticamente el driver `psycopg` v3 que espera SQLAlchemy 2.0."""
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):  # legacy (Heroku style)
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


_url = _normalize_db_url(settings.database_url)
connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}
engine = create_engine(_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
