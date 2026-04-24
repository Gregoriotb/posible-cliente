"""Tests de GET /v1/analytics/stats."""
import pytest


def _ingest(client, plaintext, **overrides):
    base = {
        "external_id": overrides.get("external_id", "a"),
        "client_name": "X",
        "client_email": "x@x.com",
        "service_type": overrides.get("service_type", "Chatbot WhatsApp"),
        "description": "desc",
        "estimated_amount": overrides.get("estimated_amount", "1000.00"),
        "priority": overrides.get("priority", "medium"),
        "source": overrides.get("source", "whatsapp"),
    }
    r = client.post("/v1/budgets", headers={"X-API-Key": plaintext}, json=base)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def stats_seed(client, ingest_key, admin_key):
    _, ingest_plain = ingest_key
    _, admin_plain = admin_key

    # 5 budgets variados
    b1 = _ingest(client, ingest_plain, external_id="s1", service_type="Chatbot WhatsApp", estimated_amount="1500", source="whatsapp", priority="high")
    b2 = _ingest(client, ingest_plain, external_id="s2", service_type="Chatbot WhatsApp", estimated_amount="2500", source="web",      priority="medium")
    b3 = _ingest(client, ingest_plain, external_id="s3", service_type="Catálogo",         estimated_amount="3000", source="web",      priority="medium")
    b4 = _ingest(client, ingest_plain, external_id="s4", service_type="Catálogo",         estimated_amount="4000", source="messenger",priority="urgent")
    b5 = _ingest(client, ingest_plain, external_id="s5", service_type="Landing",          estimated_amount="800",  source="email",    priority="low")

    # Mover dos a aprobado pasando por en_revision → cotizado → aprobado
    for b in (b1, b3):
        for next_status in ("en_revision", "cotizado", "aprobado"):
            r = client.patch(f"/v1/budgets/{b['id']}", headers={"X-API-Key": admin_plain}, json={"status": next_status})
            assert r.status_code == 200

    return admin_plain


def test_stats_requires_read_scope(client, ingest_key):
    _, plain = ingest_key
    r = client.get("/v1/analytics/stats", headers={"X-API-Key": plain})
    assert r.status_code == 403


def test_stats_empty(client, admin_key):
    _, plain = admin_key
    r = client.get("/v1/analytics/stats", headers={"X-API-Key": plain})
    assert r.status_code == 200
    body = r.json()
    assert body["kpis"]["total_budgets"] == 0
    assert body["kpis"]["conversion_rate"] == 0.0
    assert body["by_status"] == []
    assert body["trend"] == []


def test_stats_kpis(client, stats_seed):
    plain = stats_seed
    r = client.get("/v1/analytics/stats", headers={"X-API-Key": plain})
    assert r.status_code == 200
    body = r.json()
    kpis = body["kpis"]
    assert kpis["total_budgets"] == 5
    # 2 de 5 en aprobado
    assert kpis["conversion_rate"] == 2 / 5
    # revenue = 1500 + 3000 = 4500 (los aprobados)
    assert float(kpis["potential_revenue"]) == 4500.0


def test_stats_breakdowns(client, stats_seed):
    plain = stats_seed
    body = client.get("/v1/analytics/stats", headers={"X-API-Key": plain}).json()

    status_counts = {e["key"]: e["count"] for e in body["by_status"]}
    assert status_counts.get("aprobado") == 2
    assert status_counts.get("recibido") == 3

    source_counts = {e["key"]: e["count"] for e in body["by_source"]}
    assert source_counts == {"whatsapp": 1, "web": 2, "messenger": 1, "email": 1}

    priority_counts = {e["key"]: e["count"] for e in body["by_priority"]}
    assert priority_counts == {"high": 1, "medium": 2, "urgent": 1, "low": 1}


def test_stats_top_services(client, stats_seed):
    plain = stats_seed
    body = client.get("/v1/analytics/stats", headers={"X-API-Key": plain}).json()
    top = {e["service_type"]: e["count"] for e in body["top_services"]}
    assert top["Chatbot WhatsApp"] == 2
    assert top["Catálogo"] == 2
    assert top["Landing"] == 1


def test_stats_invalid_range(client, admin_key):
    _, plain = admin_key
    r = client.get("/v1/analytics/stats?date_range=century", headers={"X-API-Key": plain})
    assert r.status_code == 422


def test_stats_trend_has_dates(client, stats_seed):
    plain = stats_seed
    body = client.get("/v1/analytics/stats", headers={"X-API-Key": plain}).json()
    # Todos los 5 ingresos caen hoy → un solo entry en trend con received=5
    assert len(body["trend"]) >= 1
    total_received = sum(p["received"] for p in body["trend"])
    assert total_received == 5
    total_approved = sum(p["approved"] for p in body["trend"])
    assert total_approved == 2
