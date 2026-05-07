"""
API Router Configuration
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, documents, tenders, bidders, evaluation, health, notifications, bidder_documents

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(tenders.router, prefix="/tenders", tags=["Tenders"])
api_router.include_router(bidders.router, prefix="/bidders", tags=["Bidders"])
api_router.include_router(bidder_documents.router, prefix="/bidders", tags=["Bidder Documents"])
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["Evaluation"])
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
