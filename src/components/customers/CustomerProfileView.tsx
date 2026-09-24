import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Copy,
  Check,
  Shield,
  CreditCard,
  User,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  Archive,
  RefreshCw,
  HeartPulse,
  TrendingUp,
  ShieldCheck,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatINR, formatDateIST, openPhoneCall, openWhatsAppChat, copyToClipboard } from '../../lib/utils';
import { User as UserType, Customer, SIP, MedicalInsurance, LifeInsurance, Reminder, CustomerDocument, CustomerNote } from '../../types';

interface CustomerProfileViewProps {
  customerId: string;
  currentUser: UserType;
  onBack: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerId,
  currentUser,
  onBack
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedMobile, setCopiedMobile] = useState<boolean>(false);

  // Active Modals
  const [modalType, setModalType] = useState<
    'NONE' | 'ADD_SIP' | 'ADD_MEDICAL' | 'ADD_LIFE' | 'ADD_FAMILY_MEMBER' | 'UPLOAD_DOC' | 'COMPLETE_REMINDER'
  >('NONE');

  // Selected entities for modals
  const [selectedMedicalId, setSelectedMedicalId] = useState<string>('');
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null);
  const [reminderMethod, setReminderMethod] = useState<'CALL' | 'WHATSAPP'>('CALL');
  const [reminderNote, setReminderNote] = useState<string>('');

  // Form States
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // SIP Form
  const [sipForm, setSipForm] = useState({
    amcName: 'HDFC Mutual Fund',
    schemeName: 'HDFC Top 100 Fund - Growth',
    folioNumber: '',
    sipAmount: '10000',
    frequency: 'Monthly',
    sipDebitDate: '10',
    startDate: '2025-01-10',
    endDate: '',
    notes: ''
  });

  // Medical Form
  const [medForm, setMedForm] = useState({
    companyName: 'Star Health Insurance',
    policyNumber: '',
    policyType: 'Comprehensive Health Cover',
    premiumAmount: '24000',
    coverAmount: '1000000',
    startDate: '2025-06-01',
    renewalDate: '2026-06-01',
    notes: ''
  });

  // Family Member Form
  const [famForm, setFamForm] = useState({
    name: '',
    relation: 'Spouse',
    dob: '1992-05-15',
    gender: 'Female',
    mobile: '',
    isCovered: true
  });

  // Life Form
  const [lifeForm, setLifeForm] = useState({
    companyName: 'Life Insurance Corporation of India (LIC)',
    policyNumber: '',
    policyType: 'Jeevan Labh (Endowment)',
    premiumAmount: '55000',
    coverAmount: '2500000',
    startDate: '2020-03-15',
    renewalDate: '2026-03-15',
    maturityDate: '2040-03-15',
    notes: ''
  });

  // Document Upload Form
  const [docForm, setDocForm] = useState({
    title: '',
    category: 'KYC' as const,
    fileType: 'pdf' as const,
    fileSize: 50000,
    fileData: ''
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/customers/${customerId}`);
      setProfileData(res);
    } catch (err: any) {
      console.error('Failed fetching profile:', err);
      alert(err.message || 'Error loading customer profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [customerId]);

  const handleCopyMobile = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedMobile(true);
      setTimeout(() => setCopiedMobile(false), 2000);
    }
  };

  // Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/customers/${customerId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text: newNoteText })
      });
      setNewNoteText('');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed saving note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add SIP
  const handleAddSip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiRequest(`/customers/${customerId}/sip`, {
        method: 'POST',
        body: JSON.stringify(sipForm)
      });
      setModalType('NONE');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed saving SIP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Medical
  const handleAddMedical = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiRequest(`/customers/${customerId}/medical`, {
        method: 'POST',
        body: JSON.stringify(medForm)
      });
      setModalType('NONE');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed saving Medical policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Family Member
  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicalId) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/medical/${selectedMedicalId}/family-members`, {
        method: 'POST',
        body: JSON.stringify(famForm)
      });
      setModalType('NONE');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed adding family member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Family Member
  const handleDeleteFamilyMember = async (famId: string) => {
    if (!confirm('Remove this family member from the policy?')) return;
    try {
      await apiRequest(`/medical/family-members/${famId}`, { method: 'DELETE' });
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed deleting family member');
    }
  };

  // Add Life
  const handleAddLife = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiRequest(`/customers/${customerId}/life`, {
        method: 'POST',
        body: JSON.stringify(lifeForm)
      });
      setModalType('NONE');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed saving Life Insurance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Document Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
      alert('Only PDF, JPG, JPEG, and PNG files are allowed.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDocForm({
        title: file.name.replace(/\.[^/.]+$/, ''),
        category: docForm.category,
        fileType: ext as any,
        fileSize: file.size,
        fileData: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.fileData) {
      alert('Please choose a valid file first.');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiRequest(`/customers/${customerId}/documents`, {
        method: 'POST',
        body: JSON.stringify(docForm)
      });
      setModalType('NONE');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed uploading document');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Document Download (Strict: Employee Rejected)
  const handleDownloadDoc = async (docId: string) => {
    if (!isAdmin) {
      alert('Access Denied: Employees do not have permission to download customer documents.');
      return;
    }
    try {
      const res = await apiRequest(`/documents/${docId}/download?download=true`);
      if (res.document?.fileData) {
        const a = document.createElement('a');
        a.href = res.document.fileData;
        a.download = `${res.document.title}.${res.document.fileType}`;
        a.click();
      }
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  };

  // Document Delete
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await apiRequest(`/documents/${docId}`, { method: 'DELETE' });
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed deleting document');
    }
  };

  // Complete Reminder
  const handleCompleteReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingReminder) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/reminders/${completingReminder.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          completedMethod: reminderMethod,
          completionNotes: reminderNote
        })
      });
      setModalType('NONE');
      setCompletingReminder(null);
      setReminderNote('');
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed completing reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Customer Archive / Restore
  const handleToggleArchive = async () => {
    if (!profileData?.customer) return;
    const isArchived = profileData.customer.status === 'Archived';
    const action = isArchived ? 'restore' : 'archive';
    if (!confirm(`Are you sure you want to ${action} this customer?`)) return;

    try {
      await apiRequest(`/customers/${customerId}/${action}`, { method: 'POST' });
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} customer`);
    }
  };

  // Permanent Delete (Admin Only)
  const handlePermanentDelete = async () => {
    if (!confirm('CRITICAL: This will permanently delete this customer, all investments, insurance records, documents, and reminders. Continue?')) return;
    try {
      await apiRequest(`/customers/${customerId}/permanent`, { method: 'DELETE' });
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed deleting customer');
    }
  };

  if (loading || !profileData) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading client profile & wealth portfolio...</span>
        </div>
      </div>
    );
  }

  const { customer, sips, medical, life, reminders, documents, notes } = profileData;

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleArchive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{customer.status === 'Archived' ? 'Restore Active Status' : 'Archive Customer'}</span>
            </button>
            <button
              onClick={handlePermanentDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanent Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {customer.profilePhoto ? (
              <img
                src={customer.profilePhoto}
                alt={customer.fullName}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-blue-600 text-white font-bold text-2xl flex items-center justify-center shadow-2xs">
                {customer.fullName.charAt(0)}
              </div>
            )}

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{customer.fullName}</h1>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {customer.customerId}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  customer.status === 'Active'
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border border-amber-200'
                }`}>
                  {customer.status}
                </span>
              </div>

              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><strong>Employee:</strong> {customer.assignedEmployeeName}</span>
                <span>•</span>
                <span><strong>City:</strong> {customer.city}, {customer.state}</span>
                <span>•</span>
                <span><strong>Created:</strong> {formatDateIST(customer.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Contact Buttons */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {/* Call */}
            <button
              onClick={() => openPhoneCall(customer.mobile)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <span>Call (+91 {customer.mobile})</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={() => openWhatsAppChat(customer.mobile, `Hello ${customer.fullName}, contacting you regarding your portfolio with My Investment Manager.`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 shadow-2xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            {/* Copy Number */}
            <button
              onClick={() => handleCopyMobile(customer.mobile)}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
              title="Copy Mobile"
            >
              {copiedMobile ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Profile Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Details & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Personal, KYC & Bank Details */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Client Demographics & Banking Details
                </h2>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {isAdmin ? (
                  <span className="text-emerald-700 font-semibold">Admin View (Unmasked)</span>
                ) : (
                  <span className="text-blue-700 font-semibold">Employee View (Masked KYC)</span>
                )}
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-medium">Date of Birth</div>
                <div className="text-slate-900 font-semibold mt-0.5">{formatDateIST(customer.dob)} ({customer.gender})</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Email Address</div>
                <div className="text-slate-900 font-semibold mt-0.5">{customer.email || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Residential Address</div>
                <div className="text-slate-900 font-semibold mt-0.5">{customer.address}, {customer.city}, {customer.state} - {customer.pincode}</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">PAN Number</div>
                <div className="font-mono text-slate-900 font-bold mt-0.5">{customer.pan}</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Aadhaar Number</div>
                <div className="font-mono text-slate-900 font-bold mt-0.5">{customer.aadhaar}</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Bank & Account Type</div>
                <div className="text-slate-900 font-semibold mt-0.5">{customer.bankName} ({customer.accountType})</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Account Number & IFSC</div>
                <div className="font-mono text-slate-900 font-bold mt-0.5">{customer.accountNumber} • {customer.ifscCode}</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Account Holder</div>
                <div className="text-slate-900 font-semibold mt-0.5">{customer.accountHolderName}</div>
              </div>
            </div>
          </div>

          {/* Card 2: SIP Investments */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  SIP Portfolios ({sips.length})
                </h2>
              </div>
              <button
                onClick={() => setModalType('ADD_SIP')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add SIP</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {sips.map((sip: SIP) => (
                <div key={sip.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{sip.schemeName}</span>
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                        {sip.status}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span><strong>AMC:</strong> {sip.amcName}</span>
                      <span>•</span>
                      <span><strong>Folio:</strong> <code className="font-mono font-bold text-slate-800">{sip.folioNumber}</code></span>
                      <span>•</span>
                      <span><strong>Debit Day:</strong> {sip.sipDebitDate}th of every month</span>
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {formatINR(sip.sipAmount)} <span className="text-[11px] font-normal text-slate-500">/mo</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Started: {formatDateIST(sip.startDate)}
                    </div>
                  </div>
                </div>
              ))}
              {sips.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No SIP mutual fund accounts currently registered for this client.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Medical Health Insurance (With Family Members) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Medical & Health Insurance ({medical.length})
                </h2>
              </div>
              <button
                onClick={() => setModalType('ADD_MEDICAL')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Health Policy</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {medical.map((med: MedicalInsurance) => (
                <div key={med.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{med.companyName}</span>
                        <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
                          {med.status}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span><strong>Policy:</strong> <code className="font-mono font-bold text-slate-800">{med.policyNumber}</code></span>
                        <span>•</span>
                        <span><strong>Plan:</strong> {med.policyType}</span>
                        <span>•</span>
                        <span className="text-blue-700 font-semibold">
                          <strong>Renewal Due:</strong> {formatDateIST(med.renewalDate)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        {formatINR(med.premiumAmount)} <span className="text-[11px] font-normal text-slate-500">premium</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        Sum Insured: {formatINR(med.coverAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Family Members Inside Medical Policy ONLY */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Covered Family Members ({med.familyMembers?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedMedicalId(med.id);
                          setModalType('ADD_FAMILY_MEMBER');
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        + Add Member
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {med.familyMembers?.map(member => (
                        <div key={member.id} className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{member.name}</div>
                            <div className="text-[10px] text-slate-500">{member.relation} • {formatDateIST(member.dob)} ({member.gender})</div>
                          </div>
                          <button
                            onClick={() => handleDeleteFamilyMember(member.id)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {(!med.familyMembers || med.familyMembers.length === 0) && (
                        <div className="text-[11px] text-slate-400 italic">No family members registered under this floater policy.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {medical.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No medical health insurance policies added yet.
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Life Insurance (With Renewal and Maturity Dates) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Life Insurance Policies ({life.length})
                </h2>
              </div>
              <button
                onClick={() => setModalType('ADD_LIFE')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Life Policy</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {life.map((l: LifeInsurance) => (
                <div key={l.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{l.companyName}</span>
                      <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                        {l.status}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span><strong>Policy:</strong> <code className="font-mono font-bold text-slate-800">{l.policyNumber}</code></span>
                      <span>•</span>
                      <span><strong>Plan:</strong> {l.policyType}</span>
                    </div>
                    <div className="mt-1 flex gap-3 text-[11px]">
                      <span className="text-blue-700 font-semibold">
                        Renewal Due: {formatDateIST(l.renewalDate)}
                      </span>
                      <span>•</span>
                      <span className="text-purple-700 font-semibold">
                        Maturity: {formatDateIST(l.maturityDate)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {formatINR(l.premiumAmount)} <span className="text-[11px] font-normal text-slate-500">premium</span>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      Life Cover: {formatINR(l.coverAmount)}
                    </div>
                  </div>
                </div>
              ))}
              {life.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No life insurance policies registered for this client.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Reminders, Documents & Notes */}
        <div className="space-y-6">
          {/* Card 5: Upcoming Scheduled Reminders */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Client Reminders ({reminders.length})
                </h2>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
              {reminders.map((rem: Reminder) => (
                <div key={rem.id} className="p-3.5 hover:bg-slate-50/70 transition-colors text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {rem.productType === 'SIP' ? 'SIP Monthly Debit' : rem.reminderType === 'RENEWAL' ? 'Policy Renewal' : 'Maturity'}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      rem.status === 'Due'
                        ? 'text-red-700 bg-red-50 border border-red-200'
                        : rem.status === 'Completed'
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-slate-600 bg-slate-100'
                    }`}>
                      {rem.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Due Date: {formatDateIST(rem.targetDate)}</span>
                    <span className="text-amber-700 font-medium">{rem.escalationStage}-Day Stage</span>
                  </div>

                  {rem.status !== 'Completed' && (
                    <div className="pt-1 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openPhoneCall(customer.mobile)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                      >
                        Call
                      </button>
                      <button
                        onClick={() => openWhatsAppChat(customer.mobile)}
                        className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                      >
                        WhatsApp
                      </button>
                      <button
                        onClick={() => {
                          setCompletingReminder(rem);
                          setModalType('COMPLETE_REMINDER');
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                      >
                        Complete
                      </button>
                    </div>
                  )}

                  {rem.status === 'Completed' && rem.completionNotes && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50/60 p-1.5 rounded">
                      ✓ {rem.completedMethod}: {rem.completionNotes}
                    </div>
                  )}
                </div>
              ))}
              {reminders.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No reminders scheduled for this customer.
                </div>
              )}
            </div>
          </div>

          {/* Card 6: Customer Documents (Strict Permissions) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Documents ({documents.length})
                </h2>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setModalType('UPLOAD_DOC')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload (Admin)</span>
                </button>
              )}
            </div>

            <div className="p-3 space-y-2">
              {!isAdmin && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500">
                  🔒 View-only mode for employees. Customer documents cannot be downloaded or deleted.
                </div>
              )}

              {documents.map((doc: CustomerDocument) => (
                <div key={doc.id} className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-50/50">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {doc.category} • {doc.fileType.toUpperCase()} • v{doc.version}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => handleDownloadDoc(doc.id)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400">View Only</span>
                    )}
                  </div>
                </div>
              ))}

              {documents.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No documents stored.
                </div>
              )}
            </div>
          </div>

          {/* Card 7: Internal Private Notes */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Internal Confidential Notes
              </h2>
              <p className="text-[11px] text-slate-400">Private internal follow-up trail for employees.</p>
            </div>

            <div className="p-4 space-y-3">
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  required
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder="Record customer discussion or meeting note..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newNoteText.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                {notes.map((n: CustomerNote) => (
                  <div key={n.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {n.authorName} ({n.authorRole})
                      </span>
                      <span>{formatDateIST(n.createdAt)}</span>
                    </div>
                    <div className="text-slate-700 whitespace-pre-line bg-slate-50 p-2 rounded border border-slate-200/60">
                      {n.text}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400">
                    No follow-up notes recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD SIP */}
      {modalType === 'ADD_SIP' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Systematic Investment Plan (SIP)</h3>
            <form onSubmit={handleAddSip} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">AMC Name *</label>
                <input
                  type="text"
                  required
                  value={sipForm.amcName}
                  onChange={e => setSipForm({ ...sipForm, amcName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="HDFC Mutual Fund"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Scheme Name *</label>
                <input
                  type="text"
                  required
                  value={sipForm.schemeName}
                  onChange={e => setSipForm({ ...sipForm, schemeName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="HDFC Top 100 Fund"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Folio Number *</label>
                  <input
                    type="text"
                    required
                    value={sipForm.folioNumber}
                    onChange={e => setSipForm({ ...sipForm, folioNumber: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="1002345678"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">SIP Monthly Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    value={sipForm.sipAmount}
                    onChange={e => setSipForm({ ...sipForm, sipAmount: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="15000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">SIP Debit Day (1 - 31) *</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={sipForm.sipDebitDate}
                    onChange={e => setSipForm({ ...sipForm, sipDebitDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={sipForm.startDate}
                    onChange={e => setSipForm({ ...sipForm, startDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save SIP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD MEDICAL INSURANCE */}
      {modalType === 'ADD_MEDICAL' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Health / Medical Insurance</h3>
            <form onSubmit={handleAddMedical} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Insurance Company Name *</label>
                <input
                  type="text"
                  required
                  value={medForm.companyName}
                  onChange={e => setMedForm({ ...medForm, companyName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Star Health / Care Health"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Policy Number *</label>
                  <input
                    type="text"
                    required
                    value={medForm.policyNumber}
                    onChange={e => setMedForm({ ...medForm, policyNumber: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="SH-POL-9921"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Plan Type *</label>
                  <input
                    type="text"
                    required
                    value={medForm.policyType}
                    onChange={e => setMedForm({ ...medForm, policyType: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="Comprehensive Floater"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Annual Premium (INR) *</label>
                  <input
                    type="number"
                    required
                    value={medForm.premiumAmount}
                    onChange={e => setMedForm({ ...medForm, premiumAmount: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="24000"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Sum Insured (Cover) *</label>
                  <input
                    type="number"
                    required
                    value={medForm.coverAmount}
                    onChange={e => setMedForm({ ...medForm, coverAmount: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="1000000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Policy Start Date *</label>
                  <input
                    type="date"
                    required
                    value={medForm.startDate}
                    onChange={e => setMedForm({ ...medForm, startDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Renewal Due Date *</label>
                  <input
                    type="date"
                    required
                    value={medForm.renewalDate}
                    onChange={e => setMedForm({ ...medForm, renewalDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save Health Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD FAMILY MEMBER TO MEDICAL POLICY */}
      {modalType === 'ADD_FAMILY_MEMBER' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Add Covered Family Member</h3>
            <p className="text-xs text-slate-500 mb-3">Family members are tracked strictly under Medical Insurance floater covers.</p>
            <form onSubmit={handleAddFamilyMember} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={famForm.name}
                  onChange={e => setFamForm({ ...famForm, name: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Sunita Sharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Relationship *</label>
                  <select
                    value={famForm.relation}
                    onChange={e => setFamForm({ ...famForm, relation: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Self">Self</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={famForm.dob}
                    onChange={e => setFamForm({ ...famForm, dob: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Adding...' : 'Add to Floater'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD LIFE INSURANCE */}
      {modalType === 'ADD_LIFE' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Life Insurance Policy</h3>
            <form onSubmit={handleAddLife} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Insurance Company Name *</label>
                <input
                  type="text"
                  required
                  value={lifeForm.companyName}
                  onChange={e => setLifeForm({ ...lifeForm, companyName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="LIC / HDFC Life / ICICI Prudential"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Policy Number *</label>
                  <input
                    type="text"
                    required
                    value={lifeForm.policyNumber}
                    onChange={e => setLifeForm({ ...lifeForm, policyNumber: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="LIC-8821990"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Plan Type *</label>
                  <input
                    type="text"
                    required
                    value={lifeForm.policyType}
                    onChange={e => setLifeForm({ ...lifeForm, policyType: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="Endowment / Term Plan"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Annual Premium (INR) *</label>
                  <input
                    type="number"
                    required
                    value={lifeForm.premiumAmount}
                    onChange={e => setLifeForm({ ...lifeForm, premiumAmount: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Cover Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    value={lifeForm.coverAmount}
                    onChange={e => setLifeForm({ ...lifeForm, coverAmount: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="2500000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={lifeForm.startDate}
                    onChange={e => setLifeForm({ ...lifeForm, startDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Renewal Date *</label>
                  <input
                    type="date"
                    required
                    value={lifeForm.renewalDate}
                    onChange={e => setLifeForm({ ...lifeForm, renewalDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Maturity Date *</label>
                  <input
                    type="date"
                    required
                    value={lifeForm.maturityDate}
                    onChange={e => setLifeForm({ ...lifeForm, maturityDate: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save Life Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: UPLOAD DOCUMENT (ADMIN ONLY) */}
      {modalType === 'UPLOAD_DOC' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Upload Customer Document</h3>
            <p className="text-xs text-slate-500 mb-3">Allowed file formats: PDF, JPG, JPEG, PNG (Max 15MB).</p>
            <form onSubmit={handleSubmitDoc} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Document Category *</label>
                <select
                  value={docForm.category}
                  onChange={e => setDocForm({ ...docForm, category: e.target.value as any })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="KYC">KYC (PAN / Aadhaar / Passport)</option>
                  <option value="SIP Documents">SIP Form / Mandate</option>
                  <option value="Medical Insurance">Health Policy Document</option>
                  <option value="Life Insurance">Life Policy Bond</option>
                  <option value="Other">Other Investment Receipt</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Document Title *</label>
                <input
                  type="text"
                  required
                  value={docForm.title}
                  onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="E.g. Aadhaar Card Front & Back"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Select File *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !docForm.fileData}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: COMPLETE REMINDER */}
      {modalType === 'COMPLETE_REMINDER' && completingReminder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Confirm Completed Reminder</h3>
            <p className="text-xs text-slate-500 mb-3">
              Completing this reminder suppresses subsequent 5-day and 2-day reminder escalations for this cycle.
            </p>
            <form onSubmit={handleCompleteReminder} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Method Used *</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setReminderMethod('CALL')}
                    className={`p-2 rounded-lg border text-center font-semibold ${
                      reminderMethod === 'CALL'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    📞 Phone Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderMethod('WHATSAPP')}
                    className={`p-2 rounded-lg border text-center font-semibold ${
                      reminderMethod === 'WHATSAPP'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    💬 WhatsApp Message
                  </button>
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Follow-up Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={reminderNote}
                  onChange={e => setReminderNote(e.target.value)}
                  placeholder="Customer confirmed renewal payment on netbanking..."
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType('NONE')}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reminderNote.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
