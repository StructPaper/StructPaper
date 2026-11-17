import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../../identity/application/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Registered as a GLOBAL guard (APP_GUARD in AppModule): every route needs a valid access token
 * unless it is explicitly marked with @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Optional() @Inject(Reflector) private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
