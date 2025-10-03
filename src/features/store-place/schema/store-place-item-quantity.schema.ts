import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StorePlaceItemQuantity {
  @Prop({ required: true, trim: true })
  itemId: string;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ required: true, trim: true })
  placeId: string;

  @Prop({ required: true, trim: true })
  placeName: string;

  @Prop({ required: true, trim: true })
  totalQuantity: string;

  @Prop({ required: true, trim: true })
  IssuedQuantity: string;

  @Prop({ required: true, trim: true })
  completedQuantity: string;

  @Prop({ trim: true, default: '' })
  remark: string;

  @Prop({ trim: true, default: '' })
  createdBy: string;
}

export const StorePlaceItemQuantitySchema = SchemaFactory.createForClass(StorePlaceItemQuantity);
