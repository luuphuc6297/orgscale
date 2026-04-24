import { INestApplication } from '@nestjs/common';
import { createTestApp, truncateAll } from './setup';
import { StatsService } from '../src/campaigns/stats.service';
import { User } from '../src/users/user.model';
import { Campaign } from '../src/campaigns/campaign.model';
import { Recipient } from '../src/recipients/recipient.model';
import { CampaignRecipient } from '../src/campaigns/campaign-recipient.model';

describe('StatsService.compute (e2e)', () => {
  let app: INestApplication;
  let stats: StatsService;
  let campaignId: string;

  beforeAll(async () => {
    app = await createTestApp();
    stats = app.get(StatsService);
  });

  beforeEach(async () => {
    await truncateAll();
    const user = await User.create({ email: 's@x.com', name: 'S', passwordHash: 'x' } as any);
    const campaign = await Campaign.create({
      name: 'C', subject: 'S', body: 'B', createdBy: user.id, status: 'draft',
    } as any);
    campaignId = campaign.id;
  });

  afterAll(async () => {
    await app.close();
  });

  test('returns zeros for empty', async () => {
    const s = await stats.compute(campaignId);
    expect(s).toEqual({ total: 0, sent: 0, failed: 0, opened: 0, open_rate: 0, send_rate: 0 });
  });

  test('computes rates correctly', async () => {
    const recipients = await Recipient.bulkCreate(
      ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'].map((email) => ({ email })) as any[],
      { returning: true },
    );
    await CampaignRecipient.bulkCreate([
      { campaignId, recipientId: recipients[0].id, status: 'sent', sentAt: new Date(), openedAt: new Date() },
      { campaignId, recipientId: recipients[1].id, status: 'sent', sentAt: new Date() },
      { campaignId, recipientId: recipients[2].id, status: 'sent', sentAt: new Date(), openedAt: new Date() },
      { campaignId, recipientId: recipients[3].id, status: 'failed' },
      { campaignId, recipientId: recipients[4].id, status: 'pending' },
    ] as any[]);

    const s = await stats.compute(campaignId);
    expect(s.total).toBe(5);
    expect(s.sent).toBe(3);
    expect(s.failed).toBe(1);
    expect(s.opened).toBe(2);
    expect(s.send_rate).toBeCloseTo(0.6);
    // Marketing convention: open_rate = opened / sent = 2/3
    expect(s.open_rate).toBeCloseTo(0.6667, 3);
  });
});
