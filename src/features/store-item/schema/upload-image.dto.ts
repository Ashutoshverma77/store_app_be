import { IsString, MinLength } from 'class-validator';

export class UploadBase64Dto {
  @IsString()
  @MinLength(20)
  base64!: string; // "data:image/png;base64,...."
}
