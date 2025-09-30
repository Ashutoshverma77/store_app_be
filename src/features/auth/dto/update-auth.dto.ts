import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty } from 'class-validator';
import { CreateAuthDto } from './create-auth.dto.js';

export class UpdateAuthDto extends PartialType(CreateAuthDto) {
  @IsNotEmpty()
  id: string;
}
