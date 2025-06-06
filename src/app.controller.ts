import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller()
@ApiBearerAuth()
export class AppController {
  constructor() {}

  @Get('ping')
  getHello(): string {
    return 'pong pong';
  }

  @Get('health')
  getHealth(): string {
    return 'ok';
  }
}
