"""
Document Processor for Structured Data Extraction
"""

import logging
from typing import Dict, Any, Optional, List
import re

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Process OCR output and extract structured data."""
    
    def __init__(self):
        self.validation_rules = self._load_validation_rules()
    
    async def extract_structured_data(self, ocr_text: str, document_type: str) -> Dict[str, Any]:
        """
        Extract structured data based on document type.
        
        This implements the Bidder Evidence Miner (BEM) logic:
        - Normalizes document format
        - Extracts financial data
        - Validates compliance documents
        """
        logger.info(f"Extracting structured data for document type: {document_type}")
        
        extractors = {
            "gst_registration": self._extract_gst_data,
            "pan_card": self._extract_pan_data,
            "financial_statement": self._extract_financial_data,
            "experience_certificate": self._extract_experience_data,
            "general": self._extract_general_data
        }
        
        extractor = extractors.get(document_type, self._extract_general_data)
        return await extractor(ocr_text)
    
    async def _extract_gst_data(self, text: str) -> Dict[str, Any]:
        """Extract data from GST certificate."""
        gstin_pattern = r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}'
        gstin = re.search(gstin_pattern, text)
        
        # Validate GSTIN checksum (simplified)
        is_valid = False
        if gstin:
            is_valid = self._validate_gstin(gstin.group(0))
        
        return {
            "document_type": "GST Registration",
            "gstin": gstin.group(0) if gstin else None,
            "is_valid_format": bool(gstin),
            "is_valid_checksum": is_valid,
            "legal_name": self._extract_field(text, ["Legal Name", "Name"]),
            "trade_name": self._extract_field(text, ["Trade Name", "Trade"]),
            "registration_date": self._extract_date(text),
            "extracted_fields": {
                "raw_text_sample": text[:200]
            }
        }
    
    async def _extract_pan_data(self, text: str) -> Dict[str, Any]:
        """Extract data from PAN card."""
        pan_pattern = r'[A-Z]{5}\d{4}[A-Z]{1}'
        pan = re.search(pan_pattern, text)
        
        return {
            "document_type": "PAN Card",
            "pan": pan.group(0) if pan else None,
            "is_valid_format": bool(pan),
            "name": self._extract_field(text, ["Name", "Permanent Account Number"]),
            "father_name": self._extract_field(text, ["Father's Name", "Father Name"]),
            "date_of_birth": self._extract_date(text),
            "extracted_fields": {
                "raw_text_sample": text[:200]
            }
        }
    
    async def _extract_financial_data(self, text: str) -> Dict[str, Any]:
        """Extract financial data from balance sheets."""
        
        # Extract turnover data
        turnover_pattern = r'(?:Turnover|Revenue|Sales).*?(\d+\.?\d*)\s*(Crores?|Lakhs?)'
        turnovers = []
        for match in re.finditer(turnover_pattern, text, re.IGNORECASE):
            value = float(match.group(1))
            unit = match.group(2)
            multiplier = 100 if 'crore' in unit.lower() else 1
            turnovers.append(value * multiplier)
        
        # Extract net worth
        net_worth_pattern = r'(?:Net Worth|Net Assets).*?(\d+\.?\d*)\s*(Crores?|Lakhs?)'
        net_worth_match = re.search(net_worth_pattern, text, re.IGNORECASE)
        net_worth = None
        if net_worth_match:
            value = float(net_worth_match.group(1))
            unit = net_worth_match.group(2)
            multiplier = 100 if 'crore' in unit.lower() else 1
            net_worth = value * multiplier
        
        # Calculate 3-year average if multiple years present
        avg_turnover = sum(turnovers) / len(turnovers) if turnovers else None
        
        return {
            "document_type": "Financial Statement",
            "turnover_last_3_years": turnovers,
            "average_annual_turnover": avg_turnover,
            "net_worth": net_worth,
            "currency": "INR Lakhs",
            "extracted_fields": {
                "turnover_count": len(turnovers),
                "years_covered": len(turnovers),
                "raw_text_sample": text[:500]
            }
        }
    
    async def _extract_experience_data(self, text: str) -> Dict[str, Any]:
        """Extract project experience data."""
        
        # Project value extraction
        value_pattern = r'(?:Project Value|Contract Value|Amount).*?(\d+\.?\d*)\s*(Crores?|Lakhs?)'
        values = []
        for match in re.finditer(value_pattern, text, re.IGNORECASE):
            value = float(match.group(1))
            unit = match.group(2)
            multiplier = 100 if 'crore' in unit.lower() else 1
            values.append(value * multiplier)
        
        # Date extraction for project completion
        dates = re.findall(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text)
        
        return {
            "document_type": "Experience Certificate",
            "projects_count": len(values),
            "total_project_value": sum(values) if values else None,
            "currency": "INR Lakhs",
            "completion_dates": dates[:5],  # First 5 dates
            "extracted_fields": {
                "raw_text_sample": text[:500]
            }
        }
    
    async def _extract_general_data(self, text: str) -> Dict[str, Any]:
        """General data extraction for unknown document types."""
        return {
            "document_type": "General",
            "extracted_text_length": len(text),
            "extracted_fields": {
                "raw_text_sample": text[:500]
            }
        }
    
    def _extract_field(self, text: str, field_names: List[str]) -> Optional[str]:
        """Extract a field value by trying multiple possible field names."""
        for field_name in field_names:
            pattern = rf'{field_name}[\s:]*([^\n]+)'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract date from text."""
        date_pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
        match = re.search(date_pattern, text)
        return match.group(0) if match else None
    
    def _validate_gstin(self, gstin: str) -> bool:
        """Validate GSTIN checksum (simplified)."""
        if len(gstin) != 15:
            return False
        # Simplified validation - check format only
        import re
        pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$'
        return bool(re.match(pattern, gstin))
    
    def _load_validation_rules(self) -> Dict[str, Any]:
        """Load domain-specific validation rules."""
        return {
            "gstin": {
                "length": 15,
                "pattern": r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$'
            },
            "pan": {
                "length": 10,
                "pattern": r'^[A-Z]{5}\d{4}[A-Z]{1}$'
            }
        }
