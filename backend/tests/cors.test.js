import request from 'supertest';

// FRONTEND_URL is read when app.js loads, so set it before importing the app.
process.env.FRONTEND_URL = 'https://news-pulse.vercel.app, https://news-pulse-git-main.vercel.app/';
const { default: app } = await import('../src/app.js');

describe('CORS', () => {
  test.each([
    'https://news-pulse.vercel.app',
    'https://news-pulse-git-main.vercel.app',   // trailing slash in the setting is ignored
  ])('allows configured origin %s', async (origin) => {
    const res = await request(app).get('/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  test('does not allow other origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
