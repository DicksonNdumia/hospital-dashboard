import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, '../../prisma/clinic.db');
const defaultDbUrl = `file:${defaultDbPath}`;

const rawEnvUrl = process.env.DATABASE_URL?.trim();
const resolvedDbUrl =
  rawEnvUrl && rawEnvUrl.startsWith('file:') && rawEnvUrl !== 'file:./clinic.db'
    ? rawEnvUrl
    : defaultDbUrl;

process.env.DATABASE_URL = resolvedDbUrl;

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaClient ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDbUrl,
      },
    },
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}
