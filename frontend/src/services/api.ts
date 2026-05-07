import axios, { AxiosInstance } from 'axios';
import { isDemoModeEnabled } from './demoMode';
import {
  getBidById,
  getBids,
  getBidderProfile,
  getDocuments,
  getFacts,
  getOrCreateDraftBid,
  getPublishedTenderDiscovery,
  getSnapshots,
  getTenderForBidder,
  onDocumentUploaded,
  onEvaluationUpdated,
  onExtractionCompleted,
  saveBidderProfile,
  updateBid,
  updateFactBidderView,
} from './bidderPortalMock';
import {
  getMockTenderById,
  getMockTenders,
  saveMockTender,
  toTenderListItem,
} from './tenderAdminMock';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
const isDemoToken = (token: string | null) => Boolean(token && token.startsWith('demo-token:'));
const isFormData = (value: unknown): value is FormData => typeof FormData !== 'undefined' && value instanceof FormData;

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const extractErrorDetail = (detail: unknown): string | null => {
  if (detail === null || detail === undefined || detail === '') return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(extractErrorDetail).filter(Boolean) as string[];
    return messages.length ? messages.join('; ') : null;
  }
  if (typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    if (typeof record.msg === 'string') {
      const loc = Array.isArray(record.loc) ? record.loc.join('.') : record.loc;
      return loc ? `${String(loc)}: ${record.msg}` : record.msg;
    }
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
    if (Object.prototype.hasOwnProperty.call(record, 'detail')) {
      return extractErrorDetail(record.detail);
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }
  return String(detail);
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as {
    response?: { data?: { detail?: unknown; message?: unknown } };
    message?: string;
  };
  return (
    extractErrorDetail(apiError?.response?.data?.detail)
    || extractErrorDetail(apiError?.response?.data?.message)
    || apiError?.message
    || fallback
  );
};

// Add request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data && isFormData(config.data) && config.headers) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
      delete (config.headers as Record<string, unknown>)['content-type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem('token');
    if (error.response?.status === 401 && !isDemoToken(token)) {
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

type DemoUser = {
  id: string;
  email: string;
  role: string;
  organization?: string;
  full_name?: string;
};

const demoUsers: Record<string, DemoUser & { password: string }> = {
  'officer1@crpf.gov.in': {
    id: '1',
    email: 'officer1@crpf.gov.in',
    password: 'password123',
    role: 'committee_member',
    organization: 'CRPF',
    full_name: 'Rajesh Kumar',
  },
  'admin@crpf.gov.in': {
    id: '3',
    email: 'admin@crpf.gov.in',
    password: 'password123',
    role: 'admin',
    organization: 'CRPF',
    full_name: 'Satyam Admin',
  },
  'bidder1@example.com': {
    id: '2',
    email: 'bidder1@example.com',
    password: 'password123',
    role: 'bidder',
    organization: 'Satyam Secure Systems Pvt. Ltd.',
    full_name: 'Aarav Mehta',
  },
};

const demoUserKey = 'satyam.demo.user';

const getDemoUserFromToken = (token: string | null): DemoUser | null => {
  if (!token || !token.startsWith('demo-token:')) return null;
  const [, role, id] = token.split(':');
  const stored = localStorage.getItem(demoUserKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DemoUser;
      if (parsed.id === id && parsed.role === role) return parsed;
    } catch {
      // Ignore parse issues and fall back to the token metadata.
    }
  }
  const match = Object.values(demoUsers).find((user) => user.id === id && user.role === role);
  if (match) {
    const { password: _password, ...safeUser } = match;
    return safeUser;
  }
  return { id, email: 'demo@satyam.local', role };
};

const getDemoUserByEmail = (email: string) => {
  const user = demoUsers[email.trim().toLowerCase()];
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const createDemoToken = (user: DemoUser) => `demo-token:${user.role}:${user.id}`;

const demoTenderList = () => {
  const adminTenders = getMockTenders();
  if (adminTenders.length > 0) {
    return adminTenders.map(toTenderListItem);
  }
  return getPublishedTenderDiscovery().map((tender) => ({
    id: tender.tender_id,
    title: tender.tender_name,
    reference_number: tender.tender_id,
    status: 'published',
    category: tender.category,
    closing_date: tender.bid_submission_end,
    estimated_value: tender.estimated_value_amount,
    currency: tender.estimated_value_currency,
    is_mock_admin_tender: false,
  }));
};

const demoTenderDetail = (id: string) => {
  const adminTender = getMockTenderById(id);
  if (adminTender) return adminTender;
  const bidderTender = getPublishedTenderDiscovery().find((item) => item.tender_id === id) || getPublishedTenderDiscovery()[0];
  return {
    id: bidderTender.tender_id,
    reference_number: bidderTender.tender_id,
    title: bidderTender.tender_name,
    status: 'published',
    estimated_value: bidderTender.estimated_value_amount,
    currency: bidderTender.estimated_value_currency,
    closing_date: bidderTender.bid_submission_end,
    description: `Demo tender for ${bidderTender.unit_or_formation}. The full backend workflow is replaced with canned data for presentations.`,
    eligibility_criteria: [
      { description: 'Valid GST registration', category: 'compliance', mandatory: true },
      { description: 'Matching PAN and organisation name', category: 'legal', mandatory: true },
      { description: 'Audited financials for the last 3 years', category: 'financial', mandatory: true },
      { description: 'Relevant project experience', category: 'experience', mandatory: true },
    ],
  };
};

const demoSubmissions = async () => {
  const profile = getBidderProfile('bidder-demo');
  const bids = getBids().filter((bid) => bid.bidder_id === profile.bidder_id);
  return {
    submissions: bids.length > 0
      ? bids
      : [
          getOrCreateDraftBid(getPublishedTenderDiscovery()[0].tender_id, profile.bidder_id),
        ],
  };
};

// Auth Service
export const authService = {
  login: async (email: string, password: string) => {
    if (isDemoModeEnabled()) {
      const demoUser = getDemoUserByEmail(email);
      if (!demoUser) {
        throw new Error('Unknown demo account. Use the sample bidder or officer login.');
      }
      const token = createDemoToken(demoUser);
      localStorage.setItem('token', token);
      localStorage.setItem(demoUserKey, JSON.stringify(demoUser));
      return { access_token: token, token_type: 'bearer', user: demoUser };
    }

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  },

  register: async (userData: any) => {
    if (isDemoModeEnabled()) {
      return { ...userData, id: `demo-${Date.now()}` };
    }
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (token: string) => {
    const demoUser = getDemoUserFromToken(token);
    if (isDemoModeEnabled() && demoUser) {
      return demoUser;
    }
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
};

// Tender Service
export const tenderService = {
  getAll: async (params?: { status?: string; category?: string }) => {
    if (isDemoModeEnabled()) {
      const tenders = demoTenderList();
      return tenders.filter((tender: any) => {
        const matchesStatus = !params?.status || tender.status === params.status.toLowerCase();
        const matchesCategory = !params?.category || tender.category === params.category;
        return matchesStatus && matchesCategory;
      });
    }
    const response = await apiClient.get('/tenders/', { params });
    return response.data;
  },

  getById: async (id: string) => {
    if (isDemoModeEnabled()) {
      return demoTenderDetail(id);
    }
    const response = await apiClient.get(`/tenders/${id}`);
    return response.data;
  },

  create: async (tenderData: any) => {
    if (isDemoModeEnabled()) {
      const saved = saveMockTender({
        ...tenderData,
        tender_id: tenderData.tender_id || '',
        criteria: tenderData.criteria || [],
        document_requirements: tenderData.document_requirements || [],
        evaluation_config: tenderData.evaluation_config || {
          ai_assist_level: 'PrefillWithConfirmation',
          ambiguity_confidence_threshold: 0.75,
          force_manual_review_on_conflict: true,
          enable_blacklist_check: true,
          blacklist_sources: ['InternalBlacklistDB'],
          requires_reasoned_order: true,
        },
        committee_members: tenderData.committee_members || [],
        created_at: tenderData.created_at || '',
        updated_at: tenderData.updated_at || '',
      });
      return saved;
    }
    const response = await apiClient.post('/tenders/', tenderData);
    return response.data;
  },

  publish: async (id: string) => {
    if (isDemoModeEnabled()) {
      const tender = getMockTenderById(id);
      if (tender) {
        return saveMockTender({ ...tender, status: 'Published' });
      }
      return demoTenderDetail(id);
    }
    const response = await apiClient.post(`/tenders/${id}/publish`);
    return response.data;
  },

  getSummary: async (id: string) => {
    if (isDemoModeEnabled()) {
      const tender = demoTenderDetail(id) as any;
      return {
        tender_id: tender.id || id,
        summary: tender.description || 'Demo tender summary',
        document_count: tender.eligibility_criteria?.length || 0,
      };
    }
    const response = await apiClient.get(`/tenders/${id}/summary`);
    return response.data;
  },
};

// Document Service
export const documentService = {
  upload: async (file: File, metadata?: any) => {
    if (isDemoModeEnabled()) {
      return {
        document_id: `demo-doc-${Date.now()}`,
        file_name: file.name,
        metadata,
        status: 'Uploaded',
      };
    }
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response = await apiClient.post('/documents/upload', formData);
    return response.data;
  },

  getById: async (id: string) => {
    if (isDemoModeEnabled()) {
      return { id, file_name: 'Demo document', status: 'Processed' };
    }
    const response = await apiClient.get(`/documents/${id}`);
    return response.data;
  },

  list: async (params?: any) => {
    if (isDemoModeEnabled()) {
      return getDocuments().filter((document) => {
        const bid = getBidById(document.bid_id);
        const matchesTender = !params?.tender_id || bid?.tender_id === params.tender_id;
        const matchesBidder = !params?.bidder_id || bid?.bidder_id === params.bidder_id;
        return matchesTender && matchesBidder;
      });
    }
    const response = await apiClient.get('/documents/', { params });
    return response.data;
  },

  process: async (id: string) => {
    if (isDemoModeEnabled()) {
      return { id, status: 'Processed' };
    }
    const response = await apiClient.post(`/documents/${id}/process`);
    return response.data;
  },
};

// Bidder Service
export const bidderService = {
  getProfile: async () => {
    if (isDemoModeEnabled()) {
      return getBidderProfile('bidder-demo');
    }
    const response = await apiClient.get('/bidders/profile');
    return response.data;
  },

  saveProfile: async (profileData: any) => {
    if (isDemoModeEnabled()) {
      saveBidderProfile(profileData);
      return profileData;
    }
    const response = await apiClient.put('/bidders/profile', profileData);
    return response.data;
  },

  submitBid: async (tenderId: string, submissionData: any) => {
    if (isDemoModeEnabled()) {
      const profile = getBidderProfile('bidder-demo');
      const bid = getOrCreateDraftBid(tenderId, profile.bidder_id);
      updateBid({ ...bid, ...submissionData, submission_status: 'Submitted' });
      return { bid_id: bid.bid_id, tender_id: tenderId, status: 'Submitted' };
    }
    const response = await apiClient.post(`/bidders/${tenderId}/submit`, submissionData);
    return response.data;
  },

  getSubmissionStatus: async (submissionId: string) => {
    if (isDemoModeEnabled()) {
      return getBidById(submissionId);
    }
    const response = await apiClient.get(`/bidders/submissions/${submissionId}/status`);
    return response.data;
  },

  getMySubmissions: async () => {
    if (isDemoModeEnabled()) {
      return demoSubmissions();
    }
    const response = await apiClient.get('/bidders/my-submissions');
    return response.data;
  },
};

export const bidderDocumentService = {
  upload: async (payload: {
    file: File;
    tender_id: string;
    bidder_id?: string;
    document_category: string;
    linked_requirement_id?: string;
  }) => {
    if (isDemoModeEnabled()) {
      const profile = getBidderProfile(payload.bidder_id || 'bidder-demo');
      const tender = getTenderForBidder(payload.tender_id);
      const bid = getOrCreateDraftBid(payload.tender_id, profile.bidder_id);
      const requirement = tender.document_requirements.find((item) => item.document_requirement_id === payload.linked_requirement_id)
        || tender.document_requirements.find((item) => item.is_mandatory);
      const document = onDocumentUploaded(
        bid,
        requirement?.document_requirement_id || payload.linked_requirement_id || 'DOC-DEMO',
        payload.file,
        payload.bidder_id || profile.bidder_id,
      );
      onExtractionCompleted(bid, document.bid_document_id, requirement?.document_requirement_id || 'DOC-DEMO', profile);
      return {
        bid_document_id: document.bid_document_id,
        original_file_name: document.file_name,
        document_category: payload.document_category,
        ocr_status: 'SUCCEEDED',
      };
    }
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('tender_id', payload.tender_id);
    formData.append('document_category', payload.document_category);
    if (payload.bidder_id) formData.append('bidder_id', payload.bidder_id);
    if (payload.linked_requirement_id) formData.append('linked_requirement_id', payload.linked_requirement_id);
    const response = await apiClient.post('/bidders/documents/upload', formData);
    return response.data;
  },

  list: async (params: { tender_id?: string; bidder_id?: string } = {}) => {
    if (isDemoModeEnabled()) {
      return getDocuments().filter((document: any) => {
        const matchesTender = !params.tender_id || document.tender_id === params.tender_id || getBidById(document.bid_id)?.tender_id === params.tender_id;
        const matchesBidder = !params.bidder_id || getBidById(document.bid_id)?.bidder_id === params.bidder_id;
        return matchesTender && matchesBidder;
      }).map((document: any) => ({
        ...document,
        tender_id: getBidById(document.bid_id)?.tender_id || params.tender_id || '',
        bidder_id: getBidById(document.bid_id)?.bidder_id || params.bidder_id || '',
        original_file_name: document.file_name,
        document_category: document.linked_tender_document_requirement_id,
        ocr_status: 'SUCCEEDED',
        ocr_markdown_path: null,
        ocr_page_json_path: null,
      }));
    }
    const response = await apiClient.get('/bidders/documents', { params });
    return response.data;
  },

  getFacts: async (documentId: string) => {
    if (isDemoModeEnabled()) {
      return getFacts().filter((fact) => fact.source_bid_document_id === documentId).map((fact) => ({
        fact_id: fact.fact_id,
        document_id: documentId,
        bid_id: fact.bid_id,
        tender_id: getBidById(fact.bid_id)?.tender_id || '',
        fact_type: fact.fact_type,
        label: fact.fact_name,
        value_raw: fact.fact_value,
        value_normalized: { value: fact.fact_value, unit: fact.unit },
        unit: fact.unit,
        financial_year: null,
        page_hint: String(fact.source_page_number || ''),
        snippet: `${fact.fact_name}: ${fact.fact_value}`,
        table_context: null,
        status: fact.bidder_flagged_ignore ? 'AMBIGUOUS' : 'CONFIRMED',
        ambiguity_reason: fact.bidder_note || null,
        related_tender_criteria_ids: [],
      }));
    }
    const response = await apiClient.get(`/bidders/documents/${documentId}/facts`);
    return response.data;
  },

  confirmFact: async (documentId: string, factId: string, confirmation: { confirmed: boolean; corrected_value?: string; comment?: string }) => {
    if (isDemoModeEnabled()) {
      updateFactBidderView(factId, !confirmation.confirmed, confirmation.corrected_value || confirmation.comment || '');
      return { ok: true };
    }
    const response = await apiClient.post(`/bidders/documents/${documentId}/facts/${factId}/confirm`, confirmation);
    return response.data;
  },

  applyFactToProfile: async (documentId: string, factId: string) => {
    if (isDemoModeEnabled()) {
      const facts = getFacts().filter((fact) => fact.fact_id === factId);
      const profile = getBidderProfile('bidder-demo');
      const targetFact = facts[0];
      if (targetFact) {
        const nextProfile = {
          ...profile,
          organisation_name: profile.organisation_name || 'Satyam Secure Systems Pvt. Ltd.',
        };
        saveBidderProfile(nextProfile);
      }
      return { ok: true };
    }
    const response = await apiClient.post(`/bidders/documents/${documentId}/facts/${factId}/apply-to-profile`);
    return response.data;
  },

  evaluateTender: async (tenderId: string, bidderId?: string) => {
    if (isDemoModeEnabled()) {
      const profile = getBidderProfile('bidder-demo');
      const bid = getOrCreateDraftBid(tenderId, bidderId || profile.bidder_id);
      onEvaluationUpdated(bid.bid_id);
      return { evaluated: true, bid_id: bid.bid_id };
    }
    const response = await apiClient.post(`/bidders/tenders/${tenderId}/evaluate`, null, {
      params: bidderId ? { bidder_id: bidderId } : undefined,
    });
    return response.data;
  },

  getEvaluationReport: async (tenderId: string) => {
    if (isDemoModeEnabled()) {
      const tenders = getPublishedTenderDiscovery();
      const tender = tenders.find((item) => item.tender_id === tenderId) || tenders[0];
      const profile = getBidderProfile('bidder-demo');
      const bid = getOrCreateDraftBid(tender.tender_id, profile.bidder_id);
      onEvaluationUpdated(bid.bid_id);
      const snapshot = getSnapshots().find((item) => item.bid_id === bid.bid_id);
      return {
        tender_id: tender.tender_id,
        bidders: [
          {
            bidder_id: profile.bidder_id,
            overall_result: snapshot?.overall_status === 'NeedManualReview' ? 'REVIEW' : 'PASS',
            criteria_breakdown: {
              passed: snapshot?.details_json.filter((item) => item.status === 'Pass').length || 0,
              failed: snapshot?.details_json.filter((item) => item.status === 'Fail').length || 0,
              review: snapshot?.details_json.filter((item) => item.status === 'Review').length || 0,
            },
          },
        ],
      };
    }
    const response = await apiClient.get(`/bidders/tenders/${tenderId}/evaluation-report`);
    return response.data;
  },
};

// Evaluation Service
export const evaluationService = {
  evaluateBidder: async (tenderId: string, bidderId: string) => {
    if (isDemoModeEnabled()) {
      const profile = getBidderProfile('bidder-demo');
      const bid = getOrCreateDraftBid(tenderId, bidderId || profile.bidder_id);
      onEvaluationUpdated(bid.bid_id);
      return { bid_id: bid.bid_id, bidder_id: bidderId || profile.bidder_id };
    }
    const response = await apiClient.post(`/evaluation/${tenderId}/evaluate/${bidderId}`);
    return response.data;
  },

  getComparison: async (tenderId: string) => {
    if (isDemoModeEnabled()) {
      const profile = getBidderProfile('bidder-demo');
      const bid = getOrCreateDraftBid(tenderId, profile.bidder_id);
      onEvaluationUpdated(bid.bid_id);
      const snapshot = getSnapshots().find((item) => item.bid_id === bid.bid_id);
      const docs = getDocuments().filter((document) => document.bid_id === bid.bid_id);
      const facts = getFacts().filter((fact) => fact.bid_id === bid.bid_id);
      return {
        tender_id: tenderId,
        bidders: [
          {
            bidder_id: profile.bidder_id,
            overall_result: snapshot?.overall_status === 'NeedManualReview' ? 'REVIEW' : 'PASS',
            criteria_breakdown: {
              passed: snapshot?.details_json.filter((item) => item.status === 'Pass').length || 0,
              failed: snapshot?.details_json.filter((item) => item.status === 'Fail').length || 0,
              review: snapshot?.details_json.filter((item) => item.status === 'Review').length || 0,
            },
            document_count: docs.length,
            fact_count: facts.length,
          },
          {
            bidder_id: 'Rival Infra Solutions',
            overall_result: 'REVIEW',
            criteria_breakdown: { passed: 2, failed: 0, review: 1 },
            document_count: 3,
            fact_count: 4,
          },
          {
            bidder_id: 'BlueLine Systems',
            overall_result: 'FAIL',
            criteria_breakdown: { passed: 1, failed: 2, review: 1 },
            document_count: 2,
            fact_count: 2,
          },
        ],
      };
    }
    const response = await apiClient.get(`/evaluation/${tenderId}/comparison`);
    return response.data;
  },

  getVerificationCard: async (evaluationId: string, criterionId: string) => {
    if (isDemoModeEnabled()) {
      return {
        evaluation_id: evaluationId,
        criterion_id: criterionId,
        status: 'Review',
        explanation: 'Mock verification card generated in demo mode.',
      };
    }
    const response = await apiClient.get(`/evaluation/${evaluationId}/verification-card/${criterionId}`);
    return response.data;
  },

  overrideCriterion: async (evaluationId: string, criterionId: string, newStatus: string, comment: string) => {
    if (isDemoModeEnabled()) {
      return { evaluationId, criterionId, newStatus, comment, saved: true };
    }
    const response = await apiClient.post(`/evaluation/${evaluationId}/override/${criterionId}`, null, {
      params: { new_status: newStatus, comment }
    });
    return response.data;
  },

  getReport: async (evaluationId: string) => {
    if (isDemoModeEnabled()) {
      const snapshot = getSnapshots().find((item) => item.snapshot_id === evaluationId || item.bid_id === evaluationId);
      return snapshot || {
        snapshot_id: evaluationId,
        overall_status: 'NotYetEvaluated',
        summary_text: 'No demo report available yet.',
        details_json: [],
      };
    }
    const response = await apiClient.get(`/evaluation/${evaluationId}/report`);
    return response.data;
  },
};

export default apiClient;
