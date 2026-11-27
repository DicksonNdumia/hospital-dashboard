export type NavRoute =
  | 'dashboard'
  | 'inbox'
  | 'patients'
  | 'appointments'
  | 'schedule'
  | 'laboratory'
  | 'campaigns'
  | 'reports'
  | 'settings'
  | 'portal_dashboard'
  | 'portal_appointments'
  | 'portal_labs'
  | 'portal_notifications'
  | 'portal_profile';

export type StaffRole =
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'DOCTOR'
  | 'LAB_TECHNICIAN'
  | 'PATIENT';

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

export type LabOrderStatus =
  | 'REQUESTED'
  | 'SAMPLE_COLLECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'RELEASED';

export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type LabResultFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  doctorId: string | null;
  patientId: string | null;
}

export interface StaffAccount {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: StaffRole;
  doctorId: string | null;
  doctorName: string | null;
  patientId: string | null;
  patientName: string | null;
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
  userId?: string | null;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  insuranceProvider: string;
  memberId: string;
  assignedDoctorId: string | null;
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
  bookingSource?: string;
  notes?: string | null;
  remindedAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  visit?: PatientVisit | null;
  consultation?: Consultation | null;
  doctor?: { id: string; name: string; specialty: string; room: string } | null;
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
  pendingLabOrders?: number;
  underReviewLabOrders?: number;
  releasedLabOrders?: number;
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
  requirePatientBookingApproval?: boolean;
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

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  sampleType: string;
  unit: string;
  referenceRange: string;
  turnaroundHours: number;
  priceCents: number;
  active: boolean;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  parameterName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: LabResultFlag;
  notes: string;
  enteredById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabReport {
  id: string;
  labOrderId: string;
  patientId: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  labTestId: string;
  technicianId?: string | null;
  status: LabOrderStatus;
  priority: LabPriority;
  clinicalIndication: string;
  sampleId?: string | null;
  sampleCollectedAt?: string | null;
  processingStartedAt?: string | null;
  completedAt?: string | null;
  reviewStartedAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  releasedAt?: string | null;
  doctorReviewNotes: string;
  createdAt: string;
  updatedAt: string;
  labTest: LabTest;
  patient?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  doctor: {
    id: string;
    name: string;
    specialty: string;
    room?: string;
  };
  technician?: {
    id: string;
    name: string;
    email: string;
  } | null;
  approvedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  results: LabResult[];
  reports: LabReport[];
}

export interface LabTechnicianOption {
  id: string;
  name: string;
  email: string;
}

export interface NotificationPreference {
  appointmentUpdates: boolean;
  labReportAlerts: boolean;
  campaignAnnouncements: boolean;
}

export interface PatientNotification {
  id: string;
  patientId: string;
  campaignId?: string | null;
  type: 'CAMPAIGN' | 'LAB_REPORT' | 'APPOINTMENT' | 'SYSTEM';
  title: string;
  message: string;
  actionRoute?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  campaign?: {
    id: string;
    name: string;
    audience: string;
    scheduledDate: string;
    messageTemplate: string;
  } | null;
}

export interface ReleasedLabReportItem extends LabReport {
  orderNumber: string;
  testName: string;
  testCode: string;
  doctorName: string;
  releasedAt?: string | null;
  status: LabOrderStatus;
}

export interface PortalOverview {
  patient: {
    id: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    insuranceProvider: string;
    memberId: string;
    status: string;
    assignedDoctor?: {
      id: string;
      name: string;
      specialty: string;
      room: string;
    } | null;
  };
  notificationPreference: NotificationPreference;
  appointments: Appointment[];
  labOrders: LabOrder[];
  releasedReports: ReleasedLabReportItem[];
  notifications: PatientNotification[];
  requirePatientBookingApproval: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'info' | 'warning' | 'error';
}

