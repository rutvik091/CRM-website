import React, { useState, useEffect } from 'react';
import { Menu, Clock, Bell, RefreshCw } from 'lucide-react';
import { User } from '../../types';

interface HeaderProps {
  currentUser: User;
  onOpenMobileMenu?: () => void;
  onMenuToggle?: () => void;
  onOpenReminders?: () => void;
  onNavigateProfile?: () => void;
  onSelectCustomer?: (customerId: string) => void;
  activeTab?: any;
  dueRemindersCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenMobileMenu,
  onMenuToggle,
  onOpenReminders,
  onNavigateProfile,
  onSelectCustomer,
  activeTab,
  dueRemindersCount = 0
}) => {
  const [istTime, setIstTime] = useState<string>('');
  const handleToggleMenu = onMenuToggle || onOpenMobileMenu;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as IST time (Asia/Kolkata)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setIstTime(new Intl.DateTimeFormat('en-IN', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleMenu}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">
            My Investment Manager
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Internal Wealth CRM
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* IST Clock Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-mono text-[11px] font-medium">{istTime || '10:00 AM IST'}</span>
          <span className="text-[10px] text-slate-400 font-sans hidden md:inline">Asia/Kolkata</span>
        </div>

        {/* Notifications / Pending Reminders Alert */}
        <button
          onClick={onOpenReminders}
          className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title="View Due Reminders"
        >
          <Bell className="w-4 h-4" />
          {dueRemindersCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
          )}
        </button>

        {/* User preview */}
        <div
          onClick={onNavigateProfile}
          className="flex items-center gap-2.5 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
          title="Open My Profile"
        >
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser.fullName}
            </div>
            <div className="text-[10px] text-blue-700 font-medium leading-tight">
              {currentUser.role === 'ADMIN' ? 'Administrator' : 'Wealth Consultant (Employee)'}
            </div>
          </div>
          {currentUser.profilePhoto ? (
            <img
              src={currentUser.profilePhoto}
              alt={currentUser.fullName}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center border border-blue-200">
              {currentUser.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
