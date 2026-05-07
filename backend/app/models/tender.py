"""
Tender Data Models
SQLAlchemy ORM models for tender management
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Boolean, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class TenderTypeEnum(str, enum.Enum):
    GOODS = "Goods"
    WORKS = "Works"
    SERVICES = "Services"
    CONSULTANCY = "Consultancy"


class ProcurementModeEnum(str, enum.Enum):
    OPEN = "Open"
    LIMITED = "Limited"
    GEM_BACKED = "GeM-backed"
    RATE_CONTRACT = "RateContract"
    OTHER = "Other"


class TenderStatusEnum(str, enum.Enum):
    DRAFT = "Draft"
    UNDER_REVIEW = "UnderReview"
    SANCTIONED = "Sanctioned"
    PUBLISHED = "Published"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"


class EvaluationMethodEnum(str, enum.Enum):
    L1 = "L1"
    QCBS = "QCBS"
    LCS = "LCS"
    QUALITY_ONLY = "QualityOnly"


class CriterionCategoryEnum(str, enum.Enum):
    TECHNICAL = "Technical"
    FINANCIAL = "Financial"
    EXPERIENCE = "Experience"
    COMPLIANCE = "Compliance"
    LEGAL = "Legal"
    OTHER = "Other"


class ThresholdTypeEnum(str, enum.Enum):
    GREATER_OR_EQUAL = "GreaterOrEqual"
    LESS_OR_EQUAL = "LessOrEqual"
    EQUAL = "Equal"
    RANGE = "Range"
    BOOLEAN = "Boolean"
    LIST_MATCH = "ListMatch"
    FREE_TEXT = "FreeText"


class EvidenceTypeEnum(str, enum.Enum):
    GST_REGISTRATION = "GSTRegistration"
    PAN = "PAN"
    MSME = "MSME"
    ISO = "ISO"
    OEM_AUTHORISATION = "OEMAuthorisation"
    EXPERIENCE_CERTIFICATE = "ExperienceCertificate"
    AUDITED_FINANCIALS = "AuditedFinancials"
    AFFIDAVIT = "Affidavit"
    OTHER = "Other"


class Tender(Base):
    """Tender master record"""
    __tablename__ = "tenders"

    tender_id = Column(String(50), primary_key=True, index=True)
    tender_name = Column(String(255), nullable=False)
    procuring_organisation = Column(String(100), nullable=False)
    unit_or_formation = Column(String(100), nullable=False)
    tender_type = Column(Enum(TenderTypeEnum), nullable=False)
    procurement_mode = Column(Enum(ProcurementModeEnum), nullable=False)
    category = Column(String(100), nullable=False)
    sub_category = Column(String(100), nullable=True)
    
    # Financial
    estimated_value_amount = Column(Float, nullable=False)
    estimated_value_currency = Column(String(10), default="INR")
    budget_head = Column(String(100), nullable=True)
    
    # Locations
    locations_json = Column(JSON, nullable=True)  # Array of site locations
    
    # Dates
    nit_date = Column(Date, nullable=False)
    bid_submission_start = Column(DateTime, nullable=False)
    bid_submission_end = Column(DateTime, nullable=False)
    technical_bid_opening = Column(DateTime, nullable=True)
    financial_bid_opening = Column(DateTime, nullable=True)
    bid_validity_days = Column(Integer, nullable=False)
    
    # Contract
    contract_start_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    delivery_schedule_text = Column(Text, nullable=True)
    
    # Bid structure
    no_of_covers = Column(String(10), default="One")  # One or Two
    evaluation_method = Column(Enum(EvaluationMethodEnum), nullable=False)
    
    # Security
    emd_required = Column(Boolean, default=False)
    emd_amount = Column(Float, nullable=True)
    emd_exemption_rules = Column(Text, nullable=True)
    tender_fee_amount = Column(Float, nullable=True)
    performance_security_percent = Column(Float, nullable=True)
    price_basis = Column(String(20), default="InclusiveTaxes")  # InclusiveTaxes or ExclusiveTaxes
    
    # Contact
    contact_officer_name = Column(String(100), nullable=False)
    contact_officer_designation = Column(String(100), nullable=True)
    contact_email = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    
    # Status
    status = Column(Enum(TenderStatusEnum), default=TenderStatusEnum.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), nullable=False)
    
    # Relationships
    criteria = relationship("TenderCriterion", back_populates="tender", cascade="all, delete-orphan")
    document_requirements = relationship("TenderDocumentRequirement", back_populates="tender", cascade="all, delete-orphan")
    evaluation_config = relationship("TenderEvaluationConfig", back_populates="tender", uselist=False, cascade="all, delete-orphan")
    committee_members = relationship("TenderCommitteeMember", back_populates="tender", cascade="all, delete-orphan")


class TenderCriterion(Base):
    """Eligibility criteria per tender"""
    __tablename__ = "tender_criteria"

    criterion_id = Column(String(50), primary_key=True, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False)
    
    # Criterion definition
    category = Column(Enum(CriterionCategoryEnum), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    # Threshold
    threshold_type = Column(Enum(ThresholdTypeEnum), nullable=False)
    threshold_value = Column(String(255), nullable=False)
    threshold_value_max = Column(String(255), nullable=True)  # For ranges
    unit = Column(String(50), nullable=True)  # Years, CroreINR, ProjectsCount, etc.
    
    # Mandatory/Optional
    is_mandatory = Column(Boolean, default=False)
    relaxation_rule_text = Column(Text, nullable=True)  # MSME exemptions, etc.
    
    # Evidence/Document
    evidence_type = Column(Enum(EvidenceTypeEnum), nullable=False)
    expected_document_format = Column(String(100), nullable=True)  # PDF, ScanImage, Table, Mixed
    auto_verification_source = Column(String(100), default="None")  # GSTN, MCA21, PANNSDL, etc.
    
    # Scoring
    scoring_weight = Column(Float, default=0)  # Weight for scoring
    applies_to_cover = Column(String(20), default="Both")  # Technical, Financial, Both
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    tender = relationship("Tender", back_populates="criteria")


class TenderDocumentRequirement(Base):
    """Document checklist per tender"""
    __tablename__ = "tender_document_requirements"

    document_requirement_id = Column(String(50), primary_key=True, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False)
    
    # Document definition
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    linked_criteria_ids = Column(JSON, nullable=True)  # List of CriterionIds
    
    # Requirement
    is_mandatory = Column(Boolean, default=False)
    is_conditional = Column(Boolean, default=False)
    condition_text = Column(Text, nullable=True)  # e.g., "mandatory only for OEMs"
    
    # Upload
    upload_type = Column(String(20), default="Single")  # Single or Multiple
    allowed_formats = Column(String(255), nullable=True)  # pdf,jpg,png
    max_file_size_mb = Column(Integer, default=5)
    
    # Certifications
    requires_signature = Column(Boolean, default=False)
    requires_stamp = Column(Boolean, default=False)
    requires_notarisation = Column(Boolean, default=False)
    
    # Template
    template_url = Column(String(255), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    tender = relationship("Tender", back_populates="document_requirements")


class TenderEvaluationConfig(Base):
    """AI evaluation configuration per tender"""
    __tablename__ = "tender_evaluation_configs"

    config_id = Column(String(50), primary_key=True, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), unique=True, nullable=False)
    
    # AI Assistance Level
    ai_assist_level = Column(String(30), default="SuggestOnly")  # SuggestOnly, PrefillWithConfirmation, AutoWithOverride
    
    # Thresholds
    ambiguity_confidence_threshold = Column(Float, default=0.8)  # 0-1 scale
    force_manual_review_on_conflict = Column(Boolean, default=True)
    
    # Verification
    enable_blacklist_check = Column(Boolean, default=True)
    blacklist_sources = Column(JSON, nullable=True)  # List of sources to check
    
    # Documentation
    requires_reasoned_order = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    tender = relationship("Tender", back_populates="evaluation_config")


class TenderCommitteeMember(Base):
    """Committee members for tender evaluation"""
    __tablename__ = "tender_committee_members"

    member_id = Column(String(50), primary_key=True, index=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id"), nullable=False)
    
    # Member info
    officer_name = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=True)
    role = Column(String(30), nullable=False)  # Chair, MemberTechnical, MemberFinance, MemberLegal
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    tender = relationship("Tender", back_populates="committee_members")
