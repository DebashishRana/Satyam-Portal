#!/usr/bin/env python
"""Test OCR with sensitive detection"""

import logging
logging.basicConfig(level=logging.WARNING)

from app.services.ocr import OCRService

image_path = r"C:\Users\simon\Documents\try.png"

print("=" * 60)
print("Testing with SENSITIVE detection...")
print("=" * 60)

service = OCRService(device='cpu', detection_sensitivity='sensitive')
result = service.process_document(image_path)

print(f"\nText extracted: {len(result['text'])} characters")
print(f"Text preview: {result['text'][:300] if result['text'] else '(EMPTY)'}")
print(f"Language: {result['language']}")
print(f"Confidence: {result['confidence_score']}")

if result['extracted_entities']['gstin']:
    print(f"GSTIN: {result['extracted_entities']['gstin']}")
if result['extracted_entities']['pan']:
    print(f"PAN: {result['extracted_entities']['pan']}")
if result['extracted_entities']['amounts']:
    print(f"Amounts: {result['extracted_entities']['amounts']}")
if result['extracted_entities']['dates']:
    print(f"Dates: {result['extracted_entities']['dates']}")

if not result['text']:
    print("\n⚠️  Still no text extracted. Possible reasons:")
    print("  1. Image may be mostly blank")
    print("  2. Text might be too small (<30 pixels)")
    print("  3. Text color/contrast not suitable for detection")
    print("  4. Image quality is too low")
    print("\nTip: Try with a document image with clear, readable text")
