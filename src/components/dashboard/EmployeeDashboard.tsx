import React, { useState, useEffect } from 'react';
import {
  Users,
  BellRing,
  CalendarCheck,
  PhoneCall,
  MessageSquare,
  FileText,
  Search,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { openPhoneCall, openWhatsAppChat, formatDateIST } from '../../lib/utils';
import { Reminder, Customer } from '../../types';

interface EmployeeDashboardProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenReminders: () => void;
  onOpenCustomers: () => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  onSelectCustomer,
  onOpenReminders,
  onOpenCustomers
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Complete Reminder Modal State
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null);
  const [completionMethod, setCompletionMethod] = useState<'CALL' | 'WHATSAPP'>('CALL');
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/dashboard');
      setData(res);
    } catch (err) {
      console.error('Error fetching employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCompleteReminderSubmit = async (e: React.FormEvent) => {
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
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed completing reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading your assigned portfolio...</span>
        </div>
      </div>
    );
  }

  const { stats, todaysReminders, recentCustomers } = data;

  const filteredRecentCustomers = searchQuery.trim()
    ? recentCustomers.filter((c: Customer) =>
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.mobile.includes(searchQuery) ||
        c.customerId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentCustomers;

  return (
    <div className="space-y-6">
      {/* Employee Welcome & Quick Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Employee Daily Action Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Focus on today's client renewals, maturities, and monthly SIP check-ins.
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search my clients by name, mobile, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>
      </div>

      {/* 4 Core Employee Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: My Customers */}
        <div
          onClick={onOpenCustomers}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-blue-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">My Clients</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.myCustomersCount}</div>
          <div className="text-xs text-slate-500 mt-1">Assigned Client Portfolios</div>
        </div>

        {/* Card 2: Today's Reminders */}
        <div
          onClick={onOpenReminders}
          className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 shadow-2xs hover:border-blue-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-blue-900 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Due Today</span>
            <BellRing className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-700">{stats.todaysRemindersCount}</div>
          <div className="text-xs text-blue-700 mt-1">Requires Customer Contact</div>
        </div>

        {/* Card 3: Upcoming Reminders */}
        <div
          onClick={onOpenReminders}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-blue-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Upcoming (10-Day)</span>
            <CalendarCheck className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.upcomingRemindersCount}</div>
          <div className="text-xs text-slate-500 mt-1">Scheduled in Pipeline</div>
        </div>

        {/* Card 4: Pending Follow-ups */}
        <div
          onClick={onOpenReminders}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-blue-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Pending Actions</span>
            <CheckCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.pendingFollowupsCount}</div>
          <div className="text-xs text-slate-500 mt-1">Unresolved Reminders</div>
        </div>
      </div>

      {/* Today's Reminders List with Quick Actions (Call, WhatsApp, Note, Complete) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Today's Actionable Client Reminders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Contact customer via Call or WhatsApp, then click "Complete" to suppress subsequent 5/2-day escalations.
            </p>
          </div>
          <button
            onClick={onOpenReminders}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View All ({stats.todaysRemindersCount})
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {todaysReminders.map((rem: any) => (
            <div key={rem.id} className="p-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  {rem.productType === 'SIP' ? 'SIP' : rem.productType === 'MEDICAL_INSURANCE' ? 'MED' : 'LIFE'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectCustomer(rem.customerId)}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-600 truncate text-left"
                    >
                      {rem.customerName}
                    </button>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {rem.customerIdString}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {rem.escalationStage}-Day Notice
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <strong>Action:</strong> {rem.reminderType === 'SIP_DEBIT' ? 'SIP Monthly Debit' : rem.reminderType === 'RENEWAL' ? 'Insurance Renewal' : 'Policy Maturity'}
                    </span>
                    <span>•</span>
                    <span><strong>Due:</strong> {formatDateIST(rem.targetDate)}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-600">Mobile: +91 {rem.customerMobile}</span>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {/* 1. Call */}
                <button
                  type="button"
                  onClick={() => openPhoneCall(rem.customerMobile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs"
                  title="Call Customer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                  <span>Call</span>
                </button>

                {/* 2. WhatsApp */}
                <button
                  type="button"
                  onClick={() => openWhatsAppChat(rem.customerMobile, `Hello ${rem.customerName}, contacting you from My Investment Manager regarding your upcoming portfolio action.`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                  title="WhatsApp Customer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                {/* 3. Open Profile */}
                <button
                  type="button"
                  onClick={() => onSelectCustomer(rem.customerId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
                  title="Open Customer Profile"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                {/* 4. Complete Action */}
                <button
                  type="button"
                  onClick={() => {
                    setCompletingReminder(rem);
                    setCompletionMethod('CALL');
                    setCompletionNotes('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Complete</span>
                </button>
              </div>
            </div>
          ))}

          {todaysReminders.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No reminders due today. All client accounts are currently up to date.
            </div>
          )}
        </div>
      </div>

      {/* Recent Assigned Clients Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            My Assigned Clients ({filteredRecentCustomers.length})
          </h2>
          <button
            onClick={onOpenCustomers}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View Full Customer Directory
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Client ID</th>
                <th className="px-6 py-3">Customer Name</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">City / State</th>
                <th className="px-6 py-3">Masked PAN / Aadhaar</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecentCustomers.map((cust: Customer) => (
                <tr
                  key={cust.id}
                  onClick={() => onSelectCustomer(cust.id)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 font-mono text-xs font-semibold text-blue-600">
                    {cust.customerId}
                  </td>
                  <td className="px-6 py-3.5 font-medium text-slate-900">
                    {cust.fullName}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-600 font-mono">
                    +91 {cust.mobile}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-500">
                    {cust.city}, {cust.state}
                  </td>
                  <td className="px-6 py-3.5 text-xs font-mono text-slate-500">
                    {cust.pan}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="text-xs font-medium text-blue-600 hover:underline">
                      Open Profile
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              Recording completion confirms client engagement and stops future automated notifications for this reminder cycle.
            </p>

            <form onSubmit={handleCompleteReminderSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div><strong>Client:</strong> {completingReminder.customerName}</div>
                <div><strong>Mobile:</strong> +91 {completingReminder.customerMobile}</div>
                <div><strong>Notice:</strong> {completingReminder.escalationStage}-Day Advance Notice</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Method Used (Required)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCompletionMethod('CALL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                      completionMethod === 'CALL'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📞 Phone Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionMethod('WHATSAPP')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                      completionMethod === 'WHATSAPP'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    💬 WhatsApp Message
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Follow-up Notes / Confirmation Summary
                </label>
                <textarea
                  required
                  rows={3}
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  placeholder="E.g., Customer confirmed bank account has sufficient balance for upcoming SIP debit."
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
