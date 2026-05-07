"""
Notification audit and retry endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer

from app.core.security import verify_token
from app.services.notifications import get_notification_logs, notification_service

router = APIRouter()
security = HTTPBearer()


@router.get("/")
async def list_notifications(token: str = Depends(security)):
    """List notification logs for audit/debugging."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can view notification logs"
        )
    return {"notifications": get_notification_logs()}


@router.post("/{notification_id}/retry")
async def retry_notification(notification_id: str, token: str = Depends(security)):
    """Retry a failed notification."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can retry notifications"
        )
    result = await notification_service.retry(notification_id)
    if not result.get("retried"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.get("error"))
    return result
