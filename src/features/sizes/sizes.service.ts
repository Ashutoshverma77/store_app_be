// src/sizes/sizes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { Size, SizeDocument } from './entities/size.schema';

@Injectable()
export class SizesService {
  constructor(
    @InjectModel(Size.name, 'store')
    private readonly sizeModel: Model<SizeDocument>,
  ) {}

  async create(dto: CreateSizeDto): Promise<Size> {
    const size = new this.sizeModel(dto);
    return size.save();
  }

  async findAll(): Promise<Size[]> {
    return this.sizeModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Size> {
    const size = await this.sizeModel.findById(id).exec();
    if (!size) throw new NotFoundException('Size not found');
    return size;
  }

  async update(id: string, dto: UpdateSizeDto): Promise<Size> {
    const size = await this.sizeModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!size) throw new NotFoundException('Size not found');
    return size;
  }

  async remove(id: string): Promise<void> {
    const res = await this.sizeModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Size not found');
  }
}
