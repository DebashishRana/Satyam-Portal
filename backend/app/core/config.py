"""
Application Configuration
"""

from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Satyam Portal"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/satyam")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    ALGORITHM: str = "HS256"
    
    # CORS
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    OCR_OUTPUT_DIR: str = "ocr-output"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # AI/ML Settings
    OCR_CONFIDENCE_THRESHOLD: float = 0.85
    LAYOUT_LM_MODEL: str = "microsoft/layoutlmv3-base"
    
    # External APIs
    DIGILOCKER_API_URL: str = os.getenv("DIGILOCKER_API_URL", "")
    GSTN_API_URL: str = os.getenv("GSTN_API_URL", "")
    MCA_API_URL: str = os.getenv("MCA_API_URL", "")
    SARVAM_API_BASE_URL: str = os.getenv("SARVAM_API_BASE_URL", "https://api.sarvam.ai")
    CLOUDOCR_API_KEY: str = os.getenv("CLOUDOCR_API_KEY", "")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")

    # Notifications
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:3001")
    NOTIFICATION_EMAIL_MODE: str = os.getenv("NOTIFICATION_EMAIL_MODE", "console")  # console, testmail, smtp
    NOTIFICATION_FROM_EMAIL: str = os.getenv("NOTIFICATION_FROM_EMAIL", "no-reply@satyam.local")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_TIMEOUT_SECONDS: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    TESTMAIL_API_KEY: str = os.getenv("TESTMAIL_API_KEY", "")
    TESTMAIL_NAMESPACE: str = os.getenv("TESTMAIL_NAMESPACE", "")
    TESTMAIL_TAG_PREFIX: str = os.getenv("TESTMAIL_TAG_PREFIX", "satyam")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"

settings = Settings()
