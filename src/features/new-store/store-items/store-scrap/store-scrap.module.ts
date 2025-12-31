import { Module } from '@nestjs/common';
import { StoreScrapService } from './store-scrap.service';
import { StoreScrapController } from './store-scrap.controller';
import { StoreScrapGateway } from './store-scrap.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreScrap, StoreScrapSchema } from './entities/store-scrap.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: StoreScrap.name, schema: StoreScrapSchema }],
      'store',
    ),
  ],
  controllers: [StoreScrapController],
  providers: [StoreScrapService, StoreScrapGateway],
})
export class StoreScrapModule {}
