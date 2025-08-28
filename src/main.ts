import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT', 8000);
  const corsOrigins = configService.get<string>('CORS_ORIGIN', '*');
  const originList = corsOrigins.split(',').map((o) => o.trim());

  app.enableCors({
    origin: originList, // o '*' para todos
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });


  const config = new DocumentBuilder()
    .setTitle('VideoSync api')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(PORT);
}
bootstrap();