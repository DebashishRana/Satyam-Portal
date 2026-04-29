"""
Bidder Schemas
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class BidderStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    BLACKLISTED = "blacklisted"
    UNDER_REVIEW = "under_review"

class BidderCreate(BaseModel):
    organization_name: str = Field(..., min_length=3, max_length=200)
    registration_number: Optional[str] = None
    gstin: Optional[str] = Field(None, pattern=r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$')
    pan: Optional[str] = Field(None, pattern=r'^[A-Z]{5}\d{4}[A-Z]{1}$')
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    address: Optional[Dict[str, str]] = None
    msme_registration: Optional[str] = None
    iso_certifications: Optional[List[str]] = None

class BidderResponse(BaseModel):
    id: str
    organization_name: str
    gstin: Optional[str] = None
    is_verified: bool
    status: Optional[BidderStatus] = BidderStatus.ACTIVE
    created_at: Optional[str] = None
    message: Optional[str] = None

class SubmissionStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_SCRUTINY = "under_scrutiny"
    TECHNICAL_EVALUATION = "technical_evaluation"
    FINANCIAL_EVALUATION = "financial_evaluation"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CLARIFICATION_REQUESTED = "clarification_requested"

class BidSubmission(BaseModel):
    technical_documents: List[str]  # Document IDs
    financial_documents: List[str]
    compliance_documents: List[str]
    emd_document: Optional[str] = None  # Earnest Money Deposit
    boq_document: Optional[str] = None  # Bill of Quantities
    additional_documents: Optional[Dict[str, str]] = None
    notes: Optional[str] = None

class SubmissionResponse(BaseModel):
    submission_id: str
    tender_id: str
    bidder_id: str
    status: SubmissionStatus
    current_stage: str
    stage_percentage: int
    submitted_at: str
    last_updated: Optional[str] = None
    message: Optional[str] = None

class BidderProfile(BaseModel):
    id: str
    organization_name: str
    registration_number: Optional[str]
    gstin: Optional[str]
    pan: Optional[str]
    contact_email: EmailStr
    contact_phone: Optional[str]
    address: Optional[Dict[str, str]]
    is_verified: bool
    verification_documents: Optional[List[str]]
    past_tenders_participated: int = 0
    past_tenders_won: int = 0
    blacklist_status: Optional[str] = None

class ClarificationRequest(BaseModel):
    id: str
    submission_id: str
    criterion_id: Optional[str]
    question: str
    requested_documents: Optional[List[str]]
    deadline: Optional[datetime]
    status: str
    response: Optional[str] = None
    response_documents: Optional[List[str]] = None
