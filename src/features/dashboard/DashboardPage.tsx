import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  BellRing,
  CalendarPlus,
  Clock,
  MessageSquare,
  Search,
  UserCheck,
  UserX,
  ArrowRight,
  CheckCircle2,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Appointment, FlowStatus } from '../../types/clinic';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';

const FLOW_COLUMNS: {
  key: FlowStatus;
  title: string;
  subtitle: string;
  emptyText: string;
}[] = [
  {
    key: 'EXPECTED',
    title: 'Expected',
    subtitle: 'Scheduled arrivals',
    emptyText: 'All scheduled patients have arrived.',
  },
  {
    key: 'WAITING',
    title: 'Waiting room',
    subtitle: 'Checked in at desk',
    emptyText: 'No patients currently waiting.',
  },
  {
    key: 'IN_CONSULTATION',
    title: 'In consultation',
    subtitle: 'With provider now',
    emptyText: 'No consultations active right now.',
  },
  {
    key: 'SEEN',
    title: 'Seen',
    subtitle: 'Completed today',
    emptyText: 'Completed visits will appear here.',
  },
];

export function DashboardPage() {
  const {
    authUser,
    appointments,
    doctors,
    analytics,
    totalUnreadMessages,
    getPatientById,
    getDoctorById,
    openAppointmentModal,
    remindAllExpectedToday,
    remindSingleAppointment,
    transitionVisitFlow,
    updateAppointmentStatus,
    setActiveRoute,
    openConversationForPatient,
    setProfilePatientId,
  } = useClinic();

  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [completeModalApt, setCompleteModalApt] = useState<Appointment | null>(
    null
  );
  const [diagnosisDraft, setDiagnosisDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayFormatted = format(new Date(), 'EEEE, d MMMM yyyy');

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.date === todayStr &&
            a.status !== 'CANCELLED' &&
            a.status !== 'NO_SHOW'
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, todayStr]
  );

  // Live metrics from database /api/analytics
  const totalToday = analytics?.totalAppointmentsToday ?? todayAppointments.length;
  const seenToday =
    analytics?.completedAppointmentsToday ??
    todayAppointments.filter((a) => a.visit?.flowStatus === 'SEEN').length;
  const completionPct =
    totalToday > 0 ? Math.round((seenToday / totalToday) * 100) : 0;
  const waitingCount = analytics?.waitingCount ?? 0;
  const noShowRate = (analytics?.noShowRate ?? 0).toFixed(1);
  const noShowCount = analytics?.noShowCountToday ?? 0;
  const avgWaitMinutes = analytics?.averageWaitMinutes ?? 0;

  const expectedCount = todayAppointments.filter(
    (a) => (a.visit?.flowStatus ?? 'EXPECTED') === 'EXPECTED'
  ).length;

  const filteredToday = useMemo(() => {
    return todayAppointments.filter((apt) => {
      if (doctorFilter !== 'all' && apt.doctorId !== doctorFilter) return false;
      if (searchQuery.trim()) {
        const patient = getPatientById(apt.patientId);
        const doctor = getDoctorById(apt.doctorId);
        const q = searchQuery.toLowerCase();
        const match =
          patient?.name.toLowerCase().includes(q) ||
          doctor?.name.toLowerCase().includes(q) ||
          apt.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [todayAppointments, doctorFilter, searchQuery, getPatientById, getDoctorById]);

  const canCheckIn =
    authUser?.role === 'ADMIN' || authUser?.role === 'RECEPTIONIST';
  const canConsult = authUser?.role === 'ADMIN' || authUser?.role === 'DOCTOR';

  const openCompleteConsultation = (apt: Appointment) => {
    setDiagnosisDraft(apt.consultation?.diagnosis ?? '');
    setNotesDraft(apt.consultation?.clinicalNotes ?? '');
    setFollowUpDraft(apt.consultation?.followUpPlan ?? '');
    setCompleteModalApt(apt);
  };

  const renderFlowAction = (apt: Appointment, flowStatus: FlowStatus) => {
    switch (flowStatus) {
      case 'EXPECTED':
        return (
          <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 border-t border-[#E2EAE5]">
            {canCheckIn ? (
              <>
                <button
                  type="button"
                  onClick={() => transitionVisitFlow(apt.id, 'WAITING')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Check in
                </button>
                <button
                  type="button"
                  onClick={() => remindSingleAppointment(apt.id)}
                  title="Log visit reminder"
                  className="px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[#0B6657] text-xs font-medium transition-colors cursor-pointer"
                >
                  Remind
                </button>
                <button
                  type="button"
                  onClick={() => updateAppointmentStatus(apt.id, 'NO_SHOW')}
                  title="Mark as no-show"
                  aria-label="Mark as no-show"
                  className="p-1.5 rounded-lg border border-[#E2EAE5] hover:bg-red-50 hover:text-red-700 text-[#84938D] transition-colors cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <span className="text-[11px] text-[#84938D]">
                Awaiting front desk check-in
              </span>
            )}
          </div>
        );

      case 'WAITING':
        return (
          <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 border-t border-[#E2EAE5]">
            {canConsult ? (
              <button
                type="button"
                onClick={() => transitionVisitFlow(apt.id, 'IN_CONSULTATION')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B6657] hover:bg-[#073C35] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Call patient
              </button>
            ) : (
              <span className="flex-1 text-[11px] text-[#0B6657] font-medium">
                Ready for provider
              </span>
            )}
            <button
              type="button"
              onClick={() => openConversationForPatient(apt.patientId)}
              title="Open internal care thread"
              aria-label="Open internal care thread"
              className="p-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[#0B6657] transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'IN_CONSULTATION':
        return (
          <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 border-t border-[#E2EAE5]">
            {canConsult ? (
              <button
                type="button"
                onClick={() => openCompleteConsultation(apt)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#20B875] hover:bg-[#199e63] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark as seen
              </button>
            ) : (
              <span className="flex-1 text-[11px] text-[#0B6657] font-medium">
                Consultation in progress
              </span>
            )}
            <button
              type="button"
              onClick={() => openAppointmentModal({ mode: 'edit', appointment: apt })}
              className="px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] text-xs font-medium transition-colors cursor-pointer"
            >
              Edit
            </button>
          </div>
        );

      case 'SEEN':
        return (
          <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-[#E2EAE5]">
            <button
              type="button"
              onClick={() => setProfilePatientId(apt.patientId)}
              className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
            >
              View summary
            </button>
            <button
              type="button"
              onClick={() =>
                openAppointmentModal({
                  mode: 'create',
                  defaultPatientId: apt.patientId,
                  defaultDoctorId: apt.doctorId,
                })
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-[#84938D] hover:text-[#172B27] cursor-pointer"
            >
              Follow-up
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        );
    }
  };

  const firstName = (authUser?.name ?? 'Dickson').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#172B27] tracking-tight">
            Good morning, {firstName}
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D] mt-0.5">
            {todayFormatted} · Northfield Family Clinic ({authUser?.role ?? 'STAFF'})
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canCheckIn && (
            <button
              type="button"
              onClick={remindAllExpectedToday}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] text-[#073C35] text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <BellRing className="w-4 h-4 text-[#0B6657]" />
              <span>Remind all ({expectedCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openAppointmentModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>New appointment</span>
          </button>
        </div>
      </section>

      {/* Four Compact Metric Cards (Computed from DB /api/analytics) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">Appointments</span>
            <span className="w-8 h-8 rounded-xl bg-[#EAF4EF] text-[#0B6657] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold text-[#172B27] tabular-nums">
              {totalToday}
            </p>
            <p className="text-xs font-medium text-[#0B6657] tabular-nums">
              {seenToday} seen · {completionPct}%
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#EAF4EF] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#20B875] transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">
              In the waiting room
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#EAF4EF] text-[#0B6657] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold text-[#172B27] tabular-nums">
              {waitingCount}
            </p>
            <p className="text-xs text-[#84938D]">
              {waitingCount === 1 ? 'Patient ready' : 'Patients ready'}
            </p>
          </div>
          <p className="mt-3 text-xs text-[#84938D]">
            Avg wait time ·{' '}
            <span className="text-[#172B27] font-medium tabular-nums">
              {avgWaitMinutes} min
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveRoute('inbox')}
          className="text-left bg-white rounded-2xl border border-[#E2EAE5] hover:border-[#0B6657]/40 p-4 sm:p-5 shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">
              Unread staff messages
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#EAF4EF] text-[#20B875] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold text-[#172B27] tabular-nums">
              {totalUnreadMessages}
            </p>
            <span className="text-xs font-medium text-[#0B6657]">
              Open inbox →
            </span>
          </div>
          <p className="mt-3 text-xs text-[#84938D]">
            Internal care coordination threads
          </p>
        </button>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">No-show rate</span>
            <span className="w-8 h-8 rounded-xl bg-[#F3F7F4] text-[#84938D] flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold text-[#172B27] tabular-nums">
              {noShowRate}%
            </p>
            <p className="text-xs text-[#84938D] tabular-nums">
              {noShowCount} missed today
            </p>
          </div>
          <p className="mt-3 text-xs text-[#84938D]">
            Active panel ·{' '}
            <span className="text-[#0B6657] font-medium tabular-nums">
              {analytics?.totalRegisteredPatients ?? 0} patients
            </span>
          </p>
        </div>
      </section>

      {/* Patient Flow Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#172B27]">
              Today’s patient flow
            </h2>
            <p className="text-xs text-[#84938D]">
              EXPECTED → WAITING → IN CONSULTATION → SEEN (role-enforced workflow)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter patient or visit..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E2EAE5] bg-white text-xs text-[#172B27] placeholder:text-[#84938D] focus:outline-none focus:border-[#0B6657] w-48"
              />
            </div>

            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              aria-label="Filter patient flow by doctor"
              className="px-3 py-1.5 rounded-xl border border-[#E2EAE5] bg-white text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              <option value="all">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Flow Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {FLOW_COLUMNS.map((col) => {
            const colItems = filteredToday.filter(
              (a) => (a.visit?.flowStatus ?? 'EXPECTED') === col.key
            );

            return (
              <div
                key={col.key}
                className="bg-white/70 rounded-2xl border border-[#E2EAE5] p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-sm font-semibold text-[#172B27]">
                      {col.title}
                    </h3>
                    <p className="text-[11px] text-[#84938D]">{col.subtitle}</p>
                  </div>
                  <span className="w-6 h-6 rounded-lg bg-[#EAF4EF] text-[#073C35] text-xs font-semibold flex items-center justify-center tabular-nums">
                    {colItems.length}
                  </span>
                </div>

                {colItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E2EAE5] bg-white/60 py-8 px-4 text-center">
                    <p className="text-xs text-[#84938D]">{col.emptyText}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {colItems.map((apt) => {
                      const patient = getPatientById(apt.patientId);
                      const doctor = getDoctorById(apt.doctorId);
                      if (!patient) return null;

                      const checkedTime = apt.visit?.checkedInAt
                        ? format(new Date(apt.visit.checkedInAt), 'HH:mm')
                        : null;

                      const statusLabel =
                        col.key === 'EXPECTED'
                          ? apt.remindedAt
                            ? `Reminded · ${apt.remindedAt}`
                            : apt.status
                          : col.key === 'WAITING'
                          ? checkedTime
                            ? `Checked in ${checkedTime}`
                            : 'Checked in'
                          : col.key === 'IN_CONSULTATION'
                          ? `${doctor?.room ?? 'In room'}`
                          : apt.visit?.waitingMinutes != null
                          ? `Wait ${apt.visit.waitingMinutes}m · Done`
                          : 'Completed';

                      return (
                        <article
                          key={apt.id}
                          className="bg-white rounded-xl border border-[#E2EAE5] p-3.5 shadow-2xs hover:border-[#0B6657]/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setProfilePatientId(patient.id)}
                              className="flex items-center gap-2.5 text-left min-w-0 group cursor-pointer"
                            >
                              <Avatar
                                name={patient.name}
                                bgColor={patient.avatarColor}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#172B27] group-hover:text-[#0B6657] truncate transition-colors">
                                  {patient.name}
                                </p>
                                <p className="text-xs text-[#84938D] truncate">
                                  {apt.category}
                                </p>
                              </div>
                            </button>

                            <span className="font-mono text-xs font-semibold text-[#073C35] bg-[#EAF4EF] px-2 py-0.5 rounded-md tabular-nums shrink-0">
                              {apt.time}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-xs text-[#84938D]">
                            <span className="truncate">{doctor?.name ?? 'Provider'}</span>
                            <span className="shrink-0 text-[11px] text-[#0B6657] font-medium tabular-nums">
                              {statusLabel}
                            </span>
                          </div>

                          {renderFlowAction(apt, col.key)}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Consultation Completion Modal */}
      <Modal
        open={Boolean(completeModalApt)}
        onClose={() => setCompleteModalApt(null)}
        title="Complete consultation"
        subtitle={
          completeModalApt
            ? `${getPatientById(completeModalApt.patientId)?.name ?? 'Patient'} · Record visit summary`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Diagnosis / assessment
            </label>
            <input
              type="text"
              value={diagnosisDraft}
              onChange={(e) => setDiagnosisDraft(e.target.value)}
              placeholder="e.g. Routine wellness evaluation, BP stable"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Clinical notes
            </label>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Examination findings, prescriptions, or instructions..."
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Follow-up plan
            </label>
            <input
              type="text"
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              placeholder="e.g. Return in 3 months for lipid re-check"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2EAE5]">
            <button
              type="button"
              onClick={() => setCompleteModalApt(null)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!completeModalApt) return;
                await transitionVisitFlow(completeModalApt.id, 'SEEN', {
                  diagnosis: diagnosisDraft,
                  clinicalNotes: notesDraft,
                  followUpPlan: followUpDraft,
                });
                setCompleteModalApt(null);
              }}
              className="px-4 py-2 rounded-xl bg-[#20B875] hover:bg-[#199e63] text-white text-xs font-medium cursor-pointer"
            >
              Mark as seen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
