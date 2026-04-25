import cron, { ScheduledTask } from 'node-cron';
import { Op } from 'sequelize';
import type { Logger } from 'pino';
import { Campaign } from './campaign.model';
import { SendSimulator } from './send.simulator';

const TICK_CRON_EXPRESSION = '*/30 * * * * *'; // every 30 seconds

export class CampaignsScheduler {
  private task: ScheduledTask | null = null;

  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly simulator: SendSimulator,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.task) return;
    this.task = cron.schedule(TICK_CRON_EXPRESSION, () => {
      this.tick().catch((err) => this.logger.error({ err }, 'Scheduler tick failed'));
    });
    this.logger.info({ schedule: TICK_CRON_EXPRESSION }, 'Scheduler started');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  private async tick(): Promise<void> {
    const [count, rows] = await this.campaignModel.update(
      { status: 'sending' },
      {
        where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } },
        returning: true,
      },
    );
    if (count === 0) return;
    this.logger.info({ count }, 'Scheduler picked up due campaigns');
    for (const row of rows) {
      this.simulator.enqueue(row.id);
    }
  }
}
