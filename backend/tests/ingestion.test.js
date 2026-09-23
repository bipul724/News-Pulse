import { EventEmitter } from 'events';
import { jest } from '@jest/globals';
import request from 'supertest';

// Replace the Python subprocess with a controllable fake process.
const spawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({ spawn }));

const { mockPrisma, resetMockPrisma } = await import('./__mocks__/prismaClientMock.js');
const { default: app } = await import('../src/app.js');
const { parseMetricsLine, recoverInterruptedJobs } = await import('../src/services/ingestionService.js');

const JOB_ID = '11111111-2222-4333-8444-555555555555';

function fakeProcess() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  // Like a real process: SIGTERM makes it exit, reporting the signal.
  proc.kill = jest.fn((signal) => { if (signal === 'SIGTERM') proc.emit('close', null, 'SIGTERM'); });
  return proc;
}

async function waitFor(check) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('condition not met in time');
}

const updatesWith = (status) =>
  mockPrisma.ingestionJob.update.mock.calls.filter(([arg]) => arg.data.status === status);

let proc;
beforeEach(() => {
  resetMockPrisma();
  spawn.mockReset();
  proc = fakeProcess();
  spawn.mockReturnValue(proc);
  mockPrisma.ingestionJob.create.mockResolvedValue({ id: JOB_ID, status: 'queued' });
});

async function triggerAndStart() {
  const res = await request(app).post('/ingest/trigger');
  await waitFor(() => spawn.mock.calls.length === 1);
  return res;
}

describe('POST /ingest/trigger', () => {
  test('creates a queued job and responds 202 immediately', async () => {
    const res = await triggerAndStart();

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: JOB_ID, status: 'queued' });
    expect(mockPrisma.ingestionJob.create).toHaveBeenCalledWith({ data: { status: 'queued' } });
  });

  test('persists the running transition with startedAt before Python starts', async () => {
    await triggerAndStart();

    const [running] = updatesWith('running');
    expect(running[0]).toEqual({ where: { id: JOB_ID }, data: { status: 'running', startedAt: expect.any(Date) } });
    expect(spawn).toHaveBeenCalledWith(expect.any(String), ['-m', 'src.main'], expect.any(Object));
  });

  test('persists completed with metrics parsed from the scraper log on exit code 0', async () => {
    await triggerAndStart();

    // Chunks split mid-line on purpose: lines must be reassembled before parsing.
    proc.stderr.emit('data', Buffer.from('INFO - Fetched 96 total articles from RSS feeds.\nINFO - Found 4 new art'));
    proc.stderr.emit('data', Buffer.from('icles to process.\nINFO - Inserted 3 new articles.\nINFO - Formed 39 clusters.\n'));
    proc.emit('close', 0);
    await waitFor(() => updatesWith('completed').length === 1);

    expect(updatesWith('completed')[0][0]).toEqual({
      where: { id: JOB_ID },
      data: {
        status: 'completed',
        completedAt: expect.any(Date),
        fetchedArticles: 96,
        newArticles: 3,
        clustersCreated: 39,
      },
    });
    expect(updatesWith('failed')).toHaveLength(0);
  });

  test('persists failed with a redacted log excerpt on a non-zero exit', async () => {
    await triggerAndStart();

    proc.stderr.emit('data', Buffer.from('ERROR - could not connect to postgresql://user:secret@db.example.com:5432/postgres\n'));
    proc.emit('close', 1);
    await waitFor(() => updatesWith('failed').length === 1);

    const { data } = updatesWith('failed')[0][0];
    expect(data.status).toBe('failed');
    expect(data.completedAt).toEqual(expect.any(Date));
    expect(data.error).toMatch(/^Process exited with code 1\./);
    expect(data.error).toContain('[redacted connection string]');
    expect(data.error).not.toContain('secret');
  });

  test('records a spawn failure once, even though close also fires', async () => {
    await triggerAndStart();

    proc.emit('error', new Error('spawn python3 ENOENT'));
    proc.emit('close', -2);
    await waitFor(() => updatesWith('failed').length >= 1);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(updatesWith('failed')).toHaveLength(1);
    expect(updatesWith('failed')[0][0].data.error).toBe('Failed to spawn process: spawn python3 ENOENT');
  });

  test('stops a hung scraper after the timeout and records the job as failed', async () => {
    process.env.INGEST_TIMEOUT_MINUTES = '0.0005';  // 30 ms instead of 5 minutes
    try {
      await triggerAndStart();
      proc.stderr.emit('data', Buffer.from('INFO - Fetched 95 total articles from RSS feeds.\n'));
      // The fake process never exits on its own, like a hung run.
      await waitFor(() => updatesWith('failed').length === 1);

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      const { data } = updatesWith('failed')[0][0];
      expect(data.error).toMatch(/^Timed out after 0\.0005 min; the scraper was stopped\./);
      expect(data.fetchedArticles).toBe(95);   // metrics gathered before the timeout are kept
      expect(updatesWith('completed')).toHaveLength(0);
    } finally {
      delete process.env.INGEST_TIMEOUT_MINUTES;
    }
  });

  test('a run that finishes in time is never killed', async () => {
    process.env.INGEST_TIMEOUT_MINUTES = '0.001';  // 60 ms
    try {
      await triggerAndStart();
      proc.emit('close', 0, null);
      await waitFor(() => updatesWith('completed').length === 1);
      await new Promise(resolve => setTimeout(resolve, 100));  // well past the timeout

      expect(proc.kill).not.toHaveBeenCalled();
      expect(updatesWith('failed')).toHaveLength(0);
    } finally {
      delete process.env.INGEST_TIMEOUT_MINUTES;
    }
  });

  test('a trigger that loses the race at the database joins the winning run (409)', async () => {
    const WINNER = '99999999-2222-4333-8444-555555555555';
    // Both requests passed the "is one running?" check, then the unique index
    // rejected this insert because the other request's job was created first.
    mockPrisma.ingestionJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: WINNER, status: 'queued' });
    mockPrisma.ingestionJob.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

    const res = await request(app).post('/ingest/trigger');

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      message: 'An ingestion job is already running',
      code: 'CONCURRENT_INGESTION_CONFLICT',
      jobId: WINNER,
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  test('other database errors while creating a job are still 500s', async () => {
    mockPrisma.ingestionJob.create.mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(app).post('/ingest/trigger');
    expect(res.status).toBe(500);
    expect(spawn).not.toHaveBeenCalled();
  });

  test('returns 409 with the active job id when a job is already running', async () => {
    mockPrisma.ingestionJob.findFirst.mockResolvedValueOnce({ id: JOB_ID, status: 'running' });

    const res = await request(app).post('/ingest/trigger');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        message: 'An ingestion job is already running',
        code: 'CONCURRENT_INGESTION_CONFLICT',
        jobId: JOB_ID,
      },
    });
    expect(mockPrisma.ingestionJob.create).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('GET /ingest/status/:jobId', () => {
  test('returns 404 for an unknown job', async () => {
    const res = await request(app).get(`/ingest/status/${JOB_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for a malformed job id', async () => {
    const res = await request(app).get('/ingest/status/not-a-uuid');
    expect(res.status).toBe(400);
    expect(mockPrisma.ingestionJob.findUnique).not.toHaveBeenCalled();
  });

  test('serves a job this process never created, straight from Postgres', async () => {
    // Simulates a restarted server: no in-memory state, only the persisted row.
    mockPrisma.ingestionJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      status: 'completed',
      startedAt: new Date('2026-09-23T07:47:00.000Z'),
      completedAt: new Date('2026-09-23T07:48:47.379Z'),
      error: null,
      fetchedArticles: 93,
      newArticles: 41,
      clustersCreated: 23,
    });

    const res = await request(app).get(`/ingest/status/${JOB_ID}`);

    expect(mockPrisma.ingestionJob.findUnique).toHaveBeenCalledWith({ where: { id: JOB_ID } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jobId: JOB_ID,
      status: 'completed',
      startedAt: '2026-09-23T07:47:00.000Z',
      completedAt: '2026-09-23T07:48:47.379Z',
      stats: { fetchedArticles: 93, newArticles: 41, clustersCreated: 23 },
      error: null,
    });
  });

  test('reports null stats while a job has not produced metrics yet', async () => {
    mockPrisma.ingestionJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID, status: 'running', startedAt: new Date(), completedAt: null, error: null,
      fetchedArticles: null, newArticles: null, clustersCreated: null,
    });
    const res = await request(app).get(`/ingest/status/${JOB_ID}`);
    expect(res.body.status).toBe('running');
    expect(res.body.stats).toEqual({ fetchedArticles: null, newArticles: null, clustersCreated: null });
  });
});

describe('job recovery and metric parsing', () => {
  test('marks jobs left queued or running by a previous process as failed', async () => {
    mockPrisma.ingestionJob.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(recoverInterruptedJobs()).resolves.toBe(1);
    expect(mockPrisma.ingestionJob.updateMany).toHaveBeenCalledWith({
      where: { status: { in: ['queued', 'running'] } },
      data: expect.objectContaining({ status: 'failed', completedAt: expect.any(Date) }),
    });
  });

  test('newArticles is 0 when the scraper finds nothing new (it skips the insert log)', () => {
    const metrics = { fetchedArticles: null, newArticles: null, clustersCreated: null };
    parseMetricsLine('INFO - Found 0 new articles to process.', metrics);
    expect(metrics.newArticles).toBe(0);
  });

  test('unrelated log lines leave metrics untouched', () => {
    const metrics = { fetchedArticles: null, newArticles: null, clustersCreated: null };
    parseMetricsLine('INFO - Starting ingestion pipeline...', metrics);
    expect(metrics).toEqual({ fetchedArticles: null, newArticles: null, clustersCreated: null });
  });
});
