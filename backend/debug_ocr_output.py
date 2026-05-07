#!/usr/bin/env python
"""Debug OCR output format"""

from IndicPhotoOCR.ocr import OCR
import json
import logging

logging.basicConfig(level=logging.WARNING)

print("Initializing OCR...")
ocr_sys = OCR(verbose=False, identifier_lang="auto", device="cpu")

print("Running OCR on image...")
result = ocr_sys.ocr(r"C:\Users\simon\Documents\Screenshot 2026-05-04 115151.png")

print("\n=== OCR Output Debug ===")
print("Type of result:", type(result))
print("Result length:", len(result) if hasattr(result, '__len__') else 'N/A')

print("\nFirst 10 items:")
if isinstance(result, list):
    for i, item in enumerate(result[:10]):
        print(f"  [{i}] type={type(item).__name__}, len={len(item) if hasattr(item, '__len__') else 'N/A'}")
        if isinstance(item, (list, tuple)) and len(item) > 0:
            print(f"       first element: {item[0]}")
elif isinstance(result, dict):
    print(f"Keys: {list(result.keys())}")
    for key in list(result.keys())[:5]:
        val = result[key]
        print(f"  {key}: type={type(val).__name__}, value={val if not isinstance(val, list) else f'list({len(val)})'}")
else:
    print(f"Result: {result}")

print("\nFull result (first 500 chars):")
print(str(result)[:500])
