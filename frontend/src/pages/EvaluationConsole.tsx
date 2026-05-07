import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  Eye,
  MessageSquare,
  Search,
} from 'lucide-react';
import {
  PortalCriterionVerdict,
  PortalQueryStatus,
  PortalQueryType,
  getCriterionById,
  getEvaluationPortalBidder,
  getEvaluationPortalTender,
  overridePortalCriterion,
  savePortalQuery,
} from '../services/evaluationPortalMock';

type QueryModalState = {
  isOpen: boolean;
  bidderId: string;
  bidderName: string;
  criteriaIds: string[];
  evidence: string[];
};

const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusPillClass = (status: string) => {
  if (status === 'Eligible') return 'status-pass';
  if (status === 'Not Eligible') return 'status-fail';
  if (status === 'Query Pending') return 'bg-sky-100 text-sky-800';
  return 'status-review';
};

const EvaluationConsole: React.FC = () => {
  const { tenderId } = useParams<{ tenderId: string }>();
  const [searchParams] = useSearchParams();
  const initialBidderId = searchParams.get('bidder') || '';

  const [, setRefreshKey] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{ criterionId: string; verdict: PortalCriterionVerdict; reason: string } | null>(null);
  const [queryModal, setQueryModal] = useState<QueryModalState | null>(null);
  const [message, setMessage] = useState('');

  const tender = getEvaluationPortalTender(tenderId || 'TENDER-DEMO-01');
  const bidder = getEvaluationPortalBidder(tenderId || 'TENDER-DEMO-01', initialBidderId);

  const selectedDocument = bidder?.documents.find((document) => document.documentId === selectedDocumentId) || bidder?.documents[0] || null;

  const showMessage = (nextMessage: string) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(''), 2500);
  };

  const handleMockDownload = (fileName: string, title: string) => {
    const blob = new Blob([`${title}\nGenerated for bidder evaluation preview.`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    showMessage(`${title} downloaded.`);
  };

  const handleOverride = () => {
    if (!tender || !bidder || !overrideTarget || !overrideTarget.reason.trim()) return;
    overridePortalCriterion(tender.tenderId, bidder.bidderId, overrideTarget.criterionId, overrideTarget.verdict, overrideTarget.reason.trim());
    setOverrideTarget(null);
    setRefreshKey((value) => value + 1);
    showMessage('Criterion override saved.');
  };

  const handleQuerySubmit = (payload: {
    bidderId: string;
    bidderName: string;
    criteriaIds: string[];
    queryType: PortalQueryType;
    status: PortalQueryStatus;
    subject: string;
    message: string;
    dueBy: string;
    suggestedEvidence: string[];
  }) => {
    if (!tender) return;
    savePortalQuery(tender.tenderId, {
      bidderId: payload.bidderId,
      bidderName: payload.bidderName,
      relatedCriteriaIds: payload.criteriaIds,
      queryType: payload.queryType,
      status: payload.status,
      subject: payload.subject,
      message: payload.message,
      dueBy: payload.dueBy,
      suggestedEvidence: payload.suggestedEvidence,
    });
    setQueryModal(null);
    setRefreshKey((value) => value + 1);
    showMessage(payload.status === 'Draft' ? 'Query draft saved.' : 'Query sent to bidder.');
  };

  if (!tender || !bidder) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
        <h3 className="text-lg font-medium text-gray-900">Evaluation record not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-xl font-bold text-white">
              {bidder.avatarLabel}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>{tender.tenderId}</span>
                <span>{tender.currentPhase}</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">{bidder.bidderName}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{bidder.organisationType}</span>
                {bidder.msme ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">MSME</span> : null}
                <span className={`status-badge ${statusPillClass(bidder.overallStatus)}`}>{bidder.overallStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleMockDownload(`${bidder.bidderId.toLowerCase()}-evaluation.txt`, `${bidder.bidderName} report`)}
              className="btn-secondary inline-flex items-center"
            >
              <Download size={16} className="mr-2" />
              Download bidder report
            </button>
            <button
              type="button"
              onClick={() => setQueryModal({
                isOpen: true,
                bidderId: bidder.bidderId,
                bidderName: bidder.bidderName,
                criteriaIds: [],
                evidence: [],
              })}
              className="btn-primary inline-flex items-center"
            >
              <MessageSquare size={16} className="mr-2" />
              Raise query
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.3fr_1fr]">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Bidder profile summary</h2>
              <button type="button" onClick={() => setShowProfileModal(true)} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                View full bidder profile
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Legal constitution:</span> {bidder.profile.legalConstitution}</p>
              <p><span className="font-semibold text-slate-900">Year of incorporation:</span> {bidder.profile.yearOfIncorporation}</p>
              <p><span className="font-semibold text-slate-900">GSTIN:</span> {bidder.profile.gstin}</p>
              <p><span className="font-semibold text-slate-900">PAN:</span> {bidder.profile.pan}</p>
              <p><span className="font-semibold text-slate-900">CIN / UDYAM:</span> {bidder.profile.cinOrUdyam}</p>
              <p><span className="font-semibold text-slate-900">Registered address:</span> {bidder.profile.registeredAddress}</p>
              <p><span className="font-semibold text-slate-900">Communication address:</span> {bidder.profile.communicationAddress}</p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Financial snapshot</p>
              <div className="mt-3 space-y-3">
                {bidder.profile.turnoverHistory.map((item) => (
                  <div key={item.financialYear} className="flex items-center justify-between text-sm text-slate-600">
                    <span>{item.financialYear} turnover</span>
                    <span className="font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
                {bidder.profile.netWorthHistory.map((item) => (
                  <div key={item.financialYear} className="flex items-center justify-between text-sm text-slate-600">
                    <span>{item.financialYear} net worth</span>
                    <span className="font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-slate-900">Criterion-by-criterion review</h2>
            <div className="mt-4 space-y-4">
              {['Financial', 'Technical', 'Compliance'].map((category) => (
                <div key={category}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</div>
                  <div className="space-y-3">
                    {bidder.criteria.filter((item) => getCriterionById(item.criterionId)?.category === category).map((criterionResult) => {
                      const criterion = getCriterionById(criterionResult.criterionId);
                      if (!criterion) return null;
                      return (
                        <div key={criterionResult.criterionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">{criterion.criterionId} - {criterion.title}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {criterion.mandatory ? 'Mandatory' : 'Optional'}
                                </span>
                                <span className={`status-badge ${statusPillClass(criterionResult.verdict)}`}>{criterionResult.verdict}</span>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{criterion.description}</p>
                              <p className="mt-3 text-sm text-slate-700">
                                <span className="font-semibold text-slate-900">System reasoning:</span> {criterionResult.reasoning}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {criterionResult.evidence.map((evidence) => (
                                  <button
                                    key={`${criterionResult.criterionId}-${evidence.documentId}-${evidence.page}`}
                                    type="button"
                                    onClick={() => setSelectedDocumentId(evidence.documentId)}
                                    className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
                                  >
                                    {evidence.documentName} - page {evidence.page}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setOverrideTarget({
                                  criterionId: criterion.criterionId,
                                  verdict: criterionResult.verdict,
                                  reason: criterionResult.overrideReason || '',
                                })}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Override verdict
                              </button>
                              <button
                                type="button"
                                onClick={() => setQueryModal({
                                  isOpen: true,
                                  bidderId: bidder.bidderId,
                                  bidderName: bidder.bidderName,
                                  criteriaIds: [criterion.criterionId],
                                  evidence: criterionResult.evidence.map((item) => `${item.documentName} - page ${item.page}`),
                                })}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Raise query
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Documents & OCR view</h2>
              <Search size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4">Document name</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">OCR status</th>
                    <th className="pb-3 pr-4">Facts</th>
                    <th className="pb-3 pr-4">Last processed</th>
                  </tr>
                </thead>
                <tbody>
                  {bidder.documents.map((document) => (
                    <tr key={document.documentId} className="border-t border-slate-100">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-900">{document.documentName}</div>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => setSelectedDocumentId(document.documentId)} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800">
                            View document
                          </button>
                          <button type="button" onClick={() => setSelectedDocumentId(document.documentId)} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800">
                            View extracted data
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{document.category}</td>
                      <td className="py-3 pr-4">
                        <span className={`status-badge ${document.ocrStatus === 'Processed' ? 'status-pass' : 'status-review'}`}>{document.ocrStatus}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{document.extractedFacts}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatDateTime(document.lastProcessed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedDocument && (
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{selectedDocument.documentName}</h2>
                <button type="button" onClick={() => handleMockDownload(`${selectedDocument.documentId.toLowerCase()}.txt`, `${selectedDocument.documentName} preview`)} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                  Open document
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Eye size={16} />
                  {selectedDocument.previewLabel}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Rendered preview placeholder for officer review. Evidence chips from the criteria section jump back to this drawer.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {selectedDocument.facts.map((fact) => (
                  <div key={fact.factId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{fact.label}</p>
                      <span className={`status-badge ${fact.status === 'CONFIRMED' ? 'status-pass' : 'status-review'}`}>{fact.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{fact.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{fact.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{bidder.bidderName}</h2>
                <p className="mt-1 text-sm text-slate-600">Extended bidder profile for officer reference.</p>
              </div>
              <button type="button" onClick={() => setShowProfileModal(false)} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200">
                <AlertCircle size={18} />
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ProfileField label="GSTIN" value={bidder.profile.gstin} />
              <ProfileField label="PAN" value={bidder.profile.pan} />
              <ProfileField label="CIN / UDYAM" value={bidder.profile.cinOrUdyam} />
              <ProfileField label="Year of incorporation" value={bidder.profile.yearOfIncorporation} />
              <ProfileField label="Registered address" value={bidder.profile.registeredAddress} />
              <ProfileField label="Communication address" value={bidder.profile.communicationAddress} />
            </div>
          </div>
        </div>
      )}

      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-slate-900">Override verdict</h2>
            <p className="mt-1 text-sm text-slate-600">Record an officer decision with a mandatory reason.</p>
            <div className="mt-6 space-y-4">
              <select
                className="input-field"
                value={overrideTarget.verdict}
                onChange={(event) => setOverrideTarget({ ...overrideTarget, verdict: event.target.value as PortalCriterionVerdict })}
              >
                <option value="Eligible">Eligible</option>
                <option value="Not Eligible">Not Eligible</option>
                <option value="Needs Manual Review">Needs Manual Review</option>
              </select>
              <textarea
                className="input-field min-h-[140px]"
                value={overrideTarget.reason}
                onChange={(event) => setOverrideTarget({ ...overrideTarget, reason: event.target.value })}
                placeholder="Explain the reason for the override"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOverrideTarget(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleOverride} className="btn-primary">Save override</button>
            </div>
          </div>
        </div>
      )}

      {queryModal && (
        <RaiseQueryModal
          bidderId={queryModal.bidderId}
          bidderName={queryModal.bidderName}
          criteriaIds={queryModal.criteriaIds}
          criteriaOptions={tender.criteria.map((criterion) => ({ id: criterion.criterionId, label: `${criterion.criterionId} - ${criterion.title}` }))}
          suggestedEvidence={queryModal.evidence}
          onClose={() => setQueryModal(null)}
          onSubmit={handleQuerySubmit}
        />
      )}
    </div>
  );
};

const RaiseQueryModal: React.FC<{
  bidderId: string;
  bidderName: string;
  criteriaIds: string[];
  criteriaOptions: Array<{ id: string; label: string }>;
  suggestedEvidence: string[];
  onClose: () => void;
  onSubmit: (payload: {
    bidderId: string;
    bidderName: string;
    criteriaIds: string[];
    queryType: PortalQueryType;
    status: PortalQueryStatus;
    subject: string;
    message: string;
    dueBy: string;
    suggestedEvidence: string[];
  }) => void;
}> = ({ bidderId, bidderName, criteriaIds, criteriaOptions, suggestedEvidence, onClose, onSubmit }) => {
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>(criteriaIds);
  const [queryType, setQueryType] = useState<PortalQueryType>('Technical');
  const [subject, setSubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [dueBy, setDueBy] = useState('2026-05-10');

  const toggleCriterion = (criterionId: string) => {
    setSelectedCriteria((current) => (
      current.includes(criterionId)
        ? current.filter((item) => item !== criterionId)
        : [...current, criterionId]
    ));
  };

  const submit = (status: PortalQueryStatus) => {
    if (!subject.trim() || !queryMessage.trim()) return;
    onSubmit({
      bidderId,
      bidderName,
      criteriaIds: selectedCriteria,
      queryType,
      status,
      subject: subject.trim(),
      message: queryMessage.trim(),
      dueBy: new Date(`${dueBy}T17:00:00+05:30`).toISOString(),
      suggestedEvidence,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Raise query</h2>
            <p className="mt-1 text-sm text-slate-600">Create a clarification thread for {bidderName}.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200">
            <AlertCircle size={18} />
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
            {bidderName}
          </div>
          <select className="input-field" value={queryType} onChange={(event) => setQueryType(event.target.value as PortalQueryType)}>
            <option value="Financial">Financial</option>
            <option value="Technical">Technical</option>
            <option value="Compliance">Compliance</option>
            <option value="Document Clarification">Document Clarification</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Related criteria</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {criteriaOptions.map((criterion) => (
              <label key={criterion.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={selectedCriteria.includes(criterion.id)} onChange={() => toggleCriterion(criterion.id)} />
                <span>{criterion.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4">
          <input className="input-field" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          <textarea className="input-field min-h-[140px]" value={queryMessage} onChange={(event) => setQueryMessage(event.target.value)} placeholder="Describe the clarification required." />
          <input className="input-field max-w-xs" type="date" value={dueBy} onChange={(event) => setDueBy(event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedEvidence.length > 0 ? suggestedEvidence.map((item) => (
            <span key={item} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {item}
            </span>
          )) : (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">No pre-linked evidence</span>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => submit('Draft')} className="btn-secondary">Save as Draft</button>
          <button type="button" onClick={() => submit('Sent')} className="btn-primary">Send to bidder</button>
        </div>
      </div>
    </div>
  );
};

const ProfileField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
  </div>
);

export default EvaluationConsole;
