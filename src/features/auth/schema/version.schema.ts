import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
})
export class Version extends Document {
  @Prop({ default: '' })
  version: string;

  @Prop({ default: '' })
  appName: string;

  @Prop({ default: '' })
  type: string;

  @Prop({ default: '' })
  apkUrl: string;
}

export const VersionSchema = SchemaFactory.createForClass(Version);
