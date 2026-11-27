import { prisma } from './db.ts';
import { hashPassword } from './auth.ts';

export const DEFAULT_ADMIN_PROFILE = {
  name: 'Dickson Ndumia',
  email: 'dicksonndumia19@gmail.com',
} as const;

const SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    description: 'Full clinic operations, user registration, campaigns, lab oversight, and configuration',
  },
  {
    name: 'RECEPTIONIST',
    description: 'Manage patients, appointment scheduling, check-ins, and clinic messaging',
  },
  {
    name: 'DOCTOR',
    description: 'View assigned appointments, manage consultations, order/approve lab tests, and clinical notes',
  },
  {
    name: 'LAB_TECHNICIAN',
    description: 'Manage lab test catalog, sample collection, result entry, and PDF report uploads',
  },
  {
    name: 'PATIENT',
    description: 'Self-service patient portal for appointments, released lab reports, profile, and notifications',
  },
];

const STANDARD_LAB_TESTS = [
  {
    code: 'CBC',
    name: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    sampleType: 'Whole Blood (EDTA)',
    unit: '10^9/L / g/dL',
    referenceRange: 'WBC 4.0-11.0 | Hgb 12.0-17.5',
    turnaroundHours: 4,
    priceCents: 3500,
  },
  {
    code: 'CMP',
    name: 'Comprehensive Metabolic Panel (CMP)',
    category: 'Biochemistry',
    sampleType: 'Serum (SST)',
    unit: 'mg/dL / U/L',
    referenceRange: 'Glucose 70-99 | Creatinine 0.6-1.3',
    turnaroundHours: 6,
    priceCents: 4800,
  },
  {
    code: 'LIPID',
    name: 'Lipid Panel',
    category: 'Biochemistry',
    sampleType: 'Fasting Serum',
    unit: 'mg/dL',
    referenceRange: 'Total Chol < 200 | LDL < 100',
    turnaroundHours: 6,
    priceCents: 4200,
  },
  {
    code: 'HBA1C',
    name: 'Hemoglobin A1c',
    category: 'Endocrinology',
    sampleType: 'Whole Blood (EDTA)',
    unit: '%',
    referenceRange: '4.0 - 5.6 %',
    turnaroundHours: 8,
    priceCents: 3900,
  },
  {
    code: 'TSH',
    name: 'Thyroid Stimulating Hormone (TSH)',
    category: 'Endocrinology',
    sampleType: 'Serum (SST)',
    unit: 'mIU/L',
    referenceRange: '0.40 - 4.50 mIU/L',
    turnaroundHours: 8,
    priceCents: 4500,
  },
  {
    code: 'UA',
    name: 'Urinalysis Complete',
    category: 'Microbiology',
    sampleType: 'Clean-Catch Urine',
    unit: 'Qualitative / HPF',
    referenceRange: 'Protein Negative | Glucose Negative',
    turnaroundHours: 2,
    priceCents: 2500,
  },
];

export async function ensureSeeded(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
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
      requirePatientBookingApproval: true,
    },
  });

  // Seed clinical reference lab test catalog if empty (no fake patients or doctors)
  const labTestCount = await prisma.labTest.count();
  if (labTestCount === 0) {
    await prisma.labTest.createMany({
      data: STANDARD_LAB_TESTS,
    });
  }
}
