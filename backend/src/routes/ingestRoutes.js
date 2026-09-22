import express from 'express';
import { triggerIngestion, getIngestionStatus } from '../controllers/ingestController.js';

const router = express.Router();

router.post('/trigger', triggerIngestion);
router.get('/status/:jobId', getIngestionStatus);

export default router;
