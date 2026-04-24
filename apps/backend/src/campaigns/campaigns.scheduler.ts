import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Campaign } from './campaign.model';
import { SendSimulator } from './send.simulator';

@Injectable()
export class CampaignsScheduler {
  private readonly logger = new Logger('CampaignsScheduler');

  constructor(
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
    private readonly simulator: SendSimulator,
  ) {}

  // Every 30 seconds — picks up campaigns whose scheduled_at has passed and atomically
  // transitions them to 'sending', then enqueues each into the in-process simulator.
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    const due = await this.campaignModel.findAll({
      where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } },
      attributes: ['id'],
    });
    for (const c of due) {
      const [count] = await this.campaignModel.update(
        { status: 'sending' },
        { where: { id: c.id, status: 'scheduled' } },
      );
      if (count > 0) {
        this.logger.log(`Auto-sending due campaign ${c.id}`);
        this.simulator.enqueue(c.id);
      }
    }
  }
}
