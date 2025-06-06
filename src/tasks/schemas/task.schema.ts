import { Condition, Group, Type } from '../type/task.type';
import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TaskDocument = HydratedDocument<Task>;

@Schema({
  timestamps: true,
  collection: 'tasks',
})
export class Task {
  @Prop({
    type: Number,
    required: true,
  })
  _id: number; // Task ID

  @Prop({
    type: String,
    required: true,
  })
  code: string;

  @Prop({
    type: String,
    required: true,
  })
  title: string;

  @Prop({
    type: String,
    required: true,
    default: 'JOIN',
  })
  buttonText: string;

  @Prop({
    type: String,
    required: true,
    enum: Condition,
  })
  condition: Condition;

  @Prop({
    type: Boolean,
    required: true,
  })
  isEnable: boolean;

  @Prop({
    type: String,
    required: false,
  })
  icon: string;

  @Prop({
    type: String,
    required: true,
    enum: Type,
  })
  type: Type;

  @Prop({
    type: String,
    required: true,
    enum: Group,
  })
  group: Group;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  rewardId: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  rewardQuantity: number;

  @Prop({
    type: String,
    required: true,
  })
  link: string;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    total?: number;
  };
}

export const TaskSchema = SchemaFactory.createForClass(Task);
