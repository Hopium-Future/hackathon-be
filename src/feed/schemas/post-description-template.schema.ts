import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Reactions } from '../constants/reactions';

export type PostDescriptionTemplateDocument =
  HydratedDocument<PostDescriptionTemplate>;

@Schema({
  collection: 'post_description_templates',
})
export class PostDescriptionTemplate {
  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(Reactions),
  })
  sideApply: string;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;
}

export const PostDescriptionTemplateSchema = SchemaFactory.createForClass(
  PostDescriptionTemplate,
);
