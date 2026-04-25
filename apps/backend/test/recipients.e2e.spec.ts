import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const r = await request(bundle.app).post('/auth/login').send({ email, password });
  return r.body.token as string;
}

describe('Recipients', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('POST /recipients creates a new recipient (201)', async () => {
    const token = await registerAndLogin(bundle, 'rec1@t.io');
    const res = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({
      email: 'New@Example.COM', name: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.recipient.email).toBe('new@example.com');
    expect(res.body.recipient.name).toBe('New User');
  });

  it('POST /recipients with existing email is idempotent (find-or-create)', async () => {
    const token = await registerAndLogin(bundle, 'rec2@t.io');
    const first = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: 'dup@t.io' });
    const second = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: 'dup@t.io' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.recipient.id).toBe(second.body.recipient.id);
  });

  it('GET /recipients supports pagination + case-insensitive search', async () => {
    const token = await registerAndLogin(bundle, 'rec3@t.io');
    for (const e of ['alice@t.io', 'bob@t.io', 'charlie@t.io']) {
      await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: e });
    }
    const all = await request(bundle.app).get('/recipients?page=1&limit=2').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.data.length).toBe(2);

    const search = await request(bundle.app).get('/recipients?search=ALICE').set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.length).toBe(1);
    expect(search.body.data[0].email).toBe('alice@t.io');
  });

  it('unauthenticated requests are rejected (401)', async () => {
    const res = await request(bundle.app).get('/recipients');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
