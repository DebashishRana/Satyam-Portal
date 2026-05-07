import {
  TenderAdminMock,
  TenderDocumentRequirementMock,
  getMockTenderById,
  getMockTenders,
} from './tenderAdminMock';

const PROFILE_KEY = 'satyam.bidder.profile';
const BIDS_KEY = 'satyam.bidder.bids';
const DOCS_KEY = 'satyam.bidder.documents';
const JOBS_KEY = 'satyam.bidder.extractionJobs';
const FACTS_KEY = 'satyam.bidder.extractedFacts';
const SNAPSHOTS_KEY = 'satyam.bidder.snapshots';
const RESULTS_KEY = 'satyam.bidder.criterionResults';
const CLARIFICATIONS_KEY = 'satyam.bidder.clarifications';

export type BidderType = 'MSME' | 'Large' | 'PSU' | 'Startup' | 'Other';
export type SubmissionStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderTechnicalReview'
  | 'ClarificationRequested'
  | 'TechnicallyQualified'
  | 'TechnicallyNotQualified'
  | 'UnderFinancialReview'
  | 'Accepted'
  | 'Rejected'
  | 'Awarded'
  | 'NotAwarded';
export type ExtractionStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'ManualCheck';

export interface BidderOrganisation {
  bidder_id: string;
  organisation_name: string;
  type: BidderType;
  gstin: string;
  pan: string;
  msme_registration_no: string;
  registered_address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  login_user_id: string;
  past_performance_summary: string;
}

export interface BidSubmissionEntity {
  bid_id: string;
  tender_id: string;
  bidder_id: string;
  submission_status: SubmissionStatus;
  created_at: string;
  submitted_at: string;
  last_updated_at: string;
  bid_validity_end_date: string;
  quoted_total_price: number | '';
  is_withdrawn: boolean;
}

export interface BidDocument {
  bid_document_id: string;
  bid_id: string;
  linked_tender_document_requirement_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  upload_timestamp: string;
  uploaded_by_user_id: string;
  is_signed: boolean;
  is_stamped: boolean;
}

export interface ExtractionJob {
  extraction_job_id: string;
  bid_document_id: string;
  job_type: 'OCRText' | 'TableStructure' | 'EntityExtraction' | 'CertificateVerification';
  status: ExtractionStatus;
  started_at: string;
  completed_at: string;
  engine_name: string;
  raw_output_json: Record<string, unknown>;
  error_message: string;
}

export interface ExtractedFact {
  fact_id: string;
  bid_id: string;
  tender_criterion_id: string;
  source_bid_document_id: string;
  source_page_number: number | null;
  source_bounding_box: { x: number; y: number; w: number; h: number } | null;
  fact_type: 'Turnover' | 'NetWorth' | 'YearsExperience' | 'ProjectCount' | 'GSTIN' | 'PAN' | 'ISO' | 'MSMEStatus' | 'WorkOrderValue' | 'WorkCompletionDate' | 'Other';
  fact_name: string;
  fact_value: string;
  unit: 'Years' | 'CroreINR' | 'LakhsINR' | '%' | 'Date' | 'None';
  confidence: number;
  bidder_note?: string;
  bidder_flagged_ignore?: boolean;
}

export interface BidEvaluationSnapshot {
  snapshot_id: string;
  bid_id: string;
  generated_at: string;
  overall_status: 'Eligible' | 'NotEligible' | 'NeedManualReview' | 'NotYetEvaluated';
  summary_text: string;
  details_json: Array<{ tender_criterion_id: string; title: string; status: 'Pass' | 'Fail' | 'Review'; explanation: string }>;
}

export interface BidCriterionResult {
  bid_criterion_result_id: string;
  bid_id: string;
  tender_criterion_id: string;
  status: 'Pass' | 'Fail' | 'Review';
  used_fact_ids: string[];
  officer_override: boolean;
  officer_comment: string;
}

export interface ClarificationMessage {
  message_id: string;
  clarification_id: string;
  sender_role: 'Officer' | 'Bidder';
  message_text: string;
  attachment_file_path: string;
  sent_at: string;
}

export interface ClarificationThread {
  clarification_id: string;
  bid_id: string;
  tender_criterion_id: string;
  raised_by: 'Officer' | 'Bidder';
  status: 'Open' | 'Responded' | 'Closed';
  created_at: string;
  closed_at: string;
  messages: ClarificationMessage[];
}

export interface TenderDiscoveryItem {
  tender_id: string;
  tender_name: string;
  category: string;
  estimated_value_amount: number;
  estimated_value_currency: string;
  bid_submission_end: string;
  unit_or_formation: string;
  locations_json: string[];
  criteria_count: number;
  mandatory_documents_count: number;
  document_requirements: TenderDocumentRequirementMock[];
}

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
};

const write = <T>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value));
const id = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
const now = () => new Date().toISOString();

const sampleTender = (): TenderDiscoveryItem => ({
  tender_id: 'TENDER-DEMO-01',
  tender_name: 'Supply of Tactical Communication Equipment',
  category: 'Electronics',
  estimated_value_amount: 24500000,
  estimated_value_currency: 'INR',
  bid_submission_end: new Date(Date.now() + 10 * 86400000).toISOString(),
  unit_or_formation: 'CRPF Signal Directorate',
  locations_json: ['New Delhi', 'Gurugram'],
  criteria_count: 4,
  mandatory_documents_count: 4,
  document_requirements: [
    {
      document_requirement_id: 'DOC01',
      name: 'GST Registration',
      description: 'GST certificate matching bidder organisation.',
      linked_criteria_ids: ['TECH01'],
      is_mandatory: true,
      is_conditional: false,
      condition_text: '',
      upload_type: 'Single',
      allowed_formats: 'pdf,jpg,png,docx',
      max_file_size_mb: 20,
      requires_signature: false,
      requires_stamp: false,
      requires_notarisation: false,
      template_url: '',
    },
    {
      document_requirement_id: 'DOC02',
      name: 'PAN Card',
      description: 'PAN proof of bidder organisation.',
      linked_criteria_ids: ['TECH02'],
      is_mandatory: true,
      is_conditional: false,
      condition_text: '',
      upload_type: 'Single',
      allowed_formats: 'pdf,jpg,png',
      max_file_size_mb: 10,
      requires_signature: false,
      requires_stamp: false,
      requires_notarisation: false,
      template_url: '',
    },
    {
      document_requirement_id: 'DOC03',
      name: 'Audited Financials',
      description: 'Audited balance sheet or CA certificate showing turnover.',
      linked_criteria_ids: ['FIN01'],
      is_mandatory: true,
      is_conditional: false,
      condition_text: '',
      upload_type: 'Multiple',
      allowed_formats: 'pdf,jpg,png,xlsx',
      max_file_size_mb: 30,
      requires_signature: true,
      requires_stamp: true,
      requires_notarisation: false,
      template_url: '',
    },
    {
      document_requirement_id: 'DOC04',
      name: 'Experience Certificates',
      description: 'Work orders and completion certificates for similar projects.',
      linked_criteria_ids: ['EXP01'],
      is_mandatory: true,
      is_conditional: false,
      condition_text: '',
      upload_type: 'Multiple',
      allowed_formats: 'pdf,jpg,png,docx',
      max_file_size_mb: 50,
      requires_signature: true,
      requires_stamp: true,
      requires_notarisation: false,
      template_url: '',
    },
  ],
});

export const getBidderProfile = (loginUserId = 'bidder-demo'): BidderOrganisation => {
  return read<BidderOrganisation>(PROFILE_KEY, {
    bidder_id: 'BIDDER-DEMO',
    organisation_name: 'Satyam Secure Systems Pvt. Ltd.',
    type: 'MSME',
    gstin: '27ALTPR4007Q1ZM',
    pan: 'ALTPR4007Q',
    msme_registration_no: 'UDYAM-MH-00-0001234',
    registered_address: 'Tower B, Sector 62, Noida, Uttar Pradesh 201309',
    contact_name: 'Aarav Mehta',
    contact_email: 'aarav.mehta@satyamsecure.in',
    contact_phone: '+91 98111 23456',
    login_user_id: loginUserId,
    past_performance_summary: 'Executed CCTV, access control, and communication equipment supply contracts for government and enterprise clients across North India.',
  });
};

export const saveBidderProfile = (profile: BidderOrganisation) => write(PROFILE_KEY, profile);

export const getPublishedTenderDiscovery = (): TenderDiscoveryItem[] => {
  const adminTenders = getMockTenders()
    .filter((tender) => tender.status === 'Published')
    .map((tender: TenderAdminMock) => ({
      tender_id: tender.tender_id,
      tender_name: tender.tender_name,
      category: tender.category || 'General',
      estimated_value_amount: Number(tender.estimated_value_amount || 0),
      estimated_value_currency: tender.estimated_value_currency,
      bid_submission_end: tender.bid_submission_end,
      unit_or_formation: tender.unit_or_formation,
      locations_json: tender.locations_json,
      criteria_count: tender.criteria.length,
      mandatory_documents_count: tender.document_requirements.filter((doc) => doc.is_mandatory).length,
      document_requirements: tender.document_requirements,
    }));

  return adminTenders.length > 0 ? adminTenders : [sampleTender()];
};

export const getTenderForBidder = (tenderId: string) => {
  return getPublishedTenderDiscovery().find((tender) => tender.tender_id === tenderId) || sampleTender();
};

export const getAdminTenderDetails = (tenderId: string) => getMockTenderById(tenderId);

export const getBids = () => read<BidSubmissionEntity[]>(BIDS_KEY, []);
export const getDocuments = () => read<BidDocument[]>(DOCS_KEY, []);
export const getJobs = () => read<ExtractionJob[]>(JOBS_KEY, []);
export const getFacts = () => read<ExtractedFact[]>(FACTS_KEY, []);
export const getSnapshots = () => read<BidEvaluationSnapshot[]>(SNAPSHOTS_KEY, []);
export const getResults = () => read<BidCriterionResult[]>(RESULTS_KEY, []);
export const getClarifications = () => read<ClarificationThread[]>(CLARIFICATIONS_KEY, []);

export const getOrCreateDraftBid = (tenderId: string, bidderId: string): BidSubmissionEntity => {
  const bids = getBids();
  const existing = bids.find((bid) => bid.tender_id === tenderId && bid.bidder_id === bidderId && bid.submission_status === 'Draft');
  if (existing) return existing;

  const bid: BidSubmissionEntity = {
    bid_id: id('BID'),
    tender_id: tenderId,
    bidder_id: bidderId,
    submission_status: 'Draft',
    created_at: now(),
    submitted_at: '',
    last_updated_at: now(),
    bid_validity_end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    quoted_total_price: '',
    is_withdrawn: false,
  };
  write(BIDS_KEY, [bid, ...bids]);
  return bid;
};

export const updateBid = (bid: BidSubmissionEntity) => {
  write(BIDS_KEY, getBids().map((item) => (item.bid_id === bid.bid_id ? { ...bid, last_updated_at: now() } : item)));
};

export const getBidById = (bidId: string) => getBids().find((bid) => bid.bid_id === bidId);

export const getLatestBidForTender = (tenderId: string, bidderId: string) => {
  return getBids().find((bid) => bid.tender_id === tenderId && bid.bidder_id === bidderId);
};

const clearStoredRequirementArtifacts = (bidId: string, requirementId: string) => {
  const removedDocumentIds = getDocuments()
    .filter((document) => document.bid_id === bidId && document.linked_tender_document_requirement_id === requirementId)
    .map((document) => document.bid_document_id);

  if (removedDocumentIds.length === 0) return;

  write(
    DOCS_KEY,
    getDocuments().filter((document) => !removedDocumentIds.includes(document.bid_document_id)),
  );
  write(
    JOBS_KEY,
    getJobs().filter((job) => !removedDocumentIds.includes(job.bid_document_id)),
  );
  write(
    FACTS_KEY,
    getFacts().filter((fact) => !removedDocumentIds.includes(fact.source_bid_document_id)),
  );
};

export const resetBidRequirementDocuments = (bidId: string, requirementIds?: string[]) => {
  const removedDocumentIds = getDocuments()
    .filter((document) => (
      document.bid_id === bidId
      && (!requirementIds || requirementIds.includes(document.linked_tender_document_requirement_id))
    ))
    .map((document) => document.bid_document_id);

  if (removedDocumentIds.length === 0) return;

  write(
    DOCS_KEY,
    getDocuments().filter((document) => !removedDocumentIds.includes(document.bid_document_id)),
  );
  write(
    JOBS_KEY,
    getJobs().filter((job) => !removedDocumentIds.includes(job.bid_document_id)),
  );
  write(
    FACTS_KEY,
    getFacts().filter((fact) => !removedDocumentIds.includes(fact.source_bid_document_id)),
  );
  onEvaluationUpdated(bidId);
};

export const onDocumentUploaded = (bid: BidSubmissionEntity, requirementId: string, file: File, uploadedByUserId: string) => {
  clearStoredRequirementArtifacts(bid.bid_id, requirementId);

  const document: BidDocument = {
    bid_document_id: id('BDOC'),
    bid_id: bid.bid_id,
    linked_tender_document_requirement_id: requirementId,
    file_name: file.name,
    file_type: file.name.split('.').pop()?.toLowerCase() || 'file',
    file_size_bytes: file.size,
    storage_path: `mock://bid-documents/${bid.bid_id}/${file.name}`,
    upload_timestamp: now(),
    uploaded_by_user_id: uploadedByUserId,
    is_signed: /signed|sign|certificate|audited/i.test(file.name),
    is_stamped: /stamp|certificate|audited|work/i.test(file.name),
  };
  write(DOCS_KEY, [document, ...getDocuments()]);

  const jobs: ExtractionJob[] = [
    ['OCRText', 'Tesseract/IndicLID/IndicPhotoOCR'],
    ['TableStructure', 'NemotronTable'],
    ['EntityExtraction', 'LLMExtractor'],
    ['CertificateVerification', 'MockGovRegistryCheck'],
  ].map(([jobType, engineName]) => ({
    extraction_job_id: id('JOB'),
    bid_document_id: document.bid_document_id,
    job_type: jobType as ExtractionJob['job_type'],
    status: 'Pending',
    started_at: '',
    completed_at: '',
    engine_name: engineName,
    raw_output_json: {
      event: 'OnDocumentUploaded',
      pipeline: 'append-to-single-pdf -> language-detect -> OCR -> table-extraction -> entity-extraction',
    },
    error_message: '',
  }));
  write(JOBS_KEY, [...jobs, ...getJobs()]);
  return document;
};

export const markJobsRunning = (bidDocumentId: string) => {
  write(
    JOBS_KEY,
    getJobs().map((job) => (
      job.bid_document_id === bidDocumentId && job.status === 'Pending'
        ? { ...job, status: 'Running', started_at: now() }
        : job
    )),
  );
};

export const markJobsManualCheck = (bidDocumentId: string) => {
  write(
    JOBS_KEY,
    getJobs().map((job) => (
      job.bid_document_id === bidDocumentId && (job.status === 'Pending' || job.status === 'Running' || job.status === 'Failed')
        ? {
            ...job,
            status: 'ManualCheck' as ExtractionStatus,
            completed_at: now(),
            error_message: 'AI extraction could not be completed. Officer/manual review required.',
          }
        : job
    )),
  );
};

export const onExtractionCompleted = (bid: BidSubmissionEntity, bidDocumentId: string, requirementId: string, profile: BidderOrganisation) => {
  const jobs = getJobs().map((job) => (
    job.bid_document_id === bidDocumentId
      ? {
          ...job,
          status: 'Succeeded' as ExtractionStatus,
          completed_at: now(),
          raw_output_json: {
            event: 'OnExtractionCompleted',
            engine: job.engine_name,
            pages_processed: 3,
            language_route: job.job_type === 'OCRText' ? 'IndicLID detected English/Hindi, routed to Tesseract or IndicPhotoOCR' : undefined,
            table_cells_detected: job.job_type === 'TableStructure' ? 42 : undefined,
          },
        }
      : job
  ));
  write(JOBS_KEY, jobs);

  const uploadedDocument = getDocuments().find((document) => document.bid_document_id === bidDocumentId);
  const tender = getTenderForBidder(bid.tender_id);
  const requirement = tender.document_requirements.find((item) => item.document_requirement_id === requirementId);
  const documentLabel = `${requirement?.name || uploadedDocument?.file_name || 'Document'} ${uploadedDocument?.file_name || ''}`.toLowerCase();
  const isGstRegistration = /gst/.test(documentLabel);
  const isPanCard = /pan/.test(documentLabel);
  const isRegistration = /registration|udyam|msme/.test(documentLabel);
  const isFinancials = /financial|audit|balance|turnover|statement/.test(documentLabel);
  const isExperience = /experience|project|work order|completion/.test(documentLabel);

  const factTemplates: ExtractedFact[] = isGstRegistration
    ? [
        {
          fact_id: id('FACT'),
          bid_id: bid.bid_id,
          tender_criterion_id: 'TECH01',
          source_bid_document_id: bidDocumentId,
          source_page_number: 1,
          source_bounding_box: { x: 86, y: 142, w: 210, h: 32 },
          fact_type: 'GSTIN',
          fact_name: 'GST registration number',
          fact_value: profile.gstin || '27ALTPR4007Q1ZM',
          unit: 'None',
          confidence: 0.98,
        },
      ]
    : isPanCard
      ? [
        {
          fact_id: id('FACT'),
          bid_id: bid.bid_id,
          tender_criterion_id: 'TECH02',
          source_bid_document_id: bidDocumentId,
          source_page_number: 1,
          source_bounding_box: { x: 88, y: 186, w: 140, h: 28 },
          fact_type: 'PAN',
          fact_name: 'PAN',
          fact_value: profile.pan || 'ALTPR4007Q',
          unit: 'None',
          confidence: 0.96,
        },
      ]
    : isRegistration
      ? [
          {
            fact_id: id('FACT'),
            bid_id: bid.bid_id,
            tender_criterion_id: requirementId || 'TECH01',
            source_bid_document_id: bidDocumentId,
            source_page_number: 1,
            source_bounding_box: { x: 86, y: 142, w: 210, h: 32 },
            fact_type: 'Other',
            fact_name: requirement?.name || 'Registration detail',
            fact_value: 'Registration document processed successfully.',
            unit: 'None',
            confidence: 0.95,
          },
        ]
    : isFinancials
      ? [
          {
            fact_id: id('FACT'),
            bid_id: bid.bid_id,
            tender_criterion_id: 'FIN01',
            source_bid_document_id: bidDocumentId,
            source_page_number: 2,
            source_bounding_box: { x: 116, y: 278, w: 220, h: 42 },
            fact_type: 'Turnover',
            fact_name: 'Average annual turnover',
            fact_value: '5.80',
            unit: 'CroreINR',
            confidence: 0.93,
          },
          {
            fact_id: id('FACT'),
            bid_id: bid.bid_id,
            tender_criterion_id: 'FIN01',
            source_bid_document_id: bidDocumentId,
            source_page_number: 2,
            source_bounding_box: { x: 118, y: 332, w: 220, h: 40 },
            fact_type: 'NetWorth',
            fact_name: 'Net worth',
            fact_value: '2.15',
            unit: 'CroreINR',
            confidence: 0.89,
          },
        ]
      : isExperience
        ? [
            {
              fact_id: id('FACT'),
              bid_id: bid.bid_id,
              tender_criterion_id: 'EXP01',
              source_bid_document_id: bidDocumentId,
              source_page_number: 3,
              source_bounding_box: { x: 100, y: 360, w: 260, h: 44 },
              fact_type: 'ProjectCount',
              fact_name: 'Similar completed projects',
              fact_value: '7',
              unit: 'None',
              confidence: 0.92,
            },
            {
              fact_id: id('FACT'),
              bid_id: bid.bid_id,
              tender_criterion_id: 'EXP01',
              source_bid_document_id: bidDocumentId,
              source_page_number: 3,
              source_bounding_box: { x: 102, y: 414, w: 250, h: 40 },
              fact_type: 'WorkOrderValue',
              fact_name: 'Largest similar order value',
              fact_value: '18.50',
              unit: 'CroreINR',
              confidence: 0.88,
            },
          ]
        : [
            {
              fact_id: id('FACT'),
              bid_id: bid.bid_id,
              tender_criterion_id: requirementId || '',
              source_bid_document_id: bidDocumentId,
              source_page_number: 1,
              source_bounding_box: { x: 96, y: 220, w: 180, h: 32 },
              fact_type: 'Other',
              fact_name: requirement?.name || 'Document note',
              fact_value: 'Processed successfully with mock OCR pipeline.',
              unit: 'None',
              confidence: 0.91,
            },
          ];
  write(FACTS_KEY, [...factTemplates, ...getFacts()]);
  onEvaluationUpdated(bid.bid_id);
};

export const onEvaluationUpdated = (bidId: string) => {
  const facts = getFacts().filter((fact) => fact.bid_id === bidId);
  const details = [
    {
      tender_criterion_id: 'FIN01',
      title: 'Turnover threshold',
      status: facts.some((fact) => fact.fact_type === 'Turnover') ? 'Pass' : 'Review',
      explanation: facts.some((fact) => fact.fact_type === 'Turnover') ? 'Turnover value detected from audited financials.' : 'Turnover fact not detected yet.',
    },
    {
      tender_criterion_id: 'TECH01',
      title: 'GST/PAN registration',
      status: facts.some((fact) => fact.fact_type === 'GSTIN' || fact.fact_type === 'PAN') ? 'Pass' : 'Review',
      explanation: 'Registry numbers are extracted for officer/rule validation.',
    },
  ] as BidEvaluationSnapshot['details_json'];

  const snapshot: BidEvaluationSnapshot = {
    snapshot_id: id('SNAP'),
    bid_id: bidId,
    generated_at: now(),
    overall_status: facts.length > 0 ? 'NeedManualReview' : 'NotYetEvaluated',
    summary_text: facts.length > 0
      ? 'AI extraction is ready. Rules can evaluate detected facts, while low-confidence or conflicting items remain officer-reviewable.'
      : 'Documents are not yet evaluated.',
    details_json: details,
  };
  write(SNAPSHOTS_KEY, [snapshot, ...getSnapshots().filter((item) => item.bid_id !== bidId)]);

  const results: BidCriterionResult[] = details.map((detail) => ({
    bid_criterion_result_id: id('BCR'),
    bid_id: bidId,
    tender_criterion_id: detail.tender_criterion_id,
    status: detail.status,
    used_fact_ids: facts.slice(0, 2).map((fact) => fact.fact_id),
    officer_override: false,
    officer_comment: '',
  }));
  write(RESULTS_KEY, [...results, ...getResults().filter((item) => item.bid_id !== bidId)]);
};

export const updateFactBidderView = (factId: string, bidderFlaggedIgnore: boolean, bidderNote: string) => {
  write(
    FACTS_KEY,
    getFacts().map((fact) => (
      fact.fact_id === factId
        ? { ...fact, bidder_flagged_ignore: bidderFlaggedIgnore, bidder_note: bidderNote }
        : fact
    )),
  );
};

export const submitBid = (bidId: string) => {
  const bid = getBids().find((item) => item.bid_id === bidId);
  if (!bid) return null;
  const submitted = { ...bid, submission_status: 'Submitted' as SubmissionStatus, submitted_at: now(), last_updated_at: now() };
  updateBid(submitted);
  onEvaluationUpdated(bidId);
  return submitted;
};

export const setBidStatus = (bidId: string, submissionStatus: SubmissionStatus) => {
  const bid = getBidById(bidId);
  if (!bid) return null;
  const updated = { ...bid, submission_status: submissionStatus, last_updated_at: now() };
  updateBid(updated);
  onEvaluationUpdated(bidId);
  return updated;
};

export const createDemoClarification = (bidId: string) => {
  const existing = getClarifications().find((thread) => thread.bid_id === bidId);
  if (existing) return existing;
  const clarification: ClarificationThread = {
    clarification_id: id('CLAR'),
    bid_id: bidId,
    tender_criterion_id: 'FIN01',
    raised_by: 'Officer',
    status: 'Open',
    created_at: now(),
    closed_at: '',
    messages: [
      {
        message_id: id('MSG'),
        clarification_id: '',
        sender_role: 'Officer',
        message_text: 'Turnover page is partially unreadable. Please upload a clearer CA certificate or audited statement.',
        attachment_file_path: '',
        sent_at: now(),
      },
    ],
  };
  clarification.messages[0].clarification_id = clarification.clarification_id;
  write(CLARIFICATIONS_KEY, [clarification, ...getClarifications()]);
  write(BIDS_KEY, getBids().map((bid) => (bid.bid_id === bidId ? { ...bid, submission_status: 'ClarificationRequested' } : bid)));
  return clarification;
};

export const respondToClarification = (clarificationId: string, messageText: string) => {
  write(
    CLARIFICATIONS_KEY,
    getClarifications().map((thread) => (
      thread.clarification_id === clarificationId
        ? {
            ...thread,
            status: 'Responded',
            messages: [
              ...thread.messages,
              {
                message_id: id('MSG'),
                clarification_id: clarificationId,
                sender_role: 'Bidder',
                message_text: messageText,
                attachment_file_path: '',
                sent_at: now(),
              },
            ],
          }
        : thread
    )),
  );
};

export const validateGstin = (gstin: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase());
export const validatePan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
