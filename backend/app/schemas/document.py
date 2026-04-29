"""
Document Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REVIEW_REQUIRED = "review_required"

class DocumentType(str, Enum):
    TENDER_DOCUMENT = "tender_document"
    TECHNICAL_BID = "technical_bid"
    FINANCIAL_BID = "financial_bid"
    EMD = "earnest_money_deposit"
    EXPERIGENCE_CERTIFICATE = "experience_certificate"
    FINANCIAL_STATEMENT = "financial_statement"
    GST_REGISTRATION = "gst_registration"
    PAN_CARD = "pan_card"
    MSME_CERTIFICATE = "msme_certificate"
    ISO_CERTIFICATE = "iso_certificate"
    OTHER = "other"

class DocumentUpload(BaseModel):
    tender_id: Optional[str] = None
    bidder_id: Optional[str] = None
    document_type: DocumentType = DocumentType.OTHER
    metadata: Optional[Dict[str, Any]] = None

class OCRResult(BaseModel):
    text: str
    confidence_score: float
    page_count: int
    language: str = "en"
    extracted_entities: Optional[Dict[str, Any]] = None

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: DocumentStatus
    uploaded_at: str
    document_type: Optional[str] = None
    ocr_result: Optional[OCRResult] = None
    extracted_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    message: Optional[str] = None

class DocumentList(BaseModel):
    documents: List[DocumentResponse]
    total: int
    page: int
    page_size: int
