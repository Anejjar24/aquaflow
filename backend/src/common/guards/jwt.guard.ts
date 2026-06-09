import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: Error | null, user: TUser, info?: Error): TUser {
    if (err || !user) {
      const message = info?.message || 'Unauthorized';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
