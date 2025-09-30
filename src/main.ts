import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', // Replace with specific origins if needed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Include all allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Add any required headers
    credentials: true, // If you need to send cookies or credentials
    exposedHeaders: [], // If you need to expose specific headers
    maxAge: 12 * 60 * 60, // 12 hours in seconds
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 80);

  console.log(`API on http://localhost:${process.env.PORT || 80}`);
}
bootstrap();
