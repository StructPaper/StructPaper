import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UserService } from './application/user.service';
import { UserController } from './presentation/user.controller';

@Module({
  imports: [IdentityModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
