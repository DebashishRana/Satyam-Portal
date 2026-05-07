"""
Bidder Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from app.core.security import verify_token
from app.schemas.bidder import BidderCreate, BidderResponse, BidSubmission, SubmissionStatus, SubmissionStatusUpdate
from app.schemas.bidder_portal import (
    BidderFinancialYearSchema,
    BidderProfileResponse,
    BidderProfileSaveRequest,
    BidderOrganisationType,
    BidderMSMEType,
    GSTFilingStatus,
    BusinessCategory,
    BusinessModel,
    AverageManpowerStrength,
    AuthorisedSignatoryIdType,
)
from app.services.notifications import notification_service
from app.api.v1.endpoints.tenders import TENDERS_DB

router = APIRouter()
security = HTTPBearer()

# Mock bidder database
BIDDERS_DB = {}
SUBMISSIONS_DB = {}
BIDDER_FINANCIAL_YEARS_DB: Dict[str, List[Dict[str, Any]]] = {}


def _find_bidder_profile_for_user(user_id: str):
    return next(
        (
            bidder
            for bidder in BIDDERS_DB.values()
            if bidder.get("created_by") == user_id or bidder.get("id") == user_id or bidder.get("login_user_id") == user_id
        ),
        None,
    )


def _bidder_contact_email(payload: dict) -> str:
    bidder = _find_bidder_profile_for_user(payload.get("user_id"))
    return (bidder or {}).get("contact_email") or (bidder or {}).get("primary_contact_email") or payload.get("sub") or "bidder@example.com"


def _bidder_display_name(payload: dict) -> str:
    bidder = _find_bidder_profile_for_user(payload.get("user_id"))
    return (bidder or {}).get("organization_name") or payload.get("organization") or payload.get("sub") or "Bidder"


def _default_profile(user_id: str, email: Optional[str] = None, organization: Optional[str] = None) -> Dict[str, Any]:
    fallback_email = email or f"{user_id or 'bidder'}@example.com"
    return {
        "bidder_id": user_id,
        "organisation_name": organization or "",
        "organization_name": organization or "",
        "organisation_type": BidderOrganisationType.OTHER,
        "type": "Other",
        "msmetype": BidderMSMEType.UNKNOWN,
        "msme_type": BidderMSMEType.UNKNOWN,
        "year_of_incorporation": None,
        "cin": "",
        "gstin": "",
        "pan": "",
        "msme_registration_no": "",
        "udyam_no": "",
        "nsic_registration_no": "",
        "startup_india_registration_no": "",
        "gem_registration_id": "",
        "gst_filing_status": GSTFilingStatus.UNKNOWN,
        "registered_address": "",
        "registered_address_line1": "",
        "registered_address_line2": "",
        "registered_city": "",
        "registered_state": "",
        "registered_pincode": "",
        "communication_address_line1": "",
        "communication_address_line2": "",
        "communication_city": "",
        "communication_state": "",
        "communication_pincode": "",
        "is_communication_same_as_registered": True,
        "contact_name": organization or "",
        "primary_contact_name": organization or "",
        "primary_contact_designation": "",
        "primary_contact_email": fallback_email,
        "primary_contact_phone": "",
        "secondary_contact_name": "",
        "secondary_contact_email": "",
        "secondary_contact_phone": "",
        "contact_email": fallback_email,
        "contact_phone": "",
        "login_user_id": user_id,
        "primary_business_categories": [],
        "business_keywords": [],
        "business_model": BusinessModel.OTHER,
        "average_manpower_strength": None,
        "authorised_signatory_name": "",
        "authorised_signatory_designation": "",
        "authorised_signatory_id_type": AuthorisedSignatoryIdType.OTHER,
        "authorised_signatory_id_number": "",
        "authorised_signatory_signature_file_path": "",
        "has_bank_details_provided": False,
        "bank_name": "",
        "bank_branch": "",
        "bank_account_holder_name": "",
        "bank_account_number": "",
        "bank_ifsc": "",
        "past_performance_summary": "",
        "is_locked": False,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


def _derive_profile_response(profile: Dict[str, Any]) -> BidderProfileResponse:
    financial_years = BIDDER_FINANCIAL_YEARS_DB.get(profile["bidder_id"], [])
    required_fields = [
        profile.get("organisation_name"),
        profile.get("organisation_type"),
        profile.get("gstin"),
        profile.get("pan"),
        profile.get("registered_address_line1") or profile.get("registered_address"),
        profile.get("registered_city"),
        profile.get("registered_state"),
        profile.get("registered_pincode"),
        profile.get("primary_contact_name") or profile.get("contact_name"),
        profile.get("primary_contact_email") or profile.get("contact_email"),
        profile.get("primary_contact_phone") or profile.get("contact_phone"),
        profile.get("authorised_signatory_name"),
        profile.get("authorised_signatory_designation"),
    ]
    completeness = round((sum(1 for value in required_fields if value not in [None, "", []]) / len(required_fields)) * 100)
    warnings: List[str] = []
    if profile.get("organisation_type") in [BidderOrganisationType.PVTLTD, BidderOrganisationType.LLP, BidderOrganisationType.PSU] and not profile.get("cin"):
        warnings.append("CIN is recommended for the selected organisation type.")
    if profile.get("has_bank_details_provided") and not profile.get("bank_ifsc"):
        warnings.append("Bank details are enabled but IFSC is missing.")

    return BidderProfileResponse(
        **profile,
        financial_years=[BidderFinancialYearSchema(**item) for item in financial_years],
        profile_completeness_percent=completeness,
        warnings=warnings,
    )


@router.get("/profile", response_model=BidderProfileResponse)
async def get_bidder_profile(token: str = Depends(security)):
    """Get the logged-in bidder's reusable profile."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["bidder", "committee_member", "approver", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    existing = _find_bidder_profile_for_user(payload.get("user_id"))
    if not existing:
        existing = _default_profile(payload.get("user_id"), payload.get("sub"), payload.get("organization"))
        BIDDERS_DB[existing["bidder_id"]] = existing
        BIDDER_FINANCIAL_YEARS_DB.setdefault(existing["bidder_id"], [])
    return _derive_profile_response(existing)


@router.put("/profile", response_model=BidderProfileResponse)
async def save_bidder_profile(profile_data: BidderProfileSaveRequest, token: str = Depends(security)):
    """Create or update the bidder profile and financial years."""
    payload = verify_token(token.credentials)
    if payload.get("role") != "bidder" and payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only bidders can edit their profile")

    existing = _find_bidder_profile_for_user(payload.get("user_id"))
    if existing and existing.get("is_locked") and payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This profile is locked and can only be edited by an admin")

    bidder_id = (existing or {}).get("bidder_id") or profile_data.bidder_id or str(uuid.uuid4())
    registered_address = ", ".join(
        part for part in [
            profile_data.registered_address_line1,
            profile_data.registered_address_line2,
            profile_data.registered_city,
            profile_data.registered_state,
            profile_data.registered_pincode,
        ] if part
    )

    communication_same = profile_data.is_communication_same_as_registered
    communication_address_line1 = profile_data.communication_address_line1 or (profile_data.registered_address_line1 if communication_same else "")
    communication_address_line2 = profile_data.communication_address_line2 or (profile_data.registered_address_line2 if communication_same else "")
    communication_city = profile_data.communication_city or (profile_data.registered_city if communication_same else "")
    communication_state = profile_data.communication_state or (profile_data.registered_state if communication_same else "")
    communication_pincode = profile_data.communication_pincode or (profile_data.registered_pincode if communication_same else "")

    profile = {
        "bidder_id": bidder_id,
        "organisation_name": profile_data.organisation_name,
        "organization_name": profile_data.organisation_name,
        "organisation_type": profile_data.organisation_type,
        "type": "MSME" if profile_data.msmetype in [BidderMSMEType.MICRO, BidderMSMEType.SMALL, BidderMSMEType.MEDIUM] else "Other",
        "msmetype": profile_data.msmetype,
        "msme_type": profile_data.msmetype,
        "year_of_incorporation": profile_data.year_of_incorporation,
        "cin": profile_data.cin or "",
        "gstin": profile_data.gstin,
        "pan": profile_data.pan,
        "msme_registration_no": profile_data.msme_registration_no or "",
        "udyam_no": profile_data.udyam_no or "",
        "nsic_registration_no": profile_data.nsic_registration_no or "",
        "startup_india_registration_no": profile_data.startup_india_registration_no or "",
        "gem_registration_id": profile_data.gem_registration_id or "",
        "gst_filing_status": profile_data.gst_filing_status,
        "registered_address": registered_address,
        "registered_address_line1": profile_data.registered_address_line1,
        "registered_address_line2": profile_data.registered_address_line2 or "",
        "registered_city": profile_data.registered_city,
        "registered_state": profile_data.registered_state,
        "registered_pincode": profile_data.registered_pincode,
        "communication_address_line1": communication_address_line1,
        "communication_address_line2": communication_address_line2,
        "communication_city": communication_city,
        "communication_state": communication_state,
        "communication_pincode": communication_pincode,
        "is_communication_same_as_registered": communication_same,
        "contact_name": profile_data.primary_contact_name,
        "primary_contact_name": profile_data.primary_contact_name,
        "primary_contact_designation": profile_data.primary_contact_designation or "",
        "primary_contact_email": str(profile_data.primary_contact_email),
        "primary_contact_phone": profile_data.primary_contact_phone,
        "secondary_contact_name": profile_data.secondary_contact_name or "",
        "secondary_contact_email": str(profile_data.secondary_contact_email) if profile_data.secondary_contact_email else "",
        "secondary_contact_phone": profile_data.secondary_contact_phone or "",
        "contact_email": str(profile_data.primary_contact_email),
        "contact_phone": profile_data.primary_contact_phone,
        "login_user_id": payload.get("user_id"),
        "primary_business_categories": [category.value if hasattr(category, "value") else category for category in profile_data.primary_business_categories],
        "business_keywords": profile_data.business_keywords,
        "business_model": profile_data.business_model,
        "average_manpower_strength": profile_data.average_manpower_strength,
        "authorised_signatory_name": profile_data.authorised_signatory_name,
        "authorised_signatory_designation": profile_data.authorised_signatory_designation,
        "authorised_signatory_id_type": profile_data.authorised_signatory_id_type,
        "authorised_signatory_id_number": profile_data.authorised_signatory_id_number or "",
        "authorised_signatory_signature_file_path": profile_data.authorised_signatory_signature_file_path or "",
        "has_bank_details_provided": profile_data.has_bank_details_provided,
        "bank_name": profile_data.bank_name or "",
        "bank_branch": profile_data.bank_branch or "",
        "bank_account_holder_name": profile_data.bank_account_holder_name or "",
        "bank_account_number": profile_data.bank_account_number or "",
        "bank_ifsc": profile_data.bank_ifsc or "",
        "past_performance_summary": profile_data.past_performance_summary or "",
        "is_locked": profile_data.save_mode.value == "Lock",
        "created_at": (existing or {}).get("created_at") or datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by": (existing or {}).get("created_by") or payload.get("user_id"),
    }

    BIDDERS_DB[bidder_id] = profile
    BIDDER_FINANCIAL_YEARS_DB[bidder_id] = [
        {
            "financial_year_id": year.financial_year_id,
            "bidder_id": bidder_id,
            "financial_year_label": year.financial_year_label,
            "turnover_amount_inr": year.turnover_amount_inr,
            "is_turnover_audited": year.is_turnover_audited,
            "net_worth_or_paid_up_capital_inr": year.net_worth_or_paid_up_capital_inr,
        }
        for year in profile_data.financial_years[:5]
    ]

    return _derive_profile_response(profile)


def _tender_for_notification(tender_id: str):
    return TENDERS_DB.get(tender_id) or {
        "id": tender_id,
        "title": f"Tender {tender_id}",
        "reference_number": tender_id,
        "contact_email": "tender-officer@crpf.gov.in",
    }

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
        "bidder_organization": _bidder_display_name(payload),
        "bidder_contact_email": _bidder_contact_email(payload),
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
    tender = _tender_for_notification(tender_id)
    await notification_service.notify_status_change(
        submission=bid_submission,
        status=SubmissionStatus.SUBMITTED,
        tender=tender,
        previous_status=None,
        event_type="submission",
        officer_contact=tender.get("contact_email"),
    )
    
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


@router.patch("/submissions/{submission_id}/status")
async def update_submission_status(
    submission_id: str,
    status_update: SubmissionStatusUpdate,
    token: str = Depends(security)
):
    """Update a submission stage and notify the bidder once per transition."""
    payload = verify_token(token.credentials)
    if payload.get("role") not in ["committee_member", "approver", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only officers can update submission status"
        )

    submission = SUBMISSIONS_DB.get(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    previous_status = submission["status"]
    submission["status"] = status_update.status
    submission["current_stage"] = status_update.status.value.replace("_", " ").title()
    submission["last_updated"] = datetime.utcnow().isoformat()

    tender = _tender_for_notification(submission["tender_id"])
    notification_result = await notification_service.notify_status_change(
        submission=submission,
        status=status_update.status,
        tender=tender,
        previous_status=previous_status,
        reason=status_update.reason,
        required_action=status_update.required_action,
        event_type="status_change",
        officer_contact=status_update.officer_contact or tender.get("contact_email"),
    )

    return {
        "message": "Submission status updated",
        "submission_id": submission_id,
        "previous_status": previous_status,
        "new_status": submission["status"],
        "notification": notification_result,
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
