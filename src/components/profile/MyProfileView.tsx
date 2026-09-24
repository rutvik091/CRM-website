import { useState, type FC, type FormEvent } from 'react';
import { LockKeyhole, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { User } from '../../types';

interface MyProfileViewProps {
  currentUser: User;
}

export const MyProfileView: FC<MyProfileViewProps> = ({ currentUser }) => {
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setIsUpdating(true);
      setError('');
      setMessage('');

      await apiRequest('/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });

      setMessage('Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed updating password');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          My Account Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View your staff credentials and update your portal password.
        </p>
      </div>

      {/* Account Details Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-2xs">
            {currentUser.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{currentUser.fullName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {currentUser.employeeId || 'ADMIN'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {currentUser.role === 'ADMIN' ? 'Business Owner (Admin)' : 'Wealth Consultant (Employee)'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Registered Email</span>
            <div className="text-slate-900 font-semibold mt-0.5">{currentUser.email}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Mobile Number</span>
            <div className="text-slate-900 font-semibold mt-0.5">+91 {currentUser.mobile}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Access Tier</span>
            <div className="text-slate-900 font-semibold mt-0.5">
              {currentUser.role === 'ADMIN' ? 'Full Firm Permissions' : 'Assigned Clients (Masked KYC)'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Two-Factor Authentication</span>
            <div className="text-emerald-700 font-semibold mt-0.5">Active (OTP verified on login)</div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <LockKeyhole className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Change Security Password</h2>
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700">Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
