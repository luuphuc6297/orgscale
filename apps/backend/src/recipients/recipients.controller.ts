import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { RecipientsService } from './recipients.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { ListRecipientsDto } from './dto/list-recipients.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('recipients')
@UseGuards(JwtAuthGuard)
export class RecipientsController {
  constructor(private readonly recipients: RecipientsService) {}

  @Get()
  list(@Query() query: ListRecipientsDto) {
    return this.recipients.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRecipientDto) {
    const recipient = await this.recipients.create(dto);
    return { recipient };
  }
}
