const STORAGE_KEY = 'satyam.admin.tenders';

export type TenderStatus = 'Draft' | 'UnderReview' | 'Sanctioned' | 'Published' | 'Closed' | 'Cancelled';

export interface TenderCriterionMock {
  criterion_id: string;
  tender_id?: string;
  category: 'Technical' | 'Financial' | 'Experience' | 'Compliance' | 'Legal' | 'Other';
  title: string;
  description: string;
  threshold_type: 'GreaterOrEqual' | 'LessOrEqual' | 'Equal' | 'Range' | 'Boolean' | 'ListMatch' | 'FreeText';
  threshold_value: string;
  threshold_value_max: string;
  unit: 'Years' | 'CroreINR' | 'LakhsINR' | 'ProjectsCount' | 'Percentage' | 'Date' | 'None' | 'Other';
  is_mandatory: boolean;
  relaxation_rule_text: string;
  evidence_type: 'GSTRegistration' | 'PAN' | 'MSME' | 'ISO' | 'OEMAuthorisation' | 'ExperienceCertificate' | 'AuditedFinancials' | 'Affidavit' | 'Other';
  expected_document_format: 'PDF' | 'ScanImage' | 'Table' | 'Mixed';
  auto_verification_source: 'None' | 'GSTN' | 'MCA21' | 'PANNSDL' | 'InternalBlacklistDB' | 'Other';
  scoring_weight: number;
  applies_to_cover: 'Technical' | 'Financial' | 'Both';
}

export interface TenderDocumentRequirementMock {
  document_requirement_id: string;
  tender_id?: string;
  name: string;
  description: string;
  linked_criteria_ids: string[];
  is_mandatory: boolean;
  is_conditional: boolean;
  condition_text: string;
  upload_type: 'Single' | 'Multiple';
  allowed_formats: string;
  max_file_size_mb: number;
  requires_signature: boolean;
  requires_stamp: boolean;
  requires_notarisation: boolean;
  template_url: string;
}

export interface TenderEvaluationConfigMock {
  tender_id?: string;
  ai_assist_level: 'SuggestOnly' | 'PrefillWithConfirmation' | 'AutoWithOverride';
  ambiguity_confidence_threshold: number;
  force_manual_review_on_conflict: boolean;
  enable_blacklist_check: boolean;
  blacklist_sources: string[];
  requires_reasoned_order: boolean;
}

export interface TenderCommitteeMemberMock {
  committee_member_id: string;
  tender_id?: string;
  officer_name: string;
  designation: string;
  role: 'Chair' | 'MemberTechnical' | 'MemberFinance' | 'MemberLegal';
  email: string;
  phone: string;
}

export interface TenderAdminMock {
  tender_id: string;
  tender_name: string;
  procuring_organisation: 'CRPF' | 'Other';
  unit_or_formation: string;
  tender_type: 'Goods' | 'Works' | 'Services' | 'Consultancy';
  procurement_mode: 'Open' | 'Limited' | 'GeM-backed' | 'RateContract' | 'Other';
  category: string;
  sub_category: string;
  estimated_value_amount: number;
  estimated_value_currency: 'INR' | 'USD' | 'Other';
  budget_head: string;
  locations_json: string[];
  nit_date: string;
  bid_submission_start: string;
  bid_submission_end: string;
  technical_bid_opening: string;
  financial_bid_opening: string;
  bid_validity_days: number;
  contract_start_date: string;
  contract_end_date: string;
  delivery_schedule_text: string;
  no_of_covers: 'One' | 'Two';
  evaluation_method: 'L1' | 'QCBS' | 'LCS' | 'QualityOnly';
  emd_required: boolean;
  emd_amount: number | '';
  emd_exemption_rules: string;
  tender_fee_amount: number | '';
  performance_security_percent: number | '';
  price_basis: 'InclusiveTaxes' | 'ExclusiveTaxes';
  contact_officer_name: string;
  contact_officer_designation: string;
  contact_email: string;
  contact_phone: string;
  status: TenderStatus;
  criteria: TenderCriterionMock[];
  document_requirements: TenderDocumentRequirementMock[];
  evaluation_config: TenderEvaluationConfigMock;
  committee_members: TenderCommitteeMemberMock[];
  created_at: string;
  updated_at: string;
}

export const createTenderId = () => `TENDER-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

export const createChildId = (prefix: string, existingCount: number) => {
  return `${prefix}${String(existingCount + 1).padStart(2, '0')}`;
};

export const getMockTenders = (): TenderAdminMock[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const getMockTenderById = (tenderId: string) => {
  return getMockTenders().find((tender) => tender.tender_id === tenderId);
};

export const saveMockTender = (tender: TenderAdminMock) => {
  const now = new Date().toISOString();
  const tenderId = tender.tender_id || createTenderId();
  const normalized: TenderAdminMock = {
    ...tender,
    tender_id: tenderId,
    criteria: tender.criteria.map((criterion) => ({ ...criterion, tender_id: tenderId })),
    document_requirements: tender.document_requirements.map((document) => ({ ...document, tender_id: tenderId })),
    evaluation_config: { ...tender.evaluation_config, tender_id: tenderId },
    committee_members: tender.committee_members.map((member) => ({ ...member, tender_id: tenderId })),
    created_at: tender.created_at || now,
    updated_at: now,
  };

  const next = getMockTenders().filter((item) => item.tender_id !== tenderId);
  next.unshift(normalized);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(`${STORAGE_KEY}.latest_ai_payload`, JSON.stringify(toEvaluationPayload(normalized)));
  return normalized;
};

export const toTenderListItem = (tender: TenderAdminMock) => ({
  id: tender.tender_id,
  title: tender.tender_name,
  reference_number: tender.tender_id,
  status: tender.status.toLowerCase(),
  category: tender.category,
  closing_date: tender.bid_submission_end,
  estimated_value: tender.estimated_value_amount,
  currency: tender.estimated_value_currency,
  is_mock_admin_tender: true,
});

export const toEvaluationPayload = (tender: TenderAdminMock) => ({
  tender_id: tender.tender_id,
  tender: {
    tender_id: tender.tender_id,
    tender_name: tender.tender_name,
    tender_type: tender.tender_type,
    procurement_mode: tender.procurement_mode,
    estimated_value_amount: tender.estimated_value_amount,
    estimated_value_currency: tender.estimated_value_currency,
    bid_submission_end: tender.bid_submission_end,
    no_of_covers: tender.no_of_covers,
    evaluation_method: tender.evaluation_method,
    status: tender.status,
  },
  criteria: tender.criteria,
  document_requirements: tender.document_requirements,
  evaluation_config: tender.evaluation_config,
  committee_members: tender.committee_members,
  decision_contract: {
    pass: 'all mandatory criteria satisfied and no blocking conflict',
    fail: 'one or more mandatory criteria not satisfied',
    review: 'ambiguous evidence, conflicting source, blacklist hit, or confidence below threshold',
  },
});
