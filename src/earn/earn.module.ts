import { Module } from '@nestjs/common';

import { EarnService } from './earn.service';
import { EarnController } from './earn.controller';

import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { OrderModule } from 'src/orders/order.module';
import { CommissionModule } from 'src/commission/commission.module';
import { CampaignModule } from 'src/campaign/campaign.module';

import { Post, PostSchema } from 'src/feed/schemas/post.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { Partner, PartnerSchema } from 'src/users/schemas/partners.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Partner.name, schema: PartnerSchema },
    ]),
    CommissionModule,
    UsersModule,
    OrderModule,
    CampaignModule,
  ],
  controllers: [EarnController],
  providers: [EarnService],
  exports: [EarnService],
})
export class EarnModule {}
