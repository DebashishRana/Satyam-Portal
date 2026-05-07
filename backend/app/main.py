"""
Satyam Portal - Digital Trust Layer for Government Procurement
Main FastAPI Application
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router
from app.services.task_queue import init_queue
from app.models import bidder_portal, tender  # noqa: F401 - register ORM models before create_all

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    logger.info("Starting up Satyam Portal...")
    await init_db()
    try:
        await init_queue()
    except Exception as e:
        logger.warning(f"Task queue init failed (optional): {e}")
    logger.info("Satyam Portal started successfully!")
    yield
    # Shutdown
    logger.info("Shutting down Satyam Portal...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-driven tender evaluation and transparency platform for government procurement",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Satyam Portal API",
        "version": settings.VERSION,
        "docs": "/docs",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@app.get("/api/v1/status")
async def api_status():
    return {
        "api_version": "v1",
        "status": "operational",
        "services": {
            "auth": "operational",
            "document_processing": "operational",
            "verification": "operational",
            "evaluation": "operational"
        }
    }
