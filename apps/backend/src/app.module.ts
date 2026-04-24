import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { User } from './users/user.model';
import { Recipient } from './recipients/recipient.model';
import { Campaign } from './campaigns/campaign.model';
import { CampaignRecipient } from './campaigns/campaign-recipient.model';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecipientsModule } from './recipients/recipients.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isTest = config.get<string>('NODE_ENV') === 'test';
        const url = isTest
          ? config.get<string>('TEST_DATABASE_URL')
          : config.get<string>('DATABASE_URL');
        return {
          dialect: 'postgres',
          uri: url,
          autoLoadModels: true,
          synchronize: false,
          logging: false,
          define: { underscored: true, timestamps: true },
          models: [User, Recipient, Campaign, CampaignRecipient],
        };
      },
    }),
    UsersModule,
    AuthModule,
    RecipientsModule,
    CampaignsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
