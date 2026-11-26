import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  BellRing,
  CheckCircle2,
  UserCheck,
  Stethoscope,
  Edit3,
  MessageSquare,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../../components/ui/Avatar';

type AppointmentTab = 'today' | 'upcoming' | 'completed' | 'closed';

export function AppointmentsPage() {
  const {
    appointments,
    doctors,
    authUser,
    getPatientById,
    getDoctorById,
    openAppointmentModal,
    transitionVisitFlow,
    remindAllExpectedToday,
    remindSingleAppointment,
    openConversationForPatient,
    setProfilePatientId,
  } = useClinic();

  const [tab, setTab] = useState<AppointmentTab>('today');
  const [search, setSearch] = useState('');
  const [doctorId, setDoctorId] = useState('all');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const canCheckIn =
    authUser?.role === 'ADMIN' || authUser?.role === 'RECEPTIONIST';
  const canConsult = authUser?.role === 'ADMIN' || authUser?.role === 'DOCTOR';

  const filtered = useMemo(() => {
    return appointments
      .filter((apt) => {
        if (doctorId !== 'all' && apt.doctorId !== doctorId) return false;
        if (tab === 'today' && apt.date !== todayStr) return false;
        if (
          tab === 'upcoming' &&
          (apt.date <= todayStr ||
            apt.status === 'CANCELLED' ||
            apt.status === 'NO_SHOW')
        )
          return false;
        if (tab === 'completed' && apt.status !== 'COMPLETED') return false;
        if (
          tab === 'closed' &&
          apt.status !== 'CANCELLED' &&
          apt.status !== 'NO_SHOW'
        )
          return false;

        if (search.trim()) {
          const patient = getPatientById(apt.patientId);
          const doctor = getDoctorById(apt.doctorId);
          const q = search.toLowerCase();
          if (
            !patient?.name.toLowerCase().includes(q) &&
            !doctor?.name.toLowerCase().includes(q) &&
            !apt.category.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [appointments, tab, doctorId, search, todayStr, getPatientById, getDoctorById]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">Appointments</h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Centralized visit queue, check-ins, reminders, and workflow statuses
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCheckIn && (
            <button
              type="button"
              onClick={remindAllExpectedToday}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] text-[#073C35] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              <BellRing className="w-4 h-4 text-[#0B6657]" />
              Remind expected
            </button>
          )}
          <button
            type="button"
            onClick={() => openAppointmentModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New appointment
          </button>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F7F4] rounded-xl self-start">
          {([
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
            { id: 'closed', label: 'Cancelled & No-show' },
          ] as { id: AppointmentTab; label: string }[]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-white text-[#172B27] shadow-2xs'
                  : 'text-[#84938D] hover:text-[#172B27]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, doctor, type..."
              className="pl-8 pr-3 py-2 rounded-xl border border-[#E2EAE5] text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657] w-56"
            />
          </div>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            aria-label="Filter appointments by doctor"
            className="px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
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

      {/* Appointments Table */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#172B27]">
              No appointments found in this view
            </p>
            <p className="text-xs text-[#84938D] mt-1">
              Try adjusting your filters or schedule a new appointment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/60 text-[11px] font-semibold text-[#84938D]">
                  <th className="py-3 px-4">Date & time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Assigned doctor</th>
                  <th className="py-3 px-4">Visit type</th>
                  <th className="py-3 px-4">Status / Flow</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAE5] text-xs">
                {filtered.map((apt) => {
                  const patient = getPatientById(apt.patientId);
                  const doctor = getDoctorById(apt.doctorId);
                  if (!patient) return null;
                  const flowStatus = apt.visit?.flowStatus ?? 'EXPECTED';

                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-[#F3F7F4]/50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-[#172B27]">
                          {apt.date === todayStr ? 'Today' : apt.date}
                        </span>
                        <span className="text-[#84938D]"> · {apt.time}</span>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setProfilePatientId(patient.id)}
                          className="flex items-center gap-2.5 text-left group cursor-pointer"
                        >
                          <Avatar
                            name={patient.name}
                            bgColor={patient.avatarColor}
                            size="xs"
                          />
                          <div>
                            <p className="font-semibold text-[#172B27] group-hover:text-[#0B6657]">
                              {patient.name}
                            </p>
                            <p className="text-[11px] text-[#84938D] tabular-nums">
                              {patient.phone}
                            </p>
                          </div>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-[#172B27] whitespace-nowrap">
                        {doctor?.name ?? 'Unassigned'}
                      </td>

                      <td className="py-3 px-4 text-[#84938D] whitespace-nowrap">
                        {apt.category} · {apt.durationMinutes}m
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-[#0B6657]">
                          {apt.status}
                        </span>
                        {apt.status !== 'CANCELLED' && apt.status !== 'NO_SHOW' && (
                          <span className="text-[#84938D]"> · {flowStatus}</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {apt.status !== 'CANCELLED' &&
                            apt.status !== 'NO_SHOW' &&
                            flowStatus === 'EXPECTED' &&
                            canCheckIn && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionVisitFlow(apt.id, 'WAITING')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#073C35] text-white font-medium hover:bg-[#0B6657] cursor-pointer"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  Check in
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remindSingleAppointment(apt.id)}
                                  className="px-2 py-1 rounded-lg border border-[#E2EAE5] text-[#0B6657] hover:bg-[#EAF4EF] cursor-pointer"
                                >
                                  Remind
                                </button>
                              </>
                            )}
                          {flowStatus === 'WAITING' && canConsult && (
                            <button
                              type="button"
                              onClick={() =>
                                transitionVisitFlow(apt.id, 'IN_CONSULTATION')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B6657] text-white font-medium hover:bg-[#073C35] cursor-pointer"
                            >
                              <Stethoscope className="w-3 h-3" />
                              Call
                            </button>
                          )}
                          {flowStatus === 'IN_CONSULTATION' && canConsult && (
                            <button
                              type="button"
                              onClick={() => transitionVisitFlow(apt.id, 'SEEN')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20B875] text-white font-medium hover:bg-[#199e63] cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Seen
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openConversationForPatient(patient.id)}
                            aria-label="Open internal thread"
                            className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#0B6657] hover:bg-[#EAF4EF] cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openAppointmentModal({
                                mode: 'edit',
                                appointment: apt,
                              })
                            }
                            aria-label="Edit appointment"
                            className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#172B27] hover:bg-[#F3F7F4] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
