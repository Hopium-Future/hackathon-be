import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['x-auth-user'];
    if (!authHeader) {
      throw new UnauthorizedException();
    }
    try {
      const user = this.authService.parseUserFromHeader(authHeader);
      request.user = user;
    } catch (e) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
