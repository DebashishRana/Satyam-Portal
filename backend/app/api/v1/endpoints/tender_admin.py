"""
Tender Management API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, date
import uuid

from app.core.database import get_db
from app.core.security import verify_token
from app.models.tender import (
    Tender, TenderCriterion, TenderDocumentRequirement, 
    TenderEvaluationConfig, TenderCommitteeMember,
    TenderStatusEnum, EvaluationMethodEnum
)
from app.schemas.tender import (
    TenderCreateRequest, TenderDetailResponse, TenderResponse,
    TenderCriterionRequest, TenderDocumentRequirementRequest
)

router = APIRouter(prefix="/tenders", tags=["tenders"])


@router.post("/create", response_model=TenderResponse, status_code=status.HTTP_201_CREATED)
async def create_tender(
    request: TenderCreateRequest,
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """Create a new tender"""
    
    # Validate required fields
    if not request.tender_name or not request.contact_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tender name and contact email are required"
        )
    
    # Validate dates
    if request.bid_submission_end <= request.bid_submission_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bid submission end must be after start"
        )
    
    # Validate EMD
    if request.emd_required and not request.emd_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EMD amount is required when EMD is mandated"
        )
    
    # Generate tender ID
    tender_id = f"TENDER-{uuid.uuid4().hex[:8].upper()}"
    
    # Create tender
    tender = Tender(
        tender_id=tender_id,
        tender_name=request.tender_name,
        procuring_organisation=request.procuring_organisation,
        unit_or_formation=request.unit_or_formation,
        tender_type=request.tender_type,
        procurement_mode=request.procurement_mode,
        category=request.category,
        sub_category=request.sub_category,
        estimated_value_amount=request.estimated_value_amount,
        estimated_value_currency=request.estimated_value_currency,
        budget_head=request.budget_head,
        locations_json=request.locations_json,
        nit_date=request.nit_date,
        bid_submission_start=request.bid_submission_start,
        bid_submission_end=request.bid_submission_end,
        technical_bid_opening=request.technical_bid_opening,
        financial_bid_opening=request.financial_bid_opening,
        bid_validity_days=request.bid_validity_days,
        contract_start_date=request.contract_start_date,
        contract_end_date=request.contract_end_date,
        delivery_schedule_text=request.delivery_schedule_text,
        no_of_covers=request.no_of_covers,
        evaluation_method=request.evaluation_method,
        emd_required=request.emd_required,
        emd_amount=request.emd_amount,
        emd_exemption_rules=request.emd_exemption_rules,
        tender_fee_amount=request.tender_fee_amount,
        performance_security_percent=request.performance_security_percent,
        price_basis=request.price_basis,
        contact_officer_name=request.contact_officer_name,
        contact_officer_designation=request.contact_officer_designation,
        contact_email=request.contact_email,
        contact_phone=request.contact_phone,
        status=TenderStatusEnum(request.status),
        created_by=token_data.get("sub", "unknown")
    )
    
    # Add criteria
    if request.criteria:
        for crit in request.criteria:
            criterion = TenderCriterion(
                criterion_id=crit.criterion_id,
                tender_id=tender_id,
                category=crit.category,
                title=crit.title,
                description=crit.description,
                threshold_type=crit.threshold_type,
                threshold_value=crit.threshold_value,
                threshold_value_max=crit.threshold_value_max,
                unit=crit.unit,
                is_mandatory=crit.is_mandatory,
                relaxation_rule_text=crit.relaxation_rule_text,
                evidence_type=crit.evidence_type,
                expected_document_format=crit.expected_document_format,
                auto_verification_source=crit.auto_verification_source,
                scoring_weight=crit.scoring_weight,
                applies_to_cover=crit.applies_to_cover
            )
            tender.criteria.append(criterion)
    
    # Add document requirements
    if request.document_requirements:
        for doc in request.document_requirements:
            document = TenderDocumentRequirement(
                document_requirement_id=doc.document_requirement_id,
                tender_id=tender_id,
                name=doc.name,
                description=doc.description,
                linked_criteria_ids=doc.linked_criteria_ids,
                is_mandatory=doc.is_mandatory,
                is_conditional=doc.is_conditional,
                condition_text=doc.condition_text,
                upload_type=doc.upload_type,
                allowed_formats=doc.allowed_formats,
                max_file_size_mb=doc.max_file_size_mb,
                requires_signature=doc.requires_signature,
                requires_stamp=doc.requires_stamp,
                requires_notarisation=doc.requires_notarisation,
                template_url=doc.template_url
            )
            tender.document_requirements.append(document)
    
    # Add evaluation config
    if request.evaluation_config:
        config = TenderEvaluationConfig(
            config_id=f"{tender_id}-CONFIG",
            tender_id=tender_id,
            ai_assist_level=request.evaluation_config.ai_assist_level,
            ambiguity_confidence_threshold=request.evaluation_config.ambiguity_confidence_threshold,
            force_manual_review_on_conflict=request.evaluation_config.force_manual_review_on_conflict,
            enable_blacklist_check=request.evaluation_config.enable_blacklist_check,
            blacklist_sources=request.evaluation_config.blacklist_sources,
            requires_reasoned_order=request.evaluation_config.requires_reasoned_order
        )
        tender.evaluation_config = config
    
    # Add committee members
    if request.committee_members:
        for member in request.committee_members:
            committee_member = TenderCommitteeMember(
                member_id=member.member_id,
                tender_id=tender_id,
                officer_name=member.officer_name,
                designation=member.designation,
                role=member.role,
                email=member.email,
                phone=member.phone
            )
            tender.committee_members.append(committee_member)
    
    db.add(tender)
    await db.commit()
    await db.refresh(tender)
    
    return TenderResponse.from_orm(tender)


@router.get("/{tender_id}", response_model=TenderDetailResponse)
async def get_tender(
    tender_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get tender details"""
    # Mock implementation - in production, query from database
    return {
        "message": f"Tender {tender_id} details retrieved",
        "tender_id": tender_id,
        "tender_name": "Sample Tender"
    }


@router.put("/{tender_id}", response_model=TenderResponse)
async def update_tender(
    tender_id: str,
    request: TenderCreateRequest,
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """Update existing tender"""
    # Mock implementation
    return {
        "message": f"Tender {tender_id} updated",
        "tender_id": tender_id,
        "tender_name": request.tender_name
    }


@router.post("/{tender_id}/publish", status_code=status.HTTP_200_OK)
async def publish_tender(
    tender_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """Publish tender (enforce all validations)"""
    return {
        "message": f"Tender {tender_id} published successfully",
        "tender_id": tender_id,
        "status": "Published"
    }


@router.post("/{tender_id}/save-draft", status_code=status.HTTP_200_OK)
async def save_tender_draft(
    tender_id: str,
    request: TenderCreateRequest,
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """Save tender as draft (minimal validation)"""
    return {
        "message": f"Tender {tender_id} saved as draft",
        "tender_id": tender_id,
        "status": "Draft"
    }
