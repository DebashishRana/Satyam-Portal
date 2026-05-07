import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ClipboardCheck,
  FileDown,
  FileText,
  Gavel,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBids, getDocuments, getPublishedTenderDiscovery, getSnapshots } from '../services/bidderPortalMock';
import {
  getBidderSummaryRows,
  getEvaluationPortalTender,
  getEvaluationPortalTenders,
  getPortalNotifications,
  getTenderSummaryCounts,
} from '../services/evaluationPortalMock';

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const statusPillClass = (status: string) => {
  if (status === 'Eligible') return 'status-pass';
  if (status === 'Not Eligible') return 'status-fail';
  if (status === 'Query Pending') return 'bg-sky-100 text-sky-800';
  return 'status-review';
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';

  const [downloadMessage, setDownloadMessage] = useState('');

  const handleMockDownload = (fileName: string, title: string) => {
    const blob = new Blob([`${title}\nGenerated for evaluation workflow preview.`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadMessage(`${title} downloaded.`);
    window.setTimeout(() => setDownloadMessage(''), 2500);
  };

  const officerModel = useMemo(() => {
    const tenders = getEvaluationPortalTenders();
    const activeTender = getEvaluationPortalTender('TENDER-DEMO-01');
    const notifications = getPortalNotifications();
    if (!activeTender) return null;
    const bidderRows = getBidderSummaryRows(activeTender);
    const summary = getTenderSummaryCounts(activeTender);
    return {
      tenders,
      activeTender,
      bidderRows,
      summary,
      notifications,
      pendingReviews: bidderRows.filter((item) => item.overallStatus === 'Needs Manual Review').length,
      openQueries: activeTender.queries.filter((query) => query.status !== 'Closed').length,
      reportsReady: tenders.filter((tender) => tender.status !== 'Draft').length,
    };
  }, []);

  const bidderModel = useMemo(() => {
    const bids = getBids();
    const docs = getDocuments();
    const snapshots = getSnapshots();
    const tenders = getPublishedTenderDiscovery();
    return {
      tenders: tenders.length,
      bids: bids.length,
      docs: docs.length,
      snapshots: snapshots.length,
    };
  }, []);

  if (!isOfficer || !officerModel) {
    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Procurement workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Track documents, current submissions, and tender opportunities from one place.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Published tenders" value={bidderModel.tenders} icon={<FileText size={18} />} />
            <StatCard title="Active submissions" value={bidderModel.bids} icon={<ClipboardCheck size={18} />} />
            <StatCard title="Documents" value={bidderModel.docs} icon={<ShieldCheck size={18} />} />
            <StatCard title="Evaluations" value={bidderModel.snapshots} icon={<Gavel size={18} />} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card">
            <h2 className="text-xl font-semibold text-slate-900">Quick access</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link to="/tenders" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Browse tenders
              </Link>
              <Link to="/upload" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Open document vault
              </Link>
              <Link to="/my-submissions" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Track submissions
              </Link>
              <Link to="/notifications" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                View notifications
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-slate-900">Today at a glance</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Your tender, document, and submission records stay available across the working session.</p>
              <p>Eligibility and review states are reflected through the same status system used by the evaluation portal.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {downloadMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {downloadMessage}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[#0f172a] p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.16),_transparent_30%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              CRPF evaluation workspace
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              {officerModel.activeTender.tenderName}
            </h1>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
              <span>{officerModel.activeTender.tenderId}</span>
              <span>{officerModel.activeTender.department}</span>
              <span>{officerModel.activeTender.currentPhase}</span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              {officerModel.activeTender.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={`/tenders/${officerModel.activeTender.tenderId}`} className="inline-flex items-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                Open tender dashboard <ArrowRight size={16} className="ml-2" />
              </Link>
              <button
                type="button"
                onClick={() => handleMockDownload('consolidated-evaluation-report.txt', 'Consolidated evaluation report')}
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <FileDown size={16} className="mr-2" />
                Download consolidated report
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard title="Tenders" value={officerModel.tenders.length} icon={<FileText size={18} />} dark />
            <StatCard title="Eligible bidders" value={officerModel.summary.eligible} icon={<ShieldCheck size={18} />} dark />
            <StatCard title="Manual reviews" value={officerModel.pendingReviews} icon={<Gavel size={18} />} dark />
            <StatCard title="Open queries" value={officerModel.openQueries} icon={<Bell size={18} />} dark />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Current phase" value={officerModel.activeTender.currentPhase} detail={`Submission deadline: ${formatDate(officerModel.activeTender.submissionDeadline)}`} />
        <InfoTile label="Evaluation status" value={officerModel.activeTender.evaluationStatus} detail={`${officerModel.summary.totalBidders} bidders in scope`} />
        <InfoTile label="Needs manual review" value={String(officerModel.summary.needsManualReview)} detail="Criterion evidence needs officer confirmation." />
        <InfoTile label="Query pending" value={String(officerModel.summary.queryPending)} detail="Bidder clarifications still awaiting closure." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Active bidder queue</h2>
                <p className="mt-1 text-sm text-slate-500">Criterion-level status summaries for the currently selected tender.</p>
              </div>
              <Link to={`/tenders/${officerModel.activeTender.tenderId}`} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                Open full dashboard
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">Bidder</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Financial</th>
                    <th className="pb-3 pr-4">Technical</th>
                    <th className="pb-3 pr-4">Compliance</th>
                    <th className="pb-3 pr-4">Queries</th>
                  </tr>
                </thead>
                <tbody>
                  {officerModel.bidderRows.map((row) => (
                    <tr key={row.bidderId} className="border-b border-slate-100 align-top">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-900">{row.bidderName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.organisationType}{row.msme ? ' - MSME' : ''}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`status-badge ${statusPillClass(row.overallStatus)}`}>{row.overallStatus}</span>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">{row.financialSummary}</td>
                      <td className="py-4 pr-4 text-slate-700">{row.technicalSummary}</td>
                      <td className="py-4 pr-4 text-slate-700">{row.complianceSummary}</td>
                      <td className="py-4 pr-4 text-slate-700">{row.openQueries} open</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Recent audit activity</h2>
                <p className="mt-1 text-sm text-slate-500">Read-only timeline for evaluation actions on the active tender.</p>
              </div>
              <Gavel size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 space-y-3">
              {officerModel.activeTender.auditTrail.slice(0, 4).map((event) => (
                <div key={event.eventId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.user}
                        {event.bidderName ? ` - ${event.bidderName}` : ''}
                        {event.criterionLabel ? ` - ${event.criterionLabel}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{formatDate(event.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Officer focus areas</h2>
                <p className="mt-1 text-sm text-slate-500">Operational shortcuts for the evaluation committee.</p>
              </div>
              <ClipboardCheck size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 grid gap-3">
              <Link to={`/tenders/${officerModel.activeTender.tenderId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Tender-level dashboard
              </Link>
              <Link to={`/evaluation/${officerModel.activeTender.tenderId}?bidder=${officerModel.activeTender.bidders[0]?.bidderId || ''}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Bidder evaluation detail
              </Link>
              <Link to="/notifications" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Notifications center
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-slate-900">Notification snapshot</h2>
            <div className="mt-4 space-y-3">
              {officerModel.notifications.slice(0, 3).map((item) => (
                <Link key={item.id} to={item.href} className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; dark?: boolean }> = ({ title, value, icon, dark }) => (
  <div className={`rounded-2xl border p-4 ${dark ? 'border-white/10 bg-white/5 backdrop-blur' : 'border-slate-200 bg-white shadow-sm'}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</p>
        <p className={`mt-2 text-3xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      </div>
      <div className={`rounded-2xl p-3 ${dark ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-100 text-slate-700'}`}>
        {icon}
      </div>
    </div>
  </div>
);

const InfoTile: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-600">{detail}</p>
  </div>
);

export default Dashboard;
