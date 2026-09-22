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
    status: 'running',
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
  const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
  const scraperPath = process.env.SCRAPER_PATH || '../scraper';
  const scriptPath = path.resolve(process.cwd(), scraperPath, 'src/main.py');
  const scraperWorkingDir = path.resolve(process.cwd(), scraperPath);

  const pythonProcess = spawn(pythonCommand, [scriptPath], {
    cwd: scraperWorkingDir,
    env: { ...process.env },
  });

  let outputLog = '';

  pythonProcess.stdout.on('data', (data) => {
    outputLog += data.toString();
    console.log(`[Ingest ${jobId}] STDOUT: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    outputLog += data.toString();
    console.error(`[Ingest ${jobId}] STDERR: ${data}`);
  });

  pythonProcess.on('close', async (code) => {
    console.log(`[Ingest ${jobId}] Python process exited with code ${code}`);
    
    const job = jobs.get(jobId);
    if (job) {
      job.status = code === 0 ? 'completed' : 'failed';
      job.completedAt = new Date().toISOString();
      if (code !== 0) {
        job.error = `Process exited with code ${code}. Log excerpt: ${outputLog.slice(-500)}`;
      }
      jobs.set(jobId, job);
    }
  });
};
