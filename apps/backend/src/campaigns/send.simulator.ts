import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';

@Injectable()
export class SendSimulator {
  private readonly logger = new Logger('SendSimulator');
  private readonly inFlight = new Set<string>();
  private readonly successRate: number;

  constructor(
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignRecipient) private readonly crModel: typeof CampaignRecipient,
    config: ConfigService,
  ) {
    this.successRate = Number(config.get<string>('SEND_SUCCESS_RATE') ?? '0.9');
  }

  enqueue(campaignId: string): void {
    if (this.inFlight.has(campaignId)) {
      this.logger.debug(`Skip enqueue, already in-flight: ${campaignId}`);
      return;
    }
    this.inFlight.add(campaignId);
    setImmediate(() => {
      this.run(campaignId).catch((err) => {
        this.logger.error(`Send loop failed for ${campaignId}`, err);
      }).finally(() => {
        this.inFlight.delete(campaignId);
      });
    });
  }

  private async run(campaignId: string): Promise<void> {
    const pending = await this.crModel.findAll({
      where: { campaignId, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    for (const cr of pending) {
      await this.delay(50 + Math.random() * 200);
      const success = Math.random() < this.successRate;
      const opened = success && Math.random() < 0.3;
      await cr.update({
        status: success ? 'sent' : 'failed',
        sentAt: success ? new Date() : null,
        openedAt: opened ? new Date() : null,
      });
    }
    await this.campaignModel.update({ status: 'sent' }, { where: { id: campaignId } });
    this.logger.log(`Campaign ${campaignId} marked sent`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
