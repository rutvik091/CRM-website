import React, { useState } from 'react';
import { Lock, Mail, Phone, Shield, User, KeyRound, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { apiRequest, setStoredToken } from '../../lib/api';
import { User as UserType } from '../../types';

interface AuthModalProps {
  onLoginSuccess: (user: UserType) => void;
  adminExists?: boolean;
}

type AuthMode = 'LOGIN' | 'ADMIN_SETUP' | 'EMPLOYEE_SIGNUP' | 'FORGOT_PASSWORD';

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess, adminExists = true }) => {
  const [mode, setMode] = useState<AuthMode>(adminExists ? 'LOGIN' : 'ADMIN_SETUP');
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState<string>('admin@myinvestmentmanager.com');
  const [password, setPassword] = useState<string>('Admin@1234');
  const [mobile, setMobile] = useState<string>('9876543210');
  const [otp, setOtp] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [registrationCode, setRegistrationCode] = useState<string>('');
  const [designation, setDesignation] = useState<string>('Senior Wealth Consultant');
  const [resetToken, setResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  // Pre-fill demo accounts
  const handleQuickDemo = (role: 'ADMIN' | 'EMPLOYEE') => {
    setError(null);
    setSuccessMessage(null);
    setMode('LOGIN');
    setStep(1);
    if (role === 'ADMIN') {
      setEmail('admin@myinvestmentmanager.com');
      setPassword('Admin@1234');
      setMobile('9876543210');
    } else {
      setEmail('priya.sharma@myinvestmentmanager.com');
      setPassword('Employee@1234');
      setMobile('9823456781');
    }
  };

  // 1. Normal Login: Step 1 Email + Password -> Requests Mobile OTP
  const handleLoginRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login-request-otp', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setMobile(res.mobile);
      if (res.debugOtp) {
        setOtp(res.debugOtp);
      }
      setSuccessMessage(`OTP sent to +91 ${res.maskedMobile}. Check code below:`);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Login failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Normal Login: Step 2 Verify OTP
  const handleLoginVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login-verify-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile, otp })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Admin Setup: Step 1 Mobile -> OTP
  const handleAdminSetupRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/admin-setup-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile })
      });
      if (res.debugOtp) setOtp(res.debugOtp);
      setSuccessMessage(res.message);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed requesting OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Admin Setup: Step 2 Verify OTP & Complete Admin Setup
  const handleAdminSetupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/admin-setup-verify', {
        method: 'POST',
        body: JSON.stringify({ mobile, otp, fullName, email, password })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Admin account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Employee Signup: Step 1 Registration Code + Mobile -> OTP
  const handleEmployeeSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/employee-signup-otp', {
        method: 'POST',
        body: JSON.stringify({ registrationCode, mobile })
      });
      if (res.debugOtp) setOtp(res.debugOtp);
      setSuccessMessage(res.message);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Invalid registration code or mobile.');
    } finally {
      setLoading(false);
    }
  };

  // Employee Signup: Step 2 Verify OTP & Complete Account
  const handleEmployeeSignupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/employee-signup-complete', {
        method: 'POST',
        body: JSON.stringify({
          registrationCode,
          mobile,
          otp,
          fullName,
          email,
          password,
          designation
        })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Employee signup failed.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Forgot Password: Step 1 Request link to email
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/forgot-password-request', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setSuccessMessage(res.message);
      if (res.debugToken) setResetToken(res.debugToken);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 2 Reset with token
  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/auth/forgot-password-reset', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword })
      });
      setSuccessMessage(res.message);
      setTimeout(() => {
        setMode('LOGIN');
        setStep(1);
        setPassword(newPassword);
        setError(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
            M
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight">
          My Investment Manager
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Internal CRM & Client Reminders System
        </p>

        {/* Quick Demo Access Bar */}
        <div className="mt-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Development Seed Credentials (One-Click Auto-Fill):</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('ADMIN')}
              className="flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded text-[11px] font-semibold text-blue-800 hover:bg-blue-100/50 transition-colors shadow-2xs text-center"
            >
              👑 Login as Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('EMPLOYEE')}
              className="flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded text-[11px] font-semibold text-blue-800 hover:bg-blue-100/50 transition-colors shadow-2xs text-center"
            >
              💼 Login as Employee
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {/* Navigation Mode Switcher */}
          <div className="flex border-b border-slate-200 pb-3 mb-6 gap-4 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); setStep(1); setError(null); setSuccessMessage(null); }}
              className={`pb-1 border-b-2 transition-colors ${
                mode === 'LOGIN' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-800'
              }`}
            >
              Account Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('EMPLOYEE_SIGNUP'); setStep(1); setError(null); setSuccessMessage(null); }}
              className={`pb-1 border-b-2 transition-colors ${
                mode === 'EMPLOYEE_SIGNUP' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-800'
              }`}
            >
              Employee Registration
            </button>
            {!adminExists && (
              <button
                type="button"
                onClick={() => { setMode('ADMIN_SETUP'); setStep(1); setError(null); setSuccessMessage(null); }}
                className={`pb-1 border-b-2 transition-colors ${
                  mode === 'ADMIN_SETUP' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-800'
                }`}
              >
                Admin Setup
              </button>
            )}
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              {successMessage}
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'LOGIN' && (
            <>
              {step === 1 ? (
                <form onSubmit={handleLoginRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Verified Email Address</label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        placeholder="name@myinvestmentmanager.com"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-medium text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('FORGOT_PASSWORD'); setStep(1); setError(null); }}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Validating...' : 'Next: Mobile OTP Verification'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLoginVerifyOtp} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    <div>Login 2FA: Mobile OTP is required on <strong>every login</strong>.</div>
                    <div className="mt-1 font-mono text-slate-800">Mobile: +91 {mobile}</div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Enter 6-digit OTP</label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-9 pr-3 py-2 text-base font-mono tracking-widest border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-center font-bold"
                        placeholder="123456"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otp.length < 6}
                      className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Verifying...' : 'Verify OTP & Enter CRM'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* MODE 2: EMPLOYEE SIGNUP (REGISTRATION CODE CONTROLLED) */}
          {mode === 'EMPLOYEE_SIGNUP' && (
            <>
              {step === 1 ? (
                <form onSubmit={handleEmployeeSignupOtp} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
                    Employee accounts require an <strong>Admin Registration Code</strong>.
                    Enter the code given to you by your Administrator.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">One-Time Registration Code</label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Shield className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={registrationCode}
                        onChange={e => setRegistrationCode(e.target.value.toUpperCase())}
                        className="block w-full pl-9 pr-3 py-2 text-sm font-mono tracking-wider border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 uppercase"
                        placeholder="REG-XXXXXX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Your Mobile Number</label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !registrationCode || mobile.length < 10}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Validating Code...' : 'Verify Code & Send OTP'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleEmployeeSignupComplete} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Enter OTP sent to +91 {mobile}</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 block w-full px-3 py-2 text-base font-mono tracking-widest border border-slate-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-600"
                      placeholder="123456"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="Aniket Sharma"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="aniket@myinvestmentmanager.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="Senior Wealth Consultant"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otp.length < 6 || !fullName || !email || !password}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Creating Account...' : 'Complete Registration'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* MODE 3: FIRST-TIME ADMIN SETUP */}
          {mode === 'ADMIN_SETUP' && (
            <>
              {step === 1 ? (
                <form onSubmit={handleAdminSetupRequestOtp} className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    First-Time System Initialization: Exactly one Admin account manages the firm.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Admin Mobile Number</label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || mobile.length < 10}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Sending OTP...' : 'Send Mobile OTP'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdminSetupVerify} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Enter OTP sent to +91 {mobile}</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 block w-full px-3 py-2 text-base font-mono tracking-widest border border-slate-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-600"
                      placeholder="123456"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="Vikramaditya Sharma"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Admin Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="admin@myinvestmentmanager.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Master Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otp.length < 6 || !fullName || !email || !password}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Initializing...' : 'Create Admin Account'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* MODE 4: FORGOT PASSWORD (EMAIL RESET LINK; NO SMS OTP) */}
          {mode === 'FORGOT_PASSWORD' && (
            <>
              {step === 1 ? (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    Enter your verified email to receive a password recovery link.
                    (Password recovery is handled via verified email, not SMS OTP).
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Your Account Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="name@myinvestmentmanager.com"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('LOGIN'); setStep(1); }}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Sending...' : 'Send Password Reset Link'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleForgotPasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Reset Token (from Email)</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={e => setResetToken(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="Paste token"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Enter New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('LOGIN'); setStep(1); }}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Back to Login
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !resetToken || !newPassword}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Updating...' : 'Set New Password'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
