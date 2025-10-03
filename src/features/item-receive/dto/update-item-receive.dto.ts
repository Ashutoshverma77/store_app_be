import { PartialType } from '@nestjs/mapped-types';
import { CreateItemReceiveDto } from './create-item-receive.dto';

export class UpdateItemReceiveDto extends PartialType(CreateItemReceiveDto) {}
