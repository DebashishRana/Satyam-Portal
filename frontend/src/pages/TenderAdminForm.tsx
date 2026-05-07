import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardList,
  Edit3,
  Eye,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  TenderAdminMock,
  TenderCommitteeMemberMock,
  TenderCriterionMock,
  TenderDocumentRequirementMock,
  createChildId,
  createTenderId,
  getMockTenderById,
  saveMockTender,
  toEvaluationPayload,
} from '../services/tenderAdminMock';

type TabId = 'basic' | 'commercials' | 'criteria' | 'documents' | 'workflow';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'basic', label: 'Basic Details' },
  { id: 'commercials', label: 'Commercials & Security' },
  { id: 'criteria', label: 'Eligibility Criteria' },
  { id: 'documents', label: 'Document Checklist' },
  { id: 'workflow', label: 'Committee & Workflow' },
];

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const inDaysLocal = (days: number) => new Date(Date.now() + days * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);

const defaultCriterion = (count: number): TenderCriterionMock => ({
  criterion_id: createChildId('TECH', count),
  category: 'Technical',
  title: '',
  description: '',
  threshold_type: 'Boolean',
  threshold_value: 'true',
  threshold_value_max: '',
  unit: 'None',
  is_mandatory: true,
  relaxation_rule_text: '',
  evidence_type: 'Other',
  expected_document_format: 'PDF',
  auto_verification_source: 'None',
  scoring_weight: 0,
  applies_to_cover: 'Technical',
});

const defaultDocument = (count: number): TenderDocumentRequirementMock => ({
  document_requirement_id: createChildId('DOC', count),
  name: '',
  description: '',
  linked_criteria_ids: [],
  is_mandatory: true,
  is_conditional: false,
  condition_text: '',
  upload_type: 'Single',
  allowed_formats: 'pdf,jpg,png',
  max_file_size_mb: 10,
  requires_signature: true,
  requires_stamp: false,
  requires_notarisation: false,
  template_url: '',
});

const defaultMember = (count: number): TenderCommitteeMemberMock => ({
  committee_member_id: createChildId('CM', count),
  officer_name: '',
  designation: '',
  role: count === 0 ? 'Chair' : 'MemberTechnical',
  email: '',
  phone: '',
});

const createDefaultTender = (): TenderAdminMock => ({
  tender_id: createTenderId(),
  tender_name: '',
  procuring_organisation: 'CRPF',
  unit_or_formation: '',
  tender_type: 'Goods',
  procurement_mode: 'Open',
  category: '',
  sub_category: '',
  estimated_value_amount: 0,
  estimated_value_currency: 'INR',
  budget_head: '',
  locations_json: [''],
  nit_date: today(),
  bid_submission_start: nowLocal(),
  bid_submission_end: inDaysLocal(14),
  technical_bid_opening: inDaysLocal(15),
  financial_bid_opening: inDaysLocal(16),
  bid_validity_days: 90,
  contract_start_date: '',
  contract_end_date: '',
  delivery_schedule_text: '',
  no_of_covers: 'Two',
  evaluation_method: 'L1',
  emd_required: false,
  emd_amount: '',
  emd_exemption_rules: 'MSME and eligible registered suppliers may claim exemption as per tender conditions.',
  tender_fee_amount: '',
  performance_security_percent: 3,
  price_basis: 'InclusiveTaxes',
  contact_officer_name: '',
  contact_officer_designation: '',
  contact_email: '',
  contact_phone: '',
  status: 'Draft',
  criteria: [
    {
      ...defaultCriterion(0),
      criterion_id: 'TECH01',
      title: 'Technical compliance with specifications',
      description: 'Bidder must comply with all technical specifications stated in the NIT and BOQ.',
      evidence_type: 'Other',
    },
  ],
  document_requirements: [
    {
      ...defaultDocument(0),
      document_requirement_id: 'DOC01',
      name: 'Signed technical bid',
      description: 'Signed PDF containing bidder response to all technical requirements.',
      linked_criteria_ids: ['TECH01'],
    },
  ],
  evaluation_config: {
    ai_assist_level: 'PrefillWithConfirmation',
    ambiguity_confidence_threshold: 0.75,
    force_manual_review_on_conflict: true,
    enable_blacklist_check: true,
    blacklist_sources: ['InternalBlacklistDB'],
    requires_reasoned_order: true,
  },
  committee_members: [defaultMember(0)],
  created_at: '',
  updated_at: '',
});

const TenderAdminForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [formData, setFormData] = useState<TenderAdminMock>(createDefaultTender);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [criterionEditor, setCriterionEditor] = useState<{ index: number | null; value: TenderCriterionMock } | null>(null);
  const [documentEditor, setDocumentEditor] = useState<{ index: number | null; value: TenderDocumentRequirementMock } | null>(null);
  const [memberEditor, setMemberEditor] = useState<{ index: number | null; value: TenderCommitteeMemberMock } | null>(null);

  useEffect(() => {
    if (!id) return;
    const existing = getMockTenderById(id);
    if (existing) {
      setFormData(existing);
    } else {
      setError('This mock tender was not found in local demo storage.');
    }
  }, [id]);

  const aiPayload = useMemo(() => toEvaluationPayload(formData), [formData]);

  const updateField = (name: keyof TenderAdminMock, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = event.target as HTMLInputElement;
    const { name, type } = target;
    const value = type === 'checkbox' ? target.checked : type === 'number' ? Number(target.value) : target.value;
    updateField(name as keyof TenderAdminMock, value);
  };

  const validate = (mode: 'Draft' | 'Published') => {
    const errors: string[] = [];
    if (!formData.tender_name.trim()) errors.push('Tender name is required.');
    if (mode === 'Draft') return errors;

    if (!formData.unit_or_formation.trim()) errors.push('Unit or formation is required.');
    if (!formData.tender_type) errors.push('Tender type is required.');
    if (!formData.procurement_mode) errors.push('Procurement mode is required.');
    if (!formData.estimated_value_amount || Number(formData.estimated_value_amount) <= 0) errors.push('Estimated value must be greater than zero.');
    if (!formData.bid_submission_end) errors.push('Bid submission end is required.');
    if (!formData.evaluation_method) errors.push('Evaluation method is required.');
    if (formData.bid_submission_end && formData.bid_submission_start && new Date(formData.bid_submission_end) <= new Date(formData.bid_submission_start)) {
      errors.push('Bid submission end must be after bid submission start.');
    }
    if (formData.financial_bid_opening && formData.technical_bid_opening && new Date(formData.financial_bid_opening) < new Date(formData.technical_bid_opening)) {
      errors.push('Financial bid opening must be on or after technical bid opening.');
    }
    if (formData.emd_required && (!formData.emd_amount || Number(formData.emd_amount) <= 0)) {
      errors.push('EMD amount is mandatory when EMD is required.');
    }
    if (!formData.criteria.some((criterion) => criterion.is_mandatory)) {
      errors.push('At least one mandatory eligibility criterion must exist before publishing.');
    }
    if (!formData.contact_email.trim() || !formData.contact_phone.trim()) {
      errors.push('Contact email and phone are required before publishing.');
    }
    return errors;
  };

  const saveTender = (status: 'Draft' | 'Published') => {
    setError(null);
    setSavedMessage(null);
    const errors = validate(status);
    if (errors.length > 0) {
      setError(errors.join(' '));
      return;
    }

    const saved = saveMockTender({
      ...formData,
      locations_json: formData.locations_json.map((item) => item.trim()).filter(Boolean),
      status,
    });
    setFormData(saved);
    setSavedMessage(status === 'Published' ? 'Tender published in mock portal storage.' : 'Tender saved as draft in mock portal storage.');
    window.setTimeout(() => navigate('/tenders'), 450);
  };

  const saveCriterion = () => {
    if (!criterionEditor) return;
    const { index, value } = criterionEditor;
    if (!value.criterion_id.trim() || !value.title.trim() || !value.description.trim()) {
      setError('Criterion ID, title, and description are required.');
      return;
    }
    setFormData((prev) => {
      const criteria = [...prev.criteria];
      if (index === null) criteria.push(value);
      else criteria[index] = value;
      return { ...prev, criteria };
    });
    setCriterionEditor(null);
    setError(null);
  };

  const saveDocument = () => {
    if (!documentEditor) return;
    const { index, value } = documentEditor;
    if (!value.document_requirement_id.trim() || !value.name.trim()) {
      setError('Document requirement ID and name are required.');
      return;
    }
    setFormData((prev) => {
      const document_requirements = [...prev.document_requirements];
      if (index === null) document_requirements.push(value);
      else document_requirements[index] = value;
      return { ...prev, document_requirements };
    });
    setDocumentEditor(null);
    setError(null);
  };

  const saveMember = () => {
    if (!memberEditor) return;
    const { index, value } = memberEditor;
    if (!value.committee_member_id.trim() || !value.officer_name.trim()) {
      setError('Committee member ID and officer name are required.');
      return;
    }
    setFormData((prev) => {
      const committee_members = [...prev.committee_members];
      if (index === null) committee_members.push(value);
      else committee_members[index] = value;
      return { ...prev, committee_members };
    });
    setMemberEditor(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/tenders" className="text-sm text-primary-700 hover:text-primary-900">Back to tenders</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{id ? 'Edit Tender' : 'Create Tender'}</h1>
          <p className="text-sm text-gray-600">Mock admin setup for AI-assisted tender evaluation.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => saveTender('Draft')} className="btn-secondary inline-flex items-center">
            <Save size={16} className="mr-2" /> Save as Draft
          </button>
          <button type="button" onClick={() => saveTender('Published')} className="btn-primary inline-flex items-center">
            <Send size={16} className="mr-2" /> Publish Tender
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800">{error}</div>}
      {savedMessage && <div className="rounded-md border border-success-200 bg-success-50 p-3 text-sm text-success-800">{savedMessage}</div>}

      <div className="overflow-x-auto border-b border-gray-200">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'basic' && (
        <section className="bg-white border border-gray-200 rounded-md p-5">
          <SectionTitle icon={<ClipboardList size={18} />} title="Basic Details" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Tender ID" name="tender_id" value={formData.tender_id} onChange={handleInputChange} disabled />
            <Input label="Tender Name *" name="tender_name" value={formData.tender_name} onChange={handleInputChange} />
            <Select label="Procuring Organisation" name="procuring_organisation" value={formData.procuring_organisation} onChange={handleInputChange} options={['CRPF', 'Other']} />
            <Input label="Unit or Formation *" name="unit_or_formation" value={formData.unit_or_formation} onChange={handleInputChange} />
            <Select label="Tender Type *" name="tender_type" value={formData.tender_type} onChange={handleInputChange} options={['Goods', 'Works', 'Services', 'Consultancy']} />
            <Select label="Procurement Mode *" name="procurement_mode" value={formData.procurement_mode} onChange={handleInputChange} options={['Open', 'Limited', 'GeM-backed', 'RateContract', 'Other']} />
            <Input label="Category" name="category" value={formData.category} onChange={handleInputChange} />
            <Input label="Sub Category" name="sub_category" value={formData.sub_category} onChange={handleInputChange} />
            <Input label="Estimated Value Amount *" name="estimated_value_amount" type="number" value={formData.estimated_value_amount} onChange={handleInputChange} />
            <Select label="Currency" name="estimated_value_currency" value={formData.estimated_value_currency} onChange={handleInputChange} options={['INR', 'USD', 'Other']} />
            <Input label="Budget Head" name="budget_head" value={formData.budget_head} onChange={handleInputChange} />
            <Textarea label="Locations" value={formData.locations_json.join('\n')} onChange={(value) => updateField('locations_json', value.split('\n'))} placeholder="One site per line" />
            <Input label="NIT Date" name="nit_date" type="date" value={formData.nit_date} onChange={handleInputChange} />
            <Input label="Bid Submission Start" name="bid_submission_start" type="datetime-local" value={formData.bid_submission_start} onChange={handleInputChange} />
            <Input label="Bid Submission End *" name="bid_submission_end" type="datetime-local" value={formData.bid_submission_end} onChange={handleInputChange} />
            <Input label="Technical Bid Opening" name="technical_bid_opening" type="datetime-local" value={formData.technical_bid_opening} onChange={handleInputChange} />
            <Input label="Financial Bid Opening" name="financial_bid_opening" type="datetime-local" value={formData.financial_bid_opening} onChange={handleInputChange} />
            <Input label="Bid Validity Days" name="bid_validity_days" type="number" value={formData.bid_validity_days} onChange={handleInputChange} />
            <Input label="Contract Start Date" name="contract_start_date" type="date" value={formData.contract_start_date} onChange={handleInputChange} />
            <Input label="Contract End Date" name="contract_end_date" type="date" value={formData.contract_end_date} onChange={handleInputChange} />
            <Textarea label="Delivery Schedule" value={formData.delivery_schedule_text} onChange={(value) => updateField('delivery_schedule_text', value)} />
            <Input label="Contact Officer Name" name="contact_officer_name" value={formData.contact_officer_name} onChange={handleInputChange} />
            <Input label="Contact Officer Designation" name="contact_officer_designation" value={formData.contact_officer_designation} onChange={handleInputChange} />
            <Input label="Contact Email" name="contact_email" type="email" value={formData.contact_email} onChange={handleInputChange} />
            <Input label="Contact Phone" name="contact_phone" value={formData.contact_phone} onChange={handleInputChange} />
          </div>
        </section>
      )}

      {activeTab === 'commercials' && (
        <section className="bg-white border border-gray-200 rounded-md p-5">
          <SectionTitle icon={<Save size={18} />} title="Commercials & Security" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Select label="Number of Covers" name="no_of_covers" value={formData.no_of_covers} onChange={handleInputChange} options={['One', 'Two']} />
            <Select label="Evaluation Method *" name="evaluation_method" value={formData.evaluation_method} onChange={handleInputChange} options={['L1', 'QCBS', 'LCS', 'QualityOnly']} />
            <Select label="Price Basis" name="price_basis" value={formData.price_basis} onChange={handleInputChange} options={['InclusiveTaxes', 'ExclusiveTaxes']} />
            <Checkbox label="EMD Required" name="emd_required" checked={formData.emd_required} onChange={handleInputChange} />
            <Input label="EMD Amount" name="emd_amount" type="number" value={formData.emd_amount} onChange={handleInputChange} disabled={!formData.emd_required} />
            <Input label="Tender Fee Amount" name="tender_fee_amount" type="number" value={formData.tender_fee_amount} onChange={handleInputChange} />
            <Input label="Performance Security Percent" name="performance_security_percent" type="number" value={formData.performance_security_percent} onChange={handleInputChange} />
            <Textarea label="EMD Exemption Rules" value={formData.emd_exemption_rules} onChange={(value) => updateField('emd_exemption_rules', value)} />
          </div>
        </section>
      )}

      {activeTab === 'criteria' && (
        <GridSection
          title="Eligibility Criteria"
          actionLabel="Add Criterion"
          onAdd={() => setCriterionEditor({ index: null, value: defaultCriterion(formData.criteria.length) })}
        >
          <Table
            headers={['Criterion ID', 'Category', 'Title', 'Threshold', 'Evidence', 'Mandatory', 'Weight', 'Actions']}
            empty="No eligibility criteria configured."
          >
            {formData.criteria.map((criterion, index) => (
              <tr key={criterion.criterion_id} className="border-t">
                <Cell>{criterion.criterion_id}</Cell>
                <Cell>{criterion.category}</Cell>
                <Cell>{criterion.title}</Cell>
                <Cell>{criterion.threshold_type} {criterion.threshold_value}</Cell>
                <Cell>{criterion.evidence_type}</Cell>
                <Cell>{criterion.is_mandatory ? 'Yes' : 'No'}</Cell>
                <Cell>{criterion.scoring_weight}</Cell>
                <ActionCell
                  onEdit={() => setCriterionEditor({ index, value: { ...criterion } })}
                  onDelete={() => setFormData((prev) => ({ ...prev, criteria: prev.criteria.filter((_, itemIndex) => itemIndex !== index) }))}
                />
              </tr>
            ))}
          </Table>
        </GridSection>
      )}

      {activeTab === 'documents' && (
        <GridSection
          title="Document Checklist"
          actionLabel="Add Document"
          onAdd={() => setDocumentEditor({ index: null, value: defaultDocument(formData.document_requirements.length) })}
        >
          <Table
            headers={['Requirement ID', 'Name', 'Linked Criteria', 'Upload', 'Formats', 'Checks', 'Mandatory', 'Actions']}
            empty="No document requirements configured."
          >
            {formData.document_requirements.map((document, index) => (
              <tr key={document.document_requirement_id} className="border-t">
                <Cell>{document.document_requirement_id}</Cell>
                <Cell>{document.name}</Cell>
                <Cell>{document.linked_criteria_ids.join(', ') || 'None'}</Cell>
                <Cell>{document.upload_type}</Cell>
                <Cell>{document.allowed_formats}</Cell>
                <Cell>{[document.requires_signature && 'Sign', document.requires_stamp && 'Stamp', document.requires_notarisation && 'Notary'].filter(Boolean).join(', ') || 'None'}</Cell>
                <Cell>{document.is_mandatory ? 'Yes' : 'No'}</Cell>
                <ActionCell
                  onEdit={() => setDocumentEditor({ index, value: { ...document } })}
                  onDelete={() => setFormData((prev) => ({ ...prev, document_requirements: prev.document_requirements.filter((_, itemIndex) => itemIndex !== index) }))}
                />
              </tr>
            ))}
          </Table>
        </GridSection>
      )}

      {activeTab === 'workflow' && (
        <div className="space-y-5">
          <section className="bg-white border border-gray-200 rounded-md p-5">
            <SectionTitle icon={<Eye size={18} />} title="Evaluation Config" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select label="AI Assist Level" value={formData.evaluation_config.ai_assist_level} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateField('evaluation_config', { ...formData.evaluation_config, ai_assist_level: event.target.value })} options={['SuggestOnly', 'PrefillWithConfirmation', 'AutoWithOverride']} />
              <Input label="Ambiguity Confidence Threshold" type="number" value={formData.evaluation_config.ambiguity_confidence_threshold} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField('evaluation_config', { ...formData.evaluation_config, ambiguity_confidence_threshold: Number(event.target.value) })} />
              <Select label="Status" name="status" value={formData.status} onChange={handleInputChange} options={['Draft', 'UnderReview', 'Sanctioned', 'Published', 'Closed', 'Cancelled']} />
              <Checkbox label="Force Manual Review on Conflict" checked={formData.evaluation_config.force_manual_review_on_conflict} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField('evaluation_config', { ...formData.evaluation_config, force_manual_review_on_conflict: event.target.checked })} />
              <Checkbox label="Enable Blacklist Check" checked={formData.evaluation_config.enable_blacklist_check} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField('evaluation_config', { ...formData.evaluation_config, enable_blacklist_check: event.target.checked })} />
              <Checkbox label="Requires Reasoned Order" checked={formData.evaluation_config.requires_reasoned_order} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField('evaluation_config', { ...formData.evaluation_config, requires_reasoned_order: event.target.checked })} />
              <Textarea label="Blacklist Sources" value={formData.evaluation_config.blacklist_sources.join('\n')} onChange={(value) => updateField('evaluation_config', { ...formData.evaluation_config, blacklist_sources: value.split('\n').map((item) => item.trim()).filter(Boolean) })} />
            </div>
          </section>

          <GridSection
            title="Committee Members"
            actionLabel="Add Member"
            onAdd={() => setMemberEditor({ index: null, value: defaultMember(formData.committee_members.length) })}
          >
            <Table headers={['Member ID', 'Officer', 'Designation', 'Role', 'Email', 'Phone', 'Actions']} empty="No committee members configured.">
              {formData.committee_members.map((member, index) => (
                <tr key={member.committee_member_id} className="border-t">
                  <Cell>{member.committee_member_id}</Cell>
                  <Cell>{member.officer_name}</Cell>
                  <Cell>{member.designation}</Cell>
                  <Cell>{member.role}</Cell>
                  <Cell>{member.email}</Cell>
                  <Cell>{member.phone}</Cell>
                  <ActionCell
                    onEdit={() => setMemberEditor({ index, value: { ...member } })}
                    onDelete={() => setFormData((prev) => ({ ...prev, committee_members: prev.committee_members.filter((_, itemIndex) => itemIndex !== index) }))}
                  />
                </tr>
              ))}
            </Table>
          </GridSection>

          <section className="bg-white border border-gray-200 rounded-md p-5">
            <SectionTitle icon={<ClipboardList size={18} />} title="AI Evaluation Payload" />
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(aiPayload, null, 2)}</pre>
          </section>
        </div>
      )}

      {criterionEditor && (
        <Modal title={criterionEditor.index === null ? 'Add Criterion' : 'Edit Criterion'} onClose={() => setCriterionEditor(null)} onSave={saveCriterion}>
          <div className="grid gap-4 md:grid-cols-2">
            <EditorInput label="Criterion ID" value={criterionEditor.value.criterion_id} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, criterion_id: value } })} />
            <EditorSelect label="Category" value={criterionEditor.value.category} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, category: value as any } })} options={['Technical', 'Financial', 'Experience', 'Compliance', 'Legal', 'Other']} />
            <EditorInput label="Title" value={criterionEditor.value.title} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, title: value } })} />
            <EditorSelect label="Threshold Type" value={criterionEditor.value.threshold_type} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, threshold_type: value as any } })} options={['GreaterOrEqual', 'LessOrEqual', 'Equal', 'Range', 'Boolean', 'ListMatch', 'FreeText']} />
            <EditorInput label="Threshold Value" value={criterionEditor.value.threshold_value} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, threshold_value: value } })} />
            <EditorInput label="Threshold Max" value={criterionEditor.value.threshold_value_max} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, threshold_value_max: value } })} />
            <EditorSelect label="Unit" value={criterionEditor.value.unit} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, unit: value as any } })} options={['Years', 'CroreINR', 'LakhsINR', 'ProjectsCount', 'Percentage', 'Date', 'None', 'Other']} />
            <EditorSelect label="Evidence Type" value={criterionEditor.value.evidence_type} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, evidence_type: value as any } })} options={['GSTRegistration', 'PAN', 'MSME', 'ISO', 'OEMAuthorisation', 'ExperienceCertificate', 'AuditedFinancials', 'Affidavit', 'Other']} />
            <EditorSelect label="Expected Format" value={criterionEditor.value.expected_document_format} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, expected_document_format: value as any } })} options={['PDF', 'ScanImage', 'Table', 'Mixed']} />
            <EditorSelect label="Auto Verification Source" value={criterionEditor.value.auto_verification_source} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, auto_verification_source: value as any } })} options={['None', 'GSTN', 'MCA21', 'PANNSDL', 'InternalBlacklistDB', 'Other']} />
            <EditorInput label="Scoring Weight" type="number" value={criterionEditor.value.scoring_weight} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, scoring_weight: Number(value) } })} />
            <EditorSelect label="Applies to Cover" value={criterionEditor.value.applies_to_cover} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, applies_to_cover: value as any } })} options={['Technical', 'Financial', 'Both']} />
            <EditorCheckbox label="Mandatory" checked={criterionEditor.value.is_mandatory} onChange={(checked) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, is_mandatory: checked } })} />
            <EditorTextarea label="Description" value={criterionEditor.value.description} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, description: value } })} />
            <EditorTextarea label="Relaxation Rule" value={criterionEditor.value.relaxation_rule_text} onChange={(value) => setCriterionEditor({ ...criterionEditor, value: { ...criterionEditor.value, relaxation_rule_text: value } })} />
          </div>
        </Modal>
      )}

      {documentEditor && (
        <Modal title={documentEditor.index === null ? 'Add Document Requirement' : 'Edit Document Requirement'} onClose={() => setDocumentEditor(null)} onSave={saveDocument}>
          <div className="grid gap-4 md:grid-cols-2">
            <EditorInput label="Requirement ID" value={documentEditor.value.document_requirement_id} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, document_requirement_id: value } })} />
            <EditorInput label="Name" value={documentEditor.value.name} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, name: value } })} />
            <EditorTextarea label="Description" value={documentEditor.value.description} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, description: value } })} />
            <EditorInput label="Linked Criteria IDs" value={documentEditor.value.linked_criteria_ids.join(',')} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, linked_criteria_ids: value.split(',').map((item) => item.trim()).filter(Boolean) } })} />
            <EditorSelect label="Upload Type" value={documentEditor.value.upload_type} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, upload_type: value as any } })} options={['Single', 'Multiple']} />
            <EditorInput label="Allowed Formats" value={documentEditor.value.allowed_formats} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, allowed_formats: value } })} />
            <EditorInput label="Max File Size MB" type="number" value={documentEditor.value.max_file_size_mb} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, max_file_size_mb: Number(value) } })} />
            <EditorInput label="Template URL" value={documentEditor.value.template_url} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, template_url: value } })} />
            <EditorCheckbox label="Mandatory" checked={documentEditor.value.is_mandatory} onChange={(checked) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, is_mandatory: checked } })} />
            <EditorCheckbox label="Conditional" checked={documentEditor.value.is_conditional} onChange={(checked) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, is_conditional: checked } })} />
            <EditorCheckbox label="Requires Signature" checked={documentEditor.value.requires_signature} onChange={(checked) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, requires_signature: checked } })} />
            <EditorCheckbox label="Requires Stamp" checked={documentEditor.value.requires_stamp} onChange={(checked) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, requires_stamp: checked } })} />
            <EditorCheckbox label="Requires Notarisation" checked={documentEditor.value.requires_notarisation} onChange={(checked) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, requires_notarisation: checked } })} />
            <EditorTextarea label="Condition Text" value={documentEditor.value.condition_text} onChange={(value) => setDocumentEditor({ ...documentEditor, value: { ...documentEditor.value, condition_text: value } })} />
          </div>
        </Modal>
      )}

      {memberEditor && (
        <Modal title={memberEditor.index === null ? 'Add Committee Member' : 'Edit Committee Member'} onClose={() => setMemberEditor(null)} onSave={saveMember}>
          <div className="grid gap-4 md:grid-cols-2">
            <EditorInput label="Member ID" value={memberEditor.value.committee_member_id} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, committee_member_id: value } })} />
            <EditorInput label="Officer Name" value={memberEditor.value.officer_name} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, officer_name: value } })} />
            <EditorInput label="Designation" value={memberEditor.value.designation} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, designation: value } })} />
            <EditorSelect label="Role" value={memberEditor.value.role} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, role: value as any } })} options={['Chair', 'MemberTechnical', 'MemberFinance', 'MemberLegal']} />
            <EditorInput label="Email" value={memberEditor.value.email} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, email: value } })} />
            <EditorInput label="Phone" value={memberEditor.value.phone} onChange={(value) => setMemberEditor({ ...memberEditor, value: { ...memberEditor.value, phone: value } })} />
          </div>
        </Modal>
      )}
    </div>
  );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="mb-4 flex items-center text-gray-900">
    <span className="mr-2 text-primary-700">{icon}</span>
    <h2 className="text-lg font-semibold">{title}</h2>
  </div>
);

const Input = ({ label, ...props }: any) => (
  <label className="block text-sm font-medium text-gray-700">
    {label}
    <input {...props} className="mt-1 input-field disabled:bg-gray-100 disabled:text-gray-500" />
  </label>
);

const Select = ({ label, options, ...props }: any) => (
  <label className="block text-sm font-medium text-gray-700">
    {label}
    <select {...props} className="mt-1 input-field">
      {options.map((option: string) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const Textarea = ({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="block text-sm font-medium text-gray-700 md:col-span-2 xl:col-span-3">
    {label}
    <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="mt-1 input-field" />
  </label>
);

const Checkbox = ({ label, ...props }: any) => (
  <label className="mt-7 flex items-center text-sm font-medium text-gray-700">
    <input {...props} type="checkbox" className="mr-2 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
    {label}
  </label>
);

const GridSection = ({ title, actionLabel, onAdd, children }: { title: string; actionLabel: string; onAdd: () => void; children: React.ReactNode }) => (
  <section className="bg-white border border-gray-200 rounded-md p-5">
    <div className="mb-4 flex items-center justify-between">
      <SectionTitle icon={<ClipboardList size={18} />} title={title} />
      <button type="button" onClick={onAdd} className="btn-primary inline-flex items-center">
        <Plus size={16} className="mr-2" /> {actionLabel}
      </button>
    </div>
    {children}
  </section>
);

const Table = ({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) => {
  const rows = React.Children.count(children);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows > 0 ? children : (
            <tr className="border-t">
              <td colSpan={headers.length} className="px-3 py-8 text-center text-gray-500">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const Cell = ({ children }: { children: React.ReactNode }) => <td className="px-3 py-3 align-top text-gray-700">{children}</td>;

const ActionCell = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <td className="px-3 py-3">
    <div className="flex gap-2">
      <button type="button" onClick={onEdit} className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50" title="Edit">
        <Edit3 size={15} />
      </button>
      <button type="button" onClick={onDelete} className="rounded-md border border-danger-200 p-2 text-danger-700 hover:bg-danger-50" title="Delete">
        <Trash2 size={15} />
      </button>
    </div>
  </td>
);

const Modal = ({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md bg-white shadow-xl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Close">
          <X size={18} />
        </button>
      </div>
      <div className="p-5">{children}</div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-5 py-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="button" onClick={onSave} className="btn-primary">Save</button>
      </div>
    </div>
  </div>
);

const EditorInput = ({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) => (
  <label className="block text-sm font-medium text-gray-700">
    {label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 input-field" />
  </label>
);

const EditorSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="block text-sm font-medium text-gray-700">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 input-field">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const EditorTextarea = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="block text-sm font-medium text-gray-700 md:col-span-2">
    {label}
    <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1 input-field" />
  </label>
);

const EditorCheckbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="mt-7 flex items-center text-sm font-medium text-gray-700">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mr-2 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
    {label}
  </label>
);

export default TenderAdminForm;
