import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  patientId: z.string().optional(),
  initialMessage: z.string().max(2000).optional(),
});

const createMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  attachmentName: z.string().max(160).optional(),
  attachmentType: z.enum(['pdf', 'form', 'location']).optional(),
});

function serializeConversation(conv: {
  id: string;
  title: string;
  patientId: string | null;
  waitingReply: boolean;
  lastUpdated: Date;
  messages: Array<{
    id: string;
    senderId: string | null;
    senderName: string;
    senderRole: string;
    text: string;
    attachmentName: string | null;
    attachmentType: string | null;
    isRead: boolean;
    createdAt: Date;
  }>;
}) {
  const unreadCount = conv.messages.filter((m) => !m.isRead).length;
  return {
    id: conv.id,
    title: conv.title,
    patientId: conv.patientId,
    waitingReply: conv.waitingReply,
    unreadCount,
    lastUpdated: conv.lastUpdated.toISOString(),
    messages: conv.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      text: m.text,
      attachmentName: m.attachmentName,
      attachmentType: m.attachmentType,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

// GET /api/conversations — List internal clinic conversations & unread count
router.get('/', requireAuth, async (_req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { lastUpdated: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const serialized = conversations.map(serializeConversation);
    const totalUnread = serialized.reduce((sum, c) => sum + c.unreadCount, 0);

    res.json({ conversations: serialized, totalUnread });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to load clinic conversations' });
  }
});

// POST /api/conversations — Create internal conversation
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid conversation request' });
      return;
    }

    let patientName = '';
    if (parsed.data.patientId) {
      const existing = await prisma.conversation.findFirst({
        where: { patientId: parsed.data.patientId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (existing) {
        res.json({ conversation: serializeConversation(existing) });
        return;
      }
      const patient = await prisma.patient.findUnique({
        where: { id: parsed.data.patientId },
      });
      if (patient) patientName = patient.name;
    }

    const title =
      parsed.data.title?.trim() ||
      (patientName
        ? `${patientName} — Clinic Care Team`
        : 'Internal Staff Thread');

    const created = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          title,
          patientId: parsed.data.patientId ?? null,
          waitingReply: false,
          ...(parsed.data.initialMessage?.trim()
            ? {
                messages: {
                  create: {
                    senderId: req.authUser?.id,
                    senderName: req.authUser?.name ?? 'Clinic Staff',
                    senderRole: req.authUser?.role ?? 'STAFF',
                    text: parsed.data.initialMessage.trim(),
                    isRead: true,
                  },
                },
              }
            : {}),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      await writeAuditLog(
        {
          actor: req.authUser,
          action: 'CONVERSATION_CREATED',
          entityType: 'Conversation',
          entityId: conv.id,
          details: conv.title,
        },
        tx
      );
      return conv;
    });

    res.status(201).json({ conversation: serializeConversation(created) });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// POST /api/conversations/:id/messages — Send internal clinic message
router.post('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id);
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Message text is required' });
      return;
    }

    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          senderId: req.authUser?.id,
          senderName: req.authUser?.name ?? 'Clinic Staff',
          senderRole: req.authUser?.role ?? 'STAFF',
          text: parsed.data.text.trim(),
          attachmentName: parsed.data.attachmentName ?? null,
          attachmentType: parsed.data.attachmentType ?? null,
          isRead: true,
          readAt: new Date(),
        },
      });

      await tx.conversation.update({
        where: { id },
        data: {
          lastUpdated: new Date(),
          waitingReply: false,
        },
      });

      return message;
    });

    res.status(201).json({
      message: {
        id: result.id,
        senderId: result.senderId,
        senderName: result.senderName,
        senderRole: result.senderRole,
        text: result.text,
        attachmentName: result.attachmentName,
        attachmentType: result.attachmentType,
        isRead: result.isRead,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/conversations/:id/read — Mark conversation messages as read
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    await prisma.message.updateMany({
      where: { conversationId: id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
