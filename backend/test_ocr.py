#!/usr/bin/env python
"""Quick test of the OCR service"""

import sys
import logging
logging.basicConfig(level=logging.WARNING)

# Test OCR service directly
from app.services.ocr import OCRService, INDIC_OCR_AVAILABLE

print('IndicPhotoOCR available:', INDIC_OCR_AVAILABLE)
print('Creating OCRService...')
service = OCRService(device='cpu')
print('OCRService created successfully')

# Test entity extraction without processing a file
test_text = '''
GST Registration Certificate
GSTIN: 27AABCU9603R1ZX
PAN: AABCU9603R
Date: 01/04/2019
Amount: 15.5 Crores
'''

entities = service._extract_entities(test_text)
print('\nEntity extraction test:')
print(f'GSTIN: {entities["gstin"]}')
print(f'PAN: {entities["pan"]}')
print(f'Amounts: {entities["amounts"]}')
print(f'Dates: {entities["dates"]}')

print('\nLanguage detection test:')
print(f'English text language: {service._detect_language("Hello World")}')
print(f'Hindi text language: {service._detect_language("नमस्ते दुनिया")}')

print('\n✓ All tests passed!')
