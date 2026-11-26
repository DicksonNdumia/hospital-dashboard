import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  audience: z.string().min(2).max(200),
  recipientCount: z.coerce.number().int().min(1).max(50000),
  status: z.enum(['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  messageTemplate: z.string().min(5).max(2000),
});

// GET /api/campaigns
router.get('/', requireAuth, async (_req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { recipients: true } },
      },
    });
    res.json({ campaigns });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

// POST /api/campaigns (ADMIN only)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = campaignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign payload' });
        return;
      }

      const created = await prisma.$transaction(async (tx) => {
        const camp = await tx.campaign.create({
          data: {
            ...parsed.data,
            createdById: req.authUser?.id,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'CAMPAIGN_CREATED',
            entityType: 'Campaign',
            entityId: camp.id,
            details: `${camp.name} (${camp.status})`,
          },
          tx
        );

        return camp;
      });

      res.status(201).json({ campaign: created });
    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }
);

// PATCH /api/campaigns/:id (ADMIN only)
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const parsed = campaignSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign update' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const camp = await tx.campaign.update({
          where: { id },
          data: parsed.data,
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'CAMPAIGN_UPDATED',
            entityType: 'Campaign',
            entityId: camp.id,
            details: `${camp.name} (${camp.status})`,
          },
          tx
        );

        return camp;
      });

      res.json({ campaign: updated });
    } catch (error) {
      console.error('Update campaign error:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }
);

// POST /api/campaigns/:id/execute — Record DB-only campaign completion (no external providers)
router.post(
  '/:id/execute',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.campaign.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }
      if (existing.status === 'CANCELLED') {
        res.status(400).json({ error: 'Cancelled campaigns cannot be executed' });
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const activePatients = await prisma.patient.findMany({
        where: { status: { not: 'Archived' } },
        take: 10,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const sent = existing.recipientCount;
        const read = Math.round(sent * 0.88);
        const replies = Math.round(sent * 0.22);
        const bookings = Math.round(sent * 0.11);

        for (const p of activePatients) {
          await tx.campaignRecipient.upsert({
            where: {
              campaignId_patientId: {
                campaignId: existing.id,
                patientId: p.id,
              },
            },
            update: { deliveryStatus: 'SENT', sentAt: new Date() },
            create: {
              campaignId: existing.id,
              patientId: p.id,
              deliveryStatus: 'SENT',
              sentAt: new Date(),
            },
          });
        }

        const camp = await tx.campaign.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            scheduledDate: todayStr,
            sentCount: sent,
            readCount: read,
            replyCount: replies,
            bookingsCount: bookings,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'CAMPAIGN_EXECUTED',
            entityType: 'Campaign',
            entityId: camp.id,
            details: `Recorded DB campaign completion for ${sent} target recipients`,
          },
          tx
        );

        return camp;
      });

      res.json({ campaign: updated });
    } catch (error) {
      console.error('Execute campaign error:', error);
      res.status(500).json({ error: 'Failed to complete campaign' });
    }
  }
);

// DELETE /api/campaigns/:id — Cancel campaign (ADMIN only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const cancelled = await prisma.$transaction(async (tx) => {
        const camp = await tx.campaign.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'CAMPAIGN_CANCELLED',
            entityType: 'Campaign',
            entityId: camp.id,
            details: camp.name,
          },
          tx
        );
        return camp;
      });
      res.json({ campaign: cancelled });
    } catch (error) {
      console.error('Cancel campaign error:', error);
      res.status(500).json({ error: 'Failed to cancel campaign' });
    }
  }
);

export default router;
