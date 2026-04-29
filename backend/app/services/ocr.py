"""
OCR Service for Document Processing
"""

import logging
from typing import Dict, Any, Optional, List
import asyncio
from PIL import Image
import pytesseract
import re

logger = logging.getLogger(__name__)

class OCRService:
    """Service for performing OCR on uploaded documents."""
    
    def __init__(self, confidence_threshold: float = 0.85):
        self.confidence_threshold = confidence_threshold
    
    async def process_document(self, file_path: str) -> Dict[str, Any]:
        """
        Process a document and extract text with confidence scores.
        
        In production, this would use:
        - Bhashini/AI4Bharat for Indic scripts
        - LayoutLMv3 for layout understanding
        - NemotronOCR or AWS Textract for high-accuracy English OCR
        """
        logger.info(f"Processing document: {file_path}")
        
        try:
            # For demo, we'll simulate OCR processing
            # In production, integrate with actual OCR engines
            
            await asyncio.sleep(1)  # Simulate processing time
            
            # Mock OCR result
            ocr_result = {
                "text": self._extract_mock_text(file_path),
                "confidence_score": 0.92,
                "page_count": 1,
                "language": "en",
                "extracted_entities": self._extract_entities(file_path),
                "pages": [
                    {
                        "page_num": 1,
                        "text": "Sample extracted text from document",
                        "confidence": 0.92,
                        "blocks": [
                            {
                                "text": "Financial Statement FY 2023-24",
                                "bbox": [100, 100, 500, 150],
                                "confidence": 0.95
                            }
                        ]
                    }
                ]
            }
            
            logger.info(f"OCR completed for {file_path}")
            return ocr_result
            
        except Exception as e:
            logger.error(f"OCR processing failed for {file_path}: {str(e)}")
            raise
    
    def _extract_mock_text(self, file_path: str) -> str:
        """Extract mock text based on file type."""
        if "gst" in file_path.lower():
            return "GST Registration Certificate\nGSTIN: 27AABCU9603R1ZX\nLegal Name: ABC Corporation Pvt Ltd\nTrade Name: ABC Corp\nDate: 01/04/2019"
        elif "pan" in file_path.lower():
            return "Permanent Account Number\nPAN: AABCU9603R\nName: ABC CORPORATION PVT LTD\nDate of Issue: 15/03/2015"
        elif "financial" in file_path.lower():
            return "Balance Sheet FY 2023-24\nTurnover: 15.5 Crores\nNet Worth: 8.2 Crores\nProfit: 2.1 Crores"
        else:
            return "Sample document text extracted via OCR"
    
    def _extract_entities(self, file_path: str) -> Dict[str, Any]:
        """Extract named entities from document."""
        entities = {
            "gstin": None,
            "pan": None,
            "amounts": [],
            "dates": [],
            "organization_name": None
        }
        
        # GSTIN extraction (15 characters: 2 state + 10 PAN + 1 entity + 1 checksum)
        gstin_pattern = r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}'
        
        # PAN extraction (10 characters: 5 letters + 4 digits + 1 letter)
        pan_pattern = r'[A-Z]{5}\d{4}[A-Z]{1}'
        
        # Amount pattern (Crores, Lakhs, etc.)
        amount_pattern = r'(\d+\.?\d*)\s*(Crores?|Lakhs?|Cr\.?|L\.?)'
        
        # Date patterns
        date_pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
        
        text = self._extract_mock_text(file_path)
        
        # Extract GSTIN
        gstin_match = re.search(gstin_pattern, text)
        if gstin_match:
            entities["gstin"] = gstin_match.group(0)
        
        # Extract PAN
        pan_match = re.search(pan_pattern, text)
        if pan_match:
            entities["pan"] = pan_match.group(0)
        
        # Extract amounts
        for match in re.finditer(amount_pattern, text):
            amount_value = float(match.group(1))
            unit = match.group(2).lower()
            if 'crore' in unit or 'cr' in unit:
                entities["amounts"].append({"value": amount_value, "unit": "Crore"})
            elif 'lakh' in unit or 'l' in unit:
                entities["amounts"].append({"value": amount_value, "unit": "Lakh"})
        
        # Extract dates
        entities["dates"] = re.findall(date_pattern, text)
        
        return entities
    
    async def process_batch(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """Process multiple documents in batch."""
        tasks = [self.process_document(fp) for fp in file_paths]
        return await asyncio.gather(*tasks, return_exceptions=True)
