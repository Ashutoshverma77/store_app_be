// src/grade/grade.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Grade, GradeDocument } from './entities/grade.schema';

@Injectable()
export class GradeService {
  constructor(
    @InjectModel(Grade.name, 'store') private gradeModel: Model<GradeDocument>,
  ) {}

  async create(dto: CreateGradeDto) {
    const created = await this.gradeModel.create(dto);
    return created.toObject();
  }

  async findAll() {
    return this.gradeModel.find().lean();
  }

  async findOne(id: string) {
    const grade = await this.gradeModel.findById(id).lean();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto) {
    const updated = await this.gradeModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Grade not found');
    }
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.gradeModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new NotFoundException('Grade not found');
    }
    return { deleted: true };
  }
}
