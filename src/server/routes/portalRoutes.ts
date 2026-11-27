import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';
import { getAvailableDoctorSlots, validateSchedulingRules } from '../scheduling.ts';

const router = Router();

const CLINIC_SERVICES = [
  'General Consultation',
  'Annual Check-up',
  'Follow-up',
  'Pediatric Care',
  'Vaccination',
  'Urgent Visit',
] as const;

const portalBookingSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  durationMinutes: z.coerce.number().int().min(15).max(120).default(30),
  category: z.string().min(2).max(80),
  notes: z.string().max(500).optional(),
});

const updatePortalAppointmentSchema = z.object({
  action: z.enum(['CANCEL', 'RESCHEDULE']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
});

const updateProfileSchema = z.object({
  phone: z.string().min(7).max(40).optional(),
  insuranceProvider: z.string().min(1).max(100).optional(),
  memberId: z.string().min(1).max(60).optional(),
  notificationPreference: z
    .object({
      appointmentUpdates: z.boolean(),
      labReportAlerts: z.boolean(),
      campaignAnnouncements: z.boolean(),
    })
    .optional(),
});

function requirePatientLink(req: AuthenticatedRequest): string | null {
  return req.authUser?.role === 'PATIENT' && req.authUser.patientId
    ? req.authUser.patientId
    : null;
}

// GET /api/portal/overview — Complete patient self-service overview (strictly scoped to own record)
router.get(
  '/overview',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient account is not linked to a clinic chart' });
        return;
      }

      const [patient, appointments, labOrders, notifications, settings] =
        await Promise.all([
          prisma.patient.findUnique({
            where: { id: patientId },
            include: {
              assignedDoctor: {
                select: { id: true, name: true, specialty: true, room: true },
              },
              notificationPreference: true,
            },
          }),
          prisma.appointment.findMany({
            where: { patientId },
            orderBy: [{ date: 'desc' }, { time: 'desc' }],
            include: {
              doctor: {
                select: { id: true, name: true, specialty: true, room: true },
              },
              visit: true,
            },
          }),
          prisma.labOrder.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
              labTest: true,
              doctor: {
                select: { id: true, name: true, specialty: true },
              },
              approvedBy: {
                select: { id: true, name: true },
              },
              results: { orderBy: { createdAt: 'asc' } },
              reports: {
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  labOrderId: true,
                  patientId: true,
                  title: true,
                  originalFileName: true,
                  mimeType: true,
                  fileSize: true,
                  createdAt: true,
                },
              },
            },
          }),
          prisma.patientNotification.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  audience: true,
                  scheduledDate: true,
                  messageTemplate: true,
                },
              },
            },
          }),
          prisma.clinicSetting.findUnique({ where: { id: 'default' } }),
        ]);

      if (!patient || patient.status === 'Archived') {
        res.status(404).json({ error: 'Patient profile is unavailable' });
        return;
      }

      // Mask unreleased lab results/reports for patient safety
      const safeLabOrders = labOrders.map((order) => {
        if (order.status !== 'RELEASED') {
          return {
            ...order,
            doctorReviewNotes: '',
            results: [],
            reports: [],
          };
        }
        return order;
      });

      const releasedReports = safeLabOrders.flatMap((o) =>
        o.reports.map((r) => ({
          ...r,
          orderNumber: o.orderNumber,
          testName: o.labTest.name,
          testCode: o.labTest.code,
          doctorName: o.doctor.name,
          releasedAt: o.releasedAt,
          status: o.status,
        }))
      );

      res.json({
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
          insuranceProvider: patient.insuranceProvider,
          memberId: patient.memberId,
          status: patient.status,
          assignedDoctor: patient.assignedDoctor,
        },
        notificationPreference: patient.notificationPreference ?? {
          appointmentUpdates: true,
          labReportAlerts: true,
          campaignAnnouncements: true,
        },
        appointments,
        labOrders: safeLabOrders,
        releasedReports,
        notifications,
        requirePatientBookingApproval: settings?.requirePatientBookingApproval ?? true,
      });
    } catch (error) {
      console.error('Portal overview error:', error);
      res.status(500).json({ error: 'Failed to load patient portal overview' });
    }
  }
);

// PATCH /api/portal/profile — Update patient contact info & notification preferences
router.patch(
  '/profile',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient profile not linked' });
        return;
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile update' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.update({
          where: { id: patientId },
          data: {
            ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone.trim() } : {}),
            ...(parsed.data.insuranceProvider !== undefined
              ? { insuranceProvider: parsed.data.insuranceProvider.trim() }
              : {}),
            ...(parsed.data.memberId !== undefined
              ? { memberId: parsed.data.memberId.trim() }
              : {}),
          },
          include: {
            assignedDoctor: {
              select: { id: true, name: true, specialty: true, room: true },
            },
          },
        });

        let pref = await tx.notificationPreference.findUnique({
          where: { patientId },
        });
        if (parsed.data.notificationPreference) {
          pref = await tx.notificationPreference.upsert({
            where: { patientId },
            update: parsed.data.notificationPreference,
            create: {
              patientId,
              ...parsed.data.notificationPreference,
            },
          });
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PATIENT_PORTAL_PROFILE_UPDATED',
            entityType: 'Patient',
            entityId: patientId,
            details: `Updated self-service contact/notification preferences`,
          },
          tx
        );

        return { patient, pref };
      });

      res.json(updated);
    } catch (error) {
      console.error('Portal profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// GET /api/portal/booking-options — Services, doctors, and schedules for booking
router.get(
  '/booking-options',
  requireAuth,
  requireRole('PATIENT'),
  async (_req, res) => {
    try {
      const [doctors, settings] = await Promise.all([
        prisma.doctor.findMany({
          orderBy: { name: 'asc' },
          include: {
            schedules: { orderBy: { dayOfWeek: 'asc' } },
          },
        }),
        prisma.clinicSetting.findUnique({ where: { id: 'default' } }),
      ]);

      res.json({
        services: CLINIC_SERVICES,
        doctors,
        defaultAppointmentDuration: settings?.defaultAppointmentDuration ?? 30,
        requirePatientBookingApproval: settings?.requirePatientBookingApproval ?? true,
      });
    } catch (error) {
      console.error('Portal booking options error:', error);
      res.status(500).json({ error: 'Failed to load booking options' });
    }
  }
);

// GET /api/portal/slots — Live available slots for doctor + date
router.get(
  '/slots',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : '';
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const durationMinutes = Number(req.query.durationMinutes) || 30;

      if (!doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Valid doctorId and YYYY-MM-DD date are required' });
        return;
      }

      const result = await getAvailableDoctorSlots({
        doctorId,
        patientId: patientId ?? undefined,
        date,
        durationMinutes,
      });

      res.json(result);
    } catch (error) {
      console.error('Portal slots error:', error);
      res.status(500).json({ error: 'Failed to load available appointment slots' });
    }
  }
);

// POST /api/portal/appointments — Patient self-booking with server validation & configurable confirmation
router.post(
  '/appointments',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient profile not linked' });
        return;
      }

      const parsed = portalBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid booking details' });
        return;
      }

      const [patient, settings, doctor] = await Promise.all([
        prisma.patient.findUnique({
          where: { id: patientId },
          include: { notificationPreference: true },
        }),
        prisma.clinicSetting.findUnique({ where: { id: 'default' } }),
        prisma.doctor.findUnique({ where: { id: parsed.data.doctorId } }),
      ]);

      if (!patient || patient.status === 'Archived') {
        res.status(400).json({ error: 'Patient account is inactive' });
        return;
      }
      if (!doctor) {
        res.status(404).json({ error: 'Selected doctor not found' });
        return;
      }

      const requireApproval = settings?.requirePatientBookingApproval ?? true;
      const targetStatus = requireApproval ? 'SCHEDULED' : 'CONFIRMED';

      const conflict = await validateSchedulingRules({
        doctorId: parsed.data.doctorId,
        patientId,
        date: parsed.data.date,
        time: parsed.data.time,
        durationMinutes: parsed.data.durationMinutes,
        status: targetStatus,
      });

      if (conflict) {
        res.status(409).json({ error: conflict });
        return;
      }

      const appointment = await prisma.$transaction(async (tx) => {
        const created = await tx.appointment.create({
          data: {
            patientId,
            doctorId: parsed.data.doctorId,
            date: parsed.data.date,
            time: parsed.data.time,
            durationMinutes: parsed.data.durationMinutes,
            category: parsed.data.category,
            status: targetStatus,
            bookingSource: 'PATIENT_PORTAL',
            notes: parsed.data.notes?.trim() || 'Booked via Patient Portal',
            createdById: req.authUser?.id,
            updatedById: req.authUser?.id,
            visit: {
              create: {
                patientId,
                doctorId: parsed.data.doctorId,
                flowStatus: 'EXPECTED',
              },
            },
          },
          include: {
            doctor: { select: { id: true, name: true, specialty: true, room: true } },
            visit: true,
          },
        });

        const allowAlert = patient.notificationPreference?.appointmentUpdates ?? true;
        if (allowAlert) {
          await tx.patientNotification.create({
            data: {
              patientId,
              type: 'APPOINTMENT',
              title: requireApproval
                ? 'Appointment request received'
                : 'Appointment confirmed',
              message: requireApproval
                ? `Your ${parsed.data.category} request with ${doctor.name} on ${parsed.data.date} at ${parsed.data.time} is awaiting clinic confirmation.`
                : `Your ${parsed.data.category} with ${doctor.name} on ${parsed.data.date} at ${parsed.data.time} is confirmed.`,
              appointmentId: created.id,
              actionRoute: 'appointments',
            },
          });
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PORTAL_APPOINTMENT_BOOKED',
            entityType: 'Appointment',
            entityId: created.id,
            details: `${patient.name} booked ${created.date} ${created.time} with ${doctor.name} (${targetStatus})`,
          },
          tx
        );

        return created;
      });

      res.status(201).json({ appointment });
    } catch (error) {
      console.error('Portal booking error:', error);
      res.status(500).json({ error: 'Failed to submit appointment booking' });
    }
  }
);

// PATCH /api/portal/appointments/:id — Cancel or reschedule own appointment
router.patch(
  '/appointments/:id',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient profile not linked' });
        return;
      }

      const id = String(req.params.id);
      const parsed = updatePortalAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update payload' });
        return;
      }

      const existing = await prisma.appointment.findUnique({
        where: { id },
        include: { doctor: true, visit: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }
      if (existing.patientId !== patientId) {
        res.status(403).json({ error: 'Access denied to another patient appointment' });
        return;
      }
      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(existing.status)) {
        res.status(400).json({ error: `Cannot modify a ${existing.status} appointment` });
        return;
      }
      if (existing.visit && ['IN_CONSULTATION', 'SEEN'].includes(existing.visit.flowStatus)) {
        res.status(400).json({ error: 'Appointment already in progress or completed' });
        return;
      }

      if (parsed.data.action === 'CANCEL') {
        const cancelled = await prisma.$transaction(async (tx) => {
          const updated = await tx.appointment.update({
            where: { id },
            data: {
              status: 'CANCELLED',
              updatedById: req.authUser?.id,
              notes: parsed.data.notes
                ? `${existing.notes ?? ''} | Cancelled by patient: ${parsed.data.notes}`
                : existing.notes,
            },
            include: {
              doctor: { select: { id: true, name: true, specialty: true, room: true } },
              visit: true,
            },
          });

          await tx.patientNotification.create({
            data: {
              patientId,
              type: 'APPOINTMENT',
              title: 'Appointment cancelled',
              message: `Your appointment with ${existing.doctor.name} on ${existing.date} at ${existing.time} has been cancelled.`,
              appointmentId: existing.id,
              actionRoute: 'appointments',
            },
          });

          await writeAuditLog(
            {
              actor: req.authUser,
              action: 'PORTAL_APPOINTMENT_CANCELLED',
              entityType: 'Appointment',
              entityId: id,
              details: `Patient cancelled ${existing.date} ${existing.time}`,
            },
            tx
          );

          return updated;
        });

        res.json({ appointment: cancelled });
        return;
      }

      // RESCHEDULE
      if (!parsed.data.date || !parsed.data.time) {
        res.status(400).json({ error: 'New date and time are required to reschedule' });
        return;
      }

      const settings = await prisma.clinicSetting.findUnique({ where: { id: 'default' } });
      const requireApproval = settings?.requirePatientBookingApproval ?? true;
      const nextStatus = requireApproval ? 'SCHEDULED' : 'CONFIRMED';

      const conflict = await validateSchedulingRules({
        excludeAppointmentId: id,
        doctorId: existing.doctorId,
        patientId,
        date: parsed.data.date,
        time: parsed.data.time,
        durationMinutes: existing.durationMinutes,
        status: nextStatus,
      });

      if (conflict) {
        res.status(409).json({ error: conflict });
        return;
      }

      const rescheduled = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id },
          data: {
            date: parsed.data.date,
            time: parsed.data.time,
            status: nextStatus,
            updatedById: req.authUser?.id,
            ...(parsed.data.notes ? { notes: parsed.data.notes.trim() } : {}),
          },
          include: {
            doctor: { select: { id: true, name: true, specialty: true, room: true } },
            visit: true,
          },
        });

        await tx.patientNotification.create({
          data: {
            patientId,
            type: 'APPOINTMENT',
            title: 'Appointment rescheduled',
            message: `Your visit with ${existing.doctor.name} has been moved to ${parsed.data.date} at ${parsed.data.time}.`,
            appointmentId: existing.id,
            actionRoute: 'appointments',
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PORTAL_APPOINTMENT_RESCHEDULED',
            entityType: 'Appointment',
            entityId: id,
            details: `Rescheduled from ${existing.date} ${existing.time} to ${parsed.data.date} ${parsed.data.time}`,
          },
          tx
        );

        return updated;
      });

      res.json({ appointment: rescheduled });
    } catch (error) {
      console.error('Portal appointment update error:', error);
      res.status(500).json({ error: 'Failed to update appointment' });
    }
  }
);

// POST /api/portal/notifications/:id/read — Mark notification read & track campaign engagement
router.post(
  '/notifications/:id/read',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient profile not linked' });
        return;
      }

      const id = String(req.params.id);
      const existing = await prisma.patientNotification.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      if (existing.patientId !== patientId) {
        res.status(403).json({ error: 'Access denied to another patient notification' });
        return;
      }

      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const notif = await tx.patientNotification.update({
          where: { id },
          data: {
            isRead: true,
            readAt: existing.readAt ?? now,
          },
        });

        if (existing.campaignId && !existing.isRead) {
          const rec = await tx.campaignRecipient.findUnique({
            where: {
              campaignId_patientId: {
                campaignId: existing.campaignId,
                patientId,
              },
            },
          });
          if (rec && !rec.readAt) {
            await tx.campaignRecipient.update({
              where: { id: rec.id },
              data: { deliveryStatus: 'READ', readAt: now },
            });
            const readCount = await tx.campaignRecipient.count({
              where: { campaignId: existing.campaignId, readAt: { not: null } },
            });
            await tx.campaign.update({
              where: { id: existing.campaignId },
              data: { readCount },
            });
          }
        }

        return notif;
      });

      res.json({ notification: updated });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to update notification' });
    }
  }
);

// POST /api/portal/notifications/read-all
router.post(
  '/notifications/read-all',
  requireAuth,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = requirePatientLink(req);
      if (!patientId) {
        res.status(403).json({ error: 'Patient profile not linked' });
        return;
      }

      const now = new Date();
      const unread = await prisma.patientNotification.findMany({
        where: { patientId, isRead: false },
      });

      await prisma.$transaction(async (tx) => {
        await tx.patientNotification.updateMany({
          where: { patientId, isRead: false },
          data: { isRead: true, readAt: now },
        });

        const campaignIds = Array.from(
          new Set(unread.map((u) => u.campaignId).filter((c): c is string => Boolean(c)))
        );
        for (const campaignId of campaignIds) {
          await tx.campaignRecipient.updateMany({
            where: { campaignId, patientId, readAt: null },
            data: { deliveryStatus: 'READ', readAt: now },
          });
          const readCount = await tx.campaignRecipient.count({
            where: { campaignId, readAt: { not: null } },
          });
          await tx.campaign.update({
            where: { id: campaignId },
            data: { readCount },
          });
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  }
);

export default router;
