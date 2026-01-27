import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDivisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  divisionName: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
