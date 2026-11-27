import { Router } from 'express';
import { z } from 'zod';
import { format } from 'date-fns';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';
import { validateSchedulingRules } from '../scheduling.ts';

const router = Router();

const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  durationMinutes: z.coerce.number().int().min(10).max(180).default(30),
  category: z.string().min(2).max(80),
  status: z
    .enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
    .default('SCHEDULED'),
  notes: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial();

// GET /api/appointments
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const doctorId =
        typeof req.query.doctorId === 'string' ? req.query.doctorId : undefined;
      const patientId =
        typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      // Doctors viewing "mine=true" get scoped to their own appointments
      const scopeDoctorId =
        req.query.mine === 'true' && req.authUser?.doctorId
          ? req.authUser.doctorId
          : doctorId;

      const appointments = await prisma.appointment.findMany({
        where: {
          ...(date ? { date } : {}),
          ...(scopeDoctorId && scopeDoctorId !== 'all'
            ? { doctorId: scopeDoctorId }
            : {}),
          ...(patientId ? { patientId } : {}),
          ...(status && status !== 'all' ? { status } : {}),
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: {
          visit: true,
          consultation: true,
        },
      });

      res.json({ appointments });
    } catch (error) {
      console.error('List appointments error:', error);
      res.status(500).json({ error: 'Failed to retrieve appointments' });
    }
  }
);

// GET /api/appointments/:id
router.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req, res) => {
  try {
    const id = String(req.params.id);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        visit: true,
        consultation: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to load appointment' });
  }
});

// POST /api/appointments
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid appointment data' });
        return;
      }

      const data = parsed.data;
      const patient = await prisma.patient.findUnique({
        where: { id: data.patientId },
      });
      if (!patient || patient.status === 'Archived') {
        res.status(400).json({ error: 'Selected patient is unavailable or archived' });
        return;
      }

      const conflict = await validateSchedulingRules({
        doctorId: data.doctorId,
        patientId: data.patientId,
        date: data.date,
        time: data.time,
        durationMinutes: data.durationMinutes,
        status: data.status,
      });

      if (conflict) {
        res.status(409).json({ error: conflict });
        return;
      }

      const created = await prisma.$transaction(async (tx) => {
        const apt = await tx.appointment.create({
          data: {
            patientId: data.patientId,
            doctorId: data.doctorId,
            date: data.date,
            time: data.time,
            durationMinutes: data.durationMinutes,
            category: data.category,
            status: data.status,
            notes: data.notes,
            createdById: req.authUser?.id,
            updatedById: req.authUser?.id,
            visit: {
              create: {
                patientId: data.patientId,
                doctorId: data.doctorId,
                flowStatus: data.status === 'COMPLETED' ? 'SEEN' : 'EXPECTED',
              },
            },
          },
          include: { visit: true, consultation: true },
        });

        await tx.patient.update({
          where: { id: data.patientId },
          data: {
            lastAppointment:
              data.date >= patient.lastAppointment ? data.date : patient.lastAppointment,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'APPOINTMENT_CREATED',
            entityType: 'Appointment',
            entityId: apt.id,
            details: `${patient.name} on ${apt.date} at ${apt.time} (${apt.category})`,
          },
          tx
        );

        return apt;
      });

      res.status(201).json({ appointment: created });
    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({ error: 'Failed to schedule appointment' });
    }
  }
);

// PATCH /api/appointments/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const parsed = updateAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update payload' });
        return;
      }

      const existing = await prisma.appointment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      if (
        req.authUser?.role === 'DOCTOR' &&
        req.authUser.doctorId &&
        existing.doctorId !== req.authUser.doctorId
      ) {
        res.status(403).json({
          error: 'Doctors can only modify appointments assigned to them',
        });
        return;
      }

      const nextDoctorId = parsed.data.doctorId ?? existing.doctorId;
      const nextPatientId = parsed.data.patientId ?? existing.patientId;
      const nextDate = parsed.data.date ?? existing.date;
      const nextTime = parsed.data.time ?? existing.time;
      const nextDuration = parsed.data.durationMinutes ?? existing.durationMinutes;
      const nextStatus = parsed.data.status ?? existing.status;

      const conflict = await validateSchedulingRules({
        excludeAppointmentId: id,
        doctorId: nextDoctorId,
        patientId: nextPatientId,
        date: nextDate,
        time: nextTime,
        durationMinutes: nextDuration,
        status: nextStatus,
      });

      if (conflict) {
        res.status(409).json({ error: conflict });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const apt = await tx.appointment.update({
          where: { id },
          data: {
            patientId: nextPatientId,
            doctorId: nextDoctorId,
            date: nextDate,
            time: nextTime,
            durationMinutes: nextDuration,
            category: parsed.data.category ?? existing.category,
            status: nextStatus,
            notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
            updatedById: req.authUser?.id,
          },
          include: { visit: true, consultation: true },
        });

        if (apt.visit) {
          await tx.patientVisit.update({
            where: { id: apt.visit.id },
            data: {
              doctorId: nextDoctorId,
              patientId: nextPatientId,
            },
          });
        }

        const statusChanged = nextStatus !== existing.status;
        const slotChanged = nextDate !== existing.date || nextTime !== existing.time;
        if (
          (statusChanged && ['CONFIRMED', 'CANCELLED'].includes(nextStatus)) ||
          slotChanged
        ) {
          const pref = await tx.notificationPreference.findUnique({
            where: { patientId: nextPatientId },
          });
          if (pref?.appointmentUpdates !== false) {
            const title =
              nextStatus === 'CANCELLED'
                ? 'Appointment Cancelled'
                : nextStatus === 'CONFIRMED' && statusChanged
                ? 'Appointment Confirmed'
                : 'Appointment Schedule Updated';
            const message =
              nextStatus === 'CANCELLED'
                ? `Your ${apt.category} appointment on ${apt.date} at ${apt.time} has been cancelled.`
                : `Your ${apt.category} appointment is scheduled for ${apt.date} at ${apt.time} (${apt.status}).`;

            await tx.patientNotification.create({
              data: {
                patientId: nextPatientId,
                type: 'APPOINTMENT',
                title,
                message,
                actionRoute: 'portal_appointments',
              },
            });
          }
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'APPOINTMENT_UPDATED',
            entityType: 'Appointment',
            entityId: apt.id,
            details: `Updated ${apt.date} ${apt.time}, status=${apt.status}`,
          },
          tx
        );

        return apt;
      });

      res.json({ appointment: updated });
    } catch (error) {
      console.error('Update appointment error:', error);
      res.status(500).json({ error: 'Failed to update appointment' });
    }
  }
);

// DELETE /api/appointments/:id — Cancel appointment (frees slot)
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.appointment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      const cancelled = await prisma.$transaction(async (tx) => {
        const apt = await tx.appointment.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            updatedById: req.authUser?.id,
          },
          include: { visit: true },
        });

        const pref = await tx.notificationPreference.findUnique({
          where: { patientId: apt.patientId },
        });
        if (pref?.appointmentUpdates !== false) {
          await tx.patientNotification.create({
            data: {
              patientId: apt.patientId,
              type: 'APPOINTMENT',
              title: 'Appointment Cancelled',
              message: `Your ${apt.category} appointment on ${apt.date} at ${apt.time} was cancelled by the clinic.`,
              actionRoute: 'portal_appointments',
            },
          });
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'APPOINTMENT_CANCELLED',
            entityType: 'Appointment',
            entityId: apt.id,
            details: `Cancelled slot ${apt.date} ${apt.time}`,
          },
          tx
        );

        return apt;
      });

      res.json({ appointment: cancelled });
    } catch (error) {
      console.error('Cancel appointment error:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  }
);

// POST /api/appointments/remind-expected
router.post(
  '/remind-expected',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const timeLabel = `Today ${format(new Date(), 'HH:mm')}`;
      const singleId = typeof req.body?.appointmentId === 'string' ? req.body.appointmentId : null;

      const updatedCount = await prisma.$transaction(async (tx) => {
        if (singleId) {
          await tx.appointment.update({
            where: { id: singleId },
            data: { remindedAt: timeLabel, updatedById: req.authUser?.id },
          });
          await writeAuditLog(
            {
              actor: req.authUser,
              action: 'APPOINTMENT_REMINDED',
              entityType: 'Appointment',
              entityId: singleId,
              details: `Marked reminder recorded at ${timeLabel}`,
            },
            tx
          );
          return 1;
        }

        const pending = await tx.appointment.findMany({
          where: {
            date: todayStr,
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
            visit: { is: { flowStatus: 'EXPECTED' } },
          },
        });

        if (pending.length > 0) {
          await tx.appointment.updateMany({
            where: { id: { in: pending.map((p) => p.id) } },
            data: { remindedAt: timeLabel, updatedById: req.authUser?.id },
          });
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'BATCH_REMINDER_RECORDED',
            entityType: 'Appointment',
            entityId: todayStr,
            details: `Recorded reminders for ${pending.length} expected appointments`,
          },
          tx
        );

        return pending.length;
      });

      res.json({ count: updatedCount, remindedAt: timeLabel });
    } catch (error) {
      console.error('Remind appointments error:', error);
      res.status(500).json({ error: 'Failed to record appointment reminders' });
    }
  }
);

export default router;
