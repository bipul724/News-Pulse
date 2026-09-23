import { spawn } from 'child_process';
import path from 'path';
import prisma from '../config/prisma.js';

// Job lifecycle: queued -> running -> completed | failed.
// Every transition is written to the IngestionJob table, so status survives restarts.
export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const ACTIVE_STATUSES = [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING];
const LOG_TAIL_CHARS = 4000;
const ERROR_EXCERPT_CHARS = 500;

export const getRunningJob = async () => {
  return prisma.ingestionJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
};

export const createJob = async () => {
  const job = await prisma.ingestionJob.create({
    data: { status: JOB_STATUS.QUEUED },
  });
  return job.id;
};

export const getJobStatus = async (jobId) => {
  return prisma.ingestionJob.findUnique({ where: { id: jobId } });
};

// A job left queued/running by a previous process can never finish; without this,
// it would block every future trigger with a 409.
export const recoverInterruptedJobs = async () => {
  const { count } = await prisma.ingestionJob.updateMany({
    where: { status: { in: ACTIVE_STATUSES } },
    data: {
      status: JOB_STATUS.FAILED,
      completedAt: new Date(),
      error: 'Interrupted: the server restarted before this job finished.',
    },
  });
  return count;
};

// The scraper already logs these counts; reading them avoids changing the pipeline.
const METRIC_PATTERNS = [
  { key: 'fetchedArticles', pattern: /Fetched (\d+) total articles from RSS feeds/ },
  { key: 'newArticles', pattern: /Inserted (\d+) new articles/ },
  { key: 'clustersCreated', pattern: /Formed (\d+) clusters/ },
];

export const parseMetricsLine = (line, metrics) => {
  for (const { key, pattern } of METRIC_PATTERNS) {
    const match = line.match(pattern);
    if (match) metrics[key] = Number(match[1]);
  }
  // With nothing new, the scraper skips the insert step and never logs "Inserted".
  const found = line.match(/Found (\d+) new articles to process/);
  if (found && Number(found[1]) === 0) metrics.newArticles = 0;
  return metrics;
};

export const redactSecrets = (text) => {
  let redacted = text.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection string]');
  if (process.env.DATABASE_URL) redacted = redacted.split(process.env.DATABASE_URL).join('[redacted]');
  return redacted;
};

const updateJob = async (jobId, data) => {
  try {
    await prisma.ingestionJob.update({ where: { id: jobId }, data });
  } catch (err) {
    console.error(`[Ingest ${jobId}] Failed to persist job update:`, err.message);
  }
};

export const startPythonIngestion = async (jobId) => {
  await updateJob(jobId, { status: JOB_STATUS.RUNNING, startedAt: new Date() });

  const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
  const scraperPath = process.env.SCRAPER_PATH || '../scraper';
  const scraperWorkingDir = path.resolve(process.cwd(), scraperPath);
  const args = ['-m', 'src.main'];

  console.log(`[Ingest ${jobId}] Starting:\n${pythonCommand} ${args.join(' ')}\n(cwd: ${scraperWorkingDir})`);

  let finished = false;
  const finish = (data) => {
    // 'error' and 'close' can both fire for one process; only the first result counts.
    if (finished) return Promise.resolve();
    finished = true;
    return updateJob(jobId, { completedAt: new Date(), ...data });
  };

  let pythonProcess;
  try {
    pythonProcess = spawn(pythonCommand, args, {
      cwd: scraperWorkingDir,
      env: { ...process.env },
    });
  } catch (spawnSyncError) {
    console.error(`[Ingest ${jobId}] Sync spawn error:`, spawnSyncError);
    await finish({
      status: JOB_STATUS.FAILED,
      error: `Failed to start Python process: ${spawnSyncError.message}`,
    });
    return;
  }

  const metrics = { fetchedArticles: null, newArticles: null, clustersCreated: null };
  let logTail = '';
  let pendingLine = '';

  const collect = (data) => {
    const text = data.toString();
    logTail = (logTail + text).slice(-LOG_TAIL_CHARS);
    const lines = (pendingLine + text).split('\n');
    pendingLine = lines.pop();
    lines.forEach(line => parseMetricsLine(line, metrics));
  };

  pythonProcess.stdout.on('data', (data) => {
    collect(data);
    console.log(`[Ingest ${jobId}] STDOUT: ${data}`);
  });

  // Python's logging module writes INFO lines to stderr, so both streams are parsed.
  pythonProcess.stderr.on('data', (data) => {
    collect(data);
    console.error(`[Ingest ${jobId}] STDERR: ${data}`);
  });

  pythonProcess.on('error', (err) => {
    console.error(`[Ingest ${jobId}] Process error:`, err);
    finish({ status: JOB_STATUS.FAILED, error: `Failed to spawn process: ${err.message}` });
  });

  pythonProcess.on('close', (code) => {
    if (pendingLine) parseMetricsLine(pendingLine, metrics);
    console.log(`[Ingest ${jobId}] Python process exited with code ${code}`);

    if (code === 0) {
      finish({ status: JOB_STATUS.COMPLETED, ...metrics });
    } else {
      finish({
        status: JOB_STATUS.FAILED,
        ...metrics,
        error: `Process exited with code ${code}. Log excerpt: ${redactSecrets(logTail.slice(-ERROR_EXCERPT_CHARS))}`,
      });
    }
  });
};
