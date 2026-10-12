"""Entrypoint alias for the FastAPI application.

Allows running either:
    uvicorn api.main:app --reload
or
    uvicorn main:app --reload
"""
from api.main import app

__all__ = ["app"]
