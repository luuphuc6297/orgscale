import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

describe('Auth', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('register then login returns a JWT', async () => {
    const reg = await request(bundle.app).post('/auth/register').send({
      email: 'a@test.io', name: 'A', password: 'password123',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('a@test.io');

    const login = await request(bundle.app).post('/auth/login').send({
      email: 'a@test.io', password: 'password123',
    });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');
  });

  it('login with wrong password returns 401 UNAUTHORIZED', async () => {
    await request(bundle.app).post('/auth/register').send({
      email: 'b@test.io', name: 'B', password: 'password123',
    });
    const login = await request(bundle.app).post('/auth/login').send({
      email: 'b@test.io', password: 'nope',
    });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('UNAUTHORIZED');
  });

  it('register with missing fields returns 400 VALIDATION', async () => {
    const res = await request(bundle.app).post('/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
