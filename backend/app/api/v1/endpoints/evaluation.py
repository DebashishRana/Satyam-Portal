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
from app.services.notifications import notification_service
from app.schemas.bidder import SubmissionStatus
from app.api.v1.endpoints.tenders import TENDERS_DB

router = APIRouter()
security = HTTPBearer()

# Mock evaluation database
EVALUATIONS_DB = {}


def _find_submission_for_evaluation(tender_id: str, bidder_id: str):
    from app.api.v1.endpoints.bidders import SUBMISSIONS_DB

    return next(
        (
            submission
            for submission in SUBMISSIONS_DB.values()
            if submission.get("tender_id") == tender_id and submission.get("bidder_id") == bidder_id
        ),
        None,
    )


def _tender_for_notification(tender_id: str):
    return TENDERS_DB.get(tender_id) or {
        "id": tender_id,
        "title": f"Tender {tender_id}",
        "reference_number": tender_id,
        "contact_email": "tender-officer@crpf.gov.in",
    }

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
    submission = _find_submission_for_evaluation(tender_id, bidder_id)
    tender = _tender_for_notification(tender_id)

    if submission:
        previous_status = submission.get("status")
        submission["status"] = SubmissionStatus.UNDER_TECHNICAL_REVIEW
        submission["current_stage"] = "Under Technical Review"
        submission["last_updated"] = datetime.utcnow().isoformat()
        await notification_service.notify_status_change(
            submission=submission,
            status=SubmissionStatus.UNDER_TECHNICAL_REVIEW,
            tender=tender,
            previous_status=previous_status,
            event_type="evaluation_started",
            officer_contact=tender.get("contact_email"),
        )
    
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

    if submission:
        previous_status = submission.get("status")
        if result["all_passed"]:
            next_status = SubmissionStatus.TECHNICALLY_QUALIFIED
            reason = "All technical criteria passed automated rule evaluation."
        elif any(item["status"] == "FAIL" for item in result["criterion_results"]):
            next_status = SubmissionStatus.TECHNICALLY_NOT_QUALIFIED
            reason = "One or more mandatory technical criteria did not pass evaluation."
        else:
            next_status = SubmissionStatus.CLARIFICATION_REQUESTED
            reason = "One or more criteria require clarification or manual review."

        submission["status"] = next_status
        submission["current_stage"] = next_status.value.replace("_", " ").title()
        submission["last_updated"] = datetime.utcnow().isoformat()
        await notification_service.notify_status_change(
            submission=submission,
            status=next_status,
            tender=tender,
            previous_status=previous_status,
            reason=reason,
            required_action="Review the portal and respond to any clarification requested by the evaluation team.",
            event_type="evaluation_result",
            officer_contact=tender.get("contact_email"),
        )
    
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

    submission = _find_submission_for_evaluation(evaluation["tender_id"], evaluation["bidder_id"])
    if submission:
        tender = _tender_for_notification(evaluation["tender_id"])
        await notification_service.notify_status_change(
            submission=submission,
            status="manual_override",
            tender=tender,
            previous_status=submission.get("status"),
            reason=comment,
            event_type="manual_override",
            criterion_id=criterion_id,
            officer_contact=tender.get("contact_email"),
        )
    
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
