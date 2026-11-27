import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Clock, Menu, Plus, LogOut, FlaskConical } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../ui/Avatar';
import { NADIA_AVATAR } from './Sidebar';

interface TopNavProps {
  onOpenMobileNav: () => void;
}

export function TopNav({ onOpenMobileNav }: TopNavProps) {
  const {
    settings,
    authUser,
    logout,
    totalUnreadMessages,
    unreadPortalNotificationsCount,
    portalOverview,
    analytics,
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

  const role = authUser?.role ?? 'ADMIN';
  const isPatient = role === 'PATIENT';
  const isLabTech = role === 'LAB_TECHNICIAN';

  const alertCount = isPatient
    ? unreadPortalNotificationsCount
    : (totalUnreadMessages > 0 ? 1 : 0) +
      ((analytics?.waitingCount ?? 0) > 0 ? 1 : 0) +
      ((analytics?.pendingLabOrders ?? 0) + (analytics?.underReviewLabOrders ?? 0) > 0
        ? 1
        : 0);

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
          {isPatient ? ' · Patient Portal' : isLabTech ? ' · Laboratory' : ''}
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

      {/* Right: Alerts Popover, User Profile, Sign Out, New Action */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label={isPatient ? 'Patient notifications' : 'Clinic alerts'}
            className="relative w-10 h-10 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] flex items-center justify-center text-[#172B27] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#20B875] ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#E2EAE5] shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#E2EAE5]">
                <span className="text-sm font-semibold text-[#172B27]">
                  {isPatient ? 'Portal Notifications' : 'Live clinic summary'}
                </span>
              </div>
              {isPatient ? (
                <div className="divide-y divide-[#E2EAE5]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute('portal_notifications');
                      setNotifOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[#172B27]">
                      {unreadPortalNotificationsCount} unread notifications
                    </p>
                    <p className="text-xs text-[#84938D] mt-0.5">
                      Open inbox for clinic announcements & lab alerts
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute('portal_labs');
                      setNotifOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[#172B27]">
                      {portalOverview?.releasedReports.length ?? 0} released lab reports
                    </p>
                    <p className="text-xs text-[#84938D] mt-0.5">
                      View laboratory status and download PDF reports
                    </p>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2EAE5]">
                  {!isLabTech && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoute('dashboard');
                        setNotifOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-[#172B27]">
                        {analytics?.waitingCount ?? 0} patients in waiting room
                      </p>
                      <p className="text-xs text-[#84938D] mt-0.5">
                        {analytics?.inConsultationCount ?? 0} active consultations · View patient flow
                      </p>
                    </button>
                  )}
                  {(role === 'ADMIN' || role === 'DOCTOR' || isLabTech) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoute('laboratory');
                        setNotifOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-[#172B27]">
                        {analytics?.pendingLabOrders ?? 0} active lab orders ·{' '}
                        {analytics?.underReviewLabOrders ?? 0} under review
                      </p>
                      <p className="text-xs text-[#84938D] mt-0.5">
                        Open laboratory diagnostic queue
                      </p>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute('inbox');
                      setNotifOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[#172B27]">
                      {totalUnreadMessages} unread internal messages
                    </p>
                    <p className="text-xs text-[#84938D] mt-0.5">
                      Open internal clinic messaging inbox
                    </p>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActiveRoute(isPatient ? 'portal_profile' : 'settings')}
          title={`${authUser?.name ?? 'User'} · ${role.replace(/_/g, ' ')}`}
          className="hidden sm:flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-[#F3F7F4] transition-colors cursor-pointer"
        >
          <Avatar
            name={authUser?.name ?? 'Staff'}
            src={authUser?.name?.toLowerCase().includes('nadia') ? NADIA_AVATAR : undefined}
            size="sm"
          />
          <div className="hidden md:block text-left leading-tight">
            <p className="text-xs font-semibold text-[#172B27]">
              {authUser?.name ?? 'Staff'}
            </p>
            <p className="text-[11px] text-[#84938D]">{role.replace(/_/g, ' ')}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="hidden sm:flex w-9 h-9 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] items-center justify-center text-[#84938D] hover:text-[#172B27] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {isPatient ? (
          <button
            type="button"
            onClick={() => setActiveRoute('portal_appointments')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Book appointment</span>
          </button>
        ) : isLabTech ? (
          <button
            type="button"
            onClick={() => setActiveRoute('laboratory')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Lab Queue</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAppointmentModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New appointment</span>
          </button>
        )}
      </div>
    </header>
  );
}

