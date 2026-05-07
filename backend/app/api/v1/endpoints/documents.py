"""
Document Processing Endpoints
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import asyncio
import uuid
import shutil
import os
from datetime import datetime

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_token
from app.schemas.document import DocumentUpload, DocumentResponse, DocumentStatus, OCRResult
from app.services.ocr import OCRService
from app.services.document_processor import DocumentProcessor

router = APIRouter()
security = HTTPBearer()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Mock document storage
DOCUMENTS_DB = {}

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    tender_id: Optional[str] = None,
    bidder_id: Optional[str] = None,
    document_type: str = "general",
    token: str = Depends(security)
):
    """Upload a document for processing."""
    payload = verify_token(token.credentials)
    user_id = payload.get("user_id")
    
    # Validate file
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE / (1024*1024)}MB limit"
        )
    
    # Generate unique filename
    doc_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{doc_id}{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create document record
    document = {
        "id": doc_id,
        "filename": file.filename,
        "stored_filename": unique_filename,
        "file_path": file_path,
        "file_size": file.size or 0,
        "content_type": file.content_type,
        "uploaded_by": user_id,
        "tender_id": tender_id,
        "bidder_id": bidder_id,
        "document_type": document_type,
        "status": DocumentStatus.UPLOADED,
        "uploaded_at": datetime.utcnow().isoformat(),
        "ocr_result": None,
        "extracted_data": None
    }
    
    DOCUMENTS_DB[doc_id] = document
    
    # Trigger async OCR processing
    # In production, this would be a Celery task
    
    return DocumentResponse(
        id=doc_id,
        filename=file.filename,
        status=DocumentStatus.UPLOADED,
        uploaded_at=document["uploaded_at"],
        message="Document uploaded successfully. Processing will begin shortly."
    )

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    token: str = Depends(security)
):
    """Get document details and processing status."""
    verify_token(token.credentials)
    
    document = DOCUMENTS_DB.get(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return DocumentResponse(
        id=document["id"],
        filename=document["filename"],
        status=document["status"],
        uploaded_at=document["uploaded_at"],
        ocr_result=document.get("ocr_result"),
        extracted_data=document.get("extracted_data"),
        message=f"Document status: {document['status']}"
    )

@router.post("/{document_id}/process", response_model=DocumentResponse)
async def process_document(
    document_id: str,
    token: str = Depends(security)
):
    """Manually trigger document processing (OCR + extraction)."""
    verify_token(token.credentials)
    
    document = DOCUMENTS_DB.get(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Initialize services
    ocr_service = OCRService()
    doc_processor = DocumentProcessor()
    
    # Perform OCR
    document["status"] = DocumentStatus.PROCESSING
    
    try:
        # OCR processing
        ocr_result = await asyncio.to_thread(ocr_service.process_document, document["file_path"])
        document["ocr_result"] = ocr_result
        
        # Data extraction
        extracted_data = await doc_processor.extract_structured_data(
            ocr_result["text"],
            document["document_type"]
        )
        document["extracted_data"] = extracted_data
        document["status"] = DocumentStatus.COMPLETED
        
    except Exception as e:
        document["status"] = DocumentStatus.FAILED
        document["error"] = str(e)
    
    return DocumentResponse(
        id=document["id"],
        filename=document["filename"],
        status=document["status"],
        uploaded_at=document["uploaded_at"],
        ocr_result=document.get("ocr_result"),
        extracted_data=document.get("extracted_data"),
        message=f"Processing {document['status'].lower()}"
    )

@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    tender_id: Optional[str] = None,
    bidder_id: Optional[str] = None,
    status: Optional[DocumentStatus] = None,
    token: str = Depends(security)
):
    """List all documents with optional filters."""
    verify_token(token.credentials)
    
    documents = []
    for doc in DOCUMENTS_DB.values():
        if tender_id and doc.get("tender_id") != tender_id:
            continue
        if bidder_id and doc.get("bidder_id") != bidder_id:
            continue
        if status and doc["status"] != status:
            continue
        
        documents.append(DocumentResponse(
            id=doc["id"],
            filename=doc["filename"],
            status=doc["status"],
            uploaded_at=doc["uploaded_at"]
        ))
    
    return documents
