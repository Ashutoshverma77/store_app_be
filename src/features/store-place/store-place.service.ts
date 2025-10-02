import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorePlace } from './schema/store-place.schema';
import { CreateStorePlaceDto } from './dto/create-store-place.dto';
import { UpdateStorePlaceDto } from './dto/update-store-place.dto';

@Injectable()
export class StorePlaceService {
  constructor(
    @InjectModel(StorePlace.name, 'store')
    private storePlaceSchema: Model<StorePlace>,
  ) {}

  async create(createStorePlaceDto: CreateStorePlaceDto) {
    await this.storePlaceSchema.create(createStorePlaceDto);

    return { msg: 'Store Place Created Successfully.....', status: true };
  }

  async findAll() {
    return await this.storePlaceSchema.find();
  }

  async findOne(id: string) {
    return await this.storePlaceSchema.findById(id);
  }

  async update(id: string, updateStorePlaceDto: UpdateStorePlaceDto) {
    var check = await this.storePlaceSchema.findById(id);
    if (!check) {
      return { msg: 'Store Place Update Failed', status: false };
    }

    await this.storePlaceSchema.findByIdAndUpdate(id, updateStorePlaceDto);
    return { msg: 'Store Place Updated Successfully.....', status: true };
  }

  async remove(id: string) {
    var check = await this.storePlaceSchema.findById(id);
    if (!check) {
      return { msg: 'Store Place Delete Failed', status: false };
    }
    await this.storePlaceSchema.findByIdAndDelete(id);
    return { msg: 'Store Place Deleted Successfully.....', status: true };
  }
}
