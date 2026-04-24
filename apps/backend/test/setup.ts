import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { User } from '../src/users/user.model';
import { Recipient } from '../src/recipients/recipient.model';
import { Campaign } from '../src/campaigns/campaign.model';
import { CampaignRecipient } from '../src/campaigns/campaign-recipient.model';

// Boot a Nest application identical to production bootstrap (same pipes/filters).
// Tests run against the real Postgres TEST_DATABASE_URL.
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

// Truncate all tables in dependency order. Cheaper than dropping/recreating the schema.
export async function truncateAll(): Promise<void> {
  await CampaignRecipient.destroy({ where: {}, force: true });
  await Campaign.destroy({ where: {}, force: true });
  await Recipient.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
}
