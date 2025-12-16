// src/grade/grade.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Grade, GradeDocument } from './entities/grade.schema';
import {
  ActivityLogsService,
  ActivityActorInput,
} from '../activity/activity.service';

@Injectable()
export class GradeService {
  constructor(
    @InjectModel(Grade.name, 'store') private gradeModel: Model<GradeDocument>,
    private readonly activity: ActivityLogsService,
  ) {}

  private snap(grade: any) {
    if (!grade) return null;
    return {
      id: (grade._id ?? grade.id)?.toString?.() ?? null,
      name: grade.name ?? null,
      code: grade.code ?? null,
      createdAt: grade.createdAt ?? null,
      updatedAt: grade.updatedAt ?? null,
    };
  }

  async create(dto: CreateGradeDto, actor?: ActivityActorInput) {
    const created = await this.gradeModel.create(dto);
    const createdObj = created.toObject();

    await this.activity.log({
      module: 'grade',
      action: 'create',
      eventKey: 'grade.create',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'Grade',
          id: created._id!.toString(),
          label: createdObj.name ?? 'grade',
        },
      ],
      changes: {
        before: null,
        after: { grade: this.snap(createdObj) },
        delta: dto,
      },
      meta: {},
    });

    return createdObj;
  }

  async findAll() {
    // Optional: usually we DON'T log read events because it spams history.
    return this.gradeModel.find().lean();
  }

  async findOne(id: string) {
    // Optional: usually we DON'T log read events.
    const grade = await this.gradeModel.findById(id).lean();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto, actor?: ActivityActorInput) {
    const before = await this.gradeModel.findById(id).lean();
    if (!before) {
      throw new NotFoundException('Grade not found');
    }

    const updated = await this.gradeModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundException('Grade not found');
    }

    await this.activity.log({
      module: 'grade',
      action: 'update',
      eventKey: 'grade.update',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'Grade',
          id: id,
          label: updated.name ?? before.name ?? 'grade',
        },
      ],
      changes: {
        before: { grade: this.snap(before) },
        after: { grade: this.snap(updated) },
        delta: dto,
      },
      meta: {},
    });

    return updated;
  }

  async remove(id: string, createdBy?: string, actor?: ActivityActorInput) {
    const before = await this.gradeModel.findById(id).lean();
    if (!before) {
      throw new NotFoundException('Grade not found');
    }

    const deleted = await this.gradeModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new NotFoundException('Grade not found');
    }

    await this.activity.log({
      module: 'grade',
      action: 'delete',
      eventKey: 'grade.delete',
      actor: createdBy
        ? { userId: createdBy } // ✅ from Flutter uid
        : actor,
      entities: [{ type: 'Grade', id: id, label: before.name ?? 'grade' }],
      changes: {
        before: { grade: this.snap(before) },
        after: null,
        delta: { deleted: true },
      },
      meta: {},
    });

    return { deleted: true };
  }
}
