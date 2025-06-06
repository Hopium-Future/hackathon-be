import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Follow, FollowSchema } from './schemas/follow.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { Config, ESConfig } from '../configuration/config.interface';
import { OrderModule } from 'src/orders/order.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Follow.name, schema: FollowSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ConfigService<Config>) => {
        const esConfig = configService.get<ESConfig>('es');
        return {
          node: esConfig.node,
        };
      },
      inject: [ConfigService],
    }),
    OrderModule,
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
