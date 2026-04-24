import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CampaignStatus } from '../campaign.model';

export class ListCampaignsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(50)
  limit: number = 10;

  @IsOptional()
  @IsIn(['draft', 'scheduled', 'sending', 'sent'])
  status?: CampaignStatus;
}
