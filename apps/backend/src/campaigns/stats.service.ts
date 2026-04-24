import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  send_rate: number;
  open_rate: number;
}

@Injectable()
export class StatsService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async compute(campaignId: string): Promise<CampaignStats> {
    const [row] = await this.sequelize.query<{
      total: string; sent: string; failed: string; opened: string;
    }>(
      `SELECT
         COUNT(*)                                       AS total,
         COUNT(*) FILTER (WHERE status = 'sent')        AS sent,
         COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
         COUNT(*) FILTER (WHERE opened_at IS NOT NULL)  AS opened
       FROM campaign_recipients
       WHERE campaign_id = :id`,
      { replacements: { id: campaignId }, type: QueryTypes.SELECT },
    );
    const total = Number(row?.total ?? 0);
    const sent = Number(row?.sent ?? 0);
    const failed = Number(row?.failed ?? 0);
    const opened = Number(row?.opened ?? 0);
    // Marketing convention: open_rate is conditional on delivery (opened / sent), not opened / total
    const send_rate = total === 0 ? 0 : sent / total;
    const open_rate = sent === 0 ? 0 : opened / sent;
    return { total, sent, failed, opened, send_rate, open_rate };
  }
}
