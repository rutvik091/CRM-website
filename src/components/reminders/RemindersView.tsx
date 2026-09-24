import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Phone,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  HeartPulse,
  Clock
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatDateIST, openPhoneCall, openWhatsAppChat } from '../../lib/utils';
import { Reminder, User } from '../../types';

interface RemindersViewProps {
  currentUser: User;
  onSelectCustomer: (customerId: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  currentUser,
  onSelectCustomer
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('Due');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Complete modal
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null);
  const [completionMethod, setCompletionMethod] = useState<'CALL' | 'WHATSAPP'>('CALL');
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (productFilter !== 'ALL') params.append('productType', productFilter);

      const res = await apiRequest(`/reminders?${params.toString()}`);
      setReminders(res.reminders);
    } catch (err) {
      console.error('Failed fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [statusFilter, productFilter]);

  const handleSyncEngine = async () => {
    try {
      setIsSyncing(true);
      await apiRequest('/reminders/trigger-engine', { method: 'POST' });
      await fetchReminders();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingReminder) return;

    try {
      setIsSubmitting(true);
      await apiRequest(`/reminders/${completingReminder.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          completedMethod: completionMethod,
          completionNotes
        })
      });
      setCompletingReminder(null);
      setCompletionNotes('');
      await fetchReminders();
    } catch (err: any) {
      alert(err.message || 'Failed completing reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Client Follow-Up & Reminder Desk
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated 10/5/2-day advance notice alerts for SIP debits, health renewals, and life policy maturities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleSyncEngine}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Running Engine...' : 'Run Engine Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {[
              { id: 'Due', label: 'Due / Action Required' },
              { id: 'Upcoming', label: 'Upcoming (Pipeline)' },
              { id: 'Completed', label: 'Completed' },
              { id: 'ALL', label: 'All Reminders' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Product Type Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="w-full sm:w-56 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Product Categories</option>
              <option value="SIP">SIP Monthly Debits</option>
              <option value="MEDICAL_INSURANCE">Health Renewals</option>
              <option value="LIFE_INSURANCE">Life Renewals & Maturities</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {reminders.map((rem: Reminder) => {
            const isDue = rem.status === 'Due';
            const isCompleted = rem.status === 'Completed';

            return (
              <div
                key={rem.id}
                className={`p-4 sm:p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDue ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Category Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    rem.productType === 'SIP'
                      ? 'bg-emerald-100 text-emerald-700'
                      : rem.productType === 'MEDICAL_INSURANCE'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {rem.productType === 'SIP' ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : rem.productType === 'MEDICAL_INSURANCE' ? (
                      <HeartPulse className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onSelectCustomer(rem.customerId)}
                        className="text-sm font-bold text-slate-900 hover:text-blue-600 text-left"
                      >
                        {rem.customerName}
                      </button>
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {rem.customerIdString}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        rem.escalationStage === 10
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : rem.escalationStage === 5
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {rem.escalationStage}-Day Notice
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isDue
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : isCompleted
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {rem.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        <strong>Action:</strong> {rem.reminderType === 'SIP_DEBIT' ? 'Monthly SIP Debit' : rem.reminderType === 'RENEWAL' ? 'Insurance Renewal' : 'Policy Maturity'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Entity:</strong> {rem.companyName} {rem.policyOrFolio && `[${rem.policyOrFolio}]`}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Due Date:</strong> {formatDateIST(rem.targetDate)}
                      </span>
                    </div>

                    {isCompleted && (
                      <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200/60 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Completed via {rem.completedMethod}: {rem.completionNotes || 'Client confirmed.'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => openPhoneCall(rem.customerMobile || '')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600"
                    title="Call Client"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Call</span>
                  </button>

                  <button
                    onClick={() => openWhatsAppChat(rem.customerMobile || '')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                    title="WhatsApp Client"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => onSelectCustomer(rem.customerId)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
                    title="View Customer CRM Record"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {!isCompleted && (
                    <button
                      onClick={() => {
                        setCompletingReminder(rem);
                        setCompletionMethod('CALL');
                        setCompletionNotes('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {reminders.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400">
              No reminders currently match the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Complete Reminder Modal */}
      {completingReminder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Mark Reminder Completed
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Recording completion stops future reminders for this cycle.
            </p>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div><strong>Client:</strong> {completingReminder.customerName}</div>
                <div><strong>Mobile:</strong> +91 {completingReminder.customerMobile}</div>
                <div><strong>Action Due:</strong> {formatDateIST(completingReminder.targetDate)}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Method Used *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletionMethod('CALL')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center ${
                      completionMethod === 'CALL'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    📞 Phone Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionMethod('WHATSAPP')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center ${
                      completionMethod === 'WHATSAPP'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    💬 WhatsApp Message
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client Discussion Notes / Resolution Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  placeholder="E.g., Customer confirmed successful premium payment."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingReminder(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !completionNotes.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm & Stop Future Reminders'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
