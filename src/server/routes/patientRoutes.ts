import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, requireRole } from '../auth.ts';
import { writeAuditLog } from '../audit.ts';

const router = Router();

const createPatientSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(40),
  email: z.string().email(),
  dateOfBirth: z.string().min(4),
  insuranceProvider: z.string().min(1),
  memberId: z.string().min(1),
  assignedDoctorId: z.string().min(1),
  status: z.enum(['Active', 'New', 'Follow-up', 'Archived']).default('New'),
  lastAppointment: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

const updatePatientSchema = createPatientSchema.partial();

const AVATAR_TONES = ['#DCECE4', '#E3EEF3', '#EAF4EF', '#E6ECE8', '#E4EFEA', '#E1ECE7'];

function serializePatient(p: {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  insuranceProvider: string;
  memberId: string;
  assignedDoctorId: string;
  status: string;
  lastAppointment: string;
  tags: string;
  notes: string;
  avatarColor: string;
  archivedAt: Date | null;
}) {
  let parsedTags: string[] = [];
  try {
    const val = JSON.parse(p.tags);
    if (Array.isArray(val)) parsedTags = val.map(String);
  } catch {
    parsedTags = [];
  }
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    dateOfBirth: p.dateOfBirth,
    insuranceProvider: p.insuranceProvider,
    memberId: p.memberId,
    assignedDoctorId: p.assignedDoctorId,
    status: p.status,
    lastAppointment: p.lastAppointment,
    tags: parsedTags,
    notes: p.notes,
    avatarColor: p.avatarColor,
    archivedAt: p.archivedAt,
  };
}

// GET /api/patients — Search, filter, paginate
router.get('/', requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : 'all';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const where = {
      ...(status !== 'all' ? { status } : {}),
      ...(doctorId !== 'all' ? { assignedDoctorId: doctorId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      items: rows.map(serializePatient),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('List patients error:', error);
    res.status(500).json({ error: 'Failed to retrieve patients' });
  }
});

// GET /api/patients/:id — Full patient profile + visit history
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        assignedDoctor: true,
        appointments: {
          orderBy: [{ date: 'desc' }, { time: 'desc' }],
          include: {
            doctor: true,
            visit: true,
            consultation: true,
          },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    res.json({
      patient: serializePatient(patient),
      assignedDoctor: patient.assignedDoctor,
      appointments: patient.appointments,
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to load patient details' });
  }
});

// POST /api/patients — Create patient (ADMIN | RECEPTIONIST)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createPatientSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid patient data' });
        return;
      }

      const email = parsed.data.email.trim().toLowerCase();
      const duplicate = await prisma.patient.findUnique({ where: { email } });
      if (duplicate) {
        res.status(409).json({ error: 'A patient with this email already exists' });
        return;
      }

      const doctor = await prisma.doctor.findUnique({
        where: { id: parsed.data.assignedDoctorId },
      });
      if (!doctor) {
        res.status(400).json({ error: 'Assigned doctor does not exist' });
        return;
      }

      const count = await prisma.patient.count();
      const created = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: {
            name: parsed.data.name.trim(),
            phone: parsed.data.phone.trim(),
            email,
            dateOfBirth: parsed.data.dateOfBirth,
            insuranceProvider: parsed.data.insuranceProvider.trim(),
            memberId: parsed.data.memberId.trim(),
            assignedDoctorId: parsed.data.assignedDoctorId,
            status: parsed.data.status,
            lastAppointment:
              parsed.data.lastAppointment ?? new Date().toISOString().slice(0, 10),
            tags: JSON.stringify(parsed.data.tags),
            notes: parsed.data.notes.trim(),
            avatarColor: AVATAR_TONES[count % AVATAR_TONES.length],
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PATIENT_CREATED',
            entityType: 'Patient',
            entityId: patient.id,
            details: `Registered patient ${patient.name}`,
          },
          tx
        );
        return patient;
      });

      res.status(201).json({ patient: serializePatient(created) });
    } catch (error) {
      console.error('Create patient error:', error);
      res.status(500).json({ error: 'Failed to create patient' });
    }
  }
);

// PATCH /api/patients/:id — Update patient (ADMIN | RECEPTIONIST | DOCTOR notes)
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const parsed = updatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid patient update' });
        return;
      }

      const existing = await prisma.patient.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }

      // Doctors may update clinical notes & tags, while Admin/Receptionist may edit all demographics
      const isDoctor = req.authUser?.role === 'DOCTOR';
      const dataToUpdate = isDoctor
        ? {
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
            ...(parsed.data.tags !== undefined
              ? { tags: JSON.stringify(parsed.data.tags) }
              : {}),
          }
        : {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
            ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone.trim() } : {}),
            ...(parsed.data.email !== undefined
              ? { email: parsed.data.email.trim().toLowerCase() }
              : {}),
            ...(parsed.data.dateOfBirth !== undefined
              ? { dateOfBirth: parsed.data.dateOfBirth }
              : {}),
            ...(parsed.data.insuranceProvider !== undefined
              ? { insuranceProvider: parsed.data.insuranceProvider.trim() }
              : {}),
            ...(parsed.data.memberId !== undefined
              ? { memberId: parsed.data.memberId.trim() }
              : {}),
            ...(parsed.data.assignedDoctorId !== undefined
              ? { assignedDoctorId: parsed.data.assignedDoctorId }
              : {}),
            ...(parsed.data.status !== undefined
              ? {
                  status: parsed.data.status,
                  archivedAt: parsed.data.status === 'Archived' ? new Date() : null,
                }
              : {}),
            ...(parsed.data.lastAppointment !== undefined
              ? { lastAppointment: parsed.data.lastAppointment }
              : {}),
            ...(parsed.data.tags !== undefined
              ? { tags: JSON.stringify(parsed.data.tags) }
              : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          };

      const updated = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.update({
          where: { id },
          data: dataToUpdate,
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PATIENT_UPDATED',
            entityType: 'Patient',
            entityId: patient.id,
            details: `Updated ${patient.name}`,
          },
          tx
        );

        return patient;
      });

      res.json({ patient: serializePatient(updated) });
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(500).json({ error: 'Failed to update patient record' });
    }
  }
);

// DELETE /api/patients/:id — Archive instead of hard delete (ADMIN | RECEPTIONIST)
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'RECEPTIONIST'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.patient.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }

      const archived = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.update({
          where: { id },
          data: {
            status: 'Archived',
            archivedAt: new Date(),
          },
        });

        await writeAuditLog(
          {
            actor: req.authUser,
            action: 'PATIENT_ARCHIVED',
            entityType: 'Patient',
            entityId: patient.id,
            details: `Archived patient record ${patient.name}`,
          },
          tx
        );
        return patient;
      });

      res.json({ patient: serializePatient(archived) });
    } catch (error) {
      console.error('Archive patient error:', error);
      res.status(500).json({ error: 'Failed to archive patient' });
    }
  }
);

export default router;
