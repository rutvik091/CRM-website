import React, { useState, useEffect } from 'react';
import { apiRequest } from './lib/api';
import { User, NavTab } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AuthModal } from './components/auth/AuthModal';

import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { CustomerListView } from './components/customers/CustomerListView';
import { CustomerProfileView } from './components/customers/CustomerProfileView';
import { RemindersView } from './components/reminders/RemindersView';
import { CalendarView } from './components/calendar/CalendarView';
import { EmployeeManagementView } from './components/employees/EmployeeManagementView';
import { ReportsView } from './components/reports/ReportsView';
import { ImportExportView } from './components/importExport/ImportExportView';
import { SettingsView } from './components/settings/SettingsView';
import { MyProfileView } from './components/profile/MyProfileView';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Check current session
  const verifySession = async () => {
    const token = localStorage.getItem('mim_auth_token');
    if (!token) {
      setCurrentUser(null);
      setLoadingUser(false);
      return;
    }

    try {
      const res = await apiRequest('/auth/me');
      if (res.user) {
        setCurrentUser(res.user);
      } else {
        localStorage.removeItem('mim_auth_token');
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn('Session verification failed:', err);
      localStorage.removeItem('mim_auth_token');
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setSelectedCustomerId(null);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('mim_auth_token');
      setCurrentUser(null);
      setActiveTab('dashboard');
      setSelectedCustomerId(null);
    }
  };

  const handleOpenCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  const handleBackToCustomers = () => {
    setSelectedCustomerId(null);
  };

  const handleSelectEmployeeFilter = (empId: string) => {
    setFilterEmployeeId(empId);
    setSelectedCustomerId(null);
    setActiveTab('customers');
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <RefreshCw className="w-5 h-5 text-white animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-600 tracking-wide">
            Initializing My Investment Manager...
          </p>
        </div>
      </div>
    );
  }

  // If user not authenticated, render login/onboarding portal
  if (!currentUser) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Navigation Sidebar */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedCustomerId(null);
          if (tab !== 'customers') setFilterEmployeeId(undefined);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentUser={currentUser}
          activeTab={activeTab}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onNavigateProfile={() => {
            setActiveTab('profile');
            setSelectedCustomerId(null);
          }}
          onSelectCustomer={handleOpenCustomer}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* If a customer profile is opened, render the full CRM profile */}
          {selectedCustomerId ? (
            <CustomerProfileView
              customerId={selectedCustomerId}
              currentUser={currentUser}
              onBack={handleBackToCustomers}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                currentUser.role === 'ADMIN' ? (
                  <AdminDashboard
                    onSelectEmployee={handleSelectEmployeeFilter}
                    onOpenReminders={() => setActiveTab('reminders')}
                    onOpenCustomers={() => setActiveTab('customers')}
                  />
                ) : (
                  <EmployeeDashboard
                    onSelectCustomer={handleOpenCustomer}
                    onOpenReminders={() => setActiveTab('reminders')}
                    onOpenCustomers={() => setActiveTab('customers')}
                  />
                )
              )}

              {activeTab === 'customers' && (
                <CustomerListView
                  currentUser={currentUser}
                  onSelectCustomer={handleOpenCustomer}
                  filterEmployeeId={filterEmployeeId}
                />
              )}

              {activeTab === 'reminders' && (
                <RemindersView
                  currentUser={currentUser}
                  onSelectCustomer={handleOpenCustomer}
                />
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  currentUser={currentUser}
                  onSelectCustomer={handleOpenCustomer}
                />
              )}

              {activeTab === 'employees' && currentUser.role === 'ADMIN' && (
                <EmployeeManagementView />
              )}

              {activeTab === 'reports' && currentUser.role === 'ADMIN' && (
                <ReportsView />
              )}

              {activeTab === 'import_export' && currentUser.role === 'ADMIN' && (
                <ImportExportView currentUser={currentUser} />
              )}

              {activeTab === 'settings' && currentUser.role === 'ADMIN' && (
                <SettingsView currentUser={currentUser} />
              )}

              {activeTab === 'profile' && (
                <MyProfileView currentUser={currentUser} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
