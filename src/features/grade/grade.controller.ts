// src/grade/grade.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
} from '@nestjs/common';

import { GradeService } from './grade.service';
import { GradeGateway } from './grade.gateway';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Controller('/api/grades')
export class GradeController {
  constructor(
    private readonly gradeService: GradeService,
    private readonly gradeGateway: GradeGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateGradeDto) {
    const created = await this.gradeService.create(dto);
    await this.gradeGateway.broadcastGrades();
    return {
      status: true,
      msg: 'Grade created successfully',
      data: created,
    };
  }

  @Get()
  async findAll() {
    const grades = await this.gradeService.findAll();
    return {
      status: true,
      msg: 'Grades fetched successfully',
      data: grades,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const grade = await this.gradeService.findOne(id);
    return {
      status: true,
      msg: 'Grade fetched successfully',
      data: grade,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    const updated = await this.gradeService.update(id, dto);
    await this.gradeGateway.broadcastGrades();
    return {
      status: true,
      msg: 'Grade updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('createdBy') createdBy?: string) {
    const result = await this.gradeService.remove(id,createdBy);
    await this.gradeGateway.broadcastGrades();
    return {
      status: true,
      msg: 'Grade deleted successfully',
      data: result,
    };
  }
}
