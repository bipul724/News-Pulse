import * as ingestionService from '../services/ingestionService.js';

const sendConflict = (res, jobId) =>
  res.status(409).json({
    error: {
      message: 'An ingestion job is already running',
      code: 'CONCURRENT_INGESTION_CONFLICT',
      jobId,
    },
  });

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const triggerIngestion = async (req, res, next) => {
  try {
    const existingJob = await ingestionService.getRunningJob();
    if (existingJob) return sendConflict(res, existingJob.id);

    let jobId;
    try {
      jobId = await ingestionService.createJob();
    } catch (error) {
      // Two triggers can both pass the check above; the database's unique
      // index lets only one insert through. The other request joins that run.
      if (!ingestionService.isActiveJobConflict(error)) throw error;
      const winner = await ingestionService.getRunningJob();
      return sendConflict(res, winner?.id ?? null);
    }
    
    // Start Python ingestion in the background; the request does not wait for it.
    ingestionService.startPythonIngestion(jobId).catch((err) => {
      console.error(`[Ingest ${jobId}] Background ingestion error:`, err);
    });

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
    if (!UUID_PATTERN.test(jobId)) {
      return res.status(400).json({ error: { message: 'Invalid job ID format', code: 'INVALID_ID' } });
    }

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
      jobId: job.id,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      stats: {
        fetchedArticles: job.fetchedArticles ?? null,
        newArticles: job.newArticles ?? null,
        clustersCreated: job.clustersCreated ?? null,
      },
      error: job.error || null,
    });
  } catch (error) {
    next(error);
  }
};
