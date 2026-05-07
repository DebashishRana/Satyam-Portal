import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, FileText, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  BidSubmissionEntity,
  ClarificationThread,
  createDemoClarification,
  getBidById,
  getClarifications,
  getDocuments,
  getFacts,
  getJobs,
  getSnapshots,
  getTenderForBidder,
  respondToClarification,
  setBidStatus,
} from '../services/bidderPortalMock';

const stageLabels: Record<string, string> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  UnderTechnicalReview: 'Under Technical Review',
  ClarificationRequested: 'Clarification Requested',
  TechnicallyQualified: 'Technically Qualified',
  TechnicallyNotQualified: 'Technically Not Qualified',
  UnderFinancialReview: 'Under Financial Review',
  Accepted: 'Accepted',
  Rejected: 'Rejected',
  Awarded: 'Awarded',
  NotAwarded: 'Not Awarded',
};

const visibleTimeline = [
  'Draft',
  'Submitted',
  'UnderTechnicalReview',
  'ClarificationRequested',
  'TechnicallyQualified',
  'UnderFinancialReview',
  'Accepted',
  'Awarded',
];

const statusBadgeClass = (status: BidSubmissionEntity['submission_status']) => {
  if (status === 'Rejected' || status === 'NotAwarded' || status === 'TechnicallyNotQualified') return 'status-fail';
  if (status === 'Accepted' || status === 'Awarded' || status === 'TechnicallyQualified') return 'status-pass';
  return 'status-review';
};

const SubmissionStatus: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { user } = useAuth();
  const [bid, setBid] = useState<BidSubmissionEntity | undefined>(() => getBidById(submissionId || ''));
  const [clarifications, setClarifications] = useState<ClarificationThread[]>([]);
  const [message, setMessage] = useState('');

  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';
  const isBidder = user?.role === 'bidder';
  const tender = useMemo(() => bid ? getTenderForBidder(bid.tender_id) : null, [bid]);
  const snapshot = useMemo(() => getSnapshots().find((item) => item.bid_id === bid?.bid_id), [bid]);
  const documents = useMemo(() => getDocuments().filter((document) => document.bid_id === bid?.bid_id), [bid]);
  const jobs = useMemo(() => getJobs().filter((job) => documents.some((document) => document.bid_document_id === job.bid_document_id)), [documents]);
  const facts = useMemo(() => getFacts().filter((fact) => fact.bid_id === bid?.bid_id), [bid]);

  const refresh = useCallback(() => {
    if (!submissionId) return;
    setBid(getBidById(submissionId));
    setClarifications(getClarifications().filter((thread) => thread.bid_id === submissionId));
  }, [submissionId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (!bid) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-danger-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Submission not found</h3>
        <Link className="btn-secondary inline-flex mt-4" to={isOfficer ? '/admin/bid-reviews' : '/my-submissions'}>
          Back to submissions
        </Link>
      </div>
    );
  }

  const timelineIndex = visibleTimeline.indexOf(bid.submission_status);
  const percentage = Math.max(0, Math.min(100, ((timelineIndex >= 0 ? timelineIndex : 2) / (visibleTimeline.length - 1)) * 100));

  const handleRaiseClarification = () => {
    createDemoClarification(bid.bid_id);
    refresh();
  };

  const handleRespond = (clarificationId: string) => {
    if (!message.trim()) return;
    respondToClarification(clarificationId, message.trim());
    setMessage('');
    refresh();
  };

  const advanceStatus = (nextStatus: BidSubmissionEntity['submission_status']) => {
    const updated = setBidStatus(bid.bid_id, nextStatus);
    if (updated) setBid(updated);
    refresh();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-sm text-gray-500">{bid.bid_id}</p>
          <h1 className="text-2xl font-bold text-gray-900">{tender?.tender_name || bid.tender_id}</h1>
          <p className="text-gray-600 mt-1">
            {tender?.unit_or_formation || 'CRPF'} - Submitted {bid.submitted_at ? new Date(bid.submitted_at).toLocaleString() : 'not yet'}
          </p>
        </div>
        <span className={`status-badge ${statusBadgeClass(bid.submission_status)}`}>
          {stageLabels[bid.submission_status]}
        </span>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm text-gray-500">Bid status</p>
            <p className="font-semibold text-gray-900">{stageLabels[bid.submission_status]}</p>
          </div>
          <p className="text-sm text-gray-500">{Math.round(percentage)}% complete</p>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary-600 transition-all duration-500" style={{ width: `${percentage}%` }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {visibleTimeline.map((stage) => {
            const index = visibleTimeline.indexOf(stage);
            const isDone = index <= (timelineIndex >= 0 ? timelineIndex : 2);
            const isActive = bid.submission_status === stage;
            return (
              <div key={stage} className={`p-4 rounded-lg border ${isActive ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  {isDone ? <CheckCircle size={16} className="text-success-600" /> : <Clock size={16} className="text-gray-400" />}
                  <p className="font-medium text-sm text-gray-900">{stageLabels[stage]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Snapshot</h2>
            {snapshot ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{snapshot.overall_status}</p>
                      <p className="text-sm text-gray-600 mt-1">{snapshot.summary_text}</p>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(snapshot.generated_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid gap-3">
                  {snapshot.details_json.map((detail) => (
                    <div key={detail.tender_criterion_id} className="border rounded-lg p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`status-badge ${detail.status === 'Pass' ? 'status-pass' : detail.status === 'Fail' ? 'status-fail' : 'status-review'}`}>
                          {detail.status}
                        </span>
                        <p className="font-medium text-gray-900">{detail.title}</p>
                      </div>
                      <p className="text-sm text-gray-600">{detail.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No evaluation snapshot has been generated yet.</p>
            )}
          </div>

          <div className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Clarifications</h2>
              {isOfficer && (
                <button type="button" className="btn-secondary inline-flex items-center justify-center" onClick={handleRaiseClarification}>
                  <MessageSquare size={16} className="mr-2" />
                  Raise Clarification
                </button>
              )}
            </div>

            <div className="space-y-4">
              {clarifications.map((thread) => (
                <div key={thread.clarification_id} className="border rounded-lg p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Clarification {thread.clarification_id}</p>
                      <p className="text-sm text-gray-500">Criterion {thread.tender_criterion_id || 'General'} - Raised by {thread.raised_by}</p>
                    </div>
                    <span className={`status-badge ${thread.status === 'Closed' ? 'status-pass' : 'status-review'}`}>{thread.status}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {thread.messages.map((threadMessage) => (
                      <div key={threadMessage.message_id} className={`p-3 rounded-lg ${threadMessage.sender_role === 'Bidder' ? 'bg-primary-50' : 'bg-gray-50'}`}>
                        <p className="text-sm font-medium text-gray-900">{threadMessage.sender_role}</p>
                        <p className="text-sm text-gray-700 mt-1">{threadMessage.message_text}</p>
                        <p className="text-xs text-gray-500 mt-2">{new Date(threadMessage.sent_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {thread.status !== 'Closed' && isBidder && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input className="input-field" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type clarification response" />
                      <button type="button" className="btn-primary inline-flex items-center justify-center" onClick={() => handleRespond(thread.clarification_id)}>
                        <Send size={16} className="mr-2" />
                        Respond
                      </button>
                    </div>
                  )}
                  {thread.status !== 'Closed' && isOfficer && (
                    <p className="mt-4 text-sm text-gray-600">Awaiting bidder response in the Bidder Portal.</p>
                  )}
                </div>
              ))}
            </div>

            {clarifications.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-gray-600">No clarification threads are open.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Processing</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Documents</span>
                <span className="font-semibold">{documents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Extraction jobs</span>
                <span className="font-semibold">{jobs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Structured facts</span>
                <span className="font-semibold">{facts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Succeeded jobs</span>
                <span className="font-semibold">{jobs.filter((job) => job.status === 'Succeeded').length}</span>
              </div>
            </div>
          </div>

          {isOfficer && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Controls</h2>
              <div className="grid gap-2">
                <button type="button" className="btn-secondary text-left" onClick={() => advanceStatus('UnderTechnicalReview')}>Move to Technical Review</button>
                <button type="button" className="btn-secondary text-left" onClick={() => advanceStatus('ClarificationRequested')}>Request Clarification</button>
                <button type="button" className="btn-secondary text-left" onClick={() => advanceStatus('TechnicallyQualified')}>Mark Technically Qualified</button>
                <button type="button" className="btn-danger text-left" onClick={() => advanceStatus('TechnicallyNotQualified')}>Mark Technically Not Qualified</button>
                <button type="button" className="btn-secondary text-left" onClick={() => advanceStatus('UnderFinancialReview')}>Move to Financial Review</button>
                <button type="button" className="btn-success text-left" onClick={() => advanceStatus('Accepted')}>Accept</button>
                <button type="button" className="btn-danger text-left" onClick={() => advanceStatus('Rejected')}>Reject</button>
                <button type="button" className="btn-success text-left" onClick={() => advanceStatus('Awarded')}>Award</button>
                <button type="button" className="btn-danger text-left" onClick={() => advanceStatus('NotAwarded')}>Not Awarded</button>
              </div>
            </div>
          )}

          {isBidder ? (
            <Link to={`/submit-bid/${bid.tender_id}`} className="card block hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <FileText className="text-primary-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">View bid package</p>
                  <p className="text-sm text-gray-600">Documents and extracted data</p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card">
              <div className="flex items-center">
                <FileText className="text-primary-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">Bid package summary</p>
                  <p className="text-sm text-gray-600">Review uploaded document and extracted fact counts above.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionStatus;
