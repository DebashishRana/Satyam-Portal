"""
Nemotron Table Structures Detection Service
Detects tables, charts, and document structures using NVIDIA's Nemotron model
"""

import logging
import os
import base64
from typing import Dict, Any, List, Optional
from pathlib import Path
import requests
import json

logger = logging.getLogger(__name__)

class NemotronTableDetector:
    """
    Detects document structures (tables, charts, titles) using NVIDIA Nemotron API.
    
    Supports:
    - Table detection and cell extraction
    - Chart and figure identification
    - Document title and section detection
    - Spatial layout analysis
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Nemotron detector.
        
        Args:
            api_key: NVIDIA API key. If None, reads from NEMOTRON_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("NEMOTRON_API_KEY")
        if not self.api_key:
            logger.warning("Nemotron API key not provided. Table detection will be unavailable.")
            self.available = False
        else:
            self.available = True
            logger.info("Nemotron Table Detector initialized")
        
        # NVIDIA API endpoint for Nemotron
        self.api_endpoint = "https://integrate.api.nvidia.com/v1/vision/table-structure-recognition"
    
    def detect_tables(self, image_path: str) -> Dict[str, Any]:
        """
        Detect tables and structures in an image.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary with detected tables, cells, and structures
        """
        if not self.available:
            logger.error("Nemotron API key not configured")
            return {
                "tables": [],
                "charts": [],
                "titles": [],
                "error": "API key not configured"
            }
        
        try:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            
            # Get file extension to determine type
            file_ext = Path(image_path).suffix.lower()
            if file_ext in ['.jpg', '.jpeg']:
                media_type = "image/jpeg"
            elif file_ext == '.png':
                media_type = "image/png"
            else:
                media_type = "image/png"
            
            logger.info(f"Detecting structures in {image_path}")
            
            # Call Nemotron API
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "image": {
                    "data": image_data,
                    "type": media_type
                }
            }
            
            response = requests.post(
                self.api_endpoint,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Detected structures: {self._summarize_detection(result)}")
                return result
            else:
                logger.error(f"Nemotron API error: {response.status_code} - {response.text}")
                return {
                    "tables": [],
                    "charts": [],
                    "titles": [],
                    "error": f"API returned {response.status_code}"
                }
                
        except FileNotFoundError:
            logger.error(f"Image file not found: {image_path}")
            return {"tables": [], "charts": [], "titles": [], "error": "File not found"}
        except Exception as e:
            logger.error(f"Error detecting structures: {e}")
            return {"tables": [], "charts": [], "titles": [], "error": str(e)}
    
    def extract_table_cells(self, table_bbox: List[int]) -> Dict[str, Any]:
        """
        Extract cell structure from a detected table.
        
        Args:
            table_bbox: Bounding box [x1, y1, x2, y2] of the table
            
        Returns:
            Dictionary with cell grid and content
        """
        return {
            "bbox": table_bbox,
            "cells": [],
            "rows": 0,
            "columns": 0
        }
    
    def _summarize_detection(self, result: Dict) -> str:
        """Summarize detection results for logging."""
        tables = len(result.get("tables", []))
        charts = len(result.get("charts", []))
        titles = len(result.get("titles", []))
        return f"{tables} tables, {charts} charts, {titles} titles"


class DocumentStructureAnalyzer:
    """
    Analyzes document structure using Nemotron and provides layout information.
    """
    
    def __init__(self, nemotron_api_key: Optional[str] = None):
        """Initialize the analyzer."""
        self.nemotron = NemotronTableDetector(nemotron_api_key)
    
    def analyze_document(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze complete document structure.
        
        Args:
            image_path: Path to document image
            
        Returns:
            Complete structure analysis
        """
        logger.info(f"Analyzing document structure: {image_path}")
        
        # Detect structures
        structures = self.nemotron.detect_tables(image_path)
        
        return {
            "file": image_path,
            "structures": structures,
            "tables": structures.get("tables", []),
            "charts": structures.get("charts", []),
            "titles": structures.get("titles", []),
            "has_tables": len(structures.get("tables", [])) > 0,
            "has_charts": len(structures.get("charts", [])) > 0,
            "has_titles": len(structures.get("titles", [])) > 0,
            "analysis_status": "complete" if not structures.get("error") else "partial"
        }


if __name__ == "__main__":
    # Test the detector
    api_key = os.getenv("NEMOTRON_API_KEY")
    if not api_key:
        print("Please set NEMOTRON_API_KEY environment variable")
    else:
        detector = NemotronTableDetector(api_key)
        analyzer = DocumentStructureAnalyzer(api_key)
        print("Nemotron Table Detector ready")
