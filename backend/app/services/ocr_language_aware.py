"""
Language-aware OCR Service using EasyOCR.
"""

import logging
import json
import os
import re
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
    logging.warning(f"EasyOCR import failed: {e}. EasyOCR fallback will be limited.")
    easyocr = None  # type: ignore[assignment]
    EASYOCR_AVAILABLE = False

SarvamAI = None  # type: ignore[assignment]
SARVAM_SDK_AVAILABLE = False

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


class LanguageAwareOCRService:
    """
    Service for performing OCR on documents using EasyOCR.

    The legacy Sarvam/Tesseract/Indic OCR paths are intentionally not used in the active flow.
    """

    def __init__(self, device: str = "cpu", confidence_threshold: float = 0.7, detection_sensitivity: str = "normal"):
        """
        Initialize the Language-Aware OCR Service.
        
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
        self.tesseract_available = False
        self.sarvam_available = False
        self.sarvam_client = None
        self._initialized = False
        self._easyocr_languages = ["en", "hi", "bn", "ta", "te", "kn", "ml"]
        
        logger.info(f"LanguageAwareOCRService initialized with device={device}, threshold={confidence_threshold}, sensitivity={detection_sensitivity}")
        logger.info("EasyOCR available: %s", self.easyocr_available)

    def _initialize_ocr(self) -> bool:
        """Lazy initialization of EasyOCR on first use."""
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
        Process a document and extract text with Sarvam AI first, then EasyOCR.
        
        Args:
            file_path: Path to the image file to process.
            
        Returns:
            Dictionary with extracted text, confidence scores, language info, and entities.
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
                return {
                    "text": extracted_text,
                    "confidence_score": 0.75 if extracted_text else 0.0,
                    "page_count": 1 if extracted_text else 0,
                    "language": self._detect_language_from_text(extracted_text),
                    "ocr_engine": "docx-text-extraction",
                    "extracted_entities": self._extract_entities(extracted_text),
                    "pages": [
                        {
                            "page_num": 1,
                            "text": extracted_text,
                            "confidence": 0.75,
                            "blocks": [],
                        }
                    ] if extracted_text else [],
                }

            if not self._initialize_ocr():
                raise RuntimeError("No OCR system available (EasyOCR could not be initialized)")

            return self._process_with_easyocr(file_path)
            
        except Exception as e:
            logger.error(f"OCR processing failed for {file_path}: {str(e)}", exc_info=True)
            return self._create_error_response(str(e), engine="easyocr")

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
            extracted_text, pages = self._extract_sarvam_zip(output_zip)
            avg_confidence = _safe_metric_value(metrics) or 0.9

            return {
                "text": extracted_text,
                "confidence_score": avg_confidence,
                "page_count": len(pages) or 1,
                "language": self._detect_language_from_text(extracted_text),
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

    def _extract_sarvam_zip(self, zip_path: Path) -> tuple[str, List[Dict[str, Any]]]:
        extracted_text_parts: List[str] = []
        pages: List[Dict[str, Any]] = []

        with zipfile.ZipFile(zip_path) as archive:
            for name in archive.namelist():
                lower = name.lower()
                if lower.endswith("/"):
                    continue
                with archive.open(name) as handle:
                    content = handle.read().decode("utf-8", errors="ignore")
                if lower.endswith((".md", ".markdown", ".txt")):
                    extracted_text_parts.append(content)
                    pages.append({"page_num": len(pages) + 1, "text": content.strip(), "confidence": 0.9, "blocks": []})
                elif lower.endswith((".html", ".htm")):
                    cleaned = _strip_html_tags(content)
                    extracted_text_parts.append(cleaned)
                    pages.append({"page_num": len(pages) + 1, "text": cleaned, "confidence": 0.9, "blocks": []})
                elif lower.endswith(".json") and not pages:
                    try:
                        data = json.loads(content)
                        if isinstance(data, dict) and isinstance(data.get("pages"), list):
                            for idx, page in enumerate(data["pages"], start=1):
                                page_text = page.get("text") or page.get("markdown") or page.get("content") or ""
                                pages.append({
                                    "page_num": idx,
                                    "text": page_text,
                                    "confidence": _safe_metric_value(page) or 0.9,
                                    "blocks": page.get("blocks") or [],
                                })
                                extracted_text_parts.append(str(page_text))
                    except Exception:
                        continue

        return "\n\n".join(part.strip() for part in extracted_text_parts if part.strip()), pages

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
                        "bbox": self._normalize_bbox(bbox),
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
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        language = self._detect_language_from_text(extracted_text)
        entities = self._extract_entities(extracted_text)

        return {
            "text": extracted_text,
            "confidence_score": avg_confidence,
            "page_count": len(pages),
            "language": language,
            "ocr_engine": "easyocr",
            "extracted_entities": entities,
            "pages": pages,
        }

    def _detect_language_with_identifier(self, file_path: str) -> str:
        """
        Legacy language detection helper retained for compatibility.
        
        Returns language code like 'en', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', etc.
        """
        try:
            if not self.ocr_system or not hasattr(self.ocr_system, 'identifier'):
                return "unknown"
            
            # Use the initialized OCR system's identifier if available.
            language = self.ocr_system.identifier.identify(file_path, lang='auto')
            logger.debug(f"Identifier detected language: {language}")
            
            # Normalize language names
            language_lower = str(language).lower().strip()
            
            # Map common language names to codes
            language_map = {
                'english': 'en',
                'english (en)': 'en',
                'hindi': 'hi',
                'bengali': 'bn',
                'tamil': 'ta',
                'telugu': 'te',
                'kannada': 'kn',
                'malayalam': 'ml',
                'gujarati': 'gu',
                'marathi': 'mr',
                'punjabi': 'pa',
                'odia': 'od',
                'assamese': 'as',
                'urdu': 'ur',
                'meitei': 'mni'
            }
            
            for key, code in language_map.items():
                if key in language_lower:
                    return code
            
            return language_lower
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            return "unknown"

    def _process_with_tesseract(self, file_path: str) -> Dict[str, Any]:
        """
        Legacy Tesseract OCR helper retained for compatibility.
        
        Args:
            file_path: Path to the image file.
            
        Returns:
            OCR result dictionary with Tesseract results.
        """
        logger.info(f"Processing with Tesseract OCR: {file_path}")
        
        try:
            if not self.tesseract_available:
                raise RuntimeError("Tesseract OCR not available")
            
            # Open image with PIL
            image = Image.open(file_path)
            
            # Extract text with Tesseract (English)
            extracted_text = pytesseract.image_to_string(
                image,
                lang='eng',
                config=self._tesseract_config
            )
            
            # Extract detailed data (includes bounding boxes and confidence)
            details = pytesseract.image_to_data(image, lang='eng', output_type='dict')
            
            # Calculate confidence from detailed results
            confidences = [int(conf) for conf in details['conf'] if int(conf) > 0]
            avg_confidence = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.85
            
            logger.info(f"Tesseract extracted {len(extracted_text)} characters with {avg_confidence:.2f} confidence")
            
            # Extract entities from text
            entities = self._extract_entities(extracted_text)
            
            # Build response
            ocr_result = {
                "text": extracted_text.strip(),
                "confidence_score": avg_confidence,
                "page_count": 1,
                "language": "en",
                "ocr_engine": "tesseract",
                "extracted_entities": entities,
                "pages": [
                    {
                        "page_num": 1,
                        "text": extracted_text.strip(),
                        "confidence": avg_confidence,
                        "blocks": self._create_tesseract_blocks(details)
                    }
                ]
            }
            
            return ocr_result
            
        except Exception as e:
            logger.error(f"Tesseract OCR failed for {file_path}: {e}", exc_info=True)
            return self._create_error_response(str(e), engine="tesseract")

    def _process_with_indic_ocr(self, file_path: str) -> Dict[str, Any]:
        """
        Legacy OCR helper retained for compatibility.
        
        Args:
            file_path: Path to the image file.
            
        Returns:
            OCR result dictionary with legacy OCR results.
        """
        logger.info(f"Processing with legacy OCR fallback: {file_path}")
        
        try:
            if not self.ocr_system:
                raise RuntimeError("Legacy OCR system not initialized")
            
            # Perform text detection
            logger.debug(f"Detecting text regions in {file_path}")
            detections = self.ocr_system.detect(file_path)
            
            # Handle both dict and list returns from detect()
            if isinstance(detections, dict):
                detection_boxes = detections.get('detections', [])
            elif isinstance(detections, list):
                detection_boxes = detections
            else:
                detection_boxes = []
            
            logger.info(f"Text regions detected: {len(detection_boxes)}")
            
            # Perform text recognition
            logger.debug(f"Recognizing text in {len(detection_boxes)} detected regions")
            ocr_results = self.ocr_system.ocr(file_path)
            
            # Extract and process results
            extracted_text = self._extract_text_from_results(ocr_results)
            language = self._detect_language_from_text(extracted_text)
            entities = self._extract_entities(extracted_text)
            
            # Build response
            ocr_result = {
                "text": extracted_text,
                "confidence_score": self._calculate_average_confidence(ocr_results),
                "page_count": 1,
                "language": language,
                "ocr_engine": "indic_ocr",
                "extracted_entities": entities,
                "pages": [
                    {
                        "page_num": 1,
                        "text": extracted_text,
                        "confidence": self._calculate_average_confidence(ocr_results),
                        "blocks": self._create_text_blocks(ocr_results, detection_boxes)
                    }
                ]
            }
            
            logger.info(f"Legacy OCR completed for {file_path}. Extracted {len(extracted_text)} characters.")
            return ocr_result
            
        except Exception as e:
            logger.error(f"Legacy OCR processing failed for {file_path}: {str(e)}", exc_info=True)
            return self._create_error_response(str(e), engine="legacy_ocr")

    def _extract_text_from_results(self, ocr_results: Any) -> str:
        """Extract plain text from legacy OCR results."""
        if not ocr_results:
            return ""
        
        text_parts = []
        
        try:
            # Handle legacy OCR output format
            if isinstance(ocr_results, list):
                for item in ocr_results:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, dict):
                        for key in ['text', 'txt', 'content', 'result']:
                            if key in item:
                                text_parts.append(str(item[key]))
                                break
                    elif isinstance(item, (list, tuple)):
                        for sub_item in item:
                            if isinstance(sub_item, str):
                                text_parts.append(sub_item)
                            elif isinstance(sub_item, dict) and 'txt' in sub_item:
                                text_parts.append(sub_item['txt'])
            elif isinstance(ocr_results, dict):
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

    def _create_tesseract_blocks(self, details: Dict) -> List[Dict[str, Any]]:
        """Create text blocks from Tesseract detailed output."""
        blocks = []
        
        try:
            # Group by paragraph (level=3)
            paragraphs = {}
            for i, level in enumerate(details['level']):
                if level == 3 and details['text'][i].strip():  # Paragraph level
                    block_num = details['block_num'][i]
                    if block_num not in paragraphs:
                        paragraphs[block_num] = {
                            'block_num': block_num,
                            'text': [],
                            'bbox': [details['left'][i], details['top'][i], 
                                    details['left'][i] + details['width'][i],
                                    details['top'][i] + details['height'][i]],
                            'confidence': 0.0,
                            'confidences': []
                        }
                    
                    paragraphs[block_num]['text'].append(details['text'][i])
                    conf = int(details['conf'][i]) / 100.0
                    if conf > 0:
                        paragraphs[block_num]['confidences'].append(conf)
            
            # Create blocks from paragraphs
            for para_data in paragraphs.values():
                block = {
                    "block_num": para_data['block_num'],
                    "bbox": para_data['bbox'],
                    "text": " ".join(para_data['text']),
                    "confidence": (sum(para_data['confidences']) / len(para_data['confidences'])) 
                                   if para_data['confidences'] else 0.85
                }
                blocks.append(block)
        except Exception as e:
            logger.warning(f"Error creating Tesseract blocks: {e}")
        
        return blocks

    def _create_text_blocks(self, ocr_results: Any, detection_boxes: List) -> List[Dict[str, Any]]:
        """Create text blocks from legacy OCR detection results."""
        blocks = []
        
        try:
            if detection_boxes:
                for i, box in enumerate(detection_boxes):
                    block = {
                        "block_num": i + 1,
                        "bbox": self._normalize_bbox(box),
                        "text": f"Text block {i + 1}",
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
                    points = np.array(box, dtype=np.int32)
                    x_min = int(np.min(points[:, 0]))
                    y_min = int(np.min(points[:, 1]))
                    x_max = int(np.max(points[:, 0]))
                    y_max = int(np.max(points[:, 1]))
                    return [x_min, y_min, x_max, y_max]
        except Exception as e:
            logger.warning(f"Error normalizing bbox: {e}")
        
        return [0, 0, 100, 100]

    def _calculate_average_confidence(self, ocr_results: Any) -> float:
        """Calculate average confidence score from OCR results."""
        return 0.85  # Default confidence for legacy OCR

    def _detect_language_from_text(self, text: str) -> str:
        """Detect language from text content using Unicode ranges."""
        if not text:
            return "unknown"
        
        for char in text:
            code = ord(char)
            # Hindi (Devanagari)
            if 0x0900 <= code <= 0x097F:
                return "hi"
            # Bengali
            elif 0x0980 <= code <= 0x09FF:
                return "bn"
            # Tamil
            elif 0x0B80 <= code <= 0x0BFF:
                return "ta"
            # Telugu
            elif 0x0C00 <= code <= 0x0C7F:
                return "te"
            # Kannada
            elif 0x0C80 <= code <= 0x0CFF:
                return "kn"
            # Malayalam
            elif 0x0D00 <= code <= 0x0D7F:
                return "ml"
            # Gujarati
            elif 0x0A80 <= code <= 0x0AFF:
                return "gu"
            # Marathi (same as Hindi)
            elif 0x0900 <= code <= 0x097F:
                return "mr"
        
        return "en"

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
            # GSTIN extraction (15 characters)
            gstin_pattern = r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}'
            gstin_match = re.search(gstin_pattern, text)
            if gstin_match:
                entities["gstin"] = gstin_match.group(0)
            
            # PAN extraction (10 characters)
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
            
            # Date patterns
            date_patterns = [
                r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
                r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',
                r'\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}',
            ]
            
            for pattern in date_patterns:
                entities["dates"].extend(re.findall(pattern, text, re.IGNORECASE))
            
            entities["dates"] = list(set(entities["dates"]))
            
        except Exception as e:
            logger.warning(f"Error extracting entities: {e}")
        
        return entities

    def _create_error_response(self, error_msg: str, engine: str = "unknown") -> Dict[str, Any]:
        """Create a standardized error response."""
        return {
            "text": "",
            "confidence_score": 0.0,
            "page_count": 0,
            "language": "unknown",
            "ocr_engine": engine,
            "extracted_entities": {
                "gstin": None,
                "pan": None,
                "amounts": [],
                "dates": []
            },
            "pages": [],
            "error": error_msg
        }

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
        print("Usage: python -m app.services.ocr_language_aware <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    service = LanguageAwareOCRService(device="cpu")
    result = service.process_document(image_path)
    
    print("\n=== OCR Results ===")
    print(f"Language: {result['language']}")
    print(f"OCR Engine: {result.get('ocr_engine', 'unknown')}")
    print(f"Confidence: {result['confidence_score']}")
    print(f"\nExtracted Text:\n{result['text']}")
    print(f"\nExtracted Entities:")
    for key, value in result['extracted_entities'].items():
        if value:
            print(f"  {key}: {value}")
