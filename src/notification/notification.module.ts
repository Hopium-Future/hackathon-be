import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationQueue } from './notification.queue';
import { NOTIFICATION_QUEUE_NAME } from './constants/notification.constants';
import { SocketModule } from 'src/socket/socket.module';
import { Follow, FollowSchema } from 'src/follows/schemas/follow.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { ChatbotModule } from 'src/chatbot/chatbot.module';
import { OrderModule } from 'src/orders/order.module';
import { PostOrder, PostOrderSchema } from 'src/feed/schemas/post-order.schema';
import { Post, PostSchema } from 'src/feed/schemas/post.schema';
import { PostStar, PostStarSchema } from 'src/feed/schemas/post-star.schema';
import {
  FutureOrder,
  FutureOrderSchema,
} from 'src/orders/schemas/future-order.schema';
import { PriceModule } from 'src/price/price.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Follow.name, schema: FollowSchema },
      { name: User.name, schema: UserSchema },
      { name: PostOrder.name, schema: PostOrderSchema },
      { name: FutureOrder.name, schema: FutureOrderSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostStar.name, schema: PostStarSchema },
    ]),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE_NAME,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    }),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node: configService.get('ELASTICSEARCH_NODE'),
      }),
      inject: [ConfigService],
    }),
    SocketModule,
    ChatbotModule,
    PriceModule,
    forwardRef(() => OrderModule),
  ],
  providers: [NotificationService, NotificationQueue],
  exports: [NotificationService, NotificationQueue],
})
export class NotificationModule {}
