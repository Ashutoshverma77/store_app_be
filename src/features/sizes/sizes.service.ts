// src/sizes/sizes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { Size, SizeDocument } from './entities/size.schema';
import {
  ActivityLogsService,
  ActivityActorInput,
} from '../activity/activity.service';

@Injectable()
export class SizesService {
  constructor(
    @InjectModel(Size.name, 'store')
    private readonly sizeModel: Model<SizeDocument>,
    private readonly activity: ActivityLogsService,
  ) {}

  private snap(size: any) {
    if (!size) return null;
    return {
      id: (size._id ?? size.id)?.toString?.() ?? null,
      name: size.name ?? null,
      code: size.code ?? null,
      createdAt: size.createdAt ?? null,
      updatedAt: size.updatedAt ?? null,
    };
  }

  async create(dto: CreateSizeDto, actor?: ActivityActorInput): Promise<Size> {
    const size = new this.sizeModel(dto);
    const created = await size.save();

    await this.activity.log({
      module: 'sizes',
      action: 'create',
      eventKey: 'sizes.create',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'Size',
          id: created._id!.toString(),
          label: created.name ?? 'size',
        },
      ],
      changes: {
        before: null,
        after: { size: this.snap(created) },
        delta: dto,
      },
      meta: {},
    });

    return created;
  }

  async findAll(): Promise<Size[]> {
    // Usually we don't log reads to avoid noisy history.
    return this.sizeModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Size> {
    const size = await this.sizeModel.findById(id).exec();
    if (!size) throw new NotFoundException('Size not found');
    return size;
  }

  async update(
    id: string,
    dto: UpdateSizeDto,
    actor?: ActivityActorInput,
  ): Promise<Size> {
    const before = await this.sizeModel.findById(id).lean();
    if (!before) throw new NotFoundException('Size not found');

    const updated = await this.sizeModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Size not found');

    await this.activity.log({
      module: 'sizes',
      action: 'update',
      eventKey: 'sizes.update',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        { type: 'Size', id, label: updated.name ?? before.name ?? 'size' },
      ],
      changes: {
        before: { size: this.snap(before) },
        after: { size: this.snap(updated) },
        delta: dto,
      },
      meta: {},
    });

    return updated;
  }

  async remove(
    id: string,
    createdBy?: string,
    actor?: ActivityActorInput,
  ): Promise<void> {
    const before = await this.sizeModel.findById(id).lean();
    if (!before) throw new NotFoundException('Size not found');

    const res = await this.sizeModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Size not found');

    await this.activity.log({
      module: 'sizes',
      action: 'delete',
      eventKey: 'sizes.delete',
      actor: createdBy
        ? { userId: createdBy } // ✅ from Flutter uid
        : actor,
      entities: [{ type: 'Size', id, label: before.name ?? 'size' }],
      changes: {
        before: { size: this.snap(before) },
        after: null,
        delta: { deleted: true },
      },
      meta: {},
    });
  }
}
