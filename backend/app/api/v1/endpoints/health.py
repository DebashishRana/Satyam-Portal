"""
Health Check Endpoints
"""

from fastapi import APIRouter
import platform
import sys
from datetime import datetime

router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "python_version": sys.version,
        "platform": platform.platform()
    }

@router.get("/detailed")
async def detailed_health():
    """Detailed health check with component status."""
    # In production, check actual database, Redis, etc.
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "api": "operational",
            "database": "operational",  # Would check actual connection
            "redis": "operational",     # Would check actual connection
            "ocr_service": "operational",
            "evaluation_engine": "operational"
        },
        "metrics": {
            "uptime_seconds": 3600,  # Mock value
            "requests_per_minute": 120,  # Mock value
            "error_rate": 0.01  # Mock value
        }
    }
