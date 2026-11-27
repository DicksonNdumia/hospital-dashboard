import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  ClipboardList,
  CalendarDays,
  Megaphone,
  BarChart3,
  Settings,
  HeartPulse,
  FlaskConical,
  FileText,
  Bell,
  UserCircle,
  X,
  LogOut,
} from 'lucide-react';
import { NavRoute, StaffRole } from '../../types/clinic';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../ui/Avatar';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CLINICAL_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: ClipboardList },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const LAB_TECH_NAV: NavItem[] = [
  { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PATIENT_NAV: NavItem[] = [
  { id: 'portal_dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'portal_appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'portal_labs', label: 'Lab Reports', icon: FileText },
  { id: 'portal_notifications', label: 'Notifications', icon: Bell },
  { id: 'portal_profile', label: 'My Profile', icon: UserCircle },
];

function getNavForRole(role: StaffRole): NavItem[] {
  if (role === 'PATIENT') return PATIENT_NAV;
  if (role === 'LAB_TECHNICIAN') return LAB_TECH_NAV;
  if (role === 'RECEPTIONIST') {
    return CLINICAL_NAV.filter((i) => i.id !== 'campaigns' && i.id !== 'laboratory');
  }
  if (role === 'DOCTOR') {
    return CLINICAL_NAV.filter((i) => i.id !== 'campaigns');
  }
  return CLINICAL_NAV;
}

export const NADIA_AVATAR = '/src/assets/images/avatar_nadia_admin_1795723058520.jpg';

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const {
    activeRoute,
    setActiveRoute,
    totalUnreadMessages,
    unreadPortalNotificationsCount,
    authUser,
    logout,
  } = useClinic();

  const userName = authUser?.name ?? 'Staff';
  const userRole: StaffRole = authUser?.role ?? 'ADMIN';
  const navItems = useMemo(() => getNavForRole(userRole), [userRole]);

  const homeRoute: NavRoute =
    userRole === 'PATIENT'
      ? 'portal_dashboard'
      : userRole === 'LAB_TECHNICIAN'
      ? 'laboratory'
      : 'dashboard';

  const profileRoute: NavRoute =
    userRole === 'PATIENT' ? 'portal_profile' : 'settings';

  const handleNav = (id: NavRoute) => {
    setActiveRoute(id);
    onCloseMobile();
  };

  const getBadgeCount = (id: NavRoute) => {
    if (id === 'inbox') return totalUnreadMessages;
    if (id === 'portal_notifications') return unreadPortalNotificationsCount;
    return 0;
  };

  return (
    <>
      {/* Desktop Narrow Icon Rail */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex flex-col items-center justify-between w-[72px] shrink-0 bg-[#073C35] text-white py-4 select-none border-r border-[#0B6657]/40 z-30"
      >
        <div className="flex flex-col items-center gap-6 w-full">
          <button
            type="button"
            onClick={() => handleNav(homeRoute)}
            title="Northfield Family Clinic"
            className="w-10 h-10 rounded-xl bg-[#0B6657] hover:bg-[#20B875] flex items-center justify-center transition-colors shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20B875]"
          >
            <HeartPulse className="w-5 h-5 text-white" />
          </button>

          <nav className="flex flex-col items-center gap-1.5 w-full px-2.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.id;
              const badgeCount = getBadgeCount(item.id);
              const showBadge = badgeCount > 0;

              return (
                <div key={item.id} className="relative group w-full flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleNav(item.id)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20B875] ${
                      isActive
                        ? 'bg-[#0B6657] text-white shadow-sm'
                        : 'text-[#9DBCB3] hover:bg-[#0B6657]/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-[19px] h-[19px]" />
                    {isActive && (
                      <span className="absolute -left-2.5 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#20B875]" />
                    )}
                    {showBadge && (
                      <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#20B875] text-[#073C35] text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                        {badgeCount}
                      </span>
                    )}
                  </button>

                  <div
                    role="tooltip"
                    className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#172B27] text-white text-xs font-medium whitespace-nowrap shadow-md z-50"
                  >
                    {item.label}
                    {showBadge ? ` (${badgeCount})` : ''}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile & Logout */}
        <div className="flex flex-col items-center gap-2 w-full px-2.5">
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={() => handleNav(profileRoute)}
              aria-label={`${userName} — ${userRole}`}
              className="rounded-full p-0.5 ring-2 ring-[#0B6657] hover:ring-[#20B875] transition-all cursor-pointer"
            >
              <Avatar
                name={userName}
                src={userName.toLowerCase().includes('nadia') ? NADIA_AVATAR : undefined}
                size="sm"
              />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#172B27] text-white text-xs font-medium whitespace-nowrap shadow-md z-50"
            >
              {userName} · {userRole.replace(/_/g, ' ')}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="w-9 h-9 rounded-xl text-[#9DBCB3] hover:text-white hover:bg-[#0B6657]/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile / Tablet Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-[#073C35]/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[82vw] h-full bg-[#073C35] text-white flex flex-col justify-between p-4 shadow-2xl z-10">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#0B6657]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0B6657] flex items-center justify-center">
                    <HeartPulse className="w-5 h-5 text-[#20B875]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      Northfield Clinic
                    </p>
                    <p className="text-[11px] text-[#9DBCB3]">
                      {userRole.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-[#9DBCB3] hover:text-white hover:bg-[#0B6657] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeRoute === item.id;
                  const badgeCount = getBadgeCount(item.id);
                  const showBadge = badgeCount > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#0B6657] text-white'
                          : 'text-[#B5CFC7] hover:bg-[#0B6657]/50 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {showBadge && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#20B875] text-[#073C35] text-[11px] font-bold tabular-nums">
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#0B6657] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleNav(profileRoute)}
                className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
              >
                <Avatar
                  name={userName}
                  src={userName.toLowerCase().includes('nadia') ? NADIA_AVATAR : undefined}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {userName}
                  </p>
                  <p className="text-[11px] text-[#9DBCB3] truncate">
                    {userRole.replace(/_/g, ' ')}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="p-2 rounded-lg text-[#9DBCB3] hover:text-white hover:bg-[#0B6657] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

