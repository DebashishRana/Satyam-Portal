import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck,
  FileText,
  Info,
  Send,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  BidDocument,
  BidSubmissionEntity,
  ExtractedFact,
  ExtractionJob,
  getBidderProfile,
  getDocuments,
  getFacts,
  getJobs,
  getOrCreateDraftBid,
  getTenderForBidder,
  markJobsManualCheck,
  markJobsRunning,
  onDocumentUploaded,
  onExtractionCompleted,
  resetBidRequirementDocuments,
  submitBid,
  updateBid,
  updateFactBidderView,
  validateGstin,
  validatePan,
} from '../services/bidderPortalMock';
import { bidderDocumentService, getApiErrorMessage } from '../services/api';
import { isDemoModeEnabled } from '../services/demoMode';

type StepKey = 'Profile' | 'ChooseTender' | 'UploadDocuments' | 'ReviewExtractedData' | 'SubmitBid' | 'TrackStatus';
type DocumentCategory = 'financials' | 'registration' | 'experience_certificate' | 'tax' | 'technical_catalogue' | 'other';

const steps: Array<{ key: StepKey; label: string }> = [
  { key: 'Profile', label: 'Profile' },
  { key: 'ChooseTender', label: 'Choose Tender' },
  { key: 'UploadDocuments', label: 'Upload Documents' },
  { key: 'ReviewExtractedData', label: 'Review Extracted Data' },
  { key: 'SubmitBid', label: 'Submit Bid' },
  { key: 'TrackStatus', label: 'Track Status' },
];

const statusText = (status: string) => status.replace(/([A-Z])/g, ' $1').trim();

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const documentState = (documents: BidDocument[], jobs: ExtractionJob[]) => {
  if (documents.length === 0) return { label: 'Not uploaded', className: 'status-pending' };
  const docIds = documents.map((document) => document.bid_document_id);
  const docJobs = jobs.filter((job) => docIds.includes(job.bid_document_id));
  if (docJobs.some((job) => job.status === 'Pending' || job.status === 'Running')) return { label: 'Processing OCR', className: 'status-review' };
  if (docJobs.length > 0 && docJobs.every((job) => job.status === 'Succeeded' || job.status === 'ManualCheck')) return { label: 'Ready', className: 'status-pass' };
  return { label: 'Uploaded', className: 'status-review' };
};

const BidSubmission: React.FC = () => {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(() => getBidderProfile(user?.id || 'bidder-demo'));
  const [bid, setBid] = useState<BidSubmissionEntity | null>(null);
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [activeStep, setActiveStep] = useState<StepKey>('UploadDocuments');
  const [submissionError, setSubmissionError] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');

  const tender = useMemo(() => getTenderForBidder(tenderId || ''), [tenderId]);
  const profileComplete = validateGstin(profile.gstin) && validatePan(profile.pan) && !!profile.organisation_name && !!profile.registered_address;

  const inferDocumentCategory = (requirementId: string): DocumentCategory => {
    const requirement = tender.document_requirements.find((item) => item.document_requirement_id === requirementId);
    const requirementText = `${requirement?.name || ''} ${requirement?.description || ''}`.toLowerCase();

    if (requirementText.includes('gst') || requirementText.includes('pan') || requirementText.includes('registration')) {
      return 'registration';
    }
    if (requirementText.includes('financial') || requirementText.includes('turnover') || requirementText.includes('audited')) {
      return 'financials';
    }
    if (requirementText.includes('experience') || requirementText.includes('work order') || requirementText.includes('certificate')) {
      return 'experience_certificate';
    }
    if (requirementText.includes('tax') || requirementText.includes('itr') || requirementText.includes('income tax')) {
      return 'tax';
    }
    if (requirementText.includes('technical') || requirementText.includes('catalogue') || requirementText.includes('brochure')) {
      return 'technical_catalogue';
    }
    return 'other';
  };

  const refreshBidState = React.useCallback((currentBid: BidSubmissionEntity | null) => {
    if (!currentBid) return;
    const bidDocuments = getDocuments().filter((document) => document.bid_id === currentBid.bid_id);
    const docIds = bidDocuments.map((document) => document.bid_document_id);
    setDocuments(bidDocuments);
    setJobs(getJobs().filter((job) => docIds.includes(job.bid_document_id)));
    setFacts(getFacts().filter((fact) => fact.bid_id === currentBid.bid_id));
  }, []);

  useEffect(() => {
    if (!tenderId) return;
    const nextProfile = getBidderProfile(user?.id || 'bidder-demo');
    const draftBid = getOrCreateDraftBid(tenderId, nextProfile.bidder_id);
    if (isDemoModeEnabled()) {
      const resetKey = `satyam.demo.upload-reset.${tenderId}.${nextProfile.bidder_id}`;
      if (!window.sessionStorage.getItem(resetKey)) {
        resetBidRequirementDocuments(
          draftBid.bid_id,
          tender.document_requirements.map((requirement) => requirement.document_requirement_id),
        );
        window.sessionStorage.setItem(resetKey, 'true');
      }
    }
    setProfile(nextProfile);
    setBid(draftBid);
    refreshBidState(draftBid);
  }, [refreshBidState, tender, tenderId, user?.id]);

  const mandatoryRequirements = tender.document_requirements.filter((requirement) => requirement.is_mandatory);
  const uploadedMandatoryCount = mandatoryRequirements.filter((requirement) => (
    documents.some((document) => document.linked_tender_document_requirement_id === requirement.document_requirement_id)
  )).length;
  const allMandatoryUploaded = uploadedMandatoryCount === mandatoryRequirements.length;
  const mandatoryDocumentIds = documents
    .filter((document) => mandatoryRequirements.some((requirement) => requirement.document_requirement_id === document.linked_tender_document_requirement_id))
    .map((document) => document.bid_document_id);
  const mandatoryJobs = jobs.filter((job) => mandatoryDocumentIds.includes(job.bid_document_id));
  const extractionReady = allMandatoryUploaded
    && mandatoryDocumentIds.length > 0
    && mandatoryDocumentIds.every((documentId) => {
      const related = mandatoryJobs.filter((job) => job.bid_document_id === documentId);
      return related.length > 0 && related.every((job) => job.status === 'Succeeded' || job.status === 'ManualCheck');
    });

  const handleUpload = async (requirementId: string, fileList: FileList | null) => {
    if (!bid || !fileList?.length) return;
    const file = fileList[0];
    setSubmissionError('');
    setSubmissionMessage('');

    if (isDemoModeEnabled()) {
      try {
        await bidderDocumentService.upload({
          file,
          tender_id: bid.tender_id,
          bidder_id: user?.id || profile.login_user_id,
          document_category: inferDocumentCategory(requirementId),
          linked_requirement_id: requirementId,
        });
        refreshBidState(bid);
        setSubmissionMessage('Document uploaded. Previous file for this requirement was cleared and replaced.');
      } catch (err: any) {
        setSubmissionError(getApiErrorMessage(err, 'Upload failed.'));
      }
      return;
    }

    const document = onDocumentUploaded(bid, requirementId, file, user?.id || profile.login_user_id);
    markJobsRunning(document.bid_document_id);
    refreshBidState(bid);

    const backendUpload = bidderDocumentService.upload({
      file,
      tender_id: bid.tender_id,
      bidder_id: user?.id || profile.login_user_id,
      document_category: inferDocumentCategory(requirementId),
      linked_requirement_id: requirementId,
    });

    window.setTimeout(() => {
      onExtractionCompleted(bid, document.bid_document_id, requirementId, profile);
      refreshBidState(bid);
    }, 700);

    try {
      await backendUpload;
      setSubmissionMessage('Document uploaded to the backend and queued for Sarvam OCR.');
    } catch (err: any) {
      setSubmissionError(getApiErrorMessage(err, 'Backend OCR upload failed. The local preview still updated.'));
    }
  };

  const handleManualCheck = (documentId: string) => {
    markJobsManualCheck(documentId);
    refreshBidState(bid);
  };

  const handleFactViewUpdate = (factId: string, flagged: boolean, note: string) => {
    updateFactBidderView(factId, flagged, note);
    refreshBidState(bid);
  };

  const updatePrice = (value: string) => {
    if (!bid) return;
    const quotedTotalPrice: number | '' = value ? Number(value) : '';
    const nextBid: BidSubmissionEntity = { ...bid, quoted_total_price: quotedTotalPrice };
    updateBid(nextBid);
    setBid(nextBid);
  };

  const handleSubmit = () => {
    if (!bid) return;
    setSubmissionError('');
    if (!profileComplete) {
      setSubmissionError('Complete profile details with valid GSTIN and PAN before submission.');
      setActiveStep('Profile');
      return;
    }
    if (!allMandatoryUploaded) {
      setSubmissionError('Upload all mandatory documents before submission.');
      setActiveStep('UploadDocuments');
      return;
    }
    if (!extractionReady) {
      setSubmissionError('Wait for extraction to finish, or mark failed documents for manual checking.');
      setActiveStep('UploadDocuments');
      return;
    }
    const submitted = submitBid(bid.bid_id);
    if (submitted) {
      setBid(submitted);
      navigate(`/submission-status/${submitted.bid_id}`);
    }
  };

  const keyFacts = useMemo(() => {
    const seen = new Set<string>();
    return facts.filter((fact) => {
      if (!['Turnover', 'GSTIN', 'PAN', 'YearsExperience', 'ProjectCount'].includes(fact.fact_type)) {
        return false;
      }
      const signature = [fact.fact_type, fact.fact_name, fact.fact_value, fact.tender_criterion_id].join('|');
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }, [facts]);

  if (!bid) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const readOnly = bid.submission_status !== 'Draft';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-sm text-gray-500">{tender.tender_id}</p>
          <h1 className="text-2xl font-bold text-gray-900">{tender.tender_name}</h1>
          <p className="text-gray-600 mt-1">{tender.unit_or_formation} · {tender.category}</p>
        </div>
        <Link to={`/submission-status/${bid.bid_id}`} className="btn-secondary inline-flex items-center justify-center">
          Track Status
        </Link>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {steps.map((step, index) => {
            const isActive = activeStep === step.key;
            const isDone = (step.key === 'Profile' && profileComplete)
              || (step.key === 'ChooseTender')
              || (step.key === 'UploadDocuments' && allMandatoryUploaded)
              || (step.key === 'ReviewExtractedData' && keyFacts.length > 0)
              || (step.key === 'SubmitBid' && bid.submission_status !== 'Draft')
              || (step.key === 'TrackStatus' && bid.submission_status !== 'Draft');
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(step.key)}
                className={`text-left rounded-lg border p-3 transition-colors ${isActive ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Step {index + 1}</span>
                  {isDone ? <CheckCircle size={16} className="text-success-600" /> : <Clock size={16} className="text-gray-400" />}
                </div>
                <p className={`mt-1 text-sm font-semibold ${isActive ? 'text-primary-900' : 'text-gray-900'}`}>{step.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {submissionError && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 flex items-center">
          <AlertCircle className="mr-2 flex-shrink-0" size={20} />
          {submissionError}
        </div>
      )}
      {submissionMessage && (
        <div className="p-4 bg-success-50 border border-success-200 rounded-lg text-success-700 flex items-center">
          <CheckCircle className="mr-2 flex-shrink-0" size={20} />
          {submissionMessage}
        </div>
      )}

      {activeStep === 'Profile' && (
        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{profile.organisation_name || 'Organisation profile incomplete'}</h2>
              <p className="text-sm text-gray-600 mt-1">{profile.contact_name || 'Contact not set'} · {profile.contact_email || 'Email not set'}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`status-badge ${validateGstin(profile.gstin) ? 'status-pass' : 'status-fail'}`}>GSTIN {validateGstin(profile.gstin) ? 'valid' : 'missing/invalid'}</span>
                <span className={`status-badge ${validatePan(profile.pan) ? 'status-pass' : 'status-fail'}`}>PAN {validatePan(profile.pan) ? 'valid' : 'missing/invalid'}</span>
                <span className="status-badge status-review">{profile.type}</span>
              </div>
            </div>
            <Link to="/bidder/profile" className="btn-primary inline-flex items-center justify-center">Update Profile</Link>
          </div>
        </div>
      )}

      {activeStep === 'ChooseTender' && (
        <div className="card space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estimated value</p>
              <p className="font-semibold">INR {tender.estimated_value_amount.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Bid closes</p>
              <p className="font-semibold">{new Date(tender.bid_submission_end).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Criteria</p>
              <p className="font-semibold">{tender.criteria_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mandatory docs</p>
              <p className="font-semibold">{tender.mandatory_documents_count}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Document checklist</h3>
            <div className="grid gap-3">
              {tender.document_requirements.map((requirement) => (
                <div key={requirement.document_requirement_id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{requirement.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{requirement.description}</p>
                    </div>
                    <span className={`status-badge ${requirement.is_mandatory ? 'status-review' : 'status-pending'}`}>{requirement.is_mandatory ? 'Mandatory' : 'Optional'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeStep === 'UploadDocuments' && (
        <div className="grid gap-4">
          <div className="p-4 bg-primary-50 border border-primary-100 rounded-lg flex items-start">
            <Info className="text-primary-600 mr-3 mt-0.5 flex-shrink-0" size={20} />
            <p className="text-sm text-primary-900" title="AI only assists extraction; eligibility decisions are made by configured rules and officers.">
              Upload PDFs, scans, photos, Word, or spreadsheets. Each upload triggers OnDocumentUploaded and queues OCR, table extraction, entity extraction, and verification jobs.
            </p>
          </div>

          {tender.document_requirements.map((requirement) => {
            const requirementDocuments = documents.filter((document) => document.linked_tender_document_requirement_id === requirement.document_requirement_id);
            const state = documentState(requirementDocuments, jobs);
            return (
              <div key={requirement.document_requirement_id} className="card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{requirement.name}</h3>
                      <span className={`status-badge ${state.className}`}>{state.label}</span>
                      {requirement.is_mandatory && <span className="status-badge status-review">Mandatory</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{requirement.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Formats: {requirement.allowed_formats} · Max {requirement.max_file_size_mb} MB · {requirement.requires_signature ? 'Signature expected' : 'Signature not required'} · {requirement.requires_stamp ? 'Stamp expected' : 'Stamp not required'}</p>
                  </div>
                  <label className={`btn-primary inline-flex items-center justify-center cursor-pointer ${readOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                    <Upload size={16} className="mr-2" />
                    Upload
                    <input
                      className="hidden"
                      type="file"
                      disabled={readOnly}
                      accept={requirement.allowed_formats.split(',').map((format) => `.${format.trim()}`).join(',')}
                      onChange={(event) => {
                        void handleUpload(requirement.document_requirement_id, event.target.files);
                      }}
                    />
                  </label>
                </div>

                {requirementDocuments.length > 0 && (
                  <div className="mt-4 divide-y divide-gray-100 border rounded-lg">
                    {requirementDocuments.map((document) => {
                      const docJobs = jobs.filter((job) => job.bid_document_id === document.bid_document_id);
                      const documentFacts = facts.filter((fact) => fact.source_bid_document_id === document.bid_document_id);
                      return (
                        <div key={document.bid_document_id} className="p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start">
                              <FileText size={20} className="text-primary-600 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">{document.file_name}</p>
                                <p className="text-sm text-gray-500">{document.file_type.toUpperCase()} · {formatBytes(document.file_size_bytes)} · Signed: {document.is_signed ? 'Yes' : 'No'} · Stamped: {document.is_stamped ? 'Yes' : 'No'}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {docJobs.map((job) => (
                                <span key={job.extraction_job_id} className={`status-badge ${job.status === 'Succeeded' ? 'status-pass' : job.status === 'ManualCheck' ? 'status-review' : 'status-pending'}`}>
                                  {job.job_type}: {job.status}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            <span>{documentFacts.length} facts extracted</span>
                            {docJobs.some((job) => job.status === 'Failed' || job.status === 'Pending' || job.status === 'Running') && (
                              <button type="button" className="text-primary-700 font-medium" onClick={() => handleManualCheck(document.bid_document_id)}>
                                Mark failed/manual check
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeStep === 'ReviewExtractedData' && (
        <div className="space-y-4">
          <div className="p-4 bg-warning-50 border border-warning-100 rounded-lg flex items-start">
            <AlertCircle className="text-warning-600 mr-3 mt-0.5 flex-shrink-0" size={20} />
            <p className="text-sm text-warning-900" title="Bidder notes do not alter official extracted facts used for legal evaluation.">
              Confirm detected values or flag possible misreads. Your notes help debugging and clarifications, while official evaluation still uses submitted documents, rules, and officer decisions.
            </p>
          </div>

          <div className="grid gap-4">
            {keyFacts.map((fact) => (
              <div key={fact.fact_id} className="card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{fact.fact_name}</h3>
                      <span className="status-badge status-pass">{fact.fact_type}</span>
                      <span className="status-badge status-pending">{Math.round(fact.confidence * 100)}% confidence</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{fact.fact_value} {fact.unit !== 'None' ? fact.unit : ''}</p>
                    <p className="text-sm text-gray-600 mt-1">Source page {fact.source_page_number || 'N/A'} · Criterion {fact.tender_criterion_id || 'Not linked'}</p>
                  </div>
                  <div className="w-full lg:w-80 space-y-3">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        className="mr-2 h-4 w-4"
                        checked={!!fact.bidder_flagged_ignore}
                        disabled={readOnly}
                        onChange={(event) => handleFactViewUpdate(fact.fact_id, event.target.checked, fact.bidder_note || '')}
                      />
                      AI mis-read, please ignore
                    </label>
                    <textarea
                      className="input-field min-h-[80px]"
                      placeholder="Optional correction note"
                      value={fact.bidder_note || ''}
                      disabled={readOnly}
                      onChange={(event) => handleFactViewUpdate(fact.fact_id, !!fact.bidder_flagged_ignore, event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {keyFacts.length === 0 && (
            <div className="text-center py-12 card">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No detected values yet</h3>
              <p className="text-gray-600">Upload required documents and wait for extraction to finish.</p>
            </div>
          )}
        </div>
      )}

      {activeStep === 'SubmitBid' && (
        <div className="card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Profile</p>
              <p className="font-semibold">{profileComplete ? 'Ready' : 'Incomplete'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Mandatory documents</p>
              <p className="font-semibold">{uploadedMandatoryCount}/{mandatoryRequirements.length} uploaded</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Extraction</p>
              <p className="font-semibold">{extractionReady ? 'Ready for rules' : 'Pending/manual check needed'}</p>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Quoted total price</span>
            <input
              className="input-field mt-1"
              type="number"
              value={bid.quoted_total_price}
              disabled={readOnly}
              onChange={(event) => updatePrice(event.target.value)}
              placeholder="Optional until financial cover upload"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
            <p className="text-sm text-gray-600">Submission freezes bidder-editable fields and moves the bid into the evaluation workflow.</p>
            <button type="button" className="btn-primary inline-flex items-center justify-center" disabled={readOnly} onClick={handleSubmit}>
              <Send size={16} className="mr-2" />
              {readOnly ? `Submitted: ${statusText(bid.submission_status)}` : 'Submit Bid'}
            </button>
          </div>
        </div>
      )}

      {activeStep === 'TrackStatus' && (
        <div className="card text-center py-10">
          <CheckCircle className="mx-auto h-12 w-12 text-success-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Bid {statusText(bid.submission_status)}</h2>
          <p className="text-gray-600 mt-2">Use the tracker for evaluation snapshots, clarifications, and final award status.</p>
          <Link to={`/submission-status/${bid.bid_id}`} className="btn-primary inline-flex items-center justify-center mt-5">
            Track Status
          </Link>
        </div>
      )}
    </div>
  );
};

export default BidSubmission;
