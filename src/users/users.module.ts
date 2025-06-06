import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { WalletsModule } from 'src/wallets/wallets.module';
import { CommissionModule } from 'src/commission/commission.module';
import { OrderModule } from 'src/orders/order.module';
import { Task, TaskSchema } from 'src/tasks/schemas/task.schema';
import { ChatbotModule } from 'src/chatbot/chatbot.module';
import { Partner, PartnerSchema } from './schemas/partners.schema';
import { CommandModule } from 'nestjs-command';

import { BullModule } from '@nestjs/bullmq';
import {
  RESET_USER_TIER_QUEUE_NAME,
  UPGRADE_TIER_QUEUE_NAME,
} from './constants/common';
import {
  UserPartnerLog,
  UserPartnerLogSchema,
} from './schemas/user-partner-log.schema';
import { UserTierResetQueue } from './users-tier-reset.queue';
import {
  FutureOrder,
  FutureOrderSchema,
} from 'src/orders/schemas/future-order.schema';
import { Follow, FollowSchema } from 'src/follows/schemas/follow.schema';
import { PostStar, PostStarSchema } from 'src/feed/schemas/post-star.schema';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: FutureOrder.name, schema: FutureOrderSchema },
      { name: UserPartnerLog.name, schema: UserPartnerLogSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: PostStar.name, schema: PostStarSchema },
    ]),
    BullModule.registerQueue({
      name: UPGRADE_TIER_QUEUE_NAME,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    }),
    BullModule.registerQueue({
      name: RESET_USER_TIER_QUEUE_NAME,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    }),
    forwardRef(() => OrderModule),
    forwardRef(() => CommissionModule),
    WalletsModule,
    ChatbotModule,
    CommandModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [UsersController],
  providers: [UsersService,  UserTierResetQueue],
  exports: [UsersService],
})
export class UsersModule {}
