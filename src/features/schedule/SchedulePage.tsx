import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Appointment, AppointmentCategory } from '../../types/clinic';
import { Avatar } from '../../components/ui/Avatar';
import { NEXT_MONDAY_STR, TODAY_STR } from '../../data/mockClinicData';

type CalendarView = 'day' | 'week' | 'month';

const CATEGORY_STYLES: Record<AppointmentCategory, string> = {
  'General Consultation': 'bg-[#EAF4EF] border-[#BBDAC9] text-[#073C35]',
  'Annual Check-up': 'bg-[#E5F2EE] border-[#A7D3C5] text-[#0B6657]',
  'Follow-up': 'bg-[#EEF3F7] border-[#CBD8E4] text-[#1D4E6B]',
  'Pediatric Care': 'bg-[#FDF5E6] border-[#EED7A9] text-[#6B4A14]',
  Vaccination: 'bg-[#F0EFF9] border-[#D0CCEC] text-[#3E3572]',
  'Urgent Visit': 'bg-[#FDECEC] border-[#F0C2C2] text-[#842029]',
};

const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export function SchedulePage() {
  const {
    appointments,
    doctors,
    getPatientById,
    getDoctorById,
    openAppointmentModal,
  } = useClinic();

  const [view, setView] = useState<CalendarView>('week');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

  const weekStart = startOfWeek(cursorDate, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Summary metrics
  const currentWeekKeys = useMemo(
    () => new Set(weekDays.map((d) => format(d, 'yyyy-MM-dd'))),
    [weekDays]
  );

  const weekAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          currentWeekKeys.has(a.date) &&
          a.status !== 'cancelled' &&
          (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
      ),
    [appointments, currentWeekKeys, selectedDoctorId]
  );

  const weeklyCapacity = useMemo(() => {
    const activeDocs =
      selectedDoctorId === 'all'
        ? doctors.filter((d) => d.availableToday)
        : doctors.filter((d) => d.id === selectedDoctorId);
    return activeDocs.reduce((sum, d) => sum + d.dailyCapacity * 5, 0) || 40;
  }, [doctors, selectedDoctorId]);

  const bookedPct = Math.min(
    100,
    Math.round((weekAppointments.length / weeklyCapacity) * 100)
  );
  const openSlots = Math.max(0, weeklyCapacity - weekAppointments.length);
  const confirmedMondayCount = appointments.filter(
    (a) =>
      a.date === NEXT_MONDAY_STR &&
      a.status !== 'cancelled' &&
      (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
  ).length;

  const filteredAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status !== 'cancelled' &&
          (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
      ),
    [appointments, selectedDoctorId]
  );

  const handlePrev = () => {
    if (view === 'day') setCursorDate((d) => addDays(d, -1));
    else if (view === 'week') setCursorDate((d) => addWeeks(d, -1));
    else setCursorDate((d) => addMonths(d, -1));
  };

  const handleNext = () => {
    if (view === 'day') setCursorDate((d) => addDays(d, 1));
    else if (view === 'week') setCursorDate((d) => addWeeks(d, 1));
    else setCursorDate((d) => addMonths(d, 1));
  };

  const periodTitle =
    view === 'day'
      ? format(cursorDate, 'EEEE, d MMM yyyy')
      : view === 'week'
      ? `${format(weekDays[0], 'd MMM')} – ${format(weekDays[5], 'd MMM yyyy')}`
      : format(cursorDate, 'MMMM yyyy');

  const renderAptChip = (apt: Appointment, compact = false) => {
    const patient = getPatientById(apt.patientId);
    const doctor = getDoctorById(apt.doctorId);
    const tone =
      CATEGORY_STYLES[apt.category] ?? 'bg-[#EAF4EF] border-[#E2EAE5] text-[#172B27]';

    return (
      <button
        key={apt.id}
        type="button"
        onClick={() => openAppointmentModal({ mode: 'edit', appointment: apt })}
        className={`w-full text-left rounded-xl border p-2 transition-all hover:shadow-sm cursor-pointer ${tone}`}
      >
        <div className="flex items-center justify-between gap-1 text-[11px] font-semibold tabular-nums">
          <span>{apt.time}</span>
          <span className="capitalize opacity-80">
            {apt.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs font-semibold truncate mt-0.5">
          {patient?.name ?? 'Patient'}
        </p>
        {!compact && (
          <p className="text-[11px] opacity-80 truncate">
            {apt.category} · {doctor?.name.replace('Dr. ', 'Dr ') ?? ''}
          </p>
        )}
      </button>
    );
  };

  // Month grid dates
  const monthGridDays = useMemo(() => {
    const mStart = startOfMonth(cursorDate);
    const mEnd = endOfMonth(cursorDate);
    const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let curr = gridStart;
    while (curr <= gridEnd) {
      days.push(curr);
      curr = addDays(curr, 1);
    }
    return days;
  }, [cursorDate]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">Schedule</h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Manage provider availability, room capacity, and upcoming bookings
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            openAppointmentModal({
              mode: 'create',
              defaultDate: format(cursorDate, 'yyyy-MM-dd'),
              defaultDoctorId:
                selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
            })
          }
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New appointment
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Appointments this week</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {weekAppointments.length}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Across active clinic suites</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Booked capacity</p>
          <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
            {bookedPct}%
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[#EAF4EF] overflow-hidden">
            <div
              className="h-full bg-[#20B875] rounded-full"
              style={{ width: `${bookedPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Open slots available</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {openSlots}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Remaining this week</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Confirmed for Monday</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {confirmedMondayCount}
          </p>
          <p className="text-xs text-[#0B6657] mt-1">Next Monday morning & PM</p>
        </div>
      </div>

      {/* Controls Bar: Doctor Filters + Calendar Controls */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Doctor Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <button
            type="button"
            onClick={() => setSelectedDoctorId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedDoctorId === 'all'
                ? 'bg-[#073C35] border-[#073C35] text-white'
                : 'bg-white border-[#E2EAE5] text-[#172B27] hover:bg-[#F3F7F4]'
            }`}
          >
            All doctors
          </button>
          {doctors.map((doc) => {
            const active = selectedDoctorId === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDoctorId(doc.id)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#EAF4EF] border-[#0B6657] text-[#073C35]'
                    : 'bg-white border-[#E2EAE5] text-[#172B27] hover:bg-[#F3F7F4]'
                }`}
              >
                <Avatar name={doc.name} src={doc.avatarUrl} size="xs" />
                <span>{doc.name}</span>
              </button>
            );
          })}
        </div>

        {/* Date Nav + Day/Week/Month Switcher */}
        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="p-2 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursorDate(new Date())}
              className="px-3 py-1.5 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="p-2 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="ml-2 text-xs sm:text-sm font-semibold text-[#172B27] tabular-nums whitespace-nowrap">
              {periodTitle}
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F3F7F4] rounded-xl">
            {(['day', 'week', 'month'] as CalendarView[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                  view === mode
                    ? 'bg-white text-[#172B27] shadow-2xs'
                    : 'text-[#84938D] hover:text-[#172B27]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'week' && (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-x-auto">
          <div className="min-w-[820px] grid grid-cols-6 divide-x divide-[#E2EAE5]">
            {weekDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isToday = dayStr === TODAY_STR;
              const dayApts = filteredAppointments
                .filter((a) => a.date === dayStr)
                .sort((a, b) => a.time.localeCompare(b.time));

              return (
                <div key={dayStr} className="flex flex-col min-h-[460px]">
                  <div
                    className={`px-3 py-3 border-b border-[#E2EAE5] flex items-center justify-between ${
                      isToday ? 'bg-[#EAF4EF]/60' : 'bg-[#F3F7F4]/40'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-medium text-[#84938D]">
                        {format(day, 'EEE')}
                      </p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          isToday ? 'text-[#0B6657]' : 'text-[#172B27]'
                        }`}
                      >
                        {format(day, 'd MMM')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openAppointmentModal({
                          mode: 'create',
                          defaultDate: dayStr,
                          defaultDoctorId:
                            selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
                        })
                      }
                      title={`Book on ${format(day, 'd MMM')}`}
                      className="p-1.5 rounded-lg text-[#84938D] hover:text-[#073C35] hover:bg-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-2.5 space-y-2 flex-1">
                    {dayApts.length === 0 ? (
                      <p className="text-[11px] text-[#84938D] text-center py-8">
                        Open schedule
                      </p>
                    ) : (
                      dayApts.map((apt) => renderAptChip(apt))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'day' && (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] divide-y divide-[#E2EAE5]">
          {HOURS.map((hour) => {
            const dayStr = format(cursorDate, 'yyyy-MM-dd');
            const hourPrefix = hour.slice(0, 2);
            const slotApts = filteredAppointments
              .filter((a) => a.date === dayStr && a.time.startsWith(hourPrefix))
              .sort((a, b) => a.time.localeCompare(b.time));

            return (
              <div
                key={hour}
                className="flex flex-col sm:flex-row sm:items-stretch min-h-[72px]"
              >
                <div className="w-24 shrink-0 px-4 py-3 bg-[#F3F7F4]/40 border-b sm:border-b-0 sm:border-r border-[#E2EAE5] flex items-center justify-between">
                  <span className="font-mono text-xs font-medium text-[#84938D] tabular-nums">
                    {hour}
                  </span>
                </div>
                <div className="flex-1 p-3 flex flex-wrap items-center gap-2.5">
                  {slotApts.map((apt) => (
                    <div key={apt.id} className="w-full sm:w-64">
                      {renderAptChip(apt)}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      openAppointmentModal({
                        mode: 'create',
                        defaultDate: dayStr,
                        defaultTime: hour,
                        defaultDoctorId:
                          selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-[#E2EAE5] hover:border-[#0B6657] hover:bg-[#EAF4EF]/40 text-xs text-[#84938D] hover:text-[#073C35] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add slot
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#E2EAE5] bg-[#F3F7F4]/60">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div
                key={d}
                className="px-3 py-2.5 text-xs font-semibold text-[#84938D] text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[#E2EAE5]">
            {monthGridDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursorDate);
              const isToday = dayStr === TODAY_STR;
              const dayApts = filteredAppointments
                .filter((a) => a.date === dayStr)
                .sort((a, b) => a.time.localeCompare(b.time));

              return (
                <div
                  key={dayStr}
                  className={`min-h-[110px] p-2 flex flex-col gap-1.5 ${
                    inMonth ? 'bg-white' : 'bg-[#F3F7F4]/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCursorDate(day);
                        setView('day');
                      }}
                      className={`w-6 h-6 rounded-lg text-xs font-semibold tabular-nums flex items-center justify-center cursor-pointer ${
                        isToday
                          ? 'bg-[#073C35] text-white'
                          : 'text-[#172B27] hover:bg-[#EAF4EF]'
                      }`}
                    >
                      {format(day, 'd')}
                    </button>
                    {dayApts.length > 0 && (
                      <span className="text-[10px] text-[#84938D] tabular-nums">
                        {dayApts.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayApts.slice(0, 2).map((apt) => renderAptChip(apt, true))}
                    {dayApts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCursorDate(day);
                          setView('day');
                        }}
                        className="w-full text-left px-1.5 text-[11px] font-medium text-[#0B6657] hover:underline cursor-pointer"
                      >
                        +{dayApts.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#84938D] pt-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#172B27]">
          <CalendarIcon className="w-3.5 h-3.5 text-[#0B6657]" />
          Categories:
        </span>
        {(Object.keys(CATEGORY_STYLES) as AppointmentCategory[]).map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-sm border ${CATEGORY_STYLES[cat]}`}
            />
            <span>{cat}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
