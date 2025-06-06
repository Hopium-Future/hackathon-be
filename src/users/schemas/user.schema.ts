import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AccountType } from '../constants/common';
import { Reward } from "./partners.schema";

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({
    type: Number,
    required: true,
    isInteger: true,
  })
  _id: number; // Internal ID

  @Prop({
    type: Number,
    required: true,
    unique: true,
    isInteger: true,
  })
  telegramId: number; // Telegram user ID

  @Prop({
    type: Number,
    required: false,
    index: true,
  })
  parentId?: number; // ID bố của user

  @Prop({
    type: String,
    required: true,
    trim: true,
    toUpperCase: true,
    unique: true,
  })
  referralCode: string;

  @Prop({
    type: Date,
    required: false,
  })
  referralDate?: Date;

  @Prop({
    type: Date,
    required: false,
  })
  lastLoggedIn?: Date;

  @Prop({
    type: String,
    required: false,
  })
  tonAddress?: string;

  /**
   * Username of the user or bot.
   */
  @Prop({
    type: String,
  })
  username?: string;

  @Prop({
    type: String,
    required: true,
  })
  firstName: string;

  @Prop({
    type: String,
    required: false,
  })
  lastName?: string;

  /**
   * True, if this user allowed the bot to message them.
   */
  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  allowsWriteToPm?: boolean;

  /**
   * True, if this user added the bot to the attachment menu.
   */
  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  addedToAttachmentMenu?: boolean;

  @Prop({
    type: String,
    required: false,
  })
  languageCode?: string;

  /**
   * URL of the user’s profile photo. The photo can be in .jpeg or .svg
   * formats. Only returned for Mini Apps launched from the attachment menu.
   */
  @Prop({
    type: String,
    required: false,
  })
  photoUrl?: string;

  /**
   * True, if this user is a Telegram Premium user.
   */
  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  isPremium?: boolean;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  partnerType?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  followers?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  following: number;

  @Prop({
    type: Number,
    required: true,
    enum: AccountType,
    default: AccountType.NORMAL,
  })
  accountType: AccountType;

  /**
   * True, if this user is onboarding success.
   */
  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  isOnboarding: boolean;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    realPartnerType?: number;
  };

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
