"""
Deterministic Evaluation Engine (Rule-based matching)
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class EvaluationEngine:
    """
    Core evaluation engine implementing deterministic matching.
    
    This implements:
    - Tender Insight Engine (TIE) logic for criteria extraction
    - Deterministic Matcher with explicit rules (PyRete-style)
    - Risk analytics for flagging anomalies
    """
    
    def __init__(self):
        self.rules_engine = RuleEngine()
    
    async def evaluate_bidder(self, tender_id: str, bidder_id: str) -> Dict[str, Any]:
        """
        Evaluate a bidder against tender criteria.
        
        Returns:
            Dict with evaluation results, criterion-by-criterion status,
            confidence scores, and risk flags.
        """
        logger.info(f"Evaluating bidder {bidder_id} for tender {tender_id}")
        
        # In production, fetch from database
        # For demo, use mock data
        
        # Get tender criteria (mock)
        tender_criteria = self._get_mock_tender_criteria()
        
        # Get bidder documents/extracted data (mock)
        bidder_data = self._get_mock_bidder_data(bidder_id)
        
        # Evaluate each criterion
        criterion_results = []
        all_passed = True
        low_confidence_flags = []
        
        for criterion in tender_criteria:
            result = await self._evaluate_criterion(criterion, bidder_data)
            criterion_results.append(result)
            
            if result["status"] == "REVIEW":
                all_passed = False
                low_confidence_flags.append(criterion["criterion_id"])
            elif result["status"] == "FAIL":
                all_passed = False
        
        # Calculate overall confidence
        confidence_scores = [r["confidence_score"] for r in criterion_results]
        overall_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
        
        # Generate risk flags
        risk_flags = self._generate_risk_flags(tender_criteria, bidder_data, criterion_results)
        
        # Generate verification cards
        verification_cards = self._generate_verification_cards(criterion_results)
        
        return {
            "tender_id": tender_id,
            "bidder_id": bidder_id,
            "all_passed": all_passed,
            "criterion_results": criterion_results,
            "confidence_score": round(overall_confidence, 2),
            "risk_flags": risk_flags,
            "verification_cards": verification_cards,
            "evaluated_at": datetime.utcnow().isoformat()
        }
    
    async def _evaluate_criterion(self, criterion: Dict[str, Any], bidder_data: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a single criterion against bidder data."""
        
        criterion_id = criterion["criterion_id"]
        category = criterion["category"]
        description = criterion["description"]
        threshold = criterion.get("threshold_value")
        operator = criterion.get("comparison_operator", ">=")
        mandatory = criterion.get("mandatory", True)
        
        # Extract bidder value for this criterion
        bidder_value = self._extract_bidder_value(category, criterion, bidder_data)
        
        # If no data found and mandatory, mark for review
        if bidder_value is None and mandatory:
            return {
                "criterion_id": criterion_id,
                "description": description,
                "category": category,
                "status": "REVIEW",
                "extracted_value": None,
                "required_value": str(threshold) if threshold else None,
                "comparison_operator": operator,
                "confidence_score": 0.0,
                "reason_code": "MISSING_EVIDENCE",
                "evidence_document_id": None,
                "evidence_page": None,
                "evidence_bbox": None,
                "extracted_text": None
            }
        
        # Perform comparison
        status, confidence = self._compare_values(bidder_value, threshold, operator)
        
        # Low confidence handling (No-Silent-Rejection policy)
        if confidence < 0.85:
            status = "REVIEW"
            reason_code = "LOW_CONFIDENCE"
        else:
            reason_code = "MATCH" if status == "PASS" else "BELOW_THRESHOLD"
        
        return {
            "criterion_id": criterion_id,
            "description": description,
            "category": category,
            "status": status,
            "extracted_value": str(bidder_value) if bidder_value else None,
            "required_value": str(threshold) if threshold else None,
            "comparison_operator": operator,
            "confidence_score": round(confidence, 2),
            "reason_code": reason_code,
            "evidence_document_id": bidder_data.get("document_id"),
            "evidence_page": 1,
            "evidence_bbox": [100, 100, 300, 150],  # Mock bbox
            "extracted_text": f"Extracted: {bidder_value}" if bidder_value else None
        }
    
    def _extract_bidder_value(self, category: str, criterion: Dict[str, Any], bidder_data: Dict[str, Any]) -> Optional[Any]:
        """Extract the relevant value from bidder data for comparison."""
        
        if category == "financial":
            if "turnover" in criterion["criterion_id"].lower():
                return bidder_data.get("financial", {}).get("average_annual_turnover")
            elif "net_worth" in criterion["description"].lower():
                return bidder_data.get("financial", {}).get("net_worth")
        
        elif category == "compliance":
            if "gst" in criterion["description"].lower():
                gst_data = bidder_data.get("compliance", {}).get("gst", {})
                return gst_data.get("gstin") if gst_data.get("is_valid_format") else None
            elif "pan" in criterion["description"].lower():
                pan_data = bidder_data.get("compliance", {}).get("pan", {})
                return pan_data.get("pan") if pan_data.get("is_valid_format") else None
        
        elif category == "experience":
            return bidder_data.get("experience", {}).get("total_project_value")
        
        return None
    
    def _compare_values(self, actual: Any, expected: Any, operator: str) -> tuple:
        """
        Compare values and return (status, confidence).
        
        Returns:
            tuple: (PASS/FAIL/REVIEW, confidence_score)
        """
        if actual is None or expected is None:
            return "REVIEW", 0.0
        
        try:
            actual_val = float(actual)
            expected_val = float(expected)
            
            if operator == ">=":
                passed = actual_val >= expected_val
            elif operator == "<=":
                passed = actual_val <= expected_val
            elif operator == "==":
                passed = actual_val == expected_val
            elif operator == ">":
                passed = actual_val > expected_val
            elif operator == "<":
                passed = actual_val < expected_val
            else:
                return "REVIEW", 0.5
            
            # Calculate confidence based on how close the value is to threshold
            if passed:
                confidence = min(0.95, 0.85 + (actual_val - expected_val) / expected_val * 0.1)
            else:
                confidence = max(0.7, 0.85 - (expected_val - actual_val) / expected_val * 0.1)
            
            return ("PASS" if passed else "FAIL", round(confidence, 2))
            
        except (ValueError, TypeError):
            return "REVIEW", 0.5
    
    def _generate_risk_flags(self, criteria: List[Dict], bidder_data: Dict, results: List[Dict]) -> List[str]:
        """Generate risk flags based on evaluation patterns."""
        flags = []
        
        # Check for low confidence overall
        low_conf_count = sum(1 for r in results if r["confidence_score"] < 0.85)
        if low_conf_count > len(results) * 0.3:
            flags.append("HIGH_PROPORTION_LOW_CONFIDENCE")
        
        # Check for contradictory data
        review_count = sum(1 for r in results if r["status"] == "REVIEW")
        if review_count > 2:
            flags.append("MULTIPLE_REVIEW_ITEMS")
        
        # Check for missing mandatory documents
        missing_mandatory = any(
            r["status"] == "REVIEW" and r["reason_code"] == "MISSING_EVIDENCE"
            for r in results
        )
        if missing_mandatory:
            flags.append("MISSING_MANDATORY_DOCUMENTS")
        
        return flags
    
    def _generate_verification_cards(self, results: List[Dict]) -> List[Dict]:
        """Generate verification cards for REVIEW items."""
        cards = []
        for result in results:
            if result["status"] in ["REVIEW", "FAIL"]:
                cards.append({
                    "criterion_id": result["criterion_id"],
                    "requires_review": True,
                    "review_reason": result["reason_code"],
                    "evidence_location": {
                        "document_id": result.get("evidence_document_id"),
                        "page": result.get("evidence_page"),
                        "bbox": result.get("evidence_bbox")
                    }
                })
        return cards
    
    def _get_mock_tender_criteria(self) -> List[Dict[str, Any]]:
        """Mock tender criteria for demo."""
        return [
            {
                "criterion_id": "FIN01",
                "category": "financial",
                "description": "Minimum average annual turnover of 5 Cr in last 3 years",
                "threshold_value": 500,  # In lakhs
                "comparison_operator": ">=",
                "mandatory": True
            },
            {
                "criterion_id": "FIN02",
                "category": "financial",
                "description": "Minimum net worth of 2 Crores",
                "threshold_value": 200,  # In lakhs
                "comparison_operator": ">=",
                "mandatory": True
            },
            {
                "criterion_id": "COMP01",
                "category": "compliance",
                "description": "Valid GST Registration",
                "threshold_value": None,
                "comparison_operator": "EXISTS",
                "mandatory": True
            },
            {
                "criterion_id": "COMP02",
                "category": "compliance",
                "description": "Valid PAN Card",
                "threshold_value": None,
                "comparison_operator": "EXISTS",
                "mandatory": True
            },
            {
                "criterion_id": "EXP01",
                "category": "experience",
                "description": "Minimum project experience value of 10 Crores",
                "threshold_value": 1000,  # In lakhs
                "comparison_operator": ">=",
                "mandatory": True
            }
        ]
    
    def _get_mock_bidder_data(self, bidder_id: str) -> Dict[str, Any]:
        """Mock bidder data for demo."""
        return {
            "bidder_id": bidder_id,
            "document_id": f"doc_{bidder_id}",
            "financial": {
                "average_annual_turnover": 520,  # 5.2 Cr in lakhs - PASSES
                "net_worth": 180,  # 1.8 Cr - FAILS (< 2 Cr)
                "currency": "INR Lakhs"
            },
            "compliance": {
                "gst": {
                    "gstin": "27AABCU9603R1ZX",
                    "is_valid_format": True,
                    "is_valid_checksum": True
                },
                "pan": {
                    "pan": "AABCU9603R",
                    "is_valid_format": True
                }
            },
            "experience": {
                "total_project_value": 1200,  # 12 Cr in lakhs - PASSES
                "projects_count": 5
            }
        }

class RuleEngine:
    """
    Simple rule engine for deterministic evaluation.
    
    In production, this would use PyRete or similar for complex rule chains.
    """
    
    def __init__(self):
        self.rules = []
    
    def add_rule(self, condition, action):
        """Add a rule to the engine."""
        self.rules.append({"condition": condition, "action": action})
    
    def evaluate(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Evaluate all rules against data."""
        results = []
        for rule in self.rules:
            if rule["condition"](data):
                result = rule["action"](data)
                results.append(result)
        return results
