import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import {
  UserCampaign,
  UserCampaignSchema,
} from './schemas/user-campaign.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      // { name: Campaign.name, schema: CampaignSchema },
      { name: UserCampaign.name, schema: UserCampaignSchema },
    ]),
    UsersModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
