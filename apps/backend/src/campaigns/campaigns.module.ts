import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';
import { CampaignsService } from './campaigns.service';
import { CampaignsLifecycleService } from './campaigns.lifecycle.service';
import { StatsService } from './stats.service';
import { SendSimulator } from './send.simulator';
import { CampaignsScheduler } from './campaigns.scheduler';
import { CampaignsController } from './campaigns.controller';
import { RecipientsModule } from '../recipients/recipients.module';

@Module({
  imports: [SequelizeModule.forFeature([Campaign, CampaignRecipient]), RecipientsModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsLifecycleService,
    StatsService,
    SendSimulator,
    CampaignsScheduler,
  ],
})
export class CampaignsModule {}
