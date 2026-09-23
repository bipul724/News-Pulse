import * as healthService from '../services/healthService.js';

export const getDatabaseHealth = async (req, res) => {
  try {
    await healthService.checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    // Log the cause server-side only; the response never includes connection details.
    console.error('[Health] Database check failed:', error.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
};
