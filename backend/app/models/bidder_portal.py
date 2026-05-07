"""
Bidder Portal Data Models
SQLAlchemy ORM entities for vendor registration, bid submission, extraction,
evaluation transparency, and clarifications.
"""

from datetime import datetime
import enum

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class BidderOrganisationTypeEnum(str, enum.Enum):
    MSME = "MSME"
    LARGE = "Large"
    PSU = "PSU"
    STARTUP = "Startup"
    OTHER = "Other"


class BidderOrganisationLegalTypeEnum(str, enum.Enum):
    PROPRIETORSHIP = "Proprietorship"
    PARTNERSHIP = "Partnership"
    PVTLTD = "PvtLtd"
    LLP = "LLP"
    PSU = "PSU"
    NGO = "NGO"
    OTHER = "Other"


class BidderMSMETypeEnum(str, enum.Enum):
    MICRO = "Micro"
    SMALL = "Small"
    MEDIUM = "Medium"
    NOT_REGISTERED = "NotRegistered"
    UNKNOWN = "Unknown"


class GSTFilingStatusEnum(str, enum.Enum):
    REGULAR = "Regular"
    COMPOSITION = "Composition"
    EXEMPT = "Exempt"
    UNKNOWN = "Unknown"


class BusinessCategoryEnum(str, enum.Enum):
    SECURITY_EQUIPMENT = "SecurityEquipment"
    IT_SERVICES = "ITServices"
    CONSTRUCTION = "Construction"
    LOGISTICS = "Logistics"
    CONSULTING = "Consulting"
    MAINTENANCE = "Maintenance"
    OTHER = "Other"


class BusinessModelEnum(str, enum.Enum):
    MANUFACTURER = "Manufacturer"
    TRADER = "Trader"
    SERVICE_PROVIDER = "ServiceProvider"
    MANUFACTURER_AND_SERVICE = "ManufacturerAndService"
    TRADER_AND_SERVICE = "TraderAndService"
    OTHER = "Other"


class AverageManpowerStrengthEnum(str, enum.Enum):
    LESS_THAN_10 = "<10"
    TEN_TO_FIFTY = "10-50"
    FIFTY_ONE_TO_TWO_HUNDRED = "51-200"
    TWO_HUNDRED_ONE_TO_FIVE_HUNDRED = "201-500"
    MORE_THAN_FIVE_HUNDRED = ">500"


class AuthorisedSignatoryIdTypeEnum(str, enum.Enum):
    AADHAAR = "Aadhaar"
    PASSPORT = "Passport"
    DRIVING_LICENCE = "DrivingLicence"
    VOTER_ID = "VoterId"
    OTHER = "Other"


class DocumentCategoryEnum(str, enum.Enum):
    FINANCIALS = "financials"
    REGISTRATION = "registration"
    EXPERIENCE_CERTIFICATE = "experience_certificate"
    TAX = "tax"
    TECHNICAL_CATALOGUE = "technical_catalogue"
    OTHER = "other"


class OcrStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class FactTypeEnum(str, enum.Enum):
    GSTIN = "GSTIN"
    PAN = "PAN"
    CIN = "CIN"
    UDYAM = "UDYAM"
    NSIC = "NSIC"
    TURNOVER = "TURNOVER"
    NET_WORTH = "NET_WORTH"
    PAID_UP_CAPITAL = "PAID_UP_CAPITAL"
    PROJECT_COUNT = "PROJECT_COUNT"
    PROJECT_DETAILS = "PROJECT_DETAILS"
    ISO_CERT = "ISO_CERT"
    MSME_STATUS = "MSME_STATUS"
    REGISTRATION_NAME = "REGISTRATION_NAME"
    ADDRESS = "ADDRESS"
    EXPERIENCE_YEARS = "EXPERIENCE_YEARS"
    OTHER = "OTHER"


class FactUnitEnum(str, enum.Enum):
    INR = "INR"
    CRORE_INR = "CRORE_INR"
    LAKH_INR = "LAKH_INR"
    YEARS = "YEARS"
    COUNT = "COUNT"
    DATE = "DATE"
    NONE = "NONE"


class FactStatusEnum(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_FOUND = "NOT_FOUND"


class EvaluationVerdictEnum(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"


class BidSubmissionStatusEnum(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_TECHNICAL_REVIEW = "UnderTechnicalReview"
    CLARIFICATION_REQUESTED = "ClarificationRequested"
    TECHNICALLY_QUALIFIED = "TechnicallyQualified"
    TECHNICALLY_NOT_QUALIFIED = "TechnicallyNotQualified"
    UNDER_FINANCIAL_REVIEW = "UnderFinancialReview"
    AWARDED = "Awarded"
    NOT_AWARDED = "NotAwarded"


class ExtractionJobTypeEnum(str, enum.Enum):
    OCR_TEXT = "OCRText"
    TABLE_STRUCTURE = "TableStructure"
    ENTITY_EXTRACTION = "EntityExtraction"
    CERTIFICATE_VERIFICATION = "CertificateVerification"


class ExtractionJobStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"


class ExtractedFactTypeEnum(str, enum.Enum):
    TURNOVER = "Turnover"
    NET_WORTH = "NetWorth"
    YEARS_EXPERIENCE = "YearsExperience"
    PROJECT_COUNT = "ProjectCount"
    GSTIN = "GSTIN"
    PAN = "PAN"
    ISO = "ISO"
    MSME_STATUS = "MSMEStatus"
    WORK_ORDER_VALUE = "WorkOrderValue"
    WORK_COMPLETION_DATE = "WorkCompletionDate"
    OTHER = "Other"


class ExtractedFactUnitEnum(str, enum.Enum):
    YEARS = "Years"
    CRORE_INR = "CroreINR"
    LAKHS_INR = "LakhsINR"
    PERCENT = "%"
    DATE = "Date"
    NONE = "None"


class SnapshotOverallStatusEnum(str, enum.Enum):
    ELIGIBLE = "Eligible"
    NOT_ELIGIBLE = "NotEligible"
    NEED_MANUAL_REVIEW = "NeedManualReview"
    NOT_YET_EVALUATED = "NotYetEvaluated"


class CriterionResultStatusEnum(str, enum.Enum):
    PASS = "Pass"
    FAIL = "Fail"
    REVIEW = "Review"


class ClarificationRaisedByEnum(str, enum.Enum):
    OFFICER = "Officer"
    BIDDER = "Bidder"


class ClarificationStatusEnum(str, enum.Enum):
    OPEN = "Open"
    RESPONDED = "Responded"
    CLOSED = "Closed"


class ClarificationSenderRoleEnum(str, enum.Enum):
    OFFICER = "Officer"
    BIDDER = "Bidder"


class BidderOrganisation(Base):
    """Registered vendor or MSME organisation."""

    __tablename__ = "bidder_organisations"

    bidder_id = Column(String(50), primary_key=True, index=True)
    organisation_name = Column(String(255), nullable=False)
    type = Column(Enum(BidderOrganisationTypeEnum), nullable=False)
    organisation_type = Column(Enum(BidderOrganisationLegalTypeEnum), nullable=False, default=BidderOrganisationLegalTypeEnum.OTHER)
    msme_type = Column(Enum(BidderMSMETypeEnum), nullable=True)
    year_of_incorporation = Column(Integer, nullable=True)
    cin = Column(String(50), nullable=True)
    gstin = Column(String(15), nullable=False, index=True)
    pan = Column(String(10), nullable=False, index=True)
    msme_registration_no = Column(String(100), nullable=True)
    udyam_no = Column(String(100), nullable=True)
    nsic_registration_no = Column(String(100), nullable=True)
    startup_india_registration_no = Column(String(100), nullable=True)
    gem_registration_id = Column(String(100), nullable=True)
    gst_filing_status = Column(Enum(GSTFilingStatusEnum), default=GSTFilingStatusEnum.UNKNOWN, nullable=False)
    registered_address = Column(Text, nullable=False)
    registered_address_line1 = Column(Text, nullable=True)
    registered_address_line2 = Column(Text, nullable=True)
    registered_city = Column(String(100), nullable=True)
    registered_state = Column(String(100), nullable=True)
    registered_pincode = Column(String(10), nullable=True)
    communication_address_line1 = Column(Text, nullable=True)
    communication_address_line2 = Column(Text, nullable=True)
    communication_city = Column(String(100), nullable=True)
    communication_state = Column(String(100), nullable=True)
    communication_pincode = Column(String(10), nullable=True)
    is_communication_same_as_registered = Column(Boolean, default=True, nullable=False)
    contact_name = Column(String(150), nullable=False)
    primary_contact_name = Column(String(150), nullable=True)
    primary_contact_designation = Column(String(150), nullable=True)
    primary_contact_email = Column(String(150), nullable=True)
    primary_contact_phone = Column(String(30), nullable=True)
    secondary_contact_name = Column(String(150), nullable=True)
    secondary_contact_email = Column(String(150), nullable=True)
    secondary_contact_phone = Column(String(30), nullable=True)
    contact_email = Column(String(150), nullable=False)
    contact_phone = Column(String(30), nullable=False)
    login_user_id = Column(String(100), nullable=False, unique=True, index=True)
    primary_business_categories = Column(JSON, nullable=True)
    business_keywords = Column(JSON, nullable=True)
    business_model = Column(Enum(BusinessModelEnum), nullable=True)
    average_manpower_strength = Column(Enum(AverageManpowerStrengthEnum), nullable=True)
    authorised_signatory_name = Column(String(150), nullable=True)
    authorised_signatory_designation = Column(String(150), nullable=True)
    authorised_signatory_id_type = Column(Enum(AuthorisedSignatoryIdTypeEnum), nullable=True)
    authorised_signatory_id_number = Column(String(100), nullable=True)
    authorised_signatory_signature_file_path = Column(String(500), nullable=True)
    has_bank_details_provided = Column(Boolean, default=False, nullable=False)
    bank_name = Column(String(150), nullable=True)
    bank_branch = Column(String(150), nullable=True)
    bank_account_holder_name = Column(String(150), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    past_performance_summary = Column(Text, nullable=True)
    is_locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bid_submissions = relationship("BidSubmission", back_populates="bidder")
    financial_years = relationship("BidderFinancialYear", back_populates="bidder", cascade="all, delete-orphan")


class BidderFinancialYear(Base):
    __tablename__ = "bidder_financial_years"

    financial_year_id = Column(String(50), primary_key=True, index=True)
    bidder_id = Column(String(50), ForeignKey("bidder_organisations.bidder_id"), nullable=False, index=True)
    financial_year_label = Column(String(20), nullable=False)
    turnover_amount_inr = Column(Numeric(18, 2), nullable=True)
    is_turnover_audited = Column(Boolean, default=False, nullable=False)
    net_worth_or_paid_up_capital_inr = Column(Numeric(18, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bidder = relationship("BidderOrganisation", back_populates="financial_years")


class BidSubmission(Base):
    """A bidder's application against a tender from the admin portal."""

    __tablename__ = "bid_submissions"

    bid_id = Column(String(50), primary_key=True, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False, index=True)
    bidder_id = Column(String(50), ForeignKey("bidder_organisations.bidder_id"), nullable=False, index=True)
    submission_status = Column(Enum(BidSubmissionStatusEnum), default=BidSubmissionStatusEnum.DRAFT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    bid_validity_end_date = Column(Date, nullable=True)
    quoted_total_price = Column(Numeric(18, 2), nullable=True)
    is_withdrawn = Column(Boolean, default=False, nullable=False)

    bidder = relationship("BidderOrganisation", back_populates="bid_submissions")
    tender = relationship("Tender")
    documents = relationship("BidDocument", back_populates="bid", cascade="all, delete-orphan")
    extracted_facts = relationship("ExtractedFact", back_populates="bid", cascade="all, delete-orphan")
    evaluation_snapshots = relationship("BidEvaluationSnapshot", back_populates="bid", cascade="all, delete-orphan")
    criterion_results = relationship("BidCriterionResult", back_populates="bid", cascade="all, delete-orphan")
    clarification_threads = relationship("ClarificationThread", back_populates="bid", cascade="all, delete-orphan")


class BidDocument(Base):
    """Uploaded bidder evidence linked to a tender checklist item."""

    __tablename__ = "bid_documents"

    bid_document_id = Column(String(50), primary_key=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=True, index=True)
    bidder_id = Column(String(50), ForeignKey("bidder_organisations.bidder_id"), nullable=True, index=True)
    linked_tender_document_requirement_id = Column(
        String(50),
        ForeignKey("tender_document_requirements.document_requirement_id"),
        nullable=True,
    )
    file_name = Column(String(255), nullable=False)
    original_file_name = Column(String(255), nullable=True)
    document_category = Column(Enum(DocumentCategoryEnum), default=DocumentCategoryEnum.OTHER, nullable=False)
    file_type = Column(String(20), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    storage_path_original = Column(String(500), nullable=True)
    ocr_job_id = Column(String(100), nullable=True, index=True)
    ocr_status = Column(Enum(OcrStatusEnum), default=OcrStatusEnum.PENDING, nullable=False)
    ocr_output_path = Column(String(500), nullable=True)
    ocr_markdown_path = Column(String(500), nullable=True)
    ocr_page_json_path = Column(String(500), nullable=True)
    upload_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    uploaded_by_user_id = Column(String(100), nullable=False)
    is_signed = Column(Boolean, default=False, nullable=False)
    is_stamped = Column(Boolean, default=False, nullable=False)

    bid = relationship("BidSubmission", back_populates="documents")
    bidder = relationship("BidderOrganisation")
    tender = relationship("Tender")
    tender_document_requirement = relationship("TenderDocumentRequirement")
    extraction_jobs = relationship("ExtractionJob", back_populates="bid_document", cascade="all, delete-orphan")
    document_facts = relationship("DocumentFact", back_populates="source_bid_document", cascade="all, delete-orphan")


class ExtractionJob(Base):
    """AI backend pipeline job spawned after upload."""

    __tablename__ = "extraction_jobs"

    extraction_job_id = Column(String(50), primary_key=True, index=True)
    bid_document_id = Column(String(50), ForeignKey("bid_documents.bid_document_id"), nullable=False, index=True)
    job_type = Column(Enum(ExtractionJobTypeEnum), nullable=False)
    status = Column(Enum(ExtractionJobStatusEnum), default=ExtractionJobStatusEnum.PENDING, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    engine_name = Column(String(100), nullable=False)
    raw_output_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    bid_document = relationship("BidDocument", back_populates="extraction_jobs")


class ExtractedFact(Base):
    """Structured fact extracted from bidder documents for rule evaluation."""

    __tablename__ = "extracted_facts"

    fact_id = Column(String(50), primary_key=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    tender_criterion_id = Column(String(50), ForeignKey("tender_criteria.criterion_id"), nullable=True, index=True)
    source_bid_document_id = Column(String(50), ForeignKey("bid_documents.bid_document_id"), nullable=False, index=True)
    source_page_number = Column(Integer, nullable=True)
    source_bounding_box = Column(JSON, nullable=True)
    fact_type = Column(Enum(ExtractedFactTypeEnum), nullable=False)
    fact_name = Column(String(255), nullable=False)
    fact_value = Column(String(255), nullable=False)
    unit = Column(Enum(ExtractedFactUnitEnum), default=ExtractedFactUnitEnum.NONE, nullable=False)
    confidence = Column(Float, nullable=False)
    bidder_flagged_ignore = Column(Boolean, default=False, nullable=False)
    bidder_note = Column(Text, nullable=True)

    bid = relationship("BidSubmission", back_populates="extracted_facts")
    tender_criterion = relationship("TenderCriterion")
    source_bid_document = relationship("BidDocument", back_populates="document_facts")


class DocumentFact(Base):
    """Structured fact extracted from a bidder document."""

    __tablename__ = "document_facts"

    fact_id = Column(String(50), primary_key=True, index=True)
    document_id = Column(String(50), ForeignKey("bid_documents.bid_document_id"), nullable=False, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False, index=True)
    fact_type = Column(Enum(FactTypeEnum), nullable=False)
    label = Column(String(255), nullable=False)
    value_raw = Column(String(1000), nullable=False)
    value_normalized = Column(JSON, nullable=True)
    unit = Column(Enum(FactUnitEnum), default=FactUnitEnum.NONE, nullable=False)
    financial_year = Column(String(20), nullable=True)
    page_hint = Column(String(100), nullable=True)
    snippet = Column(Text, nullable=True)
    table_context = Column(Text, nullable=True)
    status = Column(Enum(FactStatusEnum), default=FactStatusEnum.NOT_FOUND, nullable=False)
    ambiguity_reason = Column(Text, nullable=True)
    related_tender_criteria_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source_bid_document = relationship("BidDocument", back_populates="document_facts")
    bid = relationship("BidSubmission")
    tender = relationship("Tender")


class FactConfirmation(Base):
    """Bidder confirmation for an extracted fact."""

    __tablename__ = "fact_confirmations"

    confirmation_id = Column(String(50), primary_key=True, index=True)
    fact_id = Column(String(50), ForeignKey("document_facts.fact_id"), nullable=False, index=True)
    confirmed = Column(Boolean, default=False, nullable=False)
    corrected_value = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)
    confirmed_by_user_id = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    fact = relationship("DocumentFact")


class EvaluationResult(Base):
    """Criterion-level verdict generated from document facts."""

    __tablename__ = "evaluation_results"

    evaluation_result_id = Column(String(50), primary_key=True, index=True)
    bidder_id = Column(String(50), ForeignKey("bidder_organisations.bidder_id"), nullable=False, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False, index=True)
    criterion_id = Column(String(50), ForeignKey("tender_criteria.criterion_id"), nullable=False, index=True)
    verdict = Column(Enum(EvaluationVerdictEnum), nullable=False)
    reason = Column(Text, nullable=False)
    linked_fact_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bidder = relationship("BidderOrganisation")
    tender = relationship("Tender")
    criterion = relationship("TenderCriterion")


class BidEvaluationSnapshot(Base):
    """Bidder-facing evaluation explanation snapshot."""

    __tablename__ = "bid_evaluation_snapshots"

    snapshot_id = Column(String(50), primary_key=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    overall_status = Column(Enum(SnapshotOverallStatusEnum), default=SnapshotOverallStatusEnum.NOT_YET_EVALUATED, nullable=False)
    summary_text = Column(Text, nullable=False)
    details_json = Column(JSON, nullable=True)

    bid = relationship("BidSubmission", back_populates="evaluation_snapshots")


class BidCriterionResult(Base):
    """Internal rule result, with carefully surfaced fields for transparency."""

    __tablename__ = "bid_criterion_results"

    bid_criterion_result_id = Column(String(50), primary_key=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    tender_criterion_id = Column(String(50), ForeignKey("tender_criteria.criterion_id"), nullable=False, index=True)
    status = Column(Enum(CriterionResultStatusEnum), nullable=False)
    used_fact_ids = Column(JSON, nullable=True)
    officer_override = Column(Boolean, default=False, nullable=False)
    officer_comment = Column(Text, nullable=True)

    bid = relationship("BidSubmission", back_populates="criterion_results")
    tender_criterion = relationship("TenderCriterion")


class ClarificationThread(Base):
    """Officer/bidder clarification thread for a bid or criterion."""

    __tablename__ = "clarification_threads"

    clarification_id = Column(String(50), primary_key=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=False, index=True)
    tender_criterion_id = Column(String(50), ForeignKey("tender_criteria.criterion_id"), nullable=True)
    raised_by = Column(Enum(ClarificationRaisedByEnum), nullable=False)
    status = Column(Enum(ClarificationStatusEnum), default=ClarificationStatusEnum.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    bid = relationship("BidSubmission", back_populates="clarification_threads")
    tender_criterion = relationship("TenderCriterion")
    messages = relationship("ClarificationMessage", back_populates="clarification", cascade="all, delete-orphan")


class ClarificationMessage(Base):
    """Message inside a clarification thread."""

    __tablename__ = "clarification_messages"

    message_id = Column(String(50), primary_key=True, index=True)
    clarification_id = Column(String(50), ForeignKey("clarification_threads.clarification_id"), nullable=False, index=True)
    sender_role = Column(Enum(ClarificationSenderRoleEnum), nullable=False)
    message_text = Column(Text, nullable=False)
    attachment_file_path = Column(String(500), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    clarification = relationship("ClarificationThread", back_populates="messages")


class BidNotificationLog(Base):
    """Audit log for bidder lifecycle emails and retry tracking."""

    __tablename__ = "bid_notification_logs"

    notification_id = Column(String(50), primary_key=True, index=True)
    dedupe_key = Column(String(500), nullable=False, unique=True, index=True)
    bid_id = Column(String(50), ForeignKey("bid_submissions.bid_id"), nullable=True, index=True)
    bidder_id = Column(String(50), ForeignKey("bidder_organisations.bidder_id"), nullable=True, index=True)
    bidder_email = Column(String(150), nullable=False)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False, index=True)
    status = Column(String(60), nullable=False)
    template_name = Column(String(120), nullable=False)
    subject = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)
    send_status = Column(String(30), nullable=False)
    attempts = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_attempt_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    provider_response = Column(JSON, nullable=True)

    bid = relationship("BidSubmission")
    bidder = relationship("BidderOrganisation")
    tender = relationship("Tender")
