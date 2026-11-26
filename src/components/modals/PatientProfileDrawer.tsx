import { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Edit3,
  Archive,
  Trash2,
  Plus,
  Save,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../ui/Avatar';

export function PatientProfileDrawer() {
  const {
    profilePatientId,
    setProfilePatientId,
    getPatientById,
    getDoctorById,
    appointments,
    openPatientModal,
    openAppointmentModal,
    openConversationForPatient,
    updatePatientNotes,
    archivePatient,
    deletePatient,
  } = useClinic();

  const patient = profilePatientId ? getPatientById(profilePatientId) : undefined;
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null);

  useEffect(() => {
    if (patient) {
      setNotesDraft(patient.notes);
      setConfirmAction(null);
    }
  }, [patient]);

  if (!patient) return null;

  const doctor = getDoctorById(patient.assignedDoctorId);
  const patientAppointments = appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#073C35]/25 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Patient profile for ${patient.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) setProfilePatientId(null);
      }}
    >
      <div className="w-full max-w-md bg-white h-full border-l border-[#E2EAE5] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2EAE5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={patient.name} bgColor={patient.avatarColor} size="lg" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#172B27] truncate">
                {patient.name}
              </h2>
              <p className="text-xs text-[#84938D] truncate">
                {patient.status} · DOB {patient.dateOfBirth}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfilePatientId(null)}
            aria-label="Close profile drawer"
            className="p-2 rounded-xl text-[#84938D] hover:text-[#172B27] hover:bg-[#F3F7F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                openAppointmentModal({
                  mode: 'create',
                  defaultPatientId: patient.id,
                  defaultDoctorId: patient.assignedDoctorId,
                });
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Book visit
            </button>
            <button
              type="button"
              onClick={() => {
                setProfilePatientId(null);
                openConversationForPatient(patient.id);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[#073C35] text-xs font-medium transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => openPatientModal({ mode: 'edit', patient })}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] text-xs font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          {/* Contact & Insurance Details */}
          <div className="space-y-2.5 text-sm border-t border-[#E2EAE5] pt-5">
            <h3 className="text-xs font-semibold text-[#84938D]">Contact & coverage</h3>
            <div className="flex items-center gap-2.5 text-xs text-[#172B27]">
              <Phone className="w-3.5 h-3.5 text-[#84938D]" />
              <span className="tabular-nums">{patient.phone}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#172B27]">
              <Mail className="w-3.5 h-3.5 text-[#84938D]" />
              <span>{patient.email}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <p className="text-[#84938D]">Primary doctor</p>
                <p className="font-medium text-[#172B27] mt-0.5">
                  {doctor?.name ?? 'Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-[#84938D]">Insurance</p>
                <p className="font-medium text-[#172B27] mt-0.5">
                  {patient.insuranceProvider} · <span className="font-mono">{patient.memberId}</span>
                </p>
              </div>
            </div>
            {patient.tags.length > 0 && (
              <div className="pt-2 text-xs text-[#84938D]">
                Tags: <span className="text-[#172B27]">{patient.tags.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Editable Notes */}
          <div className="space-y-2 border-t border-[#E2EAE5] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#84938D]">Patient notes</h3>
              <button
                type="button"
                onClick={() => updatePatientNotes(patient.id, notesDraft)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0B6657] hover:text-[#073C35] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save notes
              </button>
            </div>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full rounded-xl border border-[#E2EAE5] bg-[#F3F7F4]/50 px-3 py-2 text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          {/* Appointment History */}
          <div className="space-y-3 border-t border-[#E2EAE5] pt-5">
            <h3 className="text-xs font-semibold text-[#84938D]">
              Appointment history ({patientAppointments.length})
            </h3>
            {patientAppointments.length === 0 ? (
              <p className="text-xs text-[#84938D] py-4 text-center border border-dashed border-[#E2EAE5] rounded-xl">
                No appointments recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                {patientAppointments.map((apt) => {
                  const doc = getDoctorById(apt.doctorId);
                  return (
                    <div
                      key={apt.id}
                      className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-[#F3F7F4]/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium text-[#172B27]">
                          <Calendar className="w-3.5 h-3.5 text-[#0B6657] shrink-0" />
                          <span className="tabular-nums">
                            {apt.date} · {apt.time}
                          </span>
                        </div>
                        <p className="text-xs text-[#84938D] mt-0.5 truncate">
                          {apt.category} · {doc?.name ?? 'Doctor'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openAppointmentModal({ mode: 'edit', appointment: apt })
                        }
                        className="text-xs font-medium text-[#0B6657] hover:underline shrink-0 cursor-pointer"
                      >
                        {apt.status.replace('_', ' ')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Archive / Delete with Confirmation */}
        <div className="px-6 py-4 border-t border-[#E2EAE5] bg-[#F3F7F4]/60">
          {confirmAction ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#172B27]">
                {confirmAction === 'delete'
                  ? 'Permanently delete patient?'
                  : 'Archive this patient record?'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2EAE5] bg-white text-xs font-medium text-[#172B27] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmAction === 'delete') deletePatient(patient.id);
                    else archivePatient(patient.id);
                    setConfirmAction(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfirmAction('archive')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#84938D] hover:text-[#172B27] cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive patient
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete record
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
