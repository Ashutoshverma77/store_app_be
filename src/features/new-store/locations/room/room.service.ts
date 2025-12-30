import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, SortOrder, Types } from 'mongoose';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomDocument } from './entities/room.schema';
import { CounterService } from '../../common/code-gen.service';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from '../../store-items/store-item/entities/stock-track.schema';
import { Rack, RackDocument } from '../rack/entities/rack.schema';

// ✅ STOCK TRACK

type PagedQuery = {
  page: number;
  limit: number;
  search: string;
  sort: string;
};

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name, 'store')
    private readonly model: Model<RoomDocument>,

    @InjectModel(Rack.name, 'store')
    private readonly rackmodel: Model<RackDocument>,
    // ✅ track model
    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    private readonly counterService: CounterService,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort ?? '-createdAt').trim();
    const dir: SortOrder = s.startsWith('-') ? -1 : 1;
    const field = s.replace(/^-/, '') || 'createdAt';
    return { [field]: dir } as Record<string, SortOrder>;
  }

  // ✅ operator id extraction (supports createdBy / updatedBy)
  private getOperatorId(dtoLike: any): Types.ObjectId | null {
    const v = String(dtoLike?.updatedBy ?? dtoLike?.createdBy ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  // ✅ create track entry (qty=0 for room ops)
  private async writeTrack(input: {
    operatedBy: Types.ObjectId;
    type: StockTrackType;
    qty?: number;
    refNo?: string;
    note?: string;
    roomId?: Types.ObjectId | null;
  }) {
    await this.trackModel.create({
      operatedBy: input.operatedBy,
      type: input.type,
      qty: Number(input.qty ?? 0),
      refNo: input.refNo ?? '',
      note: input.note ?? '',
      // Room is not part of schema fields, so keep these null
      itemId: null,
      categoryId: null,
      rackId: null,
      receivingId: null,
      issueId: null,
    });
  }

  async findAllPaged(q: PagedQuery) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const search = (q.search || '').trim();
    const filter: any = {};
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
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Room not found');
    return doc;
  }

  async findAllRoom() {
    const doc = await this.model.find().lean();
    if (!doc) throw new NotFoundException('Room not found');
    return doc;
  }

  /* -------------------- REST WRITES -------------------- */

  async create(dto: CreateRoomDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy) throw new BadRequestException('createdBy missing/invalid');

    // const session = await
    try {
      let created: any;

      // await session.withTransaction(async () => {
      const { code } = await this.counterService.nextCode('room', 'RM');
      const name = dto.name?.trim() || code;

      created = await this.model.create(
        [
          {
            code,
            name,
            remark: dto.remark ?? '',
            createdBy: dto.createdBy ?? '',
          },
        ],
        // { session },
      );

      created = created?.[0];

      await this.trackModel.create(
        [
          {
            operatedBy,
            type: 'CREATE',
            qty: 0,
            refNo: created?.code ?? '',
            note: `Room created: ${created?.name ?? ''} (${created?.code ?? ''})`,
            itemId: null,
            categoryId: null,
            rackId: null,
            receivingId: null,
            issueId: null,
          },
        ],
        // { session },
      );
      // });

      return { status: true, msg: 'Room created', data: created };
    } finally {
      // await session.endSession();
    }
  }

  async createrackroom(dto: any) {
    console.log(dto);
    // const operatedBy = this.getOperatorId(dto);
    // if (!operatedBy) throw new BadRequestException('createdBy missing/invalid');

    // const session = await
    try {
      const { name, remark, createdBy, rackmake } = dto;
      const coderoom = await this.counterService.nextCode('room', 'RM');
      // Step 1: Create the room
      const newRoom = await this.model.create({
        code: coderoom.code,
        name,
        remark: remark ?? '',
        createdBy: createdBy ?? '',
      });

      // Step 2: Create the racks
      // const racks = [];
      for (let i = 0; i < rackmake; i++) {
        const { code } = await this.counterService.nextCode('rack', 'RK');

        var rack = await this.rackmodel.create({
          code,
          name,
          remark: remark ?? '',
          roomId: newRoom._id,
          roomName: newRoom?.name ?? '',
          createdBy: createdBy ?? '',
        });

        await this.trackModel.create([
          {
            operatedBy: createdBy,
            type: 'CREATE',
            qty: 0,
            refNo: rack?.code ?? '',
            rackId: rack?._id ?? '',
            itemId: '',
            note: `Rack created: ${rack?.name ?? ''} (${rack?.code ?? ''})`,
          },
        ]);
      }

      // Step 3: Save racks

      // return { status: true, msg: 'Room and racks created successfully' };

      // created = created?.[0];

      await this.trackModel.create(
        [
          {
            operatedBy: createdBy,
            type: 'CREATE',
            qty: 0,
            refNo: newRoom?.code ?? '',
            note: `Room created: ${newRoom?.name ?? ''} (${newRoom?.code ?? ''})`,
            itemId: '',
            categoryId: '',
            rackId: '',
            receivingId: '',
            issueId: '',
          },
        ],
        // { session },
      );
      // });

      return { status: true, msg: 'Room created', data: newRoom };
    } finally {
      // await session.endSession();
    }
  }

  async update(id: string, dto: UpdateRoomDto) {
    const operatedBy = this.getOperatorId(dto);
    if (!operatedBy)
      throw new BadRequestException('updatedBy/createdBy missing/invalid');

    // const session = await
    try {
      let updated: any;

      // await session.withTransaction(async () => {
      updated = await this.model.findByIdAndUpdate(
        id,
        {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.remark != null ? { remark: dto.remark } : {}),
        },
        { new: true },
      );

      if (!updated) throw new NotFoundException('Room not found');

      await this.trackModel.create(
        [
          {
            operatedBy,
            type: 'EDIT',
            qty: 0,
            refNo: updated?.code ?? '',
            note: `Room updated: ${updated?.name ?? ''} (${updated?.code ?? ''})`,
            itemId: null,
            categoryId: null,
            rackId: null,
            receivingId: null,
            issueId: null,
          },
        ],
        // { session },
      );
      // });

      return { status: true, msg: 'Room updated', data: updated };
    } finally {
      // await session.endSession();
    }
  }

  // ✅ backward compatible: if you cannot send operatedBy, it still deletes
  async remove(id: string, operatedById?: string) {
    const operatedBy =
      operatedById && Types.ObjectId.isValid(operatedById)
        ? new Types.ObjectId(operatedById)
        : null;

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const deleted = await this.model.findByIdAndDelete(id);
      if (!deleted) throw new NotFoundException('Room not found');

      if (operatedBy) {
        await this.trackModel.create(
          [
            {
              operatedBy,
              type: 'CANCELLED',
              qty: 0,
              refNo: deleted?.code ?? '',
              note: `Room deleted: ${deleted?.name ?? ''} (${deleted?.code ?? ''})`,
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
      // });

      return { status: true, msg: 'Room deleted' };
    } finally {
      // await session.endSession();
    }
  }
}
