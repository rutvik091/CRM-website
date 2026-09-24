import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  RefreshCw,
  Users,
  Filter
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { User } from '../../types';

interface ImportExportViewProps {
  currentUser: User;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Export States
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [exportProductType, setExportProductType] = useState<string>('ALL');
  const [exportStatus, setExportStatus] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_new'>('skip');
  const [assignEmployeeId, setAssignEmployeeId] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string>('');

  // Employees for assignment dropdown
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      apiRequest('/employees').then(res => setEmployees(res.employees || [])).catch(() => {});
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <h3 className="text-base font-bold">Access Denied</h3>
        <p className="text-xs text-red-600 mt-1">
          Import and Export tools contain raw unmasked client records and are strictly restricted to the Business Owner (Admin).
        </p>
      </div>
    );
  }

  // Template Download
  const handleDownloadTemplate = async (format: 'excel' | 'csv') => {
    try {
      const token = localStorage.getItem('mim_auth_token');
      const res = await fetch(`/api/import-export/template?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIM_Customer_Import_Template.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Template download failed: ' + err.message);
    }
  };

  // Export Execution
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('mim_auth_token');
      const params = new URLSearchParams({
        format: exportFormat,
        productType: exportProductType,
        status: exportStatus
      });

      const res = await fetch(`/api/import-export/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIM_Customer_Export_${new Date().toISOString().slice(0, 10)}.${exportFormat === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // File selection & Validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setValidationResult(null);
    setImportSuccessMessage('');

    // Send for server validation
    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsValidating(true);
      const token = localStorage.getItem('mim_auth_token');
      const res = await fetch('/api/import-export/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Validation failed');
      setValidationResult(data);
    } catch (err: any) {
      alert(err.message || 'Error parsing import file');
    } finally {
      setIsValidating(false);
    }
  };

  // Commit Import
  const handleCommitImport = async () => {
    if (!validationResult || !validationResult.validRows) return;

    try {
      setIsCommitting(true);
      const res = await apiRequest('/import-export/commit', {
        method: 'POST',
        body: JSON.stringify({
          validRows: validationResult.validRows,
          duplicateHandling,
          assignedEmployeeId: assignEmployeeId || (employees[0]?.id || '')
        })
      });

      setImportSuccessMessage(`Successfully imported ${res.importedCount} customers into database!`);
      setValidationResult(null);
      setImportFile(null);
    } catch (err: any) {
      alert(err.message || 'Failed committing import');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Client Data Import & Export Hub
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Migrate your client book with automated duplicate deduplication and field validation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Import Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Import Client Directory</h2>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleDownloadTemplate('excel')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                <FileDown className="w-3 h-3" />
                <span>Template (.xlsx)</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('csv')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200"
              >
                <FileDown className="w-3 h-3" />
                <span>Template (.csv)</span>
              </button>
            </div>
          </div>

          {importSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMessage}</span>
            </div>
          )}

          {/* Upload Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Excel or CSV File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Supports .xlsx, .xls, and .csv files formatted per the official MIM template.
            </p>
          </div>

          {isValidating && (
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold p-3 bg-blue-50 rounded-lg">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Validating columns, checking mobile duplicates and PAN formats...</span>
            </div>
          )}

          {/* Validation Report */}
          {validationResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-900">Pre-Import Validation Summary</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Total Rows</div>
                  <div className="text-lg font-bold text-slate-900">{validationResult.totalRows}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <div className="text-emerald-700 text-[10px] uppercase font-semibold">Valid Records</div>
                  <div className="text-lg font-bold text-emerald-700">{validationResult.validRows?.length || 0}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-red-200">
                  <div className="text-red-700 text-[10px] uppercase font-semibold">Errors Found</div>
                  <div className="text-lg font-bold text-red-700">{validationResult.invalidRows?.length || 0}</div>
                </div>
              </div>

              {/* Duplicate Mobile Alert */}
              {validationResult.duplicateMobilesCount > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>{validationResult.duplicateMobilesCount} duplicate mobile numbers detected</strong> in your current database. Choose how to handle duplicates below.
                  </div>
                </div>
              )}

              {/* Duplicate Handling Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duplicate Resolution Strategy
                </label>
                <select
                  value={duplicateHandling}
                  onChange={e => setDuplicateHandling(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="skip">Skip duplicates (Recommended - preserves existing records)</option>
                  <option value="update">Update existing customer details</option>
                  <option value="create_new">Create new record anyway</option>
                </select>
              </div>

              {/* Assign To Employee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Imported Customers To Employee
                </label>
                <select
                  value={assignEmployeeId}
                  onChange={e => setAssignEmployeeId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invalid Rows Table */}
              {validationResult.invalidRows?.length > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold text-red-700 text-[11px]">
                    Invalid Records ({validationResult.invalidRows.length} rows skipped):
                  </div>
                  <div className="max-h-32 overflow-y-auto divide-y divide-red-100 bg-red-50/50 rounded-lg p-2 border border-red-200">
                    {validationResult.invalidRows.map((inv: any, idx: number) => (
                      <div key={idx} className="py-1 text-[10px] text-red-800">
                        Row #{inv.row}: <strong>{inv.name || 'Unnamed'}</strong> - {inv.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit Button */}
              <button
                onClick={handleCommitImport}
                disabled={isCommitting || validationResult.validRows?.length === 0}
                className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              >
                {isCommitting
                  ? 'Importing Records...'
                  : `Commit & Import ${validationResult.validRows?.length || 0} Customers`}
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Export Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Download className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Export Unmasked Client Book</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Export File Format *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('excel')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    exportFormat === 'excel'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <span>Microsoft Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    exportFormat === 'csv'
                      ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <span>Standard CSV (.csv)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Filter by Portfolio Type
              </label>
              <select
                value={exportProductType}
                onChange={e => setExportProductType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">All Products (Full Database)</option>
                <option value="SIP">Customers with Active SIPs</option>
                <option value="MEDICAL_INSURANCE">Customers with Health Insurance</option>
                <option value="LIFE_INSURANCE">Customers with Life Insurance</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Filter by Account Status
              </label>
              <select
                value={exportStatus}
                onChange={e => setExportStatus(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">All (Active & Archived)</option>
                <option value="Active">Active Clients Only</option>
                <option value="Archived">Archived Clients Only</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] leading-relaxed">
              Exported spreadsheets contain complete customer records including full unmasked PAN, Aadhaar, bank details, and active policy lines.
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating Spreadsheet...' : `Download ${exportFormat.toUpperCase()} Export`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
