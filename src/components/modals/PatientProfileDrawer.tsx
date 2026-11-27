import { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Edit3,
  Archive,
  Plus,
  Save,
  FlaskConical,
  KeyRound,
  Download,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { LabPriority } from '../../types/clinic';
import { Avatar } from '../ui/Avatar';

export function PatientProfileDrawer() {
  const {
    profilePatientId,
    setProfilePatientId,
    getPatientById,
    getDoctorById,
    appointments,
    authUser,
    openPatientModal,
    openAppointmentModal,
    openConversationForPatient,
    updatePatientNotes,
    archivePatient,
    provisionPatientPortalAccount,
    labTests,
    labOrders,
    createLabOrder,
    downloadLabReport,
    setActiveRoute,
  } = useClinic();

  const patient = profilePatientId ? getPatientById(profilePatientId) : undefined;
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Quick Order Lab state
  const [showLabForm, setShowLabForm] = useState(false);
  const [labTestId, setLabTestId] = useState('');
  const [labPriority, setLabPriority] = useState<LabPriority>('ROUTINE');
  const [labIndication, setLabIndication] = useState('');

  // Quick Portal Activation state
  const [showPortalForm, setShowPortalForm] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');

  useEffect(() => {
    if (patient) {
      setNotesDraft(patient.notes);
      setConfirmArchive(false);
      setShowLabForm(false);
      setShowPortalForm(false);
      setPortalPassword('');
      setLabIndication('');
      setLabTestId(labTests[0]?.id ?? '');
    }
  }, [patient, labTests]);

  if (!patient) return null;

  const doctor = patient.assignedDoctorId
    ? getDoctorById(patient.assignedDoctorId)
    : undefined;
  const canManageAdminOrReception =
    authUser?.role === 'ADMIN' || authUser?.role === 'RECEPTIONIST';
  const canOrderLab =
    authUser?.role === 'DOCTOR' || authUser?.role === 'ADMIN';

  const patientAppointments = appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  const patientLabOrders = labOrders.filter((o) => o.patientId === patient.id);

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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                openAppointmentModal({
                  mode: 'create',
                  defaultPatientId: patient.id,
                  defaultDoctorId: patient.assignedDoctorId ?? undefined,
                })
              }
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Book visit
            </button>
            <button
              type="button"
              onClick={async () => {
                setProfilePatientId(null);
                await openConversationForPatient(patient.id);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[#073C35] text-xs font-medium transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </button>
            {canManageAdminOrReception && (
              <button
                type="button"
                onClick={() => openPatientModal({ mode: 'edit', patient })}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#172B27] text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>

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

          {/* Editable Clinical Notes */}
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

          {/* Patient Portal Access Linking */}
          {canManageAdminOrReception && (
            <div className="space-y-2.5 border-t border-[#E2EAE5] pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#84938D] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#0B6657]" />
                  Patient portal access
                </h3>
                {patient.userId ? (
                  <span className="text-xs font-semibold text-[#0B6657]">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPortalForm((prev) => !prev)}
                    className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
                  >
                    {showPortalForm ? 'Cancel' : 'Enable portal login'}
                  </button>
                )}
              </div>
              {showPortalForm && !patient.userId && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await provisionPatientPortalAccount(patient.id, portalPassword);
                    setShowPortalForm(false);
                    setPortalPassword('');
                  }}
                  className="bg-[#F3F7F4] border border-[#E2EAE5] rounded-xl p-3 space-y-2"
                >
                  <p className="text-[11px] text-[#84938D]">
                    Creates a linked PATIENT login for <span className="font-medium text-[#172B27]">{patient.email}</span>.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      placeholder="Set initial password (min 8 chars)"
                      className="flex-1 rounded-lg border border-[#E2EAE5] bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#073C35] text-white text-xs font-medium cursor-pointer"
                    >
                      Enable
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Laboratory Orders & Quick Request */}
          <div className="space-y-3 border-t border-[#E2EAE5] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#84938D] flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-[#0B6657]" />
                Laboratory orders ({patientLabOrders.length})
              </h3>
              {canOrderLab && (
                <button
                  type="button"
                  onClick={() => setShowLabForm((prev) => !prev)}
                  className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
                >
                  {showLabForm ? 'Close form' : '+ Order lab test'}
                </button>
              )}
            </div>

            {showLabForm && canOrderLab && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!labTestId) return;
                  await createLabOrder({
                    patientId: patient.id,
                    doctorId:
                      authUser?.doctorId ?? patient.assignedDoctorId ?? undefined,
                    labTestId,
                    priority: labPriority,
                    clinicalIndication: labIndication.trim(),
                  });
                  setShowLabForm(false);
                  setLabIndication('');
                }}
                className="bg-[#F3F7F4] border border-[#E2EAE5] rounded-xl p-3 space-y-2.5"
              >
                <div className="grid grid-cols-3 gap-2">
                  <select
                    required
                    value={labTestId}
                    onChange={(e) => setLabTestId(e.target.value)}
                    className="col-span-2 rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="">Select test...</option>
                    {labTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={labPriority}
                    onChange={(e) =>
                      setLabPriority(e.target.value as LabPriority)
                    }
                    className="rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="URGENT">URGENT</option>
                    <option value="STAT">STAT</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={labIndication}
                  onChange={(e) => setLabIndication(e.target.value)}
                  placeholder="Clinical indication..."
                  className="w-full rounded-lg border border-[#E2EAE5] bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#073C35] text-white text-xs font-medium cursor-pointer"
                  >
                    Submit lab order
                  </button>
                </div>
              </form>
            )}

            {patientLabOrders.length > 0 && (
              <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                {patientLabOrders.slice(0, 5).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-2.5 bg-white flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#172B27] truncate">
                        {ord.labTest.name}{' '}
                        <span className="font-mono text-[11px] text-[#84938D]">
                          ({ord.orderNumber})
                        </span>
                      </p>
                      <p className="text-[11px] text-[#0B6657] font-medium">
                        {ord.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {ord.reports[0] ? (
                      <button
                        type="button"
                        onClick={() =>
                          downloadLabReport(
                            ord.reports[0].id,
                            ord.reports[0].originalFileName
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[11px] font-medium text-[#073C35] cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                    ) : canOrderLab ? (
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePatientId(null);
                          setActiveRoute('laboratory');
                        }}
                        className="text-[11px] font-medium text-[#0B6657] hover:underline cursor-pointer"
                      >
                        Open Lab
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit & Consultation History */}
          <div className="space-y-3 border-t border-[#E2EAE5] pt-5">
            <h3 className="text-xs font-semibold text-[#84938D]">
              Visit & consultation history ({patientAppointments.length})
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
                      className="p-3 bg-white hover:bg-[#F3F7F4]/60 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-[#172B27]">
                          <Calendar className="w-3.5 h-3.5 text-[#0B6657] shrink-0" />
                          <span className="tabular-nums">
                            {apt.date} · {apt.time}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openAppointmentModal({ mode: 'edit', appointment: apt })
                          }
                          className="text-xs font-medium text-[#0B6657] hover:underline shrink-0 cursor-pointer"
                        >
                          {apt.visit?.flowStatus ?? apt.status}
                        </button>
                      </div>
                      <p className="text-xs text-[#84938D]">
                        {apt.category} · {doc?.name ?? 'Doctor'}
                        {apt.visit?.waitingMinutes != null
                          ? ` · Wait ${apt.visit.waitingMinutes}m`
                          : ''}
                      </p>
                      {apt.consultation?.diagnosis && (
                        <p className="text-[11px] text-[#172B27] bg-[#EAF4EF]/60 rounded-lg px-2 py-1 mt-1">
                          Dx: {apt.consultation.diagnosis}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Archive (Soft archive only) */}
        {canManageAdminOrReception && patient.status !== 'Archived' && (
          <div className="px-6 py-4 border-t border-[#E2EAE5] bg-[#F3F7F4]/60">
            {confirmArchive ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#172B27]">
                  Archive this patient record?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#E2EAE5] bg-white text-xs font-medium text-[#172B27] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await archivePatient(patient.id);
                      setConfirmArchive(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                  >
                    Confirm archive
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#84938D] hover:text-[#172B27] cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive patient record
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
