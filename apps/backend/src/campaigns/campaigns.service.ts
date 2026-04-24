import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';
import { Recipient } from '../recipients/recipient.model';
import { RecipientsService } from '../recipients/recipients.service';
import { StatsService } from './stats.service';
import { AppError, ErrorCodes } from '../common/errors/app.error';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { ListCampaignsDto } from './dto/list-campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignRecipient) private readonly crModel: typeof CampaignRecipient,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly recipientsService: RecipientsService,
    private readonly stats: StatsService,
  ) {}

  async list(userId: string, query: ListCampaignsDto) {
    const { page, limit, status } = query;
    const where: any = { createdBy: userId };
    if (status) where.status = status;
    const offset = (page - 1) * limit;
    const { rows, count } = await this.campaignModel.findAndCountAll({
      where, offset, limit, order: [['updatedAt', 'DESC']],
    });
    return { data: rows, total: count, page, limit };
  }

  async getOwned(userId: string, id: string): Promise<Campaign> {
    const c = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
    if (!c) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
    return c;
  }

  async getDetail(userId: string, id: string) {
    const campaign = await this.getOwned(userId, id);
    const rows = await this.crModel.findAll({
      where: { campaignId: id },
      include: [{ model: Recipient, attributes: ['id', 'email', 'name'] }],
      order: [['createdAt', 'ASC']],
      limit: 500,
    });
    const recipients = rows.map((cr: any) => ({
      recipientId: cr.recipientId,
      email: cr.recipient?.email,
      name: cr.recipient?.name,
      status: cr.status,
      sentAt: cr.sentAt,
      openedAt: cr.openedAt,
    }));
    return {
      ...campaign.get({ plain: true }),
      stats: await this.stats.compute(id),
      recipients,
    };
  }

  async create(userId: string, dto: CreateCampaignDto) {
    return this.sequelize.transaction(async (t) => {
      const campaign = await this.campaignModel.create({
        name: dto.name,
        subject: dto.subject,
        body: dto.body,
        createdBy: userId,
        status: 'draft',
      } as any, { transaction: t });

      const recipients = await this.recipientsService.ensureMany(dto.recipientEmails);
      await this.crModel.bulkCreate(
        recipients.map((r) => ({ campaignId: campaign.id, recipientId: r.id, status: 'pending' })) as any[],
        { transaction: t },
      );
      return campaign;
    });
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto) {
    const campaign = await this.getOwned(userId, id);
    if (campaign.status !== 'draft') {
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be edited', 409);
    }
    return this.sequelize.transaction(async (t) => {
      if (dto.name !== undefined) campaign.name = dto.name;
      if (dto.subject !== undefined) campaign.subject = dto.subject;
      if (dto.body !== undefined) campaign.body = dto.body;
      await campaign.save({ transaction: t });
      if (dto.recipientEmails) {
        await this.crModel.destroy({ where: { campaignId: id }, transaction: t });
        const recipients = await this.recipientsService.ensureMany(dto.recipientEmails);
        await this.crModel.bulkCreate(
          recipients.map((r) => ({ campaignId: id, recipientId: r.id, status: 'pending' })) as any[],
          { transaction: t },
        );
      }
      return campaign;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const campaign = await this.getOwned(userId, id);
    if (campaign.status !== 'draft') {
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be deleted', 409);
    }
    await campaign.destroy();
  }
}
