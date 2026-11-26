export type NavRoute =
  | 'dashboard'
  | 'inbox'
  | 'patients'
  | 'appointments'
  | 'schedule'
  | 'campaigns'
  | 'reports'
  | 'settings';

export type AppointmentStatus =
  | 'expected'
  | 'waiting'
  | 'in_consultation'
  | 'seen'
  | 'cancelled'
  | 'no_show';

export type AppointmentCategory =
  | 'General Consultation'
  | 'Annual Check-up'
  | 'Follow-up'
  | 'Pediatric Care'
  | 'Vaccination'
  | 'Urgent Visit';

export type PatientStatus = 'Active' | 'New' | 'Follow-up' | 'Archived';

export type CampaignStatus = 'Active' | 'Scheduled' | 'Completed' | 'Draft';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  room: string;
  avatarUrl?: string;
  initials: string;
  color: string;
  availableToday: boolean;
  dailyCapacity: number;
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
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  category: AppointmentCategory;
  status: AppointmentStatus;
  notes?: string;
  remindedAt?: string;
  checkedInAt?: string;
}

export interface WhatsAppMessage {
  id: string;
  sender: 'patient' | 'clinic';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  attachmentName?: string;
  attachmentType?: 'pdf' | 'form' | 'location';
}

export interface Conversation {
  id: string;
  patientId: string;
  unreadCount: number;
  waitingReply: boolean;
  lastUpdated: string;
  messages: WhatsAppMessage[];
}

export interface Campaign {
  id: string;
  name: string;
  audience: string;
  recipientCount: number;
  status: CampaignStatus;
  scheduledDate: string; // YYYY-MM-DD
  messageTemplate: string;
  sentCount: number;
  readCount: number;
  replyCount: number;
  bookingsCount: number;
}

export interface ClinicNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  route?: NavRoute;
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  openingHours: string;
  autoReminder24h: boolean;
  autoReminder2h: boolean;
  includeParkingNote: boolean;
  defaultAppointmentDuration: number;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'info' | 'warning' | 'error';
}
