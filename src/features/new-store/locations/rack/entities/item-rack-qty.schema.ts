import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Room } from '../../room/entities/room.schema';
export type ItemRackQtyDocument = ItemRackQty & Document;

@Schema({ timestamps: true })
export class ItemRackQty {
  @Prop({ default: '' })
  itemId: string;

  @Prop({ default: '' })
  itemName: string;

  @Prop({ default: '' })
  rackId: string;

  @Prop({ default: '' })
  rackCode: string;

  @Prop({ min: 0, default: 0 })
  totalStockQuantity: number;

  @Prop({ min: 0, default: 0 })
  stockAvailableQuantity: number;

  @Prop({ min: 0, default: 0 })
  stockIssueQuantity: number;

  @Prop({ min: 0, default: 0 })
  stockissueCompleted: number;

  @Prop({ min: 0, default: 0 })
  stockscrapQuantity: number;
}

export const ItemRackQtySchema = SchemaFactory.createForClass(ItemRackQty);
