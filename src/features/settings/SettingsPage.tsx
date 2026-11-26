import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Save, UserPlus, Shield, Clock } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Doctor, StaffRole } from '../../types/clinic';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    doctors,
    authUser,
    staffAccounts,
    auditLogs,
    toggleDoctorAvailability,
    registerDoctor,
    updateDoctorSchedule,
    registerStaffUser,
    toggleStaffActive,
  } = useClinic();

  const isAdmin = authUser?.role === 'ADMIN';
  const [form, setForm] = useState(settings);

  // Staff Registration Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('RECEPTIONIST');
  const [staffSpecialty, setStaffSpecialty] = useState('Family Medicine');
  const [staffRoom, setStaffRoom] = useState('Suite 115');

  // Doctor Registration Modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Family Medicine');
  const [docRoom, setDocRoom] = useState('Suite 114');
  const [docCapacity, setDocCapacity] = useState(10);

  // Doctor Working Hours Modal
  const [scheduleDoc, setScheduleDoc] = useState<Doctor | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<
    Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>
  >([]);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const openWorkingHours = (doc: Doctor) => {
    const base = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
      const found = doc.schedules?.find((s) => s.dayOfWeek === dayOfWeek);
      return {
        dayOfWeek,
        startTime: found?.startTime ?? '08:30',
        endTime: found?.endTime ?? '17:00',
        isActive: found?.isActive ?? true,
      };
    });
    setScheduleDraft(base);
    setScheduleDoc(doc);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    await registerStaffUser({
      name: staffName,
      email: staffEmail,
      password: staffPassword,
      role: staffRole,
      specialty: staffRole === 'DOCTOR' ? staffSpecialty : undefined,
      room: staffRole === 'DOCTOR' ? staffRoom : undefined,
    });
    setStaffModalOpen(false);
    setStaffName('');
    setStaffEmail('');
    setStaffPassword('');
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    await registerDoctor({
      name: docName,
      specialty: docSpecialty,
      room: docRoom,
      dailyCapacity: docCapacity,
    });
    setDocModalOpen(false);
    setDocName('');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-[#172B27]">
          Clinic settings & access
        </h1>
        <p className="text-xs sm:text-sm text-[#84938D]">
          Manage Northfield Family Clinic profile, doctor schedules, staff roles, and audit logs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Profile */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold text-[#172B27]">
            Clinic profile & scheduling defaults
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Clinic name
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] disabled:bg-[#F3F7F4] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Reception email
              </label>
              <input
                type="email"
                disabled={!isAdmin}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] disabled:bg-[#F3F7F4] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Main phone line
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums disabled:bg-[#F3F7F4] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Clinic address
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] disabled:bg-[#F3F7F4] focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Opening hours
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] disabled:bg-[#F3F7F4] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div className="pt-4 border-t border-[#E2EAE5] space-y-3">
            <h3 className="text-xs font-semibold text-[#84938D]">
              Workflow preferences
            </h3>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  24-hour pre-visit check-in flag
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Highlight unconfirmed appointments 24h prior to visit
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={form.autoReminder24h}
                onChange={(e) =>
                  setForm({ ...form, autoReminder24h: e.target.checked })
                }
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  Same-day arrival prompt
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Track reminder timestamps on today’s expected queue
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={form.autoReminder2h}
                onChange={(e) =>
                  setForm({ ...form, autoReminder2h: e.target.checked })
                }
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-3 border-t border-[#E2EAE5]">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save settings
              </button>
            </div>
          )}
        </form>

        {/* Providers & Working Hours */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4 self-start">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#172B27]">
                Doctors & availability
              </h2>
              <p className="text-xs text-[#84938D]">Duty status & working hours</p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setDocModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#EAF4EF] hover:bg-[#DCECE4] text-[#073C35] text-xs font-medium cursor-pointer"
              >
                + Doctor
              </button>
            )}
          </div>

          <div className="divide-y divide-[#E2EAE5]">
            {doctors.map((doc) => {
              const canEditDoc =
                isAdmin ||
                (authUser?.role === 'DOCTOR' && authUser.doctorId === doc.id);
              return (
                <div key={doc.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={doc.name}
                        src={doc.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#172B27] truncate">
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-[#84938D] truncate">
                          {doc.specialty} · {doc.room}
                        </p>
                      </div>
                    </div>
                    {canEditDoc && (
                      <button
                        type="button"
                        onClick={() => toggleDoctorAvailability(doc.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                          doc.availableToday
                            ? 'bg-[#EAF4EF] text-[#073C35]'
                            : 'bg-[#F3F7F4] text-[#84938D]'
                        }`}
                      >
                        {doc.availableToday ? 'On duty' : 'Off today'}
                      </button>
                    )}
                  </div>
                  {canEditDoc && (
                    <button
                      type="button"
                      onClick={() => openWorkingHours(doc)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B6657] hover:underline cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      Manage working hours
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin-only Staff & RBAC Directory + Audit Log */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Registration & Access Control */}
          <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#172B27] flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#0B6657]" />
                  Staff accounts & roles
                </h2>
                <p className="text-xs text-[#84938D]">
                  Admin-controlled registration for Admin, Receptionist, and Doctor
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStaffModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Register staff
              </button>
            </div>

            <div className="divide-y divide-[#E2EAE5]">
              {staffAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#172B27] truncate">
                      {acc.name}{' '}
                      <span className="font-medium text-[#0B6657]">
                        · {acc.role}
                      </span>
                    </p>
                    <p className="text-[#84938D] truncate">{acc.email}</p>
                  </div>
                  {acc.id !== authUser?.id && (
                    <button
                      type="button"
                      onClick={() => toggleStaffActive(acc.id, !acc.active)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer shrink-0 ${
                        acc.active
                          ? 'bg-[#EAF4EF] text-[#073C35]'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {acc.active ? 'Active' : 'Suspended'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Security & Operations Audit Log */}
          <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#172B27]">
                Audit trail
              </h2>
              <p className="text-xs text-[#84938D]">
                Recent authenticated clinic mutations & role actions
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#E2EAE5]">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#172B27]">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-[#84938D] tabular-nums">
                      {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-[#84938D] truncate">
                    {log.actorEmail} ({log.actorRole}) · {log.details || log.entityType}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Register Staff Account Modal */}
      <Modal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title="Register staff user"
        subtitle="Admin-controlled RBAC user creation"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Full name
            </label>
            <input
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Jordan Reyes"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Staff email
            </label>
            <input
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="jordan@northfieldclinic.org"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Role
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                <option value="RECEPTIONIST">RECEPTIONIST</option>
                <option value="DOCTOR">DOCTOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
              />
            </div>
          </div>
          {staffRole === 'DOCTOR' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                  Specialty
                </label>
                <input
                  type="text"
                  value={staffSpecialty}
                  onChange={(e) => setStaffSpecialty(e.target.value)}
                  className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                  Room / Suite
                </label>
                <input
                  type="text"
                  value={staffRoom}
                  onChange={(e) => setStaffRoom(e.target.value)}
                  className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStaffModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
            >
              Create staff account
            </button>
          </div>
        </form>
      </Modal>

      {/* Register Doctor Profile Modal */}
      <Modal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title="Register provider"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateDoctor} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Provider name
            </label>
            <input
              type="text"
              required
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Dr. Clara Gomez"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Specialty
              </label>
              <input
                type="text"
                required
                value={docSpecialty}
                onChange={(e) => setDocSpecialty(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Room
              </label>
              <input
                type="text"
                required
                value={docRoom}
                onChange={(e) => setDocRoom(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Daily slot capacity
            </label>
            <input
              type="number"
              min={1}
              max={40}
              value={docCapacity}
              onChange={(e) => setDocCapacity(Number(e.target.value))}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDocModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
            >
              Add provider
            </button>
          </div>
        </form>
      </Modal>

      {/* Doctor Working Hours Modal */}
      <Modal
        open={Boolean(scheduleDoc)}
        onClose={() => setScheduleDoc(null)}
        title="Working hours"
        subtitle={scheduleDoc?.name}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3">
          {scheduleDraft.map((row, idx) => (
            <div
              key={row.dayOfWeek}
              className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#E2EAE5] last:border-0"
            >
              <label className="flex items-center gap-2 w-20 font-medium text-[#172B27]">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(e) => {
                    const next = [...scheduleDraft];
                    next[idx] = { ...row, isActive: e.target.checked };
                    setScheduleDraft(next);
                  }}
                  className="accent-[#073C35]"
                />
                {DAY_NAMES[row.dayOfWeek]}
              </label>

              <div className="flex items-center gap-1.5 tabular-nums">
                <input
                  type="time"
                  disabled={!row.isActive}
                  value={row.startTime}
                  onChange={(e) => {
                    const next = [...scheduleDraft];
                    next[idx] = { ...row, startTime: e.target.value };
                    setScheduleDraft(next);
                  }}
                  className="rounded-lg border border-[#E2EAE5] px-2 py-1 text-xs disabled:opacity-45"
                />
                <span className="text-[#84938D]">–</span>
                <input
                  type="time"
                  disabled={!row.isActive}
                  value={row.endTime}
                  onChange={(e) => {
                    const next = [...scheduleDraft];
                    next[idx] = { ...row, endTime: e.target.value };
                    setScheduleDraft(next);
                  }}
                  className="rounded-lg border border-[#E2EAE5] px-2 py-1 text-xs disabled:opacity-45"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setScheduleDoc(null)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (scheduleDoc) {
                  await updateDoctorSchedule(scheduleDoc.id, scheduleDraft);
                }
                setScheduleDoc(null);
              }}
              className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
            >
              Save hours
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
