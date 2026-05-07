import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileText, Search } from 'lucide-react';
import {
  BidSubmissionEntity,
  getBids,
  getDocuments,
  getFacts,
  getJobs,
  getTenderForBidder,
} from '../services/bidderPortalMock';

const statusLabel = (status: string) => status.replace(/([A-Z])/g, ' $1').trim();

const statusClass = (status: BidSubmissionEntity['submission_status']) => {
  if (status === 'Rejected' || status === 'NotAwarded' || status === 'TechnicallyNotQualified') return 'status-fail';
  if (status === 'Accepted' || status === 'Awarded' || status === 'TechnicallyQualified') return 'status-pass';
  if (status === 'Draft') return 'status-pending';
  return 'status-review';
};

const AdminBidReviews: React.FC = () => {
  const [query, setQuery] = useState('');
  const bids = useMemo(() => getBids().filter((bid) => bid.submission_status !== 'Draft'), []);
  const documents = useMemo(() => getDocuments(), []);
  const jobs = useMemo(() => getJobs(), []);
  const facts = useMemo(() => getFacts(), []);

  const filteredBids = bids.filter((bid) => {
    const tender = getTenderForBidder(bid.tender_id);
    const haystack = `${bid.bid_id} ${bid.tender_id} ${tender.tender_name} ${bid.submission_status}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bid Reviews</h1>
          <p className="text-gray-600 mt-1">Officer workspace for submitted bidder packages, clarifications, and evaluation stage changes.</p>
        </div>
        <Link to="/tenders" className="btn-secondary inline-flex items-center justify-center">
          <FileText size={16} className="mr-2" />
          Tenders
        </Link>
      </div>

      <div className="card">
        <label className="block max-w-xl">
          <span className="text-sm font-medium text-gray-700 flex items-center">
            <Search size={14} className="mr-1" />
            Search bids
          </span>
          <input
            className="input-field mt-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bid ID, tender, or status"
          />
        </label>
      </div>

      <div className="grid gap-4">
        {filteredBids.map((bid) => {
          const tender = getTenderForBidder(bid.tender_id);
          const bidDocuments = documents.filter((document) => document.bid_id === bid.bid_id);
          const bidDocumentIds = bidDocuments.map((document) => document.bid_document_id);
          const bidJobs = jobs.filter((job) => bidDocumentIds.includes(job.bid_document_id));
          const bidFacts = facts.filter((fact) => fact.bid_id === bid.bid_id);

          return (
            <Link key={bid.bid_id} to={`/submission-status/${bid.bid_id}`} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <ClipboardCheck size={18} className="text-primary-600" />
                    <span className="font-mono text-sm text-gray-500">{bid.bid_id}</span>
                    <span className={`status-badge ${statusClass(bid.submission_status)}`}>
                      {statusLabel(bid.submission_status)}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{tender.tender_name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{tender.tender_id} - {tender.unit_or_formation}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Submitted</p>
                    <p className="font-medium">{bid.submitted_at ? new Date(bid.submitted_at).toLocaleDateString() : 'Not yet'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Documents</p>
                    <p className="font-medium">{bidDocuments.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Facts</p>
                    <p className="font-medium">{bidFacts.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Jobs done</p>
                    <p className="font-medium">{bidJobs.filter((job) => job.status === 'Succeeded').length}/{bidJobs.length}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredBids.length === 0 && (
        <div className="text-center py-12 card">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No submitted bids to review</h3>
          <p className="text-gray-600">Bids submitted from the Bidder Portal will appear here for officer review.</p>
        </div>
      )}
    </div>
  );
};

export default AdminBidReviews;
