from html import escape
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from api.settings import FRONTEND_URL, PASSWORD_RESET_TTL_MINUTES, RESEND_API_KEY, RESEND_FROM_EMAIL


def resend_is_configured() -> bool:
    return bool(RESEND_API_KEY and RESEND_FROM_EMAIL)


def send_password_reset_email(email: str, token: str) -> None:
    if not resend_is_configured():
        raise RuntimeError("Resend email settings are missing.")

    parsed_url = urlsplit(FRONTEND_URL)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise RuntimeError("FRONTEND_URL must be an absolute HTTP(S) URL.")

    query = urlencode([*parse_qsl(parsed_url.query, keep_blank_values=True), ("reset_token", token)])
    reset_url = urlunsplit(parsed_url._replace(query=query))
    safe_url = escape(reset_url, quote=True)
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": RESEND_FROM_EMAIL,
            "to": [email],
            "subject": "Reset your BloodSight password",
            "html": (
                "<p>Use the link below to reset your BloodSight password. "
                f"It expires in {PASSWORD_RESET_TTL_MINUTES} minutes and can be used once.</p>"
                f'<p><a href="{safe_url}">Reset password</a></p>'
                "<p>If you did not request this, you can ignore this email.</p>"
            ),
            "text": (
                "Use this link to reset your BloodSight password. "
                f"It expires in {PASSWORD_RESET_TTL_MINUTES} minutes and can be used once: {reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            ),
        },
        timeout=10,
    )
    response.raise_for_status()