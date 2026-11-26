export type NavRoute =
  | 'dashboard'
  | 'inbox'
  | 'patients'
  | 'appointments'
  | 'schedule'
  | 'campaigns'
  | 'reports'
  | 'settings';

export type StaffRole = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type FlowStatus = 'EXPECTED' | 'WAITING' | 'IN_CONSULTATION' | 'SEEN';

export type AppointmentCategory =
  | 'General Consultation'
  | 'Annual Check-up'
  | 'Follow-up'
  | 'Pediatric Care'
  | 'Vaccination'
  | 'Urgent Visit';

export type PatientStatus = 'Active' | 'New' | 'Follow-up' | 'Archived';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  doctorId: string | null;
}

export interface StaffAccount {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: StaffRole;
  doctorId: string | null;
  doctorName: string | null;
  createdAt: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface Doctor {
  id: string;
  userId?: string | null;
  name: string;
  specialty: string;
  room: string;
  avatarUrl?: string | null;
  initials: string;
  color: string;
  availableToday: boolean;
  dailyCapacity: number;
  schedules?: DoctorSchedule[];
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  insuranceProvider: string;
  memberId: string;
  assignedDoctorId: string;
  status: PatientStatus;
  lastAppointment: string;
  tags: string[];
  notes: string;
  avatarColor: string;
  archivedAt?: string | null;
}

export interface PatientVisit {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  flowStatus: FlowStatus;
  expectedAt: string;
  checkedInAt?: string | null;
  consultationStartAt?: string | null;
  completedAt?: string | null;
  waitingMinutes?: number | null;
}

export interface Consultation {
  id: string;
  visitId: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  chiefComplaint: string;
  clinicalNotes: string;
  diagnosis: string;
  followUpPlan: string;
  startedAt: string;
  completedAt?: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  category: AppointmentCategory | string;
  status: AppointmentStatus;
  notes?: string | null;
  remindedAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  visit?: PatientVisit | null;
  consultation?: Consultation | null;
}

export interface InternalMessage {
  id: string;
  senderId?: string | null;
  senderName: string;
  senderRole: string;
  text: string;
  attachmentName?: string | null;
  attachmentType?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  patientId: string | null;
  waitingReply: boolean;
  unreadCount: number;
  lastUpdated: string;
  messages: InternalMessage[];
}

export interface Campaign {
  id: string;
  name: string;
  audience: string;
  recipientCount: number;
  status: CampaignStatus;
  scheduledDate: string;
  messageTemplate: string;
  sentCount: number;
  readCount: number;
  replyCount: number;
  bookingsCount: number;
}

export interface ClinicAnalytics {
  totalAppointmentsToday: number;
  completedAppointmentsToday: number;
  waitingCount: number;
  inConsultationCount: number;
  noShowCountToday: number;
  noShowRate: number;
  totalRegisteredPatients: number;
  averageWaitMinutes: number;
  unreadMessagesCount: number;
  campaignBookings: number;
  appointmentTrends: Array<{
    day: string;
    date: string;
    Scheduled: number;
    Completed: number;
    NoShow: number;
  }>;
  doctorWorkload: Array<{
    id: string;
    name: string;
    specialty: string;
    totalVisits: number;
    todayVisits: number;
    completedVisits: number;
    dailyCapacity: number;
    utilization: number;
  }>;
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  autoReminder24h: boolean;
  autoReminder2h: boolean;
  includeParkingNote: boolean;
  defaultAppointmentDuration: number;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'info' | 'warning' | 'error';
}
