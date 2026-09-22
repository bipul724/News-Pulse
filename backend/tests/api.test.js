import request from 'supertest';
import app from '../src/app.js';

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
});
