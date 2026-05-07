import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, CheckCircle, Clock, FileDown, FileText, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBids, getClarifications, getDocuments, getPublishedTenderDiscovery, getSnapshots } from '../services/bidderPortalMock';
import { getEvaluationPortalTender, getPortalNotifications } from '../services/evaluationPortalMock';

const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

const toneIcon = (tone: NotificationTone) => {
  if (tone === 'success') return <CheckCircle size={18} />;
  if (tone === 'warning') return <AlertCircle size={18} />;
  if (tone === 'danger') return <ShieldAlert size={18} />;
  return <FileText size={18} />;
};

const toneClass = (tone: NotificationTone) => {
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'bg-amber-50 text-amber-700';
  if (tone === 'danger') return 'bg-rose-50 text-rose-700';
  return 'bg-sky-50 text-sky-700';
};

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';

  const [downloadMessage, setDownloadMessage] = useState('');

  const handleMockDownload = () => {
    const blob = new Blob(['Notifications export\nGenerated for officer workflow preview.'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notification-export.txt';
    link.click();
    URL.revokeObjectURL(url);
    setDownloadMessage('Notification export downloaded.');
    window.setTimeout(() => setDownloadMessage(''), 2500);
  };

  const officerModel = useMemo(() => {
    const items = getPortalNotifications();
    const tender = getEvaluationPortalTender('TENDER-DEMO-01');
    if (!tender) return null;
    return {
      items,
      tender,
      openQueries: tender.queries.filter((query) => query.status !== 'Closed').length,
      respondedQueries: tender.queries.filter((query) => query.status === 'Responded').length,
      auditEvents: tender.auditTrail.length,
      bidders: tender.bidders.length,
    };
  }, []);

  const bidderModel = useMemo(() => {
    const bids = getBids();
    const clarifications = getClarifications();
    const docs = getDocuments();
    const snapshots = getSnapshots();
    const tender = getPublishedTenderDiscovery()[0];
    return {
      notifications: [
        {
          id: 'B-01',
          title: 'Document verification updated',
          detail: `${docs.length || 0} document records are available for the active submission workspace.`,
          tone: 'success' as NotificationTone,
          time: new Date().toISOString(),
          href: '/upload',
        },
        {
          id: 'B-02',
          title: 'Clarification tracker',
          detail: clarifications.length > 0 ? 'An officer clarification thread is active for one of your submissions.' : 'No open clarification threads at the moment.',
          tone: clarifications.length > 0 ? 'warning' as NotificationTone : 'info' as NotificationTone,
          time: new Date().toISOString(),
          href: clarifications.length > 0 && bids[0] ? `/submission-status/${bids[0].bid_id}` : '/my-submissions',
        },
        {
          id: 'B-03',
          title: 'Tender activity',
          detail: tender ? `${tender.tender_name} remains available for review and submission tracking.` : 'Tender activity will appear here.',
          tone: 'info' as NotificationTone,
          time: new Date().toISOString(),
          href: '/tenders',
        },
        {
          id: 'B-04',
          title: 'Evaluation status snapshot',
          detail: snapshots.length > 0 ? 'Recent evaluation summaries are available in your submission tracker.' : 'Evaluation snapshots will appear after tender processing begins.',
          tone: 'info' as NotificationTone,
          time: new Date().toISOString(),
          href: '/my-submissions',
        },
      ],
      docs: docs.length,
      bids: bids.length,
      clarifications: clarifications.length,
      snapshots: snapshots.length,
    };
  }, []);

  if (!isOfficer || !officerModel) {
    return (
      <div className="space-y-6">
        {downloadMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {downloadMessage}
          </div>
        )}
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <Bell size={14} className="mr-2" /> Notifications
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Submission and document updates</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Review document checks, clarification activity, and submission state changes in one place.
              </p>
            </div>
            <button type="button" onClick={handleMockDownload} className="btn-secondary inline-flex items-center justify-center">
              <FileDown size={16} className="mr-2" />
              Export
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Documents" value={bidderModel.docs} />
          <MetricCard label="Submissions" value={bidderModel.bids} />
          <MetricCard label="Clarifications" value={bidderModel.clarifications} />
          <MetricCard label="Snapshots" value={bidderModel.snapshots} />
        </section>

        <section className="space-y-4">
          {bidderModel.notifications.map((item) => (
            <Link key={item.id} to={item.href} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md">
              <div className="flex items-start gap-4">
                <div className={`rounded-2xl p-3 ${toneClass(item.tone)}`}>
                  {toneIcon(item.tone)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold text-slate-400">
                      <Clock size={12} className="mr-1" />
                      {formatDateTime(item.time)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <Bell size={14} className="mr-2" /> Notifications center
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Evaluation events and clarifications</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Follow bidder responses, report readiness, and officer review signals for the active tender evaluation workflow.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to={`/tenders/${officerModel.tender.tenderId}`} className="btn-secondary inline-flex items-center justify-center">
              Open tender dashboard
            </Link>
            <button type="button" onClick={handleMockDownload} className="btn-primary inline-flex items-center justify-center">
              <FileDown size={16} className="mr-2" />
              Export log
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open queries" value={officerModel.openQueries} />
        <MetricCard label="Responded" value={officerModel.respondedQueries} />
        <MetricCard label="Audit events" value={officerModel.auditEvents} />
        <MetricCard label="Bidders" value={officerModel.bidders} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-4">
          {officerModel.items.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-2xl p-3 ${toneClass(item.tone)}`}>
                  {toneIcon(item.tone)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold text-slate-400">
                      <Clock size={12} className="mr-1" />
                      {formatDateTime(item.time)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Current tender context</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Tender:</span> {officerModel.tender.tenderName}</p>
              <p><span className="font-semibold text-slate-900">Tender ID:</span> {officerModel.tender.tenderId}</p>
              <p><span className="font-semibold text-slate-900">Phase:</span> {officerModel.tender.currentPhase}</p>
              <p><span className="font-semibold text-slate-900">Deadline:</span> {formatDateTime(officerModel.tender.submissionDeadline)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <h2 className="text-lg font-semibold">Next officer actions</h2>
            <div className="mt-4 grid gap-2">
              <Link to={`/evaluation/${officerModel.tender.tenderId}?bidder=${officerModel.tender.bidders[1]?.bidderId || officerModel.tender.bidders[0]?.bidderId || ''}`} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">
                Review bidder evaluation
              </Link>
              <Link to={`/tenders/${officerModel.tender.tenderId}`} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">
                Track query status
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
  </div>
);

export default Notifications;
