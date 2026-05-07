import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, CheckCircle, Eye, FileText, Loader2, RefreshCw, Save, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bidderDocumentService, bidderService, getApiErrorMessage } from '../services/api';
import { isDemoModeEnabled } from '../services/demoMode';
import { getPublishedTenderDiscovery } from '../services/bidderPortalMock';

type DocumentCategory = 'financials' | 'registration' | 'experience_certificate' | 'tax' | 'technical_catalogue' | 'other';

type DocumentFact = {
  fact_id: string;
  document_id: string;
  bid_id: string;
  tender_id: string;
  fact_type: string;
  label: string;
  value_raw: string;
  value_normalized?: Record<string, unknown> | null;
  unit: string;
  financial_year?: string | null;
  page_hint?: string | null;
  snippet?: string | null;
  table_context?: string | null;
  status: 'CONFIRMED' | 'AMBIGUOUS' | 'NOT_FOUND';
  ambiguity_reason?: string | null;
  related_tender_criteria_ids?: string[];
};

type UploadedDocument = {
  bid_document_id: string;
  original_file_name: string;
  document_category: DocumentCategory;
  ocr_status: string;
  ocr_markdown_path?: string | null;
  ocr_page_json_path?: string | null;
  tender_id?: string | null;
  bidder_id?: string | null;
};

const categoryOptions: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'registration', label: 'Registration' },
  { value: 'financials', label: 'Financials' },
  { value: 'experience_certificate', label: 'Experience Certificate' },
  { value: 'tax', label: 'Tax' },
  { value: 'technical_catalogue', label: 'Technical Catalogue' },
  { value: 'other', label: 'Other' },
];

const factProfileMap: Record<string, Array<{ field: string; label: string }>> = {
  GSTIN: [{ field: 'gstin', label: 'GSTIN' }],
  PAN: [{ field: 'pan', label: 'PAN' }],
  CIN: [{ field: 'cin', label: 'CIN' }],
  UDYAM: [{ field: 'udyam_no', label: 'Udyam No.' }],
  NSIC: [{ field: 'nsic_registration_no', label: 'NSIC No.' }],
  REGISTRATION_NAME: [{ field: 'organisation_name', label: 'Organisation Name' }],
  ADDRESS: [{ field: 'registered_address', label: 'Registered Address' }],
};

const DocumentUpload: React.FC = () => {
  const { user } = useAuth();
  const tenders = useMemo(() => getPublishedTenderDiscovery(), []);
  const [bidderId, setBidderId] = useState('');
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.tender_id || '');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('registration');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [facts, setFacts] = useState<DocumentFact[]>([]);
  const [report, setReport] = useState<any>(null);
  const [factDrafts, setFactDrafts] = useState<Record<string, { comment: string; correctedValue: string; mode: 'confirm' | 'wrong' }>>({});
  const [demoSeeded, setDemoSeeded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await bidderService.getProfile();
        setBidderId(profile.bidder_id || user?.id || '');
      } catch {
        setBidderId(user?.id || '');
      }
    };
    load();
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!selectedTenderId || !bidderId) return;
    setRefreshing(true);
    setError('');
    try {
      const nextDocuments = await bidderDocumentService.list({ tender_id: selectedTenderId, bidder_id: bidderId });
      setDocuments(nextDocuments || []);
      const first = nextDocuments?.[0]?.bid_document_id || '';
      const docId = selectedDocumentId || first;
      if (docId) {
        const nextFacts = await bidderDocumentService.getFacts(docId);
        setFacts(nextFacts || []);
        setSelectedDocumentId(docId);
      }
      const nextReport = await bidderDocumentService.getEvaluationReport(selectedTenderId);
      setReport(nextReport);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Unable to load document registry.'));
    } finally {
      setRefreshing(false);
    }
  }, [bidderId, selectedDocumentId, selectedTenderId]);

  useEffect(() => {
    if (!selectedTenderId || !bidderId) return;
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [selectedTenderId, bidderId, refresh]);

  useEffect(() => {
    const seedDemoDocuments = async () => {
      if (!isDemoModeEnabled() || demoSeeded || !bidderId || !selectedTenderId || documents.length > 0) return;

      const tender = tenders.find((item) => item.tender_id === selectedTenderId);
      const seedPlan = [
        { name: 'GST_Registration_Certificate.pdf', category: 'registration' },
        { name: 'PAN_Card_Proof.pdf', category: 'registration' },
        { name: 'Audited_Financials_2024.pdf', category: 'financials' },
        { name: 'Experience_Certificates_Annexure.pdf', category: 'experience_certificate' },
      ] as const;

      setDemoSeeded(true);
      for (const item of seedPlan) {
        const file = new File(['demo'], item.name, { type: 'application/pdf' });
        await bidderDocumentService.upload({
          file,
          tender_id: selectedTenderId,
          bidder_id: bidderId,
          document_category: item.category,
          linked_requirement_id: tender?.document_requirements.find((requirement) => requirement.name.toLowerCase().includes(item.name.split('_')[0].toLowerCase()))?.document_requirement_id,
        });
      }
      await refresh();
      setMessage('Demo document set loaded with mock GST, PAN, financial, and experience evidence.');
    };

    void seedDemoDocuments();
  }, [bidderId, demoSeeded, documents.length, refresh, selectedTenderId, tenders]);

  const onDrop = (acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError('');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const uploadFiles = async () => {
    if (!files.length || !selectedTenderId || !bidderId) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      for (const file of files) {
        await bidderDocumentService.upload({
          file,
          tender_id: selectedTenderId,
          bidder_id: bidderId,
          document_category: selectedCategory,
        });
      }
      setFiles([]);
      setMessage('Files uploaded. OCR and extraction are now queued.');
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const selectedDocument = documents.find((item) => item.bid_document_id === selectedDocumentId);

  const loadFacts = async (documentId: string) => {
    setSelectedDocumentId(documentId);
    setError('');
    try {
      const nextFacts = await bidderDocumentService.getFacts(documentId);
      setFacts(nextFacts || []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Unable to load detected data.'));
    }
  };

  const confirmFact = async (fact: DocumentFact, confirmed: boolean, correctedValue = '', comment = '') => {
    try {
      await bidderDocumentService.confirmFact(fact.document_id, fact.fact_id, {
        confirmed,
        corrected_value: correctedValue || undefined,
        comment: comment || undefined,
      });
      setMessage(confirmed ? 'Marked as correct.' : 'Marked as needing review.');
      await loadFacts(fact.document_id);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Unable to save confirmation.'));
    }
  };

  const applyFactToProfile = async (fact: DocumentFact) => {
    try {
      await bidderDocumentService.applyFactToProfile(fact.document_id, fact.fact_id);
      setMessage('Suggested fact applied to profile.');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Unable to apply fact to profile.'));
    }
  };

  const documentStatusTone = (status: string) => {
    if (status === 'SUCCEEDED') return 'status-pass';
    if (status === 'FAILED') return 'status-fail';
    if (status === 'RUNNING') return 'status-review';
    return 'status-pending';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bidder Document Hub</h1>
          <p className="text-gray-600 mt-1">Upload, review OCR, confirm facts, and reuse evidence across the bidder profile and evaluation flow.</p>
        </div>
        <button type="button" onClick={refresh} className="btn-secondary inline-flex items-center justify-center" disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 animate-spin" size={16} /> : <RefreshCw className="mr-2" size={16} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 flex items-center">
          <AlertCircle className="mr-2" size={20} />
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 bg-success-50 border border-success-200 rounded-lg text-success-700 flex items-center">
          <CheckCircle className="mr-2" size={20} />
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tender</span>
                <select className="input-field mt-1" value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
                  {tenders.map((tender) => (
                    <option key={tender.tender_id} value={tender.tender_id}>{tender.tender_name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Document Category</span>
                <select className="input-field mt-1" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as DocumentCategory)}>
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Bidder Id</span>
                <input className="input-field mt-1" value={bidderId} onChange={(event) => setBidderId(event.target.value)} />
              </label>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">{isDragActive ? 'Drop files here' : 'Drag & drop files here'}</p>
              <p className="text-sm text-gray-600">PDF, JPEG, PNG, TIFF, DOCX up to 50MB</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.name} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="text-primary-600" size={18} />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">{selectedCategory}</span>
                  </div>
                ))}
                <button type="button" onClick={uploadFiles} disabled={uploading} className="btn-primary inline-flex items-center justify-center">
                  {uploading ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Upload className="mr-2" size={16} />}
                  Upload {files.length} file{files.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Uploaded Documents</h2>
              <span className="text-sm text-gray-500">{documents.length} document{documents.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid gap-3">
              {documents.map((document) => (
                <button
                  key={document.bid_document_id}
                  type="button"
                  onClick={() => loadFacts(document.bid_document_id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${selectedDocumentId === document.bid_document_id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{document.original_file_name}</p>
                      <p className="text-sm text-gray-500">{document.document_category} · {document.tender_id}</p>
                    </div>
                    <span className={`status-badge ${documentStatusTone(document.ocr_status)}`}>{document.ocr_status}</span>
                  </div>
                </button>
              ))}
              {documents.length === 0 && (
                <div className="text-center py-8 text-gray-500">No uploaded documents yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Detected Data</h2>
              <Eye size={16} className="text-gray-400" />
            </div>
            {selectedDocument ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">{selectedDocument.original_file_name}</p>
                  <p>Status: {selectedDocument.ocr_status}</p>
                </div>
                {facts.map((fact) => (
                  <div key={fact.fact_id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{fact.label}</p>
                        <p className="text-xs text-gray-500">{fact.fact_type} · {fact.status}</p>
                      </div>
                      <span className={`status-badge ${fact.status === 'CONFIRMED' ? 'status-pass' : fact.status === 'AMBIGUOUS' ? 'status-review' : 'status-pending'}`}>{fact.unit}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{fact.value_raw}</p>
                    {fact.value_normalized && (
                      <p className="text-xs text-gray-500 mt-1">Normalized: {JSON.stringify(fact.value_normalized)}</p>
                    )}
                    {fact.snippet && <p className="text-xs text-gray-500 mt-1">Page {fact.page_hint || 'N/A'}: {fact.snippet}</p>}
                    {fact.ambiguity_reason && <p className="text-xs text-warning-700 mt-1">{fact.ambiguity_reason}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => confirmFact(fact, true)} className="btn-secondary inline-flex items-center justify-center text-xs px-3 py-1">
                        <CheckCircle size={14} className="mr-1" />
                        Looks correct
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmFact(fact, false, factDrafts[fact.fact_id]?.correctedValue || '', factDrafts[fact.fact_id]?.comment || '')}
                        className="btn-secondary inline-flex items-center justify-center text-xs px-3 py-1"
                      >
                        Mark wrong
                      </button>
                      {factProfileMap[fact.fact_type] && (
                        <button type="button" onClick={() => applyFactToProfile(fact)} className="btn-primary inline-flex items-center justify-center text-xs px-3 py-1">
                          <Save size={14} className="mr-1" />
                          Apply to Profile
                        </button>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      <input
                        className="input-field text-sm"
                        placeholder="Corrected value or note"
                        value={factDrafts[fact.fact_id]?.correctedValue || ''}
                        onChange={(event) => setFactDrafts((current) => ({
                          ...current,
                          [fact.fact_id]: { ...current[fact.fact_id], correctedValue: event.target.value, comment: current[fact.fact_id]?.comment || '', mode: 'wrong' },
                        }))}
                      />
                      <input
                        className="input-field text-sm"
                        placeholder="Optional comment"
                        value={factDrafts[fact.fact_id]?.comment || ''}
                        onChange={(event) => setFactDrafts((current) => ({
                          ...current,
                          [fact.fact_id]: { ...current[fact.fact_id], comment: event.target.value, correctedValue: current[fact.fact_id]?.correctedValue || '', mode: 'wrong' },
                        }))}
                      />
                    </div>
                  </div>
                ))}
                {facts.length === 0 && <p className="text-sm text-gray-500">No structured facts detected yet.</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a document to inspect detected data.</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Evaluation Report</h2>
            {report ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Tender {report.tender_id}</p>
                <div className="space-y-3">
                  {(report.bidders || []).map((bidder: any) => (
                    <div key={bidder.bidder_id} className="rounded-lg border border-gray-200 p-3">
                      <p className="font-medium text-gray-900">{bidder.bidder_id}</p>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Eligible: {bidder.buckets?.['Clearly Eligible']?.length || 0}</p>
                        <p>Not eligible: {bidder.buckets?.['Clearly Not Eligible']?.length || 0}</p>
                        <p>Manual review: {bidder.buckets?.['Need Manual Review']?.length || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Upload and evaluate documents to see report data here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
