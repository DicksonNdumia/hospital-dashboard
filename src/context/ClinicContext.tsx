import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AuthUser,
  Campaign,
  CampaignStatus,
  ClinicAnalytics,
  ClinicSettings,
  Conversation,
  Doctor,
  DoctorSchedule,
  FlowStatus,
  NavRoute,
  Patient,
  StaffAccount,
  StaffRole,
  ToastItem,
} from '../types/clinic';
import {
  apiRequest,
  getAuthToken,
  setAuthToken,
  setOnUnauthorized,
} from '../lib/api';

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

export type AuthStateStatus =
  | 'loading'
  | 'setup_required'
  | 'unauthenticated'
  | 'authenticated';

const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: 'Northfield Family Clinic',
  address: '410 Northfield Avenue, Suite 200',
  phone: '+1 (555) 200-4800',
  email: 'reception@northfieldclinic.org',
  openingHours: 'Mon-Fri 8:00 AM - 6:00 PM | Sat 9:00 AM - 1:00 PM',
  autoReminder24h: true,
  autoReminder2h: true,
  includeParkingNote: true,
  defaultAppointmentDuration: 30,
};

interface ClinicContextValue {
  authStatus: AuthStateStatus;
  authUser: AuthUser | null;
  defaultAdmin: { name: string; email: string };
  setupInitialAdmin: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  activeRoute: NavRoute;
  setActiveRoute: (route: NavRoute) => void;
  isLoadingData: boolean;
  refreshAllData: () => Promise<void>;

  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  conversations: Conversation[];
  campaigns: Campaign[];
  analytics: ClinicAnalytics | null;
  settings: ClinicSettings;
  staffAccounts: StaffAccount[];
  auditLogs: AuditLogEntry[];
  toasts: ToastItem[];

  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  selectConversation: (id: string) => Promise<void>;
  openConversationForPatient: (patientId: string) => Promise<void>;
  createConversation: (title: string, patientId?: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    text: string,
    attachment?: { name: string; type: 'pdf' | 'form' | 'location' }
  ) => Promise<void>;

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

  // Backend-connected operations
  saveAppointment: (
    data: Omit<Appointment, 'id' | 'status'> & {
      id?: string;
      status?: AppointmentStatus;
    }
  ) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  transitionVisitFlow: (
    appointmentId: string,
    targetStatus: Exclude<FlowStatus, 'EXPECTED'>,
    consultationDetails?: {
      chiefComplaint?: string;
      clinicalNotes?: string;
      diagnosis?: string;
      followUpPlan?: string;
    }
  ) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  remindAllExpectedToday: () => Promise<void>;
  remindSingleAppointment: (id: string) => Promise<void>;

  savePatient: (
    data: Omit<Patient, 'id' | 'avatarColor'> & { id?: string }
  ) => Promise<Patient>;
  updatePatientNotes: (patientId: string, notes: string) => Promise<void>;
  archivePatient: (patientId: string) => Promise<void>;

  saveCampaign: (data: {
    id?: string;
    name: string;
    audience: string;
    recipientCount: number;
    status: CampaignStatus;
    scheduledDate: string;
    messageTemplate: string;
  }) => Promise<void>;
  executeCampaignNow: (campaignId: string) => Promise<void>;
  scheduleCampaign: (campaignId: string, scheduledDate: string) => Promise<void>;
  cancelCampaign: (campaignId: string) => Promise<void>;

  registerDoctor: (data: {
    name: string;
    specialty: string;
    room: string;
    dailyCapacity: number;
  }) => Promise<void>;
  toggleDoctorAvailability: (doctorId: string) => Promise<void>;
  updateDoctorSchedule: (
    doctorId: string,
    schedules: Array<Omit<DoctorSchedule, 'id' | 'doctorId'>>
  ) => Promise<void>;

  updateSettings: (next: ClinicSettings) => Promise<void>;
  registerStaffUser: (data: {
    name: string;
    email: string;
    password: string;
    role: StaffRole;
    specialty?: string;
    room?: string;
  }) => Promise<void>;
  toggleStaffActive: (userId: string, active: boolean) => Promise<void>;

  totalUnreadMessages: number;
  getPatientById: (id: string) => Patient | undefined;
  getDoctorById: (id: string) => Doctor | undefined;
}

const ClinicContext = createContext<ClinicContextValue | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStateStatus>('loading');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [defaultAdmin, setDefaultAdmin] = useState<{ name: string; email: string }>({
    name: 'Dickson Ndumia',
    email: 'dicksonndumia19@gmail.com',
  });
  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<ClinicAnalytics | null>(null);
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [appointmentModal, setAppointmentModal] =
    useState<AppointmentModalDraft | null>(null);
  const [patientModal, setPatientModal] = useState<PatientModalDraft | null>(
    null
  );
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
      }, 4000);
    },
    [dismissToast]
  );

  // Check initial bootstrap / auth state
  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthUser(null);
      setAuthStatus('unauthenticated');
    });

    (async () => {
      try {
        const statusRes = await apiRequest<{
          initialized: boolean;
          defaultAdmin?: { name: string; email: string };
        }>('/api/auth/status');
        if (statusRes.defaultAdmin) {
          setDefaultAdmin(statusRes.defaultAdmin);
        }
        if (!statusRes.initialized) {
          setAuthStatus('setup_required');
          return;
        }
        if (getAuthToken()) {
          const me = await apiRequest<{ user: AuthUser }>('/api/auth/me');
          setAuthUser(me.user);
          setAuthStatus('authenticated');
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch {
        setAuthStatus('unauthenticated');
      }
    })();
  }, []);

  const refreshAllData = useCallback(async () => {
    if (!getAuthToken()) return;
    setIsLoadingData(true);
    try {
      const [
        doctorsRes,
        patientsRes,
        appointmentsRes,
        conversationsRes,
        campaignsRes,
        analyticsRes,
        settingsRes,
      ] = await Promise.all([
        apiRequest<{ doctors: Doctor[] }>('/api/doctors'),
        apiRequest<{ items: Patient[] }>('/api/patients?limit=100'),
        apiRequest<{ appointments: Appointment[] }>('/api/appointments'),
        apiRequest<{ conversations: Conversation[] }>('/api/conversations'),
        apiRequest<{ campaigns: Campaign[] }>('/api/campaigns'),
        apiRequest<ClinicAnalytics>('/api/analytics'),
        apiRequest<{ settings: ClinicSettings | null }>('/api/settings'),
      ]);

      setDoctors(doctorsRes.doctors);
      setPatients(patientsRes.items);
      setAppointments(appointmentsRes.appointments);
      setConversations(conversationsRes.conversations);
      setCampaigns(campaignsRes.campaigns);
      setAnalytics(analyticsRes);
      if (settingsRes.settings) setSettings(settingsRes.settings);

      setActiveConversationId((prev) => {
        if (
          prev &&
          conversationsRes.conversations.some((c) => c.id === prev)
        ) {
          return prev;
        }
        return conversationsRes.conversations[0]?.id ?? '';
      });

      if (authUser?.role === 'ADMIN') {
        const [usersRes, auditRes] = await Promise.all([
          apiRequest<{ users: StaffAccount[] }>('/api/auth/users'),
          apiRequest<{ logs: AuditLogEntry[] }>('/api/audit-logs'),
        ]);
        setStaffAccounts(usersRes.users);
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      addToast({
        title: 'Sync error',
        description:
          err instanceof Error ? err.message : 'Unable to fetch clinic data',
        variant: 'error',
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [authUser?.role, addToast]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      refreshAllData();
    }
  }, [authStatus, refreshAllData]);

  const setupInitialAdmin = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        '/api/auth/setup',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      setAuthToken(res.token);
      setAuthUser(res.user);
      setAuthStatus('authenticated');
      addToast({
        title: `Welcome, ${res.user.name}`,
        description: 'Clinic administrator account configured.',
        variant: 'success',
      });
    },
    [addToast]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      setAuthToken(res.token);
      setAuthUser(res.user);
      setAuthStatus('authenticated');
      setActiveRoute('dashboard');
      addToast({
        title: `Signed in as ${res.user.name}`,
        description: `Role: ${res.user.role}`,
        variant: 'success',
      });
    },
    [addToast]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setAuthUser(null);
    setAuthStatus('unauthenticated');
    setDoctors([]);
    setPatients([]);
    setAppointments([]);
    setConversations([]);
    setCampaigns([]);
    setAnalytics(null);
    setStaffAccounts([]);
    setAuditLogs([]);
  }, []);

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
    async (
      data: Omit<Appointment, 'id' | 'status'> & {
        id?: string;
        status?: AppointmentStatus;
      }
    ) => {
      try {
        if (data.id) {
          await apiRequest(`/api/appointments/${data.id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          });
          addToast({
            title: 'Appointment updated',
            description: `${data.date} at ${data.time}`,
            variant: 'success',
          });
        } else {
          await apiRequest('/api/appointments', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          addToast({
            title: 'Appointment scheduled',
            description: `Booked for ${data.date} at ${data.time}`,
            variant: 'success',
          });
        }
        setAppointmentModal(null);
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Scheduling error',
          description:
            err instanceof Error ? err.message : 'Unable to save appointment',
          variant: 'error',
        });
        throw err;
      }
    },
    [addToast, refreshAllData]
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: AppointmentStatus) => {
      try {
        await apiRequest(`/api/appointments/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        addToast({
          title: 'Appointment updated',
          description: `Status set to ${status}`,
          variant: status === 'CANCELLED' || status === 'NO_SHOW' ? 'warning' : 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Action denied',
          description:
            err instanceof Error ? err.message : 'Could not update status',
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const transitionVisitFlow = useCallback(
    async (
      appointmentId: string,
      targetStatus: Exclude<FlowStatus, 'EXPECTED'>,
      consultationDetails?: {
        chiefComplaint?: string;
        clinicalNotes?: string;
        diagnosis?: string;
        followUpPlan?: string;
      }
    ) => {
      try {
        await apiRequest(`/api/flow/${appointmentId}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            targetStatus,
            ...consultationDetails,
          }),
        });
        const label =
          targetStatus === 'WAITING'
            ? 'Checked into Waiting Room'
            : targetStatus === 'IN_CONSULTATION'
            ? 'Consultation started'
            : 'Consultation completed (Seen)';
        addToast({
          title: 'Patient flow updated',
          description: label,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Flow transition rejected',
          description:
            err instanceof Error ? err.message : 'Invalid status transition',
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const cancelAppointment = useCallback(
    async (id: string) => {
      try {
        await apiRequest(`/api/appointments/${id}`, { method: 'DELETE' });
        addToast({
          title: 'Appointment cancelled',
          description: 'Time slot freed for scheduling.',
          variant: 'warning',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Cancel failed',
          description:
            err instanceof Error ? err.message : 'Unable to cancel appointment',
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const remindSingleAppointment = useCallback(
    async (id: string) => {
      try {
        const res = await apiRequest<{ remindedAt: string }>(
          '/api/appointments/remind-expected',
          {
            method: 'POST',
            body: JSON.stringify({ appointmentId: id }),
          }
        );
        addToast({
          title: 'Reminder logged',
          description: `Recorded at ${res.remindedAt}`,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Reminder failed',
          description:
            err instanceof Error ? err.message : 'Could not log reminder',
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const remindAllExpectedToday = useCallback(async () => {
    try {
      const res = await apiRequest<{ count: number; remindedAt: string }>(
        '/api/appointments/remind-expected',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      addToast({
        title:
          res.count > 0
            ? `Check-in reminders logged for ${res.count} patients`
            : 'No pending expected visits today',
        variant: res.count > 0 ? 'success' : 'info',
      });
      await refreshAllData();
    } catch (err) {
      addToast({
        title: 'Action failed',
        description:
          err instanceof Error ? err.message : 'Could not record reminders',
        variant: 'error',
      });
    }
  }, [addToast, refreshAllData]);

  const savePatient = useCallback(
    async (data: Omit<Patient, 'id' | 'avatarColor'> & { id?: string }) => {
      try {
        let saved: Patient;
        if (data.id) {
          const res = await apiRequest<{ patient: Patient }>(
            `/api/patients/${data.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(data),
            }
          );
          saved = res.patient;
          addToast({
            title: 'Patient updated',
            description: saved.name,
            variant: 'success',
          });
        } else {
          const res = await apiRequest<{ patient: Patient }>('/api/patients', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          saved = res.patient;
          addToast({
            title: 'Patient registered',
            description: saved.name,
            variant: 'success',
          });
        }
        setPatientModal(null);
        await refreshAllData();
        return saved;
      } catch (err) {
        addToast({
          title: 'Patient save failed',
          description:
            err instanceof Error ? err.message : 'Unable to save patient',
          variant: 'error',
        });
        throw err;
      }
    },
    [addToast, refreshAllData]
  );

  const updatePatientNotes = useCallback(
    async (patientId: string, notes: string) => {
      try {
        await apiRequest(`/api/patients/${patientId}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
        addToast({ title: 'Patient notes saved', variant: 'success' });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Notes update failed',
          description:
            err instanceof Error ? err.message : 'Could not update notes',
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const archivePatient = useCallback(
    async (patientId: string) => {
      try {
        const res = await apiRequest<{ patient: Patient }>(
          `/api/patients/${patientId}`,
          { method: 'DELETE' }
        );
        if (profilePatientId === patientId) setProfilePatientId(null);
        addToast({
          title: 'Patient archived',
          description: res.patient.name,
          variant: 'info',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Archive failed',
          description:
            err instanceof Error ? err.message : 'Could not archive patient',
          variant: 'error',
        });
      }
    },
    [profilePatientId, addToast, refreshAllData]
  );

  const selectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      try {
        await apiRequest(`/api/conversations/${id}/read`, { method: 'POST' });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  unreadCount: 0,
                  messages: c.messages.map((m) => ({ ...m, isRead: true })),
                }
              : c
          )
        );
      } catch {
        // ignore read sync error
      }
    },
    []
  );

  const openConversationForPatient = useCallback(
    async (patientId: string) => {
      try {
        const res = await apiRequest<{ conversation: Conversation }>(
          '/api/conversations',
          {
            method: 'POST',
            body: JSON.stringify({ patientId }),
          }
        );
        await refreshAllData();
        await selectConversation(res.conversation.id);
        setActiveRoute('inbox');
      } catch (err) {
        addToast({
          title: 'Could not open thread',
          description:
            err instanceof Error ? err.message : 'Failed to create conversation',
          variant: 'error',
        });
      }
    },
    [refreshAllData, selectConversation, addToast]
  );

  const createConversation = useCallback(
    async (title: string, patientId?: string) => {
      try {
        const res = await apiRequest<{ conversation: Conversation }>(
          '/api/conversations',
          {
            method: 'POST',
            body: JSON.stringify({ title, patientId }),
          }
        );
        await refreshAllData();
        setActiveConversationId(res.conversation.id);
        addToast({ title: 'Internal thread created', variant: 'success' });
      } catch (err) {
        addToast({
          title: 'Failed to create thread',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [refreshAllData, addToast]
  );

  const sendMessage = useCallback(
    async (
      conversationId: string,
      text: string,
      attachment?: { name: string; type: 'pdf' | 'form' | 'location' }
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) return;
      try {
        await apiRequest(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: trimmed || (attachment ? `Shared ${attachment.name}` : ''),
            attachmentName: attachment?.name,
            attachmentType: attachment?.type,
          }),
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Send failed',
          description:
            err instanceof Error ? err.message : 'Unable to send message',
          variant: 'error',
        });
      }
    },
    [refreshAllData, addToast]
  );

  const saveCampaign = useCallback(
    async (data: {
      id?: string;
      name: string;
      audience: string;
      recipientCount: number;
      status: CampaignStatus;
      scheduledDate: string;
      messageTemplate: string;
    }) => {
      try {
        if (data.id) {
          await apiRequest(`/api/campaigns/${data.id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          });
          addToast({
            title: 'Campaign updated',
            description: data.name,
            variant: 'success',
          });
        } else {
          await apiRequest('/api/campaigns', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          addToast({
            title: 'Campaign created',
            description: data.name,
            variant: 'success',
          });
        }
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Campaign save failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const executeCampaignNow = useCallback(
    async (campaignId: string) => {
      try {
        const res = await apiRequest<{ campaign: Campaign }>(
          `/api/campaigns/${campaignId}/execute`,
          { method: 'POST' }
        );
        addToast({
          title: 'Campaign marked completed',
          description: `${res.campaign.name} recorded in database`,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Campaign action failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const scheduleCampaign = useCallback(
    async (campaignId: string, scheduledDate: string) => {
      try {
        await apiRequest(`/api/campaigns/${campaignId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'SCHEDULED', scheduledDate }),
        });
        addToast({
          title: 'Campaign scheduled',
          description: `Scheduled for ${scheduledDate}`,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Schedule failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const cancelCampaign = useCallback(
    async (campaignId: string) => {
      try {
        await apiRequest(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
        addToast({ title: 'Campaign cancelled', variant: 'warning' });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Cancel failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const registerDoctor = useCallback(
    async (data: {
      name: string;
      specialty: string;
      room: string;
      dailyCapacity: number;
    }) => {
      try {
        await apiRequest('/api/doctors', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        addToast({
          title: 'Doctor registered',
          description: data.name,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Registration failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const toggleDoctorAvailability = useCallback(
    async (doctorId: string) => {
      const doc = doctors.find((d) => d.id === doctorId);
      if (!doc) return;
      try {
        await apiRequest(`/api/doctors/${doctorId}`, {
          method: 'PATCH',
          body: JSON.stringify({ availableToday: !doc.availableToday }),
        });
        addToast({
          title: `${doc.name} marked ${!doc.availableToday ? 'On duty' : 'Off today'}`,
          variant: 'info',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Update failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [doctors, addToast, refreshAllData]
  );

  const updateDoctorSchedule = useCallback(
    async (
      doctorId: string,
      schedules: Array<Omit<DoctorSchedule, 'id' | 'doctorId'>>
    ) => {
      try {
        await apiRequest(`/api/doctors/${doctorId}`, {
          method: 'PATCH',
          body: JSON.stringify({ schedules }),
        });
        addToast({ title: 'Working hours saved', variant: 'success' });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Schedule update failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const updateSettings = useCallback(
    async (next: ClinicSettings) => {
      try {
        await apiRequest('/api/settings', {
          method: 'PATCH',
          body: JSON.stringify(next),
        });
        setSettings(next);
        addToast({
          title: 'Clinic settings saved',
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Settings update failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const registerStaffUser = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      role: StaffRole;
      specialty?: string;
      room?: string;
    }) => {
      try {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        addToast({
          title: 'Staff account created',
          description: `${data.name} (${data.role})`,
          variant: 'success',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Registration failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
        throw err;
      }
    },
    [addToast, refreshAllData]
  );

  const toggleStaffActive = useCallback(
    async (userId: string, active: boolean) => {
      try {
        await apiRequest(`/api/auth/users/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ active }),
        });
        addToast({
          title: active ? 'Account enabled' : 'Account suspended',
          variant: 'info',
        });
        await refreshAllData();
      } catch (err) {
        addToast({
          title: 'Update failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    },
    [addToast, refreshAllData]
  );

  const totalUnreadMessages = useMemo(
    () => conversations.reduce((acc, c) => acc + c.unreadCount, 0),
    [conversations]
  );

  const value: ClinicContextValue = {
    authStatus,
    authUser,
    defaultAdmin,
    setupInitialAdmin,
    login,
    logout,
    activeRoute,
    setActiveRoute,
    isLoadingData,
    refreshAllData,
    doctors,
    patients,
    appointments,
    conversations,
    campaigns,
    analytics,
    settings,
    staffAccounts,
    auditLogs,
    toasts,
    activeConversationId,
    setActiveConversationId,
    selectConversation,
    openConversationForPatient,
    createConversation,
    sendMessage,
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
    transitionVisitFlow,
    cancelAppointment,
    remindAllExpectedToday,
    remindSingleAppointment,
    savePatient,
    updatePatientNotes,
    archivePatient,
    saveCampaign,
    executeCampaignNow,
    scheduleCampaign,
    cancelCampaign,
    registerDoctor,
    toggleDoctorAvailability,
    updateDoctorSchedule,
    updateSettings,
    registerStaffUser,
    toggleStaffActive,
    totalUnreadMessages,
    getPatientById,
    getDoctorById,
  };

  return (
    <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within a ClinicProvider');
  return ctx;
}
