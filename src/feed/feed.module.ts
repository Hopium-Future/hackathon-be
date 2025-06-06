import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema';
import { OrderModule } from 'src/orders/order.module';
import {
  PostReaction,
  PostReactionSchema,
} from './schemas/post-reaction.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from 'src/users/schemas/user-profile.schema';
import { PostShare, PostShareSchema } from './schemas/post-share.schema';
import { ChatbotModule } from 'src/chatbot/chatbot.module';
import { PostOrder, PostOrderSchema } from './schemas/post-order.schema';
import { UsersModule } from 'src/users/users.module';
import { PostStar, PostStarSchema } from './schemas/post-star.schema';
import { SocketModule } from 'src/socket/socket.module';
import { Follow, FollowSchema } from 'src/follows/schemas/follow.schema';
import { Partner, PartnerSchema } from 'src/users/schemas/partners.schema';
import { StarPaymentModule } from 'src/star-payment/star-payment.module';
import { BullModule } from '@nestjs/bullmq';
import { FEED_QUEUE_NAME } from './constants/posts';
import { FeedQueue } from './feed.queue';
import { PriceModule } from 'src/price/price.module';
import { WalletsModule } from 'src/wallets/wallets.module';
import {
  PostDescriptionTemplate,
  PostDescriptionTemplateSchema,
} from './schemas/post-description-template.schema';
import { NotificationModule } from 'src/notification/notification.module';
import { KafkaClientModule } from 'src/kafka-client/kafka-client.module';
import {
  LeaderboardAchievement,
  LeaderboardAchievementSchema,
} from 'src/leaderboard/schemas/leaderboard-achievement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostShare.name, schema: PostShareSchema },
      { name: PostReaction.name, schema: PostReactionSchema },
      { name: PostStar.name, schema: PostStarSchema },
      { name: PostOrder.name, schema: PostOrderSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Partner.name, schema: PartnerSchema },
      {
        name: PostDescriptionTemplate.name,
        schema: PostDescriptionTemplateSchema,
      },
      {
        name: LeaderboardAchievement.name,
        schema: LeaderboardAchievementSchema,
      },
    ]),
    BullModule.registerQueue({
      name: FEED_QUEUE_NAME,
      defaultJobOptions: {
        removeOnFail: false,
        removeOnComplete: true,
      },
    }),
    KafkaClientModule,
    OrderModule,
    ChatbotModule,
    UsersModule,
    SocketModule,
    StarPaymentModule,
    PriceModule,
    WalletsModule,
    NotificationModule,
  ],
  controllers: [FeedController],
  providers: [FeedService, FeedQueue],
  exports: [FeedService],
})
export class FeedModule {}
