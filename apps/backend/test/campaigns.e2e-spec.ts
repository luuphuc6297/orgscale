import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, truncateAll } from './setup';
import { Campaign } from '../src/campaigns/campaign.model';

describe('Campaign business rules (e2e)', () => {
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

  async function registerAndLogin(email = 'biz@x.com'): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Biz', password: 'password123' });
    const r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    return r.body.token;
  }

  test('PATCH non-draft campaign returns 409', async () => {
    const token = await registerAndLogin();
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C', subject: 'S', body: 'B', recipientEmails: ['a@a.com'] });
    expect(create.status).toBe(201);
    const id = create.body.campaign.id;

    // Force-mutate via the model; the public API would not allow this transition.
    await Campaign.update({ status: 'sent' }, { where: { id } });

    const patch = await request(app.getHttpServer())
      .patch(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New' });
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  test('schedule with past timestamp returns 400', async () => {
    const token = await registerAndLogin();
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C', subject: 'S', body: 'B', recipientEmails: ['a@a.com'] });

    const r = await request(app.getHttpServer())
      .post(`/campaigns/${create.body.campaign.id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledAt: new Date(Date.now() - 60_000).toISOString() });
    expect(r.status).toBe(400);
  });

  test('user A cannot access campaign of user B', async () => {
    const tokenA = await registerAndLogin('a@x.com');
    const tokenB = await registerAndLogin('b@x.com');

    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'C', subject: 'S', body: 'B', recipientEmails: ['x@x.com'] });

    const r = await request(app.getHttpServer())
      .get(`/campaigns/${create.body.campaign.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(r.status).toBe(404);
  });

  test('send transitions to sending then sent (eventually)', async () => {
    const token = await registerAndLogin();
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C', subject: 'S', body: 'B', recipientEmails: ['a@a.com', 'b@a.com'] });

    const sendRes = await request(app.getHttpServer())
      .post(`/campaigns/${create.body.campaign.id}/send`)
      .set('Authorization', `Bearer ${token}`);
    expect(sendRes.status).toBe(202);
    expect(sendRes.body.campaign.status).toBe('sending');

    // Send simulator delays each recipient 50–250ms; 2 recipients ≤ 500ms but allow buffer.
    await new Promise((r) => setTimeout(r, 1500));
    const detail = await request(app.getHttpServer())
      .get(`/campaigns/${create.body.campaign.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.status).toBe('sent');
    expect(detail.body.stats.total).toBe(2);
  });
});
