import * as ingestionService from '../services/ingestionService.js';

export const triggerIngestion = async (req, res, next) => {
  try {
    const existingJob = await ingestionService.getRunningJob();
    if (existingJob) {
      return res.status(409).json({
        error: {
          message: 'An ingestion job is already running',
          code: 'CONCURRENT_INGESTION_CONFLICT',
          jobId: existingJob.jobId
        }
      });
    }

    const jobId = await ingestionService.createJob();
    
    // Start Python ingestion process in background
    ingestionService.startPythonIngestion(jobId);

    res.status(202).json({
      jobId,
      status: 'queued'
    });
  } catch (error) {
    next(error);
  }
};

export const getIngestionStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await ingestionService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        error: {
          message: 'Job not found',
          code: 'NOT_FOUND'
        }
      });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error || null,
    });
  } catch (error) {
    next(error);
  }
};
