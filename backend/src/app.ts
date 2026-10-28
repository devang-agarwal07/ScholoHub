import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { globalErrorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import scholarshipRoutes from './modules/scholarship/scholarship.routes';
import applicationRoutes from './modules/application/application.routes';
import documentRoutes from './modules/document/document.routes';
import workflowRoutes from './modules/workflow/workflow.routes';
import reportRoutes from './modules/report/report.routes';

// Worker imports
import { startEmailWorker } from './jobs/workers/emailWorker';
import { startReportWorker } from './jobs/workers/reportWorker';

const app = express();
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '5000', 10);
const frontendDir = path.resolve(__dirname, '../../frontend/dist');
const serveFrontend = process.env.SERVE_FRONTEND === 'true' && fs.existsSync(path.join(frontendDir, 'index.html'));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: true, // Allow any origin dynamically (fixes login issues)
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
morgan.token('safe-url', (req) => req.url?.split('?')[0] || '/');
app.use(morgan(':method :safe-url :status :response-time ms'));
app.use(generalLimiter);
app.use('/uploads', express.static(uploadsDir));

// ─── HEALTH CHECK ───────────────────────────────────────────
app.get('/', (_req, res) => {
  if (serveFrontend) {
    res.sendFile(path.join(frontendDir, 'index.html'));
    return;
  }
  res.send('<h1>Scholarship Management API is running! 🚀</h1><p>Go to the frontend portal to log in.</p>');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API ROUTES ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/reports', reportRoutes);

// A single Render web service can host the SPA and API on the same origin.
if (serveFrontend) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/') || req.path === '/uploads' || req.path.startsWith('/uploads/')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// ─── 404 HANDLER ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─── GLOBAL ERROR HANDLER ───────────────────────────────────
app.use(globalErrorHandler);

// ─── START SERVER ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API docs: http://localhost:${PORT}/api/health\n`);

  // Start background workers if Redis is configured
  if (process.env.REDIS_URL) {
    startEmailWorker();
    startReportWorker();
  } else {
    console.warn('⚠️ REDIS_URL not configured. Background workers disabled.');
  }
});

export default app;
