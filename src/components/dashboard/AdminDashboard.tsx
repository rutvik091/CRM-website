import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  TrendingUp,
  Shield,
  HeartPulse,
  BellRing,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiRequest } from '../../lib/api';

interface AdminDashboardProps {
  onSelectEmployee: (empId: string) => void;
  onOpenReminders: () => void;
  onOpenCustomers: () => void;
}

const BLUE_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectEmployee,
  onOpenReminders,
  onOpenCustomers
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingReminders, setSyncingReminders] = useState<boolean>(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/dashboard');
      setData(res);
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSyncReminders = async () => {
    try {
      setSyncingReminders(true);
      await apiRequest('/reminders/trigger-engine', { method: 'POST' });
      await fetchDashboard();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncingReminders(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading firm management metrics...</span>
        </div>
      </div>
    );
  }

  const { stats, employeeBreakdown, charts } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Firm Overview & Portfolio Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time portfolio management, employee allocations, and 10/5/2 automated client reminder escalations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncReminders}
            disabled={syncingReminders}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingReminders ? 'animate-spin' : ''}`} />
            <span>{syncingReminders ? 'Running Engine...' : 'Run Reminder Engine Now'}</span>
          </button>
        </div>
      </div>

      {/* 7 Core Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* Total Customers */}
        <div
          onClick={onOpenCustomers}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Customers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total Active Clients</div>
        </div>

        {/* Total Employees */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Employees</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalEmployees}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active Team Members</div>
        </div>

        {/* SIP Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">SIP Clients</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.sipCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active MF Portfolios</div>
        </div>

        {/* Medical Insurance Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Health</span>
            <HeartPulse className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.medicalInsuranceCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Medical Policies</div>
        </div>

        {/* Life Insurance Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Life</span>
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.lifeInsuranceCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Life Policies</div>
        </div>

        {/* Upcoming Reminders */}
        <div
          onClick={onOpenReminders}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Upcoming</span>
            <BellRing className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.upcomingReminders}</div>
          <div className="text-[11px] text-slate-500 mt-1">Scheduled Reminders</div>
        </div>

        {/* Pending Reminders */}
        <div
          onClick={onOpenReminders}
          className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-blue-900 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Due / Action</span>
            <AlertCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.pendingReminders}</div>
          <div className="text-[11px] text-blue-700 mt-1">Pending Follow-ups</div>
        </div>
      </div>

      {/* Employee-wise Portfolio & Pending Reminders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Employee-wise Client Distribution & Pending Reminders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click an employee to view their assigned customers and reminders.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Employee Name</th>
                <th className="px-6 py-3">Mobile Contact</th>
                <th className="px-6 py-3">Assigned Customers</th>
                <th className="px-6 py-3">Pending Reminders</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employeeBreakdown.map((emp: any) => (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center">
                      {emp.name.charAt(0)}
                    </div>
                    <span>{emp.name}</span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">
                    +91 {emp.mobile}
                  </td>
                  <td className="px-6 py-3.5 text-slate-700 font-medium">
                    {emp.customersCount} clients
                  </td>
                  <td className="px-6 py-3.5">
                    {emp.pendingReminders > 0 ? (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                        {emp.pendingReminders} pending
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">All clear</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                      <span>View Clients</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
              {employeeBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">
                    No active employees configured. Use the Employees tab to register team members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Visual Charts (Strictly Admin only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Product Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Product Portfolio Volume</h3>
              <p className="text-xs text-slate-500">Active accounts across wealth & insurance categories</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.productDistribution} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Upcoming Reminders by Category */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Upcoming Portfolio Reminders</h3>
              <p className="text-xs text-slate-500">Auto-scheduled renewals, maturities & SIP debit reminders</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={charts.upcomingOverviews}
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="category" type="category" width={140} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
