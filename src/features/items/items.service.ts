// src/items/items.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item, ItemDocument } from './entities/item.schema';

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name, 'store')
    private readonly itemModel: Model<ItemDocument>,
  ) {}

  async create(dto: CreateItemDto): Promise<Item> {
    const payload: any = { ...dto };

    if (dto.sizeId) payload.sizeId = new Types.ObjectId(dto.sizeId);
    if (dto.gradeId) payload.gradeId = new Types.ObjectId(dto.gradeId);

    const item = new this.itemModel(payload);
    return item.save();
  }

  async findAll(): Promise<Item[]> {
    return await this.itemModel
      .find()
      // .populate('sizeId')
      // .populate('gradeId')
      .sort({ name: 1 })
      .exec();
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

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    const payload: any = { ...dto };
    if (dto.sizeId) payload.sizeId = new Types.ObjectId(dto.sizeId);
    if (dto.gradeId) payload.gradeId = new Types.ObjectId(dto.gradeId);

    const item = await this.itemModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async remove(id: string): Promise<void> {
    const res = await this.itemModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Item not found');
  }
}
