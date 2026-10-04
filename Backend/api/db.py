import hashlib
from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row

from api.settings import get_database_url


def get_connection() -> psycopg.Connection:
    return psycopg.connect(
        get_database_url(),
        sslmode="require",
        connect_timeout=10,
        row_factory=dict_row,
    )


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_users (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash CHAR(64) PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash CHAR(64) PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
            ON auth_sessions (expires_at)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
            ON password_reset_tokens (user_id)
            """
        )


def create_user(email: str, password_hash: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            """
            INSERT INTO app_users (email, password_hash)
            VALUES (%s, %s)
            RETURNING id, email, created_at
            """,
            (email, password_hash),
        ).fetchone()
    return dict(row)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, password_hash, created_at
            FROM app_users
            WHERE email = %s
            """,
            (email,),
        ).fetchone()
    return dict(row) if row else None


def create_session(user_id: int, token: str, expires_at: datetime) -> None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO auth_sessions (token_hash, user_id, expires_at)
            VALUES (%s, %s, %s)
            """,
            (token_hash, user_id, expires_at),
        )


def get_user_for_session(token: str) -> dict[str, Any] | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT app_users.id, app_users.email
            FROM auth_sessions
            JOIN app_users ON app_users.id = auth_sessions.user_id
            WHERE auth_sessions.token_hash = %s
              AND auth_sessions.expires_at > NOW()
            """,
            (token_hash,),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM auth_sessions WHERE token_hash = %s",
            (token_hash,),
        )


def create_password_reset(user_id: int, token: str, expires_at: datetime) -> bool:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(%s)", (user_id,))
        recent_request = connection.execute(
            """
            SELECT 1
            FROM password_reset_tokens
            WHERE user_id = %s AND created_at > NOW() - INTERVAL '1 minute'
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()
        if recent_request is not None:
            return False
        connection.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = %s",
            (user_id,),
        )
        connection.execute(
            """
            INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
            VALUES (%s, %s, %s)
            """,
            (token_hash, user_id, expires_at),
        )
    return True


def delete_password_reset(token: str) -> None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM password_reset_tokens WHERE token_hash = %s",
            (token_hash,),
        )


def reset_password(token: str, password_hash: str) -> bool:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        row = connection.execute(
            """
            DELETE FROM password_reset_tokens
            WHERE token_hash = %s AND expires_at > NOW()
            RETURNING user_id
            """,
            (token_hash,),
        ).fetchone()
        if row is None:
            return False
        connection.execute(
            "UPDATE app_users SET password_hash = %s WHERE id = %s",
            (password_hash, row["user_id"]),
        )
        connection.execute(
            "DELETE FROM auth_sessions WHERE user_id = %s",
            (row["user_id"],),
        )
    return True