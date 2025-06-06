import { Body, Controller, Post, Req } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() data: LoginDto, @Req() req: FastifyRequest) {
    if (!data.hostname) {
      data.hostname = req.hostname;
    }
    const user = await this.authService.login(data);
    return user;
  }
}
