// src/sorting-jobs/dto/update-sorting-job.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSortingJobDto } from './create-sorting-job.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSortingJobDto extends PartialType(CreateSortingJobDto) {
  @IsOptional()
  @IsString()
  @IsIn(['created', 'started', 'stopped', 'restarted'])
  status?: 'created' | 'started' | 'stopped' | 'restarted';
}
