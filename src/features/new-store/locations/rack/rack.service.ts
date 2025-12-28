import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { Rack, RackDocument } from './entities/rack.schema';
import { RoomsService } from '../room/room.service';
import { CounterService } from '../../common/code-gen.service';

type RackQueryDto = {
  page: number;
  limit: number;
  search: string;
  sort: string;
  roomId?: string; // filter by room
  // ✅ allow current item rack (for edit / transfer view)
  allowItemId?: string;
};

@Injectable()
export class RacksService {
  constructor(
    @InjectModel(Rack.name, 'store')
    private readonly model: Model<RackDocument>,
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

    const dir: SortOrder = s.startsWith('-') ? -1 : 1; // ✅ SortOrder (not number)
    const field = s.replace(/^-/, '') || 'createdAt';

    return { [field]: dir } as Record<string, SortOrder>; // ✅ cast is important
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

    // console.log(rows);

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
        { itemId: null },
        { itemId: { $exists: false } },
        ...(allowOid ? [{ itemId: allowOid }] : []),
      ],
    });

    console.log('RACK_FILTER =>', JSON.stringify(filter));

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

  /* -------------------- REST WRITES -------------------- */

  async create(dto: CreateRackDto) {
    const room = await this.rooms.findOne(dto.roomId); // validates room existence
    const { code } = await this.counterService.nextCode('rack', 'RK');
    const name = dto.name?.trim() || code;

    const created = await this.model.create({
      code,
      name,
      remark: dto.remark ?? '',
      roomId: dto.roomId,
      roomName: room?.name ?? '',
      createdBy: dto.createdBy ?? '',
    });

    return { status: true, msg: 'Rack created', data: created };
  }

  async update(id: string, dto: UpdateRackDto) {
    const patch: any = {};
    if (dto.name != null) patch.name = dto.name.trim();
    if (dto.remark != null) patch.remark = dto.remark;

    if (dto.roomId != null) {
      const room = await this.rooms.findOne(dto.roomId);
      patch.roomId = dto.roomId;
      patch.roomName = room?.name ?? '';
    }

    const updated = await this.model.findByIdAndUpdate(id, patch, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Rack not found');
    return { status: true, msg: 'Rack updated', data: updated };
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Rack not found');
    return { status: true, msg: 'Rack deleted' };
  }

  async occupyRackIfFree(rackId: string, itemId: string) {
    const rack = await this.model.findOneAndUpdate(
      {
        _id: this.oid(rackId),
        $or: [{ isOccupied: false }, { itemId: null }, { itemId: '' }],
      },
      {
        $set: {
          isOccupied: true,
          itemId: this.oid(itemId),
        },
      },
      { new: true },
    );

    if (!rack) {
      throw new Error('Rack already occupied');
    }
    return rack;
  }

  async releaseRackForItem(rackId: string, itemId: string) {
    // Only release if this rack really belongs to this item
    const res = await this.model.updateOne(
      { _id: this.oid(rackId), itemId: this.oid(itemId) },
      { $set: { isOccupied: false, itemId: null } },
    );
    return res.modifiedCount > 0;
  }
}
