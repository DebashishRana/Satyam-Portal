"""Minimal audit event helper for procurement decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def audit_log(
    user: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "user": user,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }


EXAMPLE_EVENTS = [
    audit_log(
        user="evaluator.rk",
        action="bidder_evaluation_viewed",
        entity_type="bidder_submission",
        entity_id="BID-22",
        details={"tender_id": "TENDER-7"},
    ),
    audit_log(
        user="committee.chair",
        action="criterion_overridden",
        entity_type="eligibility_criterion",
        entity_id="turnover-threshold",
        details={"reason": "Verified via uploaded balance sheet"},
    ),
    audit_log(
        user="procurement.officer",
        action="clarification_query_raised",
        entity_type="document_request",
        entity_id="DOC-101",
        details={"reason": "Missing GST certificate page"},
    ),
]
