"""
Bidder document intelligence pipeline.

This module wires upload -> OCR -> fact extraction -> evaluation
while preserving the full audit trail in the bidder_portal tables.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from xml.etree import ElementTree as ET

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.bidder_portal import (
    BidDocument,
    BidSubmission,
    BidderOrganisation,
    BidderOrganisationLegalTypeEnum,
    BidderOrganisationTypeEnum,
    BidderMSMETypeEnum,
    GSTFilingStatusEnum,
    AuthorisedSignatoryIdTypeEnum,
    AverageManpowerStrengthEnum,
    BusinessModelEnum,
    DocumentCategoryEnum,
    DocumentFact,
    EvaluationResult,
    EvaluationVerdictEnum,
    FactConfirmation,
    FactStatusEnum,
    FactTypeEnum,
    FactUnitEnum,
    BidSubmissionStatusEnum,
    OcrStatusEnum,
)
from app.models.tender import Tender, TenderCriterion, CriterionCategoryEnum, EvidenceTypeEnum, ThresholdTypeEnum
from app.services.ocr import OCRService

SarvamAI = None  # type: ignore[assignment]
SARVAM_SDK_AVAILABLE = False

logger = logging.getLogger(__name__)


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".docx"}


def _now() -> datetime:
    return datetime.utcnow()


def _safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("_")


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _strip_xml_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _docx_to_text(file_path: Path) -> str:
    """Extract plain text from a DOCX file using only the standard library."""
    with zipfile.ZipFile(file_path) as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    paragraphs: List[str] = []
    for paragraph in root.iter():
        if _strip_xml_ns(paragraph.tag) != "p":
            continue
        texts: List[str] = []
        for child in paragraph.iter():
            if _strip_xml_ns(child.tag) == "t" and child.text:
                texts.append(child.text)
        if texts:
            paragraphs.append("".join(texts))
    return "\n\n".join(paragraphs).strip()


def _multipart_field_name(headers: Dict[str, Any]) -> Optional[str]:
    for key in ("file_url", "upload_url", "url", "presigned_url", "signed_url"):
        value = headers.get(key)
        if isinstance(value, str):
            return value
    return None


def _upload_headers(payload: Dict[str, Any]) -> Dict[str, str]:
    headers = payload.get("headers") or payload.get("request_headers") or {}
    if isinstance(headers, dict):
        return {str(k): str(v) for k, v in headers.items()}
    return {}


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


@dataclass
class SyntheticCriterion:
    criterion_id: str
    title: str
    description: str
    threshold_type: ThresholdTypeEnum
    threshold_value: str
    evidence_type: EvidenceTypeEnum
    category: CriterionCategoryEnum = CriterionCategoryEnum.OTHER
    mandatory: bool = True


def _normalize_inr(value: float, unit: str) -> float:
    unit = unit.upper()
    if unit in {"CRORE_INR", "CR", "CRORE"}:
        return value * 10000000
    if unit in {"LAKH_INR", "LAKHS", "LAKH"}:
        return value * 100000
    return value


def _format_snippet(text: str, max_len: int = 220) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned[:max_len]


def _bcp47_for_language(text: str) -> str:
    if re.search(r"[\u0900-\u097F]", text):
        return "hi-IN"
    if re.search(r"[\u0980-\u09FF]", text):
        return "bn-IN"
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "ta-IN"
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "te-IN"
    if re.search(r"[\u0C80-\u0CFF]", text):
        return "kn-IN"
    if re.search(r"[\u0D00-\u0D7F]", text):
        return "ml-IN"
    return "hi-IN"


class SarvamDocumentIntelligenceClient:
    def __init__(self, api_key: str, base_url: str = "https://api.sarvam.ai"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.sarvam_client = None
        self.output_root = _ensure_dir(Path(settings.OCR_OUTPUT_DIR))
        self.sdk_available = SARVAM_SDK_AVAILABLE and bool(api_key) and SarvamAI is not None
        if self.sdk_available:
            try:
                self.sarvam_client = SarvamAI(api_subscription_key=api_key)
            except Exception as exc:
                logger.warning("Failed to initialize SarvamAI SDK client, using HTTP fallback: %s", exc)
                self.sdk_available = False
                self.sarvam_client = None

    def _request_json(self, method: str, url: str, payload: Optional[dict] = None, headers: Optional[dict] = None) -> dict:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            method=method,
            headers={
                "api-subscription-key": self.api_key,
                "Content-Type": "application/json",
                **(headers or {}),
            },
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))

    def _download(self, url: str, destination: Path) -> Path:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=120) as response:
            destination.write_bytes(response.read())
        return destination

    def _upload_presigned(self, upload_url: str, file_path: Path, extra_headers: Optional[dict] = None) -> None:
        data = file_path.read_bytes()
        request = urllib.request.Request(
            upload_url,
            data=data,
            method="PUT",
            headers={
                "Content-Type": "application/octet-stream",
                **(extra_headers or {}),
            },
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            response.read()

    def _serialize_sdk_value(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, dict):
            return {k: self._serialize_sdk_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._serialize_sdk_value(item) for item in value]
        return getattr(value, "__dict__", str(value))

    def _extract_output_zip(self, output_zip: Path) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
        markdown_parts: List[str] = []
        page_json_payload: Dict[str, Any] = {"pages": []}
        pages: List[Dict[str, Any]] = []

        with zipfile.ZipFile(output_zip) as archive:
            for name in archive.namelist():
                lower = name.lower()
                if lower.endswith("/"):
                    continue
                with archive.open(name) as handle:
                    content = handle.read().decode("utf-8", errors="ignore")
                if lower.endswith((".md", ".markdown", ".txt")):
                    markdown_parts.append(content)
                    pages.append({"page_num": len(pages) + 1, "markdown": content, "text": content})
                elif lower.endswith((".html", ".htm")):
                    cleaned = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", content)
                    cleaned = re.sub(r"(?s)<[^>]+>", " ", cleaned)
                    cleaned = re.sub(r"\s+", " ", cleaned).strip()
                    markdown_parts.append(cleaned)
                    pages.append({"page_num": len(pages) + 1, "markdown": cleaned, "text": cleaned})
                elif lower.endswith(".json"):
                    try:
                        data = json.loads(content)
                        if isinstance(data, dict):
                            page_json_payload.update({k: v for k, v in data.items() if k != "pages"})
                            if isinstance(data.get("pages"), list):
                                page_json_payload["pages"] = data["pages"]
                                if not pages:
                                    for idx, page in enumerate(data["pages"], start=1):
                                        page_text = page.get("text") or page.get("markdown") or page.get("content") or ""
                                        pages.append({
                                            "page_num": idx,
                                            "markdown": page_text,
                                            "text": page_text,
                                            "blocks": page.get("blocks") or [],
                                        })
                                        if page_text:
                                            markdown_parts.append(str(page_text))
                    except Exception:
                        continue

        return "\n\n".join(part.strip() for part in markdown_parts if part.strip()), page_json_payload, pages

    def process(self, file_path: Path, language: str = "multi", output_format: str = "md") -> dict:
        if not self.api_key:
            raise RuntimeError("SARVAM_API_KEY is not configured")

        if self.sdk_available and self.sarvam_client is not None:
            job = self.sarvam_client.document_intelligence.create_job(language=language, output_format=output_format)
            job.upload_file(str(file_path))
            job.start()
            status = job.wait_until_complete()

            metrics: Any = None
            try:
                metrics = job.get_page_metrics()
            except Exception as exc:
                logger.debug("Sarvam metrics unavailable for %s: %s", file_path, exc)

            output_zip = self.output_root / f"{_safe_name(file_path.stem)}.zip"
            job.download_output(str(output_zip))
            markdown, page_json, pages = self._extract_output_zip(output_zip)
            return {
                "job_id": getattr(status, "job_id", None) if not isinstance(status, dict) else status.get("job_id"),
                "status": self._serialize_sdk_value(status),
                "metrics": self._serialize_sdk_value(metrics),
                "downloads": {},
                "zip_path": output_zip,
                "markdown": markdown,
                "page_json": page_json,
                "pages": pages,
            }

        create_url = f"{self.base_url}/doc-digitization/job/v1"
        upload_url = f"{self.base_url}/doc-digitization/job/v1/upload-files"
        status_url = f"{self.base_url}/doc-digitization/job/v1"
        start_suffix = "/start"
        download_suffix = "/download-files"

        job = self._request_json("POST", create_url, {"job_parameters": {"language": language, "output_format": output_format}})
        job_id = job["job_id"]
        upload_response = self._request_json("POST", upload_url, {"job_id": job_id, "files": [file_path.name]})
        upload_map = upload_response.get("upload_urls", {}) or {}
        upload_entry = upload_map.get(file_path.name) if isinstance(upload_map, dict) else None

        if upload_entry:
            presigned = _multipart_field_name(upload_entry)
            if not presigned:
                raise RuntimeError(f"Sarvam upload response missing URL for {file_path.name}")
            self._upload_presigned(presigned, file_path, _upload_headers(upload_entry))

        self._request_json("POST", f"{status_url}/{job_id}{start_suffix}", {})

        import time

        deadline = time.monotonic() + 600
        while True:
            status = self._request_json("GET", f"{status_url}/{job_id}/status")
            state = status.get("job_state")
            if state in {"Completed", "PartiallyCompleted", "Failed"}:
                break
            if time.monotonic() > deadline:
                raise TimeoutError(f"Sarvam job {job_id} did not complete in time")
            # Poll at a conservative cadence to avoid hammering the API.
            time.sleep(3)

        if status.get("job_state") == "Failed":
            raise RuntimeError(status.get("error_message") or f"Sarvam job {job_id} failed")

        downloads = self._request_json("POST", f"{status_url}/{job_id}{download_suffix}", {})
        download_urls = downloads.get("download_urls", {}) or {}
        return {
            "job_id": job_id,
            "status": status,
            "downloads": download_urls,
        }


class BidderPipelineService:
    def __init__(self):
        self.local_ocr = OCRService()
        self.upload_root = _ensure_dir(Path(settings.UPLOAD_DIR))
        self.ocr_root = _ensure_dir(Path(settings.OCR_OUTPUT_DIR))

    async def ensure_bidder_profile(self, session: AsyncSession, bidder_id: str) -> Optional[BidderOrganisation]:
        from app.api.v1.endpoints.bidders import BIDDERS_DB  # local import to avoid circular dependency

        bidder = await session.scalar(select(BidderOrganisation).where(BidderOrganisation.bidder_id == bidder_id))
        if bidder:
            return bidder

        profile = next((item for item in BIDDERS_DB.values() if item.get("bidder_id") == bidder_id or item.get("login_user_id") == bidder_id), None)
        if not profile:
            return None

        bidder = BidderOrganisation(
            bidder_id=profile["bidder_id"],
            organisation_name=profile.get("organisation_name") or profile.get("organization_name") or "Bidder",
            type=BidderOrganisationTypeEnum.MSME if str(profile.get("type", "")).upper() == "MSME" else BidderOrganisationTypeEnum.OTHER,
            organisation_type=BidderOrganisationLegalTypeEnum(profile.get("organisation_type") or "Other"),
            msme_type=BidderMSMETypeEnum(profile.get("msmetype") or "Unknown"),
            year_of_incorporation=profile.get("year_of_incorporation"),
            cin=profile.get("cin"),
            gstin=profile.get("gstin") or "22AAAAA0000A1Z5",
            pan=profile.get("pan") or "AAAAA0000A",
            msme_registration_no=profile.get("msme_registration_no"),
            udyam_no=profile.get("udyam_no"),
            nsic_registration_no=profile.get("nsic_registration_no"),
            startup_india_registration_no=profile.get("startup_india_registration_no"),
            gem_registration_id=profile.get("gem_registration_id"),
            gst_filing_status=GSTFilingStatusEnum(profile.get("gst_filing_status") or "Unknown"),
            registered_address=profile.get("registered_address") or profile.get("registered_address_line1") or "N/A",
            registered_address_line1=profile.get("registered_address_line1"),
            registered_address_line2=profile.get("registered_address_line2"),
            registered_city=profile.get("registered_city"),
            registered_state=profile.get("registered_state"),
            registered_pincode=profile.get("registered_pincode"),
            communication_address_line1=profile.get("communication_address_line1"),
            communication_address_line2=profile.get("communication_address_line2"),
            communication_city=profile.get("communication_city"),
            communication_state=profile.get("communication_state"),
            communication_pincode=profile.get("communication_pincode"),
            is_communication_same_as_registered=bool(profile.get("is_communication_same_as_registered", True)),
            contact_name=profile.get("contact_name") or profile.get("primary_contact_name") or "Bidder",
            primary_contact_name=profile.get("primary_contact_name"),
            primary_contact_designation=profile.get("primary_contact_designation"),
            primary_contact_email=profile.get("primary_contact_email") or profile.get("contact_email") or f"{bidder_id}@example.com",
            primary_contact_phone=profile.get("primary_contact_phone") or profile.get("contact_phone") or "",
            secondary_contact_name=profile.get("secondary_contact_name"),
            secondary_contact_email=profile.get("secondary_contact_email"),
            secondary_contact_phone=profile.get("secondary_contact_phone"),
            contact_email=profile.get("contact_email") or profile.get("primary_contact_email") or f"{bidder_id}@example.com",
            contact_phone=profile.get("contact_phone") or profile.get("primary_contact_phone") or "",
            login_user_id=profile.get("login_user_id") or bidder_id,
            primary_business_categories=profile.get("primary_business_categories") or [],
            business_keywords=profile.get("business_keywords") or [],
            business_model=BusinessModelEnum(profile.get("business_model") or "Other"),
            average_manpower_strength=AverageManpowerStrengthEnum(profile.get("average_manpower_strength")) if profile.get("average_manpower_strength") else None,
            authorised_signatory_name=profile.get("authorised_signatory_name"),
            authorised_signatory_designation=profile.get("authorised_signatory_designation"),
            authorised_signatory_id_type=AuthorisedSignatoryIdTypeEnum(profile.get("authorised_signatory_id_type") or "Other"),
            authorised_signatory_id_number=profile.get("authorised_signatory_id_number"),
            authorised_signatory_signature_file_path=profile.get("authorised_signatory_signature_file_path"),
            has_bank_details_provided=bool(profile.get("has_bank_details_provided", False)),
            bank_name=profile.get("bank_name"),
            bank_branch=profile.get("bank_branch"),
            bank_account_holder_name=profile.get("bank_account_holder_name"),
            bank_account_number=profile.get("bank_account_number"),
            bank_ifsc=profile.get("bank_ifsc"),
            past_performance_summary=profile.get("past_performance_summary"),
            is_locked=bool(profile.get("is_locked", False)),
        )
        session.add(bidder)
        await session.flush()
        return bidder

    async def ensure_bid_submission(self, session: AsyncSession, tender_id: str, bidder_id: str) -> BidSubmission:
        submission = await session.scalar(
            select(BidSubmission).where(
                and_(BidSubmission.tender_id == tender_id, BidSubmission.bidder_id == bidder_id)
            ).order_by(BidSubmission.created_at.desc())
        )
        if submission:
            return submission

        submission = BidSubmission(
            bid_id=str(uuid.uuid4()),
            tender_id=tender_id,
            bidder_id=bidder_id,
            submission_status=BidSubmissionStatusEnum.DRAFT,
        )
        session.add(submission)
        await session.flush()
        return submission

    async def upload_document(
        self,
        session: AsyncSession,
        *,
        tender_id: str,
        bidder_id: str,
        user_id: str,
        file_name: str,
        file_bytes: bytes,
        document_category: str,
        linked_requirement_id: Optional[str] = None,
    ) -> BidDocument:
        bidder = await self.ensure_bidder_profile(session, bidder_id)
        if not bidder:
            raise ValueError("Bidder profile not found; save the bidder profile before uploading documents.")

        submission = await self.ensure_bid_submission(session, tender_id, bidder_id)
        extension = Path(file_name).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {extension}")

        document_id = str(uuid.uuid4())
        tender_dir = _ensure_dir(self.upload_root / tender_id / bidder_id)
        stored_name = f"{document_id}{extension}"
        original_path = tender_dir / stored_name
        original_path.write_bytes(file_bytes)

        document = BidDocument(
            bid_document_id=document_id,
            bid_id=submission.bid_id,
            tender_id=tender_id,
            bidder_id=bidder_id,
            linked_tender_document_requirement_id=linked_requirement_id,
            file_name=file_name,
            original_file_name=file_name,
            document_category=DocumentCategoryEnum(document_category),
            file_type=extension.lstrip("."),
            file_size_bytes=len(file_bytes),
            storage_path=str(original_path),
            storage_path_original=str(original_path),
            ocr_status=OcrStatusEnum.PENDING,
            upload_timestamp=_now(),
            uploaded_by_user_id=user_id,
            is_signed=bool(re.search(r"signed|sign|certificate|audited", file_name, re.I)),
            is_stamped=bool(re.search(r"stamp|certificate|audited|work", file_name, re.I)),
        )
        session.add(document)
        await session.flush()
        return document

    async def process_document(self, document_id: str) -> BidDocument:
        async with AsyncSessionLocal() as session:
            document = await session.get(BidDocument, document_id)
            if not document:
                raise ValueError("Document not found")

            document.ocr_status = OcrStatusEnum.RUNNING
            document.updated_at = _now()
            await session.commit()

            try:
                artefacts = await self._run_ocr(document)
                await self._persist_ocr_artifacts(session, document, artefacts)
                from app.services.task_queue import enqueue_task

                await enqueue_task("ocr_completed", document_id=document_id)
            except Exception as exc:
                document.ocr_status = OcrStatusEnum.FAILED
                document.updated_at = _now()
                document.ocr_output_path = document.ocr_output_path or None
                document.ocr_markdown_path = document.ocr_markdown_path or None
                document.ocr_page_json_path = document.ocr_page_json_path or None
                await session.commit()
                logger.exception("OCR pipeline failed for document %s", document_id)
                raise

            refreshed = await session.get(BidDocument, document_id)
            return refreshed  # type: ignore[return-value]

    async def _run_ocr(self, document: BidDocument) -> Dict[str, Any]:
        source_path = Path(document.storage_path_original or document.storage_path)
        ext = source_path.suffix.lower()

        if ext == ".docx":
            text = _docx_to_text(source_path)
            markdown = text
            output_dir = _ensure_dir(self.ocr_root / document.bid_document_id)
            markdown_path = output_dir / f"{document.bid_document_id}.md"
            page_json_path = output_dir / f"{document.bid_document_id}.json"
            page_json = {
                "job_id": None,
                "job_state": "Completed",
                "source": "docx-text-extraction",
                "pages": [
                    {
                        "page_num": 1,
                        "markdown": markdown,
                        "text": text,
                    }
                ],
            }
            markdown_path.write_text(markdown, encoding="utf-8")
            page_json_path.write_text(json.dumps(page_json, indent=2, ensure_ascii=False), encoding="utf-8")
            output_zip = self.ocr_root / f"{document.bid_document_id}.zip"
            with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(markdown_path, arcname=markdown_path.name)
                archive.write(page_json_path, arcname=page_json_path.name)
            return {
                "job_id": None,
                "markdown": markdown,
                "page_json": page_json,
                "output_files": [],
                "zip_path": output_zip,
                "markdown_path": markdown_path,
                "page_json_path": page_json_path,
            }

        result = await asyncio.to_thread(self.local_ocr.process_document, str(source_path))
        markdown = result.get("text", "")
        output_dir = _ensure_dir(self.ocr_root / document.bid_document_id)
        markdown_path = output_dir / f"{document.bid_document_id}.md"
        page_json_path = output_dir / f"{document.bid_document_id}.json"
        page_json = {
            "job_id": None,
            "job_state": "Completed",
            "source": "easyocr",
            "pages": result.get("pages", []),
            "extracted_entities": result.get("extracted_entities", {}),
            "ocr_engine": result.get("ocr_engine", "easyocr"),
            "language": result.get("language"),
            "confidence_score": result.get("confidence_score"),
        }
        markdown_path.write_text(markdown, encoding="utf-8")
        page_json_path.write_text(json.dumps(page_json, indent=2, ensure_ascii=False), encoding="utf-8")
        output_zip = self.ocr_root / f"{document.bid_document_id}.zip"
        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(markdown_path, arcname=markdown_path.name)
            archive.write(page_json_path, arcname=page_json_path.name)
        return {
            "job_id": None,
            "markdown": markdown,
            "page_json": page_json,
            "output_files": [],
            "zip_path": output_zip,
            "markdown_path": markdown_path,
            "page_json_path": page_json_path,
        }

    async def _normalize_sarvam_output(self, document: BidDocument, source_path: Path, remote: Dict[str, Any]) -> Dict[str, Any]:
        output_dir = _ensure_dir(self.ocr_root / document.bid_document_id)
        zip_path_value = remote.get("zip_path")
        markdown = remote.get("markdown", "")
        page_json_payload: Dict[str, Any] = remote.get("page_json", {}) or {"pages": []}
        downloaded_files: List[Path] = []

        if zip_path_value and Path(zip_path_value).exists():
            zip_path = Path(zip_path_value)
            extracted_dir = _ensure_dir(output_dir / "extracted")
            with zipfile.ZipFile(zip_path) as archive:
                archive.extractall(extracted_dir)
                for name in archive.namelist():
                    if name.endswith("/"):
                        continue
                    downloaded_files.append(extracted_dir / name)

            if not markdown or not page_json_payload:
                extracted_markdown, extracted_page_json, _pages = self._extract_output_zip(zip_path)
                markdown = markdown or extracted_markdown
                page_json_payload = page_json_payload or extracted_page_json
        else:
            job_id = remote.get("job_id")
            download_urls = remote.get("downloads", {})
            extracted_dir = _ensure_dir(output_dir / "extracted")
            page_json_payload = {"job_id": job_id, "pages": []}

            for filename, info in download_urls.items():
                file_url = None
                if isinstance(info, dict):
                    file_url = info.get("file_url") or info.get("url")
                if not file_url:
                    continue
                dest = extracted_dir / _safe_name(filename)
                await asyncio.to_thread(self._download_url, file_url, dest)
                downloaded_files.append(dest)

                suffix = dest.suffix.lower()
                if suffix in {".md", ".markdown", ".txt"}:
                    markdown = f"{markdown}\n\n{dest.read_text(encoding='utf-8', errors='ignore')}".strip()
                elif suffix == ".json":
                    try:
                        data = json.loads(dest.read_text(encoding="utf-8", errors="ignore"))
                        page_json_payload.setdefault("pages", [])
                        if isinstance(data, dict):
                            page_json_payload.update({k: v for k, v in data.items() if k != "pages"})
                            if isinstance(data.get("pages"), list):
                                page_json_payload["pages"] = data["pages"]
                            elif isinstance(data.get("page_data"), list):
                                page_json_payload["pages"] = data["page_data"]
                    except Exception:
                        pass

        markdown_path = output_dir / f"{document.bid_document_id}.md"
        page_json_path = output_dir / f"{document.bid_document_id}.json"
        markdown_path.write_text(markdown, encoding="utf-8")
        page_json_path.write_text(json.dumps(page_json_payload, indent=2, ensure_ascii=False), encoding="utf-8")

        output_zip = self.ocr_root / f"{document.bid_document_id}.zip"
        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(markdown_path, arcname=markdown_path.name)
            archive.write(page_json_path, arcname=page_json_path.name)
            for file_path in downloaded_files:
                archive.write(file_path, arcname=file_path.name)

        return {
            "job_id": job_id,
            "markdown": markdown,
            "page_json": page_json_payload,
            "output_files": downloaded_files,
            "zip_path": output_zip,
            "markdown_path": markdown_path,
            "page_json_path": page_json_path,
        }

    def _download_url(self, url: str, destination: Path) -> Path:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=300) as response:
            destination.write_bytes(response.read())
        return destination

    async def _persist_ocr_artifacts(self, session: AsyncSession, document: BidDocument, artefacts: Dict[str, Any]) -> None:
        document.ocr_job_id = artefacts.get("job_id")
        document.ocr_status = OcrStatusEnum.SUCCEEDED
        document.ocr_output_path = str(artefacts.get("zip_path") or "")
        document.ocr_markdown_path = str(artefacts.get("markdown_path") or "")
        document.ocr_page_json_path = str(artefacts.get("page_json_path") or "")
        document.updated_at = _now()
        await session.commit()

    async def process_document_facts(self, document_id: str) -> List[DocumentFact]:
        async with AsyncSessionLocal() as session:
            document = await session.get(BidDocument, document_id)
            if not document:
                raise ValueError("Document not found")

            markdown_text = ""
            if document.ocr_markdown_path and Path(document.ocr_markdown_path).exists():
                markdown_text = Path(document.ocr_markdown_path).read_text(encoding="utf-8", errors="ignore")
            elif document.ocr_output_path and Path(document.ocr_output_path).exists():
                markdown_text = Path(document.ocr_output_path).read_text(encoding="utf-8", errors="ignore")

            tender = await session.get(Tender, document.tender_id)
            facts_payload = self._extract_facts(document, markdown_text, tender)

            await session.execute(
                select(DocumentFact).where(DocumentFact.document_id == document_id)
            )
            existing = await session.scalars(select(DocumentFact).where(DocumentFact.document_id == document_id))
            for row in existing.all():
                await session.delete(row)

            facts: List[DocumentFact] = []
            for payload in facts_payload:
                fact = DocumentFact(**payload)
                session.add(fact)
                facts.append(fact)

            await session.commit()
            from app.services.task_queue import enqueue_task

            await enqueue_task("facts_extracted", tender_id=document.tender_id, bidder_id=document.bidder_id)
            return facts

    def _extract_facts(self, document: BidDocument, markdown_text: str, tender: Optional[Tender]) -> List[Dict[str, Any]]:
        text = markdown_text or ""
        lower_text = text.lower()
        related_criteria = self._criteria_map(tender)
        snippets = self._snippets(text)
        facts: List[Dict[str, Any]] = []

        patterns: List[Tuple[FactTypeEnum, str, FactUnitEnum, str]] = [
            (FactTypeEnum.GSTIN, r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", FactUnitEnum.NONE, "GST registration"),
            (FactTypeEnum.PAN, r"\b[A-Z]{5}\d{4}[A-Z]\b", FactUnitEnum.NONE, "PAN"),
            (FactTypeEnum.CIN, r"\b[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b", FactUnitEnum.NONE, "CIN"),
            (FactTypeEnum.UDYAM, r"\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b", FactUnitEnum.NONE, "Udyam registration"),
            (FactTypeEnum.NSIC, r"\bNSIC\s*[:\-]?\s*[A-Z0-9/-]{6,}\b", FactUnitEnum.NONE, "NSIC"),
            (FactTypeEnum.ISO_CERT, r"\bISO\s?\d{4,5}(?:\s*:\s*\d{4})?\b", FactUnitEnum.NONE, "ISO certification"),
        ]

        for fact_type, pattern, unit, label in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                facts.append(self._fact_payload(document, fact_type, label, match.group(0), unit, snippets, related_criteria.get(fact_type), status=FactStatusEnum.CONFIRMED))

        financial_hits = self._extract_financial_facts(document, text, snippets, related_criteria)
        facts.extend(financial_hits)

        experience_hits = self._extract_experience_facts(document, text, snippets, related_criteria)
        facts.extend(experience_hits)

        if not facts:
            facts.append(
                self._fact_payload(
                    document,
                    FactTypeEnum.OTHER,
                    "Document summary",
                    "No structured facts detected",
                    FactUnitEnum.NONE,
                    snippets,
                    None,
                    status=FactStatusEnum.NOT_FOUND,
                    ambiguity_reason="No recognizable registration, financial, or experience markers were detected in OCR text.",
                )
            )
        return facts

    def _extract_financial_facts(self, document: BidDocument, text: str, snippets: Dict[str, str], related_criteria: Dict[FactTypeEnum, List[str]]) -> List[Dict[str, Any]]:
        facts: List[Dict[str, Any]] = []
        year_pattern = r"(FY\s*\d{4}[-/]\d{2,4}|\d{4}[-/]\d{2,4})"
        amount_pattern = r"(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(crore|crores|cr|lakh|lakhs|l|thousand|k)?"

        for match in re.finditer(rf"(turnover|revenue|sales|net worth|paid up capital).*?{year_pattern}.*?{amount_pattern}", text, re.IGNORECASE | re.DOTALL):
            label_source = match.group(1).title()
            fy = match.group(2)
            amount = _to_float(match.group(3))
            unit_token = (match.group(4) or "").lower()
            if amount is None:
                continue
            unit = FactUnitEnum.INR
            normalized_value = amount
            if unit_token in {"crore", "crores", "cr"}:
                unit = FactUnitEnum.CRORE_INR
                normalized_value = _normalize_inr(amount, "crore")
            elif unit_token in {"lakh", "lakhs", "l"}:
                unit = FactUnitEnum.LAKH_INR
                normalized_value = _normalize_inr(amount, "lakh")
            elif unit_token in {"thousand", "k"}:
                unit = FactUnitEnum.INR
                normalized_value = amount * 1000
            fact_type = FactTypeEnum.TURNOVER if "turnover" in label_source.lower() or "revenue" in label_source.lower() or "sales" in label_source.lower() else FactTypeEnum.NET_WORTH
            facts.append(
                self._fact_payload(
                    document,
                    fact_type,
                    f"{label_source} {fy}",
                    match.group(0),
                    unit,
                    snippets,
                    related_criteria.get(fact_type),
                    financial_year=fy,
                    value_normalized={"amount_in_inr": normalized_value, "raw_amount": amount, "source_unit": unit_token or "inr"},
                )
            )
        return facts

    def _extract_experience_facts(self, document: BidDocument, text: str, snippets: Dict[str, str], related_criteria: Dict[FactTypeEnum, List[str]]) -> List[Dict[str, Any]]:
        facts: List[Dict[str, Any]] = []
        project_count_patterns = [
            r"(\d+)\s+(?:similar\s+)?projects?",
            r"projects?\s*(?:completed|executed|delivered)\s*[:\-]?\s*(\d+)",
        ]
        for pattern in project_count_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                facts.append(
                    self._fact_payload(
                        document,
                        FactTypeEnum.PROJECT_COUNT,
                        "Similar project count",
                        match.group(0),
                        FactUnitEnum.COUNT,
                        snippets,
                        related_criteria.get(FactTypeEnum.PROJECT_COUNT),
                        value_normalized={"count": int(match.group(1))},
                    )
                )
                break

        years_match = re.search(r"(\d+(?:\.\d+)?)\s+years?\s+of\s+experience", text, re.IGNORECASE)
        if years_match:
            facts.append(
                self._fact_payload(
                    document,
                    FactTypeEnum.EXPERIENCE_YEARS,
                    "Experience years",
                    years_match.group(0),
                    FactUnitEnum.YEARS,
                    snippets,
                    related_criteria.get(FactTypeEnum.EXPERIENCE_YEARS),
                    value_normalized={"years": _to_float(years_match.group(1))},
                )
            )
        return facts

    def _criteria_map(self, tender: Optional[Tender]) -> Dict[FactTypeEnum, List[str]]:
        mapping: Dict[FactTypeEnum, List[str]] = {}
        if not tender:
            return mapping
        for criterion in getattr(tender, "criteria", []) or []:
            evidence_type = criterion.evidence_type
            mapped_fact_type: Optional[FactTypeEnum] = None
            if evidence_type == EvidenceTypeEnum.GST_REGISTRATION:
                mapped_fact_type = FactTypeEnum.GSTIN
            elif evidence_type == EvidenceTypeEnum.PAN:
                mapped_fact_type = FactTypeEnum.PAN
            elif evidence_type == EvidenceTypeEnum.MSME:
                mapped_fact_type = FactTypeEnum.MSME_STATUS
            elif evidence_type == EvidenceTypeEnum.ISO:
                mapped_fact_type = FactTypeEnum.ISO_CERT
            elif evidence_type == EvidenceTypeEnum.EXPERIENCE_CERTIFICATE:
                mapped_fact_type = FactTypeEnum.PROJECT_COUNT
            elif evidence_type == EvidenceTypeEnum.AUDITED_FINANCIALS:
                mapped_fact_type = FactTypeEnum.TURNOVER
            if mapped_fact_type:
                mapping.setdefault(mapped_fact_type, []).append(criterion.criterion_id)
        return mapping

    def _snippets(self, text: str) -> Dict[str, str]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return {
            "top": _format_snippet("\n".join(lines[:3])),
            "middle": _format_snippet("\n".join(lines[3:8])) if len(lines) > 3 else "",
        }

    def _fact_payload(
        self,
        document: BidDocument,
        fact_type: FactTypeEnum,
        label: str,
        value_raw: str,
        unit: FactUnitEnum,
        snippets: Dict[str, str],
        related_criteria_ids: Optional[List[str]],
        *,
        financial_year: Optional[str] = None,
        value_normalized: Optional[Dict[str, Any]] = None,
        status: FactStatusEnum = FactStatusEnum.CONFIRMED,
        ambiguity_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "fact_id": str(uuid.uuid4()),
            "document_id": document.bid_document_id,
            "bid_id": document.bid_id,
            "tender_id": document.tender_id,
            "fact_type": fact_type,
            "label": label,
            "value_raw": value_raw,
            "value_normalized": value_normalized or {"raw": value_raw},
            "unit": unit,
            "financial_year": financial_year,
            "page_hint": "1",
            "snippet": snippets.get("top") or _format_snippet(value_raw),
            "table_context": snippets.get("middle") or None,
            "status": status,
            "ambiguity_reason": ambiguity_reason,
            "related_tender_criteria_ids": related_criteria_ids or [],
        }

    async def confirm_fact(
        self,
        fact_id: str,
        confirmed: bool,
        corrected_value: Optional[str],
        comment: Optional[str],
        confirmed_by_user_id: str,
    ) -> FactConfirmation:
        async with AsyncSessionLocal() as session:
            existing = await session.scalar(select(FactConfirmation).where(FactConfirmation.fact_id == fact_id))
            if existing:
                existing.confirmed = confirmed
                existing.corrected_value = corrected_value
                existing.comment = comment
                existing.confirmed_by_user_id = confirmed_by_user_id
                existing.updated_at = _now()
                await session.commit()
                return existing

            confirmation = FactConfirmation(
                confirmation_id=str(uuid.uuid4()),
                fact_id=fact_id,
                confirmed=confirmed,
                corrected_value=corrected_value,
                comment=comment,
                confirmed_by_user_id=confirmed_by_user_id,
            )
            session.add(confirmation)
            await session.commit()
            return confirmation

    async def apply_fact_to_profile(self, document_id: str, fact_id: str, bidder_user_id: str) -> Dict[str, Any]:
        from app.api.v1.endpoints.bidders import BIDDERS_DB  # local import to avoid circular dependency

        async with AsyncSessionLocal() as session:
            fact = await session.get(DocumentFact, fact_id)
            document = await session.get(BidDocument, document_id)
            if not fact or not document:
                raise ValueError("Document or fact not found")

            bidder = await self.ensure_bidder_profile(session, document.bidder_id or bidder_user_id)
            if not bidder:
                raise ValueError("Bidder profile not found")

            mapping = {
                FactTypeEnum.GSTIN: ("gstin", fact.value_raw),
                FactTypeEnum.PAN: ("pan", fact.value_raw),
                FactTypeEnum.CIN: ("cin", fact.value_raw),
                FactTypeEnum.UDYAM: ("udyam_no", fact.value_raw),
                FactTypeEnum.NSIC: ("nsic_registration_no", fact.value_raw),
                FactTypeEnum.REGISTRATION_NAME: ("organisation_name", fact.value_raw),
                FactTypeEnum.ADDRESS: ("registered_address", fact.value_raw),
                FactTypeEnum.MSME_STATUS: ("msme_registration_no", fact.value_raw),
            }

            target = mapping.get(fact.fact_type)
            if not target:
                raise ValueError(f"Fact type {fact.fact_type} cannot be mapped to the bidder profile automatically")

            field_name, field_value = target
            setattr(bidder, field_name, field_value)
            bidder.updated_at = _now()
            await session.commit()

            if bidder.bidder_id in BIDDERS_DB:
                BIDDERS_DB[bidder.bidder_id][field_name] = field_value

            return {"bidder_id": bidder.bidder_id, "field": field_name, "value": field_value}

    async def evaluate_bidder(self, tender_id: str, bidder_id: str) -> List[EvaluationResult]:
        async with AsyncSessionLocal() as session:
            tender = await session.get(Tender, tender_id)
            documents = (await session.scalars(select(BidDocument).where(and_(BidDocument.tender_id == tender_id, BidDocument.bidder_id == bidder_id)))).all()
            facts = (await session.scalars(select(DocumentFact).where(and_(DocumentFact.tender_id == tender_id, DocumentFact.bid_id.in_([doc.bid_id for doc in documents]))))).all()
            criteria = list(tender.criteria) if tender else self._synthetic_criteria(facts)
            results: List[EvaluationResult] = []

            for criterion in criteria:
                verdict, reason, linked_fact_ids = self._evaluate_criterion(criterion, documents, facts)
                existing = await session.scalar(
                    select(EvaluationResult).where(
                        and_(
                            EvaluationResult.tender_id == tender_id,
                            EvaluationResult.bidder_id == bidder_id,
                            EvaluationResult.criterion_id == criterion.criterion_id,
                        )
                    )
                )
                if existing:
                    existing.verdict = verdict
                    existing.reason = reason
                    existing.linked_fact_ids = linked_fact_ids
                    existing.created_at = _now()
                    result = existing
                else:
                    result = EvaluationResult(
                        evaluation_result_id=str(uuid.uuid4()),
                        bidder_id=bidder_id,
                        tender_id=tender_id,
                        criterion_id=criterion.criterion_id,
                        verdict=verdict,
                        reason=reason,
                        linked_fact_ids=linked_fact_ids,
                    )
                    session.add(result)
                results.append(result)

            await session.commit()
            return results

    def _evaluate_criterion(self, criterion: TenderCriterion, documents: Sequence[BidDocument], facts: Sequence[DocumentFact]) -> Tuple[EvaluationVerdictEnum, str, List[str]]:
        relevant_docs = list(documents)
        matched_facts = [fact for fact in facts if criterion.criterion_id in (fact.related_tender_criteria_ids or []) or self._fact_matches_criterion(fact, criterion)]

        if not matched_facts:
            return (
                EvaluationVerdictEnum.NEEDS_MANUAL_REVIEW,
                f"No auditable fact found for criterion {criterion.criterion_id}: {criterion.title}. Review bidder documents manually.",
                [],
            )

        ambiguous = [fact for fact in matched_facts if fact.status == FactStatusEnum.AMBIGUOUS]
        if ambiguous:
            fact_ids = [fact.fact_id for fact in matched_facts]
            return (
                EvaluationVerdictEnum.NEEDS_MANUAL_REVIEW,
                f"Ambiguous fact(s) {', '.join(fact.fact_id for fact in ambiguous)} found for criterion {criterion.criterion_id}. Manual review required.",
                fact_ids,
            )

        fact = matched_facts[0]
        verdict = EvaluationVerdictEnum.ELIGIBLE
        reason = f"Criterion {criterion.criterion_id} ({criterion.title}) is supported by fact {fact.fact_id} from document {fact.document_id} with value {fact.value_normalized or fact.value_raw}."

        threshold_value = _to_float(criterion.threshold_value)
        fact_value = self._fact_numeric_value(fact)

        if criterion.threshold_type in {ThresholdTypeEnum.GREATER_OR_EQUAL, ThresholdTypeEnum.LESS_OR_EQUAL, ThresholdTypeEnum.RANGE, ThresholdTypeEnum.EQUAL}:
            if fact_value is None or threshold_value is None:
                return (
                    EvaluationVerdictEnum.NEEDS_MANUAL_REVIEW,
                    f"Criterion {criterion.criterion_id} requires numeric comparison but the fact value could not be normalized.",
                    [fact.fact_id],
                )
            if criterion.threshold_type == ThresholdTypeEnum.GREATER_OR_EQUAL and fact_value < threshold_value:
                return (
                    EvaluationVerdictEnum.NOT_ELIGIBLE,
                    f"Fact {fact.fact_id} normalized to {fact_value} which is below threshold {threshold_value} for criterion {criterion.criterion_id}.",
                    [fact.fact_id],
                )
            if criterion.threshold_type == ThresholdTypeEnum.LESS_OR_EQUAL and fact_value > threshold_value:
                return (
                    EvaluationVerdictEnum.NOT_ELIGIBLE,
                    f"Fact {fact.fact_id} normalized to {fact_value} which exceeds maximum threshold {threshold_value} for criterion {criterion.criterion_id}.",
                    [fact.fact_id],
                )

        if relevant_docs:
            doc = relevant_docs[0]
            reason = f"Document {doc.original_file_name or doc.file_name} produced fact {fact.fact_id}; snippet: {fact.snippet or fact.value_raw}."

        return verdict, reason, [fact.fact_id]

    def _synthetic_criteria(self, facts: Sequence[DocumentFact]) -> List[Any]:
        if not facts:
            return [
                SyntheticCriterion("SYNTH-REG-001", "Registration evidence", "Registration documents should expose legal identity and address.", ThresholdTypeEnum.FREE_TEXT, "Any", EvidenceTypeEnum.OTHER),
            ]

        seen: set[str] = set()
        criteria: List[Any] = []
        for fact in facts:
            if fact.fact_type.value in seen:
                continue
            seen.add(fact.fact_type.value)
            threshold_type = ThresholdTypeEnum.FREE_TEXT
            if fact.fact_type in {FactTypeEnum.TURNOVER, FactTypeEnum.NET_WORTH, FactTypeEnum.PAID_UP_CAPITAL, FactTypeEnum.PROJECT_COUNT, FactTypeEnum.EXPERIENCE_YEARS}:
                threshold_type = ThresholdTypeEnum.GREATER_OR_EQUAL
            criteria.append(
                SyntheticCriterion(
                    criterion_id=f"SYNTH-{fact.fact_type.value}",
                    title=fact.label,
                    description=f"Auto-generated criterion for {fact.fact_type.value}",
                    threshold_type=threshold_type,
                    threshold_value=str(fact.value_normalized.get("amount_in_inr") if isinstance(fact.value_normalized, dict) and fact.value_normalized else fact.value_raw),
                    evidence_type=EvidenceTypeEnum.OTHER,
                    category=CriterionCategoryEnum.TECHNICAL,
                    mandatory=True,
                )
            )
        return criteria

    def _fact_matches_criterion(self, fact: DocumentFact, criterion: TenderCriterion) -> bool:
        fact_type_map = {
            FactTypeEnum.GSTIN: {"gst", "gstin", "registration"},
            FactTypeEnum.PAN: {"pan"},
            FactTypeEnum.CIN: {"cin", "company"},
            FactTypeEnum.UDYAM: {"udyam", "msme"},
            FactTypeEnum.NSIC: {"nsic"},
            FactTypeEnum.TURNOVER: {"turnover", "revenue", "financial"},
            FactTypeEnum.NET_WORTH: {"net worth"},
            FactTypeEnum.PAID_UP_CAPITAL: {"paid up capital"},
            FactTypeEnum.PROJECT_COUNT: {"project", "experience"},
            FactTypeEnum.PROJECT_DETAILS: {"project", "experience"},
            FactTypeEnum.ISO_CERT: {"iso"},
            FactTypeEnum.MSME_STATUS: {"msme"},
            FactTypeEnum.REGISTRATION_NAME: {"name", "organisation"},
            FactTypeEnum.ADDRESS: {"address"},
            FactTypeEnum.EXPERIENCE_YEARS: {"experience"},
        }

        title = f"{criterion.title} {criterion.description}".lower()
        return any(token in title for token in fact_type_map.get(fact.fact_type, set()))

    def _fact_numeric_value(self, fact: DocumentFact) -> Optional[float]:
        normalized = fact.value_normalized or {}
        if isinstance(normalized, dict):
            for key in ("amount_in_inr", "value", "count", "years"):
                if key in normalized and _to_float(normalized[key]) is not None:
                    return _to_float(normalized[key])
        return _to_float(fact.value_raw)

    async def get_document_summary(self, document_id: str) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            document = await session.get(BidDocument, document_id)
            if not document:
                raise ValueError("Document not found")
            facts = (await session.scalars(select(DocumentFact).where(DocumentFact.document_id == document_id))).all()
            confirmations = (await session.scalars(select(FactConfirmation).join(DocumentFact, FactConfirmation.fact_id == DocumentFact.fact_id).where(DocumentFact.document_id == document_id))).all()
            return {
                "document": document,
                "facts": facts,
                "confirmations": confirmations,
            }

    async def generate_evaluation_report(self, tender_id: str) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            tender = await session.get(Tender, tender_id)
            bidder_ids = (await session.scalars(select(BidDocument.bidder_id).where(BidDocument.tender_id == tender_id).distinct())).all()
            bidders_payload: List[Dict[str, Any]] = []
            for bidder_id in bidder_ids:
                results = (await session.scalars(
                    select(EvaluationResult).where(and_(EvaluationResult.tender_id == tender_id, EvaluationResult.bidder_id == bidder_id))
                )).all()
                docs = (await session.scalars(select(BidDocument).where(and_(BidDocument.tender_id == tender_id, BidDocument.bidder_id == bidder_id)))).all()
                facts = (await session.scalars(select(DocumentFact).where(and_(DocumentFact.tender_id == tender_id, DocumentFact.bid_id.in_([doc.bid_id for doc in docs]))))).all()
                criteria = list(tender.criteria) if tender else self._synthetic_criteria(facts)
                bidder_payload = {
                    "bidder_id": bidder_id,
                    "documents": [
                        {
                            "document_id": doc.bid_document_id,
                            "file_name": doc.original_file_name or doc.file_name,
                            "category": doc.document_category.value,
                            "ocr_status": doc.ocr_status.value,
                            "ocr_markdown_path": doc.ocr_markdown_path,
                            "ocr_page_json_path": doc.ocr_page_json_path,
                        }
                        for doc in docs
                    ],
                    "criteria": [
                        {
                            "criterion_id": criterion.criterion_id,
                            "title": criterion.title,
                            "description": criterion.description,
                            "category": criterion.category.value if hasattr(criterion.category, "value") else str(criterion.category),
                            "threshold_type": criterion.threshold_type.value if hasattr(criterion.threshold_type, "value") else str(criterion.threshold_type),
                            "threshold_value": criterion.threshold_value,
                            "evidence_type": criterion.evidence_type.value if hasattr(criterion.evidence_type, "value") else str(criterion.evidence_type),
                        }
                        for criterion in criteria
                    ],
                    "results": [
                        {
                            "evaluation_result_id": result.evaluation_result_id,
                            "criterion_id": result.criterion_id,
                            "verdict": result.verdict.value,
                            "reason": result.reason,
                            "linked_fact_ids": result.linked_fact_ids or [],
                        }
                        for result in results
                    ],
                    "facts": [
                        {
                            "fact_id": fact.fact_id,
                            "document_id": fact.document_id,
                            "label": fact.label,
                            "value_raw": fact.value_raw,
                            "value_normalized": fact.value_normalized,
                            "unit": fact.unit.value,
                            "status": fact.status.value,
                            "snippet": fact.snippet,
                            "ambiguity_reason": fact.ambiguity_reason,
                        }
                        for fact in facts
                    ],
                }
                verdict_buckets = {
                    "Clearly Eligible": [item for item in bidder_payload["results"] if item["verdict"] == EvaluationVerdictEnum.ELIGIBLE.value],
                    "Clearly Not Eligible": [item for item in bidder_payload["results"] if item["verdict"] == EvaluationVerdictEnum.NOT_ELIGIBLE.value],
                    "Need Manual Review": [item for item in bidder_payload["results"] if item["verdict"] == EvaluationVerdictEnum.NEEDS_MANUAL_REVIEW.value],
                }
                bidder_payload["buckets"] = verdict_buckets
                bidders_payload.append(bidder_payload)

            return {
                "tender_id": tender_id,
                "generated_at": _now().isoformat(),
                "bidders": bidders_payload,
            }


pipeline_service = BidderPipelineService()
