import { Injectable } from '@nestjs/common';
import { CreateStoreScrapDto } from './dto/create-store-scrap.dto';
import { UpdateStoreScrapDto } from './dto/update-store-scrap.dto';

@Injectable()
export class StoreScrapService {
  create(createStoreScrapDto: CreateStoreScrapDto) {
    return 'This action adds a new storeScrap';
  }

  findAll() {
    return `This action returns all storeScrap`;
  }

  findOne(id: number) {
    return `This action returns a #${id} storeScrap`;
  }

  update(id: number, updateStoreScrapDto: UpdateStoreScrapDto) {
    return `This action updates a #${id} storeScrap`;
  }

  remove(id: number) {
    return `This action removes a #${id} storeScrap`;
  }
}
