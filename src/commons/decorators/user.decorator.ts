import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserHeader } from 'src/auth/type/auth.type';

export const UserAuth = createParamDecorator(
  (data: any, ctx: ExecutionContext): UserHeader => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
