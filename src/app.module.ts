import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { FeaturesModule } from './features/features.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UpdateModule } from './update/update.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web'),
    }),
    MongooseModule.forRoot(process.env.MONGO_URI!, {
      connectionName: 'auth',
    }),
    MongooseModule.forRoot(process.env.MONGO_URI!, {
      connectionName: 'store',
    }),
    FeaturesModule,
    UpdateModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
