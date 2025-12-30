import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Connection,
  FilterQuery,
  Model,
  SortOrder,
  Types,
  ClientSession,
} from 'mongoose';
import {
  CreateItemNameDto,
  ItemNamePagedQueryDto,
  UpdateItemNameDto,
} from './dto/item-name.dto';
import { StoreItemName } from './entities/store-item-name.schema';
import { CounterService } from '../../common/code-gen.service';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from '../store-item/entities/stock-track.schema';

// ✅ Stock Stock Track (renamed from StockMovement)

@Injectable()
export class StoreItemNameService {
  constructor(
    @InjectModel(StoreItemName.name, 'store')
    private readonly model: Model<StoreItemName>,
    private readonly seq: CounterService,

    // ✅ Track Model
    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    // ✅ Transaction connection
    @InjectConnection('store')
    private readonly conn: Connection,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || '-createdAt').trim();
    const desc = s.startsWith('-');
    const field = desc ? s.slice(1) : s;
    return { [field]: (desc ? -1 : 1) as SortOrder } as Record<
      string,
      SortOrder
    >;
  }

  private oidOrNull(id?: string | null) {
    const v = String(id ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  private mustOperatorId(id?: string | null, label = 'operatedBy') {
    const op = this.oidOrNull(id);
    if (!op) throw new BadRequestException(`${label} missing/invalid`);
    return op;
  }

  private async track(input: {
    type: StockTrackType;
    qty: number;
    operatedBy: Types.ObjectId;
    refNo?: string;
    note?: string;
  }) {
    await this.trackModel.create(
      [
        {
          type: input.type,
          qty: Number(input.qty || 0),
          refNo: input.refNo ?? '',
          note: input.note ?? '',
          operatedBy: input.operatedBy,

          // master entity => no stock references
          itemId: null,
          categoryId: null,
          rackId: null,
          receivingId: null,
          issueId: null,
        },
      ],
      // { session },
    );
  }

  async create(dto: CreateItemNameDto) {
    const operatedBy = this.mustOperatorId(dto.createdBy, 'createdBy');

    // const session = await
    try {
      let out: any;

      // await session.withTransaction(async () => {
      const { code } = await this.seq.nextCode('itemname', 'ITN');

      const created = await this.model.create(
        [
          {
            code,
            name: dto.name,
            remark: dto.remark ?? '',
            createdBy: dto.createdBy ?? '',
          },
        ],
        // { session },
      );

      const doc = created?.[0];
      if (!doc) throw new BadRequestException('Create failed');

      await this.track({
        type: 'CREATE',
        qty: 0,
        operatedBy,
        refNo: String(code),
        note: `ItemName created: ${String(dto.name ?? '')} (${String(code)})`,
      });

      out = doc.toObject();
      // });

      return out;
    } finally {
      // await session.endSession();
    }
  }

  async update(dto: UpdateItemNameDto) {
    // if you have updatedBy, use that; otherwise reuse createdBy for audit
    const operatedBy = this.mustOperatorId(
      (dto as any).updatedBy ?? (dto as any).createdBy,
      'updatedBy',
    );

    // const session = await
    try {
      let updated: any;

      // await session.withTransaction(async () => {
      const prev = await this.model.findById(dto.id);
      if (!prev) throw new BadRequestException('ItemName not found');

      updated = await this.model
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

      if (!updated) throw new BadRequestException('Update failed');

      const changes: string[] = [];
      if (dto.name != null && dto.name !== String((prev as any).name ?? '')) {
        changes.push(
          `name: "${String((prev as any).name ?? '')}" -> "${dto.name}"`,
        );
      }
      if (
        dto.remark != null &&
        dto.remark !== String((prev as any).remark ?? '')
      ) {
        changes.push(`remark updated`);
      }

      await this.track({
        type: 'EDIT',
        qty: 0,
        operatedBy,
        refNo: String((updated as any).code ?? ''),
        note: `ItemName updated: ${String((updated as any).name ?? '')}. ${
          changes.length ? changes.join(', ') : 'no field diff'
        }`,
      });
      // });

      return updated;
    } finally {
      // await session.endSession();
    }
  }

  async delete(id: string, deletedBy?: string) {
    const operatedBy = this.mustOperatorId(deletedBy, 'deletedBy');

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const doc = await this.model.findById(id);
      if (!doc) throw new BadRequestException('ItemName not found');

      await this.model.deleteOne({ _id: doc._id });

      await this.track({
        type: 'CANCELLED',
        qty: 0,
        operatedBy,
        refNo: String((doc as any).code ?? ''),
        note: `ItemName deleted: ${String((doc as any).name ?? '')} (${String(
          (doc as any).code ?? '',
        )})`,
      });
      // });

      return true;
    } finally {
      // await session.endSession();
    }
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
