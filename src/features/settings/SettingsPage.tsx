import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Avatar } from '../../components/ui/Avatar';

export function SettingsPage() {
  const { settings, updateSettings, doctors, toggleDoctorAvailability } =
    useClinic();

  const [form, setForm] = useState(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#172B27]">Clinic settings</h1>
        <p className="text-xs sm:text-sm text-[#84938D]">
          Manage Northfield Family Clinic profile, provider schedules, and WhatsApp automations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Profile & WhatsApp Preferences */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold text-[#172B27]">
            Clinic profile & communication
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Clinic name
              </label>
              <input
                type="text"
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Reception email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Main phone line
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                WhatsApp Business line
              </label>
              <input
                type="text"
                value={form.whatsappNumber}
                onChange={(e) =>
                  setForm({ ...form, whatsappNumber: e.target.value })
                }
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Clinic address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Opening hours
            </label>
            <input
              type="text"
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div className="pt-4 border-t border-[#E2EAE5] space-y-3">
            <h3 className="text-xs font-semibold text-[#84938D]">
              Automated WhatsApp reminders
            </h3>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#172B27]">
                  24-hour pre-visit confirmation
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Send automated confirmation request the day before
                </p>
              </div>
              <input
                type="checkbox"
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
                  2-hour arrival check-in nudge
                </p>
                <p className="text-[11px] text-[#84938D]">
                  Share parking directions and digital check-in link
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.autoReminder2h}
                onChange={(e) =>
                  setForm({ ...form, autoReminder2h: e.target.checked })
                }
                className="w-4 h-4 accent-[#073C35]"
              />
            </label>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#E2EAE5]">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save settings
            </button>
          </div>
        </form>

        {/* Providers & Availability */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Providers on duty
          </h2>
          <p className="text-xs text-[#84938D]">
            Toggle daily clinical availability for scheduling
          </p>

          <div className="divide-y divide-[#E2EAE5]">
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={doc.name} src={doc.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172B27] truncate">
                      {doc.name}
                    </p>
                    <p className="text-[11px] text-[#84938D] truncate">
                      {doc.specialty} · {doc.room}
                    </p>
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
