"""
Language Detection Service using IndicLID and fallback methods.
IndicLID provides accurate language identification for all 22 Indian languages.

IndicLID Setup:
1. Download model from: https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip
2. Extract to: backend/IndicLID/ folder
3. Update INDICLID_MODEL_PATH below
"""

import logging
import os
import sys
from typing import Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

# Path to locally downloaded IndicLID model
INDICLID_MODEL_PATH = None
INDICLID_AVAILABLE = False

# Try to locate IndicLID model in standard locations
POSSIBLE_PATHS = [
    Path(__file__).parent.parent.parent / "IndicLID",  # backend/IndicLID/
    Path(__file__).parent.parent.parent / "models" / "IndicLID",  # backend/models/IndicLID/
    Path.home() / ".indiclid",  # ~/.indiclid/
]

for path in POSSIBLE_PATHS:
    if path.exists():
        INDICLID_MODEL_PATH = str(path)
        INDICLID_AVAILABLE = True
        logger.info(f"IndicLID model found at: {INDICLID_MODEL_PATH}")
        break

if not INDICLID_AVAILABLE:
    logger.warning(
        "IndicLID model not found. Download from:\n"
        "https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip\n"
        f"And extract to one of: {[str(p) for p in POSSIBLE_PATHS]}"
    )


# Mapping from IndicLID codes to normalized language codes and OCR engine
INDICLID_MAPPING = {
    "eng_Latn": {"code": "en", "name": "English", "engine": "tesseract"},
    "hin_Deva": {"code": "hi", "name": "Hindi", "engine": "indic_ocr"},
    "hin_Latn": {"code": "hi-latn", "name": "Hindi (Romanized)", "engine": "tesseract"},
    "ben_Beng": {"code": "bn", "name": "Bengali", "engine": "indic_ocr"},
    "ben_Latn": {"code": "bn-latn", "name": "Bengali (Romanized)", "engine": "tesseract"},
    "tam_Tamil": {"code": "ta", "name": "Tamil", "engine": "indic_ocr"},
    "tam_Latn": {"code": "ta-latn", "name": "Tamil (Romanized)", "engine": "tesseract"},
    "tel_Telu": {"code": "te", "name": "Telugu", "engine": "indic_ocr"},
    "tel_Latn": {"code": "te-latn", "name": "Telugu (Romanized)", "engine": "tesseract"},
    "kan_Knda": {"code": "kn", "name": "Kannada", "engine": "indic_ocr"},
    "kan_Latn": {"code": "kn-latn", "name": "Kannada (Romanized)", "engine": "tesseract"},
    "mal_Mlym": {"code": "ml", "name": "Malayalam", "engine": "indic_ocr"},
    "mal_Latn": {"code": "ml-latn", "name": "Malayalam (Romanized)", "engine": "tesseract"},
    "asm_Beng": {"code": "as", "name": "Assamese", "engine": "indic_ocr"},
    "guj_Gujr": {"code": "gu", "name": "Gujarati", "engine": "indic_ocr"},
    "mar_Deva": {"code": "mr", "name": "Marathi", "engine": "indic_ocr"},
    "pan_Guru": {"code": "pa", "name": "Punjabi", "engine": "indic_ocr"},
    "ori_Orya": {"code": "od", "name": "Odia", "engine": "indic_ocr"},
    "urd_Arab": {"code": "ur", "name": "Urdu", "engine": "indic_ocr"},
    "mni_Meti": {"code": "mni", "name": "Meitei", "engine": "indic_ocr"},
    "other": {"code": "other", "name": "Other", "engine": "tesseract"},
}


class LanguageDetector:
    """Language detection using IndicLID with Unicode fallback."""
    
    def __init__(self, use_indiclid: bool = True):
        self.model = None
        self.use_indiclid = use_indiclid and INDICLID_AVAILABLE
        self._initialized = False
        if self.use_indiclid:
            self._initialize_indiclid()
    
    def _initialize_indiclid(self):
        """Load IndicLID model from local directory."""
        if self._initialized:
            return
        
        if not INDICLID_MODEL_PATH:
            logger.warning("IndicLID model path not configured. Using Unicode fallback.")
            self.use_indiclid = False
            return
        
        try:
            logger.info(f"Loading IndicLID model from {INDICLID_MODEL_PATH}...")
            
            # Import IndicLID module from local path
            sys.path.insert(0, INDICLID_MODEL_PATH)
            from IndicLID import IndicLID  # From local directory
            
            # Load the model
            self.model = IndicLID.load_model(model_path=INDICLID_MODEL_PATH)
            self._initialized = True
            logger.info("IndicLID model loaded successfully")
            
        except Exception as e:
            logger.warning(f"IndicLID initialization failed: {e}. Using Unicode fallback.")
            logger.info(
                "To use IndicLID, download from:\n"
                "https://github.com/AI4Bharat/IndicLID/releases/download/v1.0/indiclid-ftn.zip\n"
                f"And extract to: {POSSIBLE_PATHS[0]}"
            )
            self.use_indiclid = False
    
    def detect(self, text: str) -> Tuple[str, float, str]:
        """Detect language. Returns (lang_code, confidence, indiclid_code)"""
        if not text or len(text.strip()) == 0:
            return "unknown", 0.0, "other"
        
        if self.use_indiclid:
            return self._detect_with_indiclid(text)
        return self._detect_with_unicode_heuristic(text)
    
    def _detect_with_indiclid(self, text: str) -> Tuple[str, float, str]:
        """Use IndicLID for detection."""
        try:
            if not self._initialized:
                self._initialize_indiclid()
            if not self.model:
                logger.debug("IndicLID model not available, using Unicode fallback")
                return self._detect_with_unicode_heuristic(text)
            
            # Call IndicLID model prediction
            predictions = self.model.predict(text, top_k=1)
            if predictions and len(predictions) > 0:
                indiclid_code, confidence = predictions[0]
                if indiclid_code in INDICLID_MAPPING:
                    lang_code = INDICLID_MAPPING[indiclid_code]["code"]
                    logger.debug(f"IndicLID: {indiclid_code} ({confidence:.1%})")
                    return lang_code, confidence, indiclid_code
            
            logger.debug("No IndicLID prediction found, using Unicode fallback")
            return self._detect_with_unicode_heuristic(text)
            
        except Exception as e:
            logger.error(f"IndicLID inference error: {e}. Using Unicode fallback.")
            return self._detect_with_unicode_heuristic(text)
    
    def _detect_with_unicode_heuristic(self, text: str) -> Tuple[str, float, str]:
        """Unicode range-based fallback."""
        script_counts = {
            "devanagari": 0, "bengali": 0, "tamil": 0, "telugu": 0,
            "kannada": 0, "malayalam": 0, "gujarati": 0, "oriya": 0,
            "gurmukhi": 0, "perso_arabic": 0, "latin": 0,
        }
        
        for char in text:
            code = ord(char)
            if 0x0900 <= code <= 0x097F: script_counts["devanagari"] += 1
            elif 0x0980 <= code <= 0x09FF: script_counts["bengali"] += 1
            elif 0x0B80 <= code <= 0x0BFF: script_counts["tamil"] += 1
            elif 0x0C00 <= code <= 0x0C7F: script_counts["telugu"] += 1
            elif 0x0C80 <= code <= 0x0CFF: script_counts["kannada"] += 1
            elif 0x0D00 <= code <= 0x0D7F: script_counts["malayalam"] += 1
            elif 0x0A80 <= code <= 0x0AFF: script_counts["gujarati"] += 1
            elif 0x0B00 <= code <= 0x0B7F: script_counts["oriya"] += 1
            elif 0x0A00 <= code <= 0x0A7F: script_counts["gurmukhi"] += 1
            elif 0x0600 <= code <= 0x06FF: script_counts["perso_arabic"] += 1
            elif (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
                script_counts["latin"] += 1
        
        dominant_script = max(script_counts, key=script_counts.get)
        dominant_count = script_counts[dominant_script]
        total_chars = sum(script_counts.values())
        
        script_to_lang = {
            "devanagari": "hi", "bengali": "bn", "tamil": "ta", "telugu": "te",
            "kannada": "kn", "malayalam": "ml", "gujarati": "gu", "oriya": "od",
            "gurmukhi": "pa", "perso_arabic": "ur", "latin": "en",
        }
        
        if total_chars == 0:
            return "unknown", 0.0, "other"
        
        lang_code = script_to_lang.get(dominant_script, "en")
        confidence = dominant_count / total_chars
        return lang_code, confidence, "fallback"
    
    def get_ocr_engine(self, lang_code: str) -> str:
        """Get recommended OCR engine for language."""
        for indiclid_code, info in INDICLID_MAPPING.items():
            if info["code"] == lang_code:
                return info["engine"]
        return "tesseract"
