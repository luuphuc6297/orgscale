import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const r = await request(bundle.app).post('/auth/login').send({ email, password });
  return r.body.token as string;
}

async function createDraft(bundle: TestBundle, token: string) {
  const res = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
    name: 'C', subject: 'S', body: 'B', recipientEmails: ['r1@t.io', 'r2@t.io'],
  });
  return res.body.campaign.id as string;
}

describe('Campaigns', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('PATCH on non-draft returns 409 INVALID_STATE_TRANSITION', async () => {
    const token = await registerAndLogin(bundle, 'u1@t.io');
    const id = await createDraft(bundle, token);
    const future = new Date(Date.now() + 60_000).toISOString();
    const sched = await request(bundle.app).post(`/campaigns/${id}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: future });
    expect(sched.status).toBe(200);

    const patch = await request(bundle.app).patch(`/campaigns/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Nope' });
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('schedule with past timestamp returns 400 VALIDATION', async () => {
    const token = await registerAndLogin(bundle, 'u2@t.io');
    const id = await createDraft(bundle, token);
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await request(bundle.app).post(`/campaigns/${id}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: past });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it("user cannot access another user's campaign (404)", async () => {
    const tokenA = await registerAndLogin(bundle, 'a@t.io');
    const tokenB = await registerAndLogin(bundle, 'b@t.io');
    const idA = await createDraft(bundle, tokenA);
    const res = await request(bundle.app).get(`/campaigns/${idA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('send transitions draft -> sending -> sent', async () => {
    const token = await registerAndLogin(bundle, 'u3@t.io');
    const id = await createDraft(bundle, token);

    const send = await request(bundle.app).post(`/campaigns/${id}/send`).set('Authorization', `Bearer ${token}`);
    expect(send.status).toBe(202);
    expect(['sending', 'sent']).toContain(send.body.campaign.status);

    const deadline = Date.now() + 10_000;
    let status = '';
    while (Date.now() < deadline) {
      const d = await request(bundle.app).get(`/campaigns/${id}`).set('Authorization', `Bearer ${token}`);
      status = d.body.status;
      if (status === 'sent') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(status).toBe('sent');
  });

  it('DELETE on draft returns 204; DELETE on non-draft returns 409', async () => {
    const token = await registerAndLogin(bundle, 'u4@t.io');
    const id1 = await createDraft(bundle, token);
    const del1 = await request(bundle.app).delete(`/campaigns/${id1}`).set('Authorization', `Bearer ${token}`);
    expect(del1.status).toBe(204);

    const id2 = await createDraft(bundle, token);
    const future = new Date(Date.now() + 60_000).toISOString();
    await request(bundle.app).post(`/campaigns/${id2}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: future });
    const del2 = await request(bundle.app).delete(`/campaigns/${id2}`).set('Authorization', `Bearer ${token}`);
    expect(del2.status).toBe(409);
    expect(del2.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });
});
