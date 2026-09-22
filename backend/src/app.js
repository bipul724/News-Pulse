import express from 'express';
import cors from 'cors';

import clusterRoutes from './routes/clusterRoutes.js';
import timelineRoutes from './routes/timelineRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

app.use('/clusters', clusterRoutes);
app.use('/timeline', timelineRoutes);
app.use('/ingest', ingestRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
