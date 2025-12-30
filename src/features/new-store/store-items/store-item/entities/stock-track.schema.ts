// stock-stock-track.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StockTrackType =
  | 'CREATE'
  | 'EDIT'
  | 'APPROVED'
  | 'CANCELLED'
  | 'RECEIVE'
  | 'ISSUE'
  | 'RETURN'
  | 'SCRAP'
  | 'ADJUST'
  | 'CLOSED';

export type StockTrackDocument = HydratedDocument<StockTrack>;

@Schema({ timestamps: true, versionKey: false })
export class StockTrack {
  @Prop({ default: '' })
  itemId: string;

  @Prop({ default: '' })
  categoryId?: string;

  @Prop({ default: '' })
  rackId?: string;

  @Prop({ default: '' })
  receivingId?: string;

  @Prop({ default: '' })
  issueId?: string;

  @Prop({
    required: true,
    enum: [
      'CREATE',
      'EDIT',
      'APPROVED',
      'CANCELLED',
      'RECEIVE',
      'ISSUE',
      'RETURN',
      'SCRAP',
      'ADJUST',
      'CLOSED',
    ],
    index: true,
  })
  type: StockTrackType;

  // + for receive/return/adjust up, - for issue/scrap/adjust down, 0 for workflow events
  @Prop({ required: true })
  qty: number;

  @Prop({ default: '' })
  refNo: string;

  @Prop({ default: '' })
  operatedBy: string;

  @Prop({ default: '' })
  note: string;
}

export const StockTrackSchema = SchemaFactory.createForClass(StockTrack);

// indexes
StockTrackSchema.index({ itemId: 1, createdAt: -1 });
StockTrackSchema.index({ type: 1, createdAt: -1 });
StockTrackSchema.index({ issueId: 1, createdAt: -1 });
StockTrackSchema.index({ receivingId: 1, createdAt: -1 });
