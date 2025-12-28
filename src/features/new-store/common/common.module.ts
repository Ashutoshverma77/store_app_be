import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './entities/counter.schema';
import { CounterService } from './code-gen.service';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Counter.name, schema: CounterSchema }],
      'store',
    ),
  ],
  providers: [CounterService],
  exports: [CounterService],
})
export class CommonModule {}
