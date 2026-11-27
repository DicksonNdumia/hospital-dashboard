import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { useClinic } from '../../context/ClinicContext';
import { PatientStatus } from '../../types/clinic';

const patientSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Enter a valid email address'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  insuranceProvider: z.string().min(1, 'Insurance provider is required'),
  memberId: z.string().min(1, 'Member ID is required'),
  assignedDoctorId: z.string().optional(),
  status: z.enum(['Active', 'New', 'Follow-up', 'Archived']),
  tagsText: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export function PatientModal() {
  const { patientModal, closePatientModal, doctors, savePatient } = useClinic();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = patientModal?.mode === 'edit' && Boolean(patientModal.patient);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      dateOfBirth: '1990-01-01',
      insuranceProvider: 'BlueCross Family',
      memberId: '',
      assignedDoctorId: doctors[0]?.id ?? '',
      status: 'New',
      tagsText: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!patientModal) return;
    setServerError(null);
    if (patientModal.mode === 'edit' && patientModal.patient) {
      const p = patientModal.patient;
      reset({
        name: p.name,
        phone: p.phone,
        email: p.email,
        dateOfBirth: p.dateOfBirth,
        insuranceProvider: p.insuranceProvider,
        memberId: p.memberId,
        assignedDoctorId: p.assignedDoctorId ?? '',
        status: p.status,
        tagsText: p.tags.join(', '),
        notes: p.notes,
      });
    } else {
      reset({
        name: '',
        phone: '+1 (555) ',
        email: '',
        dateOfBirth: '1990-01-01',
        insuranceProvider: 'BlueCross Family',
        memberId: `NFC-${Math.floor(100000 + Math.random() * 900000)}`,
        assignedDoctorId: doctors[0]?.id ?? '',
        status: 'New',
        tagsText: 'New patient',
        notes: '',
      });
    }
  }, [patientModal, doctors, reset]);

  const onSubmit = async (values: PatientFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const tags = (values.tagsText ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await savePatient({
        id: patientModal?.patient?.id,
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        dateOfBirth: values.dateOfBirth,
        insuranceProvider: values.insuranceProvider.trim(),
        memberId: values.memberId.trim(),
        assignedDoctorId: values.assignedDoctorId || null,
        status: values.status as PatientStatus,
        lastAppointment: patientModal?.patient?.lastAppointment ?? todayStr,
        tags,
        notes: values.notes?.trim() ?? '',
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to save patient record'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(patientModal)}
      onClose={closePatientModal}
      title={isEdit ? 'Edit patient record' : 'Register new patient'}
      subtitle="Northfield Family Clinic · Relational patient directory"
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
              Full name
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Maya Lin"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Date of birth
            </label>
            <input
              type="date"
              {...register('dateOfBirth')}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Phone number
            </label>
            <input
              type="text"
              {...register('phone')}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            />
            {errors.phone && (
              <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="patient@example.com"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Assigned doctor
            </label>
            <select
              {...register('assignedDoctorId')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              <option value="">Unassigned (optional)</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.assignedDoctorId && (
              <p className="text-xs text-red-600 mt-1">
                {errors.assignedDoctorId.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Patient status
            </label>
            <select
              {...register('status')}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              <option value="Active">Active</option>
              <option value="New">New</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Insurance provider
            </label>
            <input
              type="text"
              {...register('insuranceProvider')}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Member ID
            </label>
            <input
              type="text"
              {...register('memberId')}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] font-mono focus:outline-none focus:border-[#0B6657]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172B27] mb-1.5">
            Tags (comma separated)
          </label>
          <input
            type="text"
            {...register('tagsText')}
            placeholder="Morning preferred, Lab review"
            className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172B27] mb-1.5">
            Clinical & reception notes
          </label>
          <textarea
            rows={2}
            {...register('notes')}
            className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2EAE5]">
          <button
            type="button"
            onClick={closePatientModal}
            className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] hover:bg-[#F3F7F4] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {submitting ? 'Saving...' : isEdit ? 'Save patient' : 'Add patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
