import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bidderService, getApiErrorMessage } from '../services/api';
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileSignature,
  Info,
  Lock,
  MapPin,
  Phone,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const LEGACY_PROFILE_KEY = 'satyam.bidder.profile';

type OrganisationType = 'Proprietorship' | 'Partnership' | 'PvtLtd' | 'LLP' | 'PSU' | 'NGO' | 'Other';
type MSMEType = 'Micro' | 'Small' | 'Medium' | 'NotRegistered' | 'Unknown';
type GSTFilingStatus = 'Regular' | 'Composition' | 'Exempt' | 'Unknown';
type BusinessCategory = 'SecurityEquipment' | 'ITServices' | 'Construction' | 'Logistics' | 'Consulting' | 'Maintenance' | 'Other';
type BusinessModel = 'Manufacturer' | 'Trader' | 'ServiceProvider' | 'ManufacturerAndService' | 'TraderAndService' | 'Other';
type ManpowerStrength = '<10' | '10-50' | '51-200' | '201-500' | '>500';
type SignatoryIdType = 'Aadhaar' | 'Passport' | 'DrivingLicence' | 'VoterId' | 'Other';
type SaveMode = 'Draft' | 'Lock';

interface FinancialYearRow {
  financial_year_id: string;
  bidder_id: string;
  financial_year_label: string;
  turnover_amount_inr: string;
  is_turnover_audited: boolean;
  net_worth_or_paid_up_capital_inr: string;
}

interface BidderProfileForm {
  bidder_id: string;
  organisation_name: string;
  organisation_type: OrganisationType;
  msmetype: MSMEType;
  year_of_incorporation: string;
  cin: string;
  gstin: string;
  pan: string;
  msme_registration_no: string;
  udyam_no: string;
  nsic_registration_no: string;
  startup_india_registration_no: string;
  gem_registration_id: string;
  gst_filing_status: GSTFilingStatus;
  registered_address_line1: string;
  registered_address_line2: string;
  registered_city: string;
  registered_state: string;
  registered_pincode: string;
  communication_address_line1: string;
  communication_address_line2: string;
  communication_city: string;
  communication_state: string;
  communication_pincode: string;
  is_communication_same_as_registered: boolean;
  primary_contact_name: string;
  primary_contact_designation: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  secondary_contact_phone: string;
  primary_business_categories: BusinessCategory[];
  business_keywords: string[];
  business_model: BusinessModel;
  average_manpower_strength: ManpowerStrength | '';
  authorised_signatory_name: string;
  authorised_signatory_designation: string;
  authorised_signatory_id_type: SignatoryIdType;
  authorised_signatory_id_number: string;
  authorised_signatory_signature_file_path: string;
  has_bank_details_provided: boolean;
  bank_name: string;
  bank_branch: string;
  bank_account_holder_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  past_performance_summary: string;
  is_locked: boolean;
  financial_years: FinancialYearRow[];
}

const organisationTypes: OrganisationType[] = ['Proprietorship', 'Partnership', 'PvtLtd', 'LLP', 'PSU', 'NGO', 'Other'];
const msmeTypes: MSMEType[] = ['Micro', 'Small', 'Medium', 'NotRegistered', 'Unknown'];
const gstStatuses: GSTFilingStatus[] = ['Regular', 'Composition', 'Exempt', 'Unknown'];
const businessCategories: BusinessCategory[] = ['SecurityEquipment', 'ITServices', 'Construction', 'Logistics', 'Consulting', 'Maintenance', 'Other'];
const businessModels: BusinessModel[] = ['Manufacturer', 'Trader', 'ServiceProvider', 'ManufacturerAndService', 'TraderAndService', 'Other'];
const manpowerStrengths: Array<{ label: string; value: ManpowerStrength }> = [
  { label: '<10', value: '<10' },
  { label: '10–50', value: '10-50' },
  { label: '51–200', value: '51-200' },
  { label: '201–500', value: '201-500' },
  { label: '>500', value: '>500' },
];
const signatoryIdTypes: SignatoryIdType[] = ['Aadhaar', 'Passport', 'DrivingLicence', 'VoterId', 'Other'];

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const pincodePattern = /^[0-9]{6}$/;

const createId = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

const defaultFinancialYear = (): FinancialYearRow => ({
  financial_year_id: createId('FY'),
  bidder_id: '',
  financial_year_label: '',
  turnover_amount_inr: '',
  is_turnover_audited: false,
  net_worth_or_paid_up_capital_inr: '',
});

const defaultProfile = (userId: string): BidderProfileForm => ({
  bidder_id: userId || createId('BIDDER'),
  organisation_name: '',
  organisation_type: 'Other',
  msmetype: 'Unknown',
  year_of_incorporation: '',
  cin: '',
  gstin: '',
  pan: '',
  msme_registration_no: '',
  udyam_no: '',
  nsic_registration_no: '',
  startup_india_registration_no: '',
  gem_registration_id: '',
  gst_filing_status: 'Unknown',
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',
  communication_address_line1: '',
  communication_address_line2: '',
  communication_city: '',
  communication_state: '',
  communication_pincode: '',
  is_communication_same_as_registered: true,
  primary_contact_name: '',
  primary_contact_designation: '',
  primary_contact_email: '',
  primary_contact_phone: '',
  secondary_contact_name: '',
  secondary_contact_email: '',
  secondary_contact_phone: '',
  primary_business_categories: [],
  business_keywords: [],
  business_model: 'Other',
  average_manpower_strength: '',
  authorised_signatory_name: '',
  authorised_signatory_designation: '',
  authorised_signatory_id_type: 'Other',
  authorised_signatory_id_number: '',
  authorised_signatory_signature_file_path: '',
  has_bank_details_provided: false,
  bank_name: '',
  bank_branch: '',
  bank_account_holder_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  past_performance_summary: '',
  is_locked: false,
  financial_years: [defaultFinancialYear()],
});

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const normalizeProfile = (input: any, userId: string): BidderProfileForm => {
  const profile = defaultProfile(userId);
  if (!input) return profile;

  const communicationSame = input.is_communication_same_as_registered ?? input.isCommunicationSameAsRegistered ?? true;
  const registeredLine1 = input.registered_address_line1 || input.registeredAddressLine1 || input.registered_address || '';
  const registeredLine2 = input.registered_address_line2 || input.registeredAddressLine2 || '';
  const registeredCity = input.registered_city || input.registeredCity || '';
  const registeredState = input.registered_state || input.registeredState || '';
  const registeredPincode = input.registered_pincode || input.registeredPincode || '';

  return {
    ...profile,
    bidder_id: input.bidder_id || input.bidderId || profile.bidder_id,
    organisation_name: input.organisation_name || input.organization_name || '',
    organisation_type: input.organisation_type || input.organisationType || 'Other',
    msmetype: input.msmetype || input.msme_type || 'Unknown',
    year_of_incorporation: input.year_of_incorporation ? String(input.year_of_incorporation) : '',
    cin: input.cin || '',
    gstin: (input.gstin || '').toUpperCase(),
    pan: (input.pan || '').toUpperCase(),
    msme_registration_no: input.msme_registration_no || '',
    udyam_no: input.udyam_no || '',
    nsic_registration_no: input.nsic_registration_no || '',
    startup_india_registration_no: input.startup_india_registration_no || '',
    gem_registration_id: input.gem_registration_id || '',
    gst_filing_status: input.gst_filing_status || 'Unknown',
    registered_address_line1: registeredLine1,
    registered_address_line2: registeredLine2,
    registered_city: registeredCity,
    registered_state: registeredState,
    registered_pincode: registeredPincode,
    communication_address_line1: communicationSame ? registeredLine1 : (input.communication_address_line1 || input.communicationAddressLine1 || ''),
    communication_address_line2: communicationSame ? registeredLine2 : (input.communication_address_line2 || input.communicationAddressLine2 || ''),
    communication_city: communicationSame ? registeredCity : (input.communication_city || input.communicationCity || ''),
    communication_state: communicationSame ? registeredState : (input.communication_state || input.communicationState || ''),
    communication_pincode: communicationSame ? registeredPincode : (input.communication_pincode || input.communicationPincode || ''),
    is_communication_same_as_registered: communicationSame,
    primary_contact_name: input.primary_contact_name || input.contact_name || '',
    primary_contact_designation: input.primary_contact_designation || '',
    primary_contact_email: input.primary_contact_email || input.contact_email || '',
    primary_contact_phone: input.primary_contact_phone || input.contact_phone || '',
    secondary_contact_name: input.secondary_contact_name || '',
    secondary_contact_email: input.secondary_contact_email || '',
    secondary_contact_phone: input.secondary_contact_phone || '',
    primary_business_categories: normalizeStringArray(input.primary_business_categories || input.primaryBusinessCategories) as BusinessCategory[],
    business_keywords: normalizeStringArray(input.business_keywords || input.businessKeywords),
    business_model: input.business_model || input.businessModel || 'Other',
    average_manpower_strength: input.average_manpower_strength || input.averageManpowerStrength || '',
    authorised_signatory_name: input.authorised_signatory_name || '',
    authorised_signatory_designation: input.authorised_signatory_designation || '',
    authorised_signatory_id_type: input.authorised_signatory_id_type || 'Other',
    authorised_signatory_id_number: input.authorised_signatory_id_number || '',
    authorised_signatory_signature_file_path: input.authorised_signatory_signature_file_path || '',
    has_bank_details_provided: Boolean(input.has_bank_details_provided ?? input.hasBankDetailsProvided),
    bank_name: input.bank_name || '',
    bank_branch: input.bank_branch || '',
    bank_account_holder_name: input.bank_account_holder_name || '',
    bank_account_number: input.bank_account_number || '',
    bank_ifsc: input.bank_ifsc || '',
    past_performance_summary: input.past_performance_summary || '',
    is_locked: Boolean(input.is_locked),
    financial_years: Array.isArray(input.financial_years)
      ? input.financial_years.slice(0, 5).map((year: any) => ({
          financial_year_id: year.financial_year_id || year.financialYearId || createId('FY'),
          bidder_id: year.bidder_id || year.bidderId || input.bidder_id || profile.bidder_id,
          financial_year_label: year.financial_year_label || year.financialYearLabel || '',
          turnover_amount_inr: year.turnover_amount_inr !== undefined && year.turnover_amount_inr !== null ? String(year.turnover_amount_inr) : '',
          is_turnover_audited: Boolean(year.is_turnover_audited ?? year.isTurnoverAudited),
          net_worth_or_paid_up_capital_inr: year.net_worth_or_paid_up_capital_inr !== undefined && year.net_worth_or_paid_up_capital_inr !== null ? String(year.net_worth_or_paid_up_capital_inr) : '',
        }))
      : profile.financial_years,
  };
};

const toLegacyProfile = (profile: BidderProfileForm) => ({
  bidder_id: profile.bidder_id,
  organisation_name: profile.organisation_name,
  type: profile.msmetype === 'Micro' || profile.msmetype === 'Small' || profile.msmetype === 'Medium' ? 'MSME' : 'Other',
  gstin: profile.gstin,
  pan: profile.pan,
  msme_registration_no: profile.msme_registration_no,
  registered_address: [profile.registered_address_line1, profile.registered_address_line2, profile.registered_city, profile.registered_state, profile.registered_pincode].filter(Boolean).join(', '),
  contact_name: profile.primary_contact_name,
  contact_email: profile.primary_contact_email,
  contact_phone: profile.primary_contact_phone,
  login_user_id: profile.bidder_id,
  past_performance_summary: profile.past_performance_summary,
});

const formatMoney = (value: string) => {
  if (!value) return '';
  return Number(value).toLocaleString('en-IN');
};

const BidderProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BidderProfileForm>(() => defaultProfile(user?.id || 'bidder-demo'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [editingFinancialYearId, setEditingFinancialYearId] = useState<string | null>(null);
  const [yearDraft, setYearDraft] = useState<FinancialYearRow>(defaultFinancialYear());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await bidderService.getProfile();
        const next = normalizeProfile(response, user?.id || 'bidder-demo');
        setProfile(next);
        setShowBankDetails(next.has_bank_details_provided);
      } catch (apiError) {
        const fallback = (() => {
          try {
            return JSON.parse(localStorage.getItem(LEGACY_PROFILE_KEY) || 'null');
          } catch {
            return null;
          }
        })();
        const next = normalizeProfile(fallback, user?.id || 'bidder-demo');
        setProfile(next);
        setShowBankDetails(next.has_bank_details_provided);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  useEffect(() => {
    if (!profile.is_communication_same_as_registered) return;
    setProfile((current) => ({
      ...current,
      communication_address_line1: current.registered_address_line1,
      communication_address_line2: current.registered_address_line2,
      communication_city: current.registered_city,
      communication_state: current.registered_state,
      communication_pincode: current.registered_pincode,
    }));
  }, [profile.is_communication_same_as_registered, profile.registered_address_line1, profile.registered_address_line2, profile.registered_city, profile.registered_state, profile.registered_pincode]);

  const updateField = <K extends keyof BidderProfileForm>(field: K, value: BidderProfileForm[K]) => {
    setMessage('');
    setError('');
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const validate = () => {
    const problems: string[] = [];
    const currentYear = new Date().getFullYear();
    const requiredCore = [
      ['Organisation name', profile.organisation_name.trim()],
      ['Organisation type', profile.organisation_type],
      ['GSTIN', profile.gstin.trim()],
      ['PAN', profile.pan.trim()],
      ['Registered address line 1', profile.registered_address_line1.trim()],
      ['Registered city', profile.registered_city.trim()],
      ['Registered state', profile.registered_state.trim()],
      ['Registered pincode', profile.registered_pincode.trim()],
      ['Primary contact name', profile.primary_contact_name.trim()],
      ['Primary contact email', profile.primary_contact_email.trim()],
      ['Primary contact phone', profile.primary_contact_phone.trim()],
      ['Authorised signatory name', profile.authorised_signatory_name.trim()],
      ['Authorised signatory designation', profile.authorised_signatory_designation.trim()],
    ] as Array<[string, string]>;

    requiredCore.forEach(([label, value]) => {
      if (!value) problems.push(`${label} is required.`);
    });

    if (profile.gstin && !gstinPattern.test(profile.gstin.trim().toUpperCase())) {
      problems.push('GSTIN format is invalid.');
    }
    if (profile.pan && !panPattern.test(profile.pan.trim().toUpperCase())) {
      problems.push('PAN format is invalid.');
    }
    if (profile.year_of_incorporation) {
      const year = Number(profile.year_of_incorporation);
      if (Number.isNaN(year) || year < 1900 || year > currentYear) {
        problems.push('Year of incorporation must be between 1900 and the current year.');
      }
    }

    [profile.registered_pincode, profile.communication_pincode].forEach((pincode) => {
      if (pincode && !pincodePattern.test(pincode)) {
        problems.push('Indian pincodes must contain 6 digits.');
      }
    });

    if (profile.has_bank_details_provided) {
      if (!profile.bank_name.trim()) problems.push('Bank name is required when bank details are enabled.');
      if (!profile.bank_account_number.trim()) problems.push('Bank account number is required when bank details are enabled.');
      if (!profile.bank_ifsc.trim()) problems.push('Bank IFSC is required when bank details are enabled.');
      if (profile.bank_ifsc && !ifscPattern.test(profile.bank_ifsc.trim().toUpperCase())) {
        problems.push('Bank IFSC must follow 4 letters + 7 alphanumeric characters.');
      }
    }

    return problems;
  };

  const warnings = useMemo(() => {
    const notes: string[] = [];
    if (["PvtLtd", "LLP", "PSU"].includes(profile.organisation_type) && !profile.cin.trim()) {
      notes.push('CIN is recommended for Pvt Ltd / LLP / PSU profiles.');
    }
    return notes;
  }, [profile.cin, profile.organisation_type]);

  const completeness = useMemo(() => {
    const checks = [
      profile.organisation_name.trim(),
      profile.organisation_type,
      gstinPattern.test(profile.gstin.trim().toUpperCase()),
      panPattern.test(profile.pan.trim().toUpperCase()),
      profile.registered_address_line1.trim(),
      profile.registered_city.trim(),
      profile.registered_state.trim(),
      profile.registered_pincode.trim(),
      profile.primary_contact_name.trim(),
      profile.primary_contact_email.trim(),
      profile.primary_contact_phone.trim(),
      profile.authorised_signatory_name.trim(),
      profile.authorised_signatory_designation.trim(),
      profile.financial_years.some((row) => row.financial_year_label.trim()),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const syncLegacyStorage = (nextProfile: BidderProfileForm) => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(toLegacyProfile(nextProfile)));
  };

  const addKeyword = () => {
    const keyword = keywordDraft.trim();
    if (!keyword) return;
    if (profile.business_keywords.includes(keyword)) {
      setKeywordDraft('');
      return;
    }
    updateField('business_keywords', [...profile.business_keywords, keyword]);
    setKeywordDraft('');
  };

  const removeKeyword = (keyword: string) => {
    updateField('business_keywords', profile.business_keywords.filter((item) => item !== keyword));
  };

  const toggleCategory = (category: BusinessCategory) => {
    const exists = profile.primary_business_categories.includes(category);
    updateField('primary_business_categories', exists
      ? profile.primary_business_categories.filter((item) => item !== category)
      : [...profile.primary_business_categories, category]
    );
  };

  const prepareFinancialYear = (row: FinancialYearRow): FinancialYearRow => ({
    ...row,
    financial_year_label: row.financial_year_label.trim(),
    turnover_amount_inr: row.turnover_amount_inr.trim(),
    net_worth_or_paid_up_capital_inr: row.net_worth_or_paid_up_capital_inr.trim(),
    bidder_id: profile.bidder_id,
  });

  const saveFinancialYear = () => {
    if (!yearDraft.financial_year_label.trim()) {
      setError('Financial year label is required.');
      return;
    }
    const cleaned = prepareFinancialYear(yearDraft);
    const exists = profile.financial_years.some((row) => row.financial_year_id === cleaned.financial_year_id);
    const nextYears = exists
      ? profile.financial_years.map((row) => (row.financial_year_id === cleaned.financial_year_id ? cleaned : row))
      : [...profile.financial_years, cleaned].slice(-5);
    updateField('financial_years', nextYears);
    setEditingFinancialYearId(null);
    setYearDraft(defaultFinancialYear());
  };

  const editFinancialYear = (row: FinancialYearRow) => {
    setEditingFinancialYearId(row.financial_year_id);
    setYearDraft(row);
  };

  const deleteFinancialYear = (financialYearId: string) => {
    updateField('financial_years', profile.financial_years.filter((row) => row.financial_year_id !== financialYearId));
    if (editingFinancialYearId === financialYearId) {
      setEditingFinancialYearId(null);
      setYearDraft(defaultFinancialYear());
    }
  };

  const setCommunicationSame = (checked: boolean) => {
    updateField('is_communication_same_as_registered', checked);
    if (checked) {
      setProfile((current) => ({
        ...current,
        communication_address_line1: current.registered_address_line1,
        communication_address_line2: current.registered_address_line2,
        communication_city: current.registered_city,
        communication_state: current.registered_state,
        communication_pincode: current.registered_pincode,
      }));
    }
  };

  const handleFileUpload = (file: File | null) => {
    if (!file) return;
    updateField('authorised_signatory_signature_file_path', `mock://signatures/${file.name}`);
  };

  const handleSave = async (saveMode: SaveMode) => {
    const errors = validate();
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    setSaving(saveMode);
    setError('');
    setMessage('');

    const payload = {
      ...profile,
      bidder_id: profile.bidder_id || user?.id || 'bidder-demo',
      gstin: profile.gstin.trim().toUpperCase(),
      pan: profile.pan.trim().toUpperCase(),
      year_of_incorporation: profile.year_of_incorporation ? Number(profile.year_of_incorporation) : null,
      communication_address_line1: profile.is_communication_same_as_registered ? profile.registered_address_line1 : profile.communication_address_line1,
      communication_address_line2: profile.is_communication_same_as_registered ? profile.registered_address_line2 : profile.communication_address_line2,
      communication_city: profile.is_communication_same_as_registered ? profile.registered_city : profile.communication_city,
      communication_state: profile.is_communication_same_as_registered ? profile.registered_state : profile.communication_state,
      communication_pincode: profile.is_communication_same_as_registered ? profile.registered_pincode : profile.communication_pincode,
      primary_business_categories: profile.primary_business_categories,
      business_keywords: profile.business_keywords,
      financial_years: profile.financial_years.map(prepareFinancialYear).slice(0, 5),
      has_bank_details_provided: profile.has_bank_details_provided,
      save_mode: saveMode,
    };

    try {
      const response = await bidderService.saveProfile(payload);
      const next = normalizeProfile(response, user?.id || 'bidder-demo');
      setProfile(next);
      syncLegacyStorage(next);
      setMessage(saveMode === 'Lock' ? 'Profile saved and locked.' : 'Profile saved as draft.');
    } catch (apiError: any) {
      if ((localStorage.getItem('token') || '').startsWith('demo-token:')) {
        const next = normalizeProfile(payload, user?.id || 'bidder-demo');
        setProfile(next);
        syncLegacyStorage(next);
        setMessage(saveMode === 'Lock' ? 'Profile saved and locked locally.' : 'Profile saved as draft locally.');
      } else {
        setError(getApiErrorMessage(apiError, 'Unable to save bidder profile.'));
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              <Shield size={14} className="mr-2" /> Reusable bidder identity
            </div>
            <h1 className="mt-4 text-3xl font-bold">Bidder Profile</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Maintain a single organisation profile reused across tenders for eligibility checks, extraction matching, and audit-ready evaluation.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-slate-200">Profile completeness</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-bold">{completeness}%</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profile.is_locked ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
                {profile.is_locked ? 'Locked' : 'Draft'}
              </span>
            </div>
            <div className="mt-3 h-2 w-64 max-w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-sm text-success-800">
          {message}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Organisation & Legal" icon={<Building2 size={18} />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Organisation name *" value={profile.organisation_name} onChange={(value) => updateField('organisation_name', value)} disabled={profile.is_locked} />
            <SelectField label="Organisation type *" value={profile.organisation_type} options={organisationTypes} onChange={(value) => updateField('organisation_type', value as OrganisationType)} disabled={profile.is_locked} />
            <SelectField label="MSME type" value={profile.msmetype} options={msmeTypes} onChange={(value) => updateField('msmetype', value as MSMEType)} disabled={profile.is_locked} />
            <Field label="Year of incorporation" value={profile.year_of_incorporation} onChange={(value) => updateField('year_of_incorporation', value)} type="number" disabled={profile.is_locked} />
            <Field label="CIN" value={profile.cin} onChange={(value) => updateField('cin', value)} disabled={profile.is_locked} helpText="Recommended for Pvt Ltd / LLP / PSU" />
            <SelectField label="GST filing status" value={profile.gst_filing_status} options={gstStatuses} onChange={(value) => updateField('gst_filing_status', value as GSTFilingStatus)} disabled={profile.is_locked} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ValidatedField label="GSTIN *" value={profile.gstin} onChange={(value) => updateField('gstin', value.toUpperCase())} valid={gstinPattern.test(profile.gstin.trim().toUpperCase())} placeholder="22AAAAA0000A1Z5" disabled={profile.is_locked} />
            <ValidatedField label="PAN *" value={profile.pan} onChange={(value) => updateField('pan', value.toUpperCase())} valid={panPattern.test(profile.pan.trim().toUpperCase())} placeholder="ABCDE1234F" disabled={profile.is_locked} />
            <Field label="MSME registration no." value={profile.msme_registration_no} onChange={(value) => updateField('msme_registration_no', value)} disabled={profile.is_locked} />
            <Field label="Udyam no." value={profile.udyam_no} onChange={(value) => updateField('udyam_no', value)} disabled={profile.is_locked} />
            <Field label="NSIC registration no." value={profile.nsic_registration_no} onChange={(value) => updateField('nsic_registration_no', value)} disabled={profile.is_locked} />
            <Field label="Startup India registration no." value={profile.startup_india_registration_no} onChange={(value) => updateField('startup_india_registration_no', value)} disabled={profile.is_locked} />
            <Field label="GeM registration id" value={profile.gem_registration_id} onChange={(value) => updateField('gem_registration_id', value)} disabled={profile.is_locked} />
          </div>
        </SectionCard>

        <SectionCard title="Addresses" icon={<MapPin size={18} />}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Registered address line 1 *" value={profile.registered_address_line1} onChange={(value) => updateField('registered_address_line1', value)} disabled={profile.is_locked} />
              <Field label="Registered address line 2" value={profile.registered_address_line2} onChange={(value) => updateField('registered_address_line2', value)} disabled={profile.is_locked} />
              <Field label="Registered city *" value={profile.registered_city} onChange={(value) => updateField('registered_city', value)} disabled={profile.is_locked} />
              <Field label="Registered state *" value={profile.registered_state} onChange={(value) => updateField('registered_state', value)} disabled={profile.is_locked} />
              <Field label="Registered pincode *" value={profile.registered_pincode} onChange={(value) => updateField('registered_pincode', value)} disabled={profile.is_locked} maxLength={6} />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={profile.is_communication_same_as_registered}
                onChange={(event) => setCommunicationSame(event.target.checked)}
                disabled={profile.is_locked}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Communication address same as registered
            </label>

            <div className={`space-y-4 rounded-2xl border p-4 ${profile.is_communication_same_as_registered ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Communication address</p>
                {profile.is_communication_same_as_registered && <span className="text-xs text-slate-500">Copied from registered address</span>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Line 1" value={profile.communication_address_line1} onChange={(value) => updateField('communication_address_line1', value)} disabled={profile.is_communication_same_as_registered || profile.is_locked} />
                <Field label="Line 2" value={profile.communication_address_line2} onChange={(value) => updateField('communication_address_line2', value)} disabled={profile.is_communication_same_as_registered || profile.is_locked} />
                <Field label="City" value={profile.communication_city} onChange={(value) => updateField('communication_city', value)} disabled={profile.is_communication_same_as_registered || profile.is_locked} />
                <Field label="State" value={profile.communication_state} onChange={(value) => updateField('communication_state', value)} disabled={profile.is_communication_same_as_registered || profile.is_locked} />
                <Field label="Pincode" value={profile.communication_pincode} onChange={(value) => updateField('communication_pincode', value)} disabled={profile.is_communication_same_as_registered || profile.is_locked} maxLength={6} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Contact Details" icon={<Phone size={18} />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary contact name *" value={profile.primary_contact_name} onChange={(value) => updateField('primary_contact_name', value)} disabled={profile.is_locked} />
            <Field label="Primary contact designation" value={profile.primary_contact_designation} onChange={(value) => updateField('primary_contact_designation', value)} disabled={profile.is_locked} />
            <ValidatedField label="Primary contact email *" value={profile.primary_contact_email} onChange={(value) => updateField('primary_contact_email', value)} valid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.primary_contact_email)} disabled={profile.is_locked} />
            <Field label="Primary contact phone *" value={profile.primary_contact_phone} onChange={(value) => updateField('primary_contact_phone', value)} disabled={profile.is_locked} />
            <Field label="Secondary contact name" value={profile.secondary_contact_name} onChange={(value) => updateField('secondary_contact_name', value)} disabled={profile.is_locked} />
            <ValidatedField label="Secondary contact email" value={profile.secondary_contact_email} onChange={(value) => updateField('secondary_contact_email', value)} valid={!profile.secondary_contact_email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.secondary_contact_email)} disabled={profile.is_locked} />
            <Field label="Secondary contact phone" value={profile.secondary_contact_phone} onChange={(value) => updateField('secondary_contact_phone', value)} disabled={profile.is_locked} />
          </div>
        </SectionCard>

        <SectionCard title="Financial Profile" icon={<ClipboardList size={18} />} className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Add the latest 5 financial years for turnover and net worth / paid-up capital checks.</p>
            <button
              type="button"
              onClick={() => {
                if (profile.financial_years.length >= 5) {
                  setError('Only the latest 5 financial years can be stored.');
                  return;
                }
                setEditingFinancialYearId('new');
                setYearDraft(defaultFinancialYear());
              }}
              disabled={profile.is_locked}
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Plus size={16} className="mr-2" /> Add FY
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="max-h-[320px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">FY label</th>
                    <th className="px-4 py-3 font-semibold">Turnover (INR)</th>
                    <th className="px-4 py-3 font-semibold">Audited</th>
                    <th className="px-4 py-3 font-semibold">Net worth / paid-up capital</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.financial_years.map((row) => (
                    <tr key={row.financial_year_id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium">{row.financial_year_label || '—'}</td>
                      <td className="px-4 py-3">{row.turnover_amount_inr ? formatMoney(row.turnover_amount_inr) : '—'}</td>
                      <td className="px-4 py-3">{row.is_turnover_audited ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">{row.net_worth_or_paid_up_capital_inr ? formatMoney(row.net_worth_or_paid_up_capital_inr) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button type="button" disabled={profile.is_locked} onClick={() => editFinancialYear(row)} className="text-primary-700 hover:text-primary-900 disabled:opacity-50">Edit</button>
                          <button type="button" disabled={profile.is_locked} onClick={() => deleteFinancialYear(row.financial_year_id)} className="text-danger-700 hover:text-danger-900 disabled:opacity-50"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {profile.financial_years.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No financial years added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(editingFinancialYearId || profile.financial_years.length === 0) && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="FY label" value={yearDraft.financial_year_label} onChange={(value) => setYearDraft((current) => ({ ...current, financial_year_label: value }))} disabled={profile.is_locked} placeholder="2024-25" />
                <Field label="Turnover amount INR" value={yearDraft.turnover_amount_inr} onChange={(value) => setYearDraft((current) => ({ ...current, turnover_amount_inr: value }))} disabled={profile.is_locked} />
                <Field label="Net worth / paid-up capital INR" value={yearDraft.net_worth_or_paid_up_capital_inr} onChange={(value) => setYearDraft((current) => ({ ...current, net_worth_or_paid_up_capital_inr: value }))} disabled={profile.is_locked} />
                <label className="flex items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={yearDraft.is_turnover_audited} onChange={(event) => setYearDraft((current) => ({ ...current, is_turnover_audited: event.target.checked }))} disabled={profile.is_locked} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Turnover audited
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setEditingFinancialYearId(null); setYearDraft(defaultFinancialYear()); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                <button type="button" onClick={saveFinancialYear} disabled={profile.is_locked} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save FY</button>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Business Capability" icon={<Briefcase size={18} />}>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-800">Primary categories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {businessCategories.map((category) => {
                  const active = profile.primary_business_categories.includes(category);
                  return (
                    <button type="button" key={category} disabled={profile.is_locked} onClick={() => toggleCategory(category)} className={`rounded-full border px-3 py-2 text-sm font-medium disabled:opacity-50 ${active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Business keywords</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.business_keywords.map((keyword) => (
                  <span key={keyword} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    {keyword}
                    <button type="button" disabled={profile.is_locked} onClick={() => removeKeyword(keyword)}><X size={14} /></button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-3">
                <input
                  className="input-field"
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="e.g. CCTV, server racks, manpower"
                  disabled={profile.is_locked}
                />
                <button type="button" onClick={addKeyword} disabled={profile.is_locked} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Business model</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {businessModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    disabled={profile.is_locked}
                    onClick={() => updateField('business_model', model)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${profile.business_model === model ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>

            <SelectField label="Average manpower strength" value={profile.average_manpower_strength} options={manpowerStrengths.map((item) => item.value)} onChange={(value) => updateField('average_manpower_strength', value as ManpowerStrength)} disabled={profile.is_locked} />
          </div>
        </SectionCard>

        <SectionCard title="Authorised Signatory" icon={<FileSignature size={18} />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name *" value={profile.authorised_signatory_name} onChange={(value) => updateField('authorised_signatory_name', value)} disabled={profile.is_locked} />
            <Field label="Designation *" value={profile.authorised_signatory_designation} onChange={(value) => updateField('authorised_signatory_designation', value)} disabled={profile.is_locked} />
            <SelectField label="ID type" value={profile.authorised_signatory_id_type} options={signatoryIdTypes} onChange={(value) => updateField('authorised_signatory_id_type', value as SignatoryIdType)} disabled={profile.is_locked} />
            <Field label="ID number" value={profile.authorised_signatory_id_number} onChange={(value) => updateField('authorised_signatory_id_number', value)} disabled={profile.is_locked} />
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Specimen signature upload</label>
              <div className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                <Upload size={18} className="text-slate-500" />
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={profile.is_locked}
                  onChange={(event) => handleFileUpload(event.target.files?.[0] || null)}
                  className="text-sm text-slate-600"
                />
              </div>
              {profile.authorised_signatory_signature_file_path && (
                <p className="mt-2 text-xs text-slate-500">Stored as: {profile.authorised_signatory_signature_file_path}</p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Optional Bank Details" icon={<Banknote size={18} />} className="xl:col-span-2">
          <button type="button" onClick={() => setShowBankDetails((value) => !value)} className="mb-4 inline-flex items-center text-sm font-semibold text-primary-700">
            {showBankDetails ? <ChevronUp size={16} className="mr-2" /> : <ChevronDown size={16} className="mr-2" />}
            Optional (for refunds)
          </button>

          {showBankDetails && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                <input
                  type="checkbox"
                  checked={profile.has_bank_details_provided}
                  onChange={(event) => updateField('has_bank_details_provided', event.target.checked)}
                  disabled={profile.is_locked}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Bank details provided
              </label>
              <Field label="Bank name" value={profile.bank_name} onChange={(value) => updateField('bank_name', value)} disabled={profile.is_locked || !profile.has_bank_details_provided} />
              <Field label="Bank branch" value={profile.bank_branch} onChange={(value) => updateField('bank_branch', value)} disabled={profile.is_locked || !profile.has_bank_details_provided} />
              <Field label="Account holder name" value={profile.bank_account_holder_name} onChange={(value) => updateField('bank_account_holder_name', value)} disabled={profile.is_locked || !profile.has_bank_details_provided} />
              <Field label="Account number" value={profile.bank_account_number} onChange={(value) => updateField('bank_account_number', value)} disabled={profile.is_locked || !profile.has_bank_details_provided} />
              <ValidatedField label="IFSC" value={profile.bank_ifsc} onChange={(value) => updateField('bank_ifsc', value.toUpperCase())} valid={!profile.has_bank_details_provided || !profile.bank_ifsc || ifscPattern.test(profile.bank_ifsc.trim().toUpperCase())} disabled={profile.is_locked || !profile.has_bank_details_provided} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Past Performance" icon={<Info size={18} />} className="xl:col-span-2">
          <textarea
            className="input-field min-h-[140px]"
            value={profile.past_performance_summary}
            onChange={(event) => updateField('past_performance_summary', event.target.value)}
            disabled={profile.is_locked}
            placeholder="Summarise previous projects, client names, completion quality, and any award history."
          />
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-primary-600" />
          <div>
            <p className="font-medium text-slate-900">Saved profile is reused across all tenders</p>
            <p>Only required basic fields are enforced. Bank details are optional and validated only when enabled.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => handleSave('Draft')} disabled={saving !== null || profile.is_locked} className="btn-secondary inline-flex items-center justify-center disabled:opacity-60">
            {saving === 'Draft' ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" /> : <Save size={16} className="mr-2" />}
            Save as Draft
          </button>
          <button type="button" onClick={() => handleSave('Lock')} disabled={saving !== null || profile.is_locked} className="btn-primary inline-flex items-center justify-center disabled:opacity-60">
            {saving === 'Lock' ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : <Lock size={16} className="mr-2" />}
            Save & Lock
          </button>
          {profile.is_locked && (
            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <BadgeCheck size={16} className="mr-2" /> Locked for admin-controlled edits
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, icon, className, children }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className || ''}`}>
    <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  helpText?: string;
}> = ({ label, value, onChange, type = 'text', disabled = false, placeholder, maxLength, helpText }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    <input
      className="input-field"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
    />
    {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
  </label>
);

const ValidatedField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  disabled?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, valid, disabled = false, placeholder }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    <div className="relative">
      <input
        className={`input-field pr-10 ${valid ? 'border-slate-300' : 'border-danger-300'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {value && valid ? <CheckCircle size={16} className="text-success-600" /> : value ? <AlertCircle size={16} className="text-danger-600" /> : null}
      </span>
    </div>
  </label>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, options, onChange, disabled = false }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    <select className="input-field" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

export default BidderProfile;
