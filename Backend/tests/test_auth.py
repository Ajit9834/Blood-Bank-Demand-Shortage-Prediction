from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import httpx

from fastapi.testclient import TestClient

from api import db, mail_service
from api.dependencies import get_current_user
from api.main import app
from api.routes import auth as auth_routes
from api.security import hash_password, verify_password


client = TestClient(app)


def test_password_hash_is_salted_and_verifiable():
    first_hash = hash_password("secure-test-password-1")
    second_hash = hash_password("secure-test-password-1")

    assert first_hash != second_hash
    assert verify_password("secure-test-password-1", first_hash)
    assert not verify_password("wrong-password-000", first_hash)


def test_register_creates_account_and_returns_session(monkeypatch):
    created_at = datetime.now(timezone.utc)
    created_password_hashes = []
    sessions = []

    def create_user(email, password_hash):
        created_password_hashes.append(password_hash)
        return {"id": 42, "email": email, "created_at": created_at}

    monkeypatch.setattr(db, "create_user", create_user)
    monkeypatch.setattr(
        db,
        "create_session",
        lambda user_id, token, expires_at: sessions.append((user_id, token, expires_at)),
    )

    response = client.post(
        "/api/auth/register",
        json={"email": " Person@Example.com ", "password": "abcd"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["id"] == 42
    assert data["user"]["email"] == "person@example.com"
    assert data["access_token"]
    assert sessions[0][0] == 42
    assert verify_password("abcd", created_password_hashes[0])


def test_register_rejects_password_shorter_than_four_characters():
    response = client.post(
        "/api/auth/register",
        json={"email": "person@example.com", "password": "abc"},
    )

    assert response.status_code == 422


def test_forgot_password_uses_generic_response_for_unknown_email(monkeypatch):
    monkeypatch.setattr(auth_routes, "resend_is_configured", lambda: True)
    monkeypatch.setattr(db, "get_user_by_email", lambda email: None)
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        lambda email, token: (_ for _ in ()).throw(AssertionError("email should not send")),
    )

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "person@example.com"},
    )

    assert response.status_code == 202
    assert response.json()["message"] == "If an account exists for that email, a reset link will be sent."


def test_forgot_password_reports_missing_resend_configuration(monkeypatch):
    looked_up = []
    monkeypatch.setattr(auth_routes, "resend_is_configured", lambda: False)
    monkeypatch.setattr(db, "get_user_by_email", lambda email: looked_up.append(email))

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "person@example.com"},
    )

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
    assert looked_up == []


def test_forgot_password_sends_token_but_never_returns_it(monkeypatch):
    monkeypatch.setattr(auth_routes, "resend_is_configured", lambda: True)
    monkeypatch.setattr(
        db,
        "get_user_by_email",
        lambda email: {"id": 43, "email": email},
    )
    saved_tokens = []
    sent_emails = []
    monkeypatch.setattr(
        db,
        "create_password_reset",
        lambda user_id, token, expires_at: saved_tokens.append((user_id, token, expires_at)) or True,
    )
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        lambda email, token: sent_emails.append((email, token)),
    )

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "person@example.com"},
    )

    assert response.status_code == 202
    assert saved_tokens[0][0] == 43
    assert sent_emails == [("person@example.com", saved_tokens[0][1])]
    assert saved_tokens[0][1] not in response.text


def test_password_reset_email_uses_resend_and_includes_link(monkeypatch):
    captured = {}

    class SuccessfulResponse:
        def raise_for_status(self):
            return None

    def post(url, *, headers, json, timeout):
        captured.update({"url": url, "headers": headers, "payload": json, "timeout": timeout})
        return SuccessfulResponse()

    monkeypatch.setattr(mail_service, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(mail_service, "RESEND_FROM_EMAIL", "BloodSight <verified@example.com>")
    monkeypatch.setattr(mail_service, "FRONTEND_URL", "http://localhost:5173/")
    monkeypatch.setattr(mail_service.httpx, "post", post)

    mail_service.send_password_reset_email("person@example.com", "test-reset-token-value-123456")

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"]["to"] == ["person@example.com"]
    assert parse_qs(urlsplit(captured["payload"]["text"].split(": ")[-1].splitlines()[0]).query) == {
        "reset_token": ["test-reset-token-value-123456"]
    }


def test_forgot_password_skips_email_during_cooldown(monkeypatch):
    monkeypatch.setattr(auth_routes, "resend_is_configured", lambda: True)
    monkeypatch.setattr(
        db,
        "get_user_by_email",
        lambda email: {"id": 43, "email": email},
    )
    monkeypatch.setattr(db, "create_password_reset", lambda user_id, token, expires_at: False)
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        lambda email, token: (_ for _ in ()).throw(AssertionError("email should be rate limited")),
    )

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "person@example.com"},
    )

    assert response.status_code == 202
    assert "If an account exists" in response.json()["message"]


def test_reset_password_updates_hash_and_consumes_token(monkeypatch):
    consumed = []

    def reset_password(token, password_hash):
        consumed.append((token, password_hash))
        return True

    monkeypatch.setattr(db, "reset_password", reset_password)
    response = client.post(
        "/api/auth/reset-password",
        json={"token": "a-valid-reset-token-that-is-long-enough", "password": "abcd"},
    )

    assert response.status_code == 204
    assert consumed[0][0] == "a-valid-reset-token-that-is-long-enough"
    assert verify_password("abcd", consumed[0][1])


def test_reset_password_rejects_invalid_or_expired_token(monkeypatch):
    monkeypatch.setattr(db, "reset_password", lambda token, password_hash: False)
    response = client.post(
        "/api/auth/reset-password",
        json={"token": "a-valid-reset-token-that-is-long-enough", "password": "abcd"},
    )

    assert response.status_code == 400


def test_login_verifies_password_and_returns_session(monkeypatch):
    created_at = datetime.now(timezone.utc)
    monkeypatch.setattr(
        db,
        "get_user_by_email",
        lambda email: {
            "id": 43,
            "email": email,
            "password_hash": hash_password("abcd"),
            "created_at": created_at,
        },
    )
    sessions = []
    monkeypatch.setattr(
        db,
        "create_session",
        lambda user_id, token, expires_at: sessions.append(user_id),
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": "abcd"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["id"] == 43
    assert sessions == [43]


def test_logout_revokes_authenticated_session(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "id": 99,
        "email": "person@example.com",
    }
    revoked = []
    monkeypatch.setattr(db, "delete_session", revoked.append)

    try:
        response = client.post(
            "/api/auth/logout",
            headers={"Authorization": "Bearer session-token"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 204
    assert revoked == ["session-token"]