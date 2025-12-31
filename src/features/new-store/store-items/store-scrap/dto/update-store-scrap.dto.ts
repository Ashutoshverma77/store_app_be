import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreScrapDto } from './create-store-scrap.dto';

export class UpdateStoreScrapDto extends PartialType(CreateStoreScrapDto) {}
