import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  HeartPulse,
  ShieldCheck,
  Users,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatINR, formatDateIST } from '../../lib/utils';

export const ReportsView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/reports/data');
      setData(res);
    } catch (err) {
      console.error('Failed fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('mim_auth_token');
      const res = await fetch(`/api/reports/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIM_Business_Report_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Aggregating portfolio intelligence & management reports...</span>
        </div>
      </div>
    );
  }

  const { totals, employeeBreakdown, sipSummary, medicalSummary, lifeSummary, upcomingRenewals, upcomingMaturities } = data;

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Portfolio & Business Intelligence Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time calculations for firm AUM volume, health premiums, life covers, and employee reminder pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-800 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4 text-red-600" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Summary Volume Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* SIP Monthly Commitment */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Monthly SIP Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {formatINR(totals.totalSipMonthlyAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{totals.activeSips} Active Portfolios</div>
        </div>

        {/* Health Annual Premium */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Health Annual Premium</span>
            <HeartPulse className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {formatINR(totals.totalMedicalPremium)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{totals.activeMedicalPolicies} Active Policies</div>
        </div>

        {/* Life Annual Premium */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Life Annual Premium</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {formatINR(totals.totalLifePremium)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{totals.activeLifePolicies} Active Policies</div>
        </div>

        {/* Reminders Completion Ratio */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Reminder Resolution</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {totals.completedReminders} <span className="text-sm font-normal text-slate-400">resolved</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">{totals.pendingReminders} Currently Pending</div>
        </div>
      </div>

      {/* Employee Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">
            Employee Portfolio Allocation & Operational Load
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Employee Name</th>
                <th className="px-6 py-3">Assigned Clients</th>
                <th className="px-6 py-3">Active SIPs</th>
                <th className="px-6 py-3">Health Policies</th>
                <th className="px-6 py-3">Life Policies</th>
                <th className="px-6 py-3">Pending Follow-ups</th>
                <th className="px-6 py-3">Completed Reminders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employeeBreakdown.map((emp: any) => (
                <tr key={emp.employeeId} className="hover:bg-slate-50/60">
                  <td className="px-6 py-3.5 font-semibold text-slate-900">
                    {emp.employeeName}
                  </td>
                  <td className="px-6 py-3.5 text-slate-700 font-medium">{emp.customerCount}</td>
                  <td className="px-6 py-3.5 text-slate-700">{emp.activeSipCount}</td>
                  <td className="px-6 py-3.5 text-slate-700">{emp.activeMedCount}</td>
                  <td className="px-6 py-3.5 text-slate-700">{emp.activeLifeCount}</td>
                  <td className="px-6 py-3.5">
                    {emp.pendingReminders > 0 ? (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {emp.pendingReminders} due
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-emerald-700 font-semibold">{emp.completedReminders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Renewals and Maturities Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Renewals */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Upcoming Insurance Renewals</h3>
            <p className="text-xs text-slate-500">Upcoming health and life renewals ordered by due date</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
            {upcomingRenewals.map((r: any, idx: number) => (
              <div key={idx} className="p-3.5 text-xs flex items-center justify-between hover:bg-slate-50/50">
                <div>
                  <div className="font-semibold text-slate-900">{r.customerName}</div>
                  <div className="text-[11px] text-slate-500">
                    {r.type} • {r.company} [{r.policyOrFolio}]
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-700">{formatDateIST(r.dueDate)}</div>
                  <div className="text-[11px] text-slate-600 font-mono">{formatINR(r.premiumAmount)}</div>
                </div>
              </div>
            ))}
            {upcomingRenewals.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">No upcoming renewals found.</div>
            )}
          </div>
        </div>

        {/* Maturities */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Upcoming Life Maturities</h3>
            <p className="text-xs text-slate-500">Scheduled maturity payouts for life policies</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
            {upcomingMaturities.map((m: any, idx: number) => (
              <div key={idx} className="p-3.5 text-xs flex items-center justify-between hover:bg-slate-50/50">
                <div>
                  <div className="font-semibold text-slate-900">{m.customerName}</div>
                  <div className="text-[11px] text-slate-500">
                    {m.company} [{m.policyNumber}]
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-purple-700">{formatDateIST(m.maturityDate)}</div>
                  <div className="text-[11px] text-emerald-700 font-semibold font-mono">Cover: {formatINR(m.coverAmount)}</div>
                </div>
              </div>
            ))}
            {upcomingMaturities.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">No upcoming policy maturities found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
