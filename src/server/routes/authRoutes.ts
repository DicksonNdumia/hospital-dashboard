import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import {
  type AuthenticatedRequest,
  type StaffRole,
  createSession,
  hashPassword,
  requireAuth,
  requireRole,
  revokeSession,
  verifyPassword,
} from '../auth.ts';
import { writeAuditLog } from '../audit.ts';
import { DEFAULT_ADMIN_PROFILE } from '../seedClinicData.ts';

const router = Router();

const setupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_TECHNICIAN', 'PATIENT']),
  doctorId: z.string().optional(),
  specialty: z.string().optional(),
  room: z.string().optional(),
  patientId: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  insuranceProvider: z.string().optional(),
  memberId: z.string().optional(),
  assignedDoctorId: z.string().optional(),
});

const patientSelfRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().min(7, 'Phone number is required').max(40),
  dateOfBirth: z.string().min(4, 'Date of birth is required'),
  insuranceProvider: z.string().min(1).max(100).default('Self-Pay'),
  memberId: z.string().max(60).optional(),
});

// Check whether initial Admin has been set up
router.get('/status', async (_req, res) => {
  try {
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const adminCount = adminRole
      ? await prisma.user.count({ where: { roleId: adminRole.id } })
      : 0;
    res.json({
      initialized: adminCount > 0,
      defaultAdmin: DEFAULT_ADMIN_PROFILE,
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Unable to verify authentication status' });
  }
});

// One-time bootstrap endpoint to create the first clinic ADMIN account
router.post('/setup', async (req, res) => {
  try {
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.findUnique({ where: { name: 'ADMIN' } });
      if (!adminRole) {
        throw new Error('ROLE_MISSING');
      }

      const existingAdminCount = await tx.user.count({
        where: { roleId: adminRole.id },
      });
      if (existingAdminCount > 0) {
        return { locked: true as const };
      }

      const email = parsed.data.email.trim().toLowerCase();
      const user = await tx.user.create({
        data: {
          email,
          name: parsed.data.name.trim(),
          passwordHash: hashPassword(parsed.data.password),
          roleId: adminRole.id,
          active: true,
        },
        include: { role: true },
      });

      await writeAuditLog(
        {
          actor: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'ADMIN',
            doctorId: null,
            patientId: null,
          },
          action: 'ADMIN_BOOTSTRAP',
          entityType: 'User',
          entityId: user.id,
          details: `Initial clinic administrator registered (${user.email})`,
        },
        tx
      );

      return { locked: false as const, user };
    });

    if (result.locked) {
      res.status(403).json({
        error: 'Clinic setup is already complete. Sign in with an existing account.',
      });
      return;
    }

    const { token } = await createSession(result.user.id);
    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role.name,
        doctorId: null,
        patientId: null,
      },
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Failed to complete initial clinic setup' });
  }
});

// Self-service patient portal registration (strictly locked to PATIENT role)
router.post('/patient-register', async (req, res) => {
  try {
    const parsed = patientSelfRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data' });
      return;
    }

    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const adminCount = adminRole
      ? await prisma.user.count({ where: { roleId: adminRole.id } })
      : 0;
    if (adminCount === 0) {
      res.status(403).json({ error: 'Clinic administrator setup must be completed first' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [existingUser, existingPatient, patientRole] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.patient.findUnique({ where: { email } }),
      prisma.role.findUnique({ where: { name: 'PATIENT' } }),
    ]);

    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    if (existingPatient) {
      res.status(409).json({
        error: 'A clinic patient record already exists for this email. Contact clinic reception to activate portal access.',
      });
      return;
    }
    if (!patientRole) {
      res.status(500).json({ error: 'Patient role is unavailable' });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: parsed.data.name.trim(),
          passwordHash: hashPassword(parsed.data.password),
          roleId: patientRole.id,
          active: true,
        },
        include: { role: true },
      });

      const memberId =
        parsed.data.memberId?.trim() ||
        `PT-${Math.floor(100000 + Math.random() * 900000)}`;

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          name: parsed.data.name.trim(),
          phone: parsed.data.phone.trim(),
          email,
          dateOfBirth: parsed.data.dateOfBirth,
          insuranceProvider: parsed.data.insuranceProvider.trim() || 'Self-Pay',
          memberId,
          status: 'New',
          lastAppointment: new Date().toISOString().slice(0, 10),
          tags: JSON.stringify(['Portal Registered']),
          notes: '',
          notificationPreference: {
            create: {
              appointmentUpdates: true,
              labReportAlerts: true,
              campaignAnnouncements: true,
            },
          },
        },
      });

      await writeAuditLog(
        {
          actor: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'PATIENT',
            doctorId: null,
            patientId: patient.id,
          },
          action: 'PATIENT_SELF_REGISTERED',
          entityType: 'Patient',
          entityId: patient.id,
          details: `Self-registered patient portal account (${user.email})`,
        },
        tx
      );

      return { user, patient };
    });

    const { token } = await createSession(created.user.id);
    res.status(201).json({
      token,
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
        role: 'PATIENT' as StaffRole,
        doctorId: null,
        patientId: created.patient.id,
      },
    });
  } catch (error) {
    console.error('Patient registration error:', error);
    res.status(500).json({ error: 'Failed to create patient account' });
  }
});

// Login with email + password
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email and password are required' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, doctorProfile: true, patientProfile: true },
    });

    if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { token } = await createSession(user.id);
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name as StaffRole,
      doctorId: user.doctorProfile?.id ?? null,
      patientId: user.patientProfile?.id ?? null,
    };

    await writeAuditLog({
      actor: authUser,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `Signed in as ${authUser.role}`,
    });

    res.json({ token, user: authUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout & invalidate session
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      await revokeSession(authHeader.slice(7).trim());
    }
    if (req.authUser) {
      await writeAuditLog({
        actor: req.authUser,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.authUser.id,
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Current authenticated user
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

// Admin-controlled account registration (ADMIN, RECEPTIONIST, DOCTOR, LAB_TECHNICIAN, PATIENT)
router.post(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
        return;
      }

      const email = parsed.data.email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'A user with this email already exists' });
        return;
      }

      const roleRecord = await prisma.role.findUnique({
        where: { name: parsed.data.role },
      });
      if (!roleRecord) {
        res.status(400).json({ error: 'Invalid role specified' });
        return;
      }

      if (parsed.data.role === 'PATIENT') {
        if (parsed.data.patientId) {
          const targetPatient = await prisma.patient.findUnique({
            where: { id: parsed.data.patientId },
          });
          if (!targetPatient || targetPatient.status === 'Archived') {
            res.status(400).json({ error: 'Selected patient record is unavailable' });
            return;
          }
          if (targetPatient.userId) {
            res.status(409).json({ error: 'This patient record is already linked to an account' });
            return;
          }
        } else {
          const existingPatientByEmail = await prisma.patient.findUnique({
            where: { email },
          });
          if (existingPatientByEmail) {
            res.status(409).json({
              error: 'A patient record with this email already exists. Select that patient to link their account.',
            });
            return;
          }
        }
      }

      const createdUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: parsed.data.name.trim(),
            passwordHash: hashPassword(parsed.data.password),
            roleId: roleRecord.id,
            active: true,
          },
          include: { role: true },
        });

        let linkedDoctorId: string | null = null;
        let linkedPatientId: string | null = null;

        if (parsed.data.role === 'DOCTOR') {
          if (parsed.data.doctorId) {
            const doc = await tx.doctor.update({
              where: { id: parsed.data.doctorId },
              data: { userId: user.id },
            });
            linkedDoctorId = doc.id;
          } else {
            const initials = parsed.data.name
              .replace(/^Dr\.\s+/i, '')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s[0]?.toUpperCase() ?? '')
              .join('');

            const doc = await tx.doctor.create({
              data: {
                userId: user.id,
                name: parsed.data.name.trim(),
                specialty: parsed.data.specialty?.trim() || 'Family Medicine',
                room: parsed.data.room?.trim() || 'Suite 115',
                initials: initials || 'DR',
                availableToday: true,
                dailyCapacity: 10,
                schedules: {
                  create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
                    dayOfWeek,
                    startTime: '08:30',
                    endTime: '17:00',
                    isActive: true,
                  })),
                },
              },
            });
            linkedDoctorId = doc.id;
          }
        }

        if (parsed.data.role === 'PATIENT') {
          if (parsed.data.patientId) {
            const linked = await tx.patient.update({
              where: { id: parsed.data.patientId },
              data: { userId: user.id },
            });
            await tx.notificationPreference.upsert({
              where: { patientId: linked.id },
              update: {},
              create: {
                patientId: linked.id,
                appointmentUpdates: true,
                labReportAlerts: true,
                campaignAnnouncements: true,
              },
            });
            linkedPatientId = linked.id;
          } else {
            const linked = await tx.patient.create({
              data: {
                userId: user.id,
                name: parsed.data.name.trim(),
                email,
                phone: parsed.data.phone?.trim() || '+1 (555) 000-0000',
                dateOfBirth: parsed.data.dateOfBirth || '1990-01-01',
                insuranceProvider: parsed.data.insuranceProvider?.trim() || 'Self-Pay',
                memberId:
                  parsed.data.memberId?.trim() ||
                  `PT-${Math.floor(100000 + Math.random() * 900000)}`,
                assignedDoctorId: parsed.data.assignedDoctorId || null,
                status: 'Active',
                lastAppointment: new Date().toISOString().slice(0, 10),
                tags: JSON.stringify(['Portal Enabled']),
                notes: '',
                notificationPreference: {
                  create: {
                    appointmentUpdates: true,
                    labReportAlerts: true,
                    campaignAnnouncements: true,
                  },
                },
              },
            });
            linkedPatientId = linked.id;
          }
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'USER_REGISTERED',
            entityType: 'User',
            entityId: user.id,
            details: `Registered ${user.email} with role ${roleRecord.name}`,
          },
          tx
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          active: user.active,
          doctorId: linkedDoctorId,
          patientId: linkedPatientId,
        };
      });

      res.status(201).json({ user: createdUser });
    } catch (error) {
      console.error('Staff registration error:', error);
      res.status(500).json({ error: 'Failed to register user account' });
    }
  }
);

// List staff & portal accounts (ADMIN only)
router.get(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          createdAt: true,
          role: { select: { name: true } },
          doctorProfile: { select: { id: true, name: true, specialty: true } },
          patientProfile: { select: { id: true, name: true } },
        },
      });
      res.json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          role: u.role.name,
          doctorId: u.doctorProfile?.id ?? null,
          doctorName: u.doctorProfile?.name ?? null,
          patientId: u.patientProfile?.id ?? null,
          patientName: u.patientProfile?.name ?? null,
          createdAt: u.createdAt,
        })),
      });
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ error: 'Failed to fetch user accounts' });
    }
  }
);

// Toggle user active status or role (ADMIN only)
router.patch(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const schema = z.object({
        active: z.boolean().optional(),
        role: z
          .enum(['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_TECHNICIAN', 'PATIENT'])
          .optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid update payload' });
        return;
      }

      if (id === req.authUser?.id && parsed.data.active === false) {
        res.status(400).json({ error: 'Cannot deactivate your own active session' });
        return;
      }

      let roleId: string | undefined;
      if (parsed.data.role) {
        const roleRec = await prisma.role.findUnique({
          where: { name: parsed.data.role },
        });
        if (!roleRec) {
          res.status(400).json({ error: 'Role not found' });
          return;
        }
        roleId = roleRec.id;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
          ...(roleId ? { roleId } : {}),
        },
        include: { role: true, doctorProfile: true, patientProfile: true },
      });

      await writeAuditLog({
        actor: req.authUser,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: updated.id,
        details: `active=${updated.active}, role=${updated.role.name}`,
      });

      res.json({
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          active: updated.active,
          role: updated.role.name,
          doctorId: updated.doctorProfile?.id ?? null,
          patientId: updated.patientProfile?.id ?? null,
        },
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user account' });
    }
  }
);

export default router;
