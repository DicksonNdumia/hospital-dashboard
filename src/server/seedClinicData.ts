import { addDays, format, startOfWeek } from 'date-fns';
import { prisma } from './db.ts';
import { hashPassword } from './auth.ts';

export const DEFAULT_ADMIN_PROFILE = {
  name: 'Dickson Ndumia',
  email: 'dicksonndumia19@gmail.com',
} as const;

export async function ensureSeeded(): Promise<void> {
  const roleCount = await prisma.role.count();
  if (roleCount === 0) {
    await prisma.role.createMany({
      data: [
        {
          name: 'ADMIN',
          description: 'Full clinic operations, user registration, campaigns, and configuration',
        },
        {
          name: 'RECEPTIONIST',
          description: 'Manage patients, appointment scheduling, check-ins, and clinic messaging',
        },
        {
          name: 'DOCTOR',
          description: 'View assigned appointments, manage consultations, and patient clinical notes',
        },
      ],
    });
  }

  // Ensure any legacy default admin record is updated to the configured default admin profile
  const legacyAdmin = await prisma.user.findUnique({
    where: { email: 'nadia@northfieldclinic.org' },
  });
  if (legacyAdmin) {
    const targetExists = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_PROFILE.email },
    });
    if (!targetExists) {
      await prisma.user.update({
        where: { id: legacyAdmin.id },
        data: {
          name: DEFAULT_ADMIN_PROFILE.name,
          email: DEFAULT_ADMIN_PROFILE.email,
        },
      });
    }
  }

  // Optional environment-provided admin bootstrap password (never hardcoded)
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (bootstrapPassword && bootstrapPassword.length >= 8) {
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (adminRole) {
      const adminCount = await prisma.user.count({ where: { roleId: adminRole.id } });
      if (adminCount === 0) {
        await prisma.user.create({
          data: {
            email: DEFAULT_ADMIN_PROFILE.email,
            name: DEFAULT_ADMIN_PROFILE.name,
            passwordHash: hashPassword(bootstrapPassword),
            roleId: adminRole.id,
            active: true,
          },
        });
      }
    }
  }

  await prisma.clinicSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      clinicName: 'Northfield Family Clinic',
      address: '410 Northfield Avenue, Suite 200',
      phone: '+1 (555) 200-4800',
      email: 'reception@northfieldclinic.org',
      openingHours: 'Mon-Fri 8:00 AM - 6:00 PM | Sat 9:00 AM - 1:00 PM',
      autoReminder24h: true,
      autoReminder2h: true,
      includeParkingNote: true,
      defaultAppointmentDuration: 30,
    },
  });

  const doctorCount = await prisma.doctor.count();
  if (doctorCount > 0) return;

  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const todayStr = fmt(today);
  const tomorrowStr = fmt(addDays(today, 1));
  const weekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const mondayStr = fmt(weekMonday);
  const tuesdayStr = fmt(addDays(weekMonday, 1));
  const wednesdayStr = fmt(addDays(weekMonday, 2));
  const fridayStr = fmt(addDays(weekMonday, 4));
  const nextMondayStr = fmt(addDays(weekMonday, 7));

  const doctorsData = [
    {
      id: 'doc-elena',
      name: 'Dr. Elena Vance',
      specialty: 'Family Medicine',
      room: 'Suite 101',
      avatarUrl: '/src/assets/images/avatar_dr_elena_1795723059698.jpg',
      initials: 'EV',
      color: '#0B6657',
      availableToday: true,
      dailyCapacity: 12,
    },
    {
      id: 'doc-marcus',
      name: 'Dr. Marcus Thorne',
      specialty: 'Internal Medicine',
      room: 'Suite 104',
      avatarUrl: '/src/assets/images/avatar_dr_marcus_1795723059545.jpg',
      initials: 'MT',
      color: '#1D6B87',
      availableToday: true,
      dailyCapacity: 10,
    },
    {
      id: 'doc-priya',
      name: 'Dr. Priya Nair',
      specialty: 'Pediatrics',
      room: 'Suite 108',
      avatarUrl: '/src/assets/images/avatar_dr_priya_1795723059892.jpg',
      initials: 'PN',
      color: '#20B875',
      availableToday: true,
      dailyCapacity: 12,
    },
    {
      id: 'doc-samuel',
      name: 'Dr. Samuel Okafor',
      specialty: 'Preventive Care',
      room: 'Suite 112',
      initials: 'SO',
      color: '#4E7A69',
      availableToday: false,
      dailyCapacity: 8,
    },
  ];

  for (const doc of doctorsData) {
    await prisma.doctor.create({
      data: {
        ...doc,
        schedules: {
          create: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek,
            startTime: dayOfWeek === 6 ? '09:00' : '08:00',
            endTime: dayOfWeek === 6 ? '13:00' : '17:30',
            isActive: doc.id === 'doc-samuel' ? dayOfWeek !== new Date().getDay() : dayOfWeek !== 6 || doc.id !== 'doc-marcus',
          })),
        },
      },
    });
  }

  const patientsData = [
    {
      id: 'pat-1',
      name: 'Clara Henderson',
      phone: '+1 (555) 234-8910',
      email: 'clara.henderson@example.com',
      dateOfBirth: '1986-04-12',
      insuranceProvider: 'BlueCross Family',
      memberId: 'BCF-882410',
      assignedDoctorId: 'doc-elena',
      status: 'Active',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Hypertension', 'Morning preferred']),
      notes: 'Blood pressure cuff readings logged weekly. Prefers morning slots.',
      avatarColor: '#DCECE4',
    },
    {
      id: 'pat-2',
      name: 'Liam Gallagher',
      phone: '+1 (555) 391-4420',
      email: 'liam.g@example.com',
      dateOfBirth: '2018-09-03',
      insuranceProvider: 'Aetna Care',
      memberId: 'AC-519022',
      assignedDoctorId: 'doc-priya',
      status: 'Active',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Pediatric', 'Asthma plan']),
      notes: 'Guardian contact: Hannah Gallagher. Needs updated school inhaler clearance form.',
      avatarColor: '#E3EEF3',
    },
    {
      id: 'pat-3',
      name: 'Amara Patel',
      phone: '+1 (555) 604-7712',
      email: 'amara.patel@example.com',
      dateOfBirth: '1992-11-19',
      insuranceProvider: 'UnitedHealth',
      memberId: 'UH-394821',
      assignedDoctorId: 'doc-marcus',
      status: 'Follow-up',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Lab review', 'Thyroid panel']),
      notes: 'Fasting lipid & TSH results received yesterday. Review dosage during visit.',
      avatarColor: '#EAF4EF',
    },
    {
      id: 'pat-4',
      name: 'Robert Mercer',
      phone: '+1 (555) 488-1934',
      email: 'r.mercer@example.com',
      dateOfBirth: '1964-02-28',
      insuranceProvider: 'Medicare Plus',
      memberId: 'MP-774109',
      assignedDoctorId: 'doc-elena',
      status: 'Active',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Diabetes care', 'Quarterly labs']),
      notes: 'Accessibility parking near west entrance.',
      avatarColor: '#E6ECE8',
    },
    {
      id: 'pat-5',
      name: 'Sofia Lindqvist',
      phone: '+1 (555) 712-3095',
      email: 'sofia.lindqvist@example.com',
      dateOfBirth: '1995-07-08',
      insuranceProvider: 'Cigna Health',
      memberId: 'CH-120495',
      assignedDoctorId: 'doc-marcus',
      status: 'New',
      lastAppointment: todayStr,
      tags: JSON.stringify(['New patient', 'Travel vaccine']),
      notes: 'Digital intake form completed prior to visit.',
      avatarColor: '#E4EFEA',
    },
    {
      id: 'pat-6',
      name: 'David Morales',
      phone: '+1 (555) 823-6104',
      email: 'david.morales@example.com',
      dateOfBirth: '1979-12-15',
      insuranceProvider: 'BlueCross Family',
      memberId: 'BCF-664219',
      assignedDoctorId: 'doc-elena',
      status: 'Active',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Annual wellness']),
      notes: 'Confirmed attendance at 08:15 AM.',
      avatarColor: '#E1ECE7',
    },
    {
      id: 'pat-7',
      name: 'Mei-Ling Zhou',
      phone: '+1 (555) 945-2281',
      email: 'meiling.zhou@example.com',
      dateOfBirth: '1988-05-24',
      insuranceProvider: 'Aetna Care',
      memberId: 'AC-903418',
      assignedDoctorId: 'doc-priya',
      status: 'Active',
      lastAppointment: todayStr,
      tags: JSON.stringify(['Family plan', 'Immunization']),
      notes: 'Bringing daughter Maya for 4-year booster.',
      avatarColor: '#E8F1EC',
    },
    {
      id: 'pat-8',
      name: 'Thomas Brennan',
      phone: '+1 (555) 309-5547',
      email: 't.brennan@example.com',
      dateOfBirth: '1957-08-11',
      insuranceProvider: 'Medicare Plus',
      memberId: 'MP-338120',
      assignedDoctorId: 'doc-marcus',
      status: 'Follow-up',
      lastAppointment: fmt(addDays(today, -14)),
      tags: JSON.stringify(['Cardiology referral', 'BP check']),
      notes: 'Requires printed copy of ECG referral.',
      avatarColor: '#E5EDE9',
    },
    {
      id: 'pat-9',
      name: 'Hannah Al-Mansoor',
      phone: '+1 (555) 672-9083',
      email: 'hannah.almansoor@example.com',
      dateOfBirth: '1990-01-30',
      insuranceProvider: 'Cigna Health',
      memberId: 'CH-558210',
      assignedDoctorId: 'doc-elena',
      status: 'Active',
      lastAppointment: fmt(addDays(today, -21)),
      tags: JSON.stringify(['Prenatal check', 'Afternoon']),
      notes: 'Iron supplement follow-up.',
      avatarColor: '#E0ECE6',
    },
    {
      id: 'pat-10',
      name: 'Ethan Brooks',
      phone: '+1 (555) 519-4802',
      email: 'ethan.brooks@example.com',
      dateOfBirth: '2014-06-17',
      insuranceProvider: 'UnitedHealth',
      memberId: 'UH-612390',
      assignedDoctorId: 'doc-priya',
      status: 'Active',
      lastAppointment: fmt(addDays(today, -30)),
      tags: JSON.stringify(['Sports physical']),
      notes: 'Middle school athletics physical form signed.',
      avatarColor: '#E6F0EB',
    },
  ];

  await prisma.patient.createMany({ data: patientsData });

  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  const appointmentsData = [
    {
      id: 'apt-101',
      patientId: 'pat-6',
      doctorId: 'doc-elena',
      date: todayStr,
      time: '08:30',
      durationMinutes: 30,
      category: 'Annual Check-up',
      status: 'COMPLETED',
      notes: 'Vitals stable, routine bloodwork ordered.',
      flowStatus: 'SEEN',
      checkedInAt: minsAgo(180),
      consultationStartAt: minsAgo(170),
      completedAt: minsAgo(142),
      waitingMinutes: 10,
    },
    {
      id: 'apt-102',
      patientId: 'pat-7',
      doctorId: 'doc-priya',
      date: todayStr,
      time: '09:00',
      durationMinutes: 20,
      category: 'Vaccination',
      status: 'COMPLETED',
      notes: 'DTaP booster administered, observation complete.',
      flowStatus: 'SEEN',
      checkedInAt: minsAgo(145),
      consultationStartAt: minsAgo(139),
      completedAt: minsAgo(118),
      waitingMinutes: 6,
    },
    {
      id: 'apt-103',
      patientId: 'pat-3',
      doctorId: 'doc-marcus',
      date: todayStr,
      time: '09:30',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'CONFIRMED',
      notes: 'Reviewing TSH & lipid lab panel.',
      flowStatus: 'IN_CONSULTATION',
      checkedInAt: minsAgo(35),
      consultationStartAt: minsAgo(24),
      completedAt: null,
      waitingMinutes: 11,
    },
    {
      id: 'apt-104',
      patientId: 'pat-1',
      doctorId: 'doc-elena',
      date: todayStr,
      time: '10:00',
      durationMinutes: 30,
      category: 'General Consultation',
      status: 'CONFIRMED',
      notes: 'Quarterly blood pressure management review.',
      flowStatus: 'IN_CONSULTATION',
      checkedInAt: minsAgo(28),
      consultationStartAt: minsAgo(19),
      completedAt: null,
      waitingMinutes: 9,
    },
    {
      id: 'apt-105',
      patientId: 'pat-4',
      doctorId: 'doc-elena',
      date: todayStr,
      time: '10:30',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'CONFIRMED',
      notes: 'Arrived early; A1C check completed by nurse.',
      flowStatus: 'WAITING',
      checkedInAt: minsAgo(14),
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-106',
      patientId: 'pat-2',
      doctorId: 'doc-priya',
      date: todayStr,
      time: '10:45',
      durationMinutes: 30,
      category: 'Pediatric Care',
      status: 'CONFIRMED',
      notes: 'Asthma action plan renewal for school.',
      flowStatus: 'WAITING',
      checkedInAt: minsAgo(8),
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-107',
      patientId: 'pat-5',
      doctorId: 'doc-marcus',
      date: todayStr,
      time: '11:30',
      durationMinutes: 30,
      category: 'Vaccination',
      status: 'SCHEDULED',
      notes: 'Travel immunization consultation (Hep A / Typhoid).',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-108',
      patientId: 'pat-8',
      doctorId: 'doc-marcus',
      date: todayStr,
      time: '13:30',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'CONFIRMED',
      notes: 'Cardiology referral follow-up & ECG review.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-109',
      patientId: 'pat-9',
      doctorId: 'doc-elena',
      date: todayStr,
      time: '14:15',
      durationMinutes: 30,
      category: 'General Consultation',
      status: 'SCHEDULED',
      notes: 'Prenatal wellness and iron panel.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-110',
      patientId: 'pat-10',
      doctorId: 'doc-priya',
      date: todayStr,
      time: '15:00',
      durationMinutes: 20,
      category: 'Pediatric Care',
      status: 'NO_SHOW',
      notes: 'Patient family called to reschedule for next week.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-201',
      patientId: 'pat-1',
      doctorId: 'doc-elena',
      date: mondayStr,
      time: '09:00',
      durationMinutes: 30,
      category: 'Annual Check-up',
      status: 'COMPLETED',
      notes: 'Routine physical.',
      flowStatus: 'SEEN',
      checkedInAt: minsAgo(2000),
      consultationStartAt: minsAgo(1992),
      completedAt: minsAgo(1962),
      waitingMinutes: 8,
    },
    {
      id: 'apt-202',
      patientId: 'pat-2',
      doctorId: 'doc-priya',
      date: tuesdayStr,
      time: '10:30',
      durationMinutes: 30,
      category: 'Pediatric Care',
      status: 'COMPLETED',
      notes: 'Follow-up check.',
      flowStatus: 'SEEN',
      checkedInAt: minsAgo(1600),
      consultationStartAt: minsAgo(1594),
      completedAt: minsAgo(1564),
      waitingMinutes: 6,
    },
    {
      id: 'apt-203',
      patientId: 'pat-8',
      doctorId: 'doc-marcus',
      date: wednesdayStr,
      time: '11:00',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'COMPLETED',
      notes: 'BP medication check.',
      flowStatus: 'SEEN',
      checkedInAt: minsAgo(1200),
      consultationStartAt: minsAgo(1193),
      completedAt: minsAgo(1165),
      waitingMinutes: 7,
    },
    {
      id: 'apt-204',
      patientId: 'pat-4',
      doctorId: 'doc-elena',
      date: fridayStr,
      time: '09:30',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'CONFIRMED',
      notes: 'Diabetes care follow-up.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-205',
      patientId: 'pat-6',
      doctorId: 'doc-marcus',
      date: tomorrowStr,
      time: '10:00',
      durationMinutes: 30,
      category: 'Urgent Visit',
      status: 'SCHEDULED',
      notes: 'Acute sinus evaluation.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-206',
      patientId: 'pat-10',
      doctorId: 'doc-priya',
      date: nextMondayStr,
      time: '09:00',
      durationMinutes: 30,
      category: 'Pediatric Care',
      status: 'CONFIRMED',
      notes: 'Confirmed for Monday morning.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
    {
      id: 'apt-207',
      patientId: 'pat-3',
      doctorId: 'doc-marcus',
      date: nextMondayStr,
      time: '10:30',
      durationMinutes: 30,
      category: 'Follow-up',
      status: 'CONFIRMED',
      notes: 'Confirmed for Monday.',
      flowStatus: 'EXPECTED',
      checkedInAt: null,
      consultationStartAt: null,
      completedAt: null,
      waitingMinutes: null,
    },
  ];

  for (const a of appointmentsData) {
    await prisma.appointment.create({
      data: {
        id: a.id,
        patientId: a.patientId,
        doctorId: a.doctorId,
        date: a.date,
        time: a.time,
        durationMinutes: a.durationMinutes,
        category: a.category,
        status: a.status,
        notes: a.notes,
        visit: {
          create: {
            patientId: a.patientId,
            doctorId: a.doctorId,
            flowStatus: a.flowStatus,
            checkedInAt: a.checkedInAt,
            consultationStartAt: a.consultationStartAt,
            completedAt: a.completedAt,
            waitingMinutes: a.waitingMinutes,
          },
        },
      },
    });
  }

  // Seed sample consultations for completed/active visits
  const seenVisits = await prisma.patientVisit.findMany({
    where: { flowStatus: { in: ['SEEN', 'IN_CONSULTATION'] } },
    take: 2,
  });

  for (const v of seenVisits) {
    await prisma.consultation.create({
      data: {
        visitId: v.id,
        appointmentId: v.appointmentId,
        doctorId: v.doctorId,
        patientId: v.patientId,
        chiefComplaint: 'Routine clinical check-in and vitals assessment',
        clinicalNotes: 'Patient stable. Reviewed medication adherence and lab panel.',
        diagnosis: 'Routine health supervision',
        followUpPlan: 'Follow up in 3 months or sooner if symptoms change.',
        startedAt: v.consultationStartAt ?? now,
        completedAt: v.completedAt,
      },
    });
  }

  // Campaigns (stored and managed in DB only)
  const campaignsData = [
    {
      id: 'camp-1',
      name: 'Annual check-up reminders',
      audience: 'Patients overdue > 11 months',
      recipientCount: 340,
      status: 'COMPLETED',
      scheduledDate: fmt(addDays(today, -3)),
      messageTemplate:
        'Hello {{first_name}}, it has been a year since your last wellness check at Northfield Family Clinic. Please contact reception to reserve a morning slot.',
      sentCount: 340,
      readCount: 312,
      replyCount: 84,
      bookingsCount: 46,
    },
    {
      id: 'camp-2',
      name: 'Well-child check-ups',
      audience: 'Pediatric patients (ages 2-12)',
      recipientCount: 185,
      status: 'SCHEDULED',
      scheduledDate: todayStr,
      messageTemplate:
        'Hi {{first_name}}, Dr. Priya Nair has open afternoon slots this week for seasonal well-child check-ups and school physicals.',
      sentCount: 142,
      readCount: 126,
      replyCount: 39,
      bookingsCount: 24,
    },
    {
      id: 'camp-3',
      name: 'Holiday hours',
      audience: 'All active clinic patients',
      recipientCount: 820,
      status: 'SCHEDULED',
      scheduledDate: fmt(addDays(today, 4)),
      messageTemplate:
        'Notice from Northfield Family Clinic: Our clinic will operate 8:30 AM - 1:00 PM on upcoming holiday dates.',
      sentCount: 0,
      readCount: 0,
      replyCount: 0,
      bookingsCount: 0,
    },
    {
      id: 'camp-4',
      name: 'Appointment reminders',
      audience: 'Next-day scheduled visits',
      recipientCount: 64,
      status: 'DRAFT',
      scheduledDate: tomorrowStr,
      messageTemplate:
        'Reminder: You have an appointment at Northfield Family Clinic tomorrow at {{time}} with {{doctor}}.',
      sentCount: 0,
      readCount: 0,
      replyCount: 0,
      bookingsCount: 0,
    },
  ];

  for (const camp of campaignsData) {
    await prisma.campaign.create({
      data: camp,
    });
  }

  // Link sample CampaignRecipients to camp-1
  await prisma.campaignRecipient.createMany({
    data: patientsData.slice(0, 5).map((p, i) => ({
      campaignId: 'camp-1',
      patientId: p.id,
      deliveryStatus: i < 2 ? 'BOOKED' : i < 4 ? 'READ' : 'SENT',
      sentAt: minsAgo(4000),
      readAt: i < 4 ? minsAgo(3900) : null,
    })),
  });

  // Internal Clinic Messaging Conversations (DB only, no external providers)
  const convos = [
    {
      id: 'conv-1',
      title: 'Sofia Lindqvist — Front Desk & Dr. Thorne',
      patientId: 'pat-5',
      waitingReply: true,
      messages: [
        {
          senderName: 'Front Desk (Reception)',
          senderRole: 'RECEPTIONIST',
          text: 'Sofia confirmed her 11:30 AM travel immunization visit and asked whether accessible parking is open behind the West Door.',
          isRead: true,
        },
        {
          senderName: 'Dr. Marcus Thorne',
          senderRole: 'DOCTOR',
          text: 'Thanks! Please ask her to bring her prior immunization booklet to Suite 104 when she checks in.',
          isRead: false,
        },
      ],
    },
    {
      id: 'conv-2',
      title: 'Thomas Brennan — Schedule Coordination',
      patientId: 'pat-8',
      waitingReply: true,
      messages: [
        {
          senderName: 'Front Desk (Reception)',
          senderRole: 'RECEPTIONIST',
          text: 'Thomas called to say traffic on Northfield Ave may delay him by 10 minutes for his 1:30 PM follow-up.',
          isRead: false,
        },
      ],
    },
    {
      id: 'conv-3',
      title: 'Liam Gallagher — Suite 108 Intake',
      patientId: 'pat-2',
      waitingReply: false,
      messages: [
        {
          senderName: 'Front Desk (Reception)',
          senderRole: 'RECEPTIONIST',
          text: 'Liam Gallagher has checked in at reception for 10:45 AM pediatric visit.',
          isRead: true,
        },
        {
          senderName: 'Dr. Priya Nair',
          senderRole: 'DOCTOR',
          text: 'Got it, calling Liam into Suite 108 shortly once school inhaler form is printed.',
          isRead: true,
        },
      ],
    },
    {
      id: 'conv-4',
      title: 'Hannah Al-Mansoor — Prenatal Prep Note',
      patientId: 'pat-9',
      waitingReply: true,
      messages: [
        {
          senderName: 'Dr. Elena Vance',
          senderRole: 'DOCTOR',
          text: 'Please ensure iron panel lab orders are attached to Hannah’s 2:15 PM chart before check-in.',
          isRead: false,
        },
      ],
    },
  ];

  for (const conv of convos) {
    await prisma.conversation.create({
      data: {
        id: conv.id,
        title: conv.title,
        patientId: conv.patientId,
        waitingReply: conv.waitingReply,
        messages: {
          create: conv.messages,
        },
      },
    });
  }
}
