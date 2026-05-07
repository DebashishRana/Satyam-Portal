"""
Bidder document intelligence endpoints.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.bidder_portal import BidDocument, DocumentFact, FactConfirmation
from app.schemas.bidder_portal import (
    BidDocumentResponse,
    DocumentCategory,
    DocumentFactResponse,
    DocumentUploadResponse,
    EvaluationReportResponse,
    EvaluationResultResponse,
    FactConfirmationRequest,
    FactConfirmationResponse,
)
from app.services.bidder_pipeline import pipeline_service
from app.services.task_queue import enqueue_task

router = APIRouter()
security = HTTPBearer()


def _role_allowed(role: str) -> bool:
    return role in {"bidder", "committee_member", "approver", "admin"}


def _ensure_role(payload: dict):
    if not _role_allowed(payload.get("role", "")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


def _serialize_document(document: BidDocument) -> BidDocumentResponse:
    return BidDocumentResponse(
        bid_document_id=document.bid_document_id,
        bid_id=document.bid_id,
        tender_id=document.tender_id,
        bidder_id=document.bidder_id,
        original_file_name=document.original_file_name or document.file_name,
        document_category=DocumentCategory(document.document_category.value if hasattr(document.document_category, "value") else document.document_category),
        storage_path_original=document.storage_path_original or document.storage_path,
        ocr_job_id=document.ocr_job_id,
        ocr_status=document.ocr_status.value if hasattr(document.ocr_status, "value") else document.ocr_status,
        ocr_output_path=document.ocr_output_path,
        ocr_markdown_path=document.ocr_markdown_path,
        ocr_page_json_path=document.ocr_page_json_path,
        created_at=document.created_at,
        updated_at=document.updated_at,
        uploaded_by_user_id=document.uploaded_by_user_id,
    )


def _serialize_fact(fact: DocumentFact) -> DocumentFactResponse:
    return DocumentFactResponse(
        fact_id=fact.fact_id,
        document_id=fact.document_id,
        bid_id=fact.bid_id,
        tender_id=fact.tender_id,
        fact_type=fact.fact_type,
        label=fact.label,
        value_raw=fact.value_raw,
        value_normalized=fact.value_normalized,
        unit=fact.unit,
        financial_year=fact.financial_year,
        page_hint=fact.page_hint,
        snippet=fact.snippet,
        table_context=fact.table_context,
        status=fact.status,
        ambiguity_reason=fact.ambiguity_reason,
        related_tender_criteria_ids=fact.related_tender_criteria_ids or [],
        created_at=fact.created_at,
    )


def _serialize_confirmation(confirmation: FactConfirmation) -> FactConfirmationResponse:
    return FactConfirmationResponse(
        confirmation_id=confirmation.confirmation_id,
        fact_id=confirmation.fact_id,
        confirmed=confirmation.confirmed,
        corrected_value=confirmation.corrected_value,
        comment=confirmation.comment,
        confirmed_by_user_id=confirmation.confirmed_by_user_id,
        created_at=confirmation.created_at,
        updated_at=confirmation.updated_at,
    )


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_bidder_document(
    tender_id: str = Form(...),
    bidder_id: Optional[str] = Form(None),
    document_category: DocumentCategory = Form(DocumentCategory.OTHER),
    linked_requirement_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    token: str = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    resolved_bidder_id = bidder_id or payload.get("user_id")
    if not resolved_bidder_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BidderId is required")

    file_bytes = await file.read()
    try:
        document = await pipeline_service.upload_document(
            db,
            tender_id=tender_id,
            bidder_id=resolved_bidder_id,
            user_id=payload.get("user_id") or resolved_bidder_id,
            file_name=file.filename or "upload.bin",
            file_bytes=file_bytes,
            document_category=document_category.value,
            linked_requirement_id=linked_requirement_id,
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await enqueue_task("document_uploaded", document_id=document.bid_document_id)

    return DocumentUploadResponse(
        document=_serialize_document(document),
        message="Document uploaded successfully. OCR has been queued.",
    )


@router.get("/documents", response_model=list[BidDocumentResponse])
async def list_bidder_documents(
    tender_id: Optional[str] = None,
    bidder_id: Optional[str] = None,
    token: str = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    query = select(BidDocument)
    if tender_id:
        query = query.where(BidDocument.tender_id == tender_id)
    if bidder_id:
        query = query.where(BidDocument.bidder_id == bidder_id)
    documents = (await db.scalars(query.order_by(BidDocument.created_at.desc()))).all()
    return [_serialize_document(document) for document in documents]


@router.get("/documents/{document_id}", response_model=BidDocumentResponse)
async def get_bidder_document(
    document_id: str,
    token: str = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    document = await db.get(BidDocument, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return _serialize_document(document)


@router.get("/documents/{document_id}/facts", response_model=list[DocumentFactResponse])
async def get_document_facts(
    document_id: str,
    token: str = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    facts = (await db.scalars(select(DocumentFact).where(DocumentFact.document_id == document_id).order_by(DocumentFact.created_at.asc()))).all()
    return [_serialize_fact(fact) for fact in facts]


@router.post("/documents/{document_id}/facts/{fact_id}/confirm", response_model=FactConfirmationResponse)
async def confirm_document_fact(
    document_id: str,
    fact_id: str,
    confirmation: FactConfirmationRequest,
    token: str = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    fact = await db.get(DocumentFact, fact_id)
    if not fact or fact.document_id != document_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fact not found")

    try:
        saved = await pipeline_service.confirm_fact(
            fact_id=fact_id,
            confirmed=confirmation.confirmed,
            corrected_value=confirmation.corrected_value,
            comment=confirmation.comment,
            confirmed_by_user_id=payload.get("user_id") or "unknown",
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _serialize_confirmation(saved)


@router.post("/documents/{document_id}/facts/{fact_id}/apply-to-profile")
async def apply_fact_to_profile(
    document_id: str,
    fact_id: str,
    token: str = Depends(security),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    try:
        return await pipeline_service.apply_fact_to_profile(document_id, fact_id, payload.get("user_id") or "")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/tenders/{tender_id}/evaluate", response_model=list[EvaluationResultResponse])
async def evaluate_tender_bidder(
    tender_id: str,
    bidder_id: Optional[str] = None,
    token: str = Depends(security),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    resolved_bidder_id = bidder_id or payload.get("user_id")
    if not resolved_bidder_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BidderId is required")

    try:
        results = await pipeline_service.evaluate_bidder(tender_id, resolved_bidder_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return [
        EvaluationResultResponse(
            evaluation_result_id=result.evaluation_result_id,
            bidder_id=result.bidder_id,
            tender_id=result.tender_id,
            criterion_id=result.criterion_id,
            verdict=result.verdict,
            reason=result.reason,
            linked_fact_ids=result.linked_fact_ids or [],
            created_at=result.created_at,
        )
        for result in results
    ]


@router.get("/tenders/{tender_id}/evaluation-report", response_model=EvaluationReportResponse)
async def generate_evaluation_report(
    tender_id: str,
    token: str = Depends(security),
):
    payload = verify_token(token.credentials)
    _ensure_role(payload)

    try:
        return await pipeline_service.generate_evaluation_report(tender_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
