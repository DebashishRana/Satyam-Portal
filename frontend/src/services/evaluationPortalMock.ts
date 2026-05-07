const QUERY_STORAGE_KEY = 'satyam.evaluation.queries';
const OVERRIDE_STORAGE_KEY = 'satyam.evaluation.overrides';
const AUDIT_STORAGE_KEY = 'satyam.evaluation.audit';

export type PortalTenderStatus = 'Draft' | 'Under Evaluation' | 'Completed';
export type PortalBidderStatus = 'Eligible' | 'Not Eligible' | 'Needs Manual Review' | 'Query Pending';
export type PortalCriterionVerdict = 'Eligible' | 'Not Eligible' | 'Needs Manual Review';
export type PortalQueryType = 'Financial' | 'Technical' | 'Compliance' | 'Document Clarification' | 'Other';
export type PortalQueryStatus = 'Draft' | 'Sent' | 'Responded' | 'Closed';
export type PortalDocumentFactStatus = 'CONFIRMED' | 'AMBIGUOUS';

export interface PortalTenderListItem {
  tenderId: string;
  tenderName: string;
  department: string;
  status: PortalTenderStatus;
  submissionDeadline: string;
  noOfBidders: number;
  evaluationStatus: string;
  currentPhase: string;
}

export interface PortalCriterion {
  criterionId: string;
  category: 'Financial' | 'Technical' | 'Compliance';
  title: string;
  shortText: string;
  description: string;
  mandatory: boolean;
  threshold: string;
}

export interface PortalEvidence {
  documentId: string;
  documentName: string;
  page: number;
  snippet: string;
}

export interface PortalCriterionAssessment {
  criterionId: string;
  systemVerdict: PortalCriterionVerdict;
  verdict: PortalCriterionVerdict;
  bidderValue: string;
  threshold: string;
  reasoning: string;
  evidence: PortalEvidence[];
  overrideReason?: string;
}

export interface PortalDocumentFact {
  factId: string;
  label: string;
  value: string;
  snippet: string;
  status: PortalDocumentFactStatus;
}

export interface PortalDocument {
  documentId: string;
  documentName: string;
  category: string;
  ocrStatus: 'Processed' | 'Needs Review';
  extractedFacts: number;
  lastProcessed: string;
  previewLabel: string;
  facts: PortalDocumentFact[];
}

export interface PortalBidderProfile {
  legalConstitution: string;
  yearOfIncorporation: string;
  gstin: string;
  pan: string;
  cinOrUdyam: string;
  registeredAddress: string;
  communicationAddress: string;
  turnoverHistory: Array<{ financialYear: string; value: string }>;
  netWorthHistory: Array<{ financialYear: string; value: string }>;
}

export interface PortalBidder {
  bidderId: string;
  bidderName: string;
  organisationType: string;
  msme: boolean;
  avatarLabel: string;
  profile: PortalBidderProfile;
  criteria: PortalCriterionAssessment[];
  documents: PortalDocument[];
}

export interface PortalQuery {
  queryId: string;
  tenderId: string;
  bidderId: string;
  bidderName: string;
  relatedCriteriaIds: string[];
  queryType: PortalQueryType;
  status: PortalQueryStatus;
  subject: string;
  message: string;
  raisedOn: string;
  dueBy: string;
  relatedCriterionLabel: string;
  suggestedEvidence: string[];
  response?: string;
  internalNotes?: string;
}

export interface PortalAuditEvent {
  eventId: string;
  timestamp: string;
  user: string;
  action: string;
  bidderName?: string;
  criterionId?: string;
  criterionLabel?: string;
}

export interface PortalTenderRecord {
  tenderId: string;
  tenderName: string;
  department: string;
  status: PortalTenderStatus;
  submissionDeadline: string;
  evaluationStatus: string;
  currentPhase: string;
  description: string;
  eligibilitySummary: string[];
  bidders: PortalBidder[];
  criteria: PortalCriterion[];
  queries: PortalQuery[];
  auditTrail: PortalAuditEvent[];
}

type StoredOverride = {
  tenderId: string;
  bidderId: string;
  criterionId: string;
  verdict: PortalCriterionVerdict;
  reason: string;
  updatedAt: string;
  updatedBy: string;
};

type PortalStateMap<T> = Record<string, T[]>;

const criteriaCatalog: PortalCriterion[] = [
  {
    criterionId: 'FIN01',
    category: 'Financial',
    title: 'Minimum annual turnover',
    shortText: 'Min turnover Rs 5 Cr',
    description: 'Bidder must demonstrate average annual turnover of at least Rs 5 crore across the last three audited financial years.',
    mandatory: true,
    threshold: '>= Rs 5 crore average annual turnover',
  },
  {
    criterionId: 'FIN02',
    category: 'Financial',
    title: 'Positive net worth',
    shortText: 'Positive net worth',
    description: 'Bidder must maintain positive net worth in the latest audited financial year.',
    mandatory: true,
    threshold: 'Latest audited net worth must be positive',
  },
  {
    criterionId: 'TECH01',
    category: 'Technical',
    title: 'Similar projects in last 5 years',
    shortText: 'At least 3 similar projects',
    description: 'Bidder must have completed at least three comparable communication equipment supply projects during the previous five years.',
    mandatory: true,
    threshold: '>= 3 similar completed projects',
  },
  {
    criterionId: 'TECH02',
    category: 'Technical',
    title: 'OEM authorization',
    shortText: 'Valid OEM authorization',
    description: 'Bidder must submit a valid OEM authorization or equivalent manufacturer support letter for quoted tactical communication equipment.',
    mandatory: true,
    threshold: 'Current OEM authorization on company letterhead',
  },
  {
    criterionId: 'COMP01',
    category: 'Compliance',
    title: 'Valid GST registration',
    shortText: 'Valid GST',
    description: 'GST registration must be active and match the legal entity participating in the bid.',
    mandatory: true,
    threshold: 'GST registration active and matching bidder name',
  },
  {
    criterionId: 'COMP02',
    category: 'Compliance',
    title: 'PAN and legal identity',
    shortText: 'PAN and entity match',
    description: 'PAN, organisation name, and legal constitution must align across submitted records.',
    mandatory: true,
    threshold: 'PAN and legal identity fully aligned',
  },
  {
    criterionId: 'COMP03',
    category: 'Compliance',
    title: 'ISO 9001 certification',
    shortText: 'ISO 9001 certificate',
    description: 'Bidder must hold a valid ISO 9001 certificate covering the relevant business activities.',
    mandatory: true,
    threshold: 'Valid ISO 9001 certificate within validity period',
  },
];

const formatCriterionLabel = (criterionId: string) => {
  const criterion = criteriaCatalog.find((item) => item.criterionId === criterionId);
  return criterion ? `${criterion.criterionId} - ${criterion.title}` : criterionId;
};

const isoDate = (value: string) => new Date(value).toISOString();

const createAssessment = (
  criterionId: string,
  verdict: PortalCriterionVerdict,
  bidderValue: string,
  reasoning: string,
  evidence: PortalEvidence[],
): PortalCriterionAssessment => {
  const criterion = criteriaCatalog.find((item) => item.criterionId === criterionId);
  if (!criterion) {
    throw new Error(`Unknown criterion ${criterionId}`);
  }
  return {
    criterionId,
    systemVerdict: verdict,
    verdict,
    bidderValue,
    threshold: criterion.threshold,
    reasoning,
    evidence,
  };
};

const createDocument = (
  documentId: string,
  documentName: string,
  category: string,
  ocrStatus: 'Processed' | 'Needs Review',
  lastProcessed: string,
  facts: PortalDocumentFact[],
): PortalDocument => ({
  documentId,
  documentName,
  category,
  ocrStatus,
  extractedFacts: facts.length,
  lastProcessed,
  previewLabel: `${documentName} preview`,
  facts,
});

const activeBidderDocuments = {
  satyam: [
    createDocument('DOC-ALPHA-01', 'audited-balance-sheet-2023.pdf', 'Financial', 'Processed', '2026-05-05T10:15:00+05:30', [
      { factId: 'FACT-A1', label: 'Average turnover', value: 'Rs 5.8 Cr', snippet: 'FY 2022-23 average turnover recorded as Rs 5.8 crore.', status: 'CONFIRMED' },
      { factId: 'FACT-A2', label: 'Net worth', value: 'Rs 2.1 Cr', snippet: 'Net worth remains positive in FY 2022-23.', status: 'CONFIRMED' },
    ]),
    createDocument('DOC-ALPHA-02', 'project-completion-bundle.pdf', 'Technical', 'Processed', '2026-05-05T10:32:00+05:30', [
      { factId: 'FACT-A3', label: 'Similar projects', value: '4 completed projects', snippet: 'Four similar tactical radio deployments completed between 2022 and 2025.', status: 'CONFIRMED' },
    ]),
    createDocument('DOC-ALPHA-03', 'gst-pan-iso-pack.pdf', 'Compliance', 'Processed', '2026-05-05T10:48:00+05:30', [
      { factId: 'FACT-A4', label: 'GSTIN', value: '07AALCS4455B1Z2', snippet: 'GST registration active under Satyam Secure Systems Pvt. Ltd.', status: 'CONFIRMED' },
      { factId: 'FACT-A5', label: 'ISO validity', value: 'Valid till 2027-01-31', snippet: 'ISO 9001 certificate valid beyond tender closing date.', status: 'CONFIRMED' },
    ]),
  ],
  northAxis: [
    createDocument('DOC-BRAVO-01', 'financial-statements-2023.pdf', 'Financial', 'Processed', '2026-05-05T11:10:00+05:30', [
      { factId: 'FACT-B1', label: 'Average turnover', value: 'Rs 6.2 Cr', snippet: 'Average annual turnover meets the stated threshold.', status: 'CONFIRMED' },
      { factId: 'FACT-B2', label: 'Net worth', value: 'Rs 1.6 Cr', snippet: 'Positive net worth confirmed in latest audited year.', status: 'CONFIRMED' },
    ]),
    createDocument('DOC-BRAVO-02', 'experience-annexure.pdf', 'Technical', 'Needs Review', '2026-05-05T11:24:00+05:30', [
      { factId: 'FACT-B3', label: 'Similar projects', value: '3 projects claimed', snippet: 'One project certificate references wireless surveillance instead of tactical communication equipment.', status: 'AMBIGUOUS' },
    ]),
    createDocument('DOC-BRAVO-03', 'oem-authorisation-letter.pdf', 'Technical', 'Needs Review', '2026-05-05T11:31:00+05:30', [
      { factId: 'FACT-B4', label: 'OEM validity', value: 'Letter dated 2025-11-30', snippet: 'Letter validity period is not explicitly stated.', status: 'AMBIGUOUS' },
    ]),
  ],
  frontier: [
    createDocument('DOC-CHARLIE-01', 'turnover-certificate.pdf', 'Financial', 'Processed', '2026-05-05T12:02:00+05:30', [
      { factId: 'FACT-C1', label: 'Average turnover', value: 'Rs 3.4 Cr', snippet: 'Average turnover remains below the minimum threshold.', status: 'CONFIRMED' },
    ]),
    createDocument('DOC-CHARLIE-02', 'gst-and-pan.pdf', 'Compliance', 'Processed', '2026-05-05T12:11:00+05:30', [
      { factId: 'FACT-C2', label: 'GSTIN', value: '19AAACF8080P1Z4', snippet: 'GST certificate active and traceable to the bidder entity.', status: 'CONFIRMED' },
    ]),
  ],
  bharat: [
    createDocument('DOC-DELTA-01', 'audited-financials-2023.pdf', 'Financial', 'Processed', '2026-05-05T12:30:00+05:30', [
      { factId: 'FACT-D1', label: 'Average turnover', value: 'Rs 5.1 Cr', snippet: 'Turnover marginally exceeds the threshold.', status: 'CONFIRMED' },
    ]),
    createDocument('DOC-DELTA-02', 'project-reference-pack.pdf', 'Technical', 'Needs Review', '2026-05-05T12:44:00+05:30', [
      { factId: 'FACT-D2', label: 'Project completion proof', value: '2 certificates + 1 work order', snippet: 'Completion proof is missing for one referenced project.', status: 'AMBIGUOUS' },
    ]),
    createDocument('DOC-DELTA-03', 'gst-and-pan.pdf', 'Compliance', 'Processed', '2026-05-05T12:51:00+05:30', [
      { factId: 'FACT-D3', label: 'PAN match', value: 'Matched', snippet: 'PAN and legal name aligned across GST and PAN records.', status: 'CONFIRMED' },
    ]),
  ],
};

const baseRecords: PortalTenderRecord[] = [
  {
    tenderId: 'TENDER-DEMO-01',
    tenderName: 'Supply of Tactical Communication Equipment',
    department: 'CRPF Signal Directorate',
    status: 'Under Evaluation',
    submissionDeadline: isoDate('2026-05-17T17:00:00+05:30'),
    evaluationStatus: 'Technical Evaluation in Progress',
    currentPhase: 'Technical Evaluation in Progress',
    description: 'Procurement of manpack radios, repeater units, vehicle communication kits, and secure accessory bundles for CRPF field formations.',
    eligibilitySummary: [
      'Min turnover Rs 5 Cr',
      'At least 3 similar projects in the last 5 years',
      'Valid GST and PAN',
      'ISO 9001 certification',
    ],
    criteria: criteriaCatalog,
    bidders: [
      {
        bidderId: 'BIDDER-ALPHA',
        bidderName: 'Satyam Secure Systems Pvt. Ltd.',
        organisationType: 'Pvt Ltd',
        msme: true,
        avatarLabel: 'SS',
        profile: {
          legalConstitution: 'Private Limited Company',
          yearOfIncorporation: '2016',
          gstin: '07AALCS4455B1Z2',
          pan: 'AALCS4455B',
          cinOrUdyam: 'U72900DL2016PTC445566',
          registeredAddress: 'Plot 18, Sector 62, Noida, Uttar Pradesh 201309',
          communicationAddress: 'Tower 4, Bhikaji Cama Place, New Delhi 110066',
          turnoverHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 5.2 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 5.8 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 6.1 Cr' },
          ],
          netWorthHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 1.8 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 2.1 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 2.4 Cr' },
          ],
        },
        documents: activeBidderDocuments.satyam,
        criteria: [
          createAssessment('FIN01', 'Eligible', 'Rs 5.8 Cr average turnover', 'Turnover across the last three audited years exceeds the threshold of Rs 5 crore.', [
            { documentId: 'DOC-ALPHA-01', documentName: 'audited-balance-sheet-2023.pdf', page: 3, snippet: 'Average turnover recorded as Rs 5.8 crore.' },
          ]),
          createAssessment('FIN02', 'Eligible', 'Rs 2.1 Cr net worth', 'Latest audited year confirms positive net worth.', [
            { documentId: 'DOC-ALPHA-01', documentName: 'audited-balance-sheet-2023.pdf', page: 4, snippet: 'Net worth shown as Rs 2.1 crore.' },
          ]),
          createAssessment('TECH01', 'Eligible', '4 completed projects', 'Four comparable supply-and-installation projects are backed by completion certificates.', [
            { documentId: 'DOC-ALPHA-02', documentName: 'project-completion-bundle.pdf', page: 7, snippet: 'Project list shows four comparable tactical communication deployments.' },
          ]),
          createAssessment('TECH02', 'Eligible', 'OEM letter dated 2026-04-22', 'OEM authorization letter is current and covers the quoted product family.', [
            { documentId: 'DOC-ALPHA-02', documentName: 'project-completion-bundle.pdf', page: 10, snippet: 'OEM support letter includes tactical radio product line.' },
          ]),
          createAssessment('COMP01', 'Eligible', 'GST active', 'GST registration is active and matches the bidder legal entity.', [
            { documentId: 'DOC-ALPHA-03', documentName: 'gst-pan-iso-pack.pdf', page: 1, snippet: 'GST certificate active under the bidder name.' },
          ]),
          createAssessment('COMP02', 'Eligible', 'PAN matched', 'PAN, organisation name, and legal constitution align across PAN and MCA records.', [
            { documentId: 'DOC-ALPHA-03', documentName: 'gst-pan-iso-pack.pdf', page: 2, snippet: 'PAN and legal entity name are aligned.' },
          ]),
          createAssessment('COMP03', 'Eligible', 'ISO valid till 2027-01-31', 'ISO certificate remains valid beyond bid submission and evaluation timelines.', [
            { documentId: 'DOC-ALPHA-03', documentName: 'gst-pan-iso-pack.pdf', page: 4, snippet: 'ISO 9001 certificate valid until 2027-01-31.' },
          ]),
        ],
      },
      {
        bidderId: 'BIDDER-BRAVO',
        bidderName: 'NorthAxis Telecom Pvt. Ltd.',
        organisationType: 'Pvt Ltd',
        msme: false,
        avatarLabel: 'NT',
        profile: {
          legalConstitution: 'Private Limited Company',
          yearOfIncorporation: '2012',
          gstin: '06AAACN9988G1Z4',
          pan: 'AAACN9988G',
          cinOrUdyam: 'U32204HR2012PTC998877',
          registeredAddress: 'Plot 44, Udyog Vihar Phase IV, Gurugram 122016',
          communicationAddress: 'Plot 44, Udyog Vihar Phase IV, Gurugram 122016',
          turnoverHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 6.4 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 6.2 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 6.7 Cr' },
          ],
          netWorthHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 1.4 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 1.6 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 1.9 Cr' },
          ],
        },
        documents: activeBidderDocuments.northAxis,
        criteria: [
          createAssessment('FIN01', 'Eligible', 'Rs 6.2 Cr average turnover', 'Audited statements indicate turnover above the stated threshold.', [
            { documentId: 'DOC-BRAVO-01', documentName: 'financial-statements-2023.pdf', page: 3, snippet: 'Average turnover of Rs 6.2 crore.' },
          ]),
          createAssessment('FIN02', 'Eligible', 'Rs 1.6 Cr net worth', 'Latest financial year confirms positive net worth.', [
            { documentId: 'DOC-BRAVO-01', documentName: 'financial-statements-2023.pdf', page: 4, snippet: 'Net worth recorded as Rs 1.6 crore.' },
          ]),
          createAssessment('TECH01', 'Needs Manual Review', '3 projects claimed', 'One cited project certificate appears related to a surveillance deployment rather than tactical communication equipment.', [
            { documentId: 'DOC-BRAVO-02', documentName: 'experience-annexure.pdf', page: 6, snippet: 'Project category wording is ambiguous.' },
          ]),
          createAssessment('TECH02', 'Needs Manual Review', 'OEM letter without expiry', 'OEM authorization is submitted, but the validity period is not explicit and needs officer review.', [
            { documentId: 'DOC-BRAVO-03', documentName: 'oem-authorisation-letter.pdf', page: 1, snippet: 'Letter provides authorization but omits validity date.' },
          ]),
          createAssessment('COMP01', 'Eligible', 'GST active', 'GST registration is active and matches the legal entity.', [
            { documentId: 'DOC-BRAVO-01', documentName: 'financial-statements-2023.pdf', page: 1, snippet: 'Legal entity data cross-referenced with GST.' },
          ]),
          createAssessment('COMP02', 'Eligible', 'PAN matched', 'PAN and legal identity align across submitted records.', [
            { documentId: 'DOC-BRAVO-01', documentName: 'financial-statements-2023.pdf', page: 1, snippet: 'PAN and legal name align.' },
          ]),
          createAssessment('COMP03', 'Eligible', 'ISO valid till 2026-12-31', 'ISO certificate is valid for the evaluation period.', [
            { documentId: 'DOC-BRAVO-03', documentName: 'oem-authorisation-letter.pdf', page: 2, snippet: 'ISO certificate attached with validity through 2026.' },
          ]),
        ],
      },
      {
        bidderId: 'BIDDER-CHARLIE',
        bidderName: 'Frontier Vision Integrators Ltd.',
        organisationType: 'Public Ltd',
        msme: false,
        avatarLabel: 'FV',
        profile: {
          legalConstitution: 'Public Limited Company',
          yearOfIncorporation: '2010',
          gstin: '19AAACF8080P1Z4',
          pan: 'AAACF8080P',
          cinOrUdyam: 'L32200WB2010PLC808080',
          registeredAddress: '32 Salt Lake Sector V, Kolkata 700091',
          communicationAddress: '32 Salt Lake Sector V, Kolkata 700091',
          turnoverHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 3.6 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 3.4 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 3.8 Cr' },
          ],
          netWorthHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 0.8 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 1.0 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 1.1 Cr' },
          ],
        },
        documents: activeBidderDocuments.frontier,
        criteria: [
          createAssessment('FIN01', 'Not Eligible', 'Rs 3.4 Cr average turnover', 'Average turnover remains below the minimum threshold of Rs 5 crore.', [
            { documentId: 'DOC-CHARLIE-01', documentName: 'turnover-certificate.pdf', page: 2, snippet: 'Average turnover certified at Rs 3.4 crore.' },
          ]),
          createAssessment('FIN02', 'Eligible', 'Rs 1.0 Cr net worth', 'Net worth is positive in the latest audited year.', [
            { documentId: 'DOC-CHARLIE-01', documentName: 'turnover-certificate.pdf', page: 3, snippet: 'Net worth recorded as positive.' },
          ]),
          createAssessment('TECH01', 'Needs Manual Review', '2 comparable projects + 1 partial', 'Only two projects clearly meet the scope, with one additional reference lacking completion proof.', [
            { documentId: 'DOC-CHARLIE-02', documentName: 'gst-and-pan.pdf', page: 2, snippet: 'Completion certificate missing for one cited project.' },
          ]),
          createAssessment('TECH02', 'Eligible', 'OEM letter dated 2026-03-19', 'OEM authorization is valid and covers the product line quoted.', [
            { documentId: 'DOC-CHARLIE-02', documentName: 'gst-and-pan.pdf', page: 3, snippet: 'OEM authorization letter attached.' },
          ]),
          createAssessment('COMP01', 'Eligible', 'GST active', 'GST registration is active and consistent with legal entity information.', [
            { documentId: 'DOC-CHARLIE-02', documentName: 'gst-and-pan.pdf', page: 1, snippet: 'GST certificate active under the bidder entity.' },
          ]),
          createAssessment('COMP02', 'Eligible', 'PAN matched', 'PAN and company identity align across submitted records.', [
            { documentId: 'DOC-CHARLIE-02', documentName: 'gst-and-pan.pdf', page: 1, snippet: 'PAN and company name match.' },
          ]),
          createAssessment('COMP03', 'Eligible', 'ISO valid till 2026-10-15', 'ISO certification is valid during technical evaluation.', [
            { documentId: 'DOC-CHARLIE-02', documentName: 'gst-and-pan.pdf', page: 4, snippet: 'ISO certificate valid through October 2026.' },
          ]),
        ],
      },
      {
        bidderId: 'BIDDER-DELTA',
        bidderName: 'Bharat Field Networks',
        organisationType: 'MSME',
        msme: true,
        avatarLabel: 'BF',
        profile: {
          legalConstitution: 'Partnership Firm',
          yearOfIncorporation: '2018',
          gstin: '09AACFB4501D1ZX',
          pan: 'AACFB4501D',
          cinOrUdyam: 'UDYAM-UP-22-0019988',
          registeredAddress: 'Industrial Area Site C, Lucknow Road, Kanpur 208001',
          communicationAddress: 'Industrial Area Site C, Lucknow Road, Kanpur 208001',
          turnoverHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 4.8 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 5.1 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 5.4 Cr' },
          ],
          netWorthHistory: [
            { financialYear: 'FY 2021-22', value: 'Rs 0.6 Cr' },
            { financialYear: 'FY 2022-23', value: 'Rs 0.9 Cr' },
            { financialYear: 'FY 2023-24', value: 'Rs 1.2 Cr' },
          ],
        },
        documents: activeBidderDocuments.bharat,
        criteria: [
          createAssessment('FIN01', 'Eligible', 'Rs 5.1 Cr average turnover', 'Average turnover is above the threshold, although only marginally.', [
            { documentId: 'DOC-DELTA-01', documentName: 'audited-financials-2023.pdf', page: 3, snippet: 'Average turnover certified at Rs 5.1 crore.' },
          ]),
          createAssessment('FIN02', 'Eligible', 'Rs 0.9 Cr net worth', 'Net worth remains positive in the latest audited year.', [
            { documentId: 'DOC-DELTA-01', documentName: 'audited-financials-2023.pdf', page: 4, snippet: 'Positive net worth confirmed.' },
          ]),
          createAssessment('TECH01', 'Needs Manual Review', '2 certificates + 1 work order', 'Completion evidence is missing for one referenced project, so the project count cannot be fully confirmed.', [
            { documentId: 'DOC-DELTA-02', documentName: 'project-reference-pack.pdf', page: 5, snippet: 'One reference includes a work order without completion proof.' },
          ]),
          createAssessment('TECH02', 'Eligible', 'OEM letter dated 2026-04-11', 'OEM authorization is valid and product-specific.', [
            { documentId: 'DOC-DELTA-02', documentName: 'project-reference-pack.pdf', page: 7, snippet: 'OEM authorization letter attached.' },
          ]),
          createAssessment('COMP01', 'Eligible', 'GST active', 'GST registration is active.', [
            { documentId: 'DOC-DELTA-03', documentName: 'gst-and-pan.pdf', page: 1, snippet: 'GST certificate active on evaluation date.' },
          ]),
          createAssessment('COMP02', 'Eligible', 'PAN matched', 'PAN and legal name align across documents.', [
            { documentId: 'DOC-DELTA-03', documentName: 'gst-and-pan.pdf', page: 2, snippet: 'PAN and firm name are aligned.' },
          ]),
          createAssessment('COMP03', 'Eligible', 'ISO valid till 2026-11-30', 'ISO certification remains current.', [
            { documentId: 'DOC-DELTA-03', documentName: 'gst-and-pan.pdf', page: 4, snippet: 'ISO certificate valid through 2026-11-30.' },
          ]),
        ],
      },
    ],
    queries: [
      {
        queryId: 'Q-17',
        tenderId: 'TENDER-DEMO-01',
        bidderId: 'BIDDER-DELTA',
        bidderName: 'Bharat Field Networks',
        relatedCriteriaIds: ['TECH01'],
        queryType: 'Technical',
        status: 'Sent',
        subject: 'Completion evidence for referenced project',
        message: 'Please submit completion proof for the third similar project referenced in Annexure C so the evaluation committee can validate TECH01.',
        raisedOn: isoDate('2026-05-06T11:15:00+05:30'),
        dueBy: isoDate('2026-05-10T17:00:00+05:30'),
        relatedCriterionLabel: 'TECH01 - Similar projects in last 5 years',
        suggestedEvidence: ['project-reference-pack.pdf - page 5', 'project-reference-pack.pdf - page 6'],
        internalNotes: 'Open pending bidder response.',
      },
      {
        queryId: 'Q-16',
        tenderId: 'TENDER-DEMO-01',
        bidderId: 'BIDDER-BRAVO',
        bidderName: 'NorthAxis Telecom Pvt. Ltd.',
        relatedCriteriaIds: ['TECH02'],
        queryType: 'Document Clarification',
        status: 'Responded',
        subject: 'OEM authorization validity period',
        message: 'Please confirm the validity period of the OEM authorization letter and whether it covers the quoted tactical repeater range.',
        raisedOn: isoDate('2026-05-05T15:20:00+05:30'),
        dueBy: isoDate('2026-05-08T17:00:00+05:30'),
        relatedCriterionLabel: 'TECH02 - OEM authorization',
        suggestedEvidence: ['oem-authorisation-letter.pdf - page 1'],
        response: 'Updated OEM endorsement letter uploaded on 2026-05-06 confirming coverage through 2026-12-31.',
        internalNotes: 'Committee member to re-open technical row and verify attachment.',
      },
    ],
    auditTrail: [
      {
        eventId: 'AUD-01',
        timestamp: isoDate('2026-05-06T09:20:00+05:30'),
        user: 'System',
        action: 'System generated the initial technical evaluation pack for Tender TENDER-DEMO-01.',
      },
      {
        eventId: 'AUD-02',
        timestamp: isoDate('2026-05-06T11:15:00+05:30'),
        user: 'Officer A',
        action: 'Query Q-17 sent to Bharat Field Networks regarding TECH01 completion evidence.',
        bidderName: 'Bharat Field Networks',
        criterionId: 'TECH01',
        criterionLabel: 'Similar projects in last 5 years',
      },
      {
        eventId: 'AUD-03',
        timestamp: isoDate('2026-05-06T16:05:00+05:30'),
        user: 'Officer B',
        action: 'NorthAxis Telecom row marked for manual review pending OEM authorization verification.',
        bidderName: 'NorthAxis Telecom Pvt. Ltd.',
        criterionId: 'TECH02',
        criterionLabel: 'OEM authorization',
      },
    ],
  },
  {
    tenderId: 'TENDER-OPS-07',
    tenderName: 'Field Surveillance and Relay Kits',
    department: 'CRPF Operations Directorate',
    status: 'Under Evaluation',
    submissionDeadline: isoDate('2026-05-21T17:00:00+05:30'),
    evaluationStatus: 'Clarification Review',
    currentPhase: 'Clarification Review',
    description: 'Tender for field surveillance accessories, relay kits, and ruggedized communication peripherals for rapid deployment teams.',
    eligibilitySummary: [
      'Min turnover Rs 3 Cr',
      'At least 2 relevant deployments',
      'Valid GST and PAN',
      'OEM support declaration',
    ],
    criteria: criteriaCatalog,
    bidders: [],
    queries: [],
    auditTrail: [
      {
        eventId: 'AUD-OPS-01',
        timestamp: isoDate('2026-05-05T13:30:00+05:30'),
        user: 'System',
        action: 'Initial screening completed and two clarification threads opened.',
      },
    ],
  },
  {
    tenderId: 'TENDER-COMP-03',
    tenderName: 'Secure Command Post Networking Upgrade',
    department: 'CRPF Communications Cell',
    status: 'Completed',
    submissionDeadline: isoDate('2026-04-24T17:00:00+05:30'),
    evaluationStatus: 'Completed',
    currentPhase: 'Evaluation Closed',
    description: 'Closed evaluation for networking upgrades across secure command post locations.',
    eligibilitySummary: [
      'Min turnover Rs 8 Cr',
      'At least 5 similar projects',
      'Valid compliance registrations',
      'Performance security acceptance',
    ],
    criteria: criteriaCatalog,
    bidders: [],
    queries: [],
    auditTrail: [
      {
        eventId: 'AUD-COMP-01',
        timestamp: isoDate('2026-04-30T18:00:00+05:30'),
        user: 'Committee Secretariat',
        action: 'Consolidated evaluation report finalized and archived.',
      },
    ],
  },
];

baseRecords[1].bidders = baseRecords[0].bidders.slice(0, 3).map((bidder, index) => ({
  ...bidder,
  bidderId: `${bidder.bidderId}-OPS`,
  bidderName: index === 0 ? 'RapidComm Systems Pvt. Ltd.' : index === 1 ? 'NorthAxis Telecom Pvt. Ltd.' : 'FieldGrid Technologies',
}));
baseRecords[1].queries = [
  {
    queryId: 'Q-25',
    tenderId: 'TENDER-OPS-07',
    bidderId: 'BIDDER-BRAVO-OPS',
    bidderName: 'NorthAxis Telecom Pvt. Ltd.',
    relatedCriteriaIds: ['COMP03'],
    queryType: 'Compliance',
    status: 'Sent',
    subject: 'Updated ISO certificate copy required',
    message: 'Please upload the renewed ISO certificate copy for committee verification.',
    raisedOn: isoDate('2026-05-06T14:10:00+05:30'),
    dueBy: isoDate('2026-05-09T17:00:00+05:30'),
    relatedCriterionLabel: 'COMP03 - ISO 9001 certification',
    suggestedEvidence: ['iso-certificate.pdf - page 1'],
  },
];

baseRecords[2].bidders = baseRecords[0].bidders.slice(0, 2).map((bidder, index) => ({
  ...bidder,
  bidderId: `${bidder.bidderId}-COMP`,
  bidderName: index === 0 ? 'Satyam Secure Systems Pvt. Ltd.' : 'DeltaWave Digital Networks',
}));

const readState = <T>(key: string): PortalStateMap<T> => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as PortalStateMap<T>;
  } catch {
    return {};
  }
};

const writeState = <T>(key: string, value: PortalStateMap<T>) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const buildTenderKey = (tenderId: string) => tenderId;

const getStoredQueries = (tenderId: string) => readState<PortalQuery>(QUERY_STORAGE_KEY)[buildTenderKey(tenderId)] || [];
const getStoredAudit = (tenderId: string) => readState<PortalAuditEvent>(AUDIT_STORAGE_KEY)[buildTenderKey(tenderId)] || [];
const getStoredOverrides = (tenderId: string) => readState<StoredOverride>(OVERRIDE_STORAGE_KEY)[buildTenderKey(tenderId)] || [];

const computeBidderStatus = (criteria: PortalCriterionAssessment[], queries: PortalQuery[], bidderId: string): PortalBidderStatus => {
  if (queries.some((query) => query.bidderId === bidderId && (query.status === 'Sent' || query.status === 'Responded'))) {
    return 'Query Pending';
  }
  if (criteria.some((criterion) => criterion.verdict === 'Not Eligible')) {
    return 'Not Eligible';
  }
  if (criteria.some((criterion) => criterion.verdict === 'Needs Manual Review')) {
    return 'Needs Manual Review';
  }
  return 'Eligible';
};

const applyOverrides = (record: PortalTenderRecord): PortalTenderRecord => {
  const overrides = getStoredOverrides(record.tenderId);
  const queryMap = new Map<string, PortalQuery>();
  record.queries.forEach((query) => {
    queryMap.set(query.queryId, query);
  });
  getStoredQueries(record.tenderId).forEach((query) => {
    queryMap.set(query.queryId, query);
  });
  const queries = Array.from(queryMap.values()).sort((left, right) => (
    new Date(right.raisedOn).getTime() - new Date(left.raisedOn).getTime()
  ));
  const bidders = record.bidders.map((bidder) => {
    const criteria = bidder.criteria.map((criterion) => {
      const override = overrides.find((item) => item.bidderId === bidder.bidderId && item.criterionId === criterion.criterionId);
      if (!override) return criterion;
      return {
        ...criterion,
        verdict: override.verdict,
        reasoning: `Officer override applied: ${override.reason}`,
        overrideReason: override.reason,
      };
    });
    return { ...bidder, criteria };
  });
  return {
    ...record,
    bidders,
    queries,
    auditTrail: [...getStoredAudit(record.tenderId), ...record.auditTrail].sort((left, right) => (
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    )),
  };
};

export const getEvaluationPortalTenders = (): PortalTenderListItem[] => {
  return baseRecords.map((record) => {
    const enriched = applyOverrides(record);
    return {
      tenderId: enriched.tenderId,
      tenderName: enriched.tenderName,
      department: enriched.department,
      status: enriched.status,
      submissionDeadline: enriched.submissionDeadline,
      noOfBidders: enriched.bidders.length,
      evaluationStatus: enriched.evaluationStatus,
      currentPhase: enriched.currentPhase,
    };
  });
};

export const getEvaluationPortalTender = (tenderId: string): PortalTenderRecord | null => {
  const baseRecord = baseRecords.find((item) => item.tenderId === tenderId) || baseRecords[0];
  return applyOverrides(baseRecord);
};

export const getEvaluationPortalBidder = (tenderId: string, bidderId: string) => {
  const tender = getEvaluationPortalTender(tenderId);
  if (!tender) return null;
  const bidder = tender.bidders.find((item) => item.bidderId === bidderId) || tender.bidders[0];
  if (!bidder) return null;
  const overallStatus = computeBidderStatus(bidder.criteria, tender.queries, bidder.bidderId);
  return {
    ...bidder,
    overallStatus,
    openQueries: tender.queries.filter((query) => query.bidderId === bidder.bidderId && query.status !== 'Closed').length,
  };
};

export const getTenderSummaryCounts = (tender: PortalTenderRecord) => {
  const bidderStatuses = tender.bidders.map((bidder) => computeBidderStatus(bidder.criteria, tender.queries, bidder.bidderId));
  return {
    totalBidders: tender.bidders.length,
    eligible: bidderStatuses.filter((status) => status === 'Eligible').length,
    notEligible: bidderStatuses.filter((status) => status === 'Not Eligible').length,
    needsManualReview: bidderStatuses.filter((status) => status === 'Needs Manual Review').length,
    queryPending: bidderStatuses.filter((status) => status === 'Query Pending').length,
  };
};

export const getBidderSummaryRows = (tender: PortalTenderRecord) => {
  return tender.bidders.map((bidder) => {
    const financial = bidder.criteria.filter((item) => item.criterionId.startsWith('FIN'));
    const technical = bidder.criteria.filter((item) => item.criterionId.startsWith('TECH'));
    const compliance = bidder.criteria.filter((item) => item.criterionId.startsWith('COMP'));
    const summarize = (items: PortalCriterionAssessment[]) => `${items.filter((item) => item.verdict === 'Eligible').length}/${items.length} passed`;
    return {
      bidderId: bidder.bidderId,
      bidderName: bidder.bidderName,
      organisationType: bidder.organisationType,
      msme: bidder.msme,
      overallStatus: computeBidderStatus(bidder.criteria, tender.queries, bidder.bidderId),
      financialSummary: summarize(financial),
      technicalSummary: summarize(technical),
      complianceSummary: summarize(compliance),
      openQueries: tender.queries.filter((query) => query.bidderId === bidder.bidderId && query.status !== 'Closed').length,
    };
  });
};

export const savePortalQuery = (
  tenderId: string,
  payload: {
    bidderId: string;
    bidderName: string;
    relatedCriteriaIds: string[];
    queryType: PortalQueryType;
    status: PortalQueryStatus;
    subject: string;
    message: string;
    dueBy: string;
    suggestedEvidence: string[];
  },
) => {
  const nextQuery: PortalQuery = {
    queryId: `Q-${Math.floor(Math.random() * 900 + 100)}`,
    tenderId,
    bidderId: payload.bidderId,
    bidderName: payload.bidderName,
    relatedCriteriaIds: payload.relatedCriteriaIds,
    queryType: payload.queryType,
    status: payload.status,
    subject: payload.subject,
    message: payload.message,
    raisedOn: new Date().toISOString(),
    dueBy: payload.dueBy,
    relatedCriterionLabel: payload.relatedCriteriaIds.length > 0
      ? payload.relatedCriteriaIds.map(formatCriterionLabel).join(', ')
      : 'General clarification',
    suggestedEvidence: payload.suggestedEvidence,
  };

  const queries = readState<PortalQuery>(QUERY_STORAGE_KEY);
  const tenderQueries = queries[tenderId] || [];
  queries[tenderId] = [nextQuery, ...tenderQueries];
  writeState(QUERY_STORAGE_KEY, queries);

  const audits = readState<PortalAuditEvent>(AUDIT_STORAGE_KEY);
  const tenderAudits = audits[tenderId] || [];
  const auditEvent: PortalAuditEvent = {
    eventId: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: 'Officer A',
    action: `${nextQuery.queryId} ${payload.status === 'Draft' ? 'saved as draft' : 'sent to bidder'} for ${payload.bidderName}.`,
    bidderName: payload.bidderName,
    criterionLabel: nextQuery.relatedCriterionLabel,
  };
  audits[tenderId] = [auditEvent, ...tenderAudits];
  writeState(AUDIT_STORAGE_KEY, audits);

  return nextQuery;
};

export const updatePortalQueryStatus = (
  tenderId: string,
  queryId: string,
  status: PortalQueryStatus,
  response?: string,
) => {
  const queries = readState<PortalQuery>(QUERY_STORAGE_KEY);
  const baseQueries = getEvaluationPortalTender(tenderId)?.queries || [];
  const currentQuery = baseQueries.find((query) => query.queryId === queryId);
  if (!currentQuery) return;
  const currentStored = queries[tenderId] || [];
  const baseWithoutCurrent = currentStored.filter((query) => query.queryId !== queryId);
  const nextQuery = {
    ...currentQuery,
    status,
    response: response ?? currentQuery.response,
    internalNotes: status === 'Closed' ? 'Closed by evaluation officer.' : currentQuery.internalNotes,
  };
  queries[tenderId] = [
    nextQuery,
    ...baseWithoutCurrent,
  ];
  writeState(QUERY_STORAGE_KEY, queries);

  const audits = readState<PortalAuditEvent>(AUDIT_STORAGE_KEY);
  audits[tenderId] = [
    {
      eventId: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'Officer A',
      action: `Query ${queryId} updated to ${status}.`,
    },
    ...(audits[tenderId] || []),
  ];
  writeState(AUDIT_STORAGE_KEY, audits);
};

export const overridePortalCriterion = (
  tenderId: string,
  bidderId: string,
  criterionId: string,
  verdict: PortalCriterionVerdict,
  reason: string,
) => {
  const overrides = readState<StoredOverride>(OVERRIDE_STORAGE_KEY);
  const tenderOverrides = overrides[tenderId] || [];
  const nextOverride: StoredOverride = {
    tenderId,
    bidderId,
    criterionId,
    verdict,
    reason,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Officer A',
  };
  overrides[tenderId] = [
    nextOverride,
    ...tenderOverrides.filter((item) => !(item.bidderId === bidderId && item.criterionId === criterionId)),
  ];
  writeState(OVERRIDE_STORAGE_KEY, overrides);

  const audits = readState<PortalAuditEvent>(AUDIT_STORAGE_KEY);
  audits[tenderId] = [
    {
      eventId: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'Officer A',
      action: `Criterion ${criterionId} overridden for bidder ${bidderId} to ${verdict}.`,
      criterionId,
      criterionLabel: formatCriterionLabel(criterionId),
    },
    ...(audits[tenderId] || []),
  ];
  writeState(AUDIT_STORAGE_KEY, audits);
};

export const getPortalNotifications = () => {
  const activeTender = getEvaluationPortalTender('TENDER-DEMO-01');
  if (!activeTender) return [];
  const summary = getTenderSummaryCounts(activeTender);
  return [
    {
      id: 'N-01',
      title: 'Tender evaluation pack refreshed',
      detail: `${activeTender.tenderName} remains in ${activeTender.currentPhase}. ${summary.needsManualReview} bidder(s) still need manual verification.`,
      tone: 'info' as const,
      time: '2026-05-07T09:10:00+05:30',
      href: `/tenders/${activeTender.tenderId}`,
    },
    {
      id: 'N-02',
      title: 'Bidder response available',
      detail: 'NorthAxis Telecom has responded to the OEM authorization clarification and is ready for officer review.',
      tone: 'success' as const,
      time: '2026-05-07T08:40:00+05:30',
      href: `/tenders/${activeTender.tenderId}`,
    },
    {
      id: 'N-03',
      title: 'Query due date approaching',
      detail: 'Q-17 for Bharat Field Networks is due on 2026-05-10 and still awaits bidder response.',
      tone: 'warning' as const,
      time: '2026-05-07T08:15:00+05:30',
      href: `/tenders/${activeTender.tenderId}`,
    },
    {
      id: 'N-04',
      title: 'Consolidated report ready for download',
      detail: 'A refreshed consolidated technical evaluation bundle is available for the active CRPF tender.',
      tone: 'info' as const,
      time: '2026-05-07T07:50:00+05:30',
      href: `/tenders/${activeTender.tenderId}`,
    },
  ];
};

export const getCriterionById = (criterionId: string) => criteriaCatalog.find((item) => item.criterionId === criterionId) || null;
