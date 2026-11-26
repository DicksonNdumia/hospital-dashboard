import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const createDoctorSchema = z.object({
  name: z.string().min(2).max(100),
  specialty: z.string().min(2).max(100),
  room: z.string().min(2).max(60),
  dailyCapacity: z.coerce.number().int().min(1).max(40).default(10),
  availableToday: z.boolean().default(true),
  color: z.string().default('#0B6657'),
});

const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean(),
});

const updateDoctorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  specialty: z.string().min(2).max(100).optional(),
  room: z.string().min(2).max(60).optional(),
  dailyCapacity: z.coerce.number().int().min(1).max(40).optional(),
  availableToday: z.boolean().optional(),
  schedules: z.array(scheduleEntrySchema).optional(),
});

// GET /api/doctors — All providers with working hours
router.get('/', requireAuth, async (_req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { name: 'asc' },
      include: {
        schedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
    res.json({ doctors });
  } catch (error) {
    console.error('List doctors error:', error);
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

// POST /api/doctors — Register provider (ADMIN only)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createDoctorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid doctor input' });
        return;
      }

      const initials = parsed.data.name
        .replace(/^Dr\.\s+/i, '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('');

      const created = await prisma.$transaction(async (tx) => {
        const doc = await tx.doctor.create({
          data: {
            name: parsed.data.name.trim(),
            specialty: parsed.data.specialty.trim(),
            room: parsed.data.room.trim(),
            initials: initials || 'DR',
            color: parsed.data.color,
            availableToday: parsed.data.availableToday,
            dailyCapacity: parsed.data.dailyCapacity,
            schedules: {
              create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
                dayOfWeek,
                startTime: '08:30',
                endTime: '17:00',
                isActive: true,
              })),
            },
          },
          include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'DOCTOR_REGISTERED',
            entityType: 'Doctor',
            entityId: doc.id,
            details: `Registered provider ${doc.name} (${doc.specialty})`,
          },
          tx
        );

        return doc;
      });

      res.status(201).json({ doctor: created });
    } catch (error) {
      console.error('Create doctor error:', error);
      res.status(500).json({ error: 'Failed to register provider' });
    }
  }
);

// PATCH /api/doctors/:id — Profile, availability & working hours
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      if (req.authUser?.role === 'DOCTOR' && req.authUser.doctorId !== id) {
        res.status(403).json({ error: 'Doctors may only manage their own schedule profile' });
        return;
      }

      const parsed = updateDoctorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (parsed.data.schedules) {
          for (const sched of parsed.data.schedules) {
            await tx.doctorSchedule.upsert({
              where: {
                doctorId_dayOfWeek: {
                  doctorId: id,
                  dayOfWeek: sched.dayOfWeek,
                },
              },
              update: {
                startTime: sched.startTime,
                endTime: sched.endTime,
                isActive: sched.isActive,
              },
              create: {
                doctorId: id,
                dayOfWeek: sched.dayOfWeek,
                startTime: sched.startTime,
                endTime: sched.endTime,
                isActive: sched.isActive,
              },
            });
          }
        }

        const doc = await tx.doctor.update({
          where: { id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
            ...(parsed.data.specialty !== undefined
              ? { specialty: parsed.data.specialty.trim() }
              : {}),
            ...(parsed.data.room !== undefined ? { room: parsed.data.room.trim() } : {}),
            ...(parsed.data.dailyCapacity !== undefined
              ? { dailyCapacity: parsed.data.dailyCapacity }
              : {}),
            ...(parsed.data.availableToday !== undefined
              ? { availableToday: parsed.data.availableToday }
              : {}),
          },
          include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'DOCTOR_UPDATED',
            entityType: 'Doctor',
            entityId: doc.id,
            details: `Updated provider ${doc.name} (availableToday=${doc.availableToday})`,
          },
          tx
        );

        return doc;
      });

      res.json({ doctor: updated });
    } catch (error) {
      console.error('Update doctor error:', error);
      res.status(500).json({ error: 'Failed to update doctor' });
    }
  }
);

// GET /api/doctors/:id/appointments — Assigned appointments
router.get('/:id/appointments', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: id,
        ...(date ? { date } : {}),
        status: { not: 'CANCELLED' },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        patient: true,
        visit: true,
      },
    });

    res.json({ appointments });
  } catch (error) {
    console.error('Doctor appointments error:', error);
    res.status(500).json({ error: 'Failed to load doctor appointments' });
  }
});

export default router;
