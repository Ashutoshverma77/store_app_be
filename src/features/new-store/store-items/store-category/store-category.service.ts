import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, SortOrder, Types } from 'mongoose';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryPagedQueryDto,
} from './dto/store-category.dto';
import { StoreCategory } from './entities/store-category.schema';
import { CounterService } from '../../common/code-gen.service';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from '../store-item/entities/stock-track.schema';

// ✅ STOCK TRACK (rename StockMovement -> StockTrack)

@Injectable()
export class StoreCategoryService {
  constructor(
    @InjectModel(StoreCategory.name, 'store')
    private readonly model: Model<StoreCategory>,

    // ✅ track model
    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    // ✅ transaction connection
    @InjectConnection('store')
    private readonly conn: Connection,

    private readonly seq: CounterService,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || 'name').trim();
    const desc = s.startsWith('-');
    const field = (desc ? s.slice(1) : s) || 'name';
    return { [field]: (desc ? -1 : 1) as SortOrder } as Record<
      string,
      SortOrder
    >;
  }

  private getOperatorId(dtoLike: any): Types.ObjectId | null {
    const v = String(dtoLike?.updatedBy ?? dtoLike?.createdBy ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  private async trackCategory(
    // session: any,
    input: {
      type: StockTrackType;
      operatedBy: Types.ObjectId;
      categoryId: Types.ObjectId;
      refNo?: string;
      note?: string;
    },
  ) {
    await this.trackModel.create(
      [
        {
          type: input.type,
          qty: 0, // ✅ category ops do not move stock
          refNo: input.refNo ?? '',
          note: input.note ?? '',

          operatedBy: input.operatedBy,

          // ✅ keep only categoryId
          categoryId: input.categoryId,
          itemId: null,
          rackId: null,
          receivingId: null,
          issueId: null,
        },
      ],
      // { session },
    );
  }

  async create(dto: CreateCategoryDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy) throw new BadRequestException('createdBy missing/invalid');

    // const { code } = await this.seq.nextCode('itemcategory', 'CT');
    var check = await this.model.find();
    const format = this.seq.format('CT', check.length + 1);
    // const session = await
    try {
      let createdDoc: any;

      // await session.withTransaction(async () => {
      const created = await this.model.create(
        [
          {
           code: format,
            name: dto.name,
            remark: dto.remark ?? '',
            parentId: dto.parentId ? dto.parentId : '',
            createdBy: dto.createdBy ?? '',
          },
        ],
        // { session },
      );

      createdDoc = created?.[0];
      if (!createdDoc) return;

      await this.trackCategory({
        type: 'CREATE',
        operatedBy,
        categoryId: createdDoc._id,
        refNo: createdDoc.code ?? format,
        note: `Category created: ${createdDoc.name ?? ''} (${createdDoc.code ?? ''})`,
      });
      // });

      return createdDoc?.toObject?.() ?? createdDoc;
    } finally {
      // await session.endSession();
    }
  }

  async update(dto: UpdateCategoryDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy)
      throw new BadRequestException('updatedBy/createdBy missing/invalid');

    const patch: any = {};
    if (dto.name != null) patch.name = dto.name;
    if (dto.remark != null) patch.remark = dto.remark;
    if (dto.parentId !== undefined)
      patch.parentId = dto.parentId ? new Types.ObjectId(dto.parentId) : null;

    // const session = await
    try {
      let updated: any;

      // await session.withTransaction(async () => {
      updated = await this.model
        .findByIdAndUpdate(dto.id, { $set: patch }, { new: true })
        .lean();

      if (!updated) return;

      await this.trackCategory({
        type: 'EDIT',
        operatedBy,
        categoryId: new Types.ObjectId(String(updated._id)),
        refNo: String(updated.code ?? ''),
        note: `Category updated: ${String(updated.name ?? '')} (${String(updated.code ?? '')})`,
      });
      // });

      return updated;
    } finally {
      // await session.endSession();
    }
  }

  async delete(id: string, operatedById?: string) {
    const operatedBy =
      operatedById && Types.ObjectId.isValid(operatedById)
        ? new Types.ObjectId(operatedById)
        : null;

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const deleted: any = await this.model.findByIdAndDelete(id);
      if (!deleted) return;

      // If you didn't pass operatedById, we still delete category without tracking.
      if (operatedBy) {
        await this.trackCategory({
          type: 'CANCELLED',
          operatedBy,
          categoryId: deleted._id,
          refNo: String(deleted.code ?? ''),
          note: `Category deleted: ${String(deleted.name ?? '')} (${String(deleted.code ?? '')})`,
        });
      }
      // });

      return true;
    } finally {
      // await session.endSession();
    }
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

  async findperent() {
    return await this.model.find({ parentId: '' }).lean();
  }

  async findchild(id: string) {
    console.log(id);
    return await this.model.find({ parentId: id }).lean();
  }
}
