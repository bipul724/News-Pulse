import request from 'supertest';
import app from '../src/app.js';
import { mockPrisma, resetMockPrisma } from './__mocks__/prismaClientMock.js';

beforeEach(() => resetMockPrisma());

describe('API Endpoints integration with mocked Prisma', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /clusters returns data correctly', async () => {
    const res = await request(app).get('/clusters');
    expect(res.status).toBe(200);
    expect(res.body.clusters).toHaveLength(1);
    expect(res.body.clusters[0].label).toBe('Tech Cluster');
  });

  test('GET /timeline returns normalized intensity and sources', async () => {
    const res = await request(app).get('/timeline');
    expect(res.status).toBe(200);
    expect(res.body.timeline[0].intensity).toBe(1);
    expect(res.body.timeline[0].sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'BBC', count: 1 }),
        expect.objectContaining({ name: 'NPR', count: 1 })
      ])
    );
  });

  test('GET /clusters/:id returns the cluster and its articles', async () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    mockPrisma.cluster.findUnique.mockResolvedValueOnce({
      id,
      label: 'Tech Cluster',
      articles: [{
        id: 'a1', headline: 'Chips', summary: 'Summary', source: 'BBC',
        publishedAt: new Date('2026-09-23T07:00:00.000Z'), url: 'https://example.com/a1',
      }],
    });

    const res = await request(app).get(`/clusters/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.cluster).toEqual(expect.objectContaining({ id, label: 'Tech Cluster', articleCount: 1 }));
    expect(res.body.articles[0]).toEqual(expect.objectContaining({ headline: 'Chips', source: 'BBC', url: 'https://example.com/a1' }));
  });

  test('GET /clusters/:id returns 404 for an unknown cluster', async () => {
    mockPrisma.cluster.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).get('/clusters/0f8fad5b-d9cb-469f-a165-70867728950e');
    expect(res.status).toBe(404);
  });

  test('unknown routes return 404 with code NOT_FOUND', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ message: 'Not Found - /does-not-exist', code: 'NOT_FOUND' });
  });
});
