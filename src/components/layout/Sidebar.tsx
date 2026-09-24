import React from 'react';
import {
  LayoutDashboard,
  Users,
  BellRing,
  Calendar,
  BarChart3,
  UserCheck,
  FileSpreadsheet,
  Settings,
  UserCircle,
  LogOut,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { User } from '../../types';

export type ActiveTab =
  | 'dashboard'
  | 'customers'
  | 'customer-profile'
  | 'reminders'
  | 'calendar'
  | 'reports'
  | 'employees'
  | 'import-export'
  | 'settings'
  | 'profile';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab?: (tab: any) => void;
  onTabChange?: (tab: any) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  isOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onTabChange,
  onLogout,
  isMobileOpen,
  isOpen,
  setIsMobileOpen,
  onClose
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const mobileOpen = isOpen !== undefined ? isOpen : (isMobileOpen || false);
  const handleClose = () => {
    if (onClose) onClose();
    if (setIsMobileOpen) setIsMobileOpen(false);
  };
  const changeTab = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    if (setActiveTab) setActiveTab(tabId as any);
    handleClose();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { id: 'customers', label: 'Customers', icon: Users, adminOnly: false },
    { id: 'reminders', label: 'Reminders', icon: BellRing, adminOnly: false },
    { id: 'calendar', label: 'Calendar', icon: Calendar, adminOnly: false },
    { id: 'reports', label: 'Reports', icon: BarChart3, adminOnly: true },
    { id: 'employees', label: 'Employees', icon: UserCheck, adminOnly: true },
    { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    { id: 'profile', label: 'My Profile', icon: UserCircle, adminOnly: false },
  ];

  // Strictly hide unauthorized menu items
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const handleNavClick = (tabId: string) => {
    changeTab(tabId === 'import-export' ? 'import_export' : tabId);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
              M
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm tracking-tight leading-none">
                My Investment Manager
              </div>
              <div className="text-[11px] text-slate-500 font-normal mt-1 leading-none">
                Single-Firm Wealth & CRM
              </div>
            </div>
          </div>
        </div>

        {/* Role Badge Indicator */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            ) : (
              <Briefcase className="w-4 h-4 text-slate-600" />
            )}
            <span className="text-xs font-medium text-slate-700">
              {isAdmin ? 'System Administrator' : 'Employee Portal'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
            {currentUser.role}
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'customers' && activeTab === 'customer-profile');
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            {currentUser.profilePhoto ? (
              <img
                src={currentUser.profilePhoto}
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser.email}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
