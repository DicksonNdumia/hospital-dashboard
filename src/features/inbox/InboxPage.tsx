import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Send,
  Paperclip,
  CheckCheck,
  Phone,
  Calendar,
  FileText,
  MapPin,
  ClipboardCheck,
  Save,
  UserCheck,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { QUICK_REPLIES, TODAY_STR } from '../../data/mockClinicData';
import { Avatar } from '../../components/ui/Avatar';

type InboxFilter = 'all' | 'unread' | 'waiting';
type MobilePane = 'list' | 'chat' | 'info';

export function InboxPage() {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    sendMessage,
    getPatientById,
    getDoctorById,
    appointments,
    updatePatientNotes,
    openAppointmentModal,
    updateAppointmentStatus,
    setProfilePatientId,
  } = useClinic();

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat');
  const [notesDraft, setNotesDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const patient = getPatientById(conv.patientId);
      if (!patient) return false;
      if (filter === 'unread' && conv.unreadCount === 0) return false;
      if (filter === 'waiting' && !conv.waitingReply) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const lastMsg = conv.messages[conv.messages.length - 1]?.text.toLowerCase() ?? '';
        if (
          !patient.name.toLowerCase().includes(q) &&
          !patient.phone.toLowerCase().includes(q) &&
          !lastMsg.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, filter, search, getPatientById]);

  const activeConv =
    conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  const activePatient = activeConv ? getPatientById(activeConv.patientId) : undefined;
  const activeDoctor = activePatient
    ? getDoctorById(activePatient.assignedDoctorId)
    : undefined;

  const nextAppointment = useMemo(() => {
    if (!activePatient) return undefined;
    return appointments
      .filter((a) => a.patientId === activePatient.id && a.status !== 'cancelled')
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0];
  }, [appointments, activePatient]);

  useEffect(() => {
    if (activePatient) {
      setNotesDraft(activePatient.notes);
    }
  }, [activePatient?.id, activePatient?.notes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.id, activeConv?.messages.length]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConv || !composerText.trim()) return;
    sendMessage(activeConv.id, composerText);
    setComposerText('');
  };

  const handleAttachment = (name: string, type: 'pdf' | 'form' | 'location') => {
    if (!activeConv) return;
    sendMessage(activeConv.id, composerText.trim() || `Shared ${name}`, { name, type });
    setComposerText('');
    setAttachMenuOpen(false);
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] min-h-[540px] flex flex-col gap-3">
      {/* Mobile / Tablet Pane Switcher */}
      <div className="flex xl:hidden items-center gap-1 p-1 bg-white rounded-xl border border-[#E2EAE5] self-start">
        {(['list', 'chat', 'info'] as MobilePane[]).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
              mobilePane === pane
                ? 'bg-[#073C35] text-white'
                : 'text-[#84938D] hover:text-[#172B27]'
            }`}
          >
            {pane === 'list' ? 'Conversations' : pane === 'chat' ? 'Messages' : 'Patient info'}
          </button>
        ))}
      </div>

      {/* Three-Part Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel: Conversation List */}
        <section
          className={`${
            mobilePane === 'list' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-4 xl:col-span-3 flex-col bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden min-h-0`}
        >
          <div className="p-3.5 border-b border-[#E2EAE5] space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search WhatsApp chats..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E2EAE5] bg-[#F3F7F4]/60 text-xs text-[#172B27] placeholder:text-[#84938D] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F3F7F4] rounded-xl">
              {([
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'waiting', label: 'Waiting' },
              ] as { id: InboxFilter; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-white text-[#172B27] shadow-2xs'
                      : 'text-[#84938D] hover:text-[#172B27]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E2EAE5]">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#84938D]">
                No conversations match your filter.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const patient = getPatientById(conv.patientId);
                if (!patient) return null;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isSelected = conv.id === activeConv?.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      selectConversation(conv.id);
                      setMobilePane('chat');
                    }}
                    className={`w-full text-left px-3.5 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#EAF4EF]' : 'hover:bg-[#F3F7F4]'
                    }`}
                  >
                    <Avatar
                      name={patient.name}
                      bgColor={patient.avatarColor}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#172B27] truncate">
                          {patient.name}
                        </p>
                        <span className="text-[11px] text-[#84938D] tabular-nums shrink-0">
                          {conv.lastUpdated}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-[#84938D] truncate">
                          {lastMsg ? lastMsg.text : 'No messages yet'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#20B875] text-white text-[10px] font-bold flex items-center justify-center tabular-nums shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Middle Panel: Active Conversation */}
        <section
          className={`${
            mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-8 xl:col-span-6 flex-col bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden min-h-0`}
        >
          {activeConv && activePatient ? (
            <>
              {/* Conversation Header */}
              <div className="px-4 sm:px-5 py-3 border-b border-[#E2EAE5] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={activePatient.name}
                    bgColor={activePatient.avatarColor}
                    size="md"
                  />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setProfilePatientId(activePatient.id)}
                      className="text-sm font-semibold text-[#172B27] hover:text-[#0B6657] truncate block cursor-pointer"
                    >
                      {activePatient.name}
                    </button>
                    <p className="text-xs text-[#84938D] tabular-nums truncate">
                      {activePatient.phone} · WhatsApp Business
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobilePane('info')}
                    className="xl:hidden px-2.5 py-1.5 rounded-lg border border-[#E2EAE5] text-xs font-medium text-[#172B27] cursor-pointer"
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfilePatientId(activePatient.id)}
                    className="px-3 py-1.5 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Patient record
                  </button>
                </div>
              </div>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F3F7F4]/60">
                {activeConv.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <MessageSquare className="w-8 h-8 text-[#84938D] mb-2" />
                    <p className="text-sm font-medium text-[#172B27]">
                      Start a WhatsApp thread with {activePatient.name}
                    </p>
                    <p className="text-xs text-[#84938D] mt-1">
                      Use a quick reply on the right or type a custom message below.
                    </p>
                  </div>
                ) : (
                  activeConv.messages.map((msg) => {
                    const isClinic = msg.sender === 'clinic';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isClinic ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[74%] rounded-2xl px-4 py-2.5 text-sm shadow-2xs ${
                            isClinic
                              ? 'bg-[#EAF4EF] border border-[#CBE2D6] text-[#172B27] rounded-br-sm'
                              : 'bg-white border border-[#E2EAE5] text-[#172B27] rounded-bl-sm'
                          }`}
                        >
                          {msg.attachmentName && (
                            <div className="mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/80 border border-[#E2EAE5] text-xs font-medium text-[#073C35]">
                              <FileText className="w-3.5 h-3.5 text-[#0B6657] shrink-0" />
                              <span className="truncate">{msg.attachmentName}</span>
                            </div>
                          )}
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#84938D] tabular-nums">
                            <span>{msg.timestamp}</span>
                            {isClinic && (
                              <CheckCheck className="w-3.5 h-3.5 text-[#20B875]" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 border-t border-[#E2EAE5] bg-white relative"
              >
                {attachMenuOpen && (
                  <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-xl border border-[#E2EAE5] shadow-lg p-2 space-y-1 z-20">
                    <p className="px-2 py-1 text-[11px] font-semibold text-[#84938D]">
                      Send clinic attachment
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Northfield_Parking_Map.pdf', 'pdf')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0B6657]" />
                      Clinic Parking Map (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Pre_Visit_Intake_Form.form', 'form')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#0B6657]" />
                      Digital Intake Form
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Appointment_Prep_Guide.pdf', 'pdf')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0B6657]" />
                      Visit Prep Instructions
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((p) => !p)}
                    aria-label="Attach clinic file"
                    className="p-2.5 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-[#84938D] hover:text-[#172B27] transition-colors cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder={`Message ${activePatient.name} on WhatsApp...`}
                    className="flex-1 rounded-xl border border-[#E2EAE5] bg-[#F3F7F4]/50 px-3.5 py-2.5 text-sm text-[#172B27] placeholder:text-[#84938D] focus:outline-none focus:border-[#0B6657]"
                  />

                  <button
                    type="submit"
                    disabled={!composerText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-45 text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#84938D]">
              Select a conversation to begin.
            </div>
          )}
        </section>

        {/* Right Panel: Patient Info & Quick Replies */}
        <section
          className={`${
            mobilePane === 'info' ? 'flex' : 'hidden xl:flex'
          } xl:col-span-3 flex-col bg-white rounded-2xl border border-[#E2EAE5] overflow-y-auto p-4 space-y-5 min-h-0`}
        >
          {activePatient ? (
            <>
              {/* Patient Profile */}
              <div className="flex items-center gap-3">
                <Avatar
                  name={activePatient.name}
                  bgColor={activePatient.avatarColor}
                  size="lg"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#172B27] truncate">
                    {activePatient.name}
                  </h3>
                  <p className="text-xs text-[#84938D] truncate">
                    {activePatient.status} · {activeDoctor?.name ?? 'Unassigned'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs border-t border-[#E2EAE5] pt-4">
                <div className="flex items-center gap-2 text-[#172B27]">
                  <Phone className="w-3.5 h-3.5 text-[#84938D]" />
                  <span className="tabular-nums">{activePatient.phone}</span>
                </div>
                <p className="text-[#84938D] pl-5.5 truncate">{activePatient.email}</p>
                {activePatient.tags.length > 0 && (
                  <p className="text-[#84938D] pt-1">
                    Tags: <span className="text-[#172B27]">{activePatient.tags.join(' · ')}</span>
                  </p>
                )}
              </div>

              {/* Appointment Information */}
              <div className="border-t border-[#E2EAE5] pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#84938D]">
                    Appointment
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      openAppointmentModal({
                        mode: 'create',
                        defaultPatientId: activePatient.id,
                        defaultDoctorId: activePatient.assignedDoctorId,
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Book
                  </button>
                </div>

                {nextAppointment ? (
                  <div className="rounded-xl bg-[#F3F7F4] border border-[#E2EAE5] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#172B27]">
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#0B6657]" />
                        {nextAppointment.date === TODAY_STR ? 'Today' : nextAppointment.date} ·{' '}
                        {nextAppointment.time}
                      </span>
                      <span className="text-[11px] font-medium text-[#0B6657] capitalize">
                        {nextAppointment.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#84938D]">
                      {nextAppointment.category} ·{' '}
                      {getDoctorById(nextAppointment.doctorId)?.name}
                    </p>
                    {nextAppointment.date === TODAY_STR &&
                      nextAppointment.status === 'expected' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAppointmentStatus(nextAppointment.id, 'waiting')
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Check in patient
                        </button>
                      )}
                  </div>
                ) : (
                  <p className="text-xs text-[#84938D]">No upcoming visit scheduled.</p>
                )}
              </div>

              {/* Quick-Reply Suggestions */}
              <div className="border-t border-[#E2EAE5] pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-[#84938D]">
                  Quick-reply suggestions
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => setComposerText(qr.text)}
                      className="px-2.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] hover:border-[#0B6657]/40 text-left text-xs font-medium text-[#172B27] transition-colors cursor-pointer"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Patient Notes */}
              <div className="border-t border-[#E2EAE5] pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#84938D]">Notes</h4>
                  <button
                    type="button"
                    onClick={() => updatePatientNotes(activePatient.id, notesDraft)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#E2EAE5] bg-[#F3F7F4]/50 px-3 py-2 text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                />
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
