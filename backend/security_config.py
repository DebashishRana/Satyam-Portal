"""Demo security configuration with env-only secrets."""

from __future__ import annotations

import os
from typing import Any, Dict, List


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * (len(value) - 4) + value[-4:]


SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "").strip()
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://admin.example.gov.in").split(",")
    if origin.strip()
]


def validate_security_config() -> None:
    missing = [
        name
        for name, value in {
            "SARVAM_API_KEY": SARVAM_API_KEY,
            "JWT_SECRET": JWT_SECRET,
            "ENCRYPTION_KEY": ENCRYPTION_KEY,
        }.items()
        if not value
    ]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


def security_summary() -> Dict[str, Any]:
    return {
        "allowed_origins": ALLOWED_ORIGINS,
        "sarvam_api_key": mask_secret(SARVAM_API_KEY),
        "jwt_secret": mask_secret(JWT_SECRET),
        "encryption_key": mask_secret(ENCRYPTION_KEY),
        "config_valid": all([SARVAM_API_KEY, JWT_SECRET, ENCRYPTION_KEY]),
    }
