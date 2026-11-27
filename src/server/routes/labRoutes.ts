import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, type StaffRole, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const PRIVATE_LAB_STORAGE_DIR = path.resolve(process.cwd(), 'storage/lab-reports');
fs.mkdirSync(PRIVATE_LAB_STORAGE_DIR, { recursive: true });

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

const LAB_STATUS_ORDER = [
  'REQUESTED',
  'SAMPLE_COLLECTED',
  'PROCESSING',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'RELEASED',
] as const;

type LabStatus = (typeof LAB_STATUS_ORDER)[number];

const ALLOWED_LAB_TRANSITIONS: Record<
  LabStatus,
  Array<{ target: LabStatus; roles: StaffRole[] }>
> = {
  REQUESTED: [
    { target: 'SAMPLE_COLLECTED', roles: ['LAB_TECHNICIAN', 'ADMIN'] },
  ],
  SAMPLE_COLLECTED: [
    { target: 'PROCESSING', roles: ['LAB_TECHNICIAN', 'ADMIN'] },
  ],
  PROCESSING: [
    { target: 'COMPLETED', roles: ['LAB_TECHNICIAN', 'ADMIN'] },
  ],
  COMPLETED: [
    { target: 'UNDER_REVIEW', roles: ['LAB_TECHNICIAN', 'DOCTOR', 'ADMIN'] },
  ],
  UNDER_REVIEW: [
    { target: 'PROCESSING', roles: ['DOCTOR', 'ADMIN'] },
    { target: 'APPROVED', roles: ['DOCTOR', 'ADMIN'] },
  ],
  APPROVED: [
    { target: 'RELEASED', roles: ['DOCTOR', 'ADMIN'] },
  ],
  RELEASED: [],
};

const createLabTestSchema = z.object({
  code: z.string().min(2).max(24).transform((s) => s.trim().toUpperCase()),
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  sampleType: z.string().min(2).max(80),
  unit: z.string().max(40).default(''),
  referenceRange: z.string().max(120).default(''),
  turnaroundHours: z.coerce.number().int().min(1).max(336).default(24),
  priceCents: z.coerce.number().int().min(0).max(1000000).default(0),
});

const createLabOrderSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional(),
  appointmentId: z.string().optional().nullable(),
  labTestId: z.string().min(1),
  technicianId: z.string().optional().nullable(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  clinicalIndication: z.string().max(500).default(''),
});

const labResultItemSchema = z.object({
  parameterName: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  unit: z.string().max(40).default(''),
  referenceRange: z.string().max(120).default(''),
  flag: z.enum(['NORMAL', 'LOW', 'HIGH', 'CRITICAL']).default('NORMAL'),
  notes: z.string().max(500).default(''),
});

const saveResultsSchema = z.object({
  results: z.array(labResultItemSchema).min(1).max(40),
});

const transitionSchema = z.object({
  targetStatus: z.enum([
    'SAMPLE_COLLECTED',
    'PROCESSING',
    'COMPLETED',
    'UNDER_REVIEW',
    'APPROVED',
    'RELEASED',
  ]),
  sampleId: z.string().max(80).optional(),
  doctorReviewNotes: z.string().max(1000).optional(),
});

function sanitizeFileName(raw: string): string {
  const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'lab-report'}.pdf`;
}

// GET /api/lab/tests — Browse lab test catalog
router.get('/tests', requireAuth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const tests = await prisma.labTest.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({ tests });
  } catch (error) {
    console.error('List lab tests error:', error);
    res.status(500).json({ error: 'Failed to load laboratory test catalog' });
  }
});

// POST /api/lab/tests — Add test to catalog (ADMIN | LAB_TECHNICIAN)
router.post(
  '/tests',
  requireAuth,
  requireRole('ADMIN', 'LAB_TECHNICIAN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createLabTestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid lab test data' });
        return;
      }

      const existing = await prisma.labTest.findUnique({
        where: { code: parsed.data.code },
      });
      if (existing) {
        res.status(409).json({ error: `Lab test code ${parsed.data.code} already exists` });
        return;
      }

      const test = await prisma.$transaction(async (tx) => {
        const created = await tx.labTest.create({ data: parsed.data });
        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'LAB_TEST_CREATED',
            entityType: 'LabTest',
            entityId: created.id,
            details: `${created.code} — ${created.name}`,
          },
          tx
        );
        return created;
      });

      res.status(201).json({ test });
    } catch (error) {
      console.error('Create lab test error:', error);
      res.status(500).json({ error: 'Failed to create lab test' });
    }
  }
);

// PATCH /api/lab/tests/:id — Update test catalog item (ADMIN | LAB_TECHNICIAN)
router.patch(
  '/tests/:id',
  requireAuth,
  requireRole('ADMIN', 'LAB_TECHNICIAN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const schema = createLabTestSchema.partial().extend({
        active: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid lab test update' });
        return;
      }

      const test = await prisma.labTest.update({
        where: { id },
        data: parsed.data,
      });
      res.json({ test });
    } catch (error) {
      console.error('Update lab test error:', error);
      res.status(500).json({ error: 'Failed to update lab test' });
    }
  }
);

// GET /api/lab/technicians — List active lab technicians for assignment
router.get(
  '/technicians',
  requireAuth,
  requireRole('ADMIN', 'DOCTOR', 'LAB_TECHNICIAN'),
  async (_req, res) => {
    try {
      const role = await prisma.role.findUnique({ where: { name: 'LAB_TECHNICIAN' } });
      if (!role) {
        res.json({ technicians: [] });
        return;
      }
      const technicians = await prisma.user.findMany({
        where: { roleId: role.id, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
      res.json({ technicians });
    } catch (error) {
      console.error('List lab technicians error:', error);
      res.status(500).json({ error: 'Failed to load lab technicians' });
    }
  }
);

// GET /api/lab/orders — List lab orders with role-based scoping
router.get(
  '/orders',
  requireAuth,
  requireRole('ADMIN', 'DOCTOR', 'LAB_TECHNICIAN', 'RECEPTIONIST', 'PATIENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const patientId =
        typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
      const doctorId =
        typeof req.query.doctorId === 'string' ? req.query.doctorId : undefined;
      const assignedToMe = req.query.assignedToMe === 'true';

      const isPatient = req.authUser?.role === 'PATIENT';
      if (isPatient && !req.authUser?.patientId) {
        res.status(403).json({ error: 'Patient profile is not linked to this account' });
        return;
      }

      const orders = await prisma.labOrder.findMany({
        where: {
          ...(isPatient ? { patientId: req.authUser!.patientId! } : {}),
          ...(!isPatient && patientId ? { patientId } : {}),
          ...(doctorId && doctorId !== 'all' ? { doctorId } : {}),
          ...(status && status !== 'all' ? { status } : {}),
          ...(assignedToMe && req.authUser?.role === 'LAB_TECHNICIAN'
            ? { technicianId: req.authUser.id }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          labTest: true,
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              dateOfBirth: true,
            },
          },
          doctor: {
            select: { id: true, name: true, specialty: true, room: true },
          },
          technician: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
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
      });

      // Security: patients & receptionists never see unreleased results or unreleased PDF reports
      const sanitized = orders.map((order) => {
        if (
          (isPatient || req.authUser?.role === 'RECEPTIONIST') &&
          order.status !== 'RELEASED'
        ) {
          return {
            ...order,
            doctorReviewNotes: '',
            results: [],
            reports: [],
          };
        }
        return order;
      });

      res.json({ orders: sanitized });
    } catch (error) {
      console.error('List lab orders error:', error);
      res.status(500).json({ error: 'Failed to load laboratory orders' });
    }
  }
);

// POST /api/lab/orders — Create lab request (DOCTOR | ADMIN)
router.post(
  '/orders',
  requireAuth,
  requireRole('DOCTOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createLabOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid lab order payload' });
        return;
      }

      const resolvedDoctorId =
        req.authUser?.role === 'DOCTOR' && req.authUser.doctorId
          ? req.authUser.doctorId
          : parsed.data.doctorId;

      if (!resolvedDoctorId) {
        res.status(400).json({ error: 'Ordering doctor is required' });
        return;
      }

      const [patient, doctor, labTest] = await Promise.all([
        prisma.patient.findUnique({ where: { id: parsed.data.patientId } }),
        prisma.doctor.findUnique({ where: { id: resolvedDoctorId } }),
        prisma.labTest.findUnique({ where: { id: parsed.data.labTestId } }),
      ]);

      if (!patient || patient.status === 'Archived') {
        res.status(404).json({ error: 'Active patient not found' });
        return;
      }
      if (!doctor) {
        res.status(404).json({ error: 'Ordering doctor not found' });
        return;
      }
      if (!labTest || !labTest.active) {
        res.status(404).json({ error: 'Active lab test not found' });
        return;
      }

      if (parsed.data.technicianId) {
        const tech = await prisma.user.findUnique({
          where: { id: parsed.data.technicianId },
          include: { role: true },
        });
        if (!tech || !tech.active || tech.role.name !== 'LAB_TECHNICIAN') {
          res.status(400).json({ error: 'Selected user is not an active lab technician' });
          return;
        }
      }

      const orderNumber = `LAB-${Date.now().toString().slice(-6)}-${Math.floor(
        10 + Math.random() * 89
      )}`;

      const created = await prisma.$transaction(async (tx) => {
        const order = await tx.labOrder.create({
          data: {
            orderNumber,
            patientId: patient.id,
            doctorId: doctor.id,
            appointmentId: parsed.data.appointmentId || null,
            labTestId: labTest.id,
            technicianId: parsed.data.technicianId || null,
            priority: parsed.data.priority,
            clinicalIndication: parsed.data.clinicalIndication.trim(),
            status: 'REQUESTED',
          },
          include: {
            labTest: true,
            patient: {
              select: { id: true, name: true, email: true, phone: true, dateOfBirth: true },
            },
            doctor: { select: { id: true, name: true, specialty: true, room: true } },
            technician: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
            results: true,
            reports: true,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'LAB_ORDER_CREATED',
            entityType: 'LabOrder',
            entityId: order.id,
            details: `${order.orderNumber} (${labTest.code}) for ${patient.name}`,
          },
          tx
        );

        return order;
      });

      res.status(201).json({ order: created });
    } catch (error) {
      console.error('Create lab order error:', error);
      res.status(500).json({ error: 'Failed to create laboratory request' });
    }
  }
);

// PATCH /api/lab/orders/:id/assign — Assign technician (ADMIN | LAB_TECHNICIAN)
router.patch(
  '/:id/assign'.replace('/:', '/orders/:'),
  requireAuth,
  requireRole('ADMIN', 'LAB_TECHNICIAN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const schema = z.object({
        technicianId: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Technician ID is required' });
        return;
      }

      const tech = await prisma.user.findUnique({
        where: { id: parsed.data.technicianId },
        include: { role: true },
      });
      if (!tech || !tech.active || tech.role.name !== 'LAB_TECHNICIAN') {
        res.status(400).json({ error: 'Target user must be an active LAB_TECHNICIAN' });
        return;
      }

      const order = await prisma.$transaction(async (tx) => {
        const updated = await tx.labOrder.update({
          where: { id },
          data: { technicianId: tech.id },
          include: {
            labTest: true,
            patient: {
              select: { id: true, name: true, email: true, phone: true, dateOfBirth: true },
            },
            doctor: { select: { id: true, name: true, specialty: true, room: true } },
            technician: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
            results: true,
            reports: true,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'LAB_ORDER_ASSIGNED',
            entityType: 'LabOrder',
            entityId: updated.id,
            details: `Assigned ${updated.orderNumber} to ${tech.name}`,
          },
          tx
        );

        return updated;
      });

      res.json({ order });
    } catch (error) {
      console.error('Assign lab order error:', error);
      res.status(500).json({ error: 'Failed to assign lab technician' });
    }
  }
);

// POST /api/lab/orders/:id/results — Enter or update laboratory results (LAB_TECHNICIAN | ADMIN)
router.post(
  '/orders/:id/results',
  requireAuth,
  requireRole('LAB_TECHNICIAN', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const parsed = saveResultsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid laboratory results' });
        return;
      }

      const existing = await prisma.labOrder.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Lab order not found' });
        return;
      }
      if (!['SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'].includes(existing.status)) {
        res.status(400).json({
          error: `Results cannot be edited while order is in ${existing.status} state`,
        });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.labResult.deleteMany({ where: { labOrderId: id } });
        await tx.labResult.createMany({
          data: parsed.data.results.map((r) => ({
            labOrderId: id,
            parameterName: r.parameterName.trim(),
            value: r.value.trim(),
            unit: r.unit.trim(),
            referenceRange: r.referenceRange.trim(),
            flag: r.flag,
            notes: r.notes.trim(),
            enteredById: req.authUser?.id,
          })),
        });

        const order = await tx.labOrder.findUnique({
          where: { id },
          include: {
            labTest: true,
            patient: {
              select: { id: true, name: true, email: true, phone: true, dateOfBirth: true },
            },
            doctor: { select: { id: true, name: true, specialty: true, room: true } },
            technician: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
            results: { orderBy: { createdAt: 'asc' } },
            reports: true,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'LAB_RESULTS_RECORDED',
            entityType: 'LabOrder',
            entityId: id,
            details: `Saved ${parsed.data.results.length} result parameter(s) for ${existing.orderNumber}`,
          },
          tx
        );

        return order;
      });

      res.json({ order: updated });
    } catch (error) {
      console.error('Save lab results error:', error);
      res.status(500).json({ error: 'Failed to save laboratory results' });
    }
  }
);

// POST /api/lab/orders/:id/report — Private PDF upload (LAB_TECHNICIAN | ADMIN)
router.post(
  '/orders/:id/report',
  requireAuth,
  requireRole('LAB_TECHNICIAN', 'ADMIN'),
  express.raw({ type: 'application/pdf', limit: '5mb' }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const order = await prisma.labOrder.findUnique({
        where: { id },
        include: { labTest: true, patient: true },
      });
      if (!order) {
        res.status(404).json({ error: 'Lab order not found' });
        return;
      }
      if (order.status === 'REQUESTED') {
        res.status(400).json({ error: 'Collect sample before uploading a lab report' });
        return;
      }
      if (['APPROVED', 'RELEASED'].includes(order.status)) {
        res.status(400).json({ error: 'Cannot replace reports after doctor approval' });
        return;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'A non-empty PDF file (application/pdf) is required' });
        return;
      }
      if (req.body.length > MAX_PDF_BYTES) {
        res.status(413).json({ error: 'PDF report exceeds maximum 5 MB file limit' });
        return;
      }
      // Validate PDF magic header bytes (%PDF-)
      if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
        res.status(400).json({ error: 'Invalid file format: uploaded file is not a valid PDF' });
        return;
      }

      const rawNameHeader = req.headers['x-file-name'];
      const rawTitleHeader = req.headers['x-report-title'];
      const decodedName =
        typeof rawNameHeader === 'string'
          ? decodeURIComponent(rawNameHeader)
          : `${order.orderNumber}.pdf`;
      const originalFileName = sanitizeFileName(decodedName);
      const title =
        typeof rawTitleHeader === 'string' && rawTitleHeader.trim()
          ? decodeURIComponent(rawTitleHeader).slice(0, 140)
          : `${order.labTest.name} Report`;

      const storedFileName = `${crypto.randomUUID()}.pdf`;
      const resolvedPath = path.resolve(PRIVATE_LAB_STORAGE_DIR, storedFileName);
      if (!resolvedPath.startsWith(PRIVATE_LAB_STORAGE_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid storage path' });
        return;
      }

      const sha256 = crypto.createHash('sha256').update(req.body).digest('hex');
      fs.writeFileSync(resolvedPath, req.body);

      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.labReport.create({
          data: {
            labOrderId: order.id,
            patientId: order.patientId,
            title,
            originalFileName,
            storedFileName,
            mimeType: 'application/pdf',
            fileSize: req.body.length,
            sha256,
            uploadedById: req.authUser?.id,
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'LAB_REPORT_UPLOADED',
            entityType: 'LabReport',
            entityId: created.id,
            details: `Uploaded ${originalFileName} (${req.body.length} bytes) for ${order.orderNumber}`,
          },
          tx
        );

        return created;
      });

      res.status(201).json({
        report: {
          id: report.id,
          labOrderId: report.labOrderId,
          patientId: report.patientId,
          title: report.title,
          originalFileName: report.originalFileName,
          mimeType: report.mimeType,
          fileSize: report.fileSize,
          createdAt: report.createdAt,
        },
      });
    } catch (error) {
      console.error('Upload lab report error:', error);
      res.status(500).json({ error: 'Failed to upload PDF laboratory report' });
    }
  }
);

// POST /api/lab/orders/:id/transition — Enforce lab status machine and role checks
router.post('/orders/:id/transition', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id);
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid transition request' });
      return;
    }

    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        labTest: true,
        patient: { include: { notificationPreference: true } },
        results: true,
      },
    });
    if (!order) {
      res.status(404).json({ error: 'Lab order not found' });
      return;
    }

    const currentStatus = order.status as LabStatus;
    const targetStatus = parsed.data.targetStatus as LabStatus;
    const rule = ALLOWED_LAB_TRANSITIONS[currentStatus]?.find(
      (r) => r.target === targetStatus
    );

    if (!rule) {
      res.status(400).json({
        error: `Invalid laboratory status transition: ${currentStatus} -> ${targetStatus}`,
      });
      return;
    }

    if (!req.authUser || !rule.roles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Only ${rule.roles.join(' or ')} may move a lab order from ${currentStatus} to ${targetStatus}`,
      });
      return;
    }

    if (targetStatus === 'COMPLETED' && order.results.length === 0) {
      res.status(400).json({
        error: 'Enter at least one laboratory result before marking the test as COMPLETED',
      });
      return;
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.labOrder.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(targetStatus === 'SAMPLE_COLLECTED'
            ? {
                sampleCollectedAt: now,
                sampleId:
                  parsed.data.sampleId?.trim() ||
                  order.sampleId ||
                  `SMP-${order.orderNumber.replace('LAB-', '')}`,
              }
            : {}),
          ...(targetStatus === 'PROCESSING' ? { processingStartedAt: now } : {}),
          ...(targetStatus === 'COMPLETED' ? { completedAt: now } : {}),
          ...(targetStatus === 'UNDER_REVIEW' ? { reviewStartedAt: now } : {}),
          ...(targetStatus === 'APPROVED'
            ? {
                approvedAt: now,
                approvedById: req.authUser!.id,
                ...(parsed.data.doctorReviewNotes !== undefined
                  ? { doctorReviewNotes: parsed.data.doctorReviewNotes.trim() }
                  : {}),
              }
            : {}),
          ...(targetStatus === 'RELEASED'
            ? {
                releasedAt: now,
                ...(parsed.data.doctorReviewNotes !== undefined
                  ? { doctorReviewNotes: parsed.data.doctorReviewNotes.trim() }
                  : {}),
              }
            : {}),
        },
        include: {
          labTest: true,
          patient: {
            select: { id: true, name: true, email: true, phone: true, dateOfBirth: true },
          },
          doctor: { select: { id: true, name: true, specialty: true, room: true } },
          technician: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
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
      });

      if (targetStatus === 'RELEASED') {
        const allowAlert =
          order.patient.notificationPreference?.labReportAlerts ?? true;
        if (allowAlert) {
          await tx.patientNotification.create({
            data: {
              patientId: order.patientId,
              type: 'LAB_REPORT',
              title: `Lab report ready: ${order.labTest.name}`,
              message: `Your ${order.labTest.name} (${order.orderNumber}) has been reviewed and released by your doctor.`,
              labOrderId: order.id,
              actionRoute: 'lab_reports',
            },
          });
        }
      }

      await writeAuditLog(
        {
          actor: req.authUser,
          action: `LAB_STATUS_${targetStatus}`,
          entityType: 'LabOrder',
          entityId: order.id,
          details: `${order.orderNumber}: ${currentStatus} -> ${targetStatus}`,
        },
        tx
      );

      return nextOrder;
    });

    res.json({ order: updated });
  } catch (error) {
    console.error('Lab transition error:', error);
    res.status(500).json({ error: 'Failed to update laboratory order status' });
  }
});

// GET /api/lab/reports/:reportId/download — Private authenticated PDF download
router.get('/reports/:reportId/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reportId = String(req.params.reportId);
    const report = await prisma.labReport.findUnique({
      where: { id: reportId },
      include: { labOrder: true },
    });

    if (!report) {
      res.status(404).json({ error: 'Laboratory report not found' });
      return;
    }

    const role = req.authUser?.role;
    if (!role || role === 'RECEPTIONIST') {
      res.status(403).json({ error: 'Access denied to laboratory report files' });
      return;
    }

    if (role === 'PATIENT') {
      if (!req.authUser?.patientId || report.patientId !== req.authUser.patientId) {
        res.status(403).json({ error: 'Access denied: you may only download your own reports' });
        return;
      }
      if (report.labOrder.status !== 'RELEASED') {
        res.status(403).json({
          error: 'This laboratory report has not been approved and released by your doctor yet',
        });
        return;
      }
    }

    const safeFileName = path.basename(report.storedFileName);
    const resolvedPath = path.resolve(PRIVATE_LAB_STORAGE_DIR, safeFileName);
    if (!resolvedPath.startsWith(PRIVATE_LAB_STORAGE_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid report file reference' });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Report file is unavailable in storage' });
      return;
    }

    await writeAuditLog({
      actor: req.authUser,
      action: 'LAB_REPORT_DOWNLOADED',
      entityType: 'LabReport',
      entityId: report.id,
      details: `Downloaded ${report.originalFileName} (${report.labOrder.orderNumber})`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFileName(report.originalFileName)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolvedPath);
  } catch (error) {
    console.error('Download lab report error:', error);
    res.status(500).json({ error: 'Failed to download laboratory report' });
  }
});

export default router;
