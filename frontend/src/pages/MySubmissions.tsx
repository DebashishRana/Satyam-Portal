import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ClipboardCheck, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBidderProfile, getBids, getPublishedTenderDiscovery } from '../services/bidderPortalMock';

const statusLabel = (status: string) => status.replace(/([A-Z])/g, ' $1').trim();

const MySubmissions: React.FC = () => {
  const { user } = useAuth();
  const profile = useMemo(() => getBidderProfile(user?.id || 'bidder-demo'), [user?.id]);
  const tenders = useMemo(() => getPublishedTenderDiscovery(), []);
  const bids = useMemo(() => getBids().filter((bid) => bid.bidder_id === profile.bidder_id), [profile.bidder_id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-gray-600 mt-1">Drafts, submitted bids, extraction progress, and evaluation status.</p>
        </div>
        <Link to="/tenders" className="btn-primary inline-flex items-center justify-center">
          <FileText size={16} className="mr-2" />
          Browse Tenders
        </Link>
      </div>

      <div className="grid gap-4">
        {bids.map((bid) => {
          const tender = tenders.find((item) => item.tender_id === bid.tender_id);
          return (
            <Link key={bid.bid_id} to={bid.submission_status === 'Draft' ? `/submit-bid/${bid.tender_id}` : `/submission-status/${bid.bid_id}`} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <ClipboardCheck size={18} className="text-primary-600" />
                    <span className="font-mono text-sm text-gray-500">{bid.bid_id}</span>
                    <span className={`status-badge ${bid.submission_status === 'Draft' ? 'status-pending' : bid.submission_status.includes('Not') ? 'status-fail' : 'status-review'}`}>
                      {statusLabel(bid.submission_status)}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{tender?.tender_name || bid.tender_id}</h2>
                  <p className="text-sm text-gray-600 mt-1">{tender?.unit_or_formation || 'CRPF'} · {tender?.category || 'General'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium">{new Date(bid.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Submitted</p>
                    <p className="font-medium">{bid.submitted_at ? new Date(bid.submitted_at).toLocaleDateString() : 'Not yet'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Validity</p>
                    <p className="font-medium flex items-center"><Calendar size={14} className="mr-1" />{bid.bid_validity_end_date || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {bids.length === 0 && (
        <div className="text-center py-12 card">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bidder submissions yet</h3>
          <p className="text-gray-600">Choose a published tender to create your first draft bid.</p>
        </div>
      )}
    </div>
  );
};

export default MySubmissions;
