import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AccessModule } from '../access/access.module';
import { UserService } from './application/user.service';
import { UserController } from './presentation/user.controller';

@Module({
  imports: [IdentityModule, AccessModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
