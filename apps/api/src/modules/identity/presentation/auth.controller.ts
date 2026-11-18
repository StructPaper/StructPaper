import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UsePipes,
  Inject,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  LoginRequestSchema,
  ResetPasswordSchema,
  ActivateAccountSchema,
  type LoginRequest,
  type TokenResponse,
  type ResetPassword,
  type ActivateAccount,
} from '@structpaper/contracts';
import { Public } from '../../access/presentation/decorators/public.decorator';
import { AuthService } from '../application/auth.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<TokenResponse> {
    const result = await this.authService.login(body);
    if (result.refreshToken && res?.setCookie) {
      res.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Public()
  @Get('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshGet(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<TokenResponse> {
    const token = (req.cookies as Record<string, string> | undefined)?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const result = await this.authService.refresh(token);
    if (result.refreshToken && res?.setCookie) {
      res.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshPost(
    @Req() req: FastifyRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<TokenResponse> {
    const token = body?.refreshToken || (req.cookies as Record<string, string> | undefined)?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const result = await this.authService.refresh(token);
    if (result.refreshToken && res?.setCookie) {
      res.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  async refresh(
    body: { refreshToken?: string },
    req?: FastifyRequest,
    res?: FastifyReply,
  ): Promise<TokenResponse> {
    const mockRes = res || ({ setCookie: () => {} } as unknown as FastifyReply);
    const mockReq = req || ({ cookies: {} } as unknown as FastifyRequest);
    return this.refreshPost(mockReq, body, mockRes);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: FastifyRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<{ success: boolean }> {
    const token = body?.refreshToken || (req.cookies as Record<string, string> | undefined)?.refreshToken || '';
    res.clearCookie('refreshToken', { path: '/' });
    return this.authService.logout(token);
  }

  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ActivateAccountSchema))
  async activate(
    @Body() body: ActivateAccount,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.activate(body);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ResetPasswordSchema))
  async resetPassword(@Body() body: ResetPassword): Promise<{ success: boolean; message: string }> {
    return this.authService.resetPassword(body);
  }

  @Get('me')
  async me(@Headers('authorization') authHeader?: string): Promise<any> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const user = await this.authService.verifyTokenWithPermissions(token);
    return this.authService.me(user.id);
  }

  @Get('account')
  async account(@Headers('authorization') authHeader?: string): Promise<any> {
    return this.me(authHeader);
  }
}
