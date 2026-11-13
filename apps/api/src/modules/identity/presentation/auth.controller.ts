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
} from '@nestjs/common';
import {
  LoginRequestSchema,
  ResetPasswordSchema,
  type LoginRequest,
  type TokenResponse,
  type ResetPassword,
} from '@structpaper/contracts';
import { AuthService } from '../application/auth.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(@Body() body: LoginRequest): Promise<TokenResponse> {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }): Promise<TokenResponse> {
    return this.authService.refresh(body?.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { refreshToken?: string }): Promise<{ success: boolean }> {
    return this.authService.logout(body?.refreshToken || '');
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Body() body: { token: string; password: string },
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.activate(body);
  }

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
}
