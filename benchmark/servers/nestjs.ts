import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Post, Body } from "@nestjs/common";
import { IsString } from "class-validator";
import { ValidationPipe } from "@nestjs/common";

class EchoDto {
  @IsString()
  name!: string;
}

@Controller()
class AppController {
  @Post("echo")
  echo(@Body() dto: EchoDto) {
    return { message: `Hello ${dto.name}` };
  }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3003);
  process.send!("NestJS listening on 3003");
}
bootstrap();