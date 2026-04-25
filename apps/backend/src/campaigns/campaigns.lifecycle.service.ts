import { Op } from 'sequelize';
import { Campaign } from './campaign.model';
import { SendSimulator } from './send.simulator';
import { AppError, ErrorCodes } from '../common/errors/app.error';

export class CampaignsLifecycleService {
  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly simulator: SendSimulator,
  ) {}

  async schedule(userId: string, id: string, scheduledAt: string): Promise<Campaign> {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new AppError(ErrorCodes.VALIDATION, 'scheduledAt must be a future timestamp', 400);
    }
    const [count, rows] = await this.campaignModel.update(
      { status: 'scheduled', scheduledAt: when },
      { where: { id, createdBy: userId, status: 'draft' }, returning: true },
    );
    if (count === 0) {
      const exists = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
      if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be scheduled', 409);
    }
    return rows[0];
  }

  async send(userId: string, id: string): Promise<Campaign> {
    const [count, rows] = await this.campaignModel.update(
      { status: 'sending' },
      {
        where: { id, createdBy: userId, status: { [Op.in]: ['draft', 'scheduled'] } },
        returning: true,
      },
    );
    if (count === 0) {
      const exists = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
      if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Campaign cannot be sent in current state', 409);
    }
    this.simulator.enqueue(id);
    return rows[0];
  }
}
