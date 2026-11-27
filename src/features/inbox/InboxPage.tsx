import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
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
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';

type InboxFilter = 'all' | 'unread' | 'waiting';
type MobilePane = 'list' | 'chat' | 'info';

const INTERNAL_TEMPLATES = [
  {
    id: 'tpl-suite',
    label: 'Ready in suite',
    text: 'Patient has completed intake vitals and is ready in the consultation suite.',
  },
  {
    id: 'tpl-labs',
    label: 'Labs attached',
    text: 'Updated lab panel and referral paperwork have been attached to the chart.',
  },
  {
    id: 'tpl-late',
    label: 'Running 10m late',
    text: 'Patient notified reception they are running ~10 minutes behind due to traffic.',
  },
  {
    id: 'tpl-checkin',
    label: 'Front desk note',
    text: 'Please confirm follow-up booking window at checkout before patient departs.',
  },
];

export function InboxPage() {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    createConversation,
    sendMessage,
    patients,
    getPatientById,
    getDoctorById,
    appointments,
    authUser,
    updatePatientNotes,
    openAppointmentModal,
    transitionVisitFlow,
    setProfilePatientId,
  } = useClinic();

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat');
  const [notesDraft, setNotesDraft] = useState('');
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadPatientId, setNewThreadPatientId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const patient = conv.patientId ? getPatientById(conv.patientId) : undefined;
      if (filter === 'unread' && conv.unreadCount === 0) return false;
      if (filter === 'waiting' && !conv.waitingReply) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const lastMsg = conv.messages[conv.messages.length - 1]?.text.toLowerCase() ?? '';
        if (
          !conv.title.toLowerCase().includes(q) &&
          !(patient?.name.toLowerCase().includes(q) ?? false) &&
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
  const activePatient = activeConv?.patientId
    ? getPatientById(activeConv.patientId)
    : undefined;
  const activeDoctor = activePatient?.assignedDoctorId
    ? getDoctorById(activePatient.assignedDoctorId)
    : undefined;

  const nextAppointment = useMemo(() => {
    if (!activePatient) return undefined;
    return appointments
      .filter((a) => a.patientId === activePatient.id && a.status !== 'CANCELLED')
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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConv || !composerText.trim()) return;
    const msgText = composerText;
    setComposerText('');
    await sendMessage(activeConv.id, msgText);
  };

  const handleAttachment = async (
    name: string,
    type: 'pdf' | 'form' | 'location'
  ) => {
    if (!activeConv) return;
    const txt = composerText.trim() || `Attached ${name}`;
    setComposerText('');
    setAttachMenuOpen(false);
    await sendMessage(activeConv.id, txt, { name, type });
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() && !newThreadPatientId) return;
    await createConversation(
      newThreadTitle.trim() || 'Clinic Care Coordination',
      newThreadPatientId || undefined
    );
    setNewThreadOpen(false);
    setNewThreadTitle('');
    setNewThreadPatientId('');
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
        {/* Left Panel: Internal Conversation List */}
        <section
          className={`${
            mobilePane === 'list' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-4 xl:col-span-3 flex-col bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden min-h-0`}
        >
          <div className="p-3.5 border-b border-[#E2EAE5] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-[#172B27]">
                Internal clinic inbox
              </h1>
              <button
                type="button"
                onClick={() => setNewThreadOpen(true)}
                title="New internal conversation"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAF4EF] hover:bg-[#DCECE4] text-[#073C35] text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff threads..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E2EAE5] bg-[#F3F7F4]/60 text-xs text-[#172B27] placeholder:text-[#84938D] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F3F7F4] rounded-xl">
              {([
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'waiting', label: 'Open' },
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
                const patient = conv.patientId
                  ? getPatientById(conv.patientId)
                  : undefined;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isSelected = conv.id === activeConv?.id;
                const timeLabel = format(new Date(conv.lastUpdated), 'HH:mm');

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
                      name={patient?.name ?? conv.title}
                      bgColor={patient?.avatarColor ?? '#EAF4EF'}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#172B27] truncate">
                          {patient?.name ?? conv.title}
                        </p>
                        <span className="text-[11px] text-[#84938D] tabular-nums shrink-0">
                          {timeLabel}
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
          {activeConv ? (
            <>
              <div className="px-4 sm:px-5 py-3 border-b border-[#E2EAE5] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={activePatient?.name ?? activeConv.title}
                    bgColor={activePatient?.avatarColor ?? '#EAF4EF'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172B27] truncate">
                      {activeConv.title}
                    </p>
                    <p className="text-xs text-[#84938D] truncate">
                      Internal clinic care messaging · Database persisted
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
                  {activePatient && (
                    <button
                      type="button"
                      onClick={() => setProfilePatientId(activePatient.id)}
                      className="px-3 py-1.5 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Patient record
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F3F7F4]/60">
                {activeConv.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <MessageSquare className="w-8 h-8 text-[#84938D] mb-2" />
                    <p className="text-sm font-medium text-[#172B27]">
                      Start this internal care coordination thread
                    </p>
                    <p className="text-xs text-[#84938D] mt-1">
                      Messages are visible to authenticated clinic staff only.
                    </p>
                  </div>
                ) : (
                  activeConv.messages.map((msg) => {
                    const isMine =
                      msg.senderId === authUser?.id ||
                      msg.senderName === authUser?.name;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[74%] rounded-2xl px-4 py-2.5 text-sm shadow-2xs ${
                            isMine
                              ? 'bg-[#EAF4EF] border border-[#CBE2D6] text-[#172B27] rounded-br-sm'
                              : 'bg-white border border-[#E2EAE5] text-[#172B27] rounded-bl-sm'
                          }`}
                        >
                          <p className="text-[11px] font-semibold text-[#0B6657] mb-1">
                            {msg.senderName} · {msg.senderRole}
                          </p>
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
                            <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                            <CheckCheck
                              className={`w-3.5 h-3.5 ${
                                msg.isRead ? 'text-[#20B875]' : 'text-[#84938D]'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 border-t border-[#E2EAE5] bg-white relative"
              >
                {attachMenuOpen && (
                  <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-xl border border-[#E2EAE5] shadow-lg p-2 space-y-1 z-20">
                    <p className="px-2 py-1 text-[11px] font-semibold text-[#84938D]">
                      Attach clinic document reference
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Clinic_CheckIn_Checklist.pdf', 'pdf')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0B6657]" />
                      Check-in Checklist (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Intake_Summary.form', 'form')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#0B6657]" />
                      Digital Intake Summary
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAttachment('Lab_Prep_Protocol.pdf', 'pdf')
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#EAF4EF] text-xs text-[#172B27] cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0B6657]" />
                      Lab Prep Protocol
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
                    placeholder="Write an internal clinic note or handoff..."
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
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-[#84938D] gap-3">
              <p>No internal conversations yet.</p>
              <button
                type="button"
                onClick={() => setNewThreadOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
              >
                Create conversation
              </button>
            </div>
          )}
        </section>

        {/* Right Panel: Patient Context & Staff Quick Notes */}
        <section
          className={`${
            mobilePane === 'info' ? 'flex' : 'hidden xl:flex'
          } xl:col-span-3 flex-col bg-white rounded-2xl border border-[#E2EAE5] overflow-y-auto p-4 space-y-5 min-h-0`}
        >
          {activePatient ? (
            <>
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
                        defaultDoctorId:
                          activePatient.assignedDoctorId ?? undefined,
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
                        {nextAppointment.date === todayStr
                          ? 'Today'
                          : nextAppointment.date}{' '}
                        · {nextAppointment.time}
                      </span>
                      <span className="text-[11px] font-medium text-[#0B6657]">
                        {nextAppointment.visit?.flowStatus ?? nextAppointment.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#84938D]">
                      {nextAppointment.category} ·{' '}
                      {getDoctorById(nextAppointment.doctorId)?.name}
                    </p>
                    {nextAppointment.date === todayStr &&
                      nextAppointment.visit?.flowStatus === 'EXPECTED' &&
                      (authUser?.role === 'ADMIN' ||
                        authUser?.role === 'RECEPTIONIST') && (
                        <button
                          type="button"
                          onClick={() =>
                            transitionVisitFlow(nextAppointment.id, 'WAITING')
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

              <div className="border-t border-[#E2EAE5] pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-[#84938D]">
                  Quick staff templates
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTERNAL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setComposerText(tpl.text)}
                      className="px-2.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] hover:border-[#0B6657]/40 text-left text-xs font-medium text-[#172B27] transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

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
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#172B27]">
                Staff quick templates
              </h3>
              <div className="space-y-1.5">
                {INTERNAL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setComposerText(tpl.text)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#EAF4EF] text-left text-xs font-medium text-[#172B27] cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* New Conversation Modal */}
      <Modal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        title="New internal clinic conversation"
        subtitle="Staff-only database-persisted care coordination"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateThread} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Thread title
            </label>
            <input
              type="text"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              placeholder="e.g. Afternoon lab handoff"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Link patient (optional)
            </label>
            <select
              value={newThreadPatientId}
              onChange={(e) => setNewThreadPatientId(e.target.value)}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
            >
              <option value="">General staff thread</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewThreadOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
            >
              Create thread
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
