import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Filter, FileText, IndianRupee, MapPin, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublishedTenderDiscovery, TenderDiscoveryItem } from '../services/bidderPortalMock';
import { getEvaluationPortalTenders, PortalTenderStatus } from '../services/evaluationPortalMock';

const formatCurrency = (amount: number, currency = 'INR') => {
  if (!amount) return 'Value not published';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const daysUntil = (dateValue: string) => {
  const target = new Date(dateValue).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / 86400000);
};

const deadlineTone = (days: number) => {
  if (days <= 3) return 'text-danger-700 bg-danger-50 border-danger-100';
  if (days <= 7) return 'text-warning-700 bg-warning-50 border-warning-100';
  return 'text-success-700 bg-success-50 border-success-100';
};

const statusBadgeClass = (status: PortalTenderStatus) => {
  if (status === 'Completed') return 'status-pass';
  if (status === 'Draft') return 'status-pending';
  return 'status-review';
};

const TenderList: React.FC = () => {
  const { user } = useAuth();
  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PortalTenderStatus>('All');
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('All');
  const [maxValue, setMaxValue] = useState('');

  const officerTenders = useMemo(() => getEvaluationPortalTenders(), []);
  const bidderTenders = useMemo(() => getPublishedTenderDiscovery(), []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(bidderTenders.map((tender) => tender.category).filter(Boolean)))], [bidderTenders]);
  const locations = useMemo(() => ['All', ...Array.from(new Set(bidderTenders.flatMap((tender) => tender.locations_json || [])))], [bidderTenders]);

  const dashboardStats = useMemo(() => {
    const total = bidderTenders.length;
    const closingSoon = bidderTenders.filter((item) => daysUntil(item.bid_submission_end) <= 7).length;
    const highValue = bidderTenders.filter((item) => item.estimated_value_amount >= 10000000).length;
    const avgMandatory = total
      ? Math.round(bidderTenders.reduce((acc, item) => acc + item.mandatory_documents_count, 0) / total)
      : 0;
    return { total, closingSoon, highValue, avgMandatory };
  }, [bidderTenders]);

  const filteredOfficerTenders = officerTenders.filter((tender) => {
    const matchesQuery = `${tender.tenderId} ${tender.tenderName} ${tender.department}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || tender.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const filteredBidderTenders = bidderTenders.filter((tender) => {
    const matchesQuery = `${tender.tender_name} ${tender.tender_id} ${tender.unit_or_formation}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' || tender.category === category;
    const matchesLocation = location === 'All' || tender.locations_json.includes(location);
    const matchesValue = !maxValue || tender.estimated_value_amount <= Number(maxValue);
    return matchesQuery && matchesCategory && matchesLocation && matchesValue;
  });

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setCategory('All');
    setLocation('All');
    setMaxValue('');
  };

  if (isOfficer) {
    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Tender list
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Tender evaluation workbench</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Select a tender to review bidders, compare criteria, track clarifications, and export consolidated evaluation outputs.
              </p>
            </div>
            <Link to="/tenders/admin/create" className="btn-primary inline-flex items-center">
              <Plus size={16} className="mr-2" />
              Create Tender
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Recent tenders" value={officerTenders.length} />
          <MetricTile label="Under evaluation" value={officerTenders.filter((item) => item.status === 'Under Evaluation').length} />
          <MetricTile label="Completed" value={officerTenders.filter((item) => item.status === 'Completed').length} />
          <MetricTile label="Current bidders" value={officerTenders.reduce((sum, item) => sum + item.noOfBidders, 0)} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[1.5fr_0.7fr]">
              <label className="block">
                <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Search size={14} className="mr-1" />
                  Search
                </span>
                <input className="input-field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tender ID, name, or department" />
              </label>
              <label className="block">
                <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Filter size={14} className="mr-1" />
                  Status
                </span>
                <select className="input-field mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | PortalTenderStatus)}>
                  <option value="All">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={resetFilters} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <X size={14} className="mr-1" />
              Clear filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Tender ID</th>
                  <th className="px-5 py-4">Tender Name</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Submission Deadline</th>
                  <th className="px-5 py-4">No. of Bidders</th>
                  <th className="px-5 py-4">Evaluation Status</th>
                  <th className="px-5 py-4 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfficerTenders.map((tender) => (
                  <tr key={tender.tenderId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-700">{tender.tenderId}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{tender.tenderName}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{tender.department}</td>
                    <td className="px-5 py-4">
                      <span className={`status-badge ${statusBadgeClass(tender.status)}`}>{tender.status}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatDate(tender.submissionDeadline)}</td>
                    <td className="px-5 py-4 text-slate-700">{tender.noOfBidders}</td>
                    <td className="px-5 py-4 text-slate-700">{tender.evaluationStatus}</td>
                    <td className="px-5 py-4 text-right">
                      <Link to={`/tenders/${tender.tenderId}`} className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                        Open <ChevronRight size={16} className="ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOfficerTenders.length === 0 && (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900">No tenders match these filters</h3>
              <p className="mt-2 text-sm text-slate-600">Adjust the search text or status filter to continue.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 p-6">
        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
              <ShieldCheck size={14} className="mr-2" /> Tender discovery
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Find opportunities and review bid requirements</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              Browse published tenders with eligibility snapshots, document expectations, and deadline signals before opening the detailed checklist.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/bidder/profile" className="btn-secondary inline-flex items-center justify-center">Complete profile</Link>
            <Link to="/my-submissions" className="btn-primary inline-flex items-center justify-center">My submissions</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Published tenders" value={dashboardStats.total} />
        <MetricTile label="Closing in 7 days" value={dashboardStats.closingSoon} />
        <MetricTile label="High value opportunities" value={dashboardStats.highValue} />
        <MetricTile label="Avg mandatory docs" value={dashboardStats.avgMandatory} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-600"><Search size={14} className="mr-1" />Search</span>
              <input className="input-field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tender name, unit, ID" />
            </label>
            <label className="block">
              <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-600"><Filter size={14} className="mr-1" />Category</span>
              <select className="input-field mt-1" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-600"><MapPin size={14} className="mr-1" />Location</span>
              <select className="input-field mt-1" value={location} onChange={(event) => setLocation(event.target.value)}>
                {locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-600"><IndianRupee size={14} className="mr-1" />Max value</span>
              <input className="input-field mt-1" type="number" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} placeholder="INR" />
            </label>
          </div>
          <button type="button" onClick={resetFilters} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <X size={14} className="mr-1" /> Clear filters
          </button>
        </div>
      </section>

      <section className="grid gap-5">
        {filteredBidderTenders.map((tender: TenderDiscoveryItem) => {
          const daysLeft = daysUntil(tender.bid_submission_end);
          const totalDocs = Math.max(1, tender.document_requirements.length);
          const mandatoryRatio = Math.round((tender.mandatory_documents_count / totalDocs) * 100);

          return (
            <article key={tender.tender_id} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{tender.category}</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Published</span>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700" title="Eligibility evidence is pre-screened before officer review.">
                      <ShieldCheck size={12} className="mr-1 inline" /> Pre-screened
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${deadlineTone(daysLeft)}`}>
                      {daysLeft < 0 ? 'Closed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900">{tender.tender_name}</h2>
                  <p className="mt-1 text-sm text-gray-600">{tender.tender_id} - {tender.unit_or_formation}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric title="Estimated value" value={formatCurrency(tender.estimated_value_amount, tender.estimated_value_currency)} />
                    <Metric title="Bid closes" value={formatDate(tender.bid_submission_end)} />
                    <Metric title="Eligibility criteria" value={`${tender.criteria_count}`} />
                    <Metric title="Mandatory docs" value={`${tender.mandatory_documents_count}`} />
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Document strictness</span>
                      <span>{mandatoryRatio}% mandatory</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${mandatoryRatio}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-52">
                  <Link to={`/tenders/${tender.tender_id}`} className="btn-primary inline-flex items-center justify-center">
                    View bid details <ChevronRight size={16} className="ml-2" />
                  </Link>
                  <Link to={`/submit-bid/${tender.tender_id}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Open checklist
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {filteredBidderTenders.length === 0 && (
        <div className="card py-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No tenders match these filters</h3>
          <p className="text-gray-600">Adjust category, location, value, or search text.</p>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-3">
    <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
    <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

const MetricTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
  </div>
);

export default TenderList;
