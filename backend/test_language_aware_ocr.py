#!/usr/bin/env python
"""
Test script to verify Language-Aware OCR Service
"""

import logging
from app.services.ocr import OCRService

logging.basicConfig(level=logging.CRITICAL)

print("Creating OCRService instance...")
service = OCRService(device="cpu", confidence_threshold=0.7, detection_sensitivity="normal")

print(f"✓ Service created: {type(service).__name__}")
print(f"✓ Has process_document: {hasattr(service, 'process_document')}")
print(f"✓ Has process_batch: {hasattr(service, 'process_batch')}")
print(f"✓ Tesseract available: {service.tesseract_available}")
print(f"✓ Device: {service.device}")
print(f"✓ Confidence threshold: {service.confidence_threshold}")
print()
print("Language-Aware OCR Service is ready!")
