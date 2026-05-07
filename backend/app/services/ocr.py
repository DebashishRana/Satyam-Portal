"""
OCR Service for Document Processing using EasyOCR.
"""

import logging
import json
import os
import re
import sys
import tempfile
import zipfile
from typing import Dict, Any, List, Optional, Tuple
import asyncio
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageSequence

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError as e:
    logging.warning(f"EasyOCR import failed: {e}. EasyOCR fallback will not be available.")
    easyocr = None  # type: ignore[assignment]
    EASYOCR_AVAILABLE = False

SarvamAI = None  # type: ignore[assignment]
SARVAM_SDK_AVAILABLE = False

# Import language detector with IndicLID support
from app.services.language_detector import LanguageDetector
from app.core.config import settings

logger = logging.getLogger(__name__)


def _strip_html_tags(text: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _extract_docx_text(file_path: str) -> str:
    try:
        with zipfile.ZipFile(file_path) as archive:
            document_xml = archive.read("word/document.xml")
        from xml.etree import ElementTree as ET

        root = ET.fromstring(document_xml)
        paragraphs: List[str] = []
        for paragraph in root.iter():
            if paragraph.tag.endswith("}p") or paragraph.tag == "p":
                texts: List[str] = []
                for child in paragraph.iter():
                    if (child.tag.endswith("}t") or child.tag == "t") and child.text:
                        texts.append(child.text)
                if texts:
                    paragraphs.append("".join(texts))
        return "\n\n".join(paragraphs).strip()
    except Exception as exc:
        logger.warning("DOCX text extraction failed for %s: %s", file_path, exc)
        return ""


def _safe_metric_value(metric: Any) -> Optional[float]:
    try:
        if metric is None:
            return None
        if isinstance(metric, dict):
            for key in ("confidence", "score", "avg_confidence", "mean_confidence"):
                if key in metric and metric[key] is not None:
                    return float(metric[key])
        for attr in ("confidence", "score", "avg_confidence", "mean_confidence"):
            if hasattr(metric, attr):
                value = getattr(metric, attr)
                if value is not None:
                    return float(value)
    except Exception:
        return None
    return None


class OCRService:
    """
    Service for performing OCR on uploaded documents using EasyOCR.

    Strategy:
    - EasyOCR for all live OCR text extraction
    - DOCX text extraction remains a lightweight local shortcut
    """

    def __init__(self, device: str = "cpu", confidence_threshold: float = 0.7, detection_sensitivity: str = "normal"):
        """
        Initialize the OCR Service.
        
        Args:
            device: Device to use ('cpu' or 'cuda:0'). Defaults to CPU for stability.
            confidence_threshold: Minimum confidence score for text recognition.
            detection_sensitivity: 'strict', 'normal' (default), or 'sensitive' for tuning detection
        """
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.detection_sensitivity = detection_sensitivity
        self.ocr_system: Optional[Any] = None
        self.easyocr_available = EASYOCR_AVAILABLE
        self.sarvam_available = False
        self.sarvam_client = None
        self._initialized = False
        self._easyocr_languages = ["en", "hi", "bn", "ta", "te", "kn", "ml"]
        
        logger.info(f"OCRService initialized with device={device}, threshold={confidence_threshold}, sensitivity={detection_sensitivity}")
        logger.info("EasyOCR available: %s", self.easyocr_available)

        if self.sarvam_available and SarvamAI is not None:
            try:
                self.sarvam_client = SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
            except Exception as exc:
                logger.warning("SarvamAI client initialization failed, continuing with fallbacks: %s", exc)
                self.sarvam_client = None
                self.sarvam_available = False

    def _initialize_ocr(self) -> bool:
        """
        Lazy initialization of OCR system on first use.
        Avoids expensive model loading at import time.
        
        Returns:
            True if initialization successful, False otherwise.
        """
        if self._initialized:
            return self.ocr_system is not None
        
        if not self.easyocr_available or easyocr is None:
            logger.error("EasyOCR is not available. Cannot initialize OCR system.")
            self._initialized = True
            return False
        
        try:
            logger.info(f"Initializing EasyOCR system on device {self.device}...")
            use_gpu = str(self.device).lower() not in {"cpu", "false", "0"}
            self.ocr_system = easyocr.Reader(self._easyocr_languages, gpu=use_gpu, verbose=False)
            
            self._initialized = True
            logger.info("OCR system initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OCR system: {e}")
            self._initialized = True
            return False

    def process_document(self, file_path: str) -> Dict[str, Any]:
        """
        Process a document and extract text with confidence scores.
        
        Args:
            file_path: Path to the image file to process.
            
        Returns:
            Dictionary with extracted text, confidence scores, language info, and entities.
            
        Raises:
            FileNotFoundError: If the file doesn't exist.
            ValueError: If the file format is not supported.
        """
        logger.info(f"Processing document: {file_path}")
        
        try:
            # Validate file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Validate file format
            supported_formats = {'.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', '.docx'}
            file_ext = Path(file_path).suffix.lower()
            if file_ext not in supported_formats:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported: {supported_formats}")

            if file_ext == ".docx":
                extracted_text = _extract_docx_text(file_path)
                language = self._detect_language(extracted_text)
                language_confidence = self._get_language_confidence(extracted_text)
                entities = self._extract_entities(extracted_text)
                return {
                    "text": extracted_text,
                    "confidence_score": 0.75 if extracted_text else 0.0,
                    "page_count": 1 if extracted_text else 0,
                    "language": language,
                    "language_confidence": language_confidence,
                    "extracted_entities": entities,
                    "pages": [
                        {
                            "page_num": 1,
                            "text": extracted_text,
                            "confidence": 0.75,
                            "blocks": [],
                        }
                    ] if extracted_text else [],
                    "ocr_engine": "docx-text-extraction",
                }
            
            return self._process_with_easyocr(file_path)
            
        except Exception as e:
            logger.error(f"OCR processing failed for {file_path}: {str(e)}", exc_info=True)
            # Return error response instead of raising to allow graceful failure
            return {
                "text": "",
                "confidence_score": 0.0,
                "page_count": 0,
                "language": "unknown",
                "extracted_entities": {
                    "gstin": None,
                    "pan": None,
                    "amounts": [],
                    "dates": []
                },
                "pages": [],
                "error": str(e)
            }

    def _process_with_easyocr(self, file_path: str) -> Dict[str, Any]:
        if self.ocr_system is None or easyocr is None:
            raise RuntimeError("EasyOCR system not available")

        page_images: List[Tuple[int, np.ndarray]] = []
        if file_path.lower().endswith(".pdf"):
            try:
                with Image.open(file_path) as pdf_image:
                    for index, frame in enumerate(ImageSequence.Iterator(pdf_image), start=1):
                        page_images.append((index, cv2.cvtColor(np.array(frame.convert("RGB")), cv2.COLOR_RGB2BGR)))
            except Exception as exc:
                raise RuntimeError("PDF OCR requires Pillow PDF support on this machine") from exc
        else:
            image = cv2.imread(file_path)
            if image is None:
                raise ValueError(f"Failed to read image: {file_path}")
            page_images.append((1, image))

        text_parts: List[str] = []
        pages: List[Dict[str, Any]] = []
        confidences: List[float] = []

        for page_num, image in page_images:
            results = self.ocr_system.readtext(image, detail=1, paragraph=True)
            page_text_parts: List[str] = []
            blocks: List[Dict[str, Any]] = []
            page_confidences: List[float] = []

            for index, item in enumerate(results):
                if not isinstance(item, (list, tuple)) or len(item) < 3:
                    continue
                bbox, text, confidence = item[0], item[1], item[2]
                text_value = str(text or "").strip()
                if text_value:
                    page_text_parts.append(text_value)
                    text_parts.append(text_value)
                try:
                    page_confidences.append(float(confidence))
                    confidences.append(float(confidence))
                except Exception:
                    pass
                blocks.append(
                    {
                        "block_num": index + 1,
                        "bbox": self._normalize_easyocr_bbox(bbox),
                        "text": text_value,
                        "confidence": float(confidence) if confidence is not None else 0.0,
                    }
                )

            page_text = "\n".join(page_text_parts).strip()
            pages.append(
                {
                    "page_num": page_num,
                    "text": page_text,
                    "confidence": sum(page_confidences) / len(page_confidences) if page_confidences else 0.0,
                    "blocks": blocks,
                }
            )

        extracted_text = "\n".join(part for part in text_parts if part).strip()
        language = self._detect_language(extracted_text)
        language_confidence = self._get_language_confidence(extracted_text)
        entities = self._extract_entities(extracted_text)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        logger.info("EasyOCR completed for %s. Extracted %d characters.", file_path, len(extracted_text))
        return {
            "text": extracted_text,
            "confidence_score": avg_confidence,
            "page_count": len(pages),
            "language": language,
            "language_confidence": language_confidence,
            "ocr_engine": "easyocr",
            "extracted_entities": entities,
            "pages": pages,
        }

    def _normalize_easyocr_bbox(self, bbox: Any) -> List[int]:
        try:
            points = np.array(bbox, dtype=np.int32)
            x_min = int(np.min(points[:, 0]))
            y_min = int(np.min(points[:, 1]))
            x_max = int(np.max(points[:, 0]))
            y_max = int(np.max(points[:, 1]))
            return [x_min, y_min, x_max, y_max]
        except Exception:
            return [0, 0, 100, 100]

    def _process_with_sarvam(self, file_path: str) -> Dict[str, Any]:
        if self.sarvam_client is None:
            raise RuntimeError("SarvamAI client is not available")

        input_path = Path(file_path)
        job = self.sarvam_client.document_intelligence.create_job(language="multi", output_format="html")
        job.upload_file(str(input_path))
        job.start()
        status = job.wait_until_complete()

        metrics: Any = None
        try:
            metrics = job.get_page_metrics()
        except Exception as exc:
            logger.debug("Sarvam page metrics unavailable for %s: %s", file_path, exc)

        with tempfile.TemporaryDirectory(prefix="sarvam_ocr_") as temp_dir:
            output_zip = Path(temp_dir) / f"{input_path.stem}.zip"
            job.download_output(str(output_zip))

            extracted_text, pages, page_payload = self._extract_sarvam_zip(output_zip)
            language = self._detect_language(extracted_text)
            language_confidence = self._get_language_confidence(extracted_text)
            avg_confidence = _safe_metric_value(metrics) or 0.9

            return {
                "text": extracted_text,
                "confidence_score": avg_confidence,
                "page_count": len(pages) or page_payload.get("page_count", 0) or 1,
                "language": language,
                "language_confidence": language_confidence,
                "ocr_engine": "sarvam",
                "sarvam_job_state": getattr(status, "job_state", None) if not isinstance(status, dict) else status.get("job_state"),
                "sarvam_job_id": getattr(status, "job_id", None) if not isinstance(status, dict) else status.get("job_id"),
                "sarvam_metrics": metrics if isinstance(metrics, dict) else getattr(metrics, "__dict__", metrics),
                "extracted_entities": self._extract_entities(extracted_text),
                "pages": pages or [
                    {
                        "page_num": 1,
                        "text": extracted_text,
                        "confidence": avg_confidence,
                        "blocks": [],
                    }
                ],
            }

    def _extract_sarvam_zip(self, zip_path: Path) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
        extracted_text_parts: List[str] = []
        pages: List[Dict[str, Any]] = []
        payload: Dict[str, Any] = {"page_count": 0}

        if not zip_path.exists():
            raise FileNotFoundError(f"Sarvam output zip not found: {zip_path}")

        with zipfile.ZipFile(zip_path) as archive:
            for name in archive.namelist():
                lower = name.lower()
                if lower.endswith("/"):
                    continue
                with archive.open(name) as handle:
                    content = handle.read()
                text = content.decode("utf-8", errors="ignore")
                if lower.endswith((".md", ".markdown", ".txt")):
                    extracted_text_parts.append(text)
                    pages.append({"page_num": len(pages) + 1, "text": text.strip(), "confidence": 0.9, "blocks": []})
                elif lower.endswith((".html", ".htm")):
                    extracted_text = _strip_html_tags(text)
                    extracted_text_parts.append(extracted_text)
                    pages.append({"page_num": len(pages) + 1, "text": extracted_text, "confidence": 0.9, "blocks": []})
                elif lower.endswith(".json"):
                    try:
                        data = json.loads(text)
                        if isinstance(data, dict):
                            payload.update({k: v for k, v in data.items() if k != "pages"})
                            if isinstance(data.get("pages"), list):
                                payload["pages"] = data["pages"]
                                if not pages:
                                    for idx, page in enumerate(data["pages"], start=1):
                                        page_text = page.get("text") or page.get("markdown") or page.get("content") or ""
                                        pages.append({
                                            "page_num": idx,
                                            "text": page_text,
                                            "confidence": _safe_metric_value(page) or 0.9,
                                            "blocks": page.get("blocks") or [],
                                        })
                                    extracted_text_parts.extend(
                                        str(page.get("text") or page.get("markdown") or page.get("content") or "")
                                        for page in data["pages"]
                                    )
                    except Exception:
                        continue

        payload["page_count"] = len(pages)
        return "\n\n".join(part.strip() for part in extracted_text_parts if part.strip()), pages, payload

    def _extract_text_from_results(self, ocr_results: Any) -> str:
        """Extract plain text from OCR results."""
        if not ocr_results:
            return ""
        
        text_parts = []
        
        try:
            # Handle legacy OCR output format - usually a list or dict
            if isinstance(ocr_results, list):
                # If it's a list, iterate and extract text
                for item in ocr_results:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, dict):
                        # Try common keys for text content
                        for key in ['text', 'txt', 'content', 'result']:
                            if key in item:
                                text_parts.append(str(item[key]))
                                break
                    elif isinstance(item, (list, tuple)):
                        # Nested list/tuple
                        for sub_item in item:
                            if isinstance(sub_item, str):
                                text_parts.append(sub_item)
                            elif isinstance(sub_item, dict) and 'txt' in sub_item:
                                text_parts.append(sub_item['txt'])
            elif isinstance(ocr_results, dict):
                # If it's a dict, look for text in various key patterns
                for key, value in ocr_results.items():
                    if isinstance(value, str):
                        text_parts.append(value)
                    elif isinstance(value, dict):
                        for text_key in ['text', 'txt', 'content']:
                            if text_key in value:
                                text_parts.append(str(value[text_key]))
                                break
            elif isinstance(ocr_results, str):
                text_parts.append(ocr_results)
        except Exception as e:
            logger.warning(f"Error parsing OCR results: {e}")
        
        result = "\n".join(text_parts) if text_parts else ""
        logger.debug(f"Extracted {len(result)} characters from OCR results")
        return result

    def _calculate_average_confidence(self, ocr_results: Any) -> float:
        """Calculate average confidence score from OCR results."""
        # Since legacy OCR doesn't always provide per-character confidence,
        # we use a default value based on the model's typical performance
        return 0.85

    def _detect_language(self, text: str) -> str:
        """
        Detect language using IndicLID with fallback to Unicode heuristic.
        
        Returns: language code (e.g., 'en', 'hi', 'ta', 'te', 'kn', 'ml')
        """
        if not text:
            return "unknown"
        
        # Use LanguageDetector with IndicLID
        detector = LanguageDetector(use_indiclid=True)
        lang_code, confidence, indiclid_code = detector.detect(text)
        
        # Log detection details
        logger.info(f"Language detected: {lang_code} (confidence: {confidence:.1%}, IndicLID: {indiclid_code})")
        
        # If confidence is very low, mark language as uncertain
        if confidence < 0.5:
            logger.warning(f"Low confidence language detection ({confidence:.1%}). May need manual review.")
            return "uncertain"
        
        return lang_code
    
    def _get_language_confidence(self, text: str) -> float:
        """
        Get language detection confidence score.
        
        Returns: confidence score between 0.0 and 1.0
        """
        if not text:
            return 0.0
        
        detector = LanguageDetector(use_indiclid=True)
        _, confidence, _ = detector.detect(text)
        return confidence

    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """
        Extract named entities from document text.
        
        Supports:
        - GSTIN (15 characters)
        - PAN (10 characters)
        - Amounts (Crores, Lakhs)
        - Dates (DD/MM/YYYY, DD-MM-YYYY)
        """
        entities = {
            "gstin": None,
            "pan": None,
            "amounts": [],
            "dates": []
        }
        
        if not text:
            return entities
        
        try:
            # GSTIN extraction (15 characters: 2 state + 10 PAN + 1 entity + 1 checksum + 1 check digit)
            # Format: 27AABCU9603R1ZX (example)
            gstin_pattern = r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}'
            gstin_match = re.search(gstin_pattern, text)
            if gstin_match:
                entities["gstin"] = gstin_match.group(0)
            
            # PAN extraction (10 characters: 5 letters + 4 digits + 1 letter)
            # Format: AABCU9603R (example)
            pan_pattern = r'[A-Z]{5}\d{4}[A-Z]{1}'
            pan_match = re.search(pan_pattern, text)
            if pan_match:
                entities["pan"] = pan_match.group(0)
            
            # Amount pattern (Crores, Lakhs, etc.)
            amount_pattern = r'(?:Rs\.?\s*)?(\d+\.?\d*)\s*(Crores?|Lakhs?|Thousands?|Cr\.?|L\.?|K\.?)'
            for match in re.finditer(amount_pattern, text, re.IGNORECASE):
                try:
                    amount_value = float(match.group(1))
                    unit = match.group(2).lower()
                    
                    if 'crore' in unit or 'cr' in unit:
                        unit_name = "Crore"
                    elif 'lakh' in unit or 'l' in unit:
                        unit_name = "Lakh"
                    elif 'thousand' in unit or 'k' in unit:
                        unit_name = "Thousand"
                    else:
                        unit_name = unit
                    
                    entities["amounts"].append({
                        "value": amount_value,
                        "unit": unit_name
                    })
                except (ValueError, IndexError):
                    continue
            
            # Date patterns (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.)
            date_patterns = [
                r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # DD/MM/YYYY or DD-MM-YYYY
                r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # YYYY/MM/DD
                r'\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}',  # DD Month YYYY
            ]
            
            for pattern in date_patterns:
                entities["dates"].extend(re.findall(pattern, text, re.IGNORECASE))
            
            # Remove duplicates
            entities["dates"] = list(set(entities["dates"]))
            
        except Exception as e:
            logger.warning(f"Error extracting entities: {e}")
        
        return entities

    def _create_text_blocks(self, ocr_results: Any, detection_boxes: List) -> List[Dict[str, Any]]:
        """Create text blocks from detection results."""
        blocks = []
        
        try:
            # Create a block for each detection
            if detection_boxes:
                for i, box in enumerate(detection_boxes):
                    block = {
                        "block_num": i + 1,
                        "bbox": self._normalize_bbox(box),
                        "text": f"Text block {i + 1}",  # Will be populated from recognition
                        "confidence": 0.85
                    }
                    blocks.append(block)
        except Exception as e:
            logger.warning(f"Error creating text blocks: {e}")
        
        return blocks

    def _normalize_bbox(self, box: Any) -> List[int]:
        """Normalize bounding box to [x_min, y_min, x_max, y_max] format."""
        try:
            if isinstance(box, (list, tuple)):
                if len(box) == 4:
                    return list(map(int, box))
                elif len(box) == 2:
                    # Assume it's [[x1, y1], [x2, y2], ...]
                    points = np.array(box, dtype=np.int32)
                    x_min = int(np.min(points[:, 0]))
                    y_min = int(np.min(points[:, 1]))
                    x_max = int(np.max(points[:, 0]))
                    y_max = int(np.max(points[:, 1]))
                    return [x_min, y_min, x_max, y_max]
        except Exception as e:
            logger.warning(f"Error normalizing bbox: {e}")
        
        return [0, 0, 100, 100]  # Default bbox

    async def process_batch(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """
        Process multiple documents in batch.
        
        Args:
            file_paths: List of file paths to process.
            
        Returns:
            List of OCR results for each document.
        """
        results = []
        for file_path in file_paths:
            try:
                result = self.process_document(file_path)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                results.append({"error": str(e), "file": file_path})
        
        return results


if __name__ == "__main__":
    # Local testing only
    import sys
    
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.ocr <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    service = OCRService(device="cpu")
    result = service.process_document(image_path)
    
    print("\n=== OCR Results ===")
    print(f"Language: {result['language']}")
    print(f"Confidence: {result['confidence_score']}")
    print(f"\nExtracted Text:\n{result['text']}")
    print(f"\nExtracted Entities:")
    for key, value in result['extracted_entities'].items():
        if value:
            print(f"  {key}: {value}")
