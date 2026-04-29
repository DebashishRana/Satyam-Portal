"""
Evaluation Engine Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from typing import List, Optional
from datetime import datetime
import uuid

from app.core.security import verify_token
from app.schemas.evaluation import (
    EvaluationResult, EvaluationStatus, CriterionResult,
    VerificationCard, EvaluationReport, BidderEvaluation
)
from app.services.evaluation_engine import EvaluationEngine

router = APIRouter()
security = HTTPBearer()

# Mock evaluation database
EVALUATIONS_DB = {}

@router.post("/{tender_id}/evaluate/{bidder_id}", response_model=EvaluationResult)
async def evaluate_bidder(
    tender_id: str,
    bidder_id: str,
    token: str = Depends(security)
):
    """Trigger AI evaluation for a bidder's submission."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can run evaluations"
        )
    
    evaluation_id = str(uuid.uuid4())
    
    # Initialize evaluation engine
    engine = EvaluationEngine()
    
    # Run evaluation
    result = await engine.evaluate_bidder(tender_id, bidder_id)
    
    evaluation = {
        "id": evaluation_id,
        "tender_id": tender_id,
        "bidder_id": bidder_id,
        "evaluated_by": payload.get("user_id"),
        "status": EvaluationStatus.COMPLETED if result["all_passed"] else EvaluationStatus.REVIEW_REQUIRED,
        "criterion_results": result["criterion_results"],
        "overall_result": "PASS" if result["all_passed"] else "REVIEW",
        "risk_flags": result.get("risk_flags", []),
        "confidence_score": result.get("confidence_score", 0.0),
        "evaluated_at": datetime.utcnow().isoformat(),
        "verification_cards": result.get("verification_cards", [])
    }
    
    EVALUATIONS_DB[evaluation_id] = evaluation
    
    return EvaluationResult(
        evaluation_id=evaluation_id,
        tender_id=tender_id,
        bidder_id=bidder_id,
        overall_result=evaluation["overall_result"],
        status=evaluation["status"],
        criterion_results=[CriterionResult(**r) for r in evaluation["criterion_results"]],
        risk_flags=evaluation["risk_flags"],
        confidence_score=evaluation["confidence_score"]
    )

@router.get("/{tender_id}/comparison")
async def get_bidders_comparison(
    tender_id: str,
    token: str = Depends(security)
):
    """Get comparison matrix of all bidders vs criteria."""
    verify_token(token.credentials)
    
    # Get all evaluations for this tender
    evaluations = [e for e in EVALUATIONS_DB.values() if e["tender_id"] == tender_id]
    
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluations found for this tender"
        )
    
    # Build comparison matrix
    comparison = {
        "tender_id": tender_id,
        "bidders": [],
        "criteria_count": len(evaluations[0]["criterion_results"]) if evaluations else 0
    }
    
    for eval in evaluations:
        bidder_summary = {
            "bidder_id": eval["bidder_id"],
            "overall_result": eval["overall_result"],
            "status": eval["status"],
            "criteria_breakdown": {
                "passed": len([r for r in eval["criterion_results"] if r["status"] == "PASS"]),
                "failed": len([r for r in eval["criterion_results"] if r["status"] == "FAIL"]),
                "review": len([r for r in eval["criterion_results"] if r["status"] == "REVIEW"])
            }
        }
        comparison["bidders"].append(bidder_summary)
    
    return comparison

@router.get("/{evaluation_id}/verification-card/{criterion_id}", response_model=VerificationCard)
async def get_verification_card(
    evaluation_id: str,
    criterion_id: str,
    token: str = Depends(security)
):
    """Get detailed verification card for a specific criterion."""
    verify_token(token.credentials)
    
    evaluation = EVALUATIONS_DB.get(evaluation_id)
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found"
        )
    
    # Find the criterion result
    criterion_result = None
    for result in evaluation["criterion_results"]:
        if result["criterion_id"] == criterion_id:
            criterion_result = result
            break
    
    if not criterion_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found in evaluation"
        )
    
    return VerificationCard(
        evaluation_id=evaluation_id,
        criterion_id=criterion_id,
        criterion_description=criterion_result["description"],
        status=criterion_result["status"],
        extracted_value=criterion_result.get("extracted_value"),
        required_value=criterion_result.get("required_value"),
        comparison_operator=criterion_result.get("comparison_operator"),
        evidence_document_id=criterion_result.get("evidence_document_id"),
        evidence_page=criterion_result.get("evidence_page"),
        evidence_bbox=criterion_result.get("evidence_bbox"),
        extracted_text=criterion_result.get("extracted_text"),
        confidence_score=criterion_result.get("confidence_score"),
        reason_code=criterion_result.get("reason_code")
    )

@router.post("/{evaluation_id}/override/{criterion_id}")
async def override_criterion_status(
    evaluation_id: str,
    criterion_id: str,
    new_status: str,  # PASS, FAIL, or REVIEW
    comment: str,
    token: str = Depends(security)
):
    """Manual override of criterion status (Human-in-the-loop)."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can override evaluations"
        )
    
    evaluation = EVALUATIONS_DB.get(evaluation_id)
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found"
        )
    
    # Find and update criterion
    for result in evaluation["criterion_results"]:
        if result["criterion_id"] == criterion_id:
            result["status"] = new_status
            result["manual_override"] = True
            result["overridden_by"] = payload.get("user_id")
            result["override_comment"] = comment
            result["override_timestamp"] = datetime.utcnow().isoformat()
            break
    
    # Recalculate overall status
    has_review = any(r["status"] == "REVIEW" for r in evaluation["criterion_results"])
    has_fail = any(r["status"] == "FAIL" for r in evaluation["criterion_results"])
    
    if has_fail:
        evaluation["overall_result"] = "FAIL"
    elif has_review:
        evaluation["overall_result"] = "REVIEW"
    else:
        evaluation["overall_result"] = "PASS"
    
    return {
        "message": "Criterion status overridden successfully",
        "evaluation_id": evaluation_id,
        "criterion_id": criterion_id,
        "new_status": new_status,
        "overridden_by": payload.get("user_id"),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/{evaluation_id}/report", response_model=EvaluationReport)
async def generate_evaluation_report(
    evaluation_id: str,
    token: str = Depends(security)
):
    """Generate draft evaluation report with citations."""
    verify_token(token.credentials)
    
    evaluation = EVALUATIONS_DB.get(evaluation_id)
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found"
        )
    
    # Build detailed report
    report = EvaluationReport(
        report_id=str(uuid.uuid4()),
        evaluation_id=evaluation_id,
        tender_id=evaluation["tender_id"],
        bidder_id=evaluation["bidder_id"],
        generated_at=datetime.utcnow().isoformat(),
        overall_result=evaluation["overall_result"],
        criterion_results=[CriterionResult(**r) for r in evaluation["criterion_results"]],
        risk_flags=evaluation["risk_flags"],
        audit_trail=[{
            "action": "evaluation_completed",
            "timestamp": evaluation["evaluated_at"],
            "user_id": evaluation["evaluated_by"]
        }]
    )
    
    return report
