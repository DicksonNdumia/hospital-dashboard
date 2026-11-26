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
}
