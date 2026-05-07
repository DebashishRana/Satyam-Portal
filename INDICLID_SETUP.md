 # IndicLID Setup Guide

IndicLID is **not a PyPI package**—it must be downloaded manually from GitHub releases. This guide walks you through the setup process.

---

## **Step 1: Download IndicLID Model**

Choose one of the 3 model variants:

### **Option A: IndicLID-FTN (Recommended for Native Scripts)**
- **Best for:** Hindi, Tamil, Telugu, Kannada, Malayalam, etc. (all 24 Indian native scripts)
- **Accuracy:** 98%
- **Speed:** 30,000-47,000 sentences/second
- **Size:** 318 MB
- **Download:** [indiclid-ftn.zip](https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip)

### **Option B: IndicLID-FTR (For Romanized Text)**
- **Best for:** Roman script versions of Indian languages (e.g., "Namaste" instead of "नमस्ते")
- **Accuracy:** 63%
- **Speed:** 37,000 sentences/second
- **Size:** 357 MB
- **Download:** [indiclid-ftr.zip](https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftr.zip)

### **Option C: IndicLID-BERT (Highest Accuracy for Romanized)**
- **Best for:** High-accuracy detection of romanized text
- **Accuracy:** 80%
- **Speed:** 10 sentences/second (slower)
- **Size:** 1.4 GB
- **Download:** [indiclid-bert.zip](https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-bert.zip)

---

## **Step 2: Extract the Model**

### **Windows (PowerShell):**
```powershell
# Download (example with Option A)
Invoke-WebRequest -Uri "https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip" -OutFile "indiclid-ftn.zip"

# Extract to backend directory
Expand-Archive -Path "indiclid-ftn.zip" -DestinationPath "d:\Pycharm\satyam\Satyam-Portal\backend\IndicLID"

# Verify
Get-ChildItem "d:\Pycharm\satyam\Satyam-Portal\backend\IndicLID"
```

### **Linux/Mac:**
```bash
# Download
wget https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip

# Extract
unzip indiclid-ftn.zip -d ~/projects/satyam-portal/backend/IndicLID

# Verify
ls -la ~/projects/satyam-portal/backend/IndicLID
```

---

## **Step 3: Verify Setup**

The extracted directory should look like:
```
backend/IndicLID/
├── IndicLID.py
├── models/
│   ├── indiclid-ftn-ft.pkl
│   └── ...
├── config.json
└── ...
```

---

## **Step 4: Automatic Path Detection**

The `language_detector.py` will automatically search for the IndicLID model in these locations (in order):

1. **`backend/IndicLID/`** ← Recommended location
2. **`backend/models/IndicLID/`**
3. **`~/.indiclid/`** (home directory)

**No additional configuration needed!** Just extract to `backend/IndicLID/` and it will be auto-detected.

---

## **Step 5: Test the Integration**

Run this test to verify IndicLID is working:

```python
import sys
sys.path.insert(0, r'd:\Pycharm\satyam\Satyam-Portal\backend')

from app.services.language_detector import LanguageDetector, INDICLID_AVAILABLE

print(f"IndicLID Available: {INDICLID_AVAILABLE}")

if INDICLID_AVAILABLE:
    detector = LanguageDetector(use_indiclid=True)
    
    # Test Hindi
    result_hi = detector.detect("नमस्ते, यह हिंदी है।")
    print(f"Hindi: {result_hi}")
    
    # Test English
    result_en = detector.detect("Hello, this is English text.")
    print(f"English: {result_en}")
else:
    print("IndicLID not found. Using Unicode fallback (70-85% accuracy)")
```

---

## **Supported Languages**

IndicLID supports **47 language classes**:
- **24 Native Scripts:** Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Punjabi, Oriya, Assamese, Urdu, Sanskrit, Sindhi, Kashmiri, Konkani, Maithili, Dogri, Bodo, and others
- **21 Romanized Versions:** Roman script versions of the above languages
- **English** and **Other**

---

## **Fallback Behavior**

If IndicLID is not installed:
- ✅ The system **continues to work** with Unicode-based fallback detection
- ✅ Accuracy drops from **98%** (IndicLID) to **70-85%** (Unicode heuristic)
- ✅ No changes needed to API or code

---

## **Troubleshooting**

### **Model not found?**
```python
from app.services.language_detector import INDICLID_MODEL_PATH, INDICLID_AVAILABLE

print(f"Model Path: {INDICLID_MODEL_PATH}")
print(f"Available: {INDICLID_AVAILABLE}")
```

### **Check logs for path detection:**
When the application starts, check logs for:
```
INFO: IndicLID model found at: ...
# or
WARNING: IndicLID model not found. Download from: ...
```

### **Wrong Python path?**
Verify the extracted directory is at:
```
backend/IndicLID/IndicLID.py  ← This file should exist
```

---

## **Performance Comparison**

| Detection Method | Native Scripts | Romanized | Speed | Model Size |
|------------------|---|---|---|---|
| **IndicLID-FTN** (Recommended) | 98% | 63% | 30-47k sent/s | 318 MB |
| **IndicLID-BERT** | 98% | 80% | 10 sent/s | 1.4 GB |
| **Unicode Heuristic** (Fallback) | 70-85% | N/A | 100k+ sent/s | 0 MB |

---

## **References**

- **Paper:** [IndicLID - Arxiv](https://arxiv.org/abs/2305.15814)
- **GitHub:** [AI4Bharat/IndicLID](https://github.com/AI4Bharat/IndicLID)
- **Benchmark:** [Bhasha-Abhijnaanam](https://huggingface.co/datasets/ai4bharat/Bhasha-Abhijnaanam)
