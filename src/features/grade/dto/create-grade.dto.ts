// src/grade/dto/create-grade.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateGradeDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

//   @IsOptional()
//   @IsBoolean()
//   isActive?: boolean;
}
