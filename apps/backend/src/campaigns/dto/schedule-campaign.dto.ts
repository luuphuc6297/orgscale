import { IsISO8601 } from 'class-validator';

export class ScheduleCampaignDto {
  @IsISO8601()
  scheduledAt!: string;
}
