import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  Get,
  Post,
  Param,
  UseGuards,
  Controller,
  ParseIntPipe,
  Body,
} from '@nestjs/common';

import { AuthGuard } from 'src/auth/auth.guard';
import { UserHeader } from 'src/auth/type/auth.type';
import { UserAuth } from 'src/commons/decorators/user.decorator';

import { CampaignService } from './campaign.service';
import { ApiKeyGuard } from 'src/auth/apikey.guard';
import { CampaignReward } from './dto/campaign.dto';

@ApiBearerAuth()
@ApiTags('Campaign')
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('total-reward-paid')
  @UseGuards(AuthGuard)
  async getTotalRewardPaid() {
    return this.campaignService.getTotalRewardPaid();
  }

  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    required: true,
  })
  @Post('total-reward-paid')
  async setTotalRewardPaid(@Body() data: CampaignReward[]) {
    return this.campaignService.setTotalRewardPaid(data);
  }
}
