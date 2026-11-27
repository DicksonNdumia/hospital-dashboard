import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const transitionSchema = z.object({
  targetStatus: z.enum(['WAITING', 'IN_CONSULTATION', 'SEEN']),
  chiefComplaint: z.string().optional(),
  clinicalNotes: z.string().optional(),
  diagnosis: z.string().optional(),
  followUpPlan: z.string().optional(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  EXPECTED: ['WAITING'],
  WAITING: ['IN_CONSULTATION'],
  IN_CONSULTATION: ['SEEN'],
  SEEN: [],
};

// POST /api/flow/:appointmentId/transition
router.post(
  '/:appointmentId/transition',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const appointmentId = String(req.params.appointmentId);
      const parsed = transitionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid transition request' });
        return;
      }

      const { targetStatus } = parsed.data;
      const role = req.authUser?.role;

      // Enforce server-side role permissions per workflow stage
      if (targetStatus === 'WAITING' && role !== 'RECEPTIONIST' && role !== 'ADMIN') {
        res.status(403).json({
          error: 'Only receptionists or administrators can check patients into the waiting room',
        });
        return;
      }
      if (
        (targetStatus === 'IN_CONSULTATION' || targetStatus === 'SEEN') &&
        role !== 'DOCTOR' &&
        role !== 'ADMIN'
      ) {
        res.status(403).json({
          error: 'Only doctors or administrators can start or complete consultations',
        });
        return;
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { visit: true, consultation: true, patient: true },
      });

      if (!appointment) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') {
        res.status(400).json({
          error: `Cannot advance patient flow for ${appointment.status} appointment`,
        });
        return;
      }

      if (
        role === 'DOCTOR' &&
        req.authUser?.doctorId &&
        appointment.doctorId !== req.authUser.doctorId
      ) {
        res.status(403).json({
          error: 'Doctors can only manage consultations for their own assigned appointments',
        });
        return;
      }

      const currentStatus = appointment.visit?.flowStatus ?? 'EXPECTED';
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? [];
      if (!allowedNext.includes(targetStatus)) {
        res.status(400).json({
          error: `Invalid status transition: ${currentStatus} → ${targetStatus}`,
        });
        return;
      }

      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        let visit = appointment.visit;
        if (!visit) {
          visit = await tx.patientVisit.create({
            data: {
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              flowStatus: 'EXPECTED',
            },
          });
        }

        let waitingMinutes = visit.waitingMinutes;
        if (targetStatus === 'IN_CONSULTATION' && visit.checkedInAt) {
          waitingMinutes = Math.max(
            0,
            Math.round((now.getTime() - visit.checkedInAt.getTime()) / 60000)
          );
        }

        const updatedVisit = await tx.patientVisit.update({
          where: { id: visit.id },
          data: {
            flowStatus: targetStatus,
            ...(targetStatus === 'WAITING' ? { checkedInAt: now } : {}),
            ...(targetStatus === 'IN_CONSULTATION'
              ? { consultationStartAt: now, waitingMinutes }
              : {}),
            ...(targetStatus === 'SEEN' ? { completedAt: now } : {}),
          },
        });

        const nextAptStatus =
          targetStatus === 'SEEN'
            ? 'COMPLETED'
            : appointment.status === 'SCHEDULED'
            ? 'CONFIRMED'
            : appointment.status;

        const updatedAppointment = await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: nextAptStatus,
            updatedById: req.authUser?.id,
          },
        });

        let consultation = appointment.consultation;
        if (targetStatus === 'IN_CONSULTATION' || targetStatus === 'SEEN') {
          consultation = await tx.consultation.upsert({
            where: { visitId: updatedVisit.id },
            update: {
              ...(parsed.data.chiefComplaint !== undefined
                ? { chiefComplaint: parsed.data.chiefComplaint }
                : {}),
              ...(parsed.data.clinicalNotes !== undefined
                ? { clinicalNotes: parsed.data.clinicalNotes }
                : {}),
              ...(parsed.data.diagnosis !== undefined
                ? { diagnosis: parsed.data.diagnosis }
                : {}),
              ...(parsed.data.followUpPlan !== undefined
                ? { followUpPlan: parsed.data.followUpPlan }
                : {}),
              ...(targetStatus === 'SEEN' ? { completedAt: now } : {}),
            },
            create: {
              visitId: updatedVisit.id,
              appointmentId: appointment.id,
              doctorId: appointment.doctorId,
              patientId: appointment.patientId,
              chiefComplaint:
                parsed.data.chiefComplaint ?? appointment.notes ?? 'Clinical evaluation',
              clinicalNotes: parsed.data.clinicalNotes ?? '',
              diagnosis: parsed.data.diagnosis ?? '',
              followUpPlan: parsed.data.followUpPlan ?? '',
              startedAt: now,
              completedAt: targetStatus === 'SEEN' ? now : null,
            },
          });
        }

        await writeAuditLog(
          {
            actor: req.authUser,
            action: `FLOW_${targetStatus}`,
            entityType: 'PatientVisit',
            entityId: updatedVisit.id,
            details: `${appointment.patient.name}: ${currentStatus} -> ${targetStatus}${
              waitingMinutes !== null && waitingMinutes !== undefined
                ? ` (wait ${waitingMinutes}m)`
                : ''
            }`,
          },
          tx
        );

        return {
          appointment: updatedAppointment,
          visit: updatedVisit,
          consultation,
        };
      });

      res.json(updated);
    } catch (error) {
      console.error('Patient flow transition error:', error);
      res.status(500).json({ error: 'Failed to update patient flow status' });
    }
  }
);

// GET /api/flow/patient/:patientId — Patient visit & consultation history
router.get(
  '/patient/:patientId',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = String(req.params.patientId);
      if (
        req.authUser?.role === 'PATIENT' &&
        req.authUser.patientId !== patientId
      ) {
        res.status(403).json({ error: 'You may only view your own visit history' });
        return;
      }

      const visits = await prisma.patientVisit.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          appointment: true,
          doctor: true,
          consultation: true,
        },
      });
      res.json({ visits });
    } catch (error) {
      console.error('Patient visit history error:', error);
      res.status(500).json({ error: 'Failed to load patient visit history' });
    }
  }
);

export default router;
