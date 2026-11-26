import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { useClinic } from '../../context/ClinicContext';
import { AppointmentCategory, AppointmentStatus } from '../../types/clinic';

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Please select a patient'),
  doctorId: z.string().min(1, 'Please select a doctor'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  durationMinutes: z.coerce.number().min(10).max(180),
  category: z.enum([
    'General Consultation',
    'Annual Check-up',
    'Follow-up',
    'Pediatric Care',
    'Vaccination',
    'Urgent Visit',
  ]),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

const CATEGORIES: AppointmentCategory[] = [
  'General Consultation',
  'Annual Check-up',
  'Follow-up',
  'Pediatric Care',
  'Vaccination',
  'Urgent Visit',
];

const TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

export function AppointmentModal() {
  const {
    appointmentModal,
    closeAppointmentModal,
    patients,
    doctors,
    saveAppointment,
    cancelAppointment,
  } = useClinic();

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activePatients = patients.filter((p) => p.status !== 'Archived');
  const isEdit =
    appointmentModal?.mode === 'edit' && Boolean(appointmentModal.appointment);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema) as never,
    defaultValues: {
      patientId: activePatients[0]?.id ?? '',
      doctorId: doctors[0]?.id ?? '',
      date: todayStr,
      time: '11:00',
      durationMinutes: 30,
      category: 'General Consultation',
      status: 'SCHEDULED',
      notes: '',
    },
  });

  useEffect(() => {
    if (!appointmentModal) return;
    setServerError(null);
    if (appointmentModal.mode === 'edit' && appointmentModal.appointment) {
      const a = appointmentModal.appointment;
      reset({
        patientId: a.patientId,
        doctorId: a.doctorId,
        date: a.date,
        time: a.time,
        durationMinutes: a.durationMinutes,
        category: (CATEGORIES.includes(a.category as AppointmentCategory)
          ? a.category
          : 'General Consultation') as AppointmentCategory,
        status: a.status,
        notes: a.notes ?? '',
      });
    } else {
      reset({
        patientId: appointmentModal.defaultPatientId ?? activePatients[0]?.id ?? '',
        doctorId: appointmentModal.defaultDoctorId ?? doctors[0]?.id ?? '',
        date: appointmentModal.defaultDate ?? todayStr,
        time: appointmentModal.defaultTime ?? '11:00',
        durationMinutes: 30,
        category: 'General Consultation',
        status: 'SCHEDULED',
        notes: '',
      });
    }
  }, [appointmentModal, reset]);

  const onSubmit = async (values: AppointmentFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await saveAppointment({
        id: appointmentModal?.appointment?.id,
        patientId: values.patientId,
        doctorId: values.doctorId,
        date: values.date,
        time: values.time,
        durationMinutes: values.durationMinutes,
        category: values.category,
        status: values.status as AppointmentStatus,
        notes: values.notes,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to save appointment'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(appointmentModal)}
      onClose={closeAppointmentModal}
      title={isEdit ? 'Edit or reschedule appointment' : 'Schedule new appointment'}
      subtitle="Northfield Family Clinic · Server-validated availability & conflict checks"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium"
          >
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Patient
            </label>
            <select
              {...register('patientId')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              {activePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.patientId && (
              <p className="text-xs text-red-600 mt-1">{errors.patientId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Assigned doctor
            </label>
            <select
              {...register('doctorId')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialty})
                </option>
              ))}
            </select>
            {errors.doctorId && (
              <p className="text-xs text-red-600 mt-1">{errors.doctorId.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Date
            </label>
            <input
              type="date"
              {...register('date')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Time slot
            </label>
            <select
              {...register('time')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Duration
            </label>
            <select
              {...register('durationMinutes')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            >
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Appointment type
            </label>
            <select
              {...register('category')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="NO_SHOW">No-show</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172B27] mb-1.5">
            Visit notes
          </label>
          <textarea
            rows={2}
            {...register('notes')}
            placeholder="Reason for visit, prep instructions, or room preferences..."
            className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] placeholder:text-[#84938D] focus:outline-none focus:border-[#0B6657]"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#E2EAE5]">
          {isEdit && appointmentModal?.appointment ? (
            <button
              type="button"
              onClick={async () => {
                await cancelAppointment(appointmentModal.appointment!.id);
                closeAppointmentModal();
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              Cancel appointment
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeAppointmentModal}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] hover:bg-[#F3F7F4] transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : isEdit
                ? 'Save changes'
                : 'Confirm booking'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
