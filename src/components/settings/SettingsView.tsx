import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  MessageSquare,
  Smartphone,
  Database,
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { User } from '../../types';

interface SettingsViewProps {
  currentUser: User;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'firm' | 'messaging' | 'backups' | 'diagnostics'>('firm');

  // Test send states
  const [testMobile, setTestMobile] = useState<string>('9876543210');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Diagnostics test runner
  const [testSuiteResults, setTestSuiteResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  // Backups
  const [backups, setBackups] = useState<string[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/settings');
      setSettings(res.settings);
    } catch (err) {
      console.error('Failed fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await apiRequest('/settings/backups');
      setBackups(res.backups || []);
    } catch (err) {
      console.error('Failed fetching backups:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      alert('Firm configuration saved successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessaging = async (type: 'whatsapp' | 'sms') => {
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await apiRequest(`/settings/test-${type}`, {
        method: 'POST',
        body: JSON.stringify({ recipientMobile: testMobile })
      });
      setTestResult({ type, ...res });
    } catch (err: any) {
      setTestResult({ type, success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsCreatingBackup(true);
      await apiRequest('/settings/backups/create', { method: 'POST' });
      await fetchBackups();
      alert('Manual snapshot created successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed creating backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      setIsRunningTests(true);
      const res = await apiRequest('/tests/run', { method: 'POST' });
      setTestSuiteResults(res.results || []);
    } catch (err: any) {
      alert(err.message || 'Failed executing system tests');
    } finally {
      setIsRunningTests(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading firm settings & system diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          System Administration & Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business metadata, official messaging gateways, database snapshots, and automated verification tests.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold w-fit gap-1">
        <button
          onClick={() => setActiveTab('firm')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'firm' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Firm Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('messaging')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'messaging' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Messaging Gateways</span>
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'backups' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database Backups</span>
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'diagnostics' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>System Diagnostics</span>
        </button>
      </div>

      {/* Tab 1: Firm Profile */}
      {activeTab === 'firm' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            Business Profile & Regional Standards
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700">Firm Branding Name</label>
              <input
                type="text"
                disabled
                value={settings.firmName}
                className="mt-1 w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-semibold"
              />
              <span className="text-[10px] text-slate-400">Fixed as "My Investment Manager".</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Official Contact Email</label>
              <input
                type="email"
                value={settings.officialEmail}
                onChange={e => setSettings({ ...settings, officialEmail: e.target.value })}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">Official Mobile / Helpline</label>
              <input
                type="tel"
                value={settings.officialPhone}
                onChange={e => setSettings({ ...settings, officialPhone: e.target.value })}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700">Office Physical Address</label>
              <input
                type="text"
                value={settings.officeAddress}
                onChange={e => setSettings({ ...settings, officeAddress: e.target.value })}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">Currency Standard</label>
              <input
                type="text"
                disabled
                value="Indian Rupee (INR ₹)"
                className="mt-1 w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">Timezone Standard</label>
              <input
                type="text"
                disabled
                value="Asia/Kolkata (IST)"
                className="mt-1 w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Firm Information'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Messaging Gateways */}
      {activeTab === 'messaging' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 max-w-3xl">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Communication & Messaging Gateways</h2>
            <p className="text-xs text-slate-500">Configure WhatsApp Business Cloud API and SMS DLT provider credentials.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* WhatsApp Config */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Business API</span>
              </div>

              <div>
                <label className="font-medium text-slate-700">Provider Gateway</label>
                <input
                  type="text"
                  value={settings.whatsappProvider}
                  onChange={e => setSettings({ ...settings, whatsappProvider: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Meta Cloud API"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700">Phone Number ID</label>
                <input
                  type="text"
                  value={settings.whatsappPhoneNumberId}
                  onChange={e => setSettings({ ...settings, whatsappPhoneNumberId: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  placeholder="100293849182"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700">API Bearer Key</label>
                <input
                  type="password"
                  value={settings.whatsappApiKey}
                  onChange={e => setSettings({ ...settings, whatsappApiKey: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  placeholder="••••••••••••••••"
                />
              </div>

              <button
                type="button"
                onClick={() => handleTestMessaging('whatsapp')}
                disabled={isTesting}
                className="w-full py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
              >
                Send Test WhatsApp Payload
              </button>
            </div>

            {/* SMS Config */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-blue-800">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>SMS Gateway (DLT Approved)</span>
              </div>

              <div>
                <label className="font-medium text-slate-700">Provider Gateway</label>
                <input
                  type="text"
                  value={settings.smsProvider}
                  onChange={e => setSettings({ ...settings, smsProvider: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Msg91 / Fast2SMS"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700">DLT Sender ID (6 Chars)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={settings.smsSenderId}
                  onChange={e => setSettings({ ...settings, smsSenderId: e.target.value.toUpperCase() })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white uppercase font-mono"
                  placeholder="MIMNVR"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700">SMS Gateway Auth Key</label>
                <input
                  type="password"
                  value={settings.smsApiKey}
                  onChange={e => setSettings({ ...settings, smsApiKey: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  placeholder="••••••••••••••••"
                />
              </div>

              <button
                type="button"
                onClick={() => handleTestMessaging('sms')}
                disabled={isTesting}
                className="w-full py-2 text-xs font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
              >
                Send Test SMS Payload
              </button>
            </div>
          </div>

          {/* Test recipient & feedback */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs">
            <label className="font-semibold text-slate-700">Test Dispatch Mobile Number (10 Digits)</label>
            <input
              type="tel"
              maxLength={10}
              value={testMobile}
              onChange={e => setTestMobile(e.target.value.replace(/\D/g, ''))}
              className="w-64 p-2 border border-slate-300 rounded-lg"
              placeholder="9876543210"
            />

            {testResult && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              {isSaving ? 'Saving...' : 'Save Messaging Credentials'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Backups */}
      {activeTab === 'backups' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Database Snapshots & Disaster Recovery</h2>
              <p className="text-xs text-slate-500">Automated daily snapshot at 10:00 AM IST + on-demand manual snapshots.</p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isCreatingBackup ? 'Creating...' : 'Create Snapshot Now'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {backups.map((filename, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="font-mono font-medium text-slate-800">{filename}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/settings/backups/download/${filename}`}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
            {backups.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No backup snapshots found. Click "Create Snapshot Now" to save a restore point.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Diagnostics Test Runner (Section 44) */}
      {activeTab === 'diagnostics' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Automated System Diagnostics</h2>
              <p className="text-xs text-slate-500">
                Executes the system verification test suite to ensure RBAC masking, 10/5/2 reminders, and 403 access rules are 100% compliant.
              </p>
            </div>
            <button
              onClick={handleRunDiagnostics}
              disabled={isRunningTests}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Running Suite...' : 'Run All System Tests'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {testSuiteResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                  t.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{t.message}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {t.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            ))}

            {testSuiteResults.length === 0 && !isRunningTests && (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                Click "Run All System Tests" to execute live verification tests across all security and portfolio modules.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
