import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const rawOrigins = config.get('FRONTEND_URL') || '';
  const configuredOrigins = rawOrigins
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  const cors: CorsOptions = {
    origin: (origin, callback) => {
      if (
        !origin ||
        configuredOrigins.includes('*') ||
        configuredOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`), false);
    },
    credentials: true,
  };

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableCors(cors);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swagger = new DocumentBuilder()
    .setTitle('EduPath XI API')
    .setVersion('2.4.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
