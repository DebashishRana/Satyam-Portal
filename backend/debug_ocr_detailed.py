#!/usr/bin/env python
"""Debug OCR text extraction"""

import logging
import sys

# Set up verbose logging
logging.basicConfig(level=logging.DEBUG, format='%(levelname)s:%(name)s:%(message)s')

from app.services.ocr import OCRService

image_path = r"C:\Users\simon\Documents\try.png"

print(f"Processing: {image_path}\n")
service = OCRService(device='cpu')
result = service.process_document(image_path)

print("\n" + "="*60)
print("FINAL RESULT")
print("="*60)
print(f"Text length: {len(result['text'])} characters")
print(f"Text preview: {result['text'][:200] if result['text'] else '(EMPTY - no text extracted)'}")
print(f"Language detected: {result['language']}")
print(f"Confidence: {result['confidence_score']}")
print(f"Pages: {len(result['pages'])}")
if result['pages']:
    print(f"Page 1 text blocks: {len(result['pages'][0].get('blocks', []))}")

print("\nExtracted Entities:")
for key, value in result['extracted_entities'].items():
    if value:
        print(f"  {key}: {value}")
    else:
        print(f"  {key}: (not found)")
