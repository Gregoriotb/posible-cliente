"""Valida que el seed crea data coherente y que los endpoints la sirven correctamente."""


def test_seed_creates_keys_and_budgets(db_session):
    from app.db.seed import seed_all
    from app.models.api_key import ApiKey
    from app.models.budget import Budget

    result = seed_all(db_session, reset=True)
    assert result["budgets_created"] == 40

    keys = db_session.query(ApiKey).all()
    assert len(keys) == 3
    scopes_by_name = {k.name: set(k.scopes) for k in keys}
    assert "admin" in scopes_by_name["Dashboard Admin (demo)"]
    assert scopes_by_name["Artificialic Production"] == {"budgets:write"}
    assert scopes_by_name["Dashboard Readonly (demo)"] == {"budgets:read"}

    budgets = db_session.query(Budget).all()
    assert len(budgets) == 40
    # Todos tienen al menos un status_change (el inicial "recibido")
    for b in budgets:
        assert len(b.status_changes) >= 1

    # Distribución de estados incluye variedad
    statuses = {b.status for b in budgets}
    assert len(statuses) >= 3


def test_seeded_data_is_queryable_via_endpoints(client, db_session):
    """Tras seedear, el admin key puede listar, filtrar y ver analytics."""
    from app.db.seed import seed_all

    result = seed_all(db_session, reset=True)
    admin_plaintext = result["api_keys"]["Dashboard Admin (demo)"]

    # Listar todos
    r = client.get("/v1/budgets?limit=100", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    assert r.json()["meta"]["total"] == 40

    # Analytics funciona con data real
    s = client.get("/v1/analytics/stats", headers={"X-API-Key": admin_plaintext})
    assert s.status_code == 200
    body = s.json()
    assert body["kpis"]["total_budgets"] > 0
    assert len(body["by_status"]) > 0
    assert len(body["top_services"]) > 0


def test_seed_reset_clears_previous(db_session):
    from app.db.seed import seed_all
    from app.models.budget import Budget

    seed_all(db_session, reset=True)
    first_count = db_session.query(Budget).count()
    # reseedear con reset debe dejar mismo número (no acumula)
    seed_all(db_session, reset=True)
    assert db_session.query(Budget).count() == first_count
