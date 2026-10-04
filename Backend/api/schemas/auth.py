from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class EmailRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized.count("@") != 1 or "." not in normalized.rsplit("@", 1)[1]:
            raise ValueError("Enter a valid email address.")
        return normalized


class CredentialsRequest(EmailRequest):
    password: str = Field(..., min_length=4, max_length=128)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32, max_length=128)
    password: str = Field(..., min_length=4, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AuthMessage(BaseModel):
    message: str