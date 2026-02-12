import {
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMachineDto {
  // If you want user to pass it manually, keep this.
  // If you want ALWAYS auto-generate, remove this from dto.
//   @IsOptional()
//   @IsString()
//   machineCode?: string;

  @IsString()
  @MinLength(2)
  machineName: string;

  @IsMongoId()
  categoryId: string;

  @IsOptional()
  @IsMongoId()
  itemId?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class UpdateMachineDto extends PartialType(CreateMachineDto) {
  // prevent code updates unless you want it
  @IsOptional()
  @IsString()
  machineCode?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  itemId?: string;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
