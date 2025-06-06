import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type AssetConfigDocument = HydratedDocument<AssetConfig>;

@Schema({
  timestamps: true,
  collection: 'assetconfigs',
})
export class AssetConfig {
  @Prop({
    type: Number,
  })
  id: number;

  @Prop({
    type: String,
  })
  assetCode: string;

  @Prop({
    type: Number,
  })
  assetDigit: number;

  @Prop({
    type: String,
  })
  assetName: string;
}

export const AssetConfigSchema = SchemaFactory.createForClass(AssetConfig);
