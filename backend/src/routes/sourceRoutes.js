import express from 'express';
import { getSources } from '../controllers/sourceController.js';

const router = express.Router();

router.get('/', getSources);

export default router;
