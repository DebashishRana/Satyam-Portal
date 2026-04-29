"""
Tender Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

class TenderStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    OPEN = "open"
    CLOSED = "closed"
    UNDER_EVALUATION = "under_evaluation"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class CriterionCategory(str, Enum):
    TECHNICAL = "technical"
    FINANCIAL = "financial"
    COMPLIANCE = "compliance"
    LEGAL = "legal"
    EXPERIENCE = "experience"

class EligibilityCriteria(BaseModel):
    criterion_id: str = Field(..., description="Unique identifier for the criterion")
    category: CriterionCategory
    description: str = Field(..., description="Human-readable description")
    condition: str = Field(..., description="The condition to check")
    threshold: Optional[str] = None
    threshold_value: Optional[float] = None
    unit: Optional[str] = None
    period_years: Optional[int] = None
    mandatory: bool = True
    comparison_operator: Optional[str] = None  # >=, <=, ==, >, <
    logic: Optional[str] = None  # Machine-readable logic
    penalty: Optional[str] = None  # disqualify, score_based

class TenderCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=500)
    reference_number: str = Field(..., description="Official tender reference number")
    description: Optional[str] = None
    category: Optional[str] = None
    estimated_value: Optional[Decimal] = None
    currency: str = "INR"
    eligibility_criteria: List[EligibilityCriteria]
    closing_date: Optional[date] = None
    documents_required: Optional[List[str]] = None

class TenderResponse(BaseModel):
    id: str
    title: str
    reference_number: str
    description: Optional[str] = None
    status: TenderStatus
    eligibility_criteria: Optional[List[EligibilityCriteria]] = None
    documents: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    publication_date: Optional[str] = None
    closing_date: Optional[str] = None
    message: Optional[str] = None

class TenderList(BaseModel):
    id: str
    title: str
    reference_number: str
    status: TenderStatus
    category: Optional[str] = None
    closing_date: Optional[str] = None
    estimated_value: Optional[Decimal] = None

class TenderSummary(BaseModel):
    tender_id: str
    title: str
    technical_criteria: int
    financial_criteria: int
    compliance_criteria: int
    total_criteria: int
    key_requirements: List[str]
    ai_extracted_summary: Optional[str] = None
    risk_flags: Optional[List[str]] = None
