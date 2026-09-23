import express from 'express';
import cors from 'cors';

import clusterRoutes from './routes/clusterRoutes.js';
import timelineRoutes from './routes/timelineRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';
import sourceRoutes from './routes/sourceRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import { getDatabaseHealth } from './controllers/healthController.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
// FRONTEND_URL may list several origins, comma-separated
// (e.g. the production domain plus a Vercel preview URL).
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'news-pulse-backend',
  });
});

app.get('/health/db', getDatabaseHealth);

app.use('/clusters', clusterRoutes);
app.use('/timeline', timelineRoutes);
app.use('/ingest', ingestRoutes);
app.use('/sources', sourceRoutes);
app.use('/stats', statsRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
