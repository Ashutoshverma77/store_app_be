import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, SortOrder, Types } from 'mongoose';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { Rack, RackDocument } from './entities/rack.schema';
import { RoomsService } from '../room/room.service';
import { CounterService } from '../../common/code-gen.service';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from '../../store-items/store-item/entities/stock-track.schema';

type RackQueryDto = {
  page: number;
  limit: number;
  search: string;
  sort: string;
  roomId?: string;
  allowItemId?: string;
};

@Injectable()
export class RacksService {
  constructor(
    @InjectModel(Rack.name, 'store')
    private readonly model: Model<RackDocument>,

    // ✅ NEW
    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    // ✅ NEW
    @InjectConnection('store')
    private readonly conn: Connection,

    private readonly counterService: CounterService,
    private readonly rooms: RoomsService,
  ) {}

  private oid(id: string) {
    return new Types.ObjectId(id);
  }

  private oidOrNull(id?: string | null) {
    const v = (id ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort ?? '-createdAt').trim();
    const dir: SortOrder = s.startsWith('-') ? -1 : 1;
    const field = s.replace(/^-/, '') || 'createdAt';
    return { [field]: dir } as Record<string, SortOrder>;
  }

  // ✅ NEW: safe operator id extraction (won’t break DTO typings)
  private getOperatorId(dtoLike: any): Types.ObjectId | null {
    const v = String(dtoLike?.updatedBy ?? dtoLike?.createdBy ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  // ✅ NEW: write track (qty = 0 for rack-only ops)
  private async writeTrack(input: {
    operatedBy: Types.ObjectId;
    type: StockTrackType;
    qty?: number;
    refNo?: string;
    note?: string;
    itemId?: Types.ObjectId | null;
    rackId?: Types.ObjectId | null;
  }) {
    await this.trackModel.create({
      operatedBy: input.operatedBy,
      type: input.type,
      qty: Number(input.qty ?? 0),
      refNo: input.refNo ?? '',
      note: input.note ?? '',
      itemId: input.itemId ?? null,
      rackId: input.rackId ?? null,
      categoryId: null,
      receivingId: null,
      issueId: null,
    });
  }

  /* -------------------- WS READS -------------------- */

  async findAllPaged(q: RackQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const search = (q.search || '').trim();
    const filter: any = {};

    if (q.roomId) filter.roomId = q.roomId;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { remark: { $regex: search, $options: 'i' } },
        { roomName: { $regex: search, $options: 'i' } },
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

  async findNotOccupiedRackPaged(q: RackQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    const roomOid = this.oidOrNull(q.roomId);
    if (roomOid) filter.roomId = roomOid;

    const search = (q.search || '').trim();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const allowOid = this.oidOrNull(q.allowItemId);

    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { isOccupied: false },
        { itemId: '' },
        { itemId: null },
        { itemId: { $exists: false } },
        ...(allowOid ? [{ itemId: allowOid }] : []),
      ],
    });

    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(this.sortObj(q.sort || 'name'))
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { rows, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Rack not found');
    return doc;
  }

  async findRackByRoom(roomId: string) {
    const doc = await this.model
      .find({ roomId: roomId, isOccupied: false })
      .lean();
    if (!doc) throw new NotFoundException('Rack not found');
    return doc;
  }

  /* -------------------- REST WRITES -------------------- */

  async create(dto: CreateRackDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy) throw new BadRequestException('createdBy missing/invalid');

    try {
      let created: any;

      const room = await this.rooms.findOne(dto.roomId);
      const { code } = await this.counterService.nextCode('rack', 'RK');
      const name = dto.name?.trim() || code;

      created = await this.model.create([
        {
          code,
          name,
          remark: dto.remark ?? '',
          roomId: dto.roomId,
          roomName: room?.name ?? '',
          createdBy: dto.createdBy ?? '',
        },
      ]);

      created = created?.[0];

      await this.trackModel.create([
        {
          operatedBy,
          type: 'CREATE',
          qty: 0,
          refNo: created?.code ?? '',
          rackId: created?._id ?? null,
          itemId: '',
          note: `Rack created: ${created?.name ?? ''} (${created?.code ?? ''})`,
        },
      ]);

      return { status: true, msg: 'Rack created', data: created };
    } finally {
    }
  }

  async update(id: string, dto: UpdateRackDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy)
      throw new BadRequestException('updatedBy/createdBy missing/invalid');

    // const session = await
    try {
      let updated: any;

      // await session.withTransaction(async () => {
      const patch: any = {};
      if (dto.name != null) patch.name = dto.name.trim();
      if (dto.remark != null) patch.remark = dto.remark;

      if (dto.roomId != null) {
        const room = await this.rooms.findOne(dto.roomId);
        patch.roomId = dto.roomId;
        patch.roomName = room?.name ?? '';
      }

      updated = await this.model.findByIdAndUpdate(id, patch, {
        new: true,
        // session,
      });
      if (!updated) throw new NotFoundException('Rack not found');

      await this.trackModel.create(
        [
          {
            operatedBy,
            type: 'EDIT',
            qty: 0,
            refNo: updated.code ?? '',
            rackId: updated._id,
            itemId: updated.itemId
              ? new Types.ObjectId(String(updated.itemId))
              : null,
            note: `Rack updated: ${updated.name ?? ''} (${updated.code ?? ''})`,
          },
        ],
        // { session },
      );
      // });

      return { status: true, msg: 'Rack updated', data: updated };
    } finally {
      // await session.endSession();
    }
  }

  // ✅ signature extended (optional) but backward compatible
  async remove(id: string, operatedById?: string) {
    const operatedBy =
      operatedById && Types.ObjectId.isValid(operatedById)
        ? new Types.ObjectId(operatedById)
        : null;

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const deleted = await this.model.findByIdAndDelete(id);
      if (!deleted) throw new NotFoundException('Rack not found');

      // log only if operator provided
      if (operatedBy) {
        await this.trackModel.create(
          [
            {
              operatedBy,
              type: 'CANCELLED',
              qty: 0,
              refNo: deleted.code ?? '',
              rackId: deleted._id,
              itemId: deleted.itemId
                ? new Types.ObjectId(String(deleted.itemId))
                : null,
              note: `Rack deleted: ${deleted.name ?? ''} (${deleted.code ?? ''})`,
            },
          ],
          // { session },
        );
      }
      // });

      return { status: true, msg: 'Rack deleted' };
    } finally {
      // await session.endSession();
    }
  }

  // ✅ signature extended (optional) but backward compatible
  async occupyRackIfFree(
    rackId: string,
    itemId: string,
    operatedById?: string,
  ) {
    const operatedBy =
      operatedById && Types.ObjectId.isValid(operatedById)
        ? new Types.ObjectId(operatedById)
        : null;

    // const session = await
    try {
      let rack: any;

      // await session.withTransaction(async () => {
      rack = await this.model.findOneAndUpdate(
        {
          _id: this.oid(rackId),
          $or: [{ isOccupied: false }, { itemId: null }, { itemId: '' }],
        },
        {
          $set: { isOccupied: true, itemId: this.oid(itemId) },
        },
        { new: true },
      );

      if (!rack) throw new BadRequestException('Rack already occupied');

      if (operatedBy) {
        await this.trackModel.create(
          [
            {
              operatedBy,
              type: 'EDIT',
              qty: 0,
              refNo: rack.code ?? '',
              rackId: rack._id,
              itemId: this.oid(itemId),
              note: `Rack occupied by item. Rack=${rack.code ?? ''}, Item=${itemId}`,
            },
          ],
          // { session },
        );
      }
      // });

      return rack;
    } finally {
      // await session.endSession();
    }
  }

  // ✅ signature extended (optional) but backward compatible
  async releaseRackForItem(
    rackId: string,
    itemId: string,
    operatedById?: string,
  ) {
    const operatedBy =
      operatedById && Types.ObjectId.isValid(operatedById)
        ? new Types.ObjectId(operatedById)
        : null;

    // const session = await
    try {
      let released = false;

      // await session.withTransaction(async () => {
      const res = await this.model.updateOne(
        { _id: this.oid(rackId), itemId: this.oid(itemId) },
        { $set: { isOccupied: false, itemId: null } },
        // { session },
      );

      released = res.modifiedCount > 0;

      if (released && operatedBy) {
        const rack = await this.model
          .findById(rackId)
          // .session(session)
          .lean();

        await this.trackModel.create(
          [
            {
              operatedBy,
              type: 'EDIT',
              qty: 0,
              refNo: (rack as any)?.code ?? '',
              rackId: this.oid(rackId),
              itemId: this.oid(itemId),
              note: `Rack released from item. Rack=${(rack as any)?.code ?? ''}, Item=${itemId}`,
            },
          ],
          // { session },
        );
      }
      // });

      return released;
    } finally {
      // await session.endSession();
    }
  }
}
