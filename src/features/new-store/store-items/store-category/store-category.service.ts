import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryPagedQueryDto,
} from './dto/store-category.dto';
import { StoreCategory } from './entities/store-category.schema';
import { CounterService } from '../../common/code-gen.service';

@Injectable()
export class StoreCategoryService {
  constructor(
    @InjectModel(StoreCategory.name, 'store')
    private readonly model: Model<StoreCategory>,
    private readonly seq: CounterService,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || 'name').trim();
    const desc = s.startsWith('-');
    const field = desc ? s.slice(1) : s;
    return { [field]: desc ? -1 : 1 };
  }

  async create(dto: CreateCategoryDto) {
    const { code } = await this.seq.nextCode('itemcategory', 'CT');
    const created = await this.model.create({
      code,
      name: dto.name,
      remark: dto.remark ?? '',
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      createdBy: dto.createdBy ?? '',
    });
    return created.toObject();
  }

  async update(dto: UpdateCategoryDto) {
    const patch: any = {};
    if (dto.name != null) patch.name = dto.name;
    if (dto.remark != null) patch.remark = dto.remark;
    if (dto.parentId !== undefined)
      patch.parentId = dto.parentId ? new Types.ObjectId(dto.parentId) : null;

    const updated = await this.model
      .findByIdAndUpdate(dto.id, { $set: patch }, { new: true })
      .lean();
    return updated;
  }

  async delete(id: string) {
    // NOTE: If you want, you can also delete all children. For now, hard delete only this row.
    await this.model.findByIdAndDelete(id);
    return true;
  }

  async findAllPaged(q: CategoryPagedQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(500, Math.max(1, Number(q.limit || 50)));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<StoreCategory> = {};
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
