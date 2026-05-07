#!/usr/bin/env python
"""Check if image can be loaded"""

import cv2
import os

image_path = r"C:\Users\simon\Documents\try.png"

print(f"File exists: {os.path.exists(image_path)}")
print(f"File size: {os.path.getsize(image_path)} bytes")

img = cv2.imread(image_path)
if img is not None:
    print(f"Image loaded successfully!")
    print(f"Image shape (height, width, channels): {img.shape}")
    print(f"Image dtype: {img.dtype}")
    print(f"Image min/max pixel values: {img.min()} to {img.max()}")
else:
    print("ERROR: Failed to load image!")
