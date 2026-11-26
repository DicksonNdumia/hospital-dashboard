import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './src/server/routes/authRoutes.ts';
import patientRoutes from './src/server/routes/patientRoutes.ts';
import doctorRoutes from './src/server/routes/doctorRoutes.ts';
import appointmentRoutes from './src/server/routes/appointmentRoutes.ts';
import flowRoutes from './src/server/routes/flowRoutes.ts';
import campaignRoutes from './src/server/routes/campaignRoutes.ts';
import messageRoutes from './src/server/routes/messageRoutes.ts';
import analyticsRoutes from './src/server/routes/analyticsRoutes.ts';
import { ensureSeeded } from './src/server/seedClinicData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await ensureSeeded();

  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clinic: 'Northfield Family Clinic' });
  });

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/flow', flowRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/conversations', messageRoutes);
  app.use('/api', analyticsRoutes);

  // Unknown API route handler
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Northfield Family Clinic server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
