"""Tests para el sistema de API Keys (SC-000)."""


def test_ping_no_auth(client):
    r = client.get("/v1/ping")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_me_requires_key(client):
    r = client.get("/v1/me")
    assert r.status_code == 401


def test_me_with_invalid_format(client):
    r = client.get("/v1/me", headers={"X-API-Key": "not-a-real-key"})
    assert r.status_code == 401


def test_me_with_valid_key(client, admin_key):
    _, plaintext = admin_key
    r = client.get("/v1/me", headers={"X-API-Key": plaintext})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Test Admin"
    assert "admin" in body["scopes"]
    assert "key" not in body  # plaintext nunca en GET


def test_create_key_requires_admin_scope(client, ingest_key):
    """Una key solo con budgets:write no puede crear otras keys."""
    _, plaintext = ingest_key
    r = client.post(
        "/v1/admin/api-keys",
        headers={"X-API-Key": plaintext},
        json={"name": "X", "scopes": ["budgets:read"]},
    )
    assert r.status_code == 403


def test_create_key_returns_plaintext_once(client, admin_key):
    _, admin_plaintext = admin_key
    r = client.post(
        "/v1/admin/api-keys",
        headers={"X-API-Key": admin_plaintext},
        json={"name": "Artificialic Prod", "scopes": ["budgets:write"], "rate_limit_per_minute": 120},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Artificialic Prod"
    assert body["scopes"] == ["budgets:write"]
    assert body["key"].startswith("artf_live_")
    assert body["prefix"] == body["key"][:16]


def test_list_keys_never_exposes_plaintext(client, admin_key):
    _, admin_plaintext = admin_key
    r = client.get("/v1/admin/api-keys", headers={"X-API-Key": admin_plaintext})
    assert r.status_code == 200
    for k in r.json()["data"]:
        assert "key" not in k
        assert "hash" not in k


def test_revoke_key_disables_it(client, admin_key):
    _, admin_plaintext = admin_key
    # crear una nueva
    create = client.post(
        "/v1/admin/api-keys",
        headers={"X-API-Key": admin_plaintext},
        json={"name": "To Revoke", "scopes": ["budgets:read"]},
    )
    new = create.json()
    new_plaintext = new["key"]
    new_id = new["id"]

    # funciona
    r = client.get("/v1/me", headers={"X-API-Key": new_plaintext})
    assert r.status_code == 200

    # revocar
    rev = client.delete(f"/v1/admin/api-keys/{new_id}", headers={"X-API-Key": admin_plaintext})
    assert rev.status_code == 204

    # ya no autentica
    r2 = client.get("/v1/me", headers={"X-API-Key": new_plaintext})
    assert r2.status_code == 401


def test_rotate_key(client, admin_key):
    _, admin_plaintext = admin_key
    create = client.post(
        "/v1/admin/api-keys",
        headers={"X-API-Key": admin_plaintext},
        json={"name": "To Rotate", "scopes": ["budgets:read"]},
    )
    old = create.json()
    old_plaintext = old["key"]
    old_id = old["id"]

    rot = client.post(f"/v1/admin/api-keys/{old_id}/rotate", headers={"X-API-Key": admin_plaintext})
    assert rot.status_code == 200
    new = rot.json()
    assert new["key"] != old_plaintext
    assert new["id"] != old_id
    # ambas funcionan durante el grace period
    assert client.get("/v1/me", headers={"X-API-Key": old_plaintext}).status_code == 200
    assert client.get("/v1/me", headers={"X-API-Key": new["key"]}).status_code == 200


def test_scope_mismatch_returns_403(client, ingest_key):
    _, plaintext = ingest_key
    r = client.get("/v1/admin/api-keys", headers={"X-API-Key": plaintext})
    assert r.status_code == 403
    assert "scope" in r.json()["detail"].lower()


def test_token_hash_timing_safe(db_session):
    """Sanity check: dos plaintexts distintos no colisionan y verify_token es hmac-based."""
    from app.core.security import generate_token, verify_token

    a_plain, a_hash, _ = generate_token()
    b_plain, b_hash, _ = generate_token()

    assert a_plain != b_plain
    assert a_hash != b_hash
    assert verify_token(a_plain, a_hash) is True
    assert verify_token(a_plain, b_hash) is False
    assert verify_token("random-noise", a_hash) is False


def test_redaction_filter():
    """El filtro de logging debería redactar patrones artf_*."""
    import logging
    from app.core.logging_filter import RedactSecretsFilter

    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg="received X-API-Key: artf_live_super_secret_token_123",
        args=(), exc_info=None,
    )
    flt = RedactSecretsFilter()
    flt.filter(record)
    msg = record.getMessage()
    assert "artf_live_super_secret_token_123" not in msg
    assert "REDACTED" in msg
