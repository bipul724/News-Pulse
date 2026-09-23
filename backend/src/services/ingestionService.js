import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import path from 'path';

// In-memory job map
const jobs = new Map();

export const getRunningJob = async () => {
  for (const [id, job] of jobs.entries()) {
    if (job.status === 'running') {
      return job;
    }
  }
  return null;
};

export const createJob = async () => {
  const jobId = uuidv4();
  jobs.set(jobId, {
    jobId,
    status: 'queued',
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  });
  return jobId;
};

export const getJobStatus = async (jobId) => {
  return jobs.get(jobId) || null;
};

export const startPythonIngestion = (jobId) => {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'running';
    jobs.set(jobId, job);
  }

  const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
  const scraperPath = process.env.SCRAPER_PATH || '../scraper';
  const scraperWorkingDir = path.resolve(process.cwd(), scraperPath);
  const args = ['-m', 'src.main'];

  console.log(`[Ingest ${jobId}] Starting:\n${pythonCommand} ${args.join(' ')}\n(cwd: ${scraperWorkingDir})`);

  const spawnEnv = { ...process.env };

  let pythonProcess;
  try {
    pythonProcess = spawn(pythonCommand, args, {
      cwd: scraperWorkingDir,
      env: spawnEnv,
    });
  } catch (spawnSyncError) {
    // This catches synchronous errors during spawn initialization
    console.error(`[Ingest ${jobId}] Sync spawn error:`, spawnSyncError);
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = `Failed to start Python process: ${spawnSyncError.message}`;
      jobs.set(jobId, job);
    }
    return;
  }

  let outputLog = '';

  pythonProcess.on('error', (err) => {
    console.error(`[Ingest ${jobId}] Process error:`, err);
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = `Failed to spawn process: ${err.message}`;
      jobs.set(jobId, job);
    }
  });

  pythonProcess.stdout.on('data', (data) => {
    outputLog += data.toString();
    console.log(`[Ingest ${jobId}] STDOUT: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    outputLog += data.toString();
    console.error(`[Ingest ${jobId}] STDERR: ${data}`);
  });

  pythonProcess.on('close', async (code) => {
    // The close event triggers even if an 'error' event fired. Let's make sure we don't overwrite a spawn error.
    const currentJob = jobs.get(jobId);
    if (!currentJob) return;

    if (currentJob.status === 'failed' && currentJob.error && currentJob.error.includes('Failed to spawn process')) {
      // Already handled by error listener
      return;
    }

    console.log(`[Ingest ${jobId}] Python process exited with code ${code}`);
    
    currentJob.status = code === 0 ? 'completed' : 'failed';
    currentJob.completedAt = new Date().toISOString();
    if (code !== 0) {
      currentJob.error = `Process exited with code ${code}. Log excerpt: ${outputLog.slice(-500)}`;
    }
    jobs.set(jobId, currentJob);
  });
};
