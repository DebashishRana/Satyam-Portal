#!/usr/bin/env python
"""Analyze what detection model sees"""

import cv2
import numpy as np
from IndicPhotoOCR.ocr import OCR
import logging

logging.basicConfig(level=logging.WARNING)

image_path = r"C:\Users\simon\Documents\try.png"

print("Loading image...")
img = cv2.imread(image_path)
print(f"Image shape: {img.shape}")

# Check image content
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
print(f"Grayscale range: {gray.min()} to {gray.max()}")
print(f"Grayscale mean: {gray.mean():.1f}")

# Check if image is mostly blank/white
white_pixels = np.sum(gray > 200)
black_pixels = np.sum(gray < 50)
print(f"White pixels (>200): {white_pixels} ({100*white_pixels/gray.size:.1f}%)")
print(f"Black pixels (<50): {black_pixels} ({100*black_pixels/gray.size:.1f}%)")

# Try OCR detection
print("\nRunning text detection...")
ocr = OCR(verbose=False, identifier_lang="auto", device="cpu")
detections = ocr.detect(image_path)

print(f"\nDetection results:")
print(f"  Type: {type(detections)}")
print(f"  Content: {detections}")
print(f"  Number of text regions found: {len(detections) if isinstance(detections, list) else 'N/A'}")

if isinstance(detections, list) and len(detections) > 0:
    print(f"\nDetected regions:")
    for i, bbox in enumerate(detections):
        print(f"  Region {i}: {bbox}")
else:
    print("\n⚠️  NO TEXT REGIONS DETECTED")
    print("\nPossible reasons:")
    print("  1. Image is blank or has no readable text")
    print("  2. Text is very small (<20 pixels)")
    print("  3. Text color blends with background")
    print("  4. Image quality is too low")
    print("  5. Text is rotated or distorted")
