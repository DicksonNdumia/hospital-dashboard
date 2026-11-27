import { Router } from 'express';
import { z } from 'zod';
import { addDays, format, startOfWeek } from 'date-fns';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

// GET /api/analytics — Computed exclusively from database queries
router.get(
  '/analytics',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_TECHNICIAN'),
  async (_req, res) => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const weekMonday = startOfWeek(today, { weekStartsOn: 1 });

      const [
        todayAppointments,
        totalRegisteredPatients,
        doctors,
        allAppointments,
        unreadMessagesCount,
        campaigns,
        pendingLabOrders,
        underReviewLabOrders,
        releasedLabOrders,
      ] = await Promise.all([
        prisma.appointment.findMany({
          where: { date: todayStr },
          include: { visit: true },
        }),
        prisma.patient.count({
          where: { status: { not: 'Archived' } },
        }),
        prisma.doctor.findMany({
          orderBy: { name: 'asc' },
        }),
        prisma.appointment.findMany({
          include: { visit: true },
        }),
        prisma.message.count({
          where: { isRead: false },
        }),
        prisma.campaign.findMany(),
        prisma.labOrder.count({
          where: { status: { in: ['REQUESTED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'] } },
        }),
        prisma.labOrder.count({
          where: { status: 'UNDER_REVIEW' },
        }),
        prisma.labOrder.count({
          where: { status: 'RELEASED' },
        }),
      ]);

    const nonCancelledToday = todayAppointments.filter(
      (a) => a.status !== 'CANCELLED'
    );
    const completedToday = todayAppointments.filter(
      (a) => a.status === 'COMPLETED' || a.visit?.flowStatus === 'SEEN'
    );
    const waitingToday = todayAppointments.filter(
      (a) => a.visit?.flowStatus === 'WAITING'
    );
    const inConsultationToday = todayAppointments.filter(
      (a) => a.visit?.flowStatus === 'IN_CONSULTATION'
    );
    const noShowToday = todayAppointments.filter((a) => a.status === 'NO_SHOW');

    const noShowRate =
      nonCancelledToday.length > 0
        ? Number(((noShowToday.length / nonCancelledToday.length) * 100).toFixed(1))
        : 0;

    const waitsWithDuration = todayAppointments
      .map((a) => a.visit?.waitingMinutes)
      .filter((w): w is number => typeof w === 'number');
    const averageWaitMinutes =
      waitsWithDuration.length > 0
        ? Math.round(
            waitsWithDuration.reduce((sum, w) => sum + w, 0) /
              waitsWithDuration.length
          )
        : 0;

    // Weekly trend across Mon–Sat from actual appointment rows
    const appointmentTrends = Array.from({ length: 6 }, (_, idx) => {
      const d = addDays(weekMonday, idx);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayRows = allAppointments.filter((a) => a.date === dStr);
      return {
        day: format(d, 'EEE'),
        date: dStr,
        Scheduled: dayRows.filter((a) => a.status !== 'CANCELLED').length,
        Completed: dayRows.filter((a) => a.status === 'COMPLETED').length,
        NoShow: dayRows.filter((a) => a.status === 'NO_SHOW').length,
      };
    });

    // Doctor workload from actual appointment rows
    const doctorWorkload = doctors.map((doc) => {
      const docApts = allAppointments.filter(
        (a) => a.doctorId === doc.id && a.status !== 'CANCELLED'
      );
      const docToday = nonCancelledToday.filter((a) => a.doctorId === doc.id);
      const docCompleted = docApts.filter((a) => a.status === 'COMPLETED').length;
      const utilization =
        doc.dailyCapacity > 0
          ? Math.min(100, Math.round((docToday.length / doc.dailyCapacity) * 100))
          : 0;
      return {
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        totalVisits: docApts.length,
        todayVisits: docToday.length,
        completedVisits: docCompleted,
        dailyCapacity: doc.dailyCapacity,
        utilization,
      };
    });

    const campaignBookings = campaigns.reduce((s, c) => s + c.bookingsCount, 0);

      res.json({
        totalAppointmentsToday: nonCancelledToday.length,
        completedAppointmentsToday: completedToday.length,
        waitingCount: waitingToday.length,
        inConsultationCount: inConsultationToday.length,
        noShowCountToday: noShowToday.length,
        noShowRate,
        totalRegisteredPatients,
        averageWaitMinutes,
        unreadMessagesCount,
        campaignBookings,
        pendingLabOrders,
        underReviewLabOrders,
        releasedLabOrders,
        appointmentTrends,
        doctorWorkload,
      });
    } catch (error) {
      console.error('Analytics query error:', error);
      res.status(500).json({ error: 'Failed to compute clinic analytics' });
    }
  }
);

// GET /api/settings
router.get('/settings', requireAuth, async (_req, res) => {
  try {
    const settings = await prisma.clinicSetting.findUnique({
      where: { id: 'default' },
    });
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch clinic settings' });
  }
});

// PATCH /api/settings (ADMIN only)
router.patch(
  '/settings',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        clinicName: z.string().min(2).max(120),
        address: z.string().min(2).max(200),
        phone: z.string().min(5).max(40),
        email: z.string().email(),
        openingHours: z.string().min(2).max(200),
        autoReminder24h: z.boolean(),
        autoReminder2h: z.boolean(),
        includeParkingNote: z.boolean().optional(),
        defaultAppointmentDuration: z.coerce.number().int().min(10).max(120).optional(),
        requirePatientBookingApproval: z.boolean().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' });
        return;
      }

      const updated = await prisma.clinicSetting.upsert({
        where: { id: 'default' },
        update: parsed.data,
        create: { id: 'default', ...parsed.data },
      });

      await writeAuditLog({
        actor: req.authUser,
        action: 'SETTINGS_UPDATED',
        entityType: 'ClinicSetting',
        entityId: 'default',
        details: `Updated clinic settings (${updated.clinicName})`,
      });

      res.json({ settings: updated });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Failed to save clinic settings' });
    }
  }
);

// GET /api/audit-logs (ADMIN only)
router.get(
  '/audit-logs',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ logs });
    } catch (error) {
      console.error('Fetch audit logs error:', error);
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  }
);

export default router;
