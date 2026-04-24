"""Tests del endpoint POST /v1/auth/login."""
import pytest


@pytest.fixture
def configured_login(monkeypatch):
    """Configura las env vars esperadas por el endpoint de login."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_username", "gregoriotb")
    monkeypatch.setattr(settings, "admin_password", "1745694")
    monkeypatch.setattr(settings, "admin_api_key", "artf_live_demokey_for_testing_purposes_only_abc123")
    return settings


def test_login_503_if_not_configured(client):
    """Sin env vars configuradas, login devuelve 503."""
    r = client.post("/v1/auth/login", json={"username": "x", "password": "y"})
    assert r.status_code == 503
    assert "no configurado" in r.json()["detail"].lower()


def test_login_success(client, configured_login):
    r = client.post("/v1/auth/login", json={"username": "gregoriotb", "password": "1745694"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["api_key"].startswith("artf_live_")
    assert body["username"] == "gregoriotb"


def test_login_wrong_password(client, configured_login):
    r = client.post("/v1/auth/login", json={"username": "gregoriotb", "password": "wrong"})
    assert r.status_code == 401
    assert "incorrectos" in r.json()["detail"].lower()


def test_login_wrong_username(client, configured_login):
    r = client.post("/v1/auth/login", json={"username": "otro", "password": "1745694"})
    assert r.status_code == 401


def test_login_error_message_doesnt_leak_which_field_failed(client, configured_login):
    """Por seguridad, el mensaje de error no debe distinguir entre user/pass incorrecto."""
    r_wrong_user = client.post("/v1/auth/login", json={"username": "x", "password": "1745694"})
    r_wrong_pass = client.post("/v1/auth/login", json={"username": "gregoriotb", "password": "y"})
    assert r_wrong_user.json()["detail"] == r_wrong_pass.json()["detail"]


def test_login_requires_body(client, configured_login):
    r = client.post("/v1/auth/login", json={})
    assert r.status_code == 422


def test_login_empty_username(client, configured_login):
    r = client.post("/v1/auth/login", json={"username": "", "password": "x"})
    assert r.status_code == 422  # min_length=1
