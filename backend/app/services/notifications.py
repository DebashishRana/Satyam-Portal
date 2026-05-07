"""
Event-driven bidder notification service.

Testmail.app is an inbox/testing service, not a transactional sender. In
testmail mode this service routes outbound messages to a Testmail inbox address
when SMTP settings are available, and always records a notification log that can
be retried or verified later.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from email.message import EmailMessage
import uuid
from typing import Any, Dict, List, Optional

from app.core.config import settings


STATUS_ALIASES = {
    "submitted": "submitted",
    "under_scrutiny": "under_scrutiny",
    "preliminary_scrutiny": "under_scrutiny",
    "technical_evaluation": "under_technical_review",
    "under_technical_review": "under_technical_review",
    "clarification_requested": "clarification_requested",
    "technically_qualified": "technical_qualified",
    "technical_qualified": "technical_qualified",
    "technically_not_qualified": "technical_not_qualified",
    "technical_not_qualified": "technical_not_qualified",
    "financial_evaluation": "under_financial_review",
    "under_financial_review": "under_financial_review",
    "accepted": "accepted",
    "rejected": "rejected",
    "awarded": "awarded",
    "not_awarded": "not_awarded",
    "manual_override": "manual_override",
}


NOTIFICATION_RULES: Dict[str, Dict[str, str]] = {
    "submitted": {
        "template": "bid_submitted_v1",
        "subject": "Bid submitted: {tender_reference}",
        "next_action": "Track processing status in the bidder portal.",
    },
    "under_scrutiny": {
        "template": "bid_under_scrutiny_v1",
        "subject": "Bid under scrutiny: {tender_reference}",
        "next_action": "No action is needed unless a clarification is requested.",
    },
    "under_technical_review": {
        "template": "bid_under_technical_review_v1",
        "subject": "Technical review started: {tender_reference}",
        "next_action": "Keep your contact details active for any clarification.",
    },
    "clarification_requested": {
        "template": "bid_clarification_requested_v1",
        "subject": "Clarification requested: {tender_reference}",
        "next_action": "Open the bidder portal and upload the requested answer or document.",
    },
    "technical_qualified": {
        "template": "bid_technical_qualified_v1",
        "subject": "Technically qualified: {tender_reference}",
        "next_action": "Wait for financial review or further instructions.",
    },
    "technical_not_qualified": {
        "template": "bid_technical_not_qualified_v1",
        "subject": "Technical evaluation outcome: {tender_reference}",
        "next_action": "Review the reason in the portal. Manual review may be available if permitted by the tender.",
    },
    "under_financial_review": {
        "template": "bid_under_financial_review_v1",
        "subject": "Financial review started: {tender_reference}",
        "next_action": "No action is needed unless the evaluation team contacts you.",
    },
    "accepted": {
        "template": "bid_accepted_v1",
        "subject": "Bid accepted: {tender_reference}",
        "next_action": "Check the portal for next steps and officer contact details.",
    },
    "rejected": {
        "template": "bid_rejected_v1",
        "subject": "Bid outcome: {tender_reference}",
        "next_action": "Review the outcome and manual review availability in the bidder portal.",
    },
    "awarded": {
        "template": "bid_awarded_v1",
        "subject": "Award update: {tender_reference}",
        "next_action": "Follow the award instructions and contact the officer if needed.",
    },
    "not_awarded": {
        "template": "bid_not_awarded_v1",
        "subject": "Award outcome: {tender_reference}",
        "next_action": "Review the final status in the bidder portal.",
    },
    "manual_override": {
        "template": "bid_manual_override_v1",
        "subject": "Evaluation updated by officer: {tender_reference}",
        "next_action": "Review the updated result and officer comment in the portal.",
    },
}


@dataclass
class NotificationMessage:
    to_email: str
    subject: str
    body: str
    template_name: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NotificationLog:
    notification_id: str
    dedupe_key: str
    bidder_id: str
    bidder_email: str
    tender_id: str
    tender_reference: str
    submission_id: str
    status: str
    template_name: str
    subject: str
    body: str
    provider: str
    send_status: str
    created_at: str
    last_attempt_at: str
    sent_at: Optional[str] = None
    attempts: int = 1
    error_message: Optional[str] = None
    provider_response: Dict[str, Any] = field(default_factory=dict)


NOTIFICATION_LOGS: List[NotificationLog] = []


class EmailProvider:
    name = "base"

    def send(self, message: NotificationMessage) -> Dict[str, Any]:
        raise NotImplementedError


class ConsoleEmailProvider(EmailProvider):
    name = "console"

    def send(self, message: NotificationMessage) -> Dict[str, Any]:
        print(f"[notification:{message.template_name}] To: {message.to_email} | Subject: {message.subject}")
        print(message.body)
        return {"delivered": False, "mode": "console", "message": "Logged locally; no SMTP configured."}


class SmtpEmailProvider(EmailProvider):
    name = "smtp"

    def send(self, message: NotificationMessage) -> Dict[str, Any]:
        # Import lazily so the API can boot even when the stdlib SMTP stack
        # is unavailable in the runtime bundle.
        import smtplib

        email = EmailMessage()
        email["From"] = settings.NOTIFICATION_FROM_EMAIL
        email["To"] = message.to_email
        email["Subject"] = message.subject
        email.set_content(message.body)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(email)

        return {"delivered": True, "mode": "smtp", "host": settings.SMTP_HOST}


class TestmailEmailProvider(EmailProvider):
    name = "testmail"

    def __init__(self):
        self.smtp_provider = SmtpEmailProvider() if settings.SMTP_HOST else None

    def _testmail_address(self, original_to: str, submission_id: str) -> str:
        if not settings.TESTMAIL_NAMESPACE:
            return original_to
        tag = f"{settings.TESTMAIL_TAG_PREFIX}.{submission_id}".replace("_", "-").replace("@", "-")
        return f"{settings.TESTMAIL_NAMESPACE}.{tag}@inbox.testmail.app"

    def send(self, message: NotificationMessage) -> Dict[str, Any]:
        submission_id = str(message.metadata.get("submission_id", "submission"))
        testmail_to = self._testmail_address(message.to_email, submission_id)
        routed_message = NotificationMessage(
            to_email=testmail_to,
            subject=message.subject,
            body=message.body,
            template_name=message.template_name,
            metadata={**message.metadata, "original_to_email": message.to_email},
        )

        if self.smtp_provider:
            response = self.smtp_provider.send(routed_message)
            return {
                **response,
                "mode": "testmail",
                "testmail_to": testmail_to,
                "testmail_api_configured": bool(settings.TESTMAIL_API_KEY),
            }

        print(f"[testmail:{message.template_name}] To: {testmail_to} | Subject: {message.subject}")
        print(message.body)
        return {
            "delivered": False,
            "mode": "testmail",
            "testmail_to": testmail_to,
            "testmail_api_configured": bool(settings.TESTMAIL_API_KEY),
            "message": "SMTP is not configured; email logged for test mode.",
        }


def normalize_status(status: Any) -> str:
    raw = getattr(status, "value", status)
    return STATUS_ALIASES.get(str(raw).strip().lower(), str(raw).strip().lower())


def get_email_provider() -> EmailProvider:
    mode = settings.NOTIFICATION_EMAIL_MODE.lower()
    if mode == "smtp" and settings.SMTP_HOST:
        return SmtpEmailProvider()
    if mode == "testmail":
        return TestmailEmailProvider()
    return ConsoleEmailProvider()


def get_notification_logs() -> List[Dict[str, Any]]:
    return [log.__dict__ for log in NOTIFICATION_LOGS]


class NotificationService:
    def __init__(self):
        self.provider = get_email_provider()

    def _portal_link(self, submission_id: str) -> str:
        return f"{settings.APP_BASE_URL.rstrip('/')}/submission-status/{submission_id}"

    def _render_body(self, *, status: str, rule: Dict[str, str], context: Dict[str, Any]) -> str:
        tender_name = context.get("tender_name") or "the tender"
        tender_reference = context.get("tender_reference") or context.get("tender_id") or "N/A"
        bidder_name = context.get("bidder_name") or "Bidder"
        officer_contact = context.get("officer_contact") or "the tender contact officer"
        reason = context.get("reason") or context.get("comment") or ""
        portal_link = self._portal_link(context["submission_id"])

        lines = [
            f"Dear {bidder_name},",
            "",
            f"Status update for {tender_name} ({tender_reference}): {status.replace('_', ' ').title()}.",
        ]

        if status == "clarification_requested":
            lines.append(f"Clarification reason: {reason or 'Additional information is required by the evaluation team.'}")
            lines.append(f"Required action: {context.get('required_action') or rule['next_action']}")
        elif status in {"rejected", "technical_not_qualified", "not_awarded"}:
            lines.append(f"Outcome note: {reason or 'The evaluation outcome has been recorded in the portal.'}")
            lines.append("Manual review availability: Check the tender rules and officer notes in the portal.")
        elif status in {"accepted", "awarded"}:
            lines.append(f"Next steps: {rule['next_action']}")
            lines.append(f"Officer contact: {officer_contact}")
        elif status == "manual_override":
            lines.append(f"Officer update: {reason or 'A criterion or final decision was manually updated.'}")
        else:
            lines.append(f"Next action: {rule['next_action']}")

        lines.extend([
            "",
            f"Open status tracker: {portal_link}",
            "",
            "This is an automated Satyam notification. AI assists extraction; final decisions are made by configured rules and authorised officers.",
        ])
        return "\n".join(lines)

    def _dedupe_key(self, *, submission_id: str, status: str, previous_status: Optional[str], event_type: str, criterion_id: Optional[str]) -> str:
        return "|".join([
            submission_id,
            event_type,
            previous_status or "none",
            status,
            criterion_id or "overall",
        ])

    async def notify_status_change(
        self,
        *,
        submission: Dict[str, Any],
        status: Any,
        tender: Optional[Dict[str, Any]] = None,
        previous_status: Optional[str] = None,
        reason: Optional[str] = None,
        required_action: Optional[str] = None,
        event_type: str = "status_change",
        criterion_id: Optional[str] = None,
        officer_contact: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized_status = normalize_status(status)
        rule = NOTIFICATION_RULES.get(normalized_status, NOTIFICATION_RULES["under_scrutiny"])
        submission_id = submission["id"]
        dedupe_key = self._dedupe_key(
            submission_id=submission_id,
            status=normalized_status,
            previous_status=previous_status,
            event_type=event_type,
            criterion_id=criterion_id,
        )

        existing = next((log for log in NOTIFICATION_LOGS if log.dedupe_key == dedupe_key and log.send_status != "failed"), None)
        if existing:
            return {"sent": False, "duplicate": True, "notification_id": existing.notification_id}

        tender_reference = (tender or {}).get("reference_number") or (tender or {}).get("id") or submission.get("tender_id", "N/A")
        context = {
            "submission_id": submission_id,
            "tender_id": submission.get("tender_id"),
            "tender_name": (tender or {}).get("title") or (tender or {}).get("tender_name") or submission.get("tender_id"),
            "tender_reference": tender_reference,
            "bidder_name": submission.get("bidder_organization") or submission.get("bidder_name"),
            "reason": reason,
            "required_action": required_action,
            "officer_contact": officer_contact,
        }

        subject = rule["subject"].format(tender_reference=tender_reference)
        body = self._render_body(status=normalized_status, rule=rule, context=context)
        message = NotificationMessage(
            to_email=submission["bidder_contact_email"],
            subject=subject,
            body=body,
            template_name=rule["template"],
            metadata={**context, "status": normalized_status, "event_type": event_type},
        )

        now = datetime.utcnow().isoformat()
        log = NotificationLog(
            notification_id=str(uuid.uuid4()),
            dedupe_key=dedupe_key,
            bidder_id=submission.get("bidder_id", ""),
            bidder_email=submission["bidder_contact_email"],
            tender_id=submission.get("tender_id", ""),
            tender_reference=tender_reference,
            submission_id=submission_id,
            status=normalized_status,
            template_name=rule["template"],
            subject=subject,
            body=body,
            provider=self.provider.name,
            send_status="pending",
            created_at=now,
            last_attempt_at=now,
            sent_at=None,
        )
        NOTIFICATION_LOGS.append(log)
        return await self._send_log(log, message)

    async def _send_log(self, log: NotificationLog, message: NotificationMessage) -> Dict[str, Any]:
        try:
            response = self.provider.send(message)
            log.send_status = "sent"
            log.sent_at = datetime.utcnow().isoformat()
            log.provider_response = response
            log.error_message = None
            return {"sent": True, "notification_id": log.notification_id, "provider_response": response}
        except Exception as exc:
            log.send_status = "failed"
            log.error_message = str(exc)
            return {"sent": False, "notification_id": log.notification_id, "error": str(exc)}

    async def retry(self, notification_id: str) -> Dict[str, Any]:
        log = next((item for item in NOTIFICATION_LOGS if item.notification_id == notification_id), None)
        if not log:
            return {"retried": False, "error": "Notification not found"}
        if log.send_status != "failed":
            return {"retried": False, "error": "Only failed notifications can be retried"}

        log.attempts += 1
        log.last_attempt_at = datetime.utcnow().isoformat()
        log.send_status = "pending"
        message = NotificationMessage(
            to_email=log.bidder_email,
            subject=log.subject,
            body=log.body,
            template_name=log.template_name,
            metadata={"submission_id": log.submission_id},
        )
        result = await self._send_log(log, message)
        return {"retried": True, **result}


notification_service = NotificationService()
