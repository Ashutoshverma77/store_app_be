// src/sizes/dto/update-size.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSizeDto } from './create-size.dto';

export class UpdateSizeDto extends PartialType(CreateSizeDto) {}
