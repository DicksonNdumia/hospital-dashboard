import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarDays,
  FileText,
  Bell,
  UserCircle,
  Download,
  Clock,
  FlaskConical,
  CheckCheck,
  CalendarPlus,
  XCircle,
  Save,
  Eye,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import {
  Appointment,
  LabOrderStatus,
  PatientNotification,
} from '../../types/clinic';
import { Modal } from '../../components/ui/Modal';

const LAB_STATUS_LABELS: Record<LabOrderStatus, string> = {
  REQUESTED: 'Requested',
  SAMPLE_COLLECTED: 'Sample Collected',
  PROCESSING: 'Processing',
  COMPLETED: 'Analysis Complete',
  UNDER_REVIEW: 'Doctor Review',
  APPROVED: 'Approved',
  RELEASED: 'Released',
};

export function PatientPortalPage() {
  const {
    activeRoute,
    setActiveRoute,
    portalOverview,
    portalBookingOptions,
    fetchAvailableSlots,
    bookPortalAppointment,
    updatePortalAppointment,
    updatePortalProfile,
    markNotificationRead,
    markAllNotificationsRead,
    downloadLabReport,
  } = useClinic();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Booking state
  const [service, setService] = useState('General Consultation');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [slotReason, setSlotReason] = useState<string | undefined>();
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
    null
  );
  const [reschedDate, setReschedDate] = useState(todayStr);
  const [reschedSlots, setReschedSlots] = useState<string[]>([]);
  const [reschedSlotReason, setReschedSlotReason] = useState<string | undefined>();
  const [reschedTime, setReschedTime] = useState('');

  // Notifications state
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [detailNotification, setDetailNotification] =
    useState<PatientNotification | null>(null);

  // Profile edit state
  const [phoneDraft, setPhoneDraft] = useState('');
  const [insuranceDraft, setInsuranceDraft] = useState('');
  const [memberIdDraft, setMemberIdDraft] = useState('');
  const [prefAppt, setPrefAppt] = useState(true);
  const [prefLab, setPrefLab] = useState(true);
  const [prefCampaign, setPrefCampaign] = useState(true);

  useEffect(() => {
    if (portalBookingOptions?.services.length) {
      setService((prev) =>
        portalBookingOptions.services.includes(prev)
          ? prev
          : portalBookingOptions.services[0]
      );
    }
    if (portalBookingOptions?.doctors.length) {
      setDoctorId((prev) =>
        prev && portalBookingOptions.doctors.some((d) => d.id === prev)
          ? prev
          : portalBookingOptions.doctors[0].id
      );
    }
  }, [portalBookingOptions]);

  useEffect(() => {
    if (portalOverview) {
      setPhoneDraft(portalOverview.patient.phone);
      setInsuranceDraft(portalOverview.patient.insuranceProvider);
      setMemberIdDraft(portalOverview.patient.memberId);
      setPrefAppt(portalOverview.notificationPreference.appointmentUpdates);
      setPrefLab(portalOverview.notificationPreference.labReportAlerts);
      setPrefCampaign(portalOverview.notificationPreference.campaignAnnouncements);
    }
  }, [portalOverview]);

  useEffect(() => {
    if (!doctorId || !date || activeRoute !== 'portal_appointments') return;
    let active = true;
    setLoadingSlots(true);
    setSelectedTime('');
    fetchAvailableSlots({ doctorId, date })
      .then((res) => {
        if (!active) return;
        setSlots(res.availableSlots);
        setSlotReason(res.reason);
      })
      .catch(() => {
        if (active) {
          setSlots([]);
          setSlotReason('Unable to load available time slots.');
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [doctorId, date, activeRoute, fetchAvailableSlots]);

  useEffect(() => {
    if (!rescheduleTarget || !reschedDate) return;
    let active = true;
    setReschedTime('');
    fetchAvailableSlots({
      doctorId: rescheduleTarget.doctorId,
      date: reschedDate,
    })
      .then((res) => {
        if (!active) return;
        setReschedSlots(res.availableSlots);
        setReschedSlotReason(res.reason);
      })
      .catch(() => {
        if (active) setReschedSlots([]);
      });
    return () => {
      active = false;
    };
  }, [rescheduleTarget, reschedDate, fetchAvailableSlots]);

  const upcomingAppointments = useMemo(
    () =>
      (portalOverview?.appointments ?? [])
        .filter(
          (a) =>
            a.date >= todayStr &&
            a.status !== 'CANCELLED' &&
            a.status !== 'COMPLETED'
        )
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [portalOverview, todayStr]
  );

  const pastAppointments = useMemo(
    () =>
      (portalOverview?.appointments ?? []).filter(
        (a) =>
          a.date < todayStr ||
          a.status === 'CANCELLED' ||
          a.status === 'COMPLETED'
      ),
    [portalOverview, todayStr]
  );

  const pendingLabs = useMemo(
    () =>
      (portalOverview?.labOrders ?? []).filter((o) => o.status !== 'RELEASED'),
    [portalOverview]
  );

  const unreadNotifications = useMemo(
    () => (portalOverview?.notifications ?? []).filter((n) => !n.isRead),
    [portalOverview]
  );

  if (!portalOverview) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-8 text-center text-sm text-[#84938D]">
        Loading your patient portal...
      </div>
    );
  }

  const { patient, releasedReports, notifications, labOrders } = portalOverview;

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId || !selectedTime) return;
    setSubmittingBooking(true);
    try {
      await bookPortalAppointment({
        doctorId,
        date,
        time: selectedTime,
        category: service,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      setSelectedTime('');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // 1. PORTAL DASHBOARD
  if (activeRoute === 'portal_dashboard') {
    return (
      <div className="space-y-6">
        <div className="bg-[#073C35] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#9DBCB3]">Patient Self-Service Portal</p>
            <h1 className="text-xl sm:text-2xl font-semibold mt-1">
              Welcome back, {patient.name}
            </h1>
            <p className="text-xs text-[#B5CFC7] mt-1">
              Primary provider:{' '}
              {patient.assignedDoctor
                ? `${patient.assignedDoctor.name} (${patient.assignedDoctor.specialty})`
                : 'Select any available clinic doctor when booking'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveRoute('portal_appointments')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#20B875] hover:bg-[#19a466] text-[#073C35] text-xs sm:text-sm font-semibold self-start sm:self-auto cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            Book appointment
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveRoute('portal_appointments')}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-4 text-left hover:border-[#0B6657] transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-[#84938D]">Upcoming Visits</p>
            <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
              {upcomingAppointments.length}
            </p>
            <p className="text-xs text-[#0B6657] mt-1">Manage or reschedule</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoute('portal_labs')}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-4 text-left hover:border-[#0B6657] transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-[#84938D]">Pending Lab Tests</p>
            <p className="text-2xl font-semibold text-amber-700 mt-2 tabular-nums">
              {pendingLabs.length}
            </p>
            <p className="text-xs text-[#84938D] mt-1">In lab workflow</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoute('portal_labs')}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-4 text-left hover:border-[#0B6657] transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-[#84938D]">Available Reports</p>
            <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
              {releasedReports.length}
            </p>
            <p className="text-xs text-[#84938D] mt-1">Ready for PDF download</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoute('portal_notifications')}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-4 text-left hover:border-[#0B6657] transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-[#84938D]">Unread Alerts</p>
            <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
              {unreadNotifications.length}
            </p>
            <p className="text-xs text-[#84938D] mt-1">Clinic & lab notifications</p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming & Recent Appointments */}
          <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#172B27]">
                Upcoming Appointments
              </h2>
              <button
                type="button"
                onClick={() => setActiveRoute('portal_appointments')}
                className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>
            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-[#84938D] py-6 text-center border border-dashed border-[#E2EAE5] rounded-xl">
                No upcoming appointments scheduled.
              </p>
            ) : (
              <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                {upcomingAppointments.slice(0, 4).map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#172B27] tabular-nums">
                        {apt.date} at {apt.time} · {apt.category}
                      </p>
                      <p className="text-[#84938D] mt-0.5">
                        {apt.doctor?.name ?? 'Clinic Doctor'} · {apt.doctor?.room ?? ''}
                      </p>
                    </div>
                    <span className="font-semibold text-[#0B6657]">{apt.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Lab Reports & Notifications */}
          <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#172B27]">
                Available Laboratory Reports
              </h2>
              <button
                type="button"
                onClick={() => setActiveRoute('portal_labs')}
                className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
              >
                All lab tests
              </button>
            </div>
            {releasedReports.length === 0 ? (
              <p className="text-xs text-[#84938D] py-6 text-center border border-dashed border-[#E2EAE5] rounded-xl">
                No released lab reports available yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                {releasedReports.slice(0, 4).map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#172B27] truncate">
                        {rep.testName} ({rep.testCode})
                      </p>
                      <p className="text-[#84938D] tabular-nums mt-0.5">
                        {rep.orderNumber} · {rep.doctorName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadLabReport(rep.id, rep.originalFileName)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EAF4EF] hover:bg-[#D7EBE0] text-[#073C35] font-medium cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. PATIENT APPOINTMENT BOOKING & HISTORY
  if (activeRoute === 'portal_appointments') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">
            Book & Manage Appointments
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Select a clinic service, doctor, date, and open time slot
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Self-Service Booking Form */}
          <form
            onSubmit={handleBookAppointment}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#172B27]">
                New Appointment Request
              </h2>
              <span className="text-[11px] font-medium text-[#0B6657]">
                {portalOverview.requirePatientBookingApproval
                  ? 'Requires clinic confirmation'
                  : 'Instant confirmation'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Clinic service
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                {(portalBookingOptions?.services ?? [service]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Preferred doctor
              </label>
              <select
                required
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                <option value="">Select a doctor...</option>
                {(portalBookingOptions?.doctors ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} — {doc.specialty}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Appointment date
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Available time slots
              </label>
              {loadingSlots ? (
                <p className="text-xs text-[#84938D] py-2">Checking schedule...</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-[#84938D] py-2 bg-[#F3F7F4] rounded-xl px-3">
                  {slotReason ?? 'No open slots on this date.'}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer tabular-nums ${
                        selectedTime === slot
                          ? 'bg-[#073C35] text-white border-[#073C35]'
                          : 'bg-white text-[#172B27] border-[#E2EAE5] hover:bg-[#EAF4EF]'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Reason / notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly describe symptoms or questions..."
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={!doctorId || !selectedTime || submittingBooking}
              className="w-full py-2.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-50 text-white text-xs sm:text-sm font-medium cursor-pointer"
            >
              {submittingBooking ? 'Submitting...' : 'Submit appointment booking'}
            </button>
          </form>

          {/* Upcoming & Historical Bookings */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#172B27]">
                Upcoming Appointments ({upcomingAppointments.length})
              </h2>
              {upcomingAppointments.length === 0 ? (
                <p className="text-xs text-[#84938D] py-6 text-center border border-dashed border-[#E2EAE5] rounded-xl">
                  You have no upcoming appointments.
                </p>
              ) : (
                <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                  {upcomingAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5 text-[#0B6657]" />
                          <span className="font-semibold text-[#172B27] tabular-nums">
                            {apt.date} · {apt.time}
                          </span>
                          <span className="font-semibold text-[#0B6657]">
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-[#84938D]">
                          {apt.category} · {apt.doctor?.name ?? 'Doctor'} ({apt.doctor?.room ?? ''})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleTarget(apt);
                            setReschedDate(apt.date);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] font-medium cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updatePortalAppointment(apt.id, { action: 'CANCEL' })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-red-50 text-red-700 font-medium cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#172B27]">
                Appointment History ({pastAppointments.length})
              </h2>
              {pastAppointments.length === 0 ? (
                <p className="text-xs text-[#84938D]">No past appointments yet.</p>
              ) : (
                <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                  {pastAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-medium text-[#172B27] tabular-nums">
                          {apt.date} · {apt.time} — {apt.category}
                        </p>
                        <p className="text-[#84938D]">
                          {apt.doctor?.name ?? 'Clinic Doctor'}
                        </p>
                      </div>
                      <span
                        className={`font-semibold ${
                          apt.status === 'CANCELLED'
                            ? 'text-red-700'
                            : 'text-[#0B6657]'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reschedule Modal */}
        <Modal
          open={Boolean(rescheduleTarget)}
          onClose={() => setRescheduleTarget(null)}
          title="Reschedule appointment"
          subtitle={
            rescheduleTarget
              ? `${rescheduleTarget.category} · ${rescheduleTarget.doctor?.name ?? ''}`
              : undefined
          }
          maxWidthClass="max-w-md"
        >
          {rescheduleTarget && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                  New date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                  Available time slots
                </label>
                {reschedSlots.length === 0 ? (
                  <p className="text-xs text-[#84938D]">
                    {reschedSlotReason ?? 'No open slots on this date.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                    {reschedSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setReschedTime(slot)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-mono border cursor-pointer tabular-nums ${
                          reschedTime === slot
                            ? 'bg-[#073C35] text-white border-[#073C35]'
                            : 'bg-white text-[#172B27] border-[#E2EAE5]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!reschedTime}
                  onClick={async () => {
                    await updatePortalAppointment(rescheduleTarget.id, {
                      action: 'RESCHEDULE',
                      date: reschedDate,
                      time: reschedTime,
                    });
                    setRescheduleTarget(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#073C35] disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                >
                  Confirm new slot
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // 3. PATIENT LAB REPORTS & STATUS TRACKING
  if (activeRoute === 'portal_labs') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">
            Laboratory Tests & Released Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Track pending tests and securely download doctor-approved PDF reports
          </p>
        </div>

        {/* Released PDF Reports */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0B6657]" />
            <h2 className="text-sm font-semibold text-[#172B27]">
              Released PDF Reports ({releasedReports.length})
            </h2>
          </div>

          {releasedReports.length === 0 ? (
            <p className="text-xs text-[#84938D] py-6 text-center border border-dashed border-[#E2EAE5] rounded-xl">
              Released reports will appear here once approved and released by your doctor.
            </p>
          ) : (
            <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
              {releasedReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#172B27]">
                      {rep.title} — {rep.testName} ({rep.testCode})
                    </p>
                    <p className="text-[#84938D] mt-0.5 tabular-nums">
                      Order {rep.orderNumber} · {rep.doctorName} · Released{' '}
                      {rep.releasedAt
                        ? format(new Date(rep.releasedAt), 'MMM d, yyyy HH:mm')
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadLabReport(rep.id, rep.originalFileName)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white font-medium cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Lab Orders (Pending + Released Details) */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Laboratory Test History ({labOrders.length})
          </h2>
          {labOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E2EAE5] p-8 text-center text-xs text-[#84938D]">
              <FlaskConical className="w-6 h-6 mx-auto mb-2 text-[#84938D]" />
              No laboratory tests ordered yet.
            </div>
          ) : (
            labOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-[#0B6657] font-semibold">
                      {order.orderNumber} · {format(new Date(order.createdAt), 'MMM d, yyyy')}
                    </p>
                    <h3 className="text-sm font-semibold text-[#172B27] mt-0.5">
                      {order.labTest.name} ({order.labTest.code})
                    </h3>
                    <p className="text-xs text-[#84938D]">
                      Ordered by {order.doctor.name} ({order.doctor.specialty})
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      order.status === 'RELEASED'
                        ? 'text-[#0B6657]'
                        : 'text-amber-700'
                    }`}
                  >
                    {LAB_STATUS_LABELS[order.status]}
                  </span>
                </div>

                {order.status === 'RELEASED' ? (
                  <div className="space-y-3 pt-2 border-t border-[#E2EAE5]">
                    {order.doctorReviewNotes && (
                      <p className="text-xs bg-[#EAF4EF] text-[#073C35] rounded-xl p-3">
                        <span className="font-semibold">Doctor note: </span>
                        {order.doctorReviewNotes}
                      </p>
                    )}

                    {order.results.length > 0 && (
                      <div className="overflow-x-auto border border-[#E2EAE5] rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#F3F7F4] border-b border-[#E2EAE5] text-[#84938D]">
                              <th className="py-2 px-3">Parameter</th>
                              <th className="py-2 px-3">Result</th>
                              <th className="py-2 px-3">Reference</th>
                              <th className="py-2 px-3">Flag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2EAE5]">
                            {order.results.map((r) => (
                              <tr key={r.id}>
                                <td className="py-2 px-3 font-medium text-[#172B27]">
                                  {r.parameterName}
                                </td>
                                <td className="py-2 px-3 tabular-nums font-semibold">
                                  {r.value} {r.unit}
                                </td>
                                <td className="py-2 px-3 text-[#84938D] tabular-nums">
                                  {r.referenceRange || '—'}
                                </td>
                                <td
                                  className={`py-2 px-3 font-semibold ${
                                    r.flag === 'NORMAL'
                                      ? 'text-[#0B6657]'
                                      : r.flag === 'CRITICAL'
                                      ? 'text-red-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {r.flag}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {order.reports.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {order.reports.map((rep) => (
                          <button
                            key={rep.id}
                            type="button"
                            onClick={() =>
                              downloadLabReport(rep.id, rep.originalFileName)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2EAE5] hover:bg-[#EAF4EF] text-xs font-medium text-[#073C35] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {rep.title} ({rep.originalFileName})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#84938D] pt-1">
                    Results and PDF reports remain private until laboratory analysis and doctor approval are completed.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 4. PATIENT IN-APP NOTIFICATIONS
  if (activeRoute === 'portal_notifications') {
    const visible =
      notifFilter === 'unread' ? unreadNotifications : notifications;

    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#172B27]">
              Clinic Notifications
            </h1>
            <p className="text-xs sm:text-sm text-[#84938D]">
              In-app appointment updates, lab report alerts, and clinic wellness announcements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-white border border-[#E2EAE5] p-1">
              <button
                type="button"
                onClick={() => setNotifFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  notifFilter === 'all'
                    ? 'bg-[#EAF4EF] text-[#073C35]'
                    : 'text-[#84938D]'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter('unread')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  notifFilter === 'unread'
                    ? 'bg-[#EAF4EF] text-[#073C35]'
                    : 'text-[#84938D]'
                }`}
              >
                Unread ({unreadNotifications.length})
              </button>
            </div>
            {unreadNotifications.length > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#0B6657]" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2EAE5] p-10 text-center space-y-2">
            <Bell className="w-7 h-7 text-[#84938D] mx-auto" />
            <p className="text-sm font-medium text-[#172B27]">
              No notifications to display
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  notif.isRead
                    ? 'bg-white border-[#E2EAE5]'
                    : 'bg-[#EAF4EF]/55 border-[#BFE0CE]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-[#84938D]">
                      <span className="font-semibold text-[#0B6657]">
                        {notif.type.replace(/_/g, ' ')}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {format(new Date(notif.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                      {!notif.isRead && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-[#073C35]">Unread</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[#172B27]">
                      {notif.title}
                    </h3>
                    <p className="text-xs text-[#172B27]/85 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {notif.campaign && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!notif.isRead) await markNotificationRead(notif.id);
                          setDetailNotification(notif);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Campaign details
                      </button>
                    )}
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(notif.id)}
                        className="px-3 py-1.5 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] text-xs font-medium text-[#0B6657] cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                    {(notif.type === 'CAMPAIGN' ||
                      notif.actionRoute === 'portal_appointments') && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!notif.isRead) await markNotificationRead(notif.id);
                          setActiveRoute('portal_appointments');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Book appointment
                      </button>
                    )}
                    {notif.actionRoute === 'portal_labs' && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!notif.isRead) await markNotificationRead(notif.id);
                          setActiveRoute('portal_labs');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                      >
                        View lab report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Campaign Details Modal */}
        <Modal
          open={Boolean(detailNotification)}
          onClose={() => setDetailNotification(null)}
          title={detailNotification?.campaign?.name ?? detailNotification?.title ?? ''}
          subtitle={
            detailNotification?.campaign
              ? `Audience: ${detailNotification.campaign.audience} · ${detailNotification.campaign.scheduledDate}`
              : undefined
          }
          maxWidthClass="max-w-md"
        >
          {detailNotification && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#F3F7F4] border border-[#E2EAE5] p-4 text-sm text-[#172B27] leading-relaxed">
                {detailNotification.message}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDetailNotification(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailNotification(null);
                    setActiveRoute('portal_appointments');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Book appointment
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // 5. PATIENT PROFILE & ACCOUNT PREFERENCES
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#172B27]">
          Personal Profile & Notification Preferences
        </h1>
        <p className="text-xs sm:text-sm text-[#84938D]">
          Manage your contact details, insurance coverage, and in-app alert settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 space-y-3 self-start">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#172B27]">
            <UserCircle className="w-5 h-5 text-[#0B6657]" />
            <span>Patient Chart</span>
          </div>
          <div className="text-xs space-y-2 pt-2 border-t border-[#E2EAE5]">
            <div>
              <p className="text-[#84938D]">Full name</p>
              <p className="font-medium text-[#172B27]">{patient.name}</p>
            </div>
            <div>
              <p className="text-[#84938D]">Email</p>
              <p className="font-medium text-[#172B27]">{patient.email}</p>
            </div>
            <div>
              <p className="text-[#84938D]">Date of birth</p>
              <p className="font-medium text-[#172B27] tabular-nums">
                {patient.dateOfBirth}
              </p>
            </div>
            <div>
              <p className="text-[#84938D]">Primary doctor</p>
              <p className="font-medium text-[#172B27]">
                {patient.assignedDoctor?.name ?? 'Clinic care team'}
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await updatePortalProfile({
              phone: phoneDraft,
              insuranceProvider: insuranceDraft,
              memberId: memberIdDraft,
              notificationPreference: {
                appointmentUpdates: prefAppt,
                labReportAlerts: prefLab,
                campaignAnnouncements: prefCampaign,
              },
            });
          }}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold text-[#172B27]">
            Contact & Coverage Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                required
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Insurance provider
              </label>
              <input
                type="text"
                required
                value={insuranceDraft}
                onChange={(e) => setInsuranceDraft(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Member ID
              </label>
              <input
                type="text"
                required
                value={memberIdDraft}
                onChange={(e) => setMemberIdDraft(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2EAE5] space-y-3">
            <h3 className="text-xs font-semibold text-[#84938D]">
              In-App Notification Preferences
            </h3>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  Appointment updates
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Receive alerts when bookings are confirmed, rescheduled, or cancelled
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefAppt}
                onChange={(e) => setPrefAppt(e.target.checked)}
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  Laboratory report releases
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Notify me as soon as a doctor approves and releases my lab report
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefLab}
                onChange={(e) => setPrefLab(e.target.checked)}
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  Clinic health campaigns
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Seasonal check-ups, vaccination reminders, and clinic announcements
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefCampaign}
                onChange={(e) => setPrefCampaign(e.target.checked)}
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#E2EAE5]">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save profile & preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
