import { IsNotEmpty } from 'class-validator';

export class CreateAuthDto {
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  phoneNumber: string;

  @IsNotEmpty()
  name: string;

  password: string;

  fcmToken: string;

  isActive: boolean;

  isSuperAdmin: boolean;

  devices: string[];

  deviceHistory: string[];

  apps: string[];
}
