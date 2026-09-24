import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  TrendingUp,
  HeartPulse,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatDateIST } from '../../lib/utils';
import { User } from '../../types';

interface CalendarViewProps {
  currentUser: User;
  onSelectCustomer: (customerId: string) => void;
}

type ViewMode = 'MONTH' | 'WEEK' | 'DAY';

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentUser,
  onSelectCustomer
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/calendar/events');
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'MONTH') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'WEEK') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'MONTH') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'WEEK') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ day: i, dateStr, isCurrentMonth: true });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Portfolio Calendar & Due Dates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            System-generated portfolio events only. Displays SIP debit dates, insurance renewals, and maturity schedules.
          </p>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {(['MONTH', 'WEEK', 'DAY'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'MONTH' ? 'Month View' : mode === 'WEEK' ? 'Week View' : 'Day View'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-bold text-slate-900">
            {monthName}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>SIP Debit</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Health Renewal</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Life Policy</span>
          </span>
        </div>
      </div>

      {/* Calendar Month Grid */}
      {viewMode === 'MONTH' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 border-b border-slate-200 bg-slate-50/70">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2.5 border-r last:border-r-0 border-slate-200">
                {d}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-y divide-slate-100">
            {/* Blank leading days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`blank-${idx}`} className="bg-slate-50/40 min-h-24 p-2 border-r last:border-r-0 border-slate-100" />
            ))}

            {/* Current month days */}
            {calendarDays.map(item => {
              const dayEvents = events.filter(e => e.date === item.dateStr || e.reminderDate === item.dateStr);
              const isToday = item.dateStr === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={item.dateStr}
                  className={`min-h-28 p-2 border-r last:border-r-0 border-slate-100 transition-colors flex flex-col justify-between ${
                    isToday ? 'bg-blue-50/30 font-bold' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-700'}`}>
                      {item.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-20 custom-scrollbar">
                    {dayEvents.map(ev => {
                      const isSip = ev.productType === 'SIP';
                      const isMed = ev.productType === 'MEDICAL_INSURANCE';

                      return (
                        <div
                          key={ev.id}
                          onClick={() => onSelectCustomer(ev.customerId)}
                          className={`p-1 rounded text-[10px] font-medium truncate cursor-pointer transition-all border ${
                            isSip
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : isMed
                              ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          title={`${ev.customerName} - ${ev.title}`}
                        >
                          <span className="font-bold">{ev.customerName}:</span> {ev.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week & Day Views */}
      {viewMode !== 'MONTH' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Agenda for {currentDate.toDateString()}
          </h3>
          <div className="divide-y divide-slate-100">
            {events.slice(0, 15).map(ev => (
              <div
                key={ev.id}
                onClick={() => onSelectCustomer(ev.customerId)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg px-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    ev.productType === 'SIP' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {ev.productType === 'SIP' ? 'SIP' : 'POL'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{ev.customerName}</div>
                    <div className="text-[11px] text-slate-500">{ev.title} • Date: {formatDateIST(ev.date)}</div>
                  </div>
                </div>
                <button className="text-xs font-semibold text-blue-600 hover:underline">
                  Open Client Record →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
