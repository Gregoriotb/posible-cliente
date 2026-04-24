"""Tests de PATCH /v1/budgets/:id y POST /:id/notes (SC-000 Fase 5)."""
import pytest


@pytest.fixture
def one_budget(client, ingest_key, admin_key):
    _, ingest_plain = ingest_key
    r = client.post(
        "/v1/budgets",
        headers={"X-API-Key": ingest_plain},
        json={
            "external_id": "w-001",
            "client_name": "Ana",
            "client_email": "ana@x.com",
            "service_type": "Chatbot WhatsApp",
            "description": "demo para tests de escritura",
            "estimated_amount": "1000.00",
            "source": "whatsapp",
        },
    )
    assert r.status_code == 201
    return r.json()["id"]


def test_patch_requires_update_scope(client, one_budget, ingest_key):
    _, ingest_plain = ingest_key  # solo budgets:write
    r = client.patch(f"/v1/budgets/{one_budget}", headers={"X-API-Key": ingest_plain}, json={"priority": "urgent"})
    assert r.status_code == 403


def test_patch_404(client, admin_key):
    _, plain = admin_key
    r = client.patch("/v1/budgets/missing", headers={"X-API-Key": plain}, json={"priority": "urgent"})
    assert r.status_code == 404


def test_patch_priority(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.patch(f"/v1/budgets/{one_budget}", headers={"X-API-Key": plain}, json={"priority": "urgent"})
    assert r.status_code == 200, r.text
    assert r.json()["priority"] == "urgent"


def test_patch_status_valid_transition_registers_history(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.patch(
        f"/v1/budgets/{one_budget}",
        headers={"X-API-Key": plain},
        json={"status": "en_revision"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "en_revision"
    transitions = [sc for sc in body["status_changes"] if sc["from_status"] == "recibido"]
    assert len(transitions) == 1
    assert transitions[0]["to_status"] == "en_revision"


def test_patch_status_invalid_transition_returns_400(client, one_budget, admin_key):
    _, plain = admin_key
    # recibido -> aprobado NO es válido (hay que pasar por en_revision → cotizado → aprobado)
    r = client.patch(
        f"/v1/budgets/{one_budget}",
        headers={"X-API-Key": plain},
        json={"status": "aprobado"},
    )
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert detail["error"] == "invalid_status_transition"
    assert detail["from"] == "recibido"
    assert "en_revision" in detail["allowed_next"]


def test_patch_cancelled_requires_reason(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.patch(
        f"/v1/budgets/{one_budget}",
        headers={"X-API-Key": plain},
        json={"status": "cancelado"},
    )
    assert r.status_code == 400
    assert "razón" in r.json()["detail"].lower()


def test_patch_cancelled_with_reason_ok(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.patch(
        f"/v1/budgets/{one_budget}",
        headers={"X-API-Key": plain},
        json={"status": "cancelado", "reason": "Cliente desistió"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "cancelado"
    sc = [x for x in body["status_changes"] if x["to_status"] == "cancelado"][0]
    assert sc["reason"] == "Cliente desistió"


def test_patch_no_changes_returns_400(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.patch(f"/v1/budgets/{one_budget}", headers={"X-API-Key": plain}, json={})
    assert r.status_code == 400


def test_notes_requires_update_scope(client, one_budget, ingest_key):
    _, plain = ingest_key
    r = client.post(
        f"/v1/budgets/{one_budget}/notes",
        headers={"X-API-Key": plain},
        json={"content": "foo"},
    )
    assert r.status_code == 403


def test_add_note_happy(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.post(
        f"/v1/budgets/{one_budget}/notes",
        headers={"X-API-Key": plain},
        json={"content": "Cliente pidió reunión el jueves"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["content"] == "Cliente pidió reunión el jueves"
    # author por defecto = nombre de la key si no se pasa
    assert body["author"] == "Test Admin"

    # aparece en el detalle
    detail = client.get(f"/v1/budgets/{one_budget}", headers={"X-API-Key": plain}).json()
    assert any(n["id"] == body["id"] for n in detail["notes"])


def test_add_note_custom_author(client, one_budget, admin_key):
    _, plain = admin_key
    r = client.post(
        f"/v1/budgets/{one_budget}/notes",
        headers={"X-API-Key": plain},
        json={"content": "nota", "author": "Jefa Ventas"},
    )
    assert r.status_code == 201
    assert r.json()["author"] == "Jefa Ventas"
