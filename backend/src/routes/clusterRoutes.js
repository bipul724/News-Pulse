import express from 'express';
import { getClusters, getClusterById } from '../controllers/clusterController.js';

const router = express.Router();

router.get('/', getClusters);
router.get('/:id', getClusterById);

export default router;
