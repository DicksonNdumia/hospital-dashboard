import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db.ts';

export type StaffRole =
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'DOCTOR'
  | 'LAB_TECHNICIAN'
  | 'PATIENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  doctorId: string | null;
  patientId: string | null;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Invalid session token' });
      return;
    }

    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: true,
            doctorProfile: true,
            patientProfile: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.user.active) {
      if (session) {
        await prisma.session
          .delete({ where: { id: session.id } })
          .catch(() => undefined);
      }
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    req.authUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role.name as StaffRole,
      doctorId: session.user.doctorProfile?.id ?? null,
      patientId: session.user.patientProfile?.id ?? null,
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Authentication verification failed' });
  }
}

export function requireRole(...allowedRoles: StaffRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Access denied: requires ${allowedRoles.join(' or ')} role`,
      });
      return;
    }
    next();
  };
}
