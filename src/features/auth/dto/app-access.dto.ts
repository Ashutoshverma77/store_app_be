// app-access.dto.ts
import { IsArray, IsString, ArrayNotEmpty, IsNotEmpty } from 'class-validator';

export class AppAccessDto {
  @IsString()
  @IsNotEmpty()
  app: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  access: string[];
}
