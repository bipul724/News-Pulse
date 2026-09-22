import * as timelineService from '../services/timelineService.js';

export const getTimeline = async (req, res, next) => {
  try {
    const timeline = await timelineService.getTimelineData();
    res.json({ timeline });
  } catch (error) {
    next(error);
  }
};
