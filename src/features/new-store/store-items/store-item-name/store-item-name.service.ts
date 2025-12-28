import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import {
  CreateItemNameDto,
  ItemNamePagedQueryDto,
  UpdateItemNameDto,
} from './dto/item-name.dto';
import { StoreItemName } from './entities/store-item-name.schema';
import { CounterService } from '../../common/code-gen.service';

@Injectable()
export class StoreItemNameService {
  constructor(
    @InjectModel(StoreItemName.name,
      'store',)
    private readonly model: Model<StoreItemName>,
    private readonly seq: CounterService,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || '-createdAt').trim();
    const desc = s.startsWith('-');
    const field = desc ? s.slice(1) : s;
    return { [field]: desc ? -1 : 1 };
  }

  async create(dto: CreateItemNameDto) {
    const { code } = await this.seq.nextCode('itemname', 'IT');
    const created = await this.model.create({
      code,
      name: dto.name,
      remark: dto.remark ?? '',
      createdBy: dto.createdBy ?? '',
    });
    return created.toObject();
  }

  async update(dto: UpdateItemNameDto) {
    const updated = await this.model
      .findByIdAndUpdate(
        dto.id,
        {
          $set: {
            ...(dto.name != null ? { name: dto.name } : {}),
            ...(dto.remark != null ? { remark: dto.remark } : {}),
          },
        },
        { new: true },
      )
      .lean();
    return updated;
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(id);
    return true;
  }

  async findAllPaged(q: ItemNamePagedQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(300, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<StoreItemName> = {};
    const search = (q.search || '').trim();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { remark: { $regex: search, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(this.sortObj(q.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { rows, total, page, limit };
  }

  async findOne(id: string) {
    return this.model.findById(id).lean();
  }
}
