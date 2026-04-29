"""
Tender Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer
from typing import List, Optional
from datetime import datetime
import uuid

from app.core.security import verify_token
from app.schemas.tender import (
    TenderCreate, TenderResponse, TenderList,
    EligibilityCriteria, TenderStatus, TenderSummary
)

router = APIRouter()
security = HTTPBearer()

# Mock tender database
TENDERS_DB = {}

@router.post("/", response_model=TenderResponse)
async def create_tender(
    tender_data: TenderCreate,
    token: str = Depends(security)
):
    """Create a new tender (Officer only)."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can create tenders"
        )
    
    tender_id = str(uuid.uuid4())
    tender = {
        "id": tender_id,
        "title": tender_data.title,
        "reference_number": tender_data.reference_number,
        "description": tender_data.description,
        "organization": payload.get("organization"),
        "created_by": payload.get("user_id"),
        "status": TenderStatus.DRAFT,
        "eligibility_criteria": [criteria.dict() for criteria in tender_data.eligibility_criteria],
        "publication_date": None,
        "closing_date": tender_data.closing_date.isoformat() if tender_data.closing_date else None,
        "estimated_value": tender_data.estimated_value,
        "category": tender_data.category,
        "documents": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    TENDERS_DB[tender_id] = tender
    
    return TenderResponse(
        id=tender_id,
        title=tender["title"],
        reference_number=tender["reference_number"],
        status=tender["status"],
        message="Tender created successfully"
    )

@router.get("/", response_model=List[TenderList])
async def list_tenders(
    status: Optional[TenderStatus] = None,
    category: Optional[str] = None,
    organization: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    token: str = Depends(security)
):
    """List all tenders with optional filters."""
    verify_token(token.credentials)
    
    tenders = []
    for tender in TENDERS_DB.values():
        if status and tender["status"] != status:
            continue
        if category and tender.get("category") != category:
            continue
        if organization and tender.get("organization") != organization:
            continue
        
        tenders.append(TenderList(
            id=tender["id"],
            title=tender["title"],
            reference_number=tender["reference_number"],
            status=tender["status"],
            category=tender.get("category"),
            closing_date=tender.get("closing_date"),
            estimated_value=tender.get("estimated_value")
        ))
    
    return tenders[skip:skip+limit]

@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(
    tender_id: str,
    token: str = Depends(security)
):
    """Get detailed tender information including eligibility criteria."""
    verify_token(token.credentials)
    
    tender = TENDERS_DB.get(tender_id)
    if not tender:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )
    
    return TenderResponse(
        id=tender["id"],
        title=tender["title"],
        reference_number=tender["reference_number"],
        description=tender["description"],
        status=tender["status"],
        eligibility_criteria=[EligibilityCriteria(**c) for c in tender["eligibility_criteria"]],
        documents=tender["documents"],
        created_at=tender["created_at"],
        updated_at=tender["updated_at"]
    )

@router.get("/{tender_id}/summary", response_model=TenderSummary)
async def get_tender_summary(
    tender_id: str,
    token: str = Depends(security)
):
    """Get AI-extracted tender summary for quick review."""
    verify_token(token.credentials)
    
    tender = TENDERS_DB.get(tender_id)
    if not tender:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )
    
    # Categorize criteria
    technical = []
    financial = []
    compliance = []
    
    for criteria in tender["eligibility_criteria"]:
        if criteria["category"] == "technical":
            technical.append(criteria)
        elif criteria["category"] == "financial":
            financial.append(criteria)
        else:
            compliance.append(criteria)
    
    return TenderSummary(
        tender_id=tender_id,
        title=tender["title"],
        technical_criteria=len(technical),
        financial_criteria=len(financial),
        compliance_criteria=len(compliance),
        total_criteria=len(tender["eligibility_criteria"]),
        key_requirements=[c["description"] for c in tender["eligibility_criteria"][:5]]
    )

@router.post("/{tender_id}/publish")
async def publish_tender(
    tender_id: str,
    token: str = Depends(security)
):
    """Publish tender to make it available for bidding (Officer only)."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can publish tenders"
        )
    
    tender = TENDERS_DB.get(tender_id)
    if not tender:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )
    
    if tender["status"] != TenderStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish tender in {tender['status']} status"
        )
    
    tender["status"] = TenderStatus.PUBLISHED
    tender["publication_date"] = datetime.utcnow().isoformat()
    tender["updated_at"] = datetime.utcnow().isoformat()
    
    return {"message": "Tender published successfully", "tender_id": tender_id}
