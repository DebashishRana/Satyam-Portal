# Language-Aware OCR Service Implementation

## Overview

The Language-Aware OCR Service provides intelligent document processing with language-specific OCR engines:

- **English**: Tesseract OCR (higher accuracy for English text extraction)
- **Indic Languages**: IndicPhotoOCR (Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Punjabi, Odia, Assamese, Urdu, Meitei)

## Architecture

### Service Classes

1. **LanguageAwareOCRService** (Primary Implementation)
   - Location: `backend/app/services/ocr_language_aware.py`
   - Full implementation with language detection and routing
   - Supports both Tesseract and IndicPhotoOCR engines

2. **OCRService** (Backward Compatible Alias)
   - Location: `backend/app/services/ocr.py`
   - Simple wrapper that imports LanguageAwareOCRService
   - Maintains backward compatibility with existing code

### Processing Pipeline

```
1. Input Image/PDF
   ↓
2. Validate file format (.jpg, .png, .bmp, .tiff, .webp)
   ↓
3. Initialize IndicPhotoOCR (if not already done)
   ↓
4. Language Detection (using IndicPhotoOCR's identifier on full image)
   ↓
5. Route to Appropriate Engine:
   ├─ If English → Use Tesseract OCR
   └─ If Indic Language → Use IndicPhotoOCR
   ↓
6. Text Extraction
   ↓
7. Entity Extraction (GSTIN, PAN, amounts, dates)
   ↓
8. Return Structured Result
```

## Usage

### Basic Usage

```python
from app.services.ocr import OCRService

# Initialize service
service = OCRService(
    device="cpu",  # or "cuda:0" for GPU
    confidence_threshold=0.7,
    detection_sensitivity="normal"  # or "strict", "sensitive"
)

# Process a single document
result = service.process_document("path/to/image.jpg")

print(f"Language: {result['language']}")
print(f"OCR Engine: {result['ocr_engine']}")
print(f"Extracted Text:\n{result['text']}")
print(f"Entities: {result['extracted_entities']}")
```

### Batch Processing

```python
import asyncio

# Process multiple documents
file_paths = [
    "path/to/image1.jpg",
    "path/to/image2.png",
    "path/to/image3.jpg"
]

results = asyncio.run(service.process_batch(file_paths))

for result in results:
    print(f"File: {result.get('file', 'N/A')}")
    print(f"Language: {result['language']}")
    print(f"Text: {result['text'][:100]}...")
```

## Supported Languages

### English
- Engine: Tesseract OCR
- Detection: Automatic (via IndicPhotoOCR identifier)
- Confidence: Generally 85%+

### Indian Languages (via IndicPhotoOCR)
- Hindi (Devanagari) - Code: `hi`
- Bengali - Code: `bn`
- Tamil - Code: `ta`
- Telugu - Code: `te`
- Kannada - Code: `kn`
- Malayalam - Code: `ml`
- Gujarati - Code: `gu`
- Marathi - Code: `mr`
- Punjabi - Code: `pa`
- Odia - Code: `od`
- Assamese - Code: `as`
- Urdu - Code: `ur`
- Meitei - Code: `mni`

## Configuration Parameters

### OCRService Constructor

```python
OCRService(
    device: str = "cpu",
    confidence_threshold: float = 0.7,
    detection_sensitivity: str = "normal"
)
```

**Parameters:**
- `device`: Processing device
  - `"cpu"`: CPU-based processing (slower but universal)
  - `"cuda:0"`: GPU-based processing (faster on NVIDIA GPUs)
  
- `confidence_threshold`: Minimum confidence score (0.0-1.0)
  - Filters out low-confidence OCR results
  
- `detection_sensitivity`: Text detection sensitivity
  - `"strict"`: Reduces false positives (score_map_thresh=0.85)
  - `"normal"`: Balanced detection (default)
  - `"sensitive"`: Detects more text regions (score_map_thresh=0.3)

## Output Format

### Success Response

```python
{
    "text": "Extracted text content",
    "confidence_score": 0.87,
    "page_count": 1,
    "language": "en",  # or "hi", "ta", "te", etc.
    "ocr_engine": "tesseract",  # or "indic_ocr"
    "extracted_entities": {
        "gstin": "27AABCU9603R1ZX",  # if found
        "pan": "AABCU9603R",  # if found
        "amounts": [
            {"value": 1000.0, "unit": "Crore"},
            {"value": 50.0, "unit": "Lakh"}
        ],
        "dates": ["31/12/2023", "01/01/2024"]
    },
    "pages": [
        {
            "page_num": 1,
            "text": "Page-specific text",
            "confidence": 0.87,
            "blocks": [
                {
                    "block_num": 1,
                    "bbox": [10, 20, 100, 150],
                    "text": "Text block content",
                    "confidence": 0.88
                }
            ]
        }
    ]
}
```

### Error Response

```python
{
    "text": "",
    "confidence_score": 0.0,
    "page_count": 0,
    "language": "unknown",
    "ocr_engine": "tesseract",
    "extracted_entities": {
        "gstin": None,
        "pan": None,
        "amounts": [],
        "dates": []
    },
    "pages": [],
    "error": "Error description here"
}
```

## Entity Extraction

### GSTIN (Goods and Services Tax Identification Number)
- Format: 15 characters
- Pattern: 2 state code + 10 PAN + 1 entity + 1 checksum + 1 check digit
- Example: `27AABCU9603R1ZX`

### PAN (Permanent Account Number)
- Format: 10 characters
- Pattern: 5 letters + 4 digits + 1 letter
- Example: `AABCU9603R`

### Amounts
- Supports: Crores, Lakhs, Thousands
- Format: Number + Unit (with or without "Rs.")
- Examples: `Rs. 1000 Crores`, `50 Lakhs`, `5000`

### Dates
- Formats: 
  - DD/MM/YYYY
  - DD-MM-YYYY
  - YYYY/MM/DD
  - DD Month YYYY
- Examples: `31/12/2023`, `01-01-2024`, `2023-12-31`

## Dependencies

### Required Python Packages
- `IndicPhotoOCR==1.3.1` - Indic language OCR
- `pytesseract==0.3.10` - Tesseract OCR Python wrapper
- `Pillow==10.2.0` - Image processing
- `opencv-python==4.8.1.78` - Computer vision
- `numpy==1.26.3` - Numerical computing

### System Dependencies
- **Tesseract OCR**: Required for English text extraction
  - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
  - Linux: `sudo apt-get install tesseract-ocr`
  - Mac: `brew install tesseract`

## Installation & Setup

### 1. Install Python Packages
```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Tesseract (System Level)

**Windows:**
- Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
- Run installer (e.g., `tesseract-ocr-w64-setup-v5.3.1.exe`)
- Default path: `C:\Program Files\Tesseract-OCR`

**Linux:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**Mac:**
```bash
brew install tesseract
```

### 3. Configure Tesseract Path (if needed)
```python
import pytesseract
pytesseract.pytesseract.pytesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### 4. Verify Installation
```bash
cd backend
python test_language_aware_ocr.py
```

## Performance Considerations

### English OCR (Tesseract)
- **Speed**: Fast (typically 100-500ms per page)
- **Accuracy**: High (85-95% for clear documents)
- **Memory**: Low (~50MB)
- **Best for**: Documents with clear English text

### Indic Language OCR (IndicPhotoOCR)
- **Speed**: Moderate (500-2000ms per page)
- **Accuracy**: High (80-90% for clear documents)
- **Memory**: High (~2GB for models)
- **Best for**: Indian language documents

### Optimization Tips
1. Use CPU mode for batch processing (more stable)
2. Adjust `detection_sensitivity` based on document quality
3. Pre-process images (enhance contrast, remove noise)
4. Batch multiple documents for better throughput

## Troubleshooting

### Issue: "Tesseract is not installed"
**Solution**: Install Tesseract system package (see Installation section)

### Issue: "IndicPhotoOCR import failed"
**Solution**: Run `pip install IndicPhotoOCR==1.3.1` and restart Python

### Issue: "Permission denied" on Tesseract
**Solution**: Check Tesseract installation path and ensure proper permissions

### Issue: Low detection sensitivity
**Solution**: Use `detection_sensitivity="sensitive"` when creating service

### Issue: Out of memory errors
**Solution**: Process documents in smaller batches or reduce image resolution

## Testing

### Unit Tests
```bash
cd backend
python test_language_aware_ocr.py
```

### Integration Test with Sample Image
```python
from app.services.ocr import OCRService

service = OCRService(device="cpu")
result = service.process_document("path/to/test/image.jpg")

assert result["language"] in ["en", "hi", "bn", "ta", "te", "kn", "ml"]
assert result["confidence_score"] >= 0.0
assert len(result["text"]) > 0 or "error" in result
```

## Future Enhancements

1. **PDF Support**: Convert PDF pages to images automatically
2. **Table Detection**: Integrate Nemotron for table structure detection
3. **Multi-page Processing**: Handle multi-page documents with page-wise results
4. **Advanced Layout Analysis**: Understand document structure (columns, sections)
5. **Custom Entity Recognition**: Add support for domain-specific entities
6. **Confidence Scoring**: Per-word confidence scores from Tesseract
7. **Language-specific Optimizations**: Fine-tune for regional dialects
8. **Caching**: Cache OCR results for identical inputs

## Related Files

- **ocr_language_aware.py**: Main implementation (700+ lines)
- **ocr.py**: Backward-compatible wrapper
- **test_language_aware_ocr.py**: Verification test script
- **requirements.txt**: Dependencies list
- **IndicPhotoOCR/detection/textbpn/cfglib/config.py**: TextBPN configuration
- **IndicPhotoOCR/detection/textbpn/network/textnet.py**: Model loading (modified)

## Support & Debugging

### Enable Debug Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
service = OCRService()
```

### Check Available Methods
```python
service = OCRService()
print(dir(service))  # List all methods
```

### Verify Language Detection
```python
result = service.process_document("image.jpg")
print(f"Detected Language: {result['language']}")
print(f"OCR Engine Used: {result['ocr_engine']}")
```

---

**Last Updated**: 2024-12-31
**Version**: 1.0.0
**Status**: Production Ready
