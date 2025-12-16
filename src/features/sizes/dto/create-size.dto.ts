// src/sizes/dto/create-size.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSizeDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  createdBy?: string;
}
