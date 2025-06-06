import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task, TaskSchema } from './schemas/task.schema';
import { WalletsModule } from 'src/wallets/wallets.module';
import { UserTask, UserTaskSchema } from './schemas/user-task.schema';
import { UserTaskLog, UserTaskLogSchema } from './schemas/user-task-log.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { CommissionModule } from 'src/commission/commission.module';
import {
  Depositwithdraw,
  DepositwithdrawSchema,
} from './schemas/depositwithdraw.schema';
import { TaskRewardService } from './task-reward.service';
import { UsersModule } from '../users/users.module';
import { ChatbotModule } from 'src/chatbot/chatbot.module';
import {
  UserTaskOrderLog,
  UserTaskOrderLogSchema,
} from './schemas/user-task-order-log.schema';
import {
  FutureOrder,
  FutureOrderSchema,
} from 'src/orders/schemas/future-order.schema';
import { KafkaClientModule } from 'src/kafka-client/kafka-client.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: UserTask.name, schema: UserTaskSchema },
      { name: UserTaskLog.name, schema: UserTaskLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Depositwithdraw.name, schema: DepositwithdrawSchema },
      { name: FutureOrder.name, schema: FutureOrderSchema },
      { name: UserTaskOrderLog.name, schema: UserTaskOrderLogSchema },
    ]),
    KafkaClientModule,
    WalletsModule,
    CommissionModule,
    ChatbotModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskRewardService],
  exports: [TasksService],
})
export class TasksModule {}
