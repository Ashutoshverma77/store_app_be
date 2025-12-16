import { Module } from '@nestjs/common';
import { SizesService } from './sizes.service';
import { SizesController } from './sizes.controller';
import { SizeGateway } from './sizes.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Size, SizeSchema } from './entities/size.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Size.name, schema: SizeSchema }],
      'store',
    ),
  ],
  controllers: [SizesController],
  providers: [SizesService, SizeGateway],
})
export class SizesModule {}
