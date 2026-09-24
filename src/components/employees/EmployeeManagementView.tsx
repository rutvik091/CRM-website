import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Edit2,
  Copy,
  Check,
  RefreshCw,
  Users,
  Shield,
  KeyRound,
  ArrowRightLeft,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { copyToClipboard, formatDateIST } from '../../lib/utils';
import { EmployeeSummary } from '../../types';

export const EmployeeManagementView: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Registration Code state
  const [activeCode, setActiveCode] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [reassigningEmployee, setReassigningEmployee] = useState<any>(null);
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Add Form
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    designation: 'Senior Wealth Consultant',
    joiningDate: new Date().toISOString().slice(0, 10)
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/employees');
      setEmployees(res.employees);
    } catch (err) {
      console.error('Failed fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveCode = async () => {
    try {
      const res = await apiRequest('/employees/registration-code');
      setActiveCode(res.registrationCode?.code || res.code || '');
    } catch (err) {
      console.error('Failed fetching registration code:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchActiveCode();
  }, []);

  const handleGenerateNewCode = async () => {
    try {
      setIsGeneratingCode(true);
      const res = await apiRequest('/employees/registration-code/generate', { method: 'POST' });
      setActiveCode(res.registrationCode?.code || res.code || '');
    } catch (err: any) {
      alert(err.message || 'Failed generating code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = async (codeStr: string) => {
    const ok = await copyToClipboard(codeStr);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiRequest('/employees', {
        method: 'POST',
        body: JSON.stringify(addForm)
      });
      setIsAddModalOpen(false);
      setAddForm({
        fullName: '',
        email: '',
        mobile: '',
        password: '',
        designation: 'Senior Wealth Consultant',
        joiningDate: new Date().toISOString().slice(0, 10)
      });
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed adding employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/employees/${editingEmployee.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingEmployee)
      });
      setEditingEmployee(null);
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed updating employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningEmployee || !targetEmployeeId) return;
    try {
      setIsSubmitting(true);
      const res = await apiRequest('/employees/reassign-customers', {
        method: 'POST',
        body: JSON.stringify({ sourceEmployeeId: reassigningEmployee.id, targetEmployeeId })
      });
      alert(`Successfully reassigned ${res.reassignedCount} clients.`);
      setReassigningEmployee(null);
      setTargetEmployeeId('');
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed reassigning clients');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Employee Team Directory & Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage firm employees, customer assignments, and registration codes.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Active One-Time Registration Code Panel */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>Active Employee Registration Code</span>
          </div>
          <p className="text-xs text-blue-100 mt-1 max-w-xl">
            Give this code to a new employee. It is strictly single-use and invalidates immediately once used to register.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2.5 rounded-lg flex items-center gap-3">
            <span className="font-mono text-lg font-bold tracking-widest text-white">
              {activeCode?.code || 'LOADING...'}
            </span>
            <button
              onClick={() => handleCopyCode(activeCode?.code || '')}
              className="p-1.5 hover:bg-white/20 rounded text-blue-200 hover:text-white"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleGenerateNewCode}
            disabled={isGeneratingCode}
            className="px-3.5 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
          >
            {isGeneratingCode ? 'Regenerating...' : 'Regenerate Code'}
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Employee ID</th>
                <th className="px-6 py-3">Employee Name</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Designation</th>
                <th className="px-6 py-3">Assigned Clients</th>
                <th className="px-6 py-3">Due Reminders</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3.5 font-mono text-xs font-bold text-blue-600">
                    {emp.employeeId}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">
                    {emp.fullName}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-600">
                    <div>+91 {emp.mobile}</div>
                    <div className="text-[11px] text-slate-400">{emp.email}</div>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-700">
                    {emp.designation}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 text-xs">
                    {emp.assignedCustomersCount} clients
                  </td>
                  <td className="px-6 py-3.5">
                    {emp.pendingRemindersCount > 0 ? (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {emp.pendingRemindersCount} pending
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">All clear</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      emp.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setReassigningEmployee(emp);
                          setTargetEmployeeId(employees.find(e => e.id !== emp.id)?.id || '');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50"
                        title="Reassign all clients to another employee"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Reassign</span>
                      </button>
                      <button
                        onClick={() => setEditingEmployee(emp)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 rounded border border-slate-200 hover:bg-slate-50"
                        title="Edit Employee"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-xs text-slate-400">
                    No employees found. Add your first team member above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Team Member</h3>
            <p className="text-xs text-slate-500 mb-4">Sequential Employee ID (EMP-XXX) will be assigned.</p>
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.fullName}
                  onChange={e => setAddForm({ ...addForm, fullName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Kavita Mehta"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="kavita@myinvestmentmanager.com"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Mobile Number (10 Digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={addForm.mobile}
                  onChange={e => setAddForm({ ...addForm, mobile: e.target.value.replace(/\D/g, '') })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="9823456789"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={addForm.password}
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Designation</label>
                <input
                  type="text"
                  value={addForm.designation}
                  onChange={e => setAddForm({ ...addForm, designation: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Senior Wealth Consultant"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  {isSubmitting ? 'Adding...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Edit Employee Profile</h3>
            <p className="text-xs text-slate-500 mb-4">{editingEmployee.fullName} ({editingEmployee.employeeId})</p>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={editingEmployee.fullName}
                  onChange={e => setEditingEmployee({ ...editingEmployee, fullName: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={editingEmployee.email}
                  onChange={e => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editingEmployee.mobile}
                  onChange={e => setEditingEmployee({ ...editingEmployee, mobile: e.target.value.replace(/\D/g, '') })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Designation</label>
                <input
                  type="text"
                  value={editingEmployee.designation}
                  onChange={e => setEditingEmployee({ ...editingEmployee, designation: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Account Status</label>
                <select
                  value={editingEmployee.status}
                  onChange={e => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE (Disabled)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Reset Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={editingEmployee.password || ''}
                  onChange={e => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="New password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Clients Modal */}
      {reassigningEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reassign Customers</h3>
            <p className="text-xs text-slate-500 mb-4">
              Move all {reassigningEmployee.assignedCustomersCount} customers assigned to {reassigningEmployee.fullName} to another employee.
            </p>
            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Select Target Employee *</label>
                <select
                  required
                  value={targetEmployeeId}
                  onChange={e => setTargetEmployeeId(e.target.value)}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Select Target Employee</option>
                  {employees.filter(e => e.id !== reassigningEmployee.id).map(e => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeId}) - Current: {e.assignedCustomersCount} clients
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed">
                As per system confidentiality rules, customer reassignments update database ownership directly without polluting customer activity logs.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassigningEmployee(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !targetEmployeeId}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring...' : 'Transfer All Clients'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
