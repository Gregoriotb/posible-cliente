"""Fixtures para pytest: DB en memoria por test + TestClient."""
import os
import sys

# Aseguramos que el root de 'api/' esté en sys.path para que tests puedan importar `app.*`
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Desactivar bootstrap en tests — cada test construye su estado
os.environ.setdefault("BOOTSTRAP_ADMIN_ON_EMPTY", "false")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest

# Desactivar slowapi en tests (muchos tests en serie contra mismo endpoint
# saltarían el rate limit). En prod sigue activo.
from app.core.limiter import limiter as _limiter

_limiter.enabled = False
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db


@pytest.fixture
def engine():
    # SQLite in-memory compartido entre conexiones del mismo engine (StaticPool)
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Importar modelos para que se registren en Base.metadata
    from app.models import api_key, budget, note, status_change  # noqa: F401

    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def db_session(engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(engine):
    from app.main import app

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_key(db_session):
    """Crea una admin key y devuelve (model, plaintext) para usar como X-API-Key."""
    from app.schemas.api_key import ApiKeyCreate
    from app.services import api_key_service

    payload = ApiKeyCreate(name="Test Admin", scopes=["admin", "budgets:read", "budgets:update"])
    key, plaintext = api_key_service.create_api_key(db_session, payload, created_by="test")
    return key, plaintext


@pytest.fixture
def ingest_key(db_session):
    from app.schemas.api_key import ApiKeyCreate
    from app.services import api_key_service

    payload = ApiKeyCreate(name="Test Ingest", scopes=["budgets:write"])
    key, plaintext = api_key_service.create_api_key(db_session, payload, created_by="test")
    return key, plaintext
