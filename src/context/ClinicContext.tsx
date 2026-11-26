import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Appointment,
  AppointmentStatus,
  Campaign,
  ClinicNotification,
  ClinicSettings,
  Conversation,
  Doctor,
  NavRoute,
  Patient,
  ToastItem,
  WhatsAppMessage,
} from '../types/clinic';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_CAMPAIGNS,
  INITIAL_CONVERSATIONS,
  INITIAL_DOCTORS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PATIENTS,
  INITIAL_SETTINGS,
  TODAY_STR,
} from '../data/mockClinicData';

export interface AppointmentModalDraft {
  mode: 'create' | 'edit';
  appointment?: Appointment;
  defaultDate?: string;
  defaultTime?: string;
  defaultDoctorId?: string;
  defaultPatientId?: string;
}

export interface PatientModalDraft {
  mode: 'create' | 'edit';
  patient?: Patient;
}

interface ClinicContextValue {
  activeRoute: NavRoute;
  setActiveRoute: (route: NavRoute) => void;

  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  conversations: Conversation[];
  campaigns: Campaign[];
  notifications: ClinicNotification[];
  settings: ClinicSettings;
  toasts: ToastItem[];

  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  openConversationForPatient: (patientId: string) => void;

  appointmentModal: AppointmentModalDraft | null;
  openAppointmentModal: (draft: AppointmentModalDraft) => void;
  closeAppointmentModal: () => void;

  patientModal: PatientModalDraft | null;
  openPatientModal: (draft: PatientModalDraft) => void;
  closePatientModal: () => void;

  profilePatientId: string | null;
  setProfilePatientId: (id: string | null) => void;

  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Appointment actions
  saveAppointment: (
    data: Omit<Appointment, 'id' | 'status'> & { id?: string; status?: AppointmentStatus }
  ) => void;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  cancelAppointment: (id: string) => void;
  remindAllExpectedToday: () => void;
  remindSingleAppointment: (id: string) => void;

  // Patient actions
  savePatient: (data: Omit<Patient, 'id' | 'avatarColor'> & { id?: string }) => Patient;
  updatePatientNotes: (patientId: string, notes: string) => void;
  archivePatient: (patientId: string) => void;
  deletePatient: (patientId: string) => void;

  // Inbox actions
  selectConversation: (id: string) => void;
  sendMessage: (
    conversationId: string,
    text: string,
    attachment?: { name: string; type: 'pdf' | 'form' | 'location' }
  ) => void;

  // Campaign actions
  saveCampaign: (
    data: Omit<Campaign, 'id' | 'sentCount' | 'readCount' | 'replyCount' | 'bookingsCount'> & {
      id?: string;
    }
  ) => void;
  sendCampaignNow: (campaignId: string) => void;
  scheduleCampaign: (campaignId: string, scheduledDate: string) => void;

  // Settings & Doctor actions
  toggleDoctorAvailability: (doctorId: string) => void;
  updateSettings: (next: ClinicSettings) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Computed helpers
  totalUnreadMessages: number;
  unreadNotificationsCount: number;
  getPatientById: (id: string) => Patient | undefined;
  getDoctorById: (id: string) => Doctor | undefined;
}

const ClinicContext = createContext<ClinicContextValue | undefined>(undefined);

const AVATAR_TONES = ['#DCECE4', '#E3EEF3', '#EAF4EF', '#E6ECE8', '#E4EFEA', '#E1ECE7'];

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [notifications, setNotifications] = useState<ClinicNotification[]>(INITIAL_NOTIFICATIONS);
  const [settings, setSettings] = useState<ClinicSettings>(INITIAL_SETTINGS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string>(
    INITIAL_CONVERSATIONS[0].id
  );
  const [appointmentModal, setAppointmentModal] = useState<AppointmentModalDraft | null>(null);
  const [patientModal, setPatientModal] = useState<PatientModalDraft | null>(null);
  const [profilePatientId, setProfilePatientId] = useState<string | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => {
        dismissToast(id);
      }, 3800);
    },
    [dismissToast]
  );

  const getPatientById = useCallback(
    (id: string) => patients.find((p) => p.id === id),
    [patients]
  );

  const getDoctorById = useCallback(
    (id: string) => doctors.find((d) => d.id === id),
    [doctors]
  );

  const openAppointmentModal = useCallback((draft: AppointmentModalDraft) => {
    setAppointmentModal(draft);
  }, []);

  const closeAppointmentModal = useCallback(() => {
    setAppointmentModal(null);
  }, []);

  const openPatientModal = useCallback((draft: PatientModalDraft) => {
    setPatientModal(draft);
  }, []);

  const closePatientModal = useCallback(() => {
    setPatientModal(null);
  }, []);

  const saveAppointment = useCallback(
    (data: Omit<Appointment, 'id' | 'status'> & { id?: string; status?: AppointmentStatus }) => {
      const patient = patients.find((p) => p.id === data.patientId);
      if (data.id) {
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === data.id
              ? {
                  ...apt,
                  ...data,
                  status: data.status ?? apt.status,
                }
              : apt
          )
        );
        addToast({
          title: 'Appointment updated',
          description: `${patient?.name ?? 'Patient'} · ${data.date} at ${data.time}`,
          variant: 'success',
        });
      } else {
        const newApt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: data.patientId,
          doctorId: data.doctorId,
          date: data.date,
          time: data.time,
          durationMinutes: data.durationMinutes,
          category: data.category,
          status: data.status ?? 'expected',
          notes: data.notes,
        };
        setAppointments((prev) => [...prev, newApt]);
        setPatients((prev) =>
          prev.map((p) =>
            p.id === data.patientId && data.date >= p.lastAppointment
              ? { ...p, lastAppointment: data.date }
              : p
          )
        );
        addToast({
          title: 'Appointment scheduled',
          description: `${patient?.name ?? 'Patient'} booked for ${data.date} at ${data.time}`,
          variant: 'success',
        });
      }
      setAppointmentModal(null);
    },
    [patients, addToast]
  );

  const updateAppointmentStatus = useCallback(
    (id: string, status: AppointmentStatus) => {
      const nowTime = format(new Date(), 'HH:mm');
      let targetPatientName = 'Patient';
      setAppointments((prev) =>
        prev.map((apt) => {
          if (apt.id !== id) return apt;
          const p = patients.find((pat) => pat.id === apt.patientId);
          if (p) targetPatientName = p.name;
          return {
            ...apt,
            status,
            checkedInAt: status === 'waiting' ? nowTime : apt.checkedInAt,
          };
        })
      );

      const statusMessages: Record<AppointmentStatus, string> = {
        expected: 'Moved back to Expected',
        waiting: 'Checked into Waiting Room',
        in_consultation: 'Called into consultation',
        seen: 'Marked as Seen',
        cancelled: 'Appointment cancelled',
        no_show: 'Marked as No-show',
      };

      addToast({
        title: targetPatientName,
        description: statusMessages[status],
        variant: status === 'cancelled' || status === 'no_show' ? 'warning' : 'success',
      });
    },
    [patients, addToast]
  );

  const cancelAppointment = useCallback(
    (id: string) => {
      updateAppointmentStatus(id, 'cancelled');
    },
    [updateAppointmentStatus]
  );

  const remindSingleAppointment = useCallback(
    (id: string) => {
      const timeLabel = format(new Date(), 'HH:mm');
      let targetName = 'Patient';
      setAppointments((prev) =>
        prev.map((apt) => {
          if (apt.id !== id) return apt;
          const p = patients.find((pat) => pat.id === apt.patientId);
          if (p) targetName = p.name;
          return { ...apt, remindedAt: `Today ${timeLabel}` };
        })
      );
      addToast({
        title: 'WhatsApp reminder sent',
        description: `Sent check-in reminder to ${targetName}`,
        variant: 'success',
      });
    },
    [patients, addToast]
  );

  const remindAllExpectedToday = useCallback(() => {
    const timeLabel = format(new Date(), 'HH:mm');
    const expectedToday = appointments.filter(
      (a) => a.date === TODAY_STR && a.status === 'expected'
    );
    if (expectedToday.length === 0) {
      addToast({
        title: 'All caught up',
        description: 'No pending expected appointments left to remind today.',
        variant: 'info',
      });
      return;
    }

    setAppointments((prev) =>
      prev.map((apt) =>
        apt.date === TODAY_STR && apt.status === 'expected'
          ? { ...apt, remindedAt: `Today ${timeLabel}` }
          : apt
      )
    );

    addToast({
      title: `Reminders sent to ${expectedToday.length} patients`,
      description: 'WhatsApp appointment reminders queued and delivered.',
      variant: 'success',
    });
  }, [appointments, addToast]);

  const savePatient = useCallback(
    (data: Omit<Patient, 'id' | 'avatarColor'> & { id?: string }) => {
      if (data.id) {
        let updated: Patient | undefined;
        setPatients((prev) =>
          prev.map((p) => {
            if (p.id !== data.id) return p;
            updated = { ...p, ...data };
            return updated;
          })
        );
        addToast({
          title: 'Patient record updated',
          description: data.name,
          variant: 'success',
        });
        setPatientModal(null);
        return updated ?? { ...data, id: data.id, avatarColor: AVATAR_TONES[0] };
      }

      const newPatient: Patient = {
        ...data,
        id: `pat-${Date.now()}`,
        avatarColor: AVATAR_TONES[patients.length % AVATAR_TONES.length],
      };
      setPatients((prev) => [newPatient, ...prev]);
      addToast({
        title: 'Patient added',
        description: `${newPatient.name} registered at Northfield Family Clinic`,
        variant: 'success',
      });
      setPatientModal(null);
      return newPatient;
    },
    [patients.length, addToast]
  );

  const updatePatientNotes = useCallback(
    (patientId: string, notes: string) => {
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, notes } : p)));
      addToast({
        title: 'Clinical notes saved',
        variant: 'success',
      });
    },
    [addToast]
  );

  const archivePatient = useCallback(
    (patientId: string) => {
      const target = patients.find((p) => p.id === patientId);
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, status: 'Archived' } : p))
      );
      if (profilePatientId === patientId) setProfilePatientId(null);
      addToast({
        title: 'Patient archived',
        description: target?.name,
        variant: 'info',
      });
    },
    [patients, profilePatientId, addToast]
  );

  const deletePatient = useCallback(
    (patientId: string) => {
      const target = patients.find((p) => p.id === patientId);
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      setAppointments((prev) => prev.filter((a) => a.patientId !== patientId));
      setConversations((prev) => prev.filter((c) => c.patientId !== patientId));
      if (profilePatientId === patientId) setProfilePatientId(null);
      addToast({
        title: 'Patient deleted',
        description: target?.name,
        variant: 'warning',
      });
    },
    [patients, profilePatientId, addToast]
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const openConversationForPatient = useCallback(
    (patientId: string) => {
      const existing = conversations.find((c) => c.patientId === patientId);
      if (existing) {
        setActiveConversationId(existing.id);
        setConversations((prev) =>
          prev.map((c) => (c.id === existing.id ? { ...c, unreadCount: 0 } : c))
        );
      } else {
        const newConv: Conversation = {
          id: `conv-${Date.now()}`,
          patientId,
          unreadCount: 0,
          waitingReply: false,
          lastUpdated: format(new Date(), 'HH:mm'),
          messages: [],
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
      }
      setActiveRoute('inbox');
    },
    [conversations]
  );

  const sendMessage = useCallback(
    (
      conversationId: string,
      text: string,
      attachment?: { name: string; type: 'pdf' | 'form' | 'location' }
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) return;
      const nowTime = format(new Date(), 'HH:mm');
      const newMsg: WhatsAppMessage = {
        id: `m-${Date.now()}`,
        sender: 'clinic',
        text: trimmed || (attachment ? `Shared ${attachment.name}` : ''),
        timestamp: nowTime,
        status: 'delivered',
        attachmentName: attachment?.name,
        attachmentType: attachment?.type,
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                unreadCount: 0,
                waitingReply: false,
                lastUpdated: nowTime,
                messages: [...conv.messages, newMsg],
              }
            : conv
        )
      );
    },
    []
  );

  const saveCampaign = useCallback(
    (
      data: Omit<Campaign, 'id' | 'sentCount' | 'readCount' | 'replyCount' | 'bookingsCount'> & {
        id?: string;
      }
    ) => {
      if (data.id) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === data.id ? { ...c, ...data } : c))
        );
        addToast({
          title: 'Campaign updated',
          description: data.name,
          variant: 'success',
        });
      } else {
        const newCamp: Campaign = {
          ...data,
          id: `camp-${Date.now()}`,
          sentCount: 0,
          readCount: 0,
          replyCount: 0,
          bookingsCount: 0,
        };
        setCampaigns((prev) => [newCamp, ...prev]);
        addToast({
          title: 'Campaign created',
          description: data.name,
          variant: 'success',
        });
      }
    },
    [addToast]
  );

  const sendCampaignNow = useCallback(
    (campaignId: string) => {
      let campName = 'Campaign';
      setCampaigns((prev) =>
        prev.map((c) => {
          if (c.id !== campaignId) return c;
          campName = c.name;
          const sent = c.recipientCount;
          const read = Math.round(sent * 0.89);
          const replies = Math.round(sent * 0.24);
          const bookings = Math.round(sent * 0.12);
          return {
            ...c,
            status: 'Completed',
            scheduledDate: TODAY_STR,
            sentCount: sent,
            readCount: read,
            replyCount: replies,
            bookingsCount: bookings,
          };
        })
      );
      addToast({
        title: 'Campaign dispatched',
        description: `${campName} sent via WhatsApp Business`,
        variant: 'success',
      });
    },
    [addToast]
  );

  const scheduleCampaign = useCallback(
    (campaignId: string, scheduledDate: string) => {
      let campName = 'Campaign';
      setCampaigns((prev) =>
        prev.map((c) => {
          if (c.id !== campaignId) return c;
          campName = c.name;
          return {
            ...c,
            status: 'Scheduled',
            scheduledDate,
          };
        })
      );
      addToast({
        title: 'Campaign scheduled',
        description: `${campName} set for ${scheduledDate}`,
        variant: 'success',
      });
    },
    [addToast]
  );

  const toggleDoctorAvailability = useCallback(
    (doctorId: string) => {
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctorId ? { ...d, availableToday: !d.availableToday } : d
        )
      );
      addToast({
        title: 'Provider availability updated',
        variant: 'info',
      });
    },
    [addToast]
  );

  const updateSettings = useCallback(
    (next: ClinicSettings) => {
      setSettings(next);
      addToast({
        title: 'Clinic settings saved',
        description: 'Preferences updated for Northfield Family Clinic.',
        variant: 'success',
      });
    },
    [addToast]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const totalUnreadMessages = useMemo(
    () => conversations.reduce((acc, c) => acc + c.unreadCount, 0),
    [conversations]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value: ClinicContextValue = {
    activeRoute,
    setActiveRoute,
    doctors,
    patients,
    appointments,
    conversations,
    campaigns,
    notifications,
    settings,
    toasts,
    activeConversationId,
    setActiveConversationId,
    openConversationForPatient,
    appointmentModal,
    openAppointmentModal,
    closeAppointmentModal,
    patientModal,
    openPatientModal,
    closePatientModal,
    profilePatientId,
    setProfilePatientId,
    addToast,
    dismissToast,
    saveAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    remindAllExpectedToday,
    remindSingleAppointment,
    savePatient,
    updatePatientNotes,
    archivePatient,
    deletePatient,
    selectConversation,
    sendMessage,
    saveCampaign,
    sendCampaignNow,
    scheduleCampaign,
    toggleDoctorAvailability,
    updateSettings,
    markNotificationRead,
    markAllNotificationsRead,
    totalUnreadMessages,
    unreadNotificationsCount,
    getPatientById,
    getDoctorById,
  };

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within a ClinicProvider');
  return ctx;
}
