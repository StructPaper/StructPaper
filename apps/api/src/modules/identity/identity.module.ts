import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PasswordService } from './domain/password.service';
import { TokenService } from './domain/token.service';
import { MailService } from './domain/mail.service';
import { DevMailDriver } from './infrastructure/mail.service';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-structpaper-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    AuthService,
    {
      provide: MailService,
      useClass: DevMailDriver,
    },
  ],
  exports: [PasswordService, TokenService, AuthService, MailService],
})
export class IdentityModule {}
