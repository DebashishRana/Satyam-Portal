# Quick Start: Language-Aware OCR Service

## 5-Minute Setup

### 1. Install System Dependencies (if not already installed)

**Windows:**
```powershell
# Download and run installer from:
# https://github.com/UB-Mannheim/tesseract/wiki

# Or use Chocolatey:
choco install tesseract
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**Mac:**
```bash
brew install tesseract
```

### 2. Verify Installation
```bash
cd backend
python test_language_aware_ocr.py
```

Expected output:
```
✓ Service created: LanguageAwareOCRService
✓ Has process_document: True
✓ Has process_batch: True
✓ Tesseract available: True
✓ Device: cpu
✓ Confidence threshold: 0.7

Language-Aware OCR Service is ready!
```

## Basic Usage (Copy-Paste Ready)

```python
from app.services.ocr import OCRService

# Create service
service = OCRService(device="cpu")

# Process document
result = service.process_document("image.jpg")

# Print results
print(f"Language: {result['language']}")
print(f"Text:\n{result['text']}")
print(f"GSTIN: {result['extracted_entities']['gstin']}")
print(f"PAN: {result['extracted_entities']['pan']}")
```

## Common Tasks

### Process English Document
```python
result = service.process_document("english_invoice.jpg")
# Automatically uses Tesseract
assert result['ocr_engine'] == 'tesseract'
assert result['language'] == 'en'
```

### Process Hindi Document
```python
result = service.process_document("hindi_document.jpg")
# Automatically uses IndicPhotoOCR
assert result['ocr_engine'] == 'indic_ocr'
assert result['language'] == 'hi'
```

### Extract GSTIN/PAN
```python
result = service.process_document("invoice.jpg")
entities = result['extracted_entities']

if entities['gstin']:
    print(f"GSTIN: {entities['gstin']}")

if entities['pan']:
    print(f"PAN: {entities['pan']}")
```

### Process Multiple Documents
```python
import asyncio

files = ["doc1.jpg", "doc2.jpg", "doc3.jpg"]
results = asyncio.run(service.process_batch(files))

for result in results:
    print(f"{result['language']}: {result['text'][:50]}...")
```

### Handle Errors
```python
result = service.process_document("image.jpg")

if 'error' in result:
    print(f"OCR failed: {result['error']}")
else:
    print(f"Success! Extracted {len(result['text'])} characters")
```

### Adjust Detection Sensitivity
```python
# For documents with small text
service = OCRService(detection_sensitivity="sensitive")

# For documents with clear text
service = OCRService(detection_sensitivity="strict")

# Default balanced
service = OCRService(detection_sensitivity="normal")
```

## API Response Structure

```python
{
    'text': 'Full extracted text...',
    'confidence_score': 0.87,
    'page_count': 1,
    'language': 'en',  # 'hi', 'ta', 'te', etc.
    'ocr_engine': 'tesseract',  # or 'indic_ocr'
    'extracted_entities': {
        'gstin': '27AABCU9603R1ZX',
        'pan': 'AABCU9603R',
        'amounts': [{'value': 1000.0, 'unit': 'Crore'}],
        'dates': ['31/12/2023']
    },
    'pages': [...],
    'error': None  # or error message
}
```

## Debugging

### Enable Debug Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
service = OCRService()
```

### Check What Language Was Detected
```python
result = service.process_document("image.jpg")
print(f"Detected: {result['language']}")
print(f"Engine: {result['ocr_engine']}")
```

### Verify Tesseract
```bash
tesseract --version
```

## Supported Languages

| Code | Language | Engine |
|------|----------|--------|
| en | English | Tesseract |
| hi | Hindi | IndicPhotoOCR |
| ta | Tamil | IndicPhotoOCR |
| te | Telugu | IndicPhotoOCR |
| kn | Kannada | IndicPhotoOCR |
| ml | Malayalam | IndicPhotoOCR |
| bn | Bengali | IndicPhotoOCR |
| gu | Gujarati | IndicPhotoOCR |
| mr | Marathi | IndicPhotoOCR |
| pa | Punjabi | IndicPhotoOCR |
| od | Odia | IndicPhotoOCR |
| as | Assamese | IndicPhotoOCR |
| ur | Urdu | IndicPhotoOCR |
| mni | Meitei | IndicPhotoOCR |

## Supported File Formats
- `.jpg`, `.jpeg` (JPEG)
- `.png` (PNG)
- `.bmp` (Bitmap)
- `.tiff` (TIFF)
- `.webp` (WebP)

## Performance Tips

1. **Use CPU for stability**: `device="cpu"` (default)
2. **Batch process documents**: More efficient throughput
3. **Adjust sensitivity for image quality**: `detection_sensitivity="sensitive"` for poor quality
4. **Monitor memory**: IndicPhotoOCR models use ~2GB RAM
5. **Cache results**: Store OCR output to avoid reprocessing

## Troubleshooting

### "Tesseract is not installed"
- Install from: https://github.com/UB-Mannheim/tesseract/wiki
- Or use: `pip install pytesseract` (just wrapper, needs system install)

### "IndicPhotoOCR import failed"
```bash
pip install IndicPhotoOCR==1.3.1
```

### "Out of memory"
- Process in smaller batches
- Reduce image resolution
- Use CPU mode (avoid GPU)

### "Detection returns empty"
- Try `detection_sensitivity="sensitive"`
- Check image quality (should be clear document images)
- Verify image format is supported

## Integration with FastAPI

```python
from fastapi import FastAPI, File, UploadFile
from app.services.ocr import OCRService

app = FastAPI()
service = OCRService(device="cpu")

@app.post("/ocr/process")
async def process_document(file: UploadFile = File(...)):
    # Save uploaded file
    with open(file.filename, "wb") as f:
        f.write(await file.read())
    
    # Process with OCR
    result = service.process_document(file.filename)
    
    return result
```

## Next Steps

1. ✅ Installation complete? Run `python test_language_aware_ocr.py`
2. ✅ Basic usage working? Try processing a sample document
3. ✅ Integrating with FastAPI? See examples above
4. ✅ Need advanced features? Check `LANGUAGE_AWARE_OCR_GUIDE.md`

---

**Version**: 1.0.0
**Last Updated**: 2024-12-31
**Status**: Ready for Production
