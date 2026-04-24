import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, truncateAll } from './setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
  });

  test('register + login returns JWT', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a@b.com', name: 'Alice', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('a@b.com');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');
  });

  test('login with wrong password returns 401', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'a@b.com', name: 'A', password: 'password123',
    });
    const r = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'a@b.com', password: 'wrongpassword',
    });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('UNAUTHORIZED');
  });
});
