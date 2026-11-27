import { useState } from 'react';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { ToastContainer } from './components/ui/ToastContainer';
import { AppointmentModal } from './components/modals/AppointmentModal';
import { PatientModal } from './components/modals/PatientModal';
import { PatientProfileDrawer } from './components/modals/PatientProfileDrawer';
import { AuthScreen } from './features/auth/AuthScreen';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { InboxPage } from './features/inbox/InboxPage';
import { PatientsPage } from './features/patients/PatientsPage';
import { AppointmentsPage } from './features/appointments/AppointmentsPage';
import { SchedulePage } from './features/schedule/SchedulePage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { LaboratoryPage } from './features/laboratory/LaboratoryPage';
import { PatientPortalPage } from './features/portal/PatientPortalPages';

function ClinicShell() {
  const { authStatus, authUser, activeRoute } = useClinic();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F3F7F4] flex items-center justify-center text-sm text-[#84938D]">
        Loading Northfield Family Clinic...
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  const role = authUser?.role ?? 'ADMIN';
  const isPatient = role === 'PATIENT';
  const isLabTech = role === 'LAB_TECHNICIAN';
  const isClinicalStaff =
    role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'DOCTOR';

  const renderPage = () => {
    if (isPatient) {
      return <PatientPortalPage />;
    }

    if (isLabTech) {
      if (activeRoute === 'inbox') return <InboxPage />;
      if (activeRoute === 'settings') return <SettingsPage />;
      return <LaboratoryPage />;
    }

    switch (activeRoute) {
      case 'dashboard':
        return <DashboardPage />;
      case 'inbox':
        return <InboxPage />;
      case 'patients':
        return <PatientsPage />;
      case 'appointments':
        return <AppointmentsPage />;
      case 'schedule':
        return <SchedulePage />;
      case 'laboratory':
        return role === 'ADMIN' || role === 'DOCTOR' ? (
          <LaboratoryPage />
        ) : (
          <DashboardPage />
        );
      case 'campaigns':
        return role === 'ADMIN' ? <CampaignsPage /> : <DashboardPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen h-screen flex bg-[#F3F7F4] text-[#172B27] overflow-hidden">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopNav onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1440px] mx-auto">{renderPage()}</div>
        </main>
      </div>

      {isClinicalStaff && (
        <>
          <AppointmentModal />
          <PatientModal />
          <PatientProfileDrawer />
        </>
      )}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ClinicProvider>
      <ClinicShell />
    </ClinicProvider>
  );
}
