"""Tests de los endpoints de lectura del dashboard (GET /v1/budgets, GET /:id)."""
import pytest


@pytest.fixture
def seeded(client, ingest_key):
    """Inserta 5 budgets variados vía el endpoint real de ingest."""
    _, plaintext = ingest_key
    fixtures = [
        {"external_id": "b1", "client_name": "Ana",   "client_email": "a@x.com", "client_company": "Acme",
         "service_type": "Chatbot WhatsApp",    "description": "chat ventas",      "estimated_amount": "1500.00",
         "priority": "high",   "source": "whatsapp"},
        {"external_id": "b2", "client_name": "Beto",  "client_email": "b@x.com", "client_company": "Beta",
         "service_type": "Catálogo Inteligente","description": "catalogo amplio",  "estimated_amount": "3200.00",
         "priority": "medium", "source": "web"},
        {"external_id": "b3", "client_name": "Carla", "client_email": "c@x.com", "client_company": "Ceta",
         "service_type": "Chatbot WhatsApp",    "description": "integracion crm",  "estimated_amount": "5800.00",
         "priority": "urgent", "source": "whatsapp"},
        {"external_id": "b4", "client_name": "Diego", "client_email": "d@x.com",
         "service_type": "Landing Page",        "description": "landing conversion","estimated_amount": "800.00",
         "priority": "low",    "source": "email"},
        {"external_id": "b5", "client_name": "Elena", "client_email": "e@x.com", "client_company": "Epsilon",
         "service_type": "Chatbot Messenger",   "description": "bot facebook",     "estimated_amount": "2100.00",
         "priority": "medium", "source": "messenger"},
    ]
    for f in fixtures:
        r = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=f)
        assert r.status_code == 201
    return plaintext


def test_list_requires_read_scope(client, ingest_key):
    _, plaintext = ingest_key  # solo budgets:write
    r = client.get("/v1/budgets", headers={"X-API-Key": plaintext})
    assert r.status_code == 403


def test_list_empty(client, admin_key):
    _, plaintext = admin_key
    r = client.get("/v1/budgets", headers={"X-API-Key": plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["data"] == []
    assert body["meta"]["total"] == 0
    assert body["meta"]["total_pages"] == 0


def test_list_returns_all_default(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r = client.get("/v1/budgets", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["total"] == 5
    assert len(body["data"]) == 5


def test_list_pagination(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r1 = client.get("/v1/budgets?page=1&limit=2", headers={"X-API-Key": admin_plaintext})
    r2 = client.get("/v1/budgets?page=2&limit=2", headers={"X-API-Key": admin_plaintext})
    r3 = client.get("/v1/budgets?page=3&limit=2", headers={"X-API-Key": admin_plaintext})
    assert r1.status_code == 200 and len(r1.json()["data"]) == 2
    assert r2.status_code == 200 and len(r2.json()["data"]) == 2
    assert r3.status_code == 200 and len(r3.json()["data"]) == 1
    assert r1.json()["meta"]["total_pages"] == 3


def test_list_filter_by_priority(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r = client.get("/v1/budgets?priority=high", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["client_name"] == "Ana"


def test_list_filter_by_source(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r = client.get("/v1/budgets?source=whatsapp", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    names = {b["client_name"] for b in r.json()["data"]}
    assert names == {"Ana", "Carla"}


def test_list_search(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r = client.get("/v1/budgets?search=crm", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["external_id"] == "b3"


def test_list_sort_by_amount_asc(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    r = client.get(
        "/v1/budgets?sort_by=estimated_amount&sort_order=asc",
        headers={"X-API-Key": admin_plaintext},
    )
    body = r.json()
    amounts = [float(b["estimated_amount"]) for b in body["data"]]
    assert amounts == sorted(amounts)


def test_list_rejects_invalid_sort_order(client, admin_key):
    _, plaintext = admin_key
    r = client.get("/v1/budgets?sort_order=weird", headers={"X-API-Key": plaintext})
    assert r.status_code == 422


def test_detail_returns_404_for_missing(client, admin_key):
    _, plaintext = admin_key
    r = client.get("/v1/budgets/does-not-exist", headers={"X-API-Key": plaintext})
    assert r.status_code == 404


def test_detail_includes_notes_and_history(client, seeded, admin_key):
    _, admin_plaintext = admin_key
    listed = client.get("/v1/budgets", headers={"X-API-Key": admin_plaintext}).json()
    budget_id = listed["data"][0]["id"]
    r = client.get(f"/v1/budgets/{budget_id}", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == budget_id
    assert "notes" in body and isinstance(body["notes"], list)
    assert "status_changes" in body
    # Cada ingest crea un status_change inicial ("recibido")
    assert any(sc["to_status"] == "recibido" for sc in body["status_changes"])
