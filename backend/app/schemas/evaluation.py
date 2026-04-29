"""
Evaluation Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum

class EvaluationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REVIEW_REQUIRED = "review_required"
    FAILED = "failed"

class CriterionStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW = "REVIEW"
    NOT_EVALUATED = "NOT_EVALUATED"

class CriterionResult(BaseModel):
    criterion_id: str
    description: str
    category: str
    status: CriterionStatus
    extracted_value: Optional[str] = None
    required_value: Optional[str] = None
    comparison_operator: Optional[str] = None
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    reason_code: Optional[str] = None
    evidence_document_id: Optional[str] = None
    evidence_page: Optional[int] = None
    evidence_bbox: Optional[List[float]] = None  # [x1, y1, x2, y2]
    extracted_text: Optional[str] = None
    manual_override: Optional[bool] = False
    overridden_by: Optional[str] = None
    override_comment: Optional[str] = None
    override_timestamp: Optional[str] = None

class VerificationCard(BaseModel):
    evaluation_id: str
    criterion_id: str
    criterion_description: str
    status: CriterionStatus
    extracted_value: Optional[str] = None
    required_value: Optional[str] = None
    comparison_operator: Optional[str] = None
    evidence_document_id: Optional[str] = None
    evidence_page: Optional[int] = None
    evidence_bbox: Optional[List[float]] = None
    extracted_text: Optional[str] = None
    confidence_score: float
    reason_code: Optional[str] = None

class EvaluationResult(BaseModel):
    evaluation_id: str
    tender_id: str
    bidder_id: str
    overall_result: str  # PASS, FAIL, REVIEW
    status: EvaluationStatus
    criterion_results: List[CriterionResult]
    risk_flags: Optional[List[str]] = None
    confidence_score: float
    evaluated_at: Optional[str] = None
    message: Optional[str] = None

class BidderEvaluation(BaseModel):
    bidder_id: str
    bidder_name: Optional[str] = None
    overall_result: str
    status: EvaluationStatus
    criteria_breakdown: Dict[str, int]  # passed, failed, review counts
    final_score: Optional[float] = None
    rank: Optional[int] = None

class EvaluationReport(BaseModel):
    report_id: str
    evaluation_id: str
    tender_id: str
    bidder_id: str
    generated_at: str
    overall_result: str
    criterion_results: List[CriterionResult]
    risk_flags: Optional[List[str]] = None
    audit_trail: List[Dict[str, Any]]
    reasoned_order: Optional[str] = None
    annexures: Optional[List[Dict[str, Any]]] = None

class ComparisonMatrix(BaseModel):
    tender_id: str
    criteria: List[str]
    bidders: List[BidderEvaluation]
