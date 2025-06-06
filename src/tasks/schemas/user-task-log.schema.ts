import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserTaskLogDocument = HydratedDocument<UserTaskLog>;

@Schema({
  timestamps: true,
  collection: 'users_tasks_log',
})
export class UserTaskLog {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number; // Telegram user ID

  @Prop({
    type: Number,
    required: true,
  })
  taskId: number;

  @Prop({
    type: String,
    required: true,
  })
  action: string;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    point?: number;
  };
}

export const UserTaskLogSchema = SchemaFactory.createForClass(UserTaskLog);
