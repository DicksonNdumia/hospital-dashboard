import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Clock, Menu, Plus, CheckCheck } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../ui/Avatar';
import { NADIA_AVATAR } from './Sidebar';

interface TopNavProps {
  onOpenMobileNav: () => void;
}

export function TopNav({ onOpenMobileNav }: TopNavProps) {
  const {
    settings,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveRoute,
    openAppointmentModal,
  } = useClinic();

  const [now, setNow] = useState(() => new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  return (
    <header className="h-16 shrink-0 bg-white border-b border-[#E2EAE5] px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
      {/* Left: Mobile toggle + Clinic Name + Live Time */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-xl text-[#172B27] hover:bg-[#EAF4EF] transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="font-display font-semibold text-sm sm:text-base text-[#172B27] tracking-tight whitespace-nowrap truncate">
          {settings.clinicName}
        </span>

        <span className="hidden sm:inline-block h-4 w-px bg-[#E2EAE5]" aria-hidden="true" />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#84938D] tabular-nums whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#0B6657]" />
          <span className="font-mono font-medium text-[#172B27]">
            {format(now, 'HH:mm')}
          </span>
          <span className="hidden md:inline text-[#84938D]">
            · {format(now, 'EEE, d MMM')}
          </span>
        </div>
      </div>

      {/* Right: Notification Bell, User Avatar, Primary New Action */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] flex items-center justify-center text-[#172B27] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#20B875] ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#E2EAE5] shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2EAE5]">
                <span className="text-sm font-semibold text-[#172B27]">
                  Clinic notifications
                </span>
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0B6657] hover:text-[#073C35] cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#E2EAE5]">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.route) setActiveRoute(n.route);
                      setNotifOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors flex items-start gap-3 cursor-pointer ${
                      n.read ? 'opacity-70' : 'bg-[#EAF4EF]/35'
                    }`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.read ? 'bg-[#E2EAE5]' : 'bg-[#20B875]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#172B27] leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-[#84938D] mt-0.5 line-clamp-2">
                        {n.detail}
                      </p>
                      <p className="text-[11px] text-[#84938D] mt-1 tabular-nums">
                        {n.time}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <button
          type="button"
          onClick={() => setActiveRoute('settings')}
          title="Nadia · Clinic Coordinator"
          className="hidden sm:flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-[#F3F7F4] transition-colors cursor-pointer"
        >
          <Avatar name="Nadia" src={NADIA_AVATAR} size="sm" />
          <div className="hidden md:block text-left leading-tight">
            <p className="text-xs font-semibold text-[#172B27]">Nadia</p>
            <p className="text-[11px] text-[#84938D]">Coordinator</p>
          </div>
        </button>

        {/* Primary New Action Button */}
        <button
          type="button"
          onClick={() => openAppointmentModal({ mode: 'create' })}
          className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New appointment</span>
        </button>
      </div>
    </header>
  );
}
