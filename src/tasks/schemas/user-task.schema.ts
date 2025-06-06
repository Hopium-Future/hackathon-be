import { Status, Type } from '../type/task.type';
import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserTaskDocument = HydratedDocument<UserTask>;

@Schema({
  timestamps: true,
  collection: 'users_tasks',
})
export class UserTask {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: true,
  })
  taskId: number;

  @Prop({
    type: String,
    required: true,
    enum: Type,
  })
  type: Type;

  @Prop({
    type: String,
    required: true,
    enum: Status,
  })
  status: Status;

  @Prop({
    type: Date,
    required: false,
  })
  completedAt?: Date;

  @Prop({
    type: Date,
    required: false,
  })
  claimedAt?: Date;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    progress?: number;
    total?: number;
  };
}

export const UserTaskSchema = SchemaFactory.createForClass(UserTask);

UserTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });
