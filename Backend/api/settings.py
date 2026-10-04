import os
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_env_file() -> None:
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, separator, value = line.partition("=")
        if not separator:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


_load_env_file()


def database_is_configured() -> bool:
    return bool(os.getenv("DATABASE_URL", "").strip())


def get_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        raise RuntimeError("DATABASE_URL must be set in the environment or Backend/.env.")

    parts = urlsplit(raw_url)
    if (
        parts.scheme not in {"postgres", "postgresql"}
        or not parts.hostname
        or not parts.username
        or parts.password is None
        or not parts.path.strip("/")
    ):
        raise RuntimeError("DATABASE_URL must be a complete PostgreSQL connection URL.")

    username = quote(unquote(parts.username), safe="")
    password = quote(unquote(parts.password), safe="")
    host = parts.hostname
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    netloc = f"{username}:{password}@{host}"
    if parts.port:
        netloc += f":{parts.port}"
    return parts._replace(netloc=netloc).geturl()


SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "168"))
if SESSION_TTL_HOURS < 1:
    raise ValueError("SESSION_TTL_HOURS must be a positive integer.")

PASSWORD_RESET_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "60"))
if PASSWORD_RESET_TTL_MINUTES < 1:
    raise ValueError("PASSWORD_RESET_TTL_MINUTES must be a positive integer.")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "").strip()
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    os.getenv("PASSWORD_RESET_URL", "http://localhost:5173/"),
).strip()