// src/items/items.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item, ItemDocument } from './entities/item.schema';
import {
  ActivityActorInput,
  ActivityLogsService,
} from '../activity/activity.service';

type ApiResponse<T> = {
  status: boolean;
  msg: string;
  data: T;
};

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name, 'store')
    private readonly itemModel: Model<ItemDocument>,

    private readonly activity: ActivityLogsService,
  ) {}

  private itemSnap(item: any) {
    if (!item) return null;
    return {
      id: item._id?.toString?.() ?? item.id,
      code: item.code,
      name: item.name,
      openingStock: Number(item.openingStock) || 0,
      unit: item.unit,
      sizeId: item.sizeId?.toString?.() ?? item.sizeId,
      size: item.size,
      gradeId: item.gradeId?.toString?.() ?? item.gradeId,
      grade: item.grade,
    };
  }

  async create(
    dto: CreateItemDto,
    actor?: ActivityActorInput,
  ): Promise<ApiResponse<Item>> {
    const payload: any = { ...dto };

    const itemcount = await this.itemModel.countDocuments();

    payload.code = `Item-${itemcount + 1}`;

    if (dto.sizeId) payload.sizeId = new Types.ObjectId(dto.sizeId);
    if (dto.gradeId) payload.gradeId = new Types.ObjectId(dto.gradeId);

    const item = new this.itemModel(payload);
    const saved = await item.save();

    // await this.activity.log({
    //   module: 'items',
    //   action: 'create',
    //   eventKey: 'items.create',
    //   actor: dto.createdBy
    //     ? { userId: dto.createdBy } // ✅ from Flutter uid
    //     : actor,
    //   entities: [
    //     { type: 'Item', id: saved._id!.toString(), label: saved.name },
    //   ],
    //   changes: {
    //     before: null,
    //     after: { item: this.itemSnap(saved) },
    //     delta: {
    //       openingStock: Number(saved.openingStock) || 0,
    //     },
    //   },
    //   meta: { dto },
    // });

    return { status: true, msg: 'Item created', data: saved };
  }

  async findAll(): Promise<Item[]> {
    return await this.itemModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.itemModel
      .findById(id)
      .populate('sizeId')
      .populate('gradeId')
      .exec();

    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(
    id: string,
    dto: UpdateItemDto,
    actor?: ActivityActorInput,
  ): Promise<Item> {
    const before = await this.itemModel.findById(id).lean();
    if (!before) throw new NotFoundException('Item not found');

    const payload: any = { ...dto };
    if (dto.sizeId) payload.sizeId = new Types.ObjectId(dto.sizeId);
    if (dto.gradeId) payload.gradeId = new Types.ObjectId(dto.gradeId);

    const updated = await this.itemModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Item not found');

    const beforeSnap = this.itemSnap(before);
    const afterSnap = this.itemSnap(updated);

    // delta (only key metrics you care about; extend if needed)
    const delta: any = {
      openingStock:
        (afterSnap!.openingStock ?? 0) - (beforeSnap!.openingStock ?? 0),
    };

    await this.activity.log({
      module: 'items',
      action: 'update',
      eventKey: 'items.update',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [{ type: 'Item', id: String(id), label: updated.name }],
      changes: {
        before: { item: beforeSnap },
        after: { item: afterSnap },
        delta,
      },
      meta: { dto },
    });

    return updated;
  }

  async remove(
    id: string,
    createdBy?: string,
    actor?: ActivityActorInput,
  ): Promise<void> {
    const before = await this.itemModel.findById(id).lean();
    if (!before) throw new NotFoundException('Item not found');

    const res = await this.itemModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Item not found');

    await this.activity.log({
      module: 'items',
      action: 'delete',
      eventKey: 'items.delete',
      actor: createdBy
        ? { userId: createdBy } // ✅ from Flutter uid
        : actor,
      entities: [{ type: 'Item', id: String(id), label: before.name }],
      changes: {
        before: { item: this.itemSnap(before) },
        after: { item: null },
        delta: null,
      },
      meta: {},
    });
  }
}
