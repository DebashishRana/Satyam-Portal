import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  Eye,
  FileDown,
  Plus,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublishedTenderDiscovery } from '../services/bidderPortalMock';
import {
  PortalBidderStatus,
  PortalCriterionVerdict,
  PortalQueryStatus,
  PortalQueryType,
  getBidderSummaryRows,
  getCriterionById,
  getEvaluationPortalTender,
  getTenderSummaryCounts,
  overridePortalCriterion,
  savePortalQuery,
  updatePortalQueryStatus,
} from '../services/evaluationPortalMock';

type TenderTab = 'overview' | 'matrix' | 'queries' | 'audit';

type QueryModalState = {
  isOpen: boolean;
  bidderId?: string;
  bidderName?: string;
  criteriaIds: string[];
  evidence: string[];
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusPillClass = (status: string) => {
  if (status === 'Eligible' || status === 'Completed' || status === 'Closed' || status === 'Responded') return 'status-pass';
  if (status === 'Not Eligible') return 'status-fail';
  if (status === 'Query Pending' || status === 'Sent') return 'bg-sky-100 text-sky-800';
  return 'status-review';
};

const TenderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TenderTab>('overview');
  const [, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'All' | PortalBidderStatus>('All');
  const [orgFilter, setOrgFilter] = useState<'All' | 'MSME' | 'Non-MSME'>('All');
  const [selectedCell, setSelectedCell] = useState<{ bidderId: string; criterionId: string } | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [overrideVerdict, setOverrideVerdict] = useState<PortalCriterionVerdict>('Needs Manual Review');
  const [overrideReason, setOverrideReason] = useState('');
  const [queryModal, setQueryModal] = useState<QueryModalState>({ isOpen: false, criteriaIds: [], evidence: [] });
  const [queryResponse, setQueryResponse] = useState('');
  const [message, setMessage] = useState('');

  const tender = isOfficer ? getEvaluationPortalTender(id || 'TENDER-DEMO-01') : null;

  const bidderTender = useMemo(() => (
    !isOfficer ? getPublishedTenderDiscovery().find((item) => item.tender_id === id) || getPublishedTenderDiscovery()[0] : null
  ), [id, isOfficer]);

  const bidderRows = useMemo(() => (tender ? getBidderSummaryRows(tender) : []), [tender]);
  const summaryCounts = useMemo(() => (tender ? getTenderSummaryCounts(tender) : null), [tender]);

  const selectedCellData = useMemo(() => {
    if (!tender || !selectedCell) return null;
    const bidder = tender.bidders.find((item) => item.bidderId === selectedCell.bidderId);
    const criterion = getCriterionById(selectedCell.criterionId);
    const assessment = bidder?.criteria.find((item) => item.criterionId === selectedCell.criterionId);
    if (!bidder || !criterion || !assessment) return null;
    return { bidder, criterion, assessment };
  }, [selectedCell, tender]);

  const selectedQuery = useMemo(() => (
    tender?.queries.find((query) => query.queryId === selectedQueryId) || null
  ), [selectedQueryId, tender]);

  const filteredBidderRows = bidderRows.filter((row) => {
    const matchesStatus = statusFilter === 'All' || row.overallStatus === statusFilter;
    const matchesOrg = orgFilter === 'All' || (orgFilter === 'MSME' ? row.msme : !row.msme);
    return matchesStatus && matchesOrg;
  });

  const bidderOptions = useMemo(() => (
    tender?.bidders.map((bidder) => ({ bidderId: bidder.bidderId, bidderName: bidder.bidderName })) || []
  ), [tender]);

  const showMessage = (nextMessage: string) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(''), 2500);
  };

  const handleMockDownload = (fileName: string, title: string) => {
    const blob = new Blob([`${title}\nGenerated for ${id || 'tender'} preview.`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    showMessage(`${title} downloaded.`);
  };

  const handleOverrideSubmit = () => {
    if (!tender || !selectedCell || !overrideReason.trim()) return;
    overridePortalCriterion(tender.tenderId, selectedCell.bidderId, selectedCell.criterionId, overrideVerdict, overrideReason.trim());
    setOverrideReason('');
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
    setQueryModal({ isOpen: false, criteriaIds: [], evidence: [] });
    setRefreshKey((value) => value + 1);
    showMessage(payload.status === 'Draft' ? 'Query draft saved.' : 'Query sent to bidder.');
    setActiveTab('queries');
  };

  const updateQuery = (status: PortalQueryStatus, response?: string) => {
    if (!tender || !selectedQuery) return;
    updatePortalQueryStatus(tender.tenderId, selectedQuery.queryId, status, response);
    setRefreshKey((value) => value + 1);
    showMessage(`Query ${selectedQuery.queryId} updated.`);
  };

  if (!isOfficer) {
    if (!bidderTender) {
      return (
        <div className="py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h3 className="text-lg font-medium text-gray-900">Tender not found</h3>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="text-sm font-medium text-slate-500">{bidderTender.tender_id}</span>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">{bidderTender.tender_name}</h1>
              <p className="mt-2 text-sm text-slate-600">{bidderTender.unit_or_formation}</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate(`/submit-bid/${bidderTender.tender_id}`)} className="btn-primary">
                View bid details
              </button>
              <button type="button" onClick={() => navigate(`/submit-bid/${bidderTender.tender_id}`)} className="btn-secondary">
                Open checklist
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!tender || !summaryCounts) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
        <h3 className="text-lg font-medium text-gray-900">Tender not found</h3>
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
          <div className="min-w-0">
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span>{tender.tenderId}</span>
              <span>{tender.department}</span>
              <span>{tender.currentPhase}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{tender.tenderName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{tender.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tender.eligibilitySummary.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[280px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current phase</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{tender.currentPhase}</p>
              <p className="mt-1 text-sm text-slate-600">Submission deadline: {formatDate(tender.submissionDeadline)}</p>
            </div>
            <button
              type="button"
              onClick={() => handleMockDownload(`consolidated-${tender.tenderId.toLowerCase()}.txt`, 'Consolidated evaluation report')}
              className="btn-primary inline-flex items-center justify-center"
            >
              <FileDown size={16} className="mr-2" />
              Download consolidated evaluation report
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total bidders" value={summaryCounts.totalBidders} />
          <SummaryCard label="Eligible" value={summaryCounts.eligible} />
          <SummaryCard label="Not Eligible" value={summaryCounts.notEligible} />
          <SummaryCard label="Needs Manual Review" value={summaryCounts.needsManualReview} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <TabButton label="Bidders Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Criteria Matrix" active={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')} />
          <TabButton label="Queries & Clarifications" active={activeTab === 'queries'} onClick={() => setActiveTab('queries')} />
          <TabButton label="Audit Trail" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
        </div>
      </section>

      {activeTab === 'overview' && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Overall status</span>
                  <select className="input-field mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | PortalBidderStatus)}>
                    <option value="All">All</option>
                    <option value="Eligible">Eligible</option>
                    <option value="Not Eligible">Not Eligible</option>
                    <option value="Needs Manual Review">Needs Manual Review</option>
                    <option value="Query Pending">Query Pending</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Organisation type</span>
                  <select className="input-field mt-1" value={orgFilter} onChange={(event) => setOrgFilter(event.target.value as 'All' | 'MSME' | 'Non-MSME')}>
                    <option value="All">All</option>
                    <option value="MSME">MSME</option>
                    <option value="Non-MSME">Non-MSME</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Bidder name</th>
                    <th className="px-5 py-4">Organisation type</th>
                    <th className="px-5 py-4">Overall status</th>
                    <th className="px-5 py-4">Financial</th>
                    <th className="px-5 py-4">Technical</th>
                    <th className="px-5 py-4">Compliance</th>
                    <th className="px-5 py-4">Queries</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidderRows.map((row) => (
                    <tr key={row.bidderId} className="border-t border-slate-100 align-top hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{row.bidderName}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.bidderId}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {row.organisationType}
                        {row.msme ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">MSME</span> : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`status-badge ${statusPillClass(row.overallStatus)}`}>{row.overallStatus}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{row.financialSummary}</td>
                      <td className="px-5 py-4 text-slate-700">{row.technicalSummary}</td>
                      <td className="px-5 py-4 text-slate-700">{row.complianceSummary}</td>
                      <td className="px-5 py-4 text-slate-700">{row.openQueries} open</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/evaluation/${tender.tenderId}?bidder=${row.bidderId}`} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <Eye size={15} className="mr-2" />
                            View evaluation
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleMockDownload(`${row.bidderId.toLowerCase()}-report.txt`, `${row.bidderName} report`)}
                            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Download size={15} className="mr-2" />
                            Download bidder report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'matrix' && (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Criterion</th>
                    {tender.bidders.map((bidder) => (
                      <th key={bidder.bidderId} className="px-5 py-4 text-center">{bidder.bidderName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['Financial', 'Technical', 'Compliance'].map((category) => (
                    <React.Fragment key={category}>
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={tender.bidders.length + 1} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {category}
                        </td>
                      </tr>
                      {tender.criteria.filter((criterion) => criterion.category === category).map((criterion) => (
                        <tr key={criterion.criterionId} className="border-t border-slate-100">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">{criterion.criterionId}</div>
                            <div className="mt-1 text-sm text-slate-600">{criterion.title}</div>
                          </td>
                          {tender.bidders.map((bidder) => {
                            const assessment = bidder.criteria.find((item) => item.criterionId === criterion.criterionId);
                            if (!assessment) {
                              return <td key={bidder.bidderId} className="px-5 py-4 text-center text-slate-400">-</td>;
                            }
                            const symbol = assessment.verdict === 'Eligible' ? '✓' : assessment.verdict === 'Not Eligible' ? '✕' : '!';
                            return (
                              <td key={bidder.bidderId} className="px-5 py-4 text-center">
                                <button
                                  type="button"
                                  title={`${assessment.verdict} - ${assessment.reasoning} Evidence: ${assessment.evidence[0]?.documentName || 'Not linked'}${assessment.evidence[0] ? `, page ${assessment.evidence[0].page}` : ''}.`}
                                  onClick={() => {
                                    setSelectedCell({ bidderId: bidder.bidderId, criterionId: criterion.criterionId });
                                    setOverrideVerdict(assessment.verdict);
                                    setOverrideReason(assessment.overrideReason || '');
                                  }}
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
                                    assessment.verdict === 'Eligible'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : assessment.verdict === 'Not Eligible'
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {symbol}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {selectedCellData ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Criterion details</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedCellData.criterion.criterionId} - {selectedCellData.criterion.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{selectedCellData.criterion.description}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{selectedCellData.bidder.bidderName}</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p><span className="font-semibold text-slate-900">Bidder value:</span> {selectedCellData.assessment.bidderValue}</p>
                    <p><span className="font-semibold text-slate-900">Threshold:</span> {selectedCellData.assessment.threshold}</p>
                    <p><span className="font-semibold text-slate-900">Verdict:</span> {selectedCellData.assessment.verdict}</p>
                    <p><span className="font-semibold text-slate-900">Reasoning:</span> {selectedCellData.assessment.reasoning}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Evidence</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCellData.assessment.evidence.map((item) => (
                      <button key={`${item.documentId}-${item.page}`} type="button" className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        {item.documentName} - page {item.page}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {selectedCellData.assessment.evidence[0]?.snippet}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Override verdict</p>
                  <div className="mt-3 space-y-3">
                    <select className="input-field" value={overrideVerdict} onChange={(event) => setOverrideVerdict(event.target.value as PortalCriterionVerdict)}>
                      <option value="Eligible">Eligible</option>
                      <option value="Not Eligible">Not Eligible</option>
                      <option value="Needs Manual Review">Needs Manual Review</option>
                    </select>
                    <textarea
                      className="input-field min-h-[120px]"
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      placeholder="Mandatory reason for override"
                    />
                    <button type="button" onClick={handleOverrideSubmit} className="btn-primary w-full">
                      Save override
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setQueryModal({
                    isOpen: true,
                    bidderId: selectedCellData.bidder.bidderId,
                    bidderName: selectedCellData.bidder.bidderName,
                    criteriaIds: [selectedCellData.criterion.criterionId],
                    evidence: selectedCellData.assessment.evidence.map((item) => `${item.documentName} - page ${item.page}`),
                  })}
                  className="btn-secondary w-full"
                >
                  Raise query for this criterion
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                Select a cell in the matrix to inspect criterion details, evidence, and override controls.
              </div>
            )}
          </aside>
        </section>
      )}

      {activeTab === 'queries' && (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => setQueryModal({ isOpen: true, criteriaIds: [], evidence: [] })} className="btn-primary inline-flex items-center">
                <Plus size={16} className="mr-2" />
                New query
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Query ID</th>
                      <th className="px-5 py-4">Bidder</th>
                      <th className="px-5 py-4">Related criterion</th>
                      <th className="px-5 py-4">Query type</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Raised on</th>
                      <th className="px-5 py-4">Due by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tender.queries.map((query) => (
                      <tr key={query.queryId} className="border-t border-slate-100 hover:bg-slate-50" onClick={() => setSelectedQueryId(query.queryId)}>
                        <td className="px-5 py-4 font-semibold text-slate-900">{query.queryId}</td>
                        <td className="px-5 py-4 text-slate-700">{query.bidderName}</td>
                        <td className="px-5 py-4 text-slate-700">{query.relatedCriterionLabel}</td>
                        <td className="px-5 py-4 text-slate-700">{query.queryType}</td>
                        <td className="px-5 py-4">
                          <span className={`status-badge ${statusPillClass(query.status)}`}>{query.status}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{formatDate(query.raisedOn)}</td>
                        <td className="px-5 py-4 text-slate-700">{formatDate(query.dueBy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {selectedQuery ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">{selectedQuery.queryId}</h2>
                    <span className={`status-badge ${statusPillClass(selectedQuery.status)}`}>{selectedQuery.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedQuery.subject}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedQuery.message}</p>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-900">Bidder:</span> {selectedQuery.bidderName}</p>
                  <p><span className="font-semibold text-slate-900">Criterion:</span> {selectedQuery.relatedCriterionLabel}</p>
                  <p><span className="font-semibold text-slate-900">Raised on:</span> {formatDateTime(selectedQuery.raisedOn)}</p>
                  <p><span className="font-semibold text-slate-900">Due by:</span> {formatDateTime(selectedQuery.dueBy)}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Suggested attachments / evidence</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedQuery.suggestedEvidence.map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedQuery.response && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Bidder response</p>
                    <p className="mt-2 text-sm text-slate-600">{selectedQuery.response}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <textarea
                    className="input-field min-h-[110px]"
                    value={queryResponse}
                    onChange={(event) => setQueryResponse(event.target.value)}
                    placeholder="Paste or simulate bidder response"
                  />
                  <button type="button" onClick={() => updateQuery('Responded', queryResponse)} className="btn-secondary w-full">
                    Mark as Responded
                  </button>
                </div>

                <div className="grid gap-2">
                  {selectedQuery.status !== 'Closed' ? (
                    <button type="button" onClick={() => updateQuery('Closed')} className="btn-primary">
                      Mark as Closed
                    </button>
                  ) : (
                    <button type="button" onClick={() => updateQuery('Sent')} className="btn-secondary">
                      Reopen
                    </button>
                  )}
                  <Link to={`/evaluation/${tender.tenderId}?bidder=${selectedQuery.bidderId}`} className="btn-secondary inline-flex items-center justify-center">
                    View related evaluation
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                Select a query row to inspect details, bidder response, and closure controls.
              </div>
            )}
          </aside>
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {tender.auditTrail.map((event) => (
              <div key={event.eventId} className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mt-1 h-3 w-3 rounded-full bg-cyan-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.user}
                        {event.bidderName ? ` - ${event.bidderName}` : ''}
                        {event.criterionLabel ? ` - ${event.criterionLabel}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{formatDateTime(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {queryModal.isOpen && (
        <RaiseQueryModal
          bidderOptions={bidderOptions}
          criteria={tender.criteria.map((criterion) => ({ id: criterion.criterionId, label: `${criterion.criterionId} - ${criterion.title}` }))}
          defaultBidderId={queryModal.bidderId}
          defaultBidderName={queryModal.bidderName}
          defaultCriteriaIds={queryModal.criteriaIds}
          suggestedEvidence={queryModal.evidence}
          onClose={() => setQueryModal({ isOpen: false, criteriaIds: [], evidence: [] })}
          onSubmit={handleQuerySubmit}
        />
      )}
    </div>
  );
};

const RaiseQueryModal: React.FC<{
  bidderOptions: Array<{ bidderId: string; bidderName: string }>;
  criteria: Array<{ id: string; label: string }>;
  defaultBidderId?: string;
  defaultBidderName?: string;
  defaultCriteriaIds: string[];
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
}> = ({ bidderOptions, criteria, defaultBidderId, defaultBidderName, defaultCriteriaIds, suggestedEvidence, onClose, onSubmit }) => {
  const [bidderId, setBidderId] = useState(defaultBidderId || bidderOptions[0]?.bidderId || '');
  const [queryType, setQueryType] = useState<PortalQueryType>('Technical');
  const [subject, setSubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [dueBy, setDueBy] = useState('2026-05-10');
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>(defaultCriteriaIds);

  const activeBidderName = defaultBidderName || bidderOptions.find((item) => item.bidderId === bidderId)?.bidderName || '';

  const toggleCriterion = (criterionId: string) => {
    setSelectedCriteria((current) => (
      current.includes(criterionId)
        ? current.filter((item) => item !== criterionId)
        : [...current, criterionId]
    ));
  };

  const submit = (status: PortalQueryStatus) => {
    if (!bidderId || !subject.trim() || !queryMessage.trim()) return;
    onSubmit({
      bidderId,
      bidderName: activeBidderName,
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
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Raise query</h2>
            <p className="mt-1 text-sm text-slate-600">Create a clarification thread linked to the bidder and relevant eligibility criteria.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200">
            <XCircle size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bidder</span>
            {defaultBidderId ? (
              <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                {activeBidderName}
              </div>
            ) : (
              <select className="input-field mt-1" value={bidderId} onChange={(event) => setBidderId(event.target.value)}>
                {bidderOptions.map((item) => (
                  <option key={item.bidderId} value={item.bidderId}>{item.bidderName}</option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Query type</span>
            <select className="input-field mt-1" value={queryType} onChange={(event) => setQueryType(event.target.value as PortalQueryType)}>
              <option value="Financial">Financial</option>
              <option value="Technical">Technical</option>
              <option value="Compliance">Compliance</option>
              <option value="Document Clarification">Document Clarification</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Related criteria</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {criteria.map((criterion) => (
              <label key={criterion.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={selectedCriteria.includes(criterion.id)} onChange={() => toggleCriterion(criterion.id)} />
                <span>{criterion.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</span>
            <input className="input-field mt-1" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short query subject" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Query message</span>
            <textarea className="input-field mt-1 min-h-[140px]" value={queryMessage} onChange={(event) => setQueryMessage(event.target.value)} placeholder="Explain what clarification or supporting document is needed." />
          </label>
          <label className="block max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Due date</span>
            <input className="input-field mt-1" type="date" value={dueBy} onChange={(event) => setDueBy(event.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Suggested attachments / evidence</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedEvidence.length > 0 ? suggestedEvidence.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                {item}
              </span>
            )) : (
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                No pre-linked evidence
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => submit('Draft')} className="btn-secondary">Save as Draft</button>
          <button type="button" onClick={() => submit('Sent')} className="btn-primary">Send to bidder</button>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
  </div>
);

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
);

export default TenderDetail;
