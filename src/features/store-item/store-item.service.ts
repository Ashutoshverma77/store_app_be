import { Injectable } from '@nestjs/common';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { InjectModel } from '@nestjs/mongoose';
import { StoreItem } from './schema/store-item.schema';
import { Model } from 'mongoose';

@Injectable()
export class StoreItemService {
  constructor(
    @InjectModel(StoreItem.name, 'store')
    private storeItemSchema: Model<StoreItem>,
  ) {}

  async create(createStoreItemDto: CreateStoreItemDto) {
    await this.storeItemSchema.create(createStoreItemDto);

    return { msg: 'Store Item Created Successfully.....', status: true };
  }

  async findAll() {
    return await this.storeItemSchema.find();
  }

  async findOne(id: string) {
    return await this.storeItemSchema.findById(id);
  }

  async update(id: string, updateStoreItemDto: UpdateStoreItemDto) {
    var check = await this.storeItemSchema.findById(id);
    if (!check) {
      return { msg: 'Store Item Update Failed', status: false };
    }

    await this.storeItemSchema.findByIdAndUpdate(id, updateStoreItemDto);
    return { msg: 'Store Item Updated Successfully.....', status: true };
  }

  async remove(id: string) {
    var check = await this.storeItemSchema.findById(id);
    if (!check) {
      return { msg: 'Store Item Delete Failed', status: false };
    }
    await this.storeItemSchema.findByIdAndDelete(id);
    return { msg: 'Store Item Deleted Successfully.....', status: true };
  }
}
