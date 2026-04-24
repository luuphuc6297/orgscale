import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Recipient } from './recipient.model';
import { RecipientsService } from './recipients.service';
import { RecipientsController } from './recipients.controller';

@Module({
  imports: [SequelizeModule.forFeature([Recipient])],
  controllers: [RecipientsController],
  providers: [RecipientsService],
  exports: [RecipientsService, SequelizeModule],
})
export class RecipientsModule {}
