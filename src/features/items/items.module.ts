import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { ItemsGateway } from './items.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Item, ItemSchema } from './entities/item.schema';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Item.name, schema: ItemSchema }],
      'store',
    ),
    ActivityModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsGateway],
})
export class ItemsModule {}
