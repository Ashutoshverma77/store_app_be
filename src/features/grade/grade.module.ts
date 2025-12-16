// src/grade/grade.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GradeController } from './grade.controller';
import { GradeService } from './grade.service';
import { GradeGateway } from './grade.gateway';
import { Grade, GradeSchema } from './entities/grade.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Grade.name, schema: GradeSchema }],
      'store',
    ),
  ],
  controllers: [GradeController],
  providers: [GradeService, GradeGateway],
  exports: [GradeService],
})
export class GradeModule {}
