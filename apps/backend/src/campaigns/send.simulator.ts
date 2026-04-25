import type { Logger } from 'pino';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';

const SEND_DELAY_MIN_MS = 50;
const SEND_DELAY_MAX_MS = 250;
const OPEN_PROBABILITY = 0.3; // 30% of successful sends are opened

export class SendSimulator {
  private readonly inFlight = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly crModel: typeof CampaignRecipient,
    private readonly successRate: number,
    private readonly logger: Logger,
  ) {}

  enqueue(campaignId: string): void {
    if (this.inFlight.has(campaignId)) {
      this.logger.debug({ campaignId }, 'Skip enqueue, already in-flight');
      return;
    }
    this.inFlight.add(campaignId);
    const task = new Promise<void>((resolve) => {
      setImmediate(() => {
        this.run(campaignId)
          .catch((err) => this.logger.error({ err, campaignId }, 'Send loop failed'))
          .finally(() => {
            this.inFlight.delete(campaignId);
            this.pending.delete(campaignId);
            resolve();
          });
      });
    });
    this.pending.set(campaignId, task);
  }

  async drain(): Promise<void> {
    if (this.pending.size === 0) return;
    this.logger.info({ count: this.pending.size }, 'Draining in-flight send tasks');
    await Promise.allSettled(this.pending.values());
  }

  private async run(campaignId: string): Promise<void> {
    const pending = await this.crModel.findAll({
      where: { campaignId, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    for (const cr of pending) {
      await this.delay(SEND_DELAY_MIN_MS + Math.random() * (SEND_DELAY_MAX_MS - SEND_DELAY_MIN_MS));
      const success = Math.random() < this.successRate;
      const opened = success && Math.random() < OPEN_PROBABILITY;
      await cr.update({
        status: success ? 'sent' : 'failed',
        sentAt: success ? new Date() : null,
        openedAt: opened ? new Date() : null,
      });
    }
    await this.campaignModel.update({ status: 'sent' }, { where: { id: campaignId } });
    this.logger.info({ campaignId }, 'Campaign marked sent');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
