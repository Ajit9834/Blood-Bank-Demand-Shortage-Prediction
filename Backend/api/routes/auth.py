import logging
import secrets
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from api import db
from api.dependencies import bearer_scheme, get_current_user
from api.schemas.auth import AuthMessage, AuthResponse, CredentialsRequest, EmailRequest, ResetPasswordRequest, UserResponse
from api.security import hash_password, verify_password
from api.mail_service import resend_is_configured, send_password_reset_email
from api.settings import PASSWORD_RESET_TTL_MINUTES, SESSION_TTL_HOURS


router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


def _issue_session(user: dict) -> AuthResponse:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
    db.create_session(user["id"], token, expires_at)
    return AuthResponse(
        access_token=token,
        expires_in=int(timedelta(hours=SESSION_TTL_HOURS).total_seconds()),
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            created_at=user["created_at"],
        ),
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(request: CredentialsRequest) -> AuthResponse:
    try:
        user = db.create_user(request.email, hash_password(request.password))
    except psycopg.errors.UniqueViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None
    return _issue_session(user)


@router.post("/login", response_model=AuthResponse)
def login(request: CredentialsRequest) -> AuthResponse:
    user = db.get_user_by_email(request.email)
    if user is None or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_session(user)


@router.post("/forgot-password", response_model=AuthMessage, status_code=status.HTTP_202_ACCEPTED)
def forgot_password(request: EmailRequest) -> AuthMessage:
    if not resend_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured. Contact the administrator.",
        )
    user = db.get_user_by_email(request.email)
    if user is not None:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
        if not db.create_password_reset(user["id"], token, expires_at):
            return AuthMessage(message="If an account exists for that email, a reset link will be sent.")
        try:
            send_password_reset_email(user["email"], token)
        except Exception:
            db.delete_password_reset(token)
            logger.exception("Password reset email delivery failed.")
    return AuthMessage(message="If an account exists for that email, a reset link will be sent.")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(request: ResetPasswordRequest) -> Response:
    if not db.reset_password(request.token, hash_password(request.password)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The reset link is invalid or has expired.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    _: dict = Depends(get_current_user),
) -> Response:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    db.delete_session(credentials.credentials)
    return Response(status_code=status.HTTP_204_NO_CONTENT)