"""
Bidder Portal API Schemas
Pydantic contracts mirroring the bidder portal persistence model.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class BidderOrganisationType(str, Enum):
    MSME = "MSME"
    LARGE = "Large"
    PSU = "PSU"
    STARTUP = "Startup"
    OTHER = "Other"


class PortalSubmissionStatus(str, Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_TECHNICAL_REVIEW = "UnderTechnicalReview"
    CLARIFICATION_REQUESTED = "ClarificationRequested"
    TECHNICALLY_QUALIFIED = "TechnicallyQualified"
    TECHNICALLY_NOT_QUALIFIED = "TechnicallyNotQualified"
    UNDER_FINANCIAL_REVIEW = "UnderFinancialReview"
    AWARDED = "Awarded"
    NOT_AWARDED = "NotAwarded"


class ExtractionJobType(str, Enum):
    OCR_TEXT = "OCRText"
    TABLE_STRUCTURE = "TableStructure"
    ENTITY_EXTRACTION = "EntityExtraction"
    CERTIFICATE_VERIFICATION = "CertificateVerification"


class ExtractionJobStatus(str, Enum):
    PENDING = "Pending"
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"


class BidderOrganisationSchema(BaseModel):
    bidder_id: str
    organisation_name: str = Field(..., min_length=3, max_length=255)
    type: BidderOrganisationType
    gstin: str = Field(..., pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
    pan: str = Field(..., pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    msme_registration_no: Optional[str] = None
    registered_address: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: str
    login_user_id: str
    past_performance_summary: Optional[str] = None


class BidSubmissionSchema(BaseModel):
    bid_id: str
    tender_id: str
    bidder_id: str
    submission_status: PortalSubmissionStatus
    created_at: datetime
    submitted_at: Optional[datetime] = None
    last_updated_at: datetime
    bid_validity_end_date: Optional[date] = None
    quoted_total_price: Optional[Decimal] = None
    is_withdrawn: bool = False


class BidDocumentSchema(BaseModel):
    bid_document_id: str
    bid_id: str
    linked_tender_document_requirement_id: Optional[str] = None
    file_name: str
    file_type: str
    file_size_bytes: int
    storage_path: str
    upload_timestamp: datetime
    uploaded_by_user_id: str
    is_signed: bool
    is_stamped: bool


class ExtractionJobSchema(BaseModel):
    extraction_job_id: str
    bid_document_id: str
    job_type: ExtractionJobType
    status: ExtractionJobStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    engine_name: str
    raw_output_json: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class ExtractedFactSchema(BaseModel):
    fact_id: str
    bid_id: str
    tender_criterion_id: Optional[str] = None
    source_bid_document_id: str
    source_page_number: Optional[int] = None
    source_bounding_box: Optional[Dict[str, float]] = None
    fact_type: str
    fact_name: str
    fact_value: str
    unit: str = "None"
    confidence: float = Field(..., ge=0, le=1)


class BidEvaluationSnapshotSchema(BaseModel):
    snapshot_id: str
    bid_id: str
    generated_at: datetime
    overall_status: str
    summary_text: str
    details_json: Optional[List[Dict[str, Any]]] = None


class BidCriterionResultSchema(BaseModel):
    bid_criterion_result_id: str
    bid_id: str
    tender_criterion_id: str
    status: str
    used_fact_ids: List[str] = []
    officer_override: bool = False
    officer_comment: Optional[str] = None


class ClarificationMessageSchema(BaseModel):
    message_id: str
    clarification_id: str
    sender_role: str
    message_text: str
    attachment_file_path: Optional[str] = None
    sent_at: datetime


class ClarificationThreadSchema(BaseModel):
    clarification_id: str
    bid_id: str
    tender_criterion_id: Optional[str] = None
    raised_by: str
    status: str
    created_at: datetime
    closed_at: Optional[datetime] = None
    messages: List[ClarificationMessageSchema] = []


class BidderOrganisationType(str, Enum):
    PROPRIETORSHIP = "Proprietorship"
    PARTNERSHIP = "Partnership"
    PVTLTD = "PvtLtd"
    LLP = "LLP"
    PSU = "PSU"
    NGO = "NGO"
    OTHER = "Other"


class BidderMSMEType(str, Enum):
    MICRO = "Micro"
    SMALL = "Small"
    MEDIUM = "Medium"
    NOT_REGISTERED = "NotRegistered"
    UNKNOWN = "Unknown"


class GSTFilingStatus(str, Enum):
    REGULAR = "Regular"
    COMPOSITION = "Composition"
    EXEMPT = "Exempt"
    UNKNOWN = "Unknown"


class BusinessCategory(str, Enum):
    SECURITY_EQUIPMENT = "SecurityEquipment"
    IT_SERVICES = "ITServices"
    CONSTRUCTION = "Construction"
    LOGISTICS = "Logistics"
    CONSULTING = "Consulting"
    MAINTENANCE = "Maintenance"
    OTHER = "Other"


class BusinessModel(str, Enum):
    MANUFACTURER = "Manufacturer"
    TRADER = "Trader"
    SERVICE_PROVIDER = "ServiceProvider"
    MANUFACTURER_AND_SERVICE = "ManufacturerAndService"
    TRADER_AND_SERVICE = "TraderAndService"
    OTHER = "Other"


class AverageManpowerStrength(str, Enum):
    LESS_THAN_10 = "<10"
    TEN_TO_FIFTY = "10-50"
    FIFTY_ONE_TO_TWO_HUNDRED = "51-200"
    TWO_HUNDRED_ONE_TO_FIVE_HUNDRED = "201-500"
    MORE_THAN_FIVE_HUNDRED = ">500"


class AuthorisedSignatoryIdType(str, Enum):
    AADHAAR = "Aadhaar"
    PASSPORT = "Passport"
    DRIVING_LICENCE = "DrivingLicence"
    VOTER_ID = "VoterId"
    OTHER = "Other"


class ProfileSaveMode(str, Enum):
    DRAFT = "Draft"
    LOCK = "Lock"


class BidderFinancialYearSchema(BaseModel):
    financial_year_id: str
    bidder_id: str
    financial_year_label: str
    turnover_amount_inr: Optional[Decimal] = None
    is_turnover_audited: bool = False
    net_worth_or_paid_up_capital_inr: Optional[Decimal] = None


class BidderProfileSchema(BaseModel):
    bidder_id: str
    organisation_name: str = Field(..., min_length=3, max_length=255)
    organisation_type: BidderOrganisationType
    msmetype: Optional[BidderMSMEType] = BidderMSMEType.UNKNOWN
    year_of_incorporation: Optional[int] = None
    cin: Optional[str] = None

    gstin: str = Field(..., pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
    pan: str = Field(..., pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    msme_registration_no: Optional[str] = None
    udyam_no: Optional[str] = None
    nsic_registration_no: Optional[str] = None
    startup_india_registration_no: Optional[str] = None
    gem_registration_id: Optional[str] = None

    registered_address_line1: str
    registered_address_line2: Optional[str] = None
    registered_city: str
    registered_state: str
    registered_pincode: str
    communication_address_line1: Optional[str] = None
    communication_address_line2: Optional[str] = None
    communication_city: Optional[str] = None
    communication_state: Optional[str] = None
    communication_pincode: Optional[str] = None
    is_communication_same_as_registered: bool = True

    primary_contact_name: str
    primary_contact_designation: Optional[str] = None
    primary_contact_email: EmailStr
    primary_contact_phone: str
    secondary_contact_name: Optional[str] = None
    secondary_contact_email: Optional[EmailStr] = None
    secondary_contact_phone: Optional[str] = None

    gst_filing_status: GSTFilingStatus = GSTFilingStatus.UNKNOWN
    primary_business_categories: List[BusinessCategory] = Field(default_factory=list)
    business_keywords: List[str] = Field(default_factory=list)
    business_model: Optional[BusinessModel] = BusinessModel.OTHER
    average_manpower_strength: Optional[AverageManpowerStrength] = None

    authorised_signatory_name: str
    authorised_signatory_designation: str
    authorised_signatory_id_type: AuthorisedSignatoryIdType = AuthorisedSignatoryIdType.OTHER
    authorised_signatory_id_number: Optional[str] = None
    authorised_signatory_signature_file_path: Optional[str] = None

    has_bank_details_provided: bool = False
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_holder_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None

    past_performance_summary: Optional[str] = None
    is_locked: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BidderProfileSaveRequest(BidderProfileSchema):
    save_mode: ProfileSaveMode = ProfileSaveMode.DRAFT


class BidderProfileResponse(BidderProfileSchema):
    financial_years: List[BidderFinancialYearSchema] = Field(default_factory=list)
    profile_completeness_percent: int = 0
    warnings: List[str] = Field(default_factory=list)


class BidNotificationLogSchema(BaseModel):
    notification_id: str
    dedupe_key: str
    bid_id: Optional[str] = None
    bidder_id: Optional[str] = None
    bidder_email: str
    tender_id: str
    status: str
    template_name: str
    subject: str
    provider: str
    send_status: str
    attempts: int
    created_at: datetime
    last_attempt_at: datetime
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    provider_response: Optional[Dict[str, Any]] = None


class DocumentCategory(str, Enum):
    FINANCIALS = "financials"
    REGISTRATION = "registration"
    EXPERIENCE_CERTIFICATE = "experience_certificate"
    TAX = "tax"
    TECHNICAL_CATALOGUE = "technical_catalogue"
    OTHER = "other"


class OcrStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class FactType(str, Enum):
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


class FactUnit(str, Enum):
    INR = "INR"
    CRORE_INR = "CRORE_INR"
    LAKH_INR = "LAKH_INR"
    YEARS = "YEARS"
    COUNT = "COUNT"
    DATE = "DATE"
    NONE = "NONE"


class FactStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_FOUND = "NOT_FOUND"


class EvaluationVerdict(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"


class BidDocumentResponse(BaseModel):
    bid_document_id: str
    bid_id: str
    tender_id: Optional[str] = None
    bidder_id: Optional[str] = None
    original_file_name: Optional[str] = None
    document_category: DocumentCategory = DocumentCategory.OTHER
    storage_path_original: Optional[str] = None
    ocr_job_id: Optional[str] = None
    ocr_status: OcrStatus = OcrStatus.PENDING
    ocr_output_path: Optional[str] = None
    ocr_markdown_path: Optional[str] = None
    ocr_page_json_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    uploaded_by_user_id: str


class DocumentFactResponse(BaseModel):
    fact_id: str
    document_id: str
    bid_id: str
    tender_id: str
    fact_type: FactType
    label: str
    value_raw: str
    value_normalized: Optional[Dict[str, Any]] = None
    unit: FactUnit = FactUnit.NONE
    financial_year: Optional[str] = None
    page_hint: Optional[str] = None
    snippet: Optional[str] = None
    table_context: Optional[str] = None
    status: FactStatus = FactStatus.NOT_FOUND
    ambiguity_reason: Optional[str] = None
    related_tender_criteria_ids: Optional[List[str]] = None
    created_at: datetime


class FactConfirmationRequest(BaseModel):
    confirmed: bool
    corrected_value: Optional[str] = None
    comment: Optional[str] = None


class FactConfirmationResponse(BaseModel):
    confirmation_id: str
    fact_id: str
    confirmed: bool
    corrected_value: Optional[str] = None
    comment: Optional[str] = None
    confirmed_by_user_id: str
    created_at: datetime
    updated_at: datetime


class DocumentUploadResponse(BaseModel):
    document: BidDocumentResponse
    message: str


class EvaluationResultResponse(BaseModel):
    evaluation_result_id: str
    bidder_id: str
    tender_id: str
    criterion_id: str
    verdict: EvaluationVerdict
    reason: str
    linked_fact_ids: List[str] = Field(default_factory=list)
    created_at: datetime


class EvaluationReportResponse(BaseModel):
    tender_id: str
    generated_at: datetime
    bidders: List[Dict[str, Any]]
