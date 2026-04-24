"""Tests del endpoint de ingest POST /v1/budgets."""


def _payload(**overrides):
    base = {
        "external_id": "chatbot-abc-001",
        "client_name": "María García",
        "client_email": "maria@acme.com",
        "client_company": "ACME Corp",
        "service_type": "Chatbot WhatsApp",
        "description": "Necesitamos un chatbot que atienda ventas 24/7 con integración a nuestro CRM.",
        "estimated_amount": "5000.00",
        "currency": "USD",
        "priority": "high",
        "source": "whatsapp",
        "tags": ["ventas", "crm"],
    }
    base.update(overrides)
    return base


def test_ingest_requires_key(client):
    r = client.post("/v1/budgets", json=_payload())
    assert r.status_code == 401


def test_ingest_requires_write_scope(client, admin_key):
    """Admin key NO tiene budgets:write por defecto (solo read+update). Debe fallar."""
    _, admin_plaintext = admin_key  # scopes: admin, budgets:read, budgets:update
    r = client.post("/v1/budgets", headers={"X-API-Key": admin_plaintext}, json=_payload())
    assert r.status_code == 403


def test_ingest_happy_path(client, ingest_key):
    _, plaintext = ingest_key
    r = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=_payload())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["external_id"] == "chatbot-abc-001"
    assert body["client_email"] == "maria@acme.com"
    assert body["status"] == "recibido"
    assert body["priority"] == "high"
    assert body["created_by_key_id"]  # audit trail
    assert len(body["status_changes"]) == 1
    assert body["status_changes"][0]["to_status"] == "recibido"


def test_ingest_missing_required_field(client, ingest_key):
    _, plaintext = ingest_key
    payload = _payload()
    del payload["client_email"]
    r = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=payload)
    assert r.status_code == 422


def test_ingest_invalid_email(client, ingest_key):
    _, plaintext = ingest_key
    r = client.post(
        "/v1/budgets",
        headers={"X-API-Key": plaintext},
        json=_payload(client_email="not-an-email"),
    )
    assert r.status_code == 422


def test_ingest_duplicate_external_id_returns_409(client, ingest_key):
    _, plaintext = ingest_key
    p = _payload(external_id="same-id-twice")
    first = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=p)
    assert first.status_code == 201
    second = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=p)
    assert second.status_code == 409
    assert "existe" in second.json()["detail"].lower()


def test_ingest_amount_must_be_positive(client, ingest_key):
    _, plaintext = ingest_key
    r = client.post(
        "/v1/budgets",
        headers={"X-API-Key": plaintext},
        json=_payload(estimated_amount="0"),
    )
    assert r.status_code == 422


def test_ingest_invalid_source_enum(client, ingest_key):
    _, plaintext = ingest_key
    r = client.post(
        "/v1/budgets",
        headers={"X-API-Key": plaintext},
        json=_payload(source="fax"),
    )
    assert r.status_code == 422


def test_ingest_currency_uppercased(client, ingest_key):
    _, plaintext = ingest_key
    r = client.post(
        "/v1/budgets",
        headers={"X-API-Key": plaintext},
        json=_payload(external_id="x-1", currency="eur"),
    )
    assert r.status_code == 201
    assert r.json()["currency"] == "EUR"
