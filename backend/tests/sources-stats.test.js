import request from 'supertest';
import app from '../src/app.js';
import { mockPrisma, resetMockPrisma } from './__mocks__/prismaClientMock.js';

beforeEach(() => resetMockPrisma());

describe('GET /sources', () => {
  test('returns an empty array when no articles exist', async () => {
    const res = await request(app).get('/sources');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sources: [] });
  });

  test('returns every source with its count, sorted by articleCount descending', async () => {
    mockPrisma.article.groupBy.mockResolvedValueOnce([
      { source: 'BBC News', _count: { _all: 32 } },
      { source: 'NYT > World News', _count: { _all: 33 } },
      { source: 'NPR Topics: World', _count: { _all: 28 } },
    ]);

    const res = await request(app).get('/sources');

    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual([
      { name: 'NYT > World News', articleCount: 33 },
      { name: 'BBC News', articleCount: 32 },
      { name: 'NPR Topics: World', articleCount: 28 },
    ]);
  });

  test('uses a single groupBy query on Article.source (no N+1)', async () => {
    await request(app).get('/sources');
    expect(mockPrisma.article.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.article.groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['source'] }));
    expect(mockPrisma.article.findMany).not.toHaveBeenCalled();
  });

  test('passes database errors to the error handler as 500', async () => {
    mockPrisma.article.groupBy.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/sources');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('GET /stats', () => {
  test('returns real counts and the latest completed ingestion time', async () => {
    const completedAt = new Date('2026-09-23T07:48:47.379Z');
    mockPrisma.article.count.mockResolvedValueOnce(93);
    mockPrisma.cluster.count.mockResolvedValueOnce(23);
    mockPrisma.article.groupBy.mockResolvedValueOnce([
      { source: 'BBC News' }, { source: 'NPR Topics: World' }, { source: 'NYT > World News' },
    ]);
    mockPrisma.ingestionJob.findFirst.mockResolvedValueOnce({ completedAt });

    const res = await request(app).get('/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      articles: 93,
      clusters: 23,
      sources: 3,
      lastIngestion: '2026-09-23T07:48:47.379Z',
    });
  });

  test('asks only for completed jobs, newest completedAt first', async () => {
    await request(app).get('/stats');
    expect(mockPrisma.ingestionJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    }));
  });

  test('lastIngestion is null when no ingestion has completed', async () => {
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ articles: 0, clusters: 0, sources: 0, lastIngestion: null });
  });
});

describe('GET /health/db', () => {
  test('reports connected when the database answers', async () => {
    const res = await request(app).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
  });

  test('returns 503 without leaking error details when the database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('password authentication failed for postgres://user:secret@host'));
    const res = await request(app).get('/health/db');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', database: 'unavailable' });
  });

  test('GET /health is unchanged', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', service: 'news-pulse-backend' });
  });
});
