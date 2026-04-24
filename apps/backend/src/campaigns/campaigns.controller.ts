import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsLifecycleService } from './campaigns.lifecycle.service';
import { StatsService } from './stats.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly lifecycle: CampaignsLifecycleService,
    private readonly stats: StatsService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: ListCampaignsDto) {
    return this.campaigns.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateCampaignDto) {
    const campaign = await this.campaigns.create(user.id, dto);
    return { campaign };
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.campaigns.getDetail(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const campaign = await this.campaigns.update(user.id, id, dto);
    return { campaign };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.campaigns.remove(user.id, id);
  }

  @Post(':id/schedule')
  async schedule(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ScheduleCampaignDto,
  ) {
    const campaign = await this.lifecycle.schedule(user.id, id, dto.scheduledAt);
    return { campaign };
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    const campaign = await this.lifecycle.send(user.id, id);
    return { campaign };
  }

  @Get(':id/stats')
  async getStats(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.campaigns.getOwned(user.id, id);
    return this.stats.compute(id);
  }
}
