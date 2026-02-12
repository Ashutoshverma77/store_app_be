// src/sorting-jobs/schemas/sorting-job.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SortingJobDocument = SortingJob & Document;

export type SortingJobStatus =
  | 'created'
  | 'started'
  | 'stopped'
  | 'restarted'
  | 'completed';

@Schema({ timestamps: false })
export class SortingJobInputBag {
  @Prop({ type: Types.ObjectId })
  bagId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  bagCode: string;

  @Prop({ type: Number, default: 0 })
  transferQtyInWt: number;

  @Prop({ type: Number, required: true, min: 0 })
  qtyInWt: number;
}

export const SortingJobInputBagSchema =
  SchemaFactory.createForClass(SortingJobInputBag);

@Schema({ timestamps: true })
export class SortingJob {
  @Prop({ type: String })
  machineId?: string;

  @Prop({ type: String })
  machineName?: string;

  @Prop({ type: Types.ObjectId, required: true })
  itemId: Types.ObjectId;

  @Prop({ type: String, required: true })
  itemName: string;

  @Prop({
    type: String,
    enum: ['created', 'started', 'stopped', 'restarted', 'completed'],
    default: 'created',
  })
  status: SortingJobStatus;

  @Prop({ type: [SortingJobInputBagSchema], default: [] })
  inputBags: SortingJobInputBag[];

  @Prop({ type: Number, default: 0 })
  totalInputQtyInBags: number;

  @Prop({ type: Number, default: 0 })
  totalInputQtyInWt: number;

  @Prop({ type: Number, default: 0 })
  totalTransferQtyInWt: number;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  stoppedAt?: Date;

  @Prop({ type: Date })
  restartedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const SortingJobSchema = SchemaFactory.createForClass(SortingJob);
