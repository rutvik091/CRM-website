import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageSquare,
  ExternalLink,
  ShieldAlert,
  Archive,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { openPhoneCall, openWhatsAppChat } from '../../lib/utils';
import { Customer, User } from '../../types';

interface CustomerListViewProps {
  currentUser: User;
  onSelectCustomer: (customerId: string) => void;
  filterEmployeeId?: string;
}

export const CustomerListView: React.FC<CustomerListViewProps> = ({
  currentUser,
  onSelectCustomer,
  filterEmployeeId
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [productType, setProductType] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('Active');
  const [selectedEmployee, setSelectedEmployee] = useState<string>(filterEmployeeId || 'ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Employees list for filter dropdown (Admin only)
  const [employees, setEmployees] = useState<any[]>([]);

  // Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    dob: '1990-01-01',
    gender: 'Male',
    mobile: '',
    email: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    pan: '',
    aadhaar: '',
    bankName: 'HDFC Bank',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: 'Savings',
    assignedEmployeeId: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search,
        productType,
        status,
        showArchived: showArchived ? 'true' : 'false'
      });

      if (isAdmin && selectedEmployee !== 'ALL') {
        params.append('employeeId', selectedEmployee);
      }

      const res = await apiRequest(`/customers?${params.toString()}`);
      setCustomers(res.customers);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!isAdmin) return;
    try {
      const res = await apiRequest('/employees');
      setEmployees(res.employees);
      if (res.employees.length > 0 && !newCustomerForm.assignedEmployeeId) {
        setNewCustomerForm(prev => ({ ...prev, assignedEmployeeId: res.employees[0].id }));
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [isAdmin]);

  useEffect(() => {
    fetchCustomers();
  }, [page, search, productType, status, selectedEmployee, showArchived]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomerForm)
      });
      setIsAddModalOpen(false);
      await fetchCustomers();
      if (res.customer?.id) {
        onSelectCustomer(res.customer.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Add Button */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {showArchived ? 'Archived Customers Directory' : 'Customer Relationship Directory'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? `Total ${total} client records managed across all team members.`
              : `Showing your assigned client accounts (${total} total).`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                showArchived
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'View Active Directory' : 'View Archived Clients'}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, mobile, MIM-ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Product Filter */}
          <div>
            <select
              value={productType}
              onChange={e => { setProductType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
            >
              <option value="ALL">All Products (Any Portfolio)</option>
              <option value="SIP">Active SIP Portfolios Only</option>
              <option value="MEDICAL_INSURANCE">Health Insurance Only</option>
              <option value="LIFE_INSURANCE">Life Insurance Only</option>
            </select>
          </div>

          {/* Employee Filter (Admin Only) */}
          {isAdmin && (
            <div>
              <select
                value={selectedEmployee}
                onChange={e => { setSelectedEmployee(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="ALL">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Action */}
          <div className="flex items-center justify-end">
            <button
              onClick={fetchCustomers}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Results</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table / Card View */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Customer ID</th>
                <th className="px-6 py-3">Customer Name</th>
                <th className="px-6 py-3">Mobile Contact</th>
                <th className="px-6 py-3">Active Products</th>
                {isAdmin && <th className="px-6 py-3">Assigned Employee</th>}
                <th className="px-6 py-3">Due Reminders</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((cust: any) => (
                <tr
                  key={cust.id}
                  onClick={() => onSelectCustomer(cust.id)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 font-mono text-xs font-bold text-blue-600">
                    {cust.customerId}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900">{cust.fullName}</div>
                    <div className="text-[11px] text-slate-400">{cust.city}, {cust.state}</div>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-700 font-mono">
                    +91 {cust.mobile}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      {cust.sipsCount > 0 && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
                          {cust.sipsCount} SIP
                        </span>
                      )}
                      {cust.medicalCount > 0 && (
                        <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-medium">
                          {cust.medicalCount} Health
                        </span>
                      )}
                      {cust.lifeCount > 0 && (
                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-medium">
                          {cust.lifeCount} Life
                        </span>
                      )}
                      {cust.sipsCount === 0 && cust.medicalCount === 0 && cust.lifeCount === 0 && (
                        <span className="text-slate-400 text-xs">No active plans</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-3.5 text-xs font-medium text-slate-700">
                      {cust.assignedEmployeeName}
                    </td>
                  )}
                  <td className="px-6 py-3.5">
                    {cust.pendingRemindersCount > 0 ? (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {cust.pendingRemindersCount} pending
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openPhoneCall(cust.mobile)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-100"
                        title="Call"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openWhatsAppChat(cust.mobile)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-md hover:bg-slate-100"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectCustomer(cust.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
                        title="View Full Profile"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center text-xs text-slate-400">
                    No customers match the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {customers.length} of {total} clients
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-medium text-slate-700">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Customer Modal (Admin Only) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
                <p className="text-xs text-slate-500">Customer ID (MIM-XXXX) will be generated sequentially.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.fullName}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="E.g. Rajesh Kumar"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Mobile Number (10 Digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newCustomerForm.mobile}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, mobile: e.target.value.replace(/\D/g, '') })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="9876543210"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={newCustomerForm.dob}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, dob: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Gender *</label>
                  <select
                    value={newCustomerForm.gender}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, gender: e.target.value as any })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="rajesh@example.com"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">City *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.city}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, city: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="Mumbai"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">State *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.state}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, state: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="Maharashtra"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newCustomerForm.pincode}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, pincode: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="400001"
                  />
                </div>

                {/* Sensitive KYC info */}
                <div>
                  <label className="font-semibold text-slate-700">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={newCustomerForm.pan}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, pan: e.target.value.toUpperCase() })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 uppercase font-mono"
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Aadhaar (12 Digits)</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={newCustomerForm.aadhaar}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, aadhaar: e.target.value.replace(/\D/g, '') })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                    placeholder="123456789012"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Bank Name</label>
                  <input
                    type="text"
                    value={newCustomerForm.bankName}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, bankName: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="HDFC Bank"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Bank Account Number</label>
                  <input
                    type="text"
                    value={newCustomerForm.accountNumber}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, accountNumber: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                    placeholder="50100234567890"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">IFSC Code</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={newCustomerForm.ifscCode}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, ifscCode: e.target.value.toUpperCase() })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 uppercase font-mono"
                    placeholder="HDFC0000001"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assign To Employee *</label>
                  <select
                    value={newCustomerForm.assignedEmployeeId}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, assignedEmployeeId: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCustomerForm.fullName || !newCustomerForm.mobile}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Customer Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
