import * as sourceService from '../services/sourceService.js';

export const getSources = async (req, res, next) => {
  try {
    const sources = await sourceService.getSources();
    res.json({ sources });
  } catch (error) {
    next(error);
  }
};
