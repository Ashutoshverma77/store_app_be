import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder } from 'mongoose';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomDocument } from './entities/room.schema';
import { CounterService } from '../../common/code-gen.service';

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
    private readonly counterService: CounterService,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort ?? '-createdAt').trim();

    const dir: SortOrder = s.startsWith('-') ? -1 : 1; // ✅ SortOrder (not number)
    const field = s.replace(/^-/, '') || 'createdAt';

    return { [field]: dir } as Record<string, SortOrder>; // ✅ cast is important
  }

  async findAllPaged(q: {
    page: number;
    limit: number;
    search: string;
    sort: string;
  }) {
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
        .sort(this.sortObj(q.sort)) // ✅ now typed correctly
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

  /* -------------------- REST WRITES -------------------- */

  async create(dto: CreateRoomDto) {
    const { code } = await this.counterService.nextCode('room', 'RM');
    const name = dto.name?.trim() || code;

    const created = await this.model.create({
      code,
      name,
      remark: dto.remark ?? '',
      createdBy: dto.createdBy ?? '',
    });

    return { status: true, msg: 'Room created', data: created };
  }

  async update(id: string, dto: UpdateRoomDto) {
    const updated = await this.model.findByIdAndUpdate(
      id,
      {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.remark != null ? { remark: dto.remark } : {}),
      },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Room not found');
    return { status: true, msg: 'Room updated', data: updated };
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Room not found');
    return { status: true, msg: 'Room deleted' };
  }
}
