// src/auth/dto/reset-password.dto.ts
import { IsNotEmpty, MinLength, IsOptional } from 'class-validator';

/** Admin-only reset; defaults to '250925' if newPassword not supplied. */
export class ResetPasswordDto {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
