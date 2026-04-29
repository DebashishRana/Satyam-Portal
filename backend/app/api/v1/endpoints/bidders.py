"""
Bidder Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer
from typing import List, Optional
from datetime import datetime
import uuid

from app.core.security import verify_token
from app.schemas.bidder import BidderCreate, BidderResponse, BidSubmission, SubmissionStatus

router = APIRouter()
security = HTTPBearer()

# Mock bidder database
BIDDERS_DB = {}
SUBMISSIONS_DB = {}

@router.post("/register", response_model=BidderResponse)
async def register_bidder(
    bidder_data: BidderCreate,
    token: str = Depends(security)
):
    """Register a new bidder organization."""
    payload = verify_token(token.credentials)
    
    bidder_id = str(uuid.uuid4())
    bidder = {
        "id": bidder_id,
        "organization_name": bidder_data.organization_name,
        "registration_number": bidder_data.registration_number,
        "gstin": bidder_data.gstin,
        "pan": bidder_data.pan,
        "contact_email": bidder_data.contact_email,
        "contact_phone": bidder_data.contact_phone,
        "address": bidder_data.address,
        "created_by": payload.get("user_id"),
        "created_at": datetime.utcnow().isoformat(),
        "is_verified": False
    }
    
    BIDDERS_DB[bidder_id] = bidder
    
    return BidderResponse(
        id=bidder_id,
        organization_name=bidder["organization_name"],
        gstin=bidder["gstin"],
        is_verified=bidder["is_verified"],
        message="Bidder registered successfully"
    )

@router.post("/{tender_id}/submit")
async def submit_bid(
    tender_id: str,
    submission: BidSubmission,
    token: str = Depends(security)
):
    """Submit a bid for a tender."""
    payload = verify_token(token.credentials)
    
    if payload.get("role") != "bidder":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bidders can submit bids"
        )
    
    submission_id = str(uuid.uuid4())
    
    bid_submission = {
        "id": submission_id,
        "tender_id": tender_id,
        "bidder_id": payload.get("user_id"),
        "bidder_organization": payload.get("organization"),
        "technical_documents": submission.technical_documents,
        "financial_documents": submission.financial_documents,
        "compliance_documents": submission.compliance_documents,
        "emd_document": submission.emd_document,
        "status": SubmissionStatus.SUBMITTED,
        "submitted_at": datetime.utcnow().isoformat(),
        "evaluation_status": "pending",
        "current_stage": "Preliminary Scrutiny",
        "stage_percentage": 10
    }
    
    SUBMISSIONS_DB[submission_id] = bid_submission
    
    return {
        "message": "Bid submitted successfully",
        "submission_id": submission_id,
        "status": SubmissionStatus.SUBMITTED,
        "tracking_url": f"/api/v1/bidders/submissions/{submission_id}/status"
    }

@router.get("/submissions/{submission_id}/status")
async def get_submission_status(
    submission_id: str,
    token: str = Depends(security)
):
    """Get bid submission status with pizza-tracker style progress."""
    payload = verify_token(token.credentials)
    
    submission = SUBMISSIONS_DB.get(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Check ownership or officer role
    if payload.get("user_id") != submission["bidder_id"] and payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this submission"
        )
    
    stages = [
        {"name": "Submitted", "completed": True, "date": submission["submitted_at"]},
        {"name": "Preliminary Scrutiny", "completed": submission["stage_percentage"] >= 25, "status": "in_progress" if submission["stage_percentage"] < 25 else "completed"},
        {"name": "Technical Evaluation", "completed": submission["stage_percentage"] >= 50, "status": "pending"},
        {"name": "Financial Evaluation", "completed": submission["stage_percentage"] >= 75, "status": "pending"},
        {"name": "Final Outcome", "completed": submission["stage_percentage"] >= 100, "status": "pending"}
    ]
    
    return {
        "submission_id": submission_id,
        "tender_id": submission["tender_id"],
        "current_stage": submission["current_stage"],
        "stage_percentage": submission["stage_percentage"],
        "overall_status": submission["status"],
        "evaluation_status": submission["evaluation_status"],
        "stages": stages,
        "last_updated": datetime.utcnow().isoformat()
    }

@router.get("/my-submissions")
async def list_my_submissions(
    token: str = Depends(security)
):
    """List all submissions for the logged-in bidder."""
    payload = verify_token(token.credentials)
    
    if payload.get("role") != "bidder":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bidders can view their submissions"
        )
    
    user_id = payload.get("user_id")
    my_submissions = [
        {
            "submission_id": s["id"],
            "tender_id": s["tender_id"],
            "status": s["status"],
            "current_stage": s["current_stage"],
            "submitted_at": s["submitted_at"]
        }
        for s in SUBMISSIONS_DB.values()
        if s["bidder_id"] == user_id
    ]
    
    return {"submissions": my_submissions, "total": len(my_submissions)}
