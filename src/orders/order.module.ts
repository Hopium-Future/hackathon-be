import { forwardRef, Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { MongooseModule } from '@nestjs/mongoose';
import { FutureOrder, FutureOrderSchema } from './schemas/future-order.schema';
import {
  FutureOrderLog,
  FutureOrderLogSchema,
} from './schemas/future-order-log.schema';
import { UsersModule } from '../users/users.module';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { Config, ESConfig } from '../configuration/config.interface';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FutureOrder.name, schema: FutureOrderSchema },
      { name: FutureOrderLog.name, schema: FutureOrderLogSchema },
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
    forwardRef(() => UsersModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
