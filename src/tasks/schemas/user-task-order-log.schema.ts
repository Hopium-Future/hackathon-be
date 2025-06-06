import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserTaskLogDocument = HydratedDocument<UserTaskOrderLog>;

@Schema({
  collection: 'users_tasks_orders_log',
})
export class UserTaskOrderLog {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number; // Telegram user ID

  @Prop({
    type: String,
    required: true,
  })
  taskCode: string;

  @Prop({
    type: Number,
    required: true,
  })
  orderId: number;
}

export const UserTaskOrderLogSchema =
  SchemaFactory.createForClass(UserTaskOrderLog);

UserTaskOrderLogSchema.index(
  { userId: 1, taskCode: 1, orderId: 1 },
  { unique: true },
);
