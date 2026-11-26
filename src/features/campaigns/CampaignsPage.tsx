import React, { useMemo, useState } from 'react';
import {
  Send,
  Plus,
  Eye,
  Edit3,
  CalendarClock,
  CheckCheck,
  MessageSquare,
  CalendarCheck2,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useClinic } from '../../context/ClinicContext';
import { Campaign, CampaignStatus } from '../../types/clinic';
import { Modal } from '../../components/ui/Modal';
import { TODAY_STR } from '../../data/mockClinicData';

export function CampaignsPage() {
  const { campaigns, saveCampaign, sendCampaignNow, scheduleCampaign } = useClinic();

  const [editModal, setEditModal] = useState<{
    open: boolean;
    campaign?: Campaign;
  }>({ open: false });
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [confirmSendCampaign, setConfirmSendCampaign] = useState<Campaign | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Campaign | null>(null);
  const [scheduleDateDraft, setScheduleDateDraft] = useState(TODAY_STR);

  // Campaign form state
  const [formName, setFormName] = useState('');
  const [formAudience, setFormAudience] = useState('');
  const [formRecipients, setFormRecipients] = useState(120);
  const [formDate, setFormDate] = useState(TODAY_STR);
  const [formStatus, setFormStatus] = useState<CampaignStatus>('Draft');
  const [formTemplate, setFormTemplate] = useState('');

  const openCreateModal = () => {
    setFormName('');
    setFormAudience('Patients overdue for annual check-up');
    setFormRecipients(150);
    setFormDate(TODAY_STR);
    setFormStatus('Draft');
    setFormTemplate(
      'Hello {{first_name}}, Northfield Family Clinic has morning appointments available next week. Reply BOOK to reserve your preferred time.'
    );
    setEditModal({ open: true });
  };

  const openEditModal = (camp: Campaign) => {
    setFormName(camp.name);
    setFormAudience(camp.audience);
    setFormRecipients(camp.recipientCount);
    setFormDate(camp.scheduledDate);
    setFormStatus(camp.status);
    setFormTemplate(camp.messageTemplate);
    setEditModal({ open: true, campaign: camp });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    saveCampaign({
      id: editModal.campaign?.id,
      name: formName.trim(),
      audience: formAudience.trim(),
      recipientCount: Number(formRecipients) || 50,
      status: formStatus,
      scheduledDate: formDate,
      messageTemplate: formTemplate.trim(),
    });
    setEditModal({ open: false });
  };

  // Analytics calculations
  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + c.sentCount, 0);
    const read = campaigns.reduce((s, c) => s + c.readCount, 0);
    const replies = campaigns.reduce((s, c) => s + c.replyCount, 0);
    const bookings = campaigns.reduce((s, c) => s + c.bookingsCount, 0);
    return {
      sent,
      readRate: sent > 0 ? Math.round((read / sent) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replies / sent) * 100) : 0,
      bookings,
    };
  }, [campaigns]);

  const chartData = useMemo(
    () =>
      campaigns.map((c) => ({
        name: c.name.split(' ').slice(0, 2).join(' '),
        Sent: c.sentCount,
        Read: c.readCount,
        Bookings: c.bookingsCount,
      })),
    [campaigns]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">Campaigns</h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            WhatsApp patient outreach, seasonal check-up drives, and clinic announcements
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create campaign
        </button>
      </div>

      {/* Campaign Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">Messages sent</span>
            <Send className="w-4 h-4 text-[#0B6657]" />
          </div>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {totals.sent.toLocaleString()}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Delivered via WhatsApp</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">Read rate</span>
            <CheckCheck className="w-4 h-4 text-[#20B875]" />
          </div>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {totals.readRate}%
          </p>
          <p className="text-xs text-[#0B6657] mt-1">Opened within 2 hours</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">Reply rate</span>
            <MessageSquare className="w-4 h-4 text-[#0B6657]" />
          </div>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {totals.replyRate}%
          </p>
          <p className="text-xs text-[#84938D] mt-1">Direct patient responses</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#84938D]">
              Bookings from campaigns
            </span>
            <CalendarCheck2 className="w-4 h-4 text-[#20B875]" />
          </div>
          <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
            {totals.bookings}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Confirmed appointments</p>
        </div>
      </div>

      {/* Campaign Delivery Chart */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#172B27]">
              Campaign delivery & booking conversion
            </h2>
            <p className="text-xs text-[#84938D]">
              Sent vs read messages and confirmed clinic bookings
            </p>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2EAE5" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#84938D' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#84938D' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #E2EAE5',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="Sent" fill="#073C35" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Read" fill="#20B875" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Bookings" fill="#84CBB0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((camp) => {
          const readPct =
            camp.sentCount > 0
              ? Math.round((camp.readCount / camp.sentCount) * 100)
              : 0;
          const replyPct =
            camp.sentCount > 0
              ? Math.round((camp.replyCount / camp.sentCount) * 100)
              : 0;

          return (
            <article
              key={camp.id}
              className="bg-white rounded-2xl border border-[#E2EAE5] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#172B27]">
                      {camp.name}
                    </h3>
                    <p className="text-xs text-[#84938D] mt-0.5">
                      {camp.audience}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      camp.status === 'Active'
                        ? 'text-[#20B875]'
                        : camp.status === 'Completed'
                        ? 'text-[#0B6657]'
                        : camp.status === 'Scheduled'
                        ? 'text-amber-700'
                        : 'text-[#84938D]'
                    }`}
                  >
                    {camp.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#84938D]">
                  <span className="inline-flex items-center gap-1 tabular-nums text-[#172B27] font-medium">
                    <Users className="w-3.5 h-3.5 text-[#0B6657]" />
                    {camp.recipientCount} recipients
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Scheduled {camp.scheduledDate}
                  </span>
                </div>

                <p className="mt-3 text-xs text-[#172B27]/85 bg-[#F3F7F4] rounded-xl p-3 border border-[#E2EAE5] line-clamp-2">
                  {camp.messageTemplate}
                </p>

                {/* Delivery Stats */}
                <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-[#E2EAE5] text-xs">
                  <div>
                    <p className="text-[#84938D] text-[11px]">Sent</p>
                    <p className="font-semibold text-[#172B27] tabular-nums mt-0.5">
                      {camp.sentCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#84938D] text-[11px]">Read</p>
                    <p className="font-semibold text-[#172B27] tabular-nums mt-0.5">
                      {readPct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[#84938D] text-[11px]">Replied</p>
                    <p className="font-semibold text-[#172B27] tabular-nums mt-0.5">
                      {replyPct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[#84938D] text-[11px]">Bookings</p>
                    <p className="font-semibold text-[#0B6657] tabular-nums mt-0.5">
                      {camp.bookingsCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E2EAE5]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewCampaign(camp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(camp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleTarget(camp);
                      setScheduleDateDraft(camp.scheduledDate);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#EAF4EF] text-xs font-medium text-[#0B6657] cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSendCampaign(camp)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Create / Edit Campaign Modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false })}
        title={editModal.campaign ? 'Edit campaign' : 'Create WhatsApp campaign'}
        subtitle="Northfield Family Clinic · Patient outreach"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Campaign name
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Flu shot clinic reminder"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Target audience
              </label>
              <input
                type="text"
                required
                value={formAudience}
                onChange={(e) => setFormAudience(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Recipient count
              </label>
              <input
                type="number"
                min={1}
                value={formRecipients}
                onChange={(e) => setFormRecipients(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Scheduled date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as CampaignStatus)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              >
                <option value="Draft">Draft</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              WhatsApp message template
            </label>
            <textarea
              rows={4}
              required
              value={formTemplate}
              onChange={(e) => setFormTemplate(e.target.value)}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2EAE5]">
            <button
              type="button"
              onClick={() => setEditModal({ open: false })}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
            >
              Save campaign
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Message Modal */}
      <Modal
        open={Boolean(previewCampaign)}
        onClose={() => setPreviewCampaign(null)}
        title="WhatsApp message preview"
        subtitle={previewCampaign?.name}
        maxWidthClass="max-w-md"
      >
        {previewCampaign && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F3F7F4] border border-[#E2EAE5] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#84938D]">
                <span className="font-semibold text-[#073C35]">
                  Northfield Family Clinic
                </span>
                <span>WhatsApp Business</span>
              </div>
              <div className="bg-[#EAF4EF] border border-[#CBE2D6] rounded-2xl rounded-tl-sm p-3.5 text-sm text-[#172B27] leading-relaxed">
                {previewCampaign.messageTemplate
                  .replace('{{first_name}}', 'Clara')
                  .replace('{{time}}', '10:00 AM')
                  .replace('{{doctor}}', 'Dr. Elena Vance')}
              </div>
              <p className="text-[11px] text-[#84938D] tabular-nums">
                Audience: {previewCampaign.audience} ({previewCampaign.recipientCount}{' '}
                recipients)
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
              >
                Close preview
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Campaign Modal */}
      <Modal
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTarget(null)}
        title="Schedule campaign"
        subtitle={scheduleTarget?.name}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Dispatch date
            </label>
            <input
              type="date"
              value={scheduleDateDraft}
              onChange={(e) => setScheduleDateDraft(e.target.value)}
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] tabular-nums focus:outline-none focus:border-[#0B6657]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScheduleTarget(null)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (scheduleTarget) {
                  scheduleCampaign(scheduleTarget.id, scheduleDateDraft);
                }
                setScheduleTarget(null);
              }}
              className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
            >
              Confirm schedule
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Campaign Confirmation Modal */}
      <Modal
        open={Boolean(confirmSendCampaign)}
        onClose={() => setConfirmSendCampaign(null)}
        title="Confirm campaign send"
        subtitle={confirmSendCampaign?.name}
        maxWidthClass="max-w-md"
      >
        {confirmSendCampaign && (
          <div className="space-y-4">
            <p className="text-sm text-[#172B27] leading-relaxed">
              You are about to send{' '}
              <span className="font-semibold">{confirmSendCampaign.name}</span>{' '}
              via WhatsApp Business to{' '}
              <span className="font-semibold tabular-nums">
                {confirmSendCampaign.recipientCount}
              </span>{' '}
              patients ({confirmSendCampaign.audience}).
            </p>
            <div className="rounded-xl bg-[#F3F7F4] border border-[#E2EAE5] p-3 text-xs text-[#84938D]">
              Messages will be dispatched immediately following clinic opt-in preferences.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSendCampaign(null)}
                className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] hover:bg-[#F3F7F4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  sendCampaignNow(confirmSendCampaign.id);
                  setConfirmSendCampaign(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Send campaign now
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
