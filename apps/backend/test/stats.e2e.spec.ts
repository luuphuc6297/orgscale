import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const res = await request(bundle.app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

describe('Stats', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('empty campaign stats are zero', async () => {
    const token = await registerAndLogin(bundle, 's1@test.io');
    const create = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
      name: 'c', subject: 's', body: 'b', recipientEmails: ['x@test.io'],
    });
    expect(create.status).toBe(201);
    const id = create.body.campaign.id;

    const stats = await request(bundle.app).get(`/campaigns/${id}/stats`).set('Authorization', `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ total: 1, sent: 0, failed: 0, opened: 0, send_rate: 0, open_rate: 0 });
  });

  it('computes send_rate and open_rate with marketing convention', async () => {
    const token = await registerAndLogin(bundle, 's2@test.io');
    const emails = ['r1@t.io', 'r2@t.io', 'r3@t.io', 'r4@t.io', 'r5@t.io'];
    const create = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
      name: 'c', subject: 's', body: 'b', recipientEmails: emails,
    });
    const campaignId = create.body.campaign.id;

    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET status='sent', sent_at=NOW()
        WHERE campaign_id = :id AND recipient_id IN (
          SELECT id FROM recipients WHERE email IN ('r1@t.io','r2@t.io','r3@t.io')
        );
    `, { replacements: { id: campaignId } });
    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET status='failed'
        WHERE campaign_id = :id AND recipient_id IN (
          SELECT id FROM recipients WHERE email IN ('r4@t.io','r5@t.io')
        );
    `, { replacements: { id: campaignId } });
    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET opened_at = NOW()
        WHERE campaign_id = :id AND recipient_id IN (
          SELECT id FROM recipients WHERE email IN ('r1@t.io','r2@t.io')
        );
    `, { replacements: { id: campaignId } });

    const stats = await request(bundle.app).get(`/campaigns/${campaignId}/stats`).set('Authorization', `Bearer ${token}`);
    expect(stats.body.total).toBe(5);
    expect(stats.body.sent).toBe(3);
    expect(stats.body.failed).toBe(2);
    expect(stats.body.opened).toBe(2);
    expect(stats.body.send_rate).toBeCloseTo(0.6, 4);
    expect(stats.body.open_rate).toBeCloseTo(2 / 3, 4);
  });
});
