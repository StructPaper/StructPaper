import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthService } from '../../../identity/application/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader =
      request.headers?.authorization ||
      request.headers?.Authorization;

    if (!authHeader || typeof authHeader !== 'string' || !/^Bearer\s+/i.test(authHeader)) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Authorization Bearer token is empty');
    }

    const user = await this.authService.verifyTokenWithPermissions(token);
    request.user = user;
    return true;
  }
}
