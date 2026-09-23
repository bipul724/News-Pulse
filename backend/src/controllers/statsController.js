import * as statsService from '../services/statsService.js';

export const getStats = async (req, res, next) => {
  try {
    const stats = await statsService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
